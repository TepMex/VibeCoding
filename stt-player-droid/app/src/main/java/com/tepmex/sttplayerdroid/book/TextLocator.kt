package com.tepmex.sttplayerdroid.book

import android.content.Context
import com.tepmex.sttplayerdroid.BookChunk
import com.tepmex.sttplayerdroid.BookDocument
import com.tepmex.sttplayerdroid.MatchResult
import com.tepmex.sttplayerdroid.data.IndexMetadataEntity
import com.tepmex.sttplayerdroid.data.MetadataDao
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.BufferedInputStream
import java.io.BufferedOutputStream
import java.io.DataInputStream
import java.io.DataOutputStream
import java.io.File
import java.text.Normalizer
import java.util.Locale
import kotlin.math.max

interface TextLocator {
    suspend fun index(document: BookDocument)
    suspend fun locate(query: String, chapterId: String? = null, anchorChunkId: String? = null): MatchResult?
}

object TextNormalization {
    fun normalize(value: String): String = Normalizer.normalize(value, Normalizer.Form.NFKC)
        .lowercase(Locale.ROOT)
        .replace(Regex("[^\\p{L}\\p{N}]+"), " ")
        .trim().replace(Regex("\\s+"), " ")

    fun fold(value: String): String = Normalizer.normalize(normalize(value), Normalizer.Form.NFKD)
        .replace("ł", "l").replace("Ł", "l")
        .replace(Regex("\\p{M}+"), "")

    fun words(value: String): List<String> = normalize(value).split(' ').filter(String::isNotBlank)
}

