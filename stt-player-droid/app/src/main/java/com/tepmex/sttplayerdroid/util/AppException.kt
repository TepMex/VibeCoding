package com.tepmex.sttplayerdroid.util

import android.util.Log
import java.io.IOException
import java.net.HttpURLConnection
import java.net.SocketTimeoutException
import java.net.UnknownHostException

/**
 * Stable machine-readable codes for every failure the app can surface.
 * User sees [AppException.userMessage]; logcat/debug uses [AppException.debugMessage].
 */
enum class ErrorCode {
    BOOK_OPEN_FAILED,
    BOOK_UNSUPPORTED_FORMAT,
    BOOK_CORRUPT,
    BOOK_EMPTY,
    EPUB_MISSING_CONTAINER,
    EPUB_MISSING_OPF,
    EPUB_OPF_UNAVAILABLE,
    EPUB_NO_TEXT,
    FB2_NO_SECTIONS,
    BOOK_RESTORE_FAILED,
    BOOK_INDEX_FAILED,

    MODEL_NOT_INSTALLED,
    MODEL_CHECKSUM_MISMATCH,
    MODEL_DOWNLOAD_HTTP,
    MODEL_DOWNLOAD_CORRUPT,
    MODEL_DOWNLOAD_NETWORK,
    MODEL_DOWNLOAD_FAILED,
    MODEL_INCOMPATIBLE,
    TOKENIZER_INIT_FAILED,
    TRANSCRIBE_FAILED,
    NO_SPEECH_DETECTED,

    SYNC_BUFFER_TOO_SHORT,
    SYNC_NO_MATCH,
    SYNC_FAILED,
    SEARCH_INDEX_MISSING,

    PLAYBACK_OPEN_FAILED,
    PLAYBACK_ERROR,
    AUDIO_FORMAT_UNSUPPORTED,

    UNKNOWN,
}

/**
 * Application error with a clear user-facing message and structured debug info.
 */
open class AppException(
    val code: ErrorCode,
    val userMessage: String,
    val debugMessage: String = userMessage,
    cause: Throwable? = null,
    val context: Map<String, Any?> = emptyMap(),
) : Exception(debugMessage, cause) {

    open fun withContext(extra: Map<String, Any?>): AppException = AppException(
        code = code,
        userMessage = userMessage,
        debugMessage = debugMessage,
        cause = cause,
        context = context + extra,
    )
}

fun appError(
    code: ErrorCode,
    userMessage: String,
    debugMessage: String = userMessage,
    cause: Throwable? = null,
    context: Map<String, Any?> = emptyMap(),
): AppException = AppException(code, userMessage, debugMessage, cause, context)

fun describeCause(cause: Throwable?): String {
    if (cause == null) return ""
    if (cause is AppException) return "${cause.code}: ${cause.debugMessage}"
    val name = cause.javaClass.simpleName
    val message = cause.message?.takeIf { it.isNotBlank() }
    return if (message != null) "$name: $message" else name
}

/** Full cause chain + stack frames for on-device debugging. */
fun formatThrowableDetails(error: Throwable?, maxFramesPerThrowable: Int = 48): String {
    if (error == null) return "(no throwable)"
    return buildString {
        var current: Throwable? = error
        var depth = 0
        val seen = mutableSetOf<Throwable>()
        while (current != null && depth < 12 && seen.add(current)) {
            if (depth > 0) appendLine("--- caused by ---")
            when (current) {
                is AppException -> {
                    appendLine("${current.javaClass.name}")
                    appendLine("code=${current.code}")
                    appendLine("user=${current.userMessage}")
                    appendLine("debug=${current.debugMessage}")
                    if (current.context.isNotEmpty()) appendLine("context=${current.context}")
                }
                else -> {
                    appendLine("${current.javaClass.name}: ${current.message.orEmpty()}")
                }
            }
            current.stackTrace.take(maxFramesPerThrowable).forEach { frame ->
                appendLine("  at $frame")
            }
            if (current.stackTrace.size > maxFramesPerThrowable) {
                appendLine("  ... ${current.stackTrace.size - maxFramesPerThrowable} more")
            }
            current = current.cause
            depth++
        }
    }.trimEnd()
}

