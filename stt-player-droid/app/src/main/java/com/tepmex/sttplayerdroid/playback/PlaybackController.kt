package com.tepmex.sttplayerdroid.playback

import android.content.ComponentName
import android.content.Context
import android.net.Uri
import androidx.media3.common.MediaItem
import androidx.media3.common.MediaMetadata
import androidx.media3.common.Player
import androidx.media3.session.MediaController
import androidx.media3.session.SessionToken
import com.google.common.util.concurrent.MoreExecutors
import com.tepmex.sttplayerdroid.data.AudioFileEntity
import com.tepmex.sttplayerdroid.data.LibraryDao
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

data class PlaybackUiState(
    val connected: Boolean = false,
    val isPlaying: Boolean = false,
    val title: String = "",
    val uri: String? = null,
    val positionMs: Long = 0,
    val durationMs: Long = 0,
)

class PlaybackController(private val context: Context, private val libraryDao: LibraryDao) {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)
    private val mutableState = MutableStateFlow(PlaybackUiState())
    val state: StateFlow<PlaybackUiState> = mutableState.asStateFlow()
    val recentAudio = libraryDao.observeAudio()
    private var controller: MediaController? = null
    private var pendingItem: Pair<MediaItem, Long>? = null
    private var lastPersistAt = 0L

    init {
        val token = SessionToken(context, ComponentName(context, PlaybackService::class.java))
        val future = MediaController.Builder(context, token).buildAsync()
        future.addListener({
            controller = runCatching { future.get() }.getOrNull()
            controller?.addListener(listener)
            pendingItem?.let { (item, position) -> controller?.setMediaItem(item, position); controller?.prepare(); pendingItem = null }
            update()
        }, MoreExecutors.directExecutor())
        scope.launch {
            while (true) {
                delay(500)
                if (controller?.isPlaying == true) update()
            }
        }
    }

    suspend fun open(uri: Uri, displayName: String) {
        runCatching { context.contentResolver.takePersistableUriPermission(uri, android.content.Intent.FLAG_GRANT_READ_URI_PERMISSION) }
        val saved = libraryDao.audio(uri.toString())
        libraryDao.putAudio(AudioFileEntity(uri.toString(), displayName, saved?.positionMs ?: 0, saved?.durationMs ?: 0))
        val item = MediaItem.Builder().setUri(uri).setMediaId(uri.toString())
            .setMediaMetadata(MediaMetadata.Builder().setTitle(displayName).build()).build()
        val position = saved?.positionMs ?: 0
        controller?.apply { setMediaItem(item, position); prepare() } ?: run { pendingItem = item to position }
    }

    fun playPause() { controller?.let { if (it.isPlaying) it.pause() else it.play() } }
    fun pause() { controller?.pause() }
    fun seekBy(deltaMs: Long) { controller?.let { it.seekTo((it.currentPosition + deltaMs).coerceIn(0, it.duration.coerceAtLeast(0))) } }
    fun seekTo(positionMs: Long) { controller?.seekTo(positionMs) }

    private val listener = object : Player.Listener {
        override fun onEvents(player: Player, events: Player.Events) = update()
    }

    private fun update() {
        val player = controller
        mutableState.value = if (player == null) PlaybackUiState() else PlaybackUiState(
            connected = true, isPlaying = player.isPlaying,
            title = player.mediaMetadata.title?.toString().orEmpty(),
            uri = player.currentMediaItem?.mediaId,
            positionMs = player.currentPosition.coerceAtLeast(0),
            durationMs = player.duration.coerceAtLeast(0),
        )
        val current = mutableState.value
        val now = android.os.SystemClock.elapsedRealtime()
        if (current.uri != null && now - lastPersistAt >= 2_000) scope.launch(Dispatchers.IO) {
            lastPersistAt = now
            libraryDao.savePosition(current.uri, current.positionMs, current.durationMs)
        }
    }
}
