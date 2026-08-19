package com.tepmex.sttplayerdroid.util

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.net.SocketTimeoutException
import java.net.UnknownHostException

class AppExceptionTest {
    @Test
    fun `appError keeps separate user and debug messages`() {
        val error = appError(
            code = ErrorCode.BOOK_CORRUPT,
            userMessage = "Файл повреждён",
            debugMessage = "ZipException at entry 3",
            context = mapOf("bytes" to 12),
        )
        assertEquals(ErrorCode.BOOK_CORRUPT, error.code)
        assertEquals("Файл повреждён", error.userMessage)
        assertEquals("ZipException at entry 3", error.debugMessage)
        assertEquals(12, error.context["bytes"])
        assertEquals("ZipException at entry 3", error.message)
    }

    @Test
    fun `toAppException maps network failures to download messages`() {
        val host = toAppException(UnknownHostException("huggingface.co"))
        assertEquals(ErrorCode.MODEL_DOWNLOAD_NETWORK, host.code)
        assertTrue(host.userMessage.contains("сети", ignoreCase = true) || host.userMessage.contains("подключен", ignoreCase = true))

        val timeout = toAppException(SocketTimeoutException("read timed out"))
        assertEquals(ErrorCode.MODEL_DOWNLOAD_NETWORK, timeout.code)
        assertTrue(timeout.debugMessage.contains("SocketTimeoutException"))
    }

    @Test
    fun `toAppException maps HTTP status text`() {
        val error = toAppException(IllegalStateException("HTTP 503"))
        assertEquals(ErrorCode.MODEL_DOWNLOAD_HTTP, error.code)
        assertTrue(error.userMessage.contains("503") || error.userMessage.contains("Сервер"))
    }

    @Test
    fun `modelDownloadHttpError explains common status codes`() {
        val notFound = modelDownloadHttpError(404)
        assertEquals(ErrorCode.MODEL_DOWNLOAD_HTTP, notFound.code)
        assertTrue(notFound.userMessage.contains("404"))
        assertEquals(404, notFound.context["httpCode"])
    }

    @Test
    fun `getUserMessage prefers AppException user text`() {
        val error = appError(ErrorCode.NO_SPEECH_DETECTED, "Речь не распознана")
        assertEquals("Речь не распознана", getUserMessage(error))
        assertEquals("fallback", getUserMessage(null, "fallback"))
    }

    @Test
    fun `withContext merges debug context`() {
        val error = appError(ErrorCode.SYNC_FAILED, "Сбой", context = mapOf("a" to 1))
            .withContext(mapOf("b" to 2))
        assertEquals(1, error.context["a"])
        assertEquals(2, error.context["b"])
    }

    @Test
    fun `formatThrowableDetails includes cause chain and stack frames`() {
        val root = IllegalStateException("root boom")
        val wrapped = RuntimeException("wrapper", root)
        val text = formatThrowableDetails(wrapped)
        assertTrue(text.contains("RuntimeException: wrapper"))
        assertTrue(text.contains("caused by"))
        assertTrue(text.contains("IllegalStateException: root boom"))
        assertTrue(text.contains(" at "))
    }

    @Test
    fun `formatErrorReport starts with summary and includes details`() {
        val error = appError(
            code = ErrorCode.PLAYBACK_ERROR,
            userMessage = "Ошибка воспроизведения",
            debugMessage = "ExoPlayer failed",
            cause = IllegalArgumentException("bad uri"),
            context = mapOf("errorCode" to 2000),
        )
        val report = formatErrorReport(error.userMessage, error, mapOf("stage" to "play"))
        assertTrue(report.startsWith("Ошибка воспроизведения"))
        assertTrue(report.contains("=== details ==="))
        assertTrue(report.contains("stage=play"))
        assertTrue(report.contains("appCode=PLAYBACK_ERROR"))
        assertTrue(report.contains("IllegalArgumentException"))
    }
}