/**
 * One block for snackbar/dialog: short user text, then structured debug and stack.
 * Always starts with the user-facing line so UI can show a summary.
 */
fun formatErrorReport(
    summary: String,
    error: Throwable?,
    extras: Map<String, Any?> = emptyMap(),
): String = buildString {
    appendLine(summary)
    appendLine()
    appendLine("=== details ===")
    if (extras.isNotEmpty()) {
        extras.forEach { (key, value) -> appendLine("$key=$value") }
        appendLine()
    }
    if (error is AppException) {
        appendLine("appCode=${error.code}")
        appendLine("debug=${error.debugMessage}")
        if (error.context.isNotEmpty()) {
            error.context.forEach { (key, value) -> appendLine("ctx.$key=$value") }
        }
        appendLine()
        append(formatThrowableDetails(error.cause ?: error))
    } else {
        append(formatThrowableDetails(error))
    }
}.trimEnd()

fun getUserMessage(
    error: Throwable?,
    fallback: String = "Что-то пошло не так. Попробуйте ещё раз.",
): String = when (error) {
    null -> fallback
    is AppException -> error.userMessage
    else -> toAppException(error, ErrorCode.UNKNOWN, fallback).userMessage
}

/**
 * Normalize any thrown value into an [AppException] with user + debug messages.
 */
fun toAppException(
    error: Throwable,
    fallbackCode: ErrorCode = ErrorCode.UNKNOWN,
    fallbackUserMessage: String = "Что-то пошло не так. Попробуйте ещё раз.",
    context: Map<String, Any?> = emptyMap(),
): AppException {
    if (error is AppException) {
        return if (context.isEmpty()) error else error.withContext(context)
    }

    val inferred = inferFromThrowable(error)
    val code = inferred?.first ?: fallbackCode
    val userMessage = inferred?.second ?: fallbackUserMessage
    val causeDescription = describeCause(error)
    val debugMessage = buildString {
        append(userMessage)
        if (causeDescription.isNotBlank()) append(" | cause: ").append(causeDescription)
        error.message?.takeIf { it.isNotBlank() && it != userMessage }?.let {
            append(" | raw: ").append(it)
        }
    }
    return AppException(
        code = code,
        userMessage = userMessage,
        debugMessage = debugMessage,
        cause = error,
        context = context + mapOf(
            "rawMessage" to error.message,
            "exceptionClass" to error.javaClass.name,
        ),
    )
}

/**
 * Log a structured error useful for debugging (code, context, stack, cause).
 * Returns the normalized [AppException] so callers can show [AppException.userMessage].
 */
fun logError(
    scope: String,
    error: Throwable,
    extraContext: Map<String, Any?> = emptyMap(),
    fallbackCode: ErrorCode = ErrorCode.UNKNOWN,
    fallbackUserMessage: String = getUserMessage(error),
): AppException {
    val appError = toAppException(error, fallbackCode, fallbackUserMessage, extraContext)
    val payload = buildString {
        append("code=").append(appError.code)
        append(" user=\"").append(appError.userMessage).append('"')
        append(" debug=\"").append(appError.debugMessage).append('"')
        if (appError.context.isNotEmpty()) {
            append(" context=").append(appError.context)
        }
        val causeText = describeCause(appError.cause)
        if (causeText.isNotBlank()) append(" cause=[").append(causeText).append(']')
    }
    Log.e(TAG, "[$scope] $payload", appError.cause ?: appError)
    return appError
}

