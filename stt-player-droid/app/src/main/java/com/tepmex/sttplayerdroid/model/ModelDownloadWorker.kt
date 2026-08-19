package com.tepmex.sttplayerdroid.model

import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.content.pm.ServiceInfo
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.work.CoroutineWorker
import androidx.work.Data
import androidx.work.ForegroundInfo
import androidx.work.WorkerParameters
import androidx.work.workDataOf
import com.tepmex.sttplayerdroid.R
import com.tepmex.sttplayerdroid.util.AppException
import com.tepmex.sttplayerdroid.util.ErrorCode
import com.tepmex.sttplayerdroid.util.Hashing
import com.tepmex.sttplayerdroid.util.appError
import com.tepmex.sttplayerdroid.util.describeCause
import com.tepmex.sttplayerdroid.util.logError
import com.tepmex.sttplayerdroid.util.modelDownloadHttpError
import com.tepmex.sttplayerdroid.util.modelDownloadNetworkError
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File
import java.net.HttpURLConnection
import java.net.URL
import java.nio.file.Files
import java.nio.file.StandardCopyOption

class ModelDownloadWorker(context: Context, params: WorkerParameters) : CoroutineWorker(context, params) {
    override suspend fun doWork(): Result = withContext(Dispatchers.IO) {
        try {
            setForeground(createForegroundInfo(0))
        } catch (error: Exception) {
            val appError = appError(
                code = ErrorCode.MODEL_DOWNLOAD_FAILED,
                userMessage = "Не удалось запустить фоновую загрузку модели. Разрешите уведомления и повторите.",
                debugMessage = "setForeground failed: ${describeCause(error)}",
                cause = error,
            )
            logError("ModelDownloadWorker", appError)
            return@withContext Result.failure(errorData(appError))
        }
        val destination = DefaultModelManager.modelFile(applicationContext)
        destination.parentFile?.mkdirs()
        val temporary = File(destination.parentFile, destination.name + ".download")
        try {
            if (runAttemptCount == 0) temporary.delete()
            var lastError: AppException? = null
            var downloaded = false
            for (url in DefaultModelManager.MODEL_URLS) {
                val resumeFrom = temporary.takeIf(File::exists)?.length() ?: 0L
                try {
                    downloadTo(temporary, url, resumeFrom)
                    downloaded = true
                    lastError = null
                    break
                } catch (error: Exception) {
                    val appError = when (error) {
                        is AppException -> error
                        else -> modelDownloadNetworkError(error)
                    }
                    logError(
                        "ModelDownloadWorker",
                        appError,
                        mapOf("url" to url, "attempt" to runAttemptCount, "partialBytes" to temporary.length()),
                    )
                    lastError = appError
                    // Keep partial bytes so the next mirror / WorkManager retry can Range-resume.
                }
            }
            if (!downloaded) {
                return@withContext if (runAttemptCount < MAX_RETRIES) Result.retry() else Result.failure(errorData(lastError!!))
            }
            val checksum = temporary.inputStream().use(Hashing::sha256)
            if (checksum != DefaultModelManager.MODEL_SHA256) {
                temporary.delete()
                val error = appError(
                    code = ErrorCode.MODEL_DOWNLOAD_CORRUPT,
                    userMessage = "Загрузка повреждена: контрольная сумма не совпала. Повторите скачивание.",
                    debugMessage = "Downloaded model SHA-256 mismatch: got=$checksum expected=${DefaultModelManager.MODEL_SHA256} bytes=${temporary.length()} attempt=$runAttemptCount",
                    context = mapOf(
                        "got" to checksum,
                        "expected" to DefaultModelManager.MODEL_SHA256,
                        "bytes" to temporary.length(),
                        "attempt" to runAttemptCount,
                    ),
                )
                logError("ModelDownloadWorker", error)
                return@withContext Result.failure(errorData(error))
            }
            try {
                Files.move(temporary.toPath(), destination.toPath(), StandardCopyOption.ATOMIC_MOVE, StandardCopyOption.REPLACE_EXISTING)
            } catch (moveError: Exception) {
                logError(
                    "ModelDownloadWorker",
                    appError(
                        code = ErrorCode.MODEL_DOWNLOAD_FAILED,
                        userMessage = "Не удалось сохранить модель на устройство. Освободите место и повторите.",
                        debugMessage = "Atomic move failed, falling back to replace: ${describeCause(moveError)}",
                        cause = moveError,
                        context = mapOf("destination" to destination.absolutePath),
                    ),
                )
                Files.move(temporary.toPath(), destination.toPath(), StandardCopyOption.REPLACE_EXISTING)
            }
            Result.success()
        } catch (error: Exception) {
            val appError = when (error) {
                is AppException -> error
                else -> modelDownloadNetworkError(error)
            }
            logError(
                "ModelDownloadWorker",
                appError,
                mapOf("attempt" to runAttemptCount, "maxRetries" to MAX_RETRIES),
            )
            if (runAttemptCount < MAX_RETRIES) Result.retry()
            else Result.failure(errorData(appError))
        }
    }

