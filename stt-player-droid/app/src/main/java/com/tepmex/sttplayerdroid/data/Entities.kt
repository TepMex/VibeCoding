package com.tepmex.sttplayerdroid.data

import androidx.room.Entity
import androidx.room.ForeignKey
import androidx.room.Index
import androidx.room.PrimaryKey
import com.tepmex.sttplayerdroid.SttLanguage

@Entity(tableName = "books", indices = [Index(value = ["lastOpenedAt"])])
data class BookEntity(
    @PrimaryKey val uri: String,
    val title: String,
    val textHash: String,
    val language: SttLanguage = SttLanguage.English,
    val selectedChapterId: String? = null,
    val anchorChunkId: String? = null,
    val lastOpenedAt: Long = System.currentTimeMillis(),
)

@Entity(tableName = "audio_files", indices = [Index(value = ["lastOpenedAt"])])
data class AudioFileEntity(
    @PrimaryKey val uri: String,
    val displayName: String,
    val positionMs: Long = 0,
    val durationMs: Long = 0,
    val lastOpenedAt: Long = System.currentTimeMillis(),
)

@Entity(
    tableName = "chunks",
    foreignKeys = [ForeignKey(
        entity = BookEntity::class,
        parentColumns = ["uri"],
        childColumns = ["bookUri"],
        onDelete = ForeignKey.CASCADE,
    )],
    indices = [Index("bookUri"), Index(value = ["bookUri", "ordinal"], unique = true)],
)
data class ChunkEntity(
    @PrimaryKey val id: String,
    val bookUri: String,
    val chapterId: String,
    val chapterTitle: String,
    val chapterOrdinal: Int,
    val paragraph: Int,
    val ordinal: Int,
    val text: String,
)

@Entity(tableName = "index_metadata")
data class IndexMetadataEntity(
    @PrimaryKey val textHash: String,
    val version: Int,
    val relativePath: String,
    val chunkCount: Int,
    val createdAt: Long,
)

@Entity(tableName = "performance_log", indices = [Index("createdAt")])
data class PerformanceLogEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val createdAt: Long = System.currentTimeMillis(),
    val transcript: String,
    val matched: Boolean,
    val preprocessingMs: Long,
    val modelInitializationMs: Long,
    val encodeMs: Long,
    val decodeMs: Long,
    val searchMs: Long,
    val totalMs: Long,
)

