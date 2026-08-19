package com.tepmex.sttplayerdroid.playback

import android.content.ComponentName
import android.content.Context
import android.net.Uri
import androidx.media3.common.MediaItem
import androidx.media3.common.MediaMetadata
import androidx.media3.common.MimeTypes
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import androidx.media3.session.MediaController
import androidx.media3.session.SessionToken
import com.google.common.util.concurrent.MoreExecutors
import com.tepmex.sttplayerdroid.data.AudioFileEntity
import com.tepmex.sttplayerdroid.data.LibraryDao
import com.tepmex.sttplayerdroid.util.ErrorCode
import com.tepmex.sttplayerdroid.util.appError
import com.tepmex.sttplayerdroid.util.describeCause
import com.tepmex.sttplayerdroid.util.formatErrorReport
import com.tepmex.sttplayerdroid.util.logError
import android.util.Log
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asSharedFlow
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
    private val mutableErrors = MutableSharedFlow<String>(extraBufferCapacity = 1)
    val errors: SharedFlow<String> = mutableErrors.asSharedFlow()
    val recentAudio = libraryDao.observeAudio()
    private var controller: MediaController? = null
    private var pendingItem: Pair<MediaItem, Long>? = null
    private var lastPersistAt = 0L

    init {
        val token = SessionToken(context, ComponentName(context, PlaybackService::class.java))
        val future = MediaController.Builder(context, token).buildAsync()
        future.addListener({
            controller = runCatching { future.get() }
                .onFailure { error ->
                    val appError = logError(
                        "PlaybackController",
                        appError(
                            code = ErrorCode.PLAYBACK_ERROR,
                            userMessage = "Не удалось подключить аудиоплеер. Перезапустите приложение.",
                            debugMessage = "MediaController build failed: ${describeCause(error)}",
                            cause = error,
                        ),
                    )
                    scope.launch {
                        mutableErrors.emit(
                            formatErrorReport(appError.userMessage, appError, mapOf("stage" to "media_controller_connect")),
                        )
                    }
                }
                .getOrNull()
            controller?.addListener(listener)
            pendingItem?.let { (item, position) ->
                Log.i(TAG, "Applying pending MediaItem mediaId=${item.mediaId} localUri=${item.localConfiguration?.uri} requestUri=${item.requestMetadata.mediaUri}")
                controller?.setMediaItem(item, position)
                controller?.prepare()
                pendingItem = null
            }
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
        runCatching {
            context.contentResolver.takePersistableUriPermission(uri, android.content.Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }.onFailure { error ->
            logError(
                "PlaybackController",
                appError(
                    code = ErrorCode.PLAYBACK_OPEN_FAILED,
                    userMessage = "Нет постоянного доступа к файлу. Выберите MP3 снова через кнопку «Открыть».",
                    debugMessage = "takePersistableUriPermission failed for uri=$uri: ${describeCause(error)}",
                    cause = error,
                    context = mapOf("uri" to uri.toString(), "displayName" to displayName),
                ),
            )
        }
        val saved = libraryDao.audio(uri.toString())
        libraryDao.putAudio(AudioFileEntity(uri.toString(), displayName, saved?.positionMs ?: 0, saved?.durationMs ?: 0))
        // mediaId + requestMetadata.mediaUri survive the MediaController → MediaSession binder;
        // localConfiguration.uri is stripped and restored in PlaybackSessionCallback.
        val item = MediaItem.Builder()
            .setUri(uri)
            .setMediaId(uri.toString())
            .setMimeType(MimeTypes.AUDIO_MPEG)
            .setRequestMetadata(
                MediaItem.RequestMetadata.Builder().setMediaUri(uri).build(),
            )
            .setMediaMetadata(MediaMetadata.Builder().setTitle(displayName).build())
            .build()
        val position = saved?.positionMs ?: 0
        val active = controller
        if (active == null) {
            pendingItem = item to position
            return
        }
        Log.i(
            TAG,
            "open() uri=$uri name=$displayName positionMs=$position mediaId=${item.mediaId} " +
                "localUri=${item.localConfiguration?.uri} requestUri=${item.requestMetadata.mediaUri} " +
                "controllerConnected=true",
        )
        try {
            active.setMediaItem(item, position)
            active.prepare()
            Log.i(
                TAG,
                "after prepare playerError=${active.playerError} mediaItemId=${active.currentMediaItem?.mediaId} " +
                    "playbackState=${active.playbackState}",
            )
        } catch (error: Exception) {
            throw logError(
                "PlaybackController",
                appError(
                    code = ErrorCode.PLAYBACK_OPEN_FAILED,
                    userMessage = "Не удалось открыть аудиофайл. Выберите корректный MP3.",
                    debugMessage = "setMediaItem/prepare failed for uri=$uri name=$displayName: ${describeCause(error)}",
                    cause = error,
                    context = mapOf("uri" to uri.toString(), "displayName" to displayName, "positionMs" to position),
                ),
            )
        }
    }

    fun playPause() { controller?.let { if (it.isPlaying) it.pause() else it.play() } }
    fun pause() { controller?.pause() }
    fun seekBy(deltaMs: Long) { controller?.let { it.seekTo((it.currentPosition + deltaMs).coerceIn(0, it.duration.coerceAtLeast(0))) } }
    fun seekTo(positionMs: Long) { controller?.seekTo(positionMs) }

    private val listener = object : Player.Listener {
        override fun onEvents(player: Player, events: Player.Events) = update()
        override fun onPlayerError(error: PlaybackException) {
            val player = controller
            val mediaItem = player?.currentMediaItem
            val extras = linkedMapOf<String, Any?>(
                "errorCode" to error.errorCode,
                "errorCodeName" to error.errorCodeName,
                "errorMessage" to error.message,
                "timestampMs" to error.timestampMs,
                "uiUri" to mutableState.value.uri,
                "uiTitle" to mutableState.value.title,
                "mediaId" to mediaItem?.mediaId,
                "localUri" to mediaItem?.localConfiguration?.uri?.toString(),
                "requestUri" to mediaItem?.requestMetadata?.mediaUri?.toString(),
                "mimeType" to mediaItem?.localConfiguration?.mimeType,
                "playbackState" to player?.playbackState,
                "playWhenReady" to player?.playWhenReady,
                "currentPositionMs" to player?.currentPosition,
                "durationMs" to player?.duration,
            )
            val appError = logError(
                "PlaybackController",
                appError(
                    code = mapPlaybackError(error),
                    userMessage = userMessageForPlayback(error),
                    debugMessage = "ExoPlayer error code=${error.errorCode} name=${error.errorCodeName} message=${error.message} cause=${describeCause(error.cause)}",
                    cause = error,
                    context = extras,
                ),
            )
            val report = formatErrorReport(appError.userMessage, appError, extras)
            Log.e(TAG, report)
            scope.launch { mutableErrors.emit(report) }
        }
    }

    private fun mapPlaybackError(error: PlaybackException): ErrorCode = when (error.errorCode) {
        PlaybackException.ERROR_CODE_IO_FILE_NOT_FOUND,
        PlaybackException.ERROR_CODE_IO_NO_PERMISSION,
        PlaybackException.ERROR_CODE_IO_UNSPECIFIED,
        PlaybackException.ERROR_CODE_IO_READ_POSITION_OUT_OF_RANGE,
        PlaybackException.ERROR_CODE_IO_NETWORK_CONNECTION_FAILED,
        PlaybackException.ERROR_CODE_IO_NETWORK_CONNECTION_TIMEOUT,
        -> ErrorCode.PLAYBACK_OPEN_FAILED
        PlaybackException.ERROR_CODE_PARSING_CONTAINER_MALFORMED,
        PlaybackException.ERROR_CODE_PARSING_CONTAINER_UNSUPPORTED,
        PlaybackException.ERROR_CODE_PARSING_MANIFEST_MALFORMED,
        PlaybackException.ERROR_CODE_PARSING_MANIFEST_UNSUPPORTED,
        PlaybackException.ERROR_CODE_DECODER_INIT_FAILED,
        PlaybackException.ERROR_CODE_DECODER_QUERY_FAILED,
        PlaybackException.ERROR_CODE_DECODING_FAILED,
        PlaybackException.ERROR_CODE_DECODING_FORMAT_EXCEEDS_CAPABILITIES,
        PlaybackException.ERROR_CODE_DECODING_FORMAT_UNSUPPORTED,
        -> ErrorCode.AUDIO_FORMAT_UNSUPPORTED
        else -> ErrorCode.PLAYBACK_ERROR
    }

    private fun userMessageForPlayback(error: PlaybackException): String = when (mapPlaybackError(error)) {
        ErrorCode.PLAYBACK_OPEN_FAILED ->
            "Аудиофайл недоступен. Выберите MP3 снова через кнопку «Открыть»."
        ErrorCode.AUDIO_FORMAT_UNSUPPORTED ->
            "Этот аудиофайл не удалось декодировать. Выберите корректный MP3."
        else ->
            "Ошибка воспроизведения. Попробуйте другой файл или перезапустите приложение."
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

    private companion object {
        const val TAG = "SttPlayerPlayback"
    }
}
