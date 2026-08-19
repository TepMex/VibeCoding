package com.tepmex.sttplayerdroid.playback

import android.content.Context
import android.net.Uri
import androidx.annotation.OptIn
import androidx.media3.common.AudioAttributes
import androidx.media3.common.C
import androidx.media3.common.MediaItem
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
                .setAudioProcessors(arrayOf(capture))
                .setEnableFloatOutput(false)
                .setEnableAudioOutputPlaybackParameters(enableAudioOutputPlaybackParameters)
                .build()
        }
        val attributes = AudioAttributes.Builder().setUsage(C.USAGE_MEDIA).setContentType(C.AUDIO_CONTENT_TYPE_SPEECH).build()
        player = ExoPlayer.Builder(this, renderersFactory).setAudioAttributes(attributes, true).build().apply {
            trackSelectionParameters = trackSelectionParameters.buildUpon().setAudioOffloadPreferences(
                AudioOffloadPreferences.Builder()
                    .setAudioOffloadMode(AudioOffloadPreferences.AUDIO_OFFLOAD_MODE_DISABLED)
                    .build()
            ).build()
            addListener(object : Player.Listener {
                override fun onPositionDiscontinuity(oldPosition: Player.PositionInfo, newPosition: Player.PositionInfo, reason: Int) = capture.clear()
                override fun onMediaItemTransition(mediaItem: MediaItem?, reason: Int) = capture.clear()
            })
        }
        session = MediaSession.Builder(this, player)
            .setCallback(PlaybackSessionCallback)
            .build()
    }

    override fun onGetSession(controllerInfo: MediaSession.ControllerInfo): MediaSession? = session

    override fun onTaskRemoved(rootIntent: android.content.Intent?) {
        if (!player.playWhenReady) stopSelf()
    }

    override fun onDestroy() {
        session?.release(); session = null
        player.release()
        super.onDestroy()
    }
}

/**
 * MediaController strips [MediaItem.localConfiguration] (the playable URI) when items cross the
 * session binder — even for same-app controllers. Rebuild a playable item from mediaId /
 * requestMetadata before handing it to ExoPlayer.
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
