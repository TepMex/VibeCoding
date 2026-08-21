package com.tepmex.sttplayerdroid.sync

import android.os.SystemClock
import com.tepmex.sttplayerdroid.MatchResult
import com.tepmex.sttplayerdroid.PerformanceTiming
import com.tepmex.sttplayerdroid.SttLanguage
import com.tepmex.sttplayerdroid.TranscriptionResult
import com.tepmex.sttplayerdroid.audio.PcmSnapshotProvider
import com.tepmex.sttplayerdroid.book.TextLocator
import com.tepmex.sttplayerdroid.data.LibraryDao
import com.tepmex.sttplayerdroid.data.MetadataDao
import com.tepmex.sttplayerdroid.data.PerformanceLogEntity
import com.tepmex.sttplayerdroid.model.SpeechTranscriber
import com.tepmex.sttplayerdroid.playback.PlaybackController
import com.tepmex.sttplayerdroid.util.AppException
import com.tepmex.sttplayerdroid.util.ErrorCode
import com.tepmex.sttplayerdroid.util.appError
import com.tepmex.sttplayerdroid.util.describeCause
import com.tepmex.sttplayerdroid.util.getUserMessage
import com.tepmex.sttplayerdroid.util.logError
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch

sealed interface SyncState {
    data object Idle : SyncState
    data object Preparing : SyncState
    data object Transcribing : SyncState
    data object Searching : SyncState
    data class Matched(val transcript: String, val result: MatchResult, val timing: PerformanceTiming) : SyncState
    data class Error(val message: String) : SyncState
}