    private suspend fun downloadTo(temporary: File, url: String, resumeFrom: Long) {
        val existing = if (resumeFrom > 0 && temporary.isFile) resumeFrom else 0L
        if (existing == 0L) temporary.delete()
        val connection = openDownloadConnection(url, existing)
        try {
            val append = existing > 0 && connection.responseCode == HttpURLConnection.HTTP_PARTIAL
            if (connection.responseCode !in 200..299) {
                throw modelDownloadHttpError(connection.responseCode)
            }
            val initial = if (append) existing else 0L
            if (!append && temporary.exists()) temporary.delete()
            val total = connection.contentLengthLong.takeIf { it > 0 }?.plus(initial) ?: 0L
            connection.inputStream.use { input ->
                java.io.FileOutputStream(temporary, append).buffered().use { output ->
                    var downloaded = initial
                    val buffer = ByteArray(DEFAULT_BUFFER_SIZE)
                    while (true) {
                        val count = input.read(buffer)
                        if (count < 0) break
                        output.write(buffer, 0, count)
                        downloaded += count
                        report(downloaded, total)
                    }
                }
            }
            if (total > 0 && temporary.length() != total) {
                throw appError(
                    code = ErrorCode.MODEL_DOWNLOAD_CORRUPT,
                    userMessage = "Загрузка оборвалась до конца файла. Повторите скачивание.",
                    debugMessage = "Incomplete download from $url: got=${temporary.length()} expected=$total",
                    context = mapOf("url" to url, "got" to temporary.length(), "expected" to total),
                )
            }
        } finally {
            connection.disconnect()
        }
    }

    private suspend fun report(downloaded: Long, total: Long) {
        val progress = if (total <= 0) 0 else ((downloaded * 100) / total).toInt().coerceIn(0, 100)
        setProgress(workDataOf(KEY_PROGRESS to progress))
        setForeground(createForegroundInfo(progress))
    }

    private fun createForegroundInfo(progress: Int): ForegroundInfo {
        val manager = applicationContext.getSystemService(NotificationManager::class.java)
        manager.createNotificationChannel(
            NotificationChannel(
                CHANNEL_ID,
                applicationContext.getString(R.string.model_channel_name),
                NotificationManager.IMPORTANCE_LOW,
            ).apply {
                description = applicationContext.getString(R.string.model_channel_description)
            },
        )
        val notification = NotificationCompat.Builder(applicationContext, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_launcher_foreground)
            .setContentTitle(applicationContext.getString(R.string.model_downloading))
            .setOnlyAlertOnce(true)
            .setOngoing(true)
            .setProgress(100, progress, progress == 0)
            .build()
        // targetSdk 34+: missing FGS type crashes SystemForegroundService on Android 14+.
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            ForegroundInfo(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC)
        } else {
            ForegroundInfo(NOTIFICATION_ID, notification)
        }
    }

    private fun errorData(error: AppException): Data = workDataOf(
        KEY_ERROR to error.userMessage,
        KEY_ERROR_DEBUG to error.debugMessage,
        KEY_ERROR_CODE to error.code.name,
    )

    companion object {
        const val KEY_PROGRESS = "progress"
        const val KEY_ERROR = "error"
        const val KEY_ERROR_DEBUG = "errorDebug"
        const val KEY_ERROR_CODE = "errorCode"
        private const val CHANNEL_ID = "model-download"
        private const val NOTIFICATION_ID = 41
        private const val MAX_RETRIES = 3
        private const val USER_AGENT = "STTPlayerDroid/1.0 (Android; Whisper Tiny install)"
        private const val MAX_REDIRECTS = 8

        /**
         * Follow redirects manually so Range/User-Agent survive Hugging Face → CDN hops.
         * Exposed for JVM unit tests.
         */
        fun openDownloadConnection(url: String, existingBytes: Long): HttpURLConnection {
            var current = URL(url)
            repeat(MAX_REDIRECTS) {
                val connection = (current.openConnection() as HttpURLConnection).apply {
                    instanceFollowRedirects = false
                    connectTimeout = 20_000
                    readTimeout = 60_000
                    setRequestProperty("User-Agent", USER_AGENT)
                    setRequestProperty("Accept", "*/*")
                    if (existingBytes > 0) setRequestProperty("Range", "bytes=$existingBytes-")
                }
                connection.connect()
                when (val code = connection.responseCode) {
                    HttpURLConnection.HTTP_MOVED_PERM,
                    HttpURLConnection.HTTP_MOVED_TEMP,
                    HttpURLConnection.HTTP_SEE_OTHER,
                    307,
                    308,
                    -> {
                        val location = connection.getHeaderField("Location")
                            ?: throw modelDownloadHttpError(code)
                        connection.disconnect()
                        current = URL(current, location)
                    }
                    else -> return connection
                }
            }
            throw appError(
                code = ErrorCode.MODEL_DOWNLOAD_HTTP,
                userMessage = "Сервер модели слишком часто перенаправляет запрос. Повторите позже.",
                debugMessage = "Exceeded $MAX_REDIRECTS redirects starting from $url",
                context = mapOf("url" to url),
            )
        }
    }
}
