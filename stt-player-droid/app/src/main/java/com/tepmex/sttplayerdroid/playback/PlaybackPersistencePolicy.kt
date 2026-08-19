package com.tepmex.sttplayerdroid.playback

/**
 * Rules for when listening progress and bookmark-like events are written to Room.
 */
object PlaybackPersistencePolicy {
    /** While playing, flush the current position at most this often. */
    const val PERIODIC_INTERVAL_MS = 30_000L

    /** Absolute seek jumps at/above this delta record the origin as a seek bookmark. */
    const val LARGE_SEEK_THRESHOLD_MS = 5L * 60L * 1_000L

    fun shouldPersistPeriodically(
        nowElapsedRealtimeMs: Long,
        lastPersistAtElapsedRealtimeMs: Long,
        isPlaying: Boolean,
    ): Boolean =
        isPlaying && nowElapsedRealtimeMs - lastPersistAtElapsedRealtimeMs >= PERIODIC_INTERVAL_MS

    fun isLargeSeek(fromPositionMs: Long, toPositionMs: Long): Boolean =
        kotlin.math.abs(toPositionMs - fromPositionMs) >= LARGE_SEEK_THRESHOLD_MS
}
