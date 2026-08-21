package com.tepmex.sttplayerdroid.playback

import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Handler
import android.os.Looper
import android.util.Log
import androidx.annotation.OptIn
import androidx.core.content.ContextCompat
import androidx.media3.common.AudioAttributes
import androidx.media3.common.C
import androidx.media3.common.MediaItem
import androidx.media3.common.MediaMetadata
import androidx.media3.common.MimeTypes
import androidx.media3.common.Player
import androidx.media3.common.TrackSelectionParameters.AudioOffloadPreferences
import androidx.media3.common.util.UnstableApi
import androidx.media3.exoplayer.DefaultRenderersFactory
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.exoplayer.audio.AudioSink
import androidx.media3.exoplayer.audio.DefaultAudioSink
import androidx.media3.session.CommandButton
import androidx.media3.session.MediaLibraryService
import androidx.media3.session.MediaLibraryService.MediaLibrarySession
import androidx.media3.session.MediaSession
import com.google.common.collect.ImmutableList
import com.google.common.util.concurrent.Futures
import com.google.common.util.concurrent.ListenableFuture
import com.google.common.util.concurrent.SettableFuture
import com.tepmex.sttplayerdroid.MainActivity
import com.tepmex.sttplayerdroid.SttPlayerApplication
import com.tepmex.sttplayerdroid.data.LibraryDao
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.runBlocking
import java.util.concurrent.Executors

/**
 * Media playback foreground service.
 *
 * Uses [MediaLibraryService] (not plain [androidx.media3.session.MediaSessionService]) so Android
 * System UI can discover the app via the MediaBrowserService contract after reboot and restore the
 * last session. Bluetooth headset play after process death still goes through
 * [androidx.media3.session.MediaButtonReceiver] + [MediaSession.Callback.onPlaybackResumption].
 */
@OptIn(UnstableApi::class)
class PlaybackService : MediaLibraryService() {
    private lateinit var player: ExoPlayer
    private var session: MediaLibrarySession? = null
    private val mainHandler = Handler(Looper.getMainLooper())
    private var progressTracker: PlaybackProgressTracker? = null

    private val libraryDao: LibraryDao
        get() = (application as SttPlayerApplication).database.library()

    override fun onCreate() {
        super.onCreate()
        // Must not touch Application.container here: MediaController bind can run while
        // AppContainer is still constructing, which would re-enter the lazy initializer.
        // Room is available via Application.database without pulling UI/model dependencies.
        val capture = (application as SttPlayerApplication).captureProcessor
        val renderersFactory = object : DefaultRenderersFactory(this) {
            override fun buildAudioSink(
                context: Context,
                enableFloatOutput: Boolean,
                enableAudioOutputPlaybackParameters: Boolean,
            ): AudioSink = DefaultAudioSink.Builder(context)
                // TeeAudioProcessor always passthroughs; capture never aborts playback.
                .setAudioProcessors(arrayOf(capture.asTeeProcessor()))
                .setEnableFloatOutput(false)
                .setEnableAudioOutputPlaybackParameters(enableAudioOutputPlaybackParameters)
                .build()
        }
        val attributes = AudioAttributes.Builder().setUsage(C.USAGE_MEDIA).setContentType(C.AUDIO_CONTENT_TYPE_MUSIC).build()
        player = ExoPlayer.Builder(applicationContext, renderersFactory)
            .setAudioAttributes(attributes, true)
            .setSeekBackIncrementMs(SEEK_INCREMENT_MS)
            .setSeekForwardIncrementMs(SEEK_INCREMENT_MS)
            .build()
            .apply {
                trackSelectionParameters = trackSelectionParameters.buildUpon().setAudioOffloadPreferences(
                    AudioOffloadPreferences.Builder()
                        .setAudioOffloadMode(AudioOffloadPreferences.AUDIO_OFFLOAD_MODE_DISABLED)
                        .build(),
                ).build()
                addListener(object : Player.Listener {
                    override fun onPositionDiscontinuity(
                        oldPosition: Player.PositionInfo,
                        newPosition: Player.PositionInfo,
                        reason: Int,
                    ) = capture.clear()

                    override fun onMediaItemTransition(mediaItem: MediaItem?, reason: Int) = capture.clear()

                    override fun onPlayerError(error: androidx.media3.common.PlaybackException) {
                        Log.e(
                            TAG,
                            "ExoPlayer error in service code=${error.errorCode} name=${error.errorCodeName} " +
                                "message=${error.message} cause=${error.cause}",
                            error,
                        )
                    }
                })
            }
        mainHandler.post {
            runCatching {
                val tracker = PlaybackProgressTracker(libraryDao)
                tracker.attach(player)
                progressTracker = tracker
            }.onFailure { Log.e(TAG, "Failed to attach PlaybackProgressTracker", it) }
        }
        session = MediaLibrarySession.Builder(this, player, PlaybackSessionCallback { loadResumptionPlaylist() })
            .setSessionActivity(sessionActivityPendingIntent())
            .setMediaButtonPreferences(seekMediaButtonPreferences())
            .build()
        setListener(MediaSessionServiceListener())
        Log.i(TAG, "PlaybackService created player=${player.hashCode()}")
    }

