package com.tepmex.sttplayerdroid.audio

import android.util.Log
import androidx.annotation.OptIn
import androidx.media3.common.C
import androidx.media3.common.util.UnstableApi
import androidx.media3.exoplayer.audio.TeeAudioProcessor
import java.nio.ByteBuffer
import java.nio.ByteOrder

/**
 * PCM tap for STT sync. Used with [TeeAudioProcessor] so playback always passthroughs;
 * capture bugs must never fail ExoPlayer prepare/play.
 */
@OptIn(markerClass = [UnstableApi::class])
class CaptureAudioProcessor(
    private val targetRate: Int = 16_000,
    seconds: Int = 10,
) : TeeAudioProcessor.AudioBufferSink, PcmSnapshotProvider {
    private val ring = FloatRingBuffer(targetRate * seconds)
    private var sourceRate = targetRate
    private var channels = 1
    private var encoding = C.ENCODING_PCM_16BIT
    private var resampler = StreamingLinearResampler(targetRate, targetRate)

    override val bufferedSeconds: Float get() = ring.size().toFloat() / targetRate

    override fun flush(sampleRateHz: Int, channelCount: Int, encoding: Int) {
        sourceRate = sampleRateHz.coerceAtLeast(1)
        channels = channelCount.coerceAtLeast(1)
        this.encoding = encoding
        resampler = StreamingLinearResampler(sourceRate, targetRate)
        clear()
        Log.i(TAG, "capture flush sampleRate=$sourceRate channels=$channels encoding=$encoding")
    }

    override fun handleBuffer(buffer: ByteBuffer) {
        if (!buffer.hasRemaining()) return
        // Playback must not die if capture fails (odd frames, unexpected encoding, etc.).
        runCatching { capture(buffer.asReadOnlyBuffer()) }
            .onFailure { error -> Log.w(TAG, "PCM capture skipped: ${error.javaClass.simpleName}: ${error.message}") }
    }

    private fun capture(readable: ByteBuffer) {
        when (encoding) {
            C.ENCODING_PCM_16BIT -> capturePcm16(readable.order(ByteOrder.LITTLE_ENDIAN))
            C.ENCODING_PCM_FLOAT -> capturePcmFloat(readable.order(ByteOrder.nativeOrder()))
            else -> {
                // Unknown encoding: skip capture, TeeAudioProcessor still plays audio.
            }
        }
    }

    private fun capturePcm16(readable: ByteBuffer) {
        val frameBytes = 2 * channels
        if (frameBytes <= 0 || readable.remaining() < frameBytes) return
        val aligned = readable.remaining() - (readable.remaining() % frameBytes)
        if (aligned <= 0) return
        val limit = readable.limit()
        readable.limit(readable.position() + aligned)
        val samples = FloatArray(aligned / 2)
        for (i in samples.indices) samples[i] = readable.short / 32768f
        readable.limit(limit)
        writeMono(samples)
    }

    private fun capturePcmFloat(readable: ByteBuffer) {
        val frameBytes = 4 * channels
        if (frameBytes <= 0 || readable.remaining() < frameBytes) return
        val aligned = readable.remaining() - (readable.remaining() % frameBytes)
        if (aligned <= 0) return
        val limit = readable.limit()
        readable.limit(readable.position() + aligned)
        val samples = FloatArray(aligned / 4)
        for (i in samples.indices) samples[i] = readable.float
        readable.limit(limit)
        writeMono(samples)
    }

    private fun writeMono(interleaved: FloatArray) {
        if (interleaved.isEmpty()) return
        if (interleaved.size % channels != 0) return
        val mono = PcmMath.downmix(interleaved, channels)
        ring.write(resampler.process(mono))
    }

    override fun snapshot(seconds: Int): FloatArray? = ring.latest(seconds * targetRate)
    override fun clear() { ring.clear(); resampler.reset() }

    fun asTeeProcessor(): TeeAudioProcessor = TeeAudioProcessor(this)

    private companion object {
        const val TAG = "SttPlayerCapture"
    }
}
