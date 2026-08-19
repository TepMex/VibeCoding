package com.tepmex.sttplayerdroid.ui

import android.app.Application
import android.database.Cursor
import android.net.Uri
import android.provider.OpenableColumns
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.tepmex.sttplayerdroid.BookDocument
import com.tepmex.sttplayerdroid.SttLanguage
import com.tepmex.sttplayerdroid.SttPlayerApplication
import com.tepmex.sttplayerdroid.model.ModelState
import com.tepmex.sttplayerdroid.sync.SyncState
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

class PlayerViewModel(application: Application) : AndroidViewModel(application) {
    private val container = (application as SttPlayerApplication).container
    val modelState = container.modelManager.state
    val playback = container.playback.state
    val syncState = container.syncCoordinator.state
    val recentBooks = container.bookRepository.recentBooks.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())
    val recentAudio = container.playback.recentAudio.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())
    val performanceLogs = container.database.metadata().observeLogs().stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())

    private val mutableDocument = MutableStateFlow<BookDocument?>(null)
    val document: StateFlow<BookDocument?> = mutableDocument.asStateFlow()
    private val mutableLanguage = MutableStateFlow(SttLanguage.English)
    val language: StateFlow<SttLanguage> = mutableLanguage.asStateFlow()
    private val mutableChapterId = MutableStateFlow<String?>(null)
    val chapterId: StateFlow<String?> = mutableChapterId.asStateFlow()
    private val mutableError = MutableStateFlow<String?>(null)
    val error: StateFlow<String?> = mutableError.asStateFlow()

    init {
        viewModelScope.launch {
            val recent = container.bookRepository.recentBooks.first().firstOrNull() ?: return@launch
            runCatching { container.bookRepository.restore(Uri.parse(recent.uri)) }
                .onSuccess {
                    mutableDocument.value = it
                    mutableLanguage.value = recent.language
                    mutableChapterId.value = recent.selectedChapterId
                }
        }
    }

    fun installModel() = container.modelManager.install()
    fun retryModel() = container.modelManager.retry()

    fun openBook(uri: Uri) = viewModelScope.launch {
        mutableError.value = null
        runCatching { container.bookRepository.import(uri) }
            .onSuccess {
                mutableDocument.value = it
                mutableChapterId.value = null
            }
            .onFailure { mutableError.value = it.message }
    }

    fun openAudio(uri: Uri) = viewModelScope.launch {
        container.playback.open(uri, displayName(uri))
    }

    fun openRecentBook(uri: String) = viewModelScope.launch {
        mutableError.value = null
        runCatching { container.bookRepository.restore(Uri.parse(uri)) }
            .onSuccess { restored ->
                mutableDocument.value = restored
                val saved = recentBooks.value.firstOrNull { it.uri == uri }
                if (saved != null) {
                    mutableLanguage.value = saved.language
                    mutableChapterId.value = saved.selectedChapterId
                }
            }
            .onFailure { mutableError.value = it.message }
    }

    fun openRecentAudio(uri: String) = viewModelScope.launch {
        val saved = recentAudio.value.firstOrNull { it.uri == uri } ?: return@launch
        container.playback.open(Uri.parse(uri), saved.displayName)
    }

    fun selectLanguage(value: SttLanguage) {
        mutableLanguage.value = value
        saveBookOptions()
    }

    fun selectChapter(value: String?) {
        mutableChapterId.value = value
        saveBookOptions()
    }

    fun playPause() = container.playback.playPause()
    fun seekBy(ms: Long) = container.playback.seekBy(ms)
    fun seekTo(ms: Long) = container.playback.seekTo(ms)
    fun canSync(): Boolean = container.syncCoordinator.canSync && mutableDocument.value != null
    fun sync() {
        val document = mutableDocument.value ?: return
        val currentBook = recentBooks.value.firstOrNull { it.uri == document.sourceUri.toString() }
        container.syncCoordinator.sync(
            document.sourceUri.toString(), mutableLanguage.value, mutableChapterId.value, currentBook?.anchorChunkId,
        )
    }

    fun clearMessage() { mutableError.value = null; container.syncCoordinator.reset() }

    private fun saveBookOptions() {
        val uri = mutableDocument.value?.sourceUri ?: return
        viewModelScope.launch { container.bookRepository.saveOptions(uri, mutableLanguage.value, mutableChapterId.value) }
    }

    private fun displayName(uri: Uri): String {
        val resolver = getApplication<Application>().contentResolver
        return resolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)?.use { cursor: Cursor ->
            if (cursor.moveToFirst()) cursor.getString(0) else null
        } ?: uri.lastPathSegment ?: "audio.mp3"
    }
}