    private fun sessionActivityPendingIntent(): PendingIntent {
        val intent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        return PendingIntent.getActivity(
            this,
            /* requestCode= */ 0,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
    }

    private fun seekMediaButtonPreferences(): ImmutableList<CommandButton> = ImmutableList.of(
        CommandButton.Builder(CommandButton.ICON_SKIP_BACK_10)
            .setPlayerCommand(Player.COMMAND_SEEK_BACK)
            .setSlots(CommandButton.SLOT_BACK)
            .setDisplayName(getString(com.tepmex.sttplayerdroid.R.string.seek_back_10))
            .build(),
        CommandButton.Builder(CommandButton.ICON_SKIP_FORWARD_10)
            .setPlayerCommand(Player.COMMAND_SEEK_FORWARD)
            .setSlots(CommandButton.SLOT_FORWARD)
            .setDisplayName(getString(com.tepmex.sttplayerdroid.R.string.seek_forward_10))
            .build(),
    )

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == ACTION_OPEN) {
            val uri = intent.data
            val displayName = intent.getStringExtra(EXTRA_DISPLAY_NAME).orEmpty().ifBlank { "audio.mp3" }
            val positionMs = intent.getLongExtra(EXTRA_POSITION_MS, 0L).coerceAtLeast(0L)
            if (uri == null) {
                Log.e(TAG, "ACTION_OPEN without data uri")
            } else {
                // Open directly on the player (same process). Avoids MediaController binder quirks
                // that can fail immediately on setMediaItem/prepare for every local file.
                mainHandler.post { openOnPlayer(uri, displayName, positionMs) }
            }
        }
        return super.onStartCommand(intent, flags, startId)
    }

    private fun openOnPlayer(uri: Uri, displayName: String, positionMs: Long) {
        // Do not clobber headset / System UI resumption that already started playback.
        if (shouldSkipOpenForActivePlayback(player.playWhenReady, player.isPlaying, player.currentMediaItem?.mediaId, uri)) {
            Log.i(TAG, "openOnPlayer skipped; already playing uri=$uri")
            return
        }
        Log.i(TAG, "openOnPlayer uri=$uri name=$displayName positionMs=$positionMs")
        val item = MediaItem.Builder()
            .setUri(uri)
            .setMediaId(uri.toString())
            .setRequestMetadata(MediaItem.RequestMetadata.Builder().setMediaUri(uri).build())
            .setMediaMetadata(MediaMetadata.Builder().setTitle(displayName).build())
            .build()
        try {
            player.setMediaItem(item, positionMs)
            player.prepare()
            Log.i(
                TAG,
                "openOnPlayer prepared state=${player.playbackState} error=${player.playerError} " +
                    "localUri=${player.currentMediaItem?.localConfiguration?.uri}",
            )
        } catch (error: Exception) {
            Log.e(TAG, "openOnPlayer failed uri=$uri", error)
        }
    }

    private fun loadResumptionPlaylist(): MediaSession.MediaItemsWithStartPosition? {
        val audio = runCatching {
            // Room must not touch the main thread; this runs on the resumption executor.
            runBlocking(Dispatchers.IO) { libraryDao.mostRecentlyPlayedAudio() }
        }.onFailure { Log.e(TAG, "Failed to load resumable audio", it) }.getOrNull()
            ?: return null
        Log.i(
            TAG,
            "Playback resumption audio=${audio.displayName} positionMs=${audio.positionMs} " +
                "lastPausedAt=${audio.lastPausedAt}",
        )
        val item = restorePlayableMediaItem(PlaybackProgressTracker.mediaItemForResumption(audio))
        return MediaSession.MediaItemsWithStartPosition(
            listOf(item),
            /* startIndex= */ 0,
            audio.positionMs.coerceAtLeast(0L),
        )
    }

    override fun onGetSession(controllerInfo: MediaSession.ControllerInfo): MediaLibrarySession? = session

    override fun onTaskRemoved(rootIntent: Intent?) {
        if (!::player.isInitialized || !player.playWhenReady) stopSelf()
    }

    override fun onDestroy() {
        clearListener()
        progressTracker?.detach()
        progressTracker = null
        session?.release(); session = null
        if (::player.isInitialized) player.release()
        super.onDestroy()
    }

    /**
     * When Android 12+ blocks starting this service into the foreground from the background,
     * Media3 invokes this instead of crashing immediately. Headset BT play after reboot is
     * usually exempt; other resume paths may still hit this.
     */
    private inner class MediaSessionServiceListener : Listener {
        override fun onForegroundServiceStartNotAllowedException() {
            Log.e(TAG, "Foreground service start not allowed during media resume")
        }
    }

    companion object {
        const val ACTION_OPEN = "com.tepmex.sttplayerdroid.playback.OPEN"
        const val EXTRA_DISPLAY_NAME = "display_name"
        const val EXTRA_POSITION_MS = "position_ms"
        /** In-app and system notification / lock-screen seek step. */
        const val SEEK_INCREMENT_MS = 10_000L
        private const val TAG = "SttPlayerPlayback"

        fun openAudioIntent(
            context: Context,
            uri: Uri,
            displayName: String,
            positionMs: Long,
        ): Intent = Intent(context, PlaybackService::class.java).apply {
            action = ACTION_OPEN
            data = uri
            putExtra(EXTRA_DISPLAY_NAME, displayName)
            putExtra(EXTRA_POSITION_MS, positionMs)
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            clipData = android.content.ClipData.newUri(context.contentResolver, displayName, uri)
        }

        fun startOpen(context: Context, uri: Uri, displayName: String, positionMs: Long) {
            val intent = openAudioIntent(context, uri, displayName, positionMs)
            // Service is already started via MediaController bind in normal flow; startService
            // delivers onStartCommand without requiring a foreground promotion by itself.
            runCatching { context.startService(intent) }
                .recoverCatching {
                    Log.w(TAG, "startService failed, trying ContextCompat.startForegroundService", it)
                    ContextCompat.startForegroundService(context, intent)
                }
                .onFailure { Log.e(TAG, "Unable to start PlaybackService for open", it) }
        }
    }
}

