package com.tepmex.sttplayerdroid.sync

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class MatchedTextPresenterTest {
    @Test
    fun expandsForwardAndBackwardWithinLimit() {
        val chunks = listOf(
            MatchedTextPresenter.ChunkSnippet("a", "Alpha paragraph one."),
            MatchedTextPresenter.ChunkSnippet("b", "Matched middle text."),
            MatchedTextPresenter.ChunkSnippet("c", "Charlie after match."),
        )
        val text = MatchedTextPresenter.buildExpandedFragment(chunks, "b", maxChars = 200)
        assertTrue(text.contains("Matched middle text."))
        assertTrue(text.contains("Charlie after match."))
        assertTrue(text.contains("Alpha paragraph one."))
    }

    @Test
    fun prefersMatchedChunkWhenNearLimit() {
        val longMatch = "M".repeat(80)
        val chunks = listOf(
            MatchedTextPresenter.ChunkSnippet("a", "AAAA"),
            MatchedTextPresenter.ChunkSnippet("b", longMatch),
            MatchedTextPresenter.ChunkSnippet("c", "CCCC"),
        )
        val text = MatchedTextPresenter.buildExpandedFragment(chunks, "b", maxChars = 90)
        assertTrue(text.startsWith(longMatch) || text.contains(longMatch.take(40)))
        assertTrue(text.length <= 90)
    }

    @Test
    fun truncatesSingleHugeChunk() {
        val huge = "X".repeat(5_000)
        val chunks = listOf(MatchedTextPresenter.ChunkSnippet("only", huge))
        val text = MatchedTextPresenter.buildExpandedFragment(chunks, "only", maxChars = 100)
        assertEquals(100, text.length)
    }

    @Test
    fun collapsedPreviewIsSingleLine() {
        val preview = MatchedTextPresenter.collapsedPreview("First line\n\nSecond line", maxChars = 40)
        assertTrue(!preview.contains('\n'))
        assertTrue(preview.length <= 40)
    }

    @Test
    fun missingChunkFallsBackToFirst() {
        val chunks = listOf(
            MatchedTextPresenter.ChunkSnippet("a", "Only available"),
            MatchedTextPresenter.ChunkSnippet("b", "Other"),
        )
        val text = MatchedTextPresenter.buildExpandedFragment(chunks, "missing", maxChars = 50)
        assertEquals("Only available", text)
    }
}
