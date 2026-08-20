package com.tepmex.sttplayerdroid.playback

import android.net.Uri
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.util.Log
import androidx.media3.common.MediaItem
import androidx.media3.common.MediaMetadata
import androidx.media3.common.Player
import androidx.media3.session.MediaConstants
import com.tepmex.sttplayerdroid.data.AudioFileEntity
import com.tepmex.sttplayerdroid.data.LibraryDao
import com.tepmex.sttplayerdroid.data.PlaybackEventEntity
import com.tepmex.sttplayerdroid.data.PlaybackEventKind
import kotlinx.coroutines.CoroutineExceptionHandler
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch

/**
 * Owns Room writes for listening progress: periodic 30s flushes, pause bookmarks, and seek destinations.
 * Attached to the ExoPlayer inside [PlaybackService] so persistence works without the UI process path.
 *
 * Player getters must be read on the application thread; only Room I/O runs on [Dispatchers.IO].
 */
class PlaybackProgressTracker(
    private val libraryDao: LibraryDao,
    private val scope: CoroutineScope = CoroutineScope(
        SupervisorJob() + Dispatchers.IO + CoroutineExceptionHandler { _, error ->
            Log.e(TAG, "PlaybackProgressTracker async failure", error)
        },
    ),
) : Player.Listener {
    private val mainHandler = Handler(Looper.getMainLooper())
    private var player: Player? = null
    private var lastPeriodicPersistAt = 0L
    private var wasPlaying = false

    private val periodicTick = object : Runnable {
        override fun run() {
            val current = player ?: return
            maybePersistPeriodic(current)
            mainHandler.postDelayed(this, 1_000L)
        }
    }

    fun attach(player: Player) {
        this.player = player
        wasPlaying = player.isPlaying
        player.addListener(this)
        mainHandler.removeCallbacks(periodicTick)
        mainHandler.post(periodicTick)
    }

    fun detach() {
        mainHandler.removeCallbacks(periodicTick)
        player?.removeListener(this)
        player?.let { flush(it) }
        player = null
    }

    override fun onIsPlayingChanged(isPlaying: Boolean) {
        val current = player ?: return
        if (wasPlaying && !isPlaying) {
            persistPause(current)
        }
        wasPlaying = isPlaying
        if (isPlaying) {
            maybePersistPeriodic(current)
        }
    }

    override fun onPositionDiscontinuity(
        oldPosition: Player.PositionInfo,
        newPosition: Player.PositionInfo,
        reason: Int,
    ) {
        if (reason != Player.DISCONTINUITY_REASON_SEEK &&
            reason != Player.DISCONTINUITY_REASON_SEEK_ADJUSTMENT
        ) {
            return
        }
        val current = player ?: return
        val uri = currentUri(current) ?: return
        val fromMs = oldPosition.positionMs.coerceAtLeast(0)
        val toMs = newPosition.positionMs.coerceAtLeast(0)
        // Snapshot player fields on the application thread — never touch Player from Dispatchers.IO.
        val durationMs = current.duration.coerceAtLeast(0)
        val now = System.currentTimeMillis()
        val largeSeek = PlaybackPersistencePolicy.isLargeSeek(fromMs, toMs)
        if (largeSeek) {
            Log.i(TAG, "Large seek origin uri=$uri fromMs=$fromMs toMs=$toMs")
        }
        scope.launch {
            if (largeSeek) {
                libraryDao.putPlaybackEvent(
                    PlaybackEventEntity(
                        audioUri = uri,
                        kind = PlaybackEventKind.SEEK_ORIGIN,
                        positionMs = fromMs,
                        createdAt = now,
                    ),
                )
            }
            // Always persist the seek destination so in-app and notification seeks resume correctly.
            libraryDao.savePosition(uri, toMs, durationMs, now)
            lastPeriodicPersistAt = SystemClock.elapsedRealtime()
        }
    }

    fun flush(player: Player) {
        val uri = currentUri(player) ?: return
        val positionMs = player.currentPosition.coerceAtLeast(0)
        val durationMs = player.duration.coerceAtLeast(0)
        val now = System.currentTimeMillis()
        scope.launch {
            libraryDao.savePosition(uri, positionMs, durationMs, now)
        }
        lastPeriodicPersistAt = SystemClock.elapsedRealtime()
    }

    private fun maybePersistPeriodic(player: Player) {
        val uri = currentUri(player) ?: return
        if (!player.isPlaying) return
        val now = SystemClock.elapsedRealtime()
        if (!PlaybackPersistencePolicy.shouldPersistPeriodically(now, lastPeriodicPersistAt, true)) {
            return
        }
        val positionMs = player.currentPosition.coerceAtLeast(0)
        val durationMs = player.duration.coerceAtLeast(0)
        lastPeriodicPersistAt = now
        scope.launch {
            libraryDao.savePosition(uri, positionMs, durationMs, System.currentTimeMillis())
            Log.d(TAG, "Periodic position persist uri=$uri positionMs=$positionMs")
        }
    }

    private fun persistPause(player: Player) {
        val uri = currentUri(player) ?: return
        val positionMs = player.currentPosition.coerceAtLeast(0)
        val durationMs = player.duration.coerceAtLeast(0)
        val pausedAt = System.currentTimeMillis()
        lastPeriodicPersistAt = SystemClock.elapsedRealtime()
        Log.i(TAG, "Pause persist uri=$uri positionMs=$positionMs at=$pausedAt")
        scope.launch {
            libraryDao.savePausedPosition(uri, positionMs, durationMs, pausedAt)
            libraryDao.putPlaybackEvent(
                PlaybackEventEntity(
                    audioUri = uri,
                    kind = PlaybackEventKind.PAUSE,
                    positionMs = positionMs,
                    createdAt = pausedAt,
                ),
            )
        }
    }

    companion object {
        private const val TAG = "SttPlayerPlayback"

        fun currentUri(player: Player?): String? =
            player?.currentMediaItem?.mediaId?.takeIf { it.isNotBlank() }
                ?: player?.currentMediaItem?.localConfiguration?.uri?.toString()

        fun mediaItemForResumption(audio: AudioFileEntity): MediaItem {
            val uri = Uri.parse(audio.uri)
            val completion = if (audio.durationMs > 0) {
                (audio.positionMs.toDouble() / audio.durationMs.toDouble()).coerceIn(0.0, 1.0)
            } else {
                0.0
            }
            val extras = Bundle().apply {
                putInt(
                    MediaConstants.EXTRAS_KEY_COMPLETION_STATUS,
                    if (audio.positionMs <= 0L) {
                        MediaConstants.EXTRAS_VALUE_COMPLETION_STATUS_NOT_PLAYED
                    } else if (audio.durationMs > 0 && audio.positionMs >= audio.durationMs) {
                        MediaConstants.EXTRAS_VALUE_COMPLETION_STATUS_FULLY_PLAYED
                    } else {
                        MediaConstants.EXTRAS_VALUE_COMPLETION_STATUS_PARTIALLY_PLAYED
                    },
                )
                putDouble(MediaConstants.EXTRAS_KEY_COMPLETION_PERCENTAGE, completion)
            }
            return MediaItem.Builder()
                .setUri(uri)
                .setMediaId(audio.uri)
                .setRequestMetadata(MediaItem.RequestMetadata.Builder().setMediaUri(uri).build())
                .setMediaMetadata(
                    MediaMetadata.Builder()
                        .setTitle(audio.displayName)
                        .setExtras(extras)
                        .build(),
                )
                .build()
        }
    }
}
