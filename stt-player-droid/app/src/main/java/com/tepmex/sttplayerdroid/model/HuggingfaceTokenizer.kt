package com.tepmex.sttplayerdroid.model

import android.content.Context
import com.tepmex.sttplayerdroid.util.ErrorCode
import com.tepmex.sttplayerdroid.util.appError
import com.tepmex.sttplayerdroid.util.describeCause
import com.tepmex.sttplayerdroid.util.logError
import java.io.Closeable

/** JNI adapter around the Apache-2.0 Hugging Face tokenizers C ABI used by LiteRT ASR. */
class HuggingfaceTokenizer(context: Context) : Closeable {
    private val handle: Long = try {
        context.assets.open("tokenizer.json").bufferedReader().use { nativeInit(it.readText()) }
            .also { check(it != 0L) { "nativeInit returned 0 for tokenizer.json" } }
    } catch (error: Exception) {
        throw logError(
            "HuggingfaceTokenizer",
            appError(
                code = ErrorCode.TOKENIZER_INIT_FAILED,
                userMessage = "Не удалось открыть встроенный токенизатор. Переустановите приложение.",
                debugMessage = "Tokenizer init failed: ${describeCause(error)}",
                cause = error,
            ),
        )
    }

    fun decode(ids: IntArray): String = nativeDecode(handle, ids, true).trim()
    override fun close() = nativeFree(handle)

    private companion object {
        init { System.loadLibrary("tokenizer_jni") }
        @JvmStatic external fun nativeInit(jsonPayload: String): Long
        @JvmStatic external fun nativeFree(handle: Long)
        @JvmStatic external fun nativeDecode(handle: Long, ids: IntArray, skipSpecialTokens: Boolean): String
    }
}
