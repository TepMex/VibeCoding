package com.tepmex.sttplayerdroid.model

import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.ln
import kotlin.math.max
import kotlin.math.pow
import kotlin.math.sin

/** Whisper-compatible 80-bin, 3000-frame log-Mel frontend at 16 kHz. */
class LogMelPreprocessor {
    private val window = FloatArray(N_FFT) { index ->
        (0.5 - 0.5 * cos(2.0 * PI * index / N_FFT)).toFloat()
    }
    private val filters: Array<FloatArray> = createMelFilters()

    fun process(input: FloatArray): FloatArray {
        val audio = input.copyOf(INPUT_SAMPLES)
        val output = FloatArray(N_MELS * N_FRAMES)
        var maximum = Float.NEGATIVE_INFINITY
        val real = FloatArray(FFT_SIZE)
        val imaginary = FloatArray(FFT_SIZE)
        for (frame in 0 until N_FRAMES) {
            real.fill(0f); imaginary.fill(0f)
            val start = frame * HOP_LENGTH - N_FFT / 2
            for (i in 0 until N_FFT) real[i] = reflected(audio, start + i) * window[i]
            fft(real, imaginary)
            for (mel in 0 until N_MELS) {
                var energy = 0f
                val filter = filters[mel]
                for (bin in filter.indices) energy += filter[bin] * (real[bin] * real[bin] + imaginary[bin] * imaginary[bin])
                val value = (ln(max(energy, 1e-10f).toDouble()) / LN_10).toFloat()
                output[mel * N_FRAMES + frame] = value
                if (value > maximum) maximum = value
            }
        }
        val floor = maximum - 8f
        for (i in output.indices) output[i] = (max(output[i], floor) + 4f) / 4f
        return output
    }

    private fun reflected(audio: FloatArray, index: Int): Float {
        if (audio.isEmpty()) return 0f
        var i = index
        while (i < 0 || i >= audio.size) i = if (i < 0) -i else 2 * audio.lastIndex - i
        return audio[i]
    }

    private fun fft(real: FloatArray, imaginary: FloatArray) {
        var j = 0
        for (i in 1 until FFT_SIZE) {
            var bit = FFT_SIZE shr 1
            while (j and bit != 0) { j = j xor bit; bit = bit shr 1 }
            j = j xor bit
            if (i < j) {
                var temp = real[i]; real[i] = real[j]; real[j] = temp
                temp = imaginary[i]; imaginary[i] = imaginary[j]; imaginary[j] = temp
            }
        }
        var length = 2
        while (length <= FFT_SIZE) {
            val angle = -2.0 * PI / length
            val wLengthReal = cos(angle).toFloat()
            val wLengthImaginary = sin(angle).toFloat()
            var offset = 0
            while (offset < FFT_SIZE) {
                var wr = 1f; var wi = 0f
                for (i in 0 until length / 2) {
                    val even = offset + i; val odd = even + length / 2
                    val oddReal = real[odd] * wr - imaginary[odd] * wi
                    val oddImag = real[odd] * wi + imaginary[odd] * wr
                    real[odd] = real[even] - oddReal; imaginary[odd] = imaginary[even] - oddImag
                    real[even] += oddReal; imaginary[even] += oddImag
                    val nextWr = wr * wLengthReal - wi * wLengthImaginary
                    wi = wr * wLengthImaginary + wi * wLengthReal; wr = nextWr
                }
                offset += length
            }
            length = length shl 1
        }
    }

    private fun createMelFilters(): Array<FloatArray> {
        fun hzToMel(hz: Double) = 2595.0 * kotlin.math.log10(1.0 + hz / 700.0)
        fun melToHz(mel: Double) = 700.0 * (10.0.pow(mel / 2595.0) - 1.0)
        val minMel = hzToMel(0.0); val maxMel = hzToMel(SAMPLE_RATE / 2.0)
        val points = DoubleArray(N_MELS + 2) { index ->
            melToHz(minMel + (maxMel - minMel) * index / (N_MELS + 1)) * FFT_SIZE / SAMPLE_RATE
        }
        return Array(N_MELS) { mel ->
            FloatArray(FFT_SIZE / 2 + 1) { bin ->
                when {
                    bin < points[mel] || bin > points[mel + 2] -> 0f
                    bin <= points[mel + 1] -> ((bin - points[mel]) / (points[mel + 1] - points[mel])).toFloat()
                    else -> ((points[mel + 2] - bin) / (points[mel + 2] - points[mel + 1])).toFloat()
                }
            }
        }
    }

    companion object {
        const val SAMPLE_RATE = 16_000
        const val INPUT_SAMPLES = 30 * SAMPLE_RATE
        const val N_MELS = 80
        const val N_FRAMES = 3_000
        private const val N_FFT = 400
        private const val FFT_SIZE = 512
        private const val HOP_LENGTH = 160
        private val LN_10 = ln(10.0)
    }
}

