package com.tepmex.sttplayerdroid.audio

import androidx.annotation.OptIn
import androidx.media3.common.C
import androidx.media3.common.audio.AudioProcessor
import androidx.media3.common.audio.BaseAudioProcessor
import androidx.media3.common.util.UnstableApi
import java.nio.ByteBuffer
import java.nio.ByteOrder

/** Keeps the last decoded PCM frames; MP3 bytes are never loaded into app memory. */
@OptIn(markerClass = [UnstableApi::class])
class CaptureAudioProcessor(
    private val targetRate: Int = 16_000,
    seconds: Int = 10,
) : BaseAudioProcessor(), PcmSnapshotProvider {
    private val ring = FloatRingBuffer(targetRate * seconds)
    private var sourceRate = targetRate
    private var channels = 1
    private var resampler = StreamingLinearResampler(targetRate, targetRate)

    override val bufferedSeconds: Float get() = ring.size().toFloat() / targetRate

    override fun onConfigure(inputAudioFormat: AudioProcessor.AudioFormat): AudioProcessor.AudioFormat {
        if (inputAudioFormat.encoding != C.ENCODING_PCM_16BIT) {
            throw AudioProcessor.UnhandledAudioFormatException(inputAudioFormat)
        }
        sourceRate = inputAudioFormat.sampleRate
        channels = inputAudioFormat.channelCount
        resampler = StreamingLinearResampler(sourceRate, targetRate)
        // The processor is a transparent tap: playback keeps its original quality.
        return inputAudioFormat
    }

    override fun queueInput(inputBuffer: ByteBuffer) {
        val readable = inputBuffer.asReadOnlyBuffer().order(ByteOrder.LITTLE_ENDIAN)
        val samples = FloatArray(readable.remaining() / 2)
        for (i in samples.indices) samples[i] = readable.short / 32768f
        val mono = PcmMath.downmix(samples, channels)
        val output = resampler.process(mono)
        ring.write(output)

        val passthrough = replaceOutputBuffer(inputBuffer.remaining())
        passthrough.put(inputBuffer)
        passthrough.flip()
    }

    override fun onFlush() = clear()
    override fun onReset() = clear()

    override fun snapshot(seconds: Int): FloatArray? = ring.latest(seconds * targetRate)
    override fun clear() { ring.clear(); resampler.reset() }
}
