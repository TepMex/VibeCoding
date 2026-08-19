package com.tepmex.sttplayerdroid.book

import android.content.Context
import android.net.Uri
import android.provider.OpenableColumns
import android.util.Xml
import com.tepmex.sttplayerdroid.BookChapter
import com.tepmex.sttplayerdroid.BookChunk
import com.tepmex.sttplayerdroid.BookDocument
import com.tepmex.sttplayerdroid.util.Hashing
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.jsoup.Jsoup
import org.jsoup.nodes.Element
import org.jsoup.parser.Parser
import org.xmlpull.v1.XmlPullParser
import java.io.ByteArrayInputStream
import java.util.zip.ZipInputStream

interface BookParser {
    suspend fun parse(uri: Uri): BookDocument
}

class BookParseException(message: String, cause: Throwable? = null) : Exception(message, cause)

class AndroidBookParser(private val context: Context) : BookParser {
    private data class RawChapter(val title: String, val paragraphs: List<String>)

    override suspend fun parse(uri: Uri): BookDocument = withContext(Dispatchers.IO) {
        try {
            val bytes = context.contentResolver.openInputStream(uri)?.use { it.readBytes() }
                ?: throw BookParseException("Не удалось открыть файл")
            val name = displayName(uri)
            val extension = name.substringAfterLast('.', "").lowercase()
            val (title, rawChapters) = when (extension) {
                "txt" -> name.substringBeforeLast('.') to parseTxt(bytes)
                "html", "htm" -> parseHtml(bytes.toString(Charsets.UTF_8), name)
                "epub" -> parseEpub(bytes, name)
                "fb2" -> parseFb2(bytes, name)
                else -> throw BookParseException("Поддерживаются TXT, HTML, EPUB и FB2")
            }
            buildDocument(uri, title, rawChapters)
        } catch (error: BookParseException) {
            throw error
        } catch (error: Exception) {
            throw BookParseException("Файл повреждён или имеет неподдерживаемую структуру", error)
        }
    }

    private fun parseTxt(bytes: ByteArray): List<RawChapter> {
        val text = bytes.toString(Charsets.UTF_8).removePrefix("\uFEFF")
        val paragraphs = text.split(Regex("\\R\\s*\\R"))
            .map(::clean).filter(String::isNotBlank)
        return listOf(RawChapter("Текст", paragraphs))
    }

    private fun parseHtml(html: String, fallbackName: String): Pair<String, List<RawChapter>> {
        val document = Jsoup.parse(html)
        val title = document.title().ifBlank { fallbackName.substringBeforeLast('.') }
        val chapters = mutableListOf<RawChapter>()
        var chapterTitle = title
        var paragraphs = mutableListOf<String>()

        fun flush() {
            if (paragraphs.isNotEmpty()) chapters += RawChapter(chapterTitle, paragraphs.toList())
            paragraphs = mutableListOf()
        }
        document.body()?.children()?.forEach { element ->
            if (element.tagName() in setOf("h1", "h2")) {
                flush()
                chapterTitle = clean(element.text()).ifBlank { "Глава ${chapters.size + 1}" }
            } else {
                paragraphTexts(element).forEach { if (it.isNotBlank()) paragraphs += it }
            }
        }
        flush()
        if (chapters.isEmpty()) {
            val body = clean(document.body()?.text().orEmpty())
            if (body.isNotBlank()) chapters += RawChapter(title, listOf(body))
        }
        return title to chapters
    }

    private fun parseEpub(bytes: ByteArray, fallbackName: String): Pair<String, List<RawChapter>> {
        val entries = mutableMapOf<String, ByteArray>()
        ZipInputStream(ByteArrayInputStream(bytes)).use { zip ->
            while (true) {
                val entry = zip.nextEntry ?: break
                val extension = entry.name.substringAfterLast('.', "").lowercase()
                if (!entry.isDirectory && (entry.name == "META-INF/container.xml" || extension in setOf("xml", "opf", "xhtml", "html", "htm", "ncx"))) {
                    entries[entry.name] = zip.readBytes()
                }
                zip.closeEntry()
            }
        }
        val container = entries["META-INF/container.xml"]?.toString(Charsets.UTF_8)
            ?: throw BookParseException("EPUB: отсутствует container.xml")
        val containerDoc = Jsoup.parse(container, "", Parser.xmlParser())
        val opfPath = containerDoc.selectFirst("rootfile")?.attr("full-path")
            ?: throw BookParseException("EPUB: не найден OPF")
        val opf = entries[opfPath]?.toString(Charsets.UTF_8)
            ?: throw BookParseException("EPUB: OPF недоступен")
        val opfDoc = Jsoup.parse(opf, "", Parser.xmlParser())
        val title = opfDoc.selectFirst("dc|title, title")?.text()?.let(::clean)
            .orEmpty().ifBlank { fallbackName.substringBeforeLast('.') }
        val manifest = opfDoc.select("manifest item").associate {
            it.attr("id") to resolveZipPath(opfPath.substringBeforeLast('/', ""), it.attr("href"))
        }
        val chapters = opfDoc.select("spine itemref").mapNotNull { item ->
            val path = manifest[item.attr("idref")] ?: return@mapNotNull null
            val markup = entries[path]?.toString(Charsets.UTF_8) ?: return@mapNotNull null
            val chapterDoc = Jsoup.parse(markup)
            val paragraphs = chapterDoc.select("p, blockquote, li")
                .map { clean(it.text()) }.filter(String::isNotBlank)
                .ifEmpty { listOf(clean(chapterDoc.body()?.text().orEmpty())) }
                .filter(String::isNotBlank)
            if (paragraphs.isEmpty()) null else RawChapter(
                chapterDoc.selectFirst("h1, h2, title")?.text()?.let(::clean)
                    .orEmpty().ifBlank { "Глава ${item.elementSiblingIndex() + 1}" },
                paragraphs,
            )
        }
        if (chapters.isEmpty()) throw BookParseException("EPUB: spine не содержит текста")
        return title to chapters
    }

