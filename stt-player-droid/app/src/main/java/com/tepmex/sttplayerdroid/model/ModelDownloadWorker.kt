package com.tepmex.sttplayerdroid.model

import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
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
        setForeground(createForegroundInfo(0))
        val destination = DefaultModelManager.modelFile(applicationContext)
        destination.parentFile?.mkdirs()
        val temporary = File(destination.parentFile, destination.name + ".download")
        try {
            if (runAttemptCount == 0) temporary.delete()
            val existing = temporary.takeIf(File::exists)?.length() ?: 0L
            val connection = (URL(DefaultModelManager.MODEL_URL).openConnection() as HttpURLConnection).apply {
                connectTimeout = 20_000
                readTimeout = 45_000
                instanceFollowRedirects = true
                if (existing > 0) setRequestProperty("Range", "bytes=$existing-")
            }
            connection.connect()
            val append = existing > 0 && connection.responseCode == HttpURLConnection.HTTP_PARTIAL
            if (connection.responseCode !in 200..299) {
                throw modelDownloadHttpError(connection.responseCode)
            }
            val initial = if (append) existing else 0L
            val total = connection.contentLengthLong.takeIf { it > 0 }?.plus(initial) ?: 0L
            connection.inputStream.use { input ->
                java.io.FileOutputStream(temporary, append).buffered().use { output ->
                    var downloaded = initial
                    val buffer = ByteArray(DEFAULT_BUFFER_SIZE)
                    while (true) {
                        val count = input.read(buffer)
                        if (count < 0) break
                        output.write(buffer, 0, count); downloaded += count
                        report(downloaded, total)
                    }
                }
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

    private suspend fun report(downloaded: Long, total: Long) {
        val progress = if (total <= 0) 0 else ((downloaded * 100) / total).toInt().coerceIn(0, 100)
        setProgress(workDataOf(KEY_PROGRESS to progress))
        setForeground(createForegroundInfo(progress))
    }

    private fun createForegroundInfo(progress: Int): ForegroundInfo {
        val manager = applicationContext.getSystemService(NotificationManager::class.java)
        manager.createNotificationChannel(NotificationChannel(CHANNEL_ID, applicationContext.getString(R.string.model_channel_name), NotificationManager.IMPORTANCE_LOW).apply {
            description = applicationContext.getString(R.string.model_channel_description)
        })
        val notification = NotificationCompat.Builder(applicationContext, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_launcher_foreground)
            .setContentTitle(applicationContext.getString(R.string.model_downloading))
            .setOnlyAlertOnce(true).setOngoing(true).setProgress(100, progress, progress == 0).build()
        return ForegroundInfo(NOTIFICATION_ID, notification)
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
    }
}
