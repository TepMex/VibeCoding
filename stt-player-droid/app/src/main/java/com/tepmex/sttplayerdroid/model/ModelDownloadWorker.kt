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
import com.tepmex.sttplayerdroid.util.Hashing
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
            if (connection.responseCode !in 200..299) throw IllegalStateException("HTTP ${connection.responseCode}")
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
                return@withContext Result.failure(errorData("Повреждённая загрузка: SHA-256 не совпал"))
            }
            try {
                Files.move(temporary.toPath(), destination.toPath(), StandardCopyOption.ATOMIC_MOVE, StandardCopyOption.REPLACE_EXISTING)
            } catch (_: Exception) {
                Files.move(temporary.toPath(), destination.toPath(), StandardCopyOption.REPLACE_EXISTING)
            }
            Result.success()
        } catch (error: Exception) {
            if (runAttemptCount < MAX_RETRIES) Result.retry()
            else Result.failure(errorData(error.message ?: "Ошибка сети"))
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

    private fun errorData(message: String): Data = workDataOf(KEY_ERROR to message)

    companion object {
        const val KEY_PROGRESS = "progress"
        const val KEY_ERROR = "error"
        private const val CHANNEL_ID = "model-download"
        private const val NOTIFICATION_ID = 41
        private const val MAX_RETRIES = 3
    }
}
