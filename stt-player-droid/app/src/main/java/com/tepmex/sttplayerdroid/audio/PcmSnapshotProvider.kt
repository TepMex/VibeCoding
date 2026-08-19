package com.tepmex.sttplayerdroid.audio

interface PcmSnapshotProvider {
    fun snapshot(seconds: Int = 5): FloatArray?
    val bufferedSeconds: Float
    fun clear()
}

class FloatRingBuffer(private val capacity: Int) {
    init { require(capacity > 0) }
    private val values = FloatArray(capacity)
    private var writeIndex = 0
    private var count = 0

    @Synchronized
    fun write(input: FloatArray) {
        input.forEach {
            values[writeIndex] = it
            writeIndex = (writeIndex + 1) % capacity
            if (count < capacity) count++
        }
    }

    @Synchronized
    fun latest(size: Int): FloatArray? {
        if (count == 0 || size <= 0) return null
        val actual = minOf(size, count)
        val result = FloatArray(actual)
        var source = (writeIndex - actual + capacity) % capacity
        for (i in result.indices) {
            result[i] = values[source]
            source = (source + 1) % capacity
        }
        return result
    }

    @Synchronized fun size(): Int = count
    @Synchronized fun clear() { writeIndex = 0; count = 0; values.fill(0f) }
}

object PcmMath {
    fun downmix(interleaved: FloatArray, channels: Int): FloatArray {
        require(channels > 0 && interleaved.size % channels == 0)
        if (channels == 1) return interleaved.copyOf()
        return FloatArray(interleaved.size / channels) { frame ->
            var sum = 0f
            for (channel in 0 until channels) sum += interleaved[frame * channels + channel]
            (sum / channels).coerceIn(-1f, 1f)
        }
    }

    fun resampleLinear(input: FloatArray, sourceRate: Int, targetRate: Int): FloatArray {
        require(sourceRate > 0 && targetRate > 0)
        if (input.isEmpty() || sourceRate == targetRate) return input.copyOf()
        val outputSize = ((input.size.toLong() * targetRate) / sourceRate).toInt()
        val ratio = sourceRate.toDouble() / targetRate
        return FloatArray(outputSize) { index ->
            val sourcePosition = index * ratio
            val left = sourcePosition.toInt().coerceAtMost(input.lastIndex)
            val right = (left + 1).coerceAtMost(input.lastIndex)
            val fraction = (sourcePosition - left).toFloat()
            input[left] + (input[right] - input[left]) * fraction
        }
    }
}

class StreamingLinearResampler(private val sourceRate: Int, private val targetRate: Int) {
    private val step = sourceRate.toDouble() / targetRate
    private var previous: Float? = null
    private var position = 0.0

    fun process(input: FloatArray): FloatArray {
        if (input.isEmpty()) return input
        if (sourceRate == targetRate) return input.copyOf()
        val prior = previous
        val data = if (prior == null) input else FloatArray(input.size + 1).also {
            it[0] = prior; input.copyInto(it, 1)
        }
        val result = FloatArray((data.size / step).toInt() + 2)
        var count = 0
        while (position < data.lastIndex) {
            val left = position.toInt()
            val fraction = (position - left).toFloat()
            result[count++] = data[left] + (data[left + 1] - data[left]) * fraction
            position += step
        }
        position -= data.lastIndex
        previous = data.last()
        return result.copyOf(count)
    }

    fun reset() { previous = null; position = 0.0 }
}
