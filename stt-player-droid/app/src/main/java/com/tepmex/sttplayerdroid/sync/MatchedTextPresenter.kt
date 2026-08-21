package com.tepmex.sttplayerdroid.sync

/**
 * Builds the longest useful book excerpt for a lock-screen / public notification.
 * Grows from the matched chunk outward until [maxChars].
 */
object MatchedTextPresenter {
    const val DEFAULT_MAX_CHARS = 3_500

    data class ChunkSnippet(val id: String, val text: String)

    fun buildExpandedFragment(
        chunks: List<ChunkSnippet>,
        matchedChunkId: String,
        maxChars: Int = DEFAULT_MAX_CHARS,
    ): String {
        if (chunks.isEmpty()) return ""
        val index = chunks.indexOfFirst { it.id == matchedChunkId }.takeIf { it >= 0 }
            ?: return chunks.first().text.take(maxChars)
        var start = index
        var end = index
        var text = chunks[index].text.trim()
        if (text.length >= maxChars) return text.take(maxChars)

        while (text.length < maxChars && (start > 0 || end < chunks.lastIndex)) {
            val canGrowStart = start > 0
            val canGrowEnd = end < chunks.lastIndex
            when {
                canGrowStart && canGrowEnd -> {
                    // Prefer adding the next paragraph first (reading forward), then previous.
                    val next = chunks[end + 1].text.trim()
                    val candidate = (text + "\n\n" + next)
                    if (candidate.length <= maxChars) {
                        end += 1
                        text = candidate
                    } else if (start > 0) {
                        val prev = chunks[start - 1].text.trim()
                        val withPrev = (prev + "\n\n" + text)
                        if (withPrev.length <= maxChars) {
                            start -= 1
                            text = withPrev
                        } else {
                            val remaining = maxChars - text.length - 2
                            if (remaining > 24) {
                                text = text + "\n\n" + next.take(remaining)
                            }
                            break
                        }
                    } else {
                        val remaining = maxChars - text.length - 2
                        if (remaining > 24) {
                            text = text + "\n\n" + next.take(remaining)
                        }
                        break
                    }
                }
                canGrowEnd -> {
                    val next = chunks[end + 1].text.trim()
                    val candidate = text + "\n\n" + next
                    if (candidate.length <= maxChars) {
                        end += 1
                        text = candidate
                    } else {
                        val remaining = maxChars - text.length - 2
                        if (remaining > 24) text = text + "\n\n" + next.take(remaining)
                        break
                    }
                }
                canGrowStart -> {
                    val prev = chunks[start - 1].text.trim()
                    val candidate = prev + "\n\n" + text
                    if (candidate.length <= maxChars) {
                        start -= 1
                        text = candidate
                    } else {
                        val remaining = maxChars - text.length - 2
                        if (remaining > 24) {
                            text = prev.takeLast(remaining) + "\n\n" + text
                        }
                        break
                    }
                }
            }
        }
        return text
    }

    fun collapsedPreview(fullText: String, maxChars: Int = 120): String {
        val singleLine = fullText.replace('\n', ' ').replace(Regex("\\s+"), " ").trim()
        return if (singleLine.length <= maxChars) singleLine
        else singleLine.take(maxChars - 1).trimEnd() + "…"
    }
}
