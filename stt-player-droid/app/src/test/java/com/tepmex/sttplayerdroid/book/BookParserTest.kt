package com.tepmex.sttplayerdroid.book

import android.content.Context
import android.net.Uri
import androidx.test.core.app.ApplicationProvider
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import java.io.File
import java.util.zip.ZipEntry
import java.util.zip.ZipOutputStream

@RunWith(RobolectricTestRunner::class)
class BookParserTest {
    private val context = ApplicationProvider.getApplicationContext<Context>()
    private val parser = AndroidBookParser(context)

    @Test fun `TXT handles UTF-8 BOM and empty sections`() = runBlocking {
        val file = fixture("book.txt", "\uFEFFFirst paragraph.\n\n\nSecond paragraph.")
        val result = parser.parse(Uri.fromFile(file))
        assertEquals(2, result.chunks.size)
        assertTrue(result.chunks.first().text.startsWith("First"))
    }

    @Test fun `HTML creates heading chapters`() = runBlocking {
        val file = fixture("book.html", "<title>Sample</title><body><h1>One</h1><p>Alpha.</p><h2>Empty</h2><h2>Two</h2><p>Beta.</p></body>")
        val result = parser.parse(Uri.fromFile(file))
        assertEquals(listOf("One", "Two"), result.chapters.map { it.title })
    }

    @Test fun `FB2 reads sections`() = runBlocking {
        val file = fixture("book.fb2", """<FictionBook><description><title-info><book-title>FB</book-title></title-info></description><body><section><title><p>First</p></title><p>Hello world.</p></section><section><title><p>Empty</p></title></section></body></FictionBook>""")
        val result = parser.parse(Uri.fromFile(file))
        assertEquals(1, result.chapters.size)
        assertEquals("First", result.chapters.first().title)
    }

    @Test fun `EPUB follows OPF spine`() = runBlocking {
        val file = File(context.cacheDir, "book.epub")
        ZipOutputStream(file.outputStream()).use { zip ->
            fun entry(name: String, text: String) { zip.putNextEntry(ZipEntry(name)); zip.write(text.toByteArray()); zip.closeEntry() }
            entry("META-INF/container.xml", "<container><rootfiles><rootfile full-path='OPS/book.opf'/></rootfiles></container>")
            entry("OPS/book.opf", "<package><metadata><title>EPUB</title></metadata><manifest><item id='one' href='one.xhtml'/><item id='empty' href='empty.xhtml'/></manifest><spine><itemref idref='one'/><itemref idref='empty'/></spine></package>")
            entry("OPS/one.xhtml", "<html><h1>One</h1><p>Hello EPUB.</p></html>")
            entry("OPS/empty.xhtml", "<html><body></body></html>")
        }
        val result = parser.parse(Uri.fromFile(file))
        assertEquals(1, result.chapters.size)
        assertEquals("One", result.chapters.first().title)
    }

    @Test fun `corrupt EPUB reports parse error`() {
        val file = fixture("broken.epub", "not a zip")
        assertThrows(BookParseException::class.java) { runBlocking { parser.parse(Uri.fromFile(file)) } }
    }

    private fun fixture(name: String, content: String) = File(context.cacheDir, name).apply { writeText(content) }
}
