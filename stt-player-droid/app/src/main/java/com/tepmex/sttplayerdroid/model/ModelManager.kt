package com.tepmex.sttplayerdroid.model

import android.content.Context
import androidx.lifecycle.Observer
import androidx.work.ExistingWorkPolicy
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkInfo
import androidx.work.WorkManager
import com.tepmex.sttplayerdroid.util.Hashing
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
            WorkInfo.State.FAILED -> ModelState.Error(info.outputData.getString(ModelDownloadWorker.KEY_ERROR) ?: "Не удалось загрузить модель")
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
            ?: throw IllegalStateException("Модель Whisper Tiny не установлена")
    }

    override fun discardIncompatible(message: String) {
        modelFile(context).delete()
        mutableState.value = ModelState.Error(message)
    }

    private fun validateInstalled(): ModelState {
        val file = modelFile(context)
        if (!file.isFile) return ModelState.Missing
        val checksum = runCatching { file.inputStream().use(Hashing::sha256) }.getOrNull()
        if (checksum != MODEL_SHA256) {
            file.delete()
            return ModelState.Error("Контрольная сумма модели не совпала")
        }
        return ModelState.Ready(file)
    }

    companion object {
        const val WORK_NAME = "install-whisper-tiny"
        const val MODEL_SHA256 = "6748ac565a228c4a00b18d11ea1e2fd7cead3db6fba94e3f0bf35756b13ba4a9"
        const val MODEL_URL = "https://huggingface.co/litert-community/whisper-tiny/resolve/main/whisper_tiny_30s_i8.tflite"
        const val MODEL_FILE = "whisper_tiny_30s_i8.tflite"

        fun modelFile(context: Context) = File(File(context.noBackupFilesDir, "models"), MODEL_FILE)
    }
}