class SyncCoordinator(
    private val playback: PlaybackController,
    private val pcm: PcmSnapshotProvider,
    private val transcriber: SpeechTranscriber,
    private val locator: TextLocator,
    private val libraryDao: LibraryDao,
    private val metadataDao: MetadataDao,
) {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)
    private val mutableState = MutableStateFlow<SyncState>(SyncState.Idle)
    val state: StateFlow<SyncState> = mutableState.asStateFlow()
    val canSync: Boolean get() = pcm.bufferedSeconds >= 2f
    private var job: Job? = null

    fun sync(
        bookUri: String,
        language: SttLanguage,
        chapterId: String?,
        anchorChunkId: String?,
        pausePlayback: Boolean = true,
    ) {
        if (job?.isActive == true) return
        job = scope.launch {
            runSync(bookUri, language, chapterId, anchorChunkId, pausePlayback)
        }
    }

    /**
     * Same pipeline as [sync], but suspends until a terminal [SyncState.Matched] or [SyncState.Error].
     * If a sync is already running, waits for that run instead of starting another.
     */
    suspend fun syncAwait(
        bookUri: String,
        language: SttLanguage,
        chapterId: String?,
        anchorChunkId: String?,
        pausePlayback: Boolean = true,
    ): SyncState {
        if (job?.isActive == true) {
            return state.first { it is SyncState.Matched || it is SyncState.Error }
        }
        var terminal: SyncState = SyncState.Idle
        val started = scope.launch {
            terminal = runSync(bookUri, language, chapterId, anchorChunkId, pausePlayback)
        }
        job = started
        started.join()
        return terminal
    }

    private suspend fun runSync(
        bookUri: String,
        language: SttLanguage,
        chapterId: String?,
        anchorChunkId: String?,
        pausePlayback: Boolean,
    ): SyncState {
        val started = SystemClock.elapsedRealtime()
        if (pausePlayback) playback.pause()
        mutableState.value = SyncState.Preparing
        val bufferedSeconds = pcm.bufferedSeconds
        val snapshot = pcm.snapshot(5)
        if (snapshot == null || snapshot.size < 32_000) {
            val error = appError(
                code = ErrorCode.SYNC_BUFFER_TOO_SHORT,
                userMessage = "Нужно воспроизвести не менее двух секунд аудио, затем нажмите «Найти в тексте».",
                debugMessage = "PCM buffer too short for sync: bufferedSeconds=$bufferedSeconds snapshotSamples=${snapshot?.size ?: 0} requiredSamples=32000",
                context = mapOf(
                    "bufferedSeconds" to bufferedSeconds,
                    "snapshotSamples" to (snapshot?.size ?: 0),
                    "bookUri" to bookUri,
                    "language" to language.code,
                ),
            )
            logError("SyncCoordinator", error)
            return setTerminal(SyncState.Error(error.userMessage))
        }
        try {
            mutableState.value = SyncState.Transcribing
            val transcription = transcriber.transcribe(snapshot, language)
            if (transcription.text.isBlank()) {
                throw appError(
                    code = ErrorCode.NO_SPEECH_DETECTED,
                    userMessage = "Речь не распознана. Прослушайте фрагмент с речью и повторите поиск.",
                    debugMessage = "Blank transcript after inference; samples=${snapshot.size} language=${language.code} tokens=${transcription.tokenIds.size}",
                    context = mapOf(
                        "samples" to snapshot.size,
                        "language" to language.code,
                        "tokenCount" to transcription.tokenIds.size,
                        "timing" to transcription.timing,
                    ),
                )
            }
            mutableState.value = SyncState.Searching
            if (!locator.hasActiveIndex()) {
                throw appError(
                    code = ErrorCode.SEARCH_INDEX_MISSING,
                    userMessage = "Индекс книги ещё не готов. Откройте книгу снова и повторите поиск.",
                    debugMessage = "locate() called without active text index; bookUri=$bookUri",
                    context = mapOf("bookUri" to bookUri, "transcript" to transcription.text),
                )
            }
            val searchStart = SystemClock.elapsedRealtime()
            val result = locator.locate(transcription.text, chapterId, anchorChunkId)
            val searchMs = SystemClock.elapsedRealtime() - searchStart
            val timing = transcription.timing.copy(searchMs = searchMs, totalMs = SystemClock.elapsedRealtime() - started)
            if (result == null) {
                log(transcription, timing, false)
                val error = appError(
                    code = ErrorCode.SYNC_NO_MATCH,
                    userMessage = "Фрагмент «${transcription.text}» не найден в тексте книги.",
                    debugMessage = "No fuzzy match for transcript='${transcription.text}' chapterId=$chapterId anchorChunkId=$anchorChunkId searchMs=$searchMs",
                    context = mapOf(
                        "transcript" to transcription.text,
                        "chapterId" to chapterId,
                        "anchorChunkId" to anchorChunkId,
                        "searchMs" to searchMs,
                        "bookUri" to bookUri,
                    ),
                )
                logError("SyncCoordinator", error)
                return setTerminal(SyncState.Error(error.userMessage))
            }
            libraryDao.saveAnchor(bookUri, result.chunkId)
            log(transcription, timing, true)
            return setTerminal(SyncState.Matched(transcription.text, result, timing))
        } catch (error: Exception) {
            val appError = if (error is AppException) {
                logError(
                    "SyncCoordinator",
                    error,
                    mapOf(
                        "bookUri" to bookUri,
                        "language" to language.code,
                        "chapterId" to chapterId,
                        "anchorChunkId" to anchorChunkId,
                        "elapsedMs" to (SystemClock.elapsedRealtime() - started),
                    ),
                )
            } else {
                logError(
                    "SyncCoordinator",
                    appError(
                        code = ErrorCode.SYNC_FAILED,
                        userMessage = "Синхронизация не удалась. Попробуйте ещё раз.",
                        debugMessage = "Sync pipeline failed: ${describeCause(error)}",
                        cause = error,
                        context = mapOf(
                            "bookUri" to bookUri,
                            "language" to language.code,
                            "chapterId" to chapterId,
                            "anchorChunkId" to anchorChunkId,
                            "elapsedMs" to (SystemClock.elapsedRealtime() - started),
                        ),
                    ),
                )
            }
            return setTerminal(SyncState.Error(getUserMessage(appError, "Ошибка синхронизации")))
        }
    }

    private fun setTerminal(state: SyncState): SyncState {
        mutableState.value = state
        return state
    }

    fun reset() { if (job?.isActive != true) mutableState.value = SyncState.Idle }

    private suspend fun log(result: TranscriptionResult, timing: PerformanceTiming, matched: Boolean) {
        metadataDao.log(
            PerformanceLogEntity(
                transcript = result.text,
                matched = matched,
                preprocessingMs = timing.preprocessingMs,
                modelInitializationMs = timing.modelInitializationMs,
                encodeMs = timing.encodeMs,
                decodeMs = timing.decodeMs,
                searchMs = timing.searchMs,
                totalMs = timing.totalMs,
            ),
        )
    }
}