/**
 * Rebuild a playable item if a controller somehow omitted localConfiguration.
 * Media3 1.10+ usually includes it via toBundleIncludeLocalConfiguration.
 *
 * Also implements Media3 playback resumption (System UI / Bluetooth cold start), including
 * post-reboot System UI discovery via [MediaLibrarySession].
 */
@OptIn(UnstableApi::class)
internal class PlaybackSessionCallback(
    private val loadResumption: () -> MediaSession.MediaItemsWithStartPosition?,
) : MediaLibrarySession.Callback {
    private val resumptionExecutor = Executors.newSingleThreadExecutor { runnable ->
        Thread(runnable, "stt-playback-resumption").apply { isDaemon = true }
    }

    override fun onAddMediaItems(
        mediaSession: MediaSession,
        controller: MediaSession.ControllerInfo,
        mediaItems: List<MediaItem>,
    ): ListenableFuture<List<MediaItem>> =
        Futures.immediateFuture(mediaItems.map(::restorePlayableMediaItem))

    override fun onSetMediaItems(
        mediaSession: MediaSession,
        controller: MediaSession.ControllerInfo,
        mediaItems: List<MediaItem>,
        startIndex: Int,
        startPositionMs: Long,
    ): ListenableFuture<MediaSession.MediaItemsWithStartPosition> =
        Futures.immediateFuture(
            MediaSession.MediaItemsWithStartPosition(
                mediaItems.map(::restorePlayableMediaItem),
                startIndex,
                startPositionMs,
            ),
        )

    override fun onPlaybackResumption(
        mediaSession: MediaSession,
        controller: MediaSession.ControllerInfo,
        isForPlayback: Boolean,
    ): ListenableFuture<MediaSession.MediaItemsWithStartPosition> {
        Log.i(TAG_RESTORE, "onPlaybackResumption isForPlayback=$isForPlayback package=${controller.packageName}")
        val future = SettableFuture.create<MediaSession.MediaItemsWithStartPosition>()
        resumptionExecutor.execute {
            try {
                val playlist = loadResumption()
                if (playlist == null || playlist.mediaItems.isEmpty()) {
                    future.setException(UnsupportedOperationException("No resumable audio session"))
                } else {
                    future.set(playlist)
                }
            } catch (error: Exception) {
                Log.e(TAG_RESTORE, "onPlaybackResumption failed", error)
                future.setException(error)
            }
        }
        return future
    }
}

internal fun restorePlayableMediaItem(item: MediaItem): MediaItem {
    if (item.localConfiguration?.uri != null) return item
    val uri = resolvePlaybackUri(item) ?: return item
    Log.i(TAG_RESTORE, "Restored MediaItem URI uri=$uri mediaId=${item.mediaId}")
    return item.buildUpon()
        .setUri(uri)
        .setMimeType(item.localConfiguration?.mimeType ?: MimeTypes.AUDIO_MPEG)
        .build()
}

internal fun resolvePlaybackUri(item: MediaItem): Uri? {
    item.localConfiguration?.uri?.let { return it }
    item.requestMetadata.mediaUri?.let { return it }
    val mediaId = item.mediaId
    if (mediaId.isNotBlank() && mediaId != MediaItem.DEFAULT_MEDIA_ID) {
        return Uri.parse(mediaId)
    }
    return null
}

/** True when ACTION_OPEN must not replace an item that headset/System UI resumption already plays. */
internal fun shouldSkipOpenForActivePlayback(
    playWhenReady: Boolean,
    isPlaying: Boolean,
    currentMediaId: String?,
    openUri: Uri,
): Boolean = (playWhenReady || isPlaying) && currentMediaId == openUri.toString()

private const val TAG_RESTORE = "SttPlayerPlayback"
