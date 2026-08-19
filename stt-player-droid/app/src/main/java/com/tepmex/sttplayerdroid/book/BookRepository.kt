package com.tepmex.sttplayerdroid.book

import android.content.Context
import android.net.Uri
import com.tepmex.sttplayerdroid.BookChapter
import com.tepmex.sttplayerdroid.BookChunk
import com.tepmex.sttplayerdroid.BookDocument
import com.tepmex.sttplayerdroid.SttLanguage
import com.tepmex.sttplayerdroid.data.BookEntity
import com.tepmex.sttplayerdroid.data.ChunkEntity
import com.tepmex.sttplayerdroid.data.LibraryDao
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

class BookRepository(
    private val context: Context,
    private val parser: BookParser,
    private val locator: TextLocator,
    private val libraryDao: LibraryDao,
) {
    val recentBooks = libraryDao.observeBooks()

    suspend fun import(uri: Uri): BookDocument = withContext(Dispatchers.IO) {
        takePermission(uri)
        val document = parser.parse(uri)
        val existing = libraryDao.book(uri.toString())
        val book = BookEntity(
            uri = uri.toString(), title = document.title, textHash = document.sourceHash,
            language = existing?.language ?: SttLanguage.English,
            selectedChapterId = existing?.selectedChapterId,
            anchorChunkId = existing?.anchorChunkId,
        )
        val chapterById = document.chapters.associateBy(BookChapter::id)
        val entities = document.chunks.map { chunk ->
            val chapter = chapterById.getValue(chunk.chapterId)
            ChunkEntity(chunk.id, book.uri, chunk.chapterId, chapter.title, chapter.ordinal,
                chunk.paragraph, chunk.ordinal, chunk.text)
        }
        libraryDao.replaceBook(book, entities)
        locator.index(document)
        document
    }

    suspend fun restore(uri: Uri): BookDocument? = withContext(Dispatchers.IO) {
        val book = libraryDao.book(uri.toString()) ?: return@withContext null
        val entities = libraryDao.chunks(book.uri)
        if (entities.isEmpty()) return@withContext import(uri)
        val chapters = entities.groupBy { it.chapterId }.values.sortedBy { it.first().chapterOrdinal }.map { group ->
            val first = group.first()
            BookChapter(first.chapterId, first.chapterTitle, first.chapterOrdinal, group.map {
                BookChunk(it.id, it.chapterId, it.paragraph, it.ordinal, it.text)
            })
        }
        val document = BookDocument(uri, book.textHash, book.title, chapters)
        locator.index(document)
        document
    }

    suspend fun saveOptions(uri: Uri, language: SttLanguage, chapterId: String?) =
        libraryDao.saveBookOptions(uri.toString(), language.code, chapterId)

    private fun takePermission(uri: Uri) {
        runCatching {
            context.contentResolver.takePersistableUriPermission(
                uri, android.content.Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }
    }
}

