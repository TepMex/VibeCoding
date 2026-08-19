package com.tepmex.sttplayerdroid.audio

import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class PcmMathTest {
    @Test fun `stereo is downmixed by averaging channels`() {
        assertArrayEquals(floatArrayOf(0f, 0.5f, -0.5f), PcmMath.downmix(
            floatArrayOf(1f, -1f, 1f, 0f, -1f, 0f), 2), 0.0001f)
    }

    @Test fun `48 kHz is resampled to 16 kHz`() {
        val input = FloatArray(48_000) { it.toFloat() / 48_000 }
        val output = PcmMath.resampleLinear(input, 48_000, 16_000)
        assertEquals(16_000, output.size)
        assertEquals(input[3_000], output[1_000], 0.0001f)
    }

    @Test fun `ring buffer keeps latest values and clear handles seek`() {
        val ring = FloatRingBuffer(4)
        ring.write(floatArrayOf(1f, 2f, 3f, 4f, 5f))
        assertArrayEquals(floatArrayOf(2f, 3f, 4f, 5f), ring.latest(4), 0f)
        ring.clear()
        assertNull(ring.latest(4))
    }

    @Test fun `streaming resampling is independent of buffer boundaries`() {
        val input = FloatArray(48_000) { kotlin.math.sin(it / 20.0).toFloat() }
        val whole = StreamingLinearResampler(48_000, 16_000).process(input)
        val streaming = StreamingLinearResampler(48_000, 16_000)
        val parts = listOf(input.copyOfRange(0, 7_777), input.copyOfRange(7_777, 31_111), input.copyOfRange(31_111, input.size))
            .flatMap { streaming.process(it).toList() }.toFloatArray()
        assertArrayEquals(whole, parts, 0.0001f)
    }

    @Test fun `capture sink accepts pcm16 frames without throwing`() {
        val capture = CaptureAudioProcessor(targetRate = 16_000, seconds = 2)
        capture.flush(48_000, 2, androidx.media3.common.C.ENCODING_PCM_16BIT)
        val frameCount = 4_800 // 100 ms at 48 kHz
        val bytes = ByteArray(frameCount * 2 * 2)
        val buffer = java.nio.ByteBuffer.wrap(bytes).order(java.nio.ByteOrder.LITTLE_ENDIAN)
        capture.handleBuffer(buffer)
        assertTrue(capture.bufferedSeconds > 0.05f)
        val snap = capture.snapshot(1)
        assertTrue(snap != null && snap.isNotEmpty())
        assertEquals(1_600, snap!!.size) // 100 ms at 16 kHz
    }
}
