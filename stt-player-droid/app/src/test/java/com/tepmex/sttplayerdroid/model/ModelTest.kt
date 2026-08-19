package com.tepmex.sttplayerdroid.model

import com.tepmex.sttplayerdroid.SttLanguage
import com.tepmex.sttplayerdroid.util.Hashing
import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Test

class ModelTest {
    @Test fun `sha256 is stable`() {
        assertEquals("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad", Hashing.sha256("abc"))
    }

    @Test fun `prompt has English language transcribe and no timestamps`() {
        assertArrayEquals(intArrayOf(50_258, 50_259, 50_359, 50_363), WhisperPrompt.tokens(SttLanguage.English))
    }

    @Test fun `prompt has Polish language token`() {
        assertArrayEquals(intArrayOf(50_258, 50_269, 50_359, 50_363), WhisperPrompt.tokens(SttLanguage.Polish))
    }
}