class IndexedTextLocator(
    private val context: Context,
    private val metadataDao: MetadataDao,
) : TextLocator {
    private data class IndexedChunk(
        val source: BookChunk,
        val normalized: String,
        val folded: String,
        val words: List<String>,
    )
    private data class ActiveIndex(
        val hash: String,
        val chunks: List<IndexedChunk>,
        val grams: Map<String, IntArray>,
        val rareWords: Map<String, IntArray>,
        val ordinalById: Map<String, Int>,
    )

    @Volatile private var active: ActiveIndex? = null

    override suspend fun index(document: BookDocument) = withContext(Dispatchers.Default) {
        val indexed = document.chunks.map { chunk ->
            IndexedChunk(chunk, TextNormalization.normalize(chunk.text), TextNormalization.fold(chunk.text), TextNormalization.words(chunk.text))
        }
        val wordFrequency = HashMap<String, Int>()
        indexed.flatMap { it.words.distinct() }.forEach { wordFrequency[it] = (wordFrequency[it] ?: 0) + 1 }
        val existing = metadataDao.get(document.sourceHash, INDEX_VERSION)
        val indexFile = existing?.relativePath?.let { File(context.filesDir, it) }
        if (existing?.chunkCount == indexed.size && indexFile?.isFile == true) {
            runCatching { readPostings(indexFile) }.getOrNull()?.let { (grams, rareWords) ->
                active = ActiveIndex(document.sourceHash, indexed, grams, rareWords,
                    indexed.associate { it.source.id to it.source.ordinal })
                return@withContext
            }
        }
        val gramPostings = HashMap<String, MutableList<Int>>()
        val rarePostings = HashMap<String, MutableList<Int>>()
        indexed.forEachIndexed { ordinal, chunk ->
            wordNgrams(chunk.words, 2).plus(wordNgrams(chunk.words, 3)).distinct().forEach {
                gramPostings.getOrPut(it) { mutableListOf() } += ordinal
            }
            chunk.words.distinct().filter { (wordFrequency[it] ?: Int.MAX_VALUE) <= 3 && it.length >= 4 }.forEach {
                rarePostings.getOrPut(it) { mutableListOf() } += ordinal
            }
        }
        val value = ActiveIndex(
            document.sourceHash,
            indexed,
            gramPostings.mapValues { it.value.toIntArray() },
            rarePostings.mapValues { it.value.toIntArray() },
            indexed.associate { it.source.id to it.source.ordinal },
        )
        persist(value)
        active = value
    }

    override suspend fun locate(query: String, chapterId: String?, anchorChunkId: String?): MatchResult? =
        withContext(Dispatchers.Default) {
            val index = active ?: return@withContext null
            val normalized = TextNormalization.normalize(query)
            val folded = TextNormalization.fold(query)
            val queryWords = TextNormalization.words(query)
            if (queryWords.isEmpty()) return@withContext null
            val anchorOrdinal = anchorChunkId?.let(index.ordinalById::get)

            val tiers = buildList {
                if (anchorOrdinal != null) add(index.chunks.indices.filter { it in (anchorOrdinal - 200)..(anchorOrdinal + 200) })
                if (chapterId != null) add(index.chunks.indices.filter { index.chunks[it].source.chapterId == chapterId })
                add(index.chunks.indices.toList())
            }
            val seen = mutableSetOf<Int>()
            for (tier in tiers) {
                val candidates = candidates(index, queryWords, tier).filter(seen::add)
                val best = candidates.asSequence().map { ordinal ->
                    val chunk = index.chunks[ordinal]
                    val score = max(
                        similarity(normalized, queryWords, chunk.normalized, chunk.words),
                        similarity(folded, TextNormalization.words(folded), chunk.folded, TextNormalization.words(chunk.folded)) * 0.97,
                    )
                    ordinal to score
                }.maxByOrNull { it.second }
                if (best != null && best.second >= MIN_SCORE) {
                    val chunk = index.chunks[best.first].source
                    return@withContext MatchResult(chunk.id, chunk.chapterId, best.second, chunk.text)
                }
            }
            null
        }

    private fun candidates(index: ActiveIndex, queryWords: List<String>, allowed: List<Int>): List<Int> {
        val allowedSet = allowed.toHashSet()
        val votes = HashMap<Int, Int>()
        val keys = wordNgrams(queryWords, 3) + wordNgrams(queryWords, 2)
        keys.forEach { gram -> index.grams[gram]?.forEach { if (it in allowedSet) votes[it] = (votes[it] ?: 0) + 3 } }
        queryWords.distinct().forEach { word -> index.rareWords[word]?.forEach { if (it in allowedSet) votes[it] = (votes[it] ?: 0) + 2 } }
        return if (votes.isNotEmpty()) votes.entries.sortedByDescending { it.value }.take(MAX_CANDIDATES).map { it.key }
        else allowed.take(MAX_CANDIDATES)
    }

    private fun similarity(query: String, queryWords: List<String>, text: String, words: List<String>): Double {
        if (text.contains(query)) return 1.0
        if (words.isEmpty()) return 0.0
        val alignment = orderedAlignment(queryWords, words)
        val windowLength = queryWords.size.coerceAtLeast(1)
        var editScore = 0.0
        for (start in 0 until words.size) {
            val end = minOf(words.size, start + windowLength + 2)
            val candidate = words.subList(start, end).joinToString(" ")
            val distance = levenshtein(query, candidate)
            editScore = max(editScore, 1.0 - distance.toDouble() / max(query.length, candidate.length).coerceAtLeast(1))
        }
        return alignment * 0.58 + editScore * 0.42
    }

    private fun orderedAlignment(query: List<String>, target: List<String>): Double {
        if (query.isEmpty()) return 0.0
        val previous = IntArray(target.size + 1)
        val current = IntArray(target.size + 1)
        query.forEach { queryWord ->
            for (j in 1..target.size) {
                current[j] = if (wordSimilar(queryWord, target[j - 1])) previous[j - 1] + 1
                else max(previous[j], current[j - 1])
            }
            current.copyInto(previous); current.fill(0)
        }
        return previous.maxOrNull()!!.toDouble() / query.size
    }

    private fun wordSimilar(a: String, b: String): Boolean {
        if (a == b) return true
        val maxLength = max(a.length, b.length)
        return maxLength >= 4 && levenshtein(a, b).toDouble() / maxLength <= 0.30
    }

    private fun levenshtein(a: String, b: String): Int {
        if (a.isEmpty()) return b.length
        var previous = IntArray(b.length + 1) { it }
        var current = IntArray(b.length + 1)
        for (i in a.indices) {
            current[0] = i + 1
            for (j in b.indices) current[j + 1] = minOf(current[j] + 1, previous[j + 1] + 1, previous[j] + if (a[i] == b[j]) 0 else 1)
            val swap = previous; previous = current; current = swap
        }
        return previous[b.length]
    }

    private fun wordNgrams(words: List<String>, n: Int): List<String> =
        if (words.size < n) emptyList() else (0..words.size - n).map { words.subList(it, it + n).joinToString(" ") }

    private suspend fun persist(index: ActiveIndex) = withContext(Dispatchers.IO) {
        val directory = File(context.filesDir, "indices").apply { mkdirs() }
        val destination = File(directory, "${index.hash}-$INDEX_VERSION.bin")
        val temporary = File(directory, destination.name + ".tmp")
        DataOutputStream(BufferedOutputStream(temporary.outputStream())).use { output ->
            output.writeInt(INDEX_MAGIC); output.writeInt(INDEX_VERSION); output.writeUTF(index.hash)
            writePostings(output, index.grams); writePostings(output, index.rareWords)
        }
        if (!temporary.renameTo(destination)) {
            temporary.copyTo(destination, overwrite = true); temporary.delete()
        }
        metadataDao.put(IndexMetadataEntity(index.hash, INDEX_VERSION, "indices/${destination.name}", index.chunks.size, System.currentTimeMillis()))
    }

    private fun readPostings(file: File): Pair<Map<String, IntArray>, Map<String, IntArray>> =
        DataInputStream(BufferedInputStream(file.inputStream())).use { input ->
            require(input.readInt() == INDEX_MAGIC && input.readInt() == INDEX_VERSION)
            input.readUTF()
            readPostingMap(input) to readPostingMap(input)
        }

    private fun writePostings(output: DataOutputStream, values: Map<String, IntArray>) {
        output.writeInt(values.size)
        values.forEach { (key, ordinals) -> output.writeUTF(key); output.writeInt(ordinals.size); ordinals.forEach(output::writeInt) }
    }
    private fun readPostingMap(input: DataInputStream): Map<String, IntArray> = buildMap {
        repeat(input.readInt()) { put(input.readUTF(), IntArray(input.readInt()) { input.readInt() }) }
    }

    companion object {
        const val INDEX_VERSION = 1
        private const val INDEX_MAGIC = 0x53545449
        private const val MAX_CANDIDATES = 64
        private const val MIN_SCORE = 0.52
    }
}
