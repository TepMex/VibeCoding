package com.tepmex.sttplayerdroid

import android.net.Uri

enum class SttLanguage(val code: String, val displayName: String, val whisperTokenId: Int) {
    English("en", "English", 50_259),
    Polish("pl", "Polski", 50_269),
}

data class BookChunk(
    val id: String,
    val chapterId: String,
    val paragraph: Int,
    val ordinal: Int,
    val text: String,
)

data class BookChapter(
    val id: String,
    val title: String,
    val ordinal: Int,
    val chunks: List<BookChunk>,
)

data class BookDocument(
    val sourceUri: Uri,
    val sourceHash: String,
    val title: String,
    val chapters: List<BookChapter>,
) {
    val chunks: List<BookChunk> by lazy { chapters.flatMap(BookChapter::chunks) }
}

data class MatchResult(
    val chunkId: String,
    val chapterId: String,
    val score: Double,
    val matchedText: String,
)

data class PerformanceTiming(
    val preprocessingMs: Long = 0,
    val modelInitializationMs: Long = 0,
    val encodeMs: Long = 0,
    val decodeMs: Long = 0,
    val searchMs: Long = 0,
    val totalMs: Long = 0,
)

data class TranscriptionResult(
    val text: String,
    val tokenIds: List<Int>,
    val timing: PerformanceTiming,
)

