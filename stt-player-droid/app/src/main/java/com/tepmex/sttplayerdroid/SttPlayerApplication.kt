package com.tepmex.sttplayerdroid

import android.app.Application
import android.content.ComponentCallbacks2
import com.tepmex.sttplayerdroid.audio.CaptureAudioProcessor
import com.tepmex.sttplayerdroid.book.AndroidBookParser
import com.tepmex.sttplayerdroid.book.BookRepository
import com.tepmex.sttplayerdroid.book.IndexedTextLocator
import com.tepmex.sttplayerdroid.data.AppDatabase
import com.tepmex.sttplayerdroid.model.DefaultModelManager
import com.tepmex.sttplayerdroid.model.WhisperSpeechTranscriber
import com.tepmex.sttplayerdroid.playback.PlaybackController
import com.tepmex.sttplayerdroid.sync.SyncCoordinator

class SttPlayerApplication : Application() {
    /**
     * Owned by Application (not [AppContainer]) so [com.tepmex.sttplayerdroid.playback.PlaybackService]
     * can access it while [container] is still being constructed via MediaController bind.
     */
    val captureProcessor = CaptureAudioProcessor()

    /**
     * Room only — used by [com.tepmex.sttplayerdroid.playback.PlaybackService] for progress
     * tracking and Media3 playback resumption after reboot / process death.
     * Must not pull in [AppContainer] (UI MediaController, model, sync).
     */
    val database by lazy { AppDatabase.create(this) }

    val container by lazy { AppContainer(this) }

    override fun onTrimMemory(level: Int) {
        super.onTrimMemory(level)
        if (level >= ComponentCallbacks2.TRIM_MEMORY_RUNNING_CRITICAL) {
            container.transcriber.releaseForCriticalMemory()
        }
    }
}

class AppContainer(application: SttPlayerApplication) {
    val database = application.database
    val captureProcessor = application.captureProcessor
    val modelManager = DefaultModelManager(application)
    val locator = IndexedTextLocator(application, database.metadata())
    val bookRepository = BookRepository(application, AndroidBookParser(application), locator, database.library())
    val playback = PlaybackController(application, database.library())
    val transcriber = WhisperSpeechTranscriber(application, modelManager)
    val syncCoordinator = SyncCoordinator(
        playback, captureProcessor, transcriber, locator, database.library(), database.metadata(),
    )
}
