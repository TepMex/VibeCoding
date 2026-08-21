package com.tepmex.sttplayerdroid.sync

import android.net.Uri
import android.util.Log
import com.tepmex.sttplayerdroid.SttPlayerApplication
import com.tepmex.sttplayerdroid.util.ErrorCode
import com.tepmex.sttplayerdroid.util.appError
import com.tepmex.sttplayerdroid.util.getUserMessage
import com.tepmex.sttplayerdroid.util.logError
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import kotlinx.coroutines.withTimeoutOrNull

/**
 * Runs the same «Найти в тексте» pipeline from a media-notification action and publishes the
 * matched book fragment as a public expandable notification — no unlock required.
 */
class LockScreenFindInText(
    private val application: SttPlayerApplication,
    private val pausePlayer: () -> Unit,
    private val notifier: TextMatchNotifier = TextMatchNotifier(application),
) {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)
    private var job: Job? = null

    fun trigger() {
        if (job?.isActive == true) {
            notifier.showSearching(null)
            return
        }
        pausePlayer()
        job = scope.launch {
            val container = application.container
            val library = application.database.library()
            val book = runCatching { library.observeBooks().first().firstOrNull() }
                .onFailure { Log.e(TAG, "Failed to load recent book", it) }
                .getOrNull()
            if (book == null) {
                val error = appError(
                    code = ErrorCode.SYNC_FAILED,
                    userMessage = "Сначала откройте книгу в приложении, чтобы искать фрагмент без разблокировки.",
                    debugMessage = "Lock-screen find-in-text with no recent book",
                )
                logError(TAG, error)
                notifier.showError(error.userMessage)
                return@launch
            }
            notifier.showSearching(book.title)

            val restored = runCatching { container.bookRepository.restore(Uri.parse(book.uri)) }
                .getOrElse { error ->
                    val appError = logError(
                        TAG,
                        error,
                        mapOf("uri" to book.uri, "stage" to "lockscreen_restore"),
                        ErrorCode.BOOK_RESTORE_FAILED,
                        "Не удалось подготовить книгу для поиска с экрана блокировки.",
                    )
                    notifier.showError(getUserMessage(appError, appError.userMessage))
                    return@launch
                }
            if (restored == null) {
                notifier.showError("Не удалось открыть последнюю книгу. Откройте файл в приложении.")
                return@launch
            }

            val terminal = withTimeoutOrNull(SYNC_TIMEOUT_MS) {
                container.syncCoordinator.syncAwait(
                    bookUri = book.uri,
                    language = book.language,
                    chapterId = book.selectedChapterId,
                    anchorChunkId = book.anchorChunkId,
                    pausePlayback = false,
                )
            }
            when (val state = terminal) {
                is SyncState.Matched -> {
                    val chunks = library.chunks(book.uri).map {
                        MatchedTextPresenter.ChunkSnippet(it.id, it.text)
                    }
                    val fragment = MatchedTextPresenter.buildExpandedFragment(
                        chunks,
                        state.result.chunkId,
                    ).ifBlank { state.result.matchedText }
                    notifier.showMatch(book.title, fragment)
                }
                is SyncState.Error -> notifier.showError(state.message)
                null -> notifier.showError("Поиск занял слишком много времени. Попробуйте ещё раз.")
                else -> notifier.showError("Поиск не вернул результат. Попробуйте ещё раз.")
            }
        }
    }

    companion object {
        private const val TAG = "LockScreenFindInText"
        private const val SYNC_TIMEOUT_MS = 120_000L
    }
}
