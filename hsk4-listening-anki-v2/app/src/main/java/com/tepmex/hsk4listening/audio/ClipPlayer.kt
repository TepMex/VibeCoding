package com.tepmex.hsk4listening.audio

import android.content.Context
import android.net.Uri
import androidx.media3.common.MediaItem
import androidx.media3.common.Player
import androidx.media3.exoplayer.ExoPlayer

class ClipPlayer(context: Context) {
    private val player = ExoPlayer.Builder(context).build().apply {
        playWhenReady = true
    }

    val isPlaying: Boolean get() = player.isPlaying

    fun play(assetPath: String, replay: Boolean = false) {
        val uri = Uri.parse("asset:///$assetPath")
        val current = player.currentMediaItem?.localConfiguration?.uri
        if (!replay && current == uri && (player.isPlaying || player.playbackState == Player.STATE_BUFFERING)) {
            return
        }
        if (!replay && current == uri && player.playbackState == Player.STATE_READY) {
            player.seekTo(0)
            player.play()
            return
        }
        player.setMediaItem(MediaItem.fromUri(uri))
        player.prepare()
        player.play()
    }

    fun togglePlayPause() {
        if (player.isPlaying) player.pause() else player.play()
    }

    fun replay() {
        player.seekTo(0)
        player.play()
    }

    fun pause() {
        player.pause()
    }

    fun release() {
        player.release()
    }
}