private fun inferFromThrowable(error: Throwable): Pair<ErrorCode, String>? {
    when (error) {
        is UnknownHostException -> return ErrorCode.MODEL_DOWNLOAD_NETWORK to
            "Нет сети. Проверьте подключение и повторите загрузку модели."
        is SocketTimeoutException -> return ErrorCode.MODEL_DOWNLOAD_NETWORK to
            "Сеть не ответила вовремя. Повторите загрузку модели."
        is IOException -> {
            val message = error.message.orEmpty().lowercase()
            if (message.contains("cleartext") || message.contains("unable to resolve")) {
                return ErrorCode.MODEL_DOWNLOAD_NETWORK to
                    "Не удалось скачать модель. Проверьте интернет и повторите."
            }
        }
    }

    val message = error.message.orEmpty()
    val lower = message.lowercase()

    when {
        lower.contains("http ") || Regex("""HTTP\s+\d{3}""", RegexOption.IGNORE_CASE).containsMatchIn(message) -> {
            val code = Regex("""\b(\d{3})\b""").find(message)?.groupValues?.get(1)
            return ErrorCode.MODEL_DOWNLOAD_HTTP to
                "Сервер модели ответил ошибкой${code?.let { " HTTP $it" }.orEmpty()}. Повторите позже."
        }
        lower.contains("sha-256") || lower.contains("checksum") || lower.contains("контрольная сумма") ->
            return ErrorCode.MODEL_CHECKSUM_MISMATCH to
                "Файл модели повреждён (не совпала контрольная сумма). Скачайте снова."
        lower.contains("whisper") && (lower.contains("не установлен") || lower.contains("not installed")) ->
            return ErrorCode.MODEL_NOT_INSTALLED to
                "Модель Whisper Tiny ещё не установлена. Откройте экран установки и загрузите её."
        lower.contains("litert") || lower.contains("несовместим") ->
            return ErrorCode.MODEL_INCOMPATIBLE to
                "Эта модель несовместима с runtime на устройстве. Удалите её и скачайте заново."
        lower.contains("tokenizer") ->
            return ErrorCode.TOKENIZER_INIT_FAILED to
                "Не удалось открыть встроенный токенизатор. Переустановите приложение."
        lower.contains("речь не распознана") || lower.contains("no speech") ->
            return ErrorCode.NO_SPEECH_DETECTED to
                "Речь не распознана. Прослушайте фрагмент с речью и нажмите «Найти в тексте» снова."
        lower.contains("unsupported") && lower.contains("format") ->
            return ErrorCode.AUDIO_FORMAT_UNSUPPORTED to
                "Этот формат аудио не поддерживается. Выберите MP3."
        lower.contains("exoplayer") || lower.contains("source error") || lower.contains("playback") ->
            return ErrorCode.PLAYBACK_ERROR to
                "Не удалось воспроизвести файл. Проверьте, что это корректный MP3."
    }
    return null
}

fun modelDownloadHttpError(responseCode: Int): AppException = appError(
    code = ErrorCode.MODEL_DOWNLOAD_HTTP,
    userMessage = when (responseCode) {
        HttpURLConnection.HTTP_NOT_FOUND ->
            "Модель не найдена на сервере (HTTP 404). Повторите позже или обновите приложение."
        HttpURLConnection.HTTP_UNAUTHORIZED, HttpURLConnection.HTTP_FORBIDDEN ->
            "Сервер отклонил загрузку модели (HTTP $responseCode). Повторите позже."
        in 500..599 ->
            "Сервер модели временно недоступен (HTTP $responseCode). Повторите позже."
        else ->
            "Не удалось скачать модель (HTTP $responseCode). Повторите попытку."
    },
    debugMessage = "Model download failed with HTTP $responseCode from Whisper Tiny URL",
    context = mapOf("httpCode" to responseCode),
)

fun modelDownloadNetworkError(cause: Throwable): AppException = toAppException(
    cause,
    fallbackCode = ErrorCode.MODEL_DOWNLOAD_NETWORK,
    fallbackUserMessage = "Ошибка сети при загрузке модели. Проверьте интернет и повторите.",
    context = mapOf("stage" to "model_download"),
)

private const val TAG = "SttPlayer"
