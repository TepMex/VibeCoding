package com.tepmex.sttplayerdroid.data

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.Transaction
import kotlinx.coroutines.flow.Flow

@Dao
interface LibraryDao {
    @Query("SELECT * FROM books ORDER BY lastOpenedAt DESC")
    fun observeBooks(): Flow<List<BookEntity>>

    @Query("SELECT * FROM audio_files ORDER BY lastOpenedAt DESC")
    fun observeAudio(): Flow<List<AudioFileEntity>>

    @Query("SELECT * FROM chunks WHERE bookUri = :uri ORDER BY ordinal")
    suspend fun chunks(uri: String): List<ChunkEntity>

    @Query("SELECT * FROM books WHERE uri = :uri")
    suspend fun book(uri: String): BookEntity?

    @Query("SELECT * FROM audio_files WHERE uri = :uri")
    suspend fun audio(uri: String): AudioFileEntity?

    /** Most recently played/progress-updated audio for Media3 playback resumption. */
    @Query("SELECT * FROM audio_files ORDER BY lastPlayedAt DESC LIMIT 1")
    suspend fun mostRecentlyPlayedAudio(): AudioFileEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun putBook(book: BookEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun putAudio(audio: AudioFileEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun putChunks(chunks: List<ChunkEntity>)

    @Insert
    suspend fun putPlaybackEvent(event: PlaybackEventEntity): Long

    @Query("SELECT * FROM playback_events WHERE audioUri = :uri ORDER BY createdAt DESC LIMIT :limit")
    suspend fun recentPlaybackEvents(uri: String, limit: Int = 50): List<PlaybackEventEntity>

    @Query("DELETE FROM chunks WHERE bookUri = :uri")
    suspend fun deleteChunks(uri: String)

    @Query(
        """
        UPDATE audio_files
        SET positionMs = :positionMs,
            durationMs = :durationMs,
            lastPlayedAt = :playedAt
        WHERE uri = :uri
        """,
    )
    suspend fun savePosition(uri: String, positionMs: Long, durationMs: Long, playedAt: Long = System.currentTimeMillis())

    @Query(
        """
        UPDATE audio_files
        SET positionMs = :positionMs,
            durationMs = :durationMs,
            lastPausedAt = :pausedAt,
            lastPlayedAt = :pausedAt
        WHERE uri = :uri
        """,
    )
    suspend fun savePausedPosition(uri: String, positionMs: Long, durationMs: Long, pausedAt: Long)

    @Query("UPDATE books SET language = :language, selectedChapterId = :chapterId WHERE uri = :uri")
    suspend fun saveBookOptions(uri: String, language: String, chapterId: String?)

    @Query("UPDATE books SET anchorChunkId = :chunkId WHERE uri = :uri")
    suspend fun saveAnchor(uri: String, chunkId: String?)

    @Transaction
    suspend fun replaceBook(book: BookEntity, chunks: List<ChunkEntity>) {
        putBook(book)
        deleteChunks(book.uri)
        putChunks(chunks)
    }
}

@Dao
interface MetadataDao {
    @Query("SELECT * FROM index_metadata WHERE textHash = :hash AND version = :version")
    suspend fun get(hash: String, version: Int): IndexMetadataEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun put(entity: IndexMetadataEntity)

    @Insert
    suspend fun log(entry: PerformanceLogEntity)

    @Query("SELECT * FROM performance_log ORDER BY createdAt DESC LIMIT 20")
    fun observeLogs(): Flow<List<PerformanceLogEntity>>
}

