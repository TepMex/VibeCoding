package com.tepmex.sttplayerdroid.playback

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
import androidx.media3.session.MediaSession
import androidx.media3.session.MediaSessionService
import com.google.common.util.concurrent.Futures
import com.google.common.util.concurrent.ListenableFuture
import com.tepmex.sttplayerdroid.SttPlayerApplication

@OptIn(UnstableApi::class)
class PlaybackService : MediaSessionService() {
    private lateinit var player: ExoPlayer
    private var session: MediaSession? = null
    private val mainHandler = Handler(Looper.getMainLooper())

    override fun onCreate() {
        super.onCreate()
        // Must not touch Application.container here: MediaController bind can run while
        // AppContainer is still constructing, which would re-enter the lazy initializer.
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
        session = MediaSession.Builder(this, player)
            .setCallback(PlaybackSessionCallback)
            .build()
        Log.i(TAG, "PlaybackService created player=${player.hashCode()}")
    }

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

    override fun onGetSession(controllerInfo: MediaSession.ControllerInfo): MediaSession? = session

    override fun onTaskRemoved(rootIntent: Intent?) {
        if (!::player.isInitialized || !player.playWhenReady) stopSelf()
    }

    override fun onDestroy() {
        session?.release(); session = null
        if (::player.isInitialized) player.release()
        super.onDestroy()
    }

    companion object {
        const val ACTION_OPEN = "com.tepmex.sttplayerdroid.playback.OPEN"
        const val EXTRA_DISPLAY_NAME = "display_name"
        const val EXTRA_POSITION_MS = "position_ms"
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
 */
internal object PlaybackSessionCallback : MediaSession.Callback {
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

private const val TAG_RESTORE = "SttPlayerPlayback"
