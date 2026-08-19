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
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
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

    fun sync(bookUri: String, language: SttLanguage, chapterId: String?, anchorChunkId: String?) {
        if (job?.isActive == true) return
        job = scope.launch {
            val started = SystemClock.elapsedRealtime()
            playback.pause()
            mutableState.value = SyncState.Preparing
            val snapshot = pcm.snapshot(5)
            if (snapshot == null || snapshot.size < 32_000) {
                mutableState.value = SyncState.Error("Нужно воспроизвести не менее двух секунд")
                return@launch
            }
            try {
                mutableState.value = SyncState.Transcribing
                val transcription = transcriber.transcribe(snapshot, language)
                if (transcription.text.isBlank()) throw IllegalStateException("Речь не распознана")
                mutableState.value = SyncState.Searching
                val searchStart = SystemClock.elapsedRealtime()
                val result = locator.locate(transcription.text, chapterId, anchorChunkId)
                val searchMs = SystemClock.elapsedRealtime() - searchStart
                val timing = transcription.timing.copy(searchMs = searchMs, totalMs = SystemClock.elapsedRealtime() - started)
                if (result == null) {
                    log(transcription, timing, false)
                    mutableState.value = SyncState.Error("Фрагмент «${transcription.text}» не найден")
                } else {
                    libraryDao.saveAnchor(bookUri, result.chunkId)
                    log(transcription, timing, true)
                    mutableState.value = SyncState.Matched(transcription.text, result, timing)
                }
            } catch (error: Exception) {
                mutableState.value = SyncState.Error(error.message ?: "Ошибка синхронизации")
            }
        }
    }

    fun reset() { if (job?.isActive != true) mutableState.value = SyncState.Idle }

    private suspend fun log(result: TranscriptionResult, timing: PerformanceTiming, matched: Boolean) {
        metadataDao.log(PerformanceLogEntity(
            transcript = result.text, matched = matched,
            preprocessingMs = timing.preprocessingMs, modelInitializationMs = timing.modelInitializationMs,
            encodeMs = timing.encodeMs, decodeMs = timing.decodeMs,
            searchMs = timing.searchMs, totalMs = timing.totalMs,
        ))
    }
}

