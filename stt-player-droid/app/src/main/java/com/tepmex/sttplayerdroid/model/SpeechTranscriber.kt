package com.tepmex.sttplayerdroid.model

import android.content.Context
import android.os.SystemClock
import com.google.ai.edge.litert.Accelerator
import com.google.ai.edge.litert.CompiledModel
import com.google.ai.edge.litert.Environment
import com.google.ai.edge.litert.TensorBuffer
import com.google.ai.edge.litert.TensorType
import com.tepmex.sttplayerdroid.PerformanceTiming
import com.tepmex.sttplayerdroid.SttLanguage
import com.tepmex.sttplayerdroid.TranscriptionResult
import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.asCoroutineDispatcher
import kotlinx.coroutines.withContext
import java.io.Closeable
import java.util.concurrent.Executors

interface SpeechTranscriber {
    suspend fun transcribe(pcm: FloatArray, language: SttLanguage): TranscriptionResult
}

private val TensorType.numberOfElements: Int get() = layout!!.dimensions.fold(1, Int::times)

class WhisperSpeechTranscriber(
    private val context: Context,
    private val modelManager: ModelManager,
) : SpeechTranscriber, Closeable {
    private val dispatcher: CoroutineDispatcher = Executors.newSingleThreadExecutor { runnable ->
        Thread(runnable, "whisper-inference").apply { priority = Thread.NORM_PRIORITY - 1 }
    }.asCoroutineDispatcher()
    private val preprocessor = LogMelPreprocessor()
    private var runner: WhisperRunner? = null
    private var tokenizer: HuggingfaceTokenizer? = null

    override suspend fun transcribe(pcm: FloatArray, language: SttLanguage): TranscriptionResult = withContext(dispatcher) {
        val totalStart = SystemClock.elapsedRealtime()
        val preprocessStart = SystemClock.elapsedRealtime()
        val padded = FloatArray(LogMelPreprocessor.INPUT_SAMPLES)
        val source = if (pcm.size > padded.size) pcm.copyOfRange(pcm.size - padded.size, pcm.size) else pcm
        source.copyInto(padded)
        val features = preprocessor.process(padded)
        val preprocessingMs = SystemClock.elapsedRealtime() - preprocessStart

        var initializationMs = 0L
        val activeRunner = runner ?: try {
            val start = SystemClock.elapsedRealtime()
            val created = WhisperRunner(context, modelManager.openModel())
            tokenizer = HuggingfaceTokenizer(context)
            runner = created
            initializationMs = SystemClock.elapsedRealtime() - start
            created.warmUp(features, language)
            created
        } catch (error: Exception) {
            modelManager.discardIncompatible("Модель несовместима с этим LiteRT runtime: ${error.message}")
            throw error
        }
        val decoded = activeRunner.run(features, language)
        val text = tokenizer!!.decode(decoded.ids.toIntArray())
        TranscriptionResult(text, decoded.ids, PerformanceTiming(
            preprocessingMs = preprocessingMs,
            modelInitializationMs = initializationMs,
            encodeMs = decoded.encodeMs,
            decodeMs = decoded.decodeMs,
            totalMs = SystemClock.elapsedRealtime() - totalStart,
        ))
    }

    fun releaseForCriticalMemory() = close()

    override fun close() {
        runner?.close(); runner = null
        tokenizer?.close(); tokenizer = null
    }
}

private class WhisperRunner(context: Context, modelFile: java.io.File) : Closeable {
    data class Decoded(val ids: List<Int>, val encodeMs: Long, val decodeMs: Long)

    private val compiledModel = CompiledModel.create(
        modelFile.absolutePath,
        CompiledModel.Options(setOf(Accelerator.CPU)),
        Environment.create(),
    )
    private val encodeInputs = compiledModel.createInputBuffers(ENCODE)
    private val encodeOutputs = compiledModel.createOutputBuffers(ENCODE)
    private val decodeOwnedInputs = compiledModel.createInputBuffers(DECODE)
    private val tokenBuffer = decodeOwnedInputs[decodeOwnedInputs.size - 2]
    private val maskBuffer = decodeOwnedInputs.last()
    private val decodeOutputs = compiledModel.createOutputBuffers(DECODE)
    private val tokenCapacity = compiledModel.getInputTensorType(inputName(decodeOwnedInputs.size - 2), DECODE).numberOfElements
    private val logitsPerToken = compiledModel.getOutputTensorType(outputName(0), DECODE).numberOfElements / tokenCapacity
    private val causalMask = createCausalMask(compiledModel.getInputTensorType(inputName(decodeOwnedInputs.size - 1), DECODE).numberOfElements)

    fun warmUp(features: FloatArray, language: SttLanguage) { run(features, language, maxTokens = 1) }

    fun run(features: FloatArray, language: SttLanguage, maxTokens: Int = MAX_TOKENS): Decoded {
        val expected = compiledModel.getInputTensorType(inputName(0), ENCODE).numberOfElements
        encodeInputs[0].writeFloat(if (features.size == expected) features else features.copyOf(expected))
        val encodeStart = SystemClock.elapsedRealtime()
        compiledModel.run(encodeInputs, encodeOutputs, ENCODE)
        val encodeMs = SystemClock.elapsedRealtime() - encodeStart

        val decodeInputs = buildList<TensorBuffer> {
            addAll(encodeOutputs); add(tokenBuffer); add(maskBuffer)
        }
        maskBuffer.writeFloat(causalMask)
        val prompt = WhisperPrompt.tokens(language)
        val allTokens = IntArray(tokenCapacity)
        prompt.copyInto(allTokens)
        val result = mutableListOf<Int>()
        val decodeStart = SystemClock.elapsedRealtime()
        for (position in prompt.size - 1 until minOf(tokenCapacity - 1, prompt.size - 1 + maxTokens)) {
            tokenBuffer.writeInt(allTokens)
            compiledModel.run(decodeInputs, decodeOutputs, DECODE)
            val logits = decodeOutputs[0].readFloat()
            val start = position * logitsPerToken
            val next = (start until start + logitsPerToken).maxByOrNull { logits[it] }!! - start
            if (next == EOT) break
            result += next
            allTokens[position + 1] = next
        }
        return Decoded(result, encodeMs, SystemClock.elapsedRealtime() - decodeStart)
    }

    override fun close() = compiledModel.close()

    companion object {
        const val SOT = 50_258
        const val EOT = 50_257
        const val TRANSCRIBE = 50_359
        const val NO_TIMESTAMPS = 50_363
        const val MAX_TOKENS = 96
        private const val ENCODE = "encode"
        private const val DECODE = "decode"
        private fun inputName(index: Int) = "args_$index"
        private fun outputName(index: Int) = "output_$index"
        private fun createCausalMask(size: Int): FloatArray {
            val n = kotlin.math.sqrt(size.toDouble()).toInt()
            return FloatArray(size) { index -> if (index % n <= index / n) 0f else -0.7f * Float.MAX_VALUE }
        }
    }
}

object WhisperPrompt {
    fun tokens(language: SttLanguage): IntArray = intArrayOf(
        WhisperRunner.SOT,
        language.whisperTokenId,
        WhisperRunner.TRANSCRIBE,
        WhisperRunner.NO_TIMESTAMPS,
    )
}
