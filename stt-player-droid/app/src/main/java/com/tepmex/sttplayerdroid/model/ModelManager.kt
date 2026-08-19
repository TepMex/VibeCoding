package com.tepmex.sttplayerdroid.model

import android.content.Context
import androidx.lifecycle.Observer
import androidx.work.ExistingWorkPolicy
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkInfo
import androidx.work.WorkManager
import com.tepmex.sttplayerdroid.util.ErrorCode
import com.tepmex.sttplayerdroid.util.Hashing
import com.tepmex.sttplayerdroid.util.appError
import com.tepmex.sttplayerdroid.util.logError
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.io.File

sealed interface ModelState {
    data object Checking : ModelState
    data object Missing : ModelState
    data class Downloading(val progress: Int) : ModelState
    data class Ready(val file: File) : ModelState
    data class Error(val message: String, val retryable: Boolean = true) : ModelState
}

interface ModelManager {
    val state: StateFlow<ModelState>
    fun install()
    fun retry()
    suspend fun openModel(): File
    fun discardIncompatible(message: String)
}

class DefaultModelManager(private val context: Context) : ModelManager {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val workManager = WorkManager.getInstance(context)
    private val mutableState = MutableStateFlow<ModelState>(ModelState.Checking)
    override val state: StateFlow<ModelState> = mutableState.asStateFlow()
    private val workerObserver = Observer<List<WorkInfo>> { infos ->
        val info = infos.firstOrNull() ?: return@Observer
        mutableState.value = when (info.state) {
            WorkInfo.State.ENQUEUED, WorkInfo.State.BLOCKED -> ModelState.Downloading(0)
            WorkInfo.State.RUNNING -> ModelState.Downloading(info.progress.getInt(ModelDownloadWorker.KEY_PROGRESS, 0))
            WorkInfo.State.SUCCEEDED -> {
                scope.launch { mutableState.value = validateInstalled() }
                ModelState.Downloading(100)
            }
            WorkInfo.State.FAILED -> {
                val raw = info.outputData.getString(ModelDownloadWorker.KEY_ERROR)
                val debug = info.outputData.getString(ModelDownloadWorker.KEY_ERROR_DEBUG)
                val appError = if (raw != null) {
                    appError(
                        code = ErrorCode.MODEL_DOWNLOAD_FAILED,
                        userMessage = raw,
                        debugMessage = debug ?: raw,
                        context = mapOf(
                            "workState" to info.state.name,
                            "runAttemptCount" to info.runAttemptCount,
                        ),
                    )
                } else {
                    appError(
                        code = ErrorCode.MODEL_DOWNLOAD_FAILED,
                        userMessage = "Не удалось загрузить модель Whisper Tiny. Повторите попытку.",
                        debugMessage = "ModelDownloadWorker failed without error payload; attempt=${info.runAttemptCount}",
                        context = mapOf("runAttemptCount" to info.runAttemptCount),
                    )
                }
                logError("ModelManager", appError)
                ModelState.Error(appError.userMessage)
            }
            WorkInfo.State.CANCELLED -> ModelState.Missing
        }
    }

    init {
        scope.launch { mutableState.value = validateInstalled() }
        workManager.getWorkInfosForUniqueWorkLiveData(WORK_NAME).observeForever(workerObserver)
    }

    override fun install() {
        val request = OneTimeWorkRequestBuilder<ModelDownloadWorker>().build()
        workManager.enqueueUniqueWork(WORK_NAME, ExistingWorkPolicy.KEEP, request)
    }

    override fun retry() {
        val request = OneTimeWorkRequestBuilder<ModelDownloadWorker>().build()
        workManager.enqueueUniqueWork(WORK_NAME, ExistingWorkPolicy.REPLACE, request)
    }

    override suspend fun openModel(): File {
        val validated = validateInstalled()
        mutableState.value = validated
        return (validated as? ModelState.Ready)?.file
            ?: throw logError(
                "ModelManager",
                appError(
                    code = ErrorCode.MODEL_NOT_INSTALLED,
                    userMessage = "Модель Whisper Tiny ещё не установлена. Загрузите её на экране установки.",
                    debugMessage = "openModel() called while state=${validated::class.simpleName}",
                    context = mapOf("state" to validated::class.simpleName),
                ),
            )
    }

    override fun discardIncompatible(message: String) {
        modelFile(context).delete()
        val appError = appError(
            code = ErrorCode.MODEL_INCOMPATIBLE,
            userMessage = "Модель несовместима с этим устройством. Скачайте её заново.",
            debugMessage = message,
            context = mapOf("modelFile" to modelFile(context).absolutePath),
        )
        logError("ModelManager", appError)
        mutableState.value = ModelState.Error(appError.userMessage)
    }

    private fun validateInstalled(): ModelState {
        val file = modelFile(context)
        if (!file.isFile) return ModelState.Missing
        val checksum = runCatching { file.inputStream().use(Hashing::sha256) }.getOrNull()
        if (checksum != MODEL_SHA256) {
            file.delete()
            val appError = appError(
                code = ErrorCode.MODEL_CHECKSUM_MISMATCH,
                userMessage = "Файл модели повреждён (не совпала контрольная сумма). Скачайте снова.",
                debugMessage = "Installed model SHA-256 mismatch: got=$checksum expected=$MODEL_SHA256 path=${file.absolutePath} size=${file.length()}",
                context = mapOf(
                    "got" to checksum,
                    "expected" to MODEL_SHA256,
                    "path" to file.absolutePath,
                    "size" to file.length(),
                ),
            )
            logError("ModelManager", appError)
            return ModelState.Error(appError.userMessage)
        }
        return ModelState.Ready(file)
    }

    companion object {
        const val WORK_NAME = "install-whisper-tiny"
        const val MODEL_SHA256 = "6748ac565a228c4a00b18d11ea1e2fd7cead3db6fba94e3f0bf35756b13ba4a9"
        /** Upstream Hugging Face resolve URL (redirects to CDN). */
        const val MODEL_URL = "https://huggingface.co/litert-community/whisper-tiny/resolve/main/whisper_tiny_30s_i8.tflite"
        /**
         * Same file mirrored on GitHub Pages next to the APK — preferred for regions where
         * huggingface.co / CDN is unreachable or rate-limited.
         */
        const val MODEL_MIRROR_URL = "https://tepmex.github.io/VibeCoding/stt-player-droid/whisper_tiny_30s_i8.tflite"
        val MODEL_URLS: List<String> = listOf(MODEL_MIRROR_URL, MODEL_URL)
        const val MODEL_FILE = "whisper_tiny_30s_i8.tflite"

        fun modelFile(context: Context) = File(File(context.noBackupFilesDir, "models"), MODEL_FILE)
    }
}
