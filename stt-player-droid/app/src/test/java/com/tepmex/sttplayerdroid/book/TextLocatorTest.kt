package com.tepmex.sttplayerdroid.book

import android.content.Context
import android.net.Uri
import androidx.room.Room
import androidx.test.core.app.ApplicationProvider
import com.tepmex.sttplayerdroid.BookChapter
import com.tepmex.sttplayerdroid.BookChunk
import com.tepmex.sttplayerdroid.BookDocument
import com.tepmex.sttplayerdroid.data.AppDatabase
import kotlinx.coroutines.runBlocking
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

@RunWith(RobolectricTestRunner::class)
class TextLocatorTest {
    private val context = ApplicationProvider.getApplicationContext<Context>()
    private val database = Room.inMemoryDatabaseBuilder(context, AppDatabase::class.java).build()

    @After fun close() = database.close()

    @Test fun `normalization folds Polish diacritics`() {
        assertEquals("zazolc gesla jazn", TextNormalization.fold("Zażółć gęślą jaźń"))
    }

    @Test fun `fuzzy search tolerates STT errors and prioritizes local anchor`() = runBlocking {
        val chunks = (0 until 500).map { ordinal ->
            val text = when (ordinal) {
                10 -> "Zażółć gęślą jaźń, to jest lokalny fragment opowieści."
                420 -> "Zazolc gesla jazn to jest odległy fragment opowieści."
                else -> "Neutralny akapit numer $ordinal bez poszukiwanej wypowiedzi."
            }
            BookChunk("id-$ordinal", "chapter", ordinal, ordinal, text)
        }
        val document = BookDocument(Uri.EMPTY, "hash-local", "Test", listOf(BookChapter("chapter", "One", 0, chunks)))
        val locator = IndexedTextLocator(context, database.metadata())
        locator.index(document)
        val result = locator.locate("zazolc gesla jasn lokalny fragment", "chapter", "id-10")
        assertNotNull(result)
        assertEquals("id-10", result!!.chunkId)
    }
}