    private fun parseFb2(bytes: ByteArray, fallbackName: String): Pair<String, List<RawChapter>> {
        val parser = Xml.newPullParser().apply {
            setFeature(XmlPullParser.FEATURE_PROCESS_NAMESPACES, false)
            setInput(ByteArrayInputStream(bytes), "UTF-8")
        }
        var bookTitle = ""
        var inBookTitle = false
        var sectionDepth = 0
        var inSectionTitle = false
        var inParagraph = false
        var paragraph = StringBuilder()
        var chapterTitle = ""
        var paragraphs = mutableListOf<String>()
        val chapters = mutableListOf<RawChapter>()

        fun flushSection() {
            if (paragraphs.isNotEmpty()) chapters += RawChapter(
                chapterTitle.ifBlank { "Глава ${chapters.size + 1}" }, paragraphs.toList())
            chapterTitle = ""
            paragraphs = mutableListOf()
        }

        while (parser.eventType != XmlPullParser.END_DOCUMENT) {
            when (parser.eventType) {
                XmlPullParser.START_TAG -> when (parser.name.substringAfter(':')) {
                    "book-title" -> inBookTitle = true
                    "section" -> { if (sectionDepth == 0) flushSection(); sectionDepth++ }
                    "title" -> if (sectionDepth > 0) inSectionTitle = true
                    "p" -> { inParagraph = true; paragraph = StringBuilder() }
                }
                XmlPullParser.TEXT -> {
                    if (inBookTitle) bookTitle += parser.text
                    if (inParagraph) paragraph.append(parser.text)
                }
                XmlPullParser.END_TAG -> when (parser.name.substringAfter(':')) {
                    "book-title" -> inBookTitle = false
                    "p" -> {
                        val value = clean(paragraph.toString())
                        if (value.isNotBlank()) {
                            if (inSectionTitle) chapterTitle = listOf(chapterTitle, value)
                                .filter(String::isNotBlank).joinToString(" ")
                            else if (sectionDepth > 0) paragraphs += value
                        }
                        inParagraph = false
                    }
                    "title" -> inSectionTitle = false
                    "section" -> { sectionDepth--; if (sectionDepth == 0) flushSection() }
                }
            }
            parser.next()
        }
        flushSection()
        if (chapters.isEmpty()) throw BookParseException("FB2 не содержит разделов с текстом")
        return clean(bookTitle).ifBlank { fallbackName.substringBeforeLast('.') } to chapters
    }

    private fun buildDocument(uri: Uri, title: String, raw: List<RawChapter>): BookDocument {
        if (raw.isEmpty()) throw BookParseException("В книге нет текста")
        val canonical = raw.joinToString("\n") { chapter ->
            chapter.title + "\n" + chapter.paragraphs.joinToString("\n")
        }
        val hash = Hashing.sha256(canonical)
        var ordinal = 0
        val chapters = raw.mapIndexed { chapterIndex, chapter ->
            val chapterId = "$hash:c$chapterIndex"
            val chunks = chapter.paragraphs.flatMapIndexed { paragraphIndex, paragraph ->
                splitIntoChunks(paragraph).mapIndexed { partIndex, text ->
                    BookChunk(
                        id = Hashing.sha256("$hash:$chapterIndex:$paragraphIndex:$partIndex:$text").take(24),
                        chapterId = chapterId,
                        paragraph = paragraphIndex,
                        ordinal = ordinal++,
                        text = text,
                    )
                }
            }
            BookChapter(chapterId, chapter.title, chapterIndex, chunks)
        }.filter { it.chunks.isNotEmpty() }
        return BookDocument(uri, hash, clean(title), chapters)
    }

    private fun splitIntoChunks(text: String, maxChars: Int = 700): List<String> {
        if (text.length <= maxChars) return listOf(text)
        val sentences = text.split(Regex("(?<=[.!?…])\\s+"))
        val result = mutableListOf<String>()
        var current = StringBuilder()
        for (sentence in sentences) {
            if (current.isNotEmpty() && current.length + sentence.length + 1 > maxChars) {
                result += current.toString(); current = StringBuilder()
            }
            if (current.isNotEmpty()) current.append(' ')
            current.append(sentence)
        }
        if (current.isNotEmpty()) result += current.toString()
        return result
    }

    private fun paragraphTexts(element: Element): List<String> {
        val selected = element.select("p, blockquote, li")
        return if (selected.isEmpty()) listOf(clean(element.text())) else selected.map { clean(it.text()) }
    }

    private fun displayName(uri: Uri): String = context.contentResolver.query(
        uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null,
    )?.use { cursor -> if (cursor.moveToFirst()) cursor.getString(0) else null }
        ?: uri.lastPathSegment ?: "book.txt"

    private fun resolveZipPath(base: String, href: String): String {
        val parts = (base.split('/').filter(String::isNotBlank) + href.substringBefore('#').split('/'))
        val out = mutableListOf<String>()
        parts.forEach { when (it) { "", "." -> Unit; ".." -> if (out.isNotEmpty()) out.removeAt(out.lastIndex); else -> out += it } }
        return out.joinToString("/")
    }

    private fun clean(value: String): String = value.replace(Regex("\\s+"), " ").trim()
}
