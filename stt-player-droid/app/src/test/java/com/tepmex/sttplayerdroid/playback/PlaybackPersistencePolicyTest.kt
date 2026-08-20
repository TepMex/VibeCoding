package com.tepmex.sttplayerdroid.playback

import android.net.Uri
import android.os.Bundle
import androidx.media3.common.MediaItem
import androidx.media3.session.MediaConstants
import com.tepmex.sttplayerdroid.data.AudioFileEntity
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

class PlaybackPersistencePolicyTest {
    @Test
    fun `periodic persist only while playing and after 30 seconds`() {
        assertFalse(
            PlaybackPersistencePolicy.shouldPersistPeriodically(
                nowElapsedRealtimeMs = 30_000,
                lastPersistAtElapsedRealtimeMs = 0,
                isPlaying = false,
            ),
        )
        assertFalse(
            PlaybackPersistencePolicy.shouldPersistPeriodically(
                nowElapsedRealtimeMs = 29_999,
                lastPersistAtElapsedRealtimeMs = 0,
                isPlaying = true,
            ),
        )
        assertTrue(
            PlaybackPersistencePolicy.shouldPersistPeriodically(
                nowElapsedRealtimeMs = 30_000,
                lastPersistAtElapsedRealtimeMs = 0,
                isPlaying = true,
            ),
        )
    }

    @Test
    fun `large seek threshold is five minutes absolute`() {
        assertFalse(PlaybackPersistencePolicy.isLargeSeek(0, 5 * 60 * 1000L - 1))
        assertTrue(PlaybackPersistencePolicy.isLargeSeek(0, 5 * 60 * 1000L))
        assertTrue(PlaybackPersistencePolicy.isLargeSeek(20 * 60 * 1000L, 10 * 60 * 1000L))
    }

    @Test
    fun `short timeline taps are not large seeks but still require destination persist`() {
        // Regression guard for seek crash fix: destination must be saved for every seek;
        // only the origin bookmark is gated by the 5-minute threshold.
        assertFalse(PlaybackPersistencePolicy.isLargeSeek(60_000, 90_000))
        assertFalse(PlaybackPersistencePolicy.isLargeSeek(10 * 60 * 1000L, 10 * 60 * 1000L + 15_000L))
    }
}

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34])
class PlaybackResumptionMediaItemTest {
    @Test
    fun `mediaItemForResumption keeps uri metadata and completion extras`() {
        val audio = AudioFileEntity(
            uri = "content://com.example/audio/42",
            displayName = "Debt.mp3",
            positionMs = 90_000,
            durationMs = 300_000,
            lastPausedAt = 1_700_000_000_000,
            lastPlayedAt = 1_700_000_000_100,
        )
        val item = PlaybackProgressTracker.mediaItemForResumption(audio)
        assertEquals(Uri.parse(audio.uri), item.localConfiguration?.uri)
        assertEquals(audio.uri, item.mediaId)
        assertEquals("Debt.mp3", item.mediaMetadata.title.toString())
        val extras: Bundle = requireNotNull(item.mediaMetadata.extras)
        assertEquals(
            MediaConstants.EXTRAS_VALUE_COMPLETION_STATUS_PARTIALLY_PLAYED,
            extras.getInt(MediaConstants.EXTRAS_KEY_COMPLETION_STATUS),
        )
        assertEquals(0.3, extras.getDouble(MediaConstants.EXTRAS_KEY_COMPLETION_PERCENTAGE), 1e-9)
    }

    @Test
    fun `restorePlayableMediaItem keeps resumption local uri`() {
        val audio = AudioFileEntity(
            uri = "content://com.example/audio/resume",
            displayName = "Chapter.mp3",
            positionMs = 1_000,
            durationMs = 10_000,
        )
        val item = restorePlayableMediaItem(PlaybackProgressTracker.mediaItemForResumption(audio))
        assertEquals(Uri.parse(audio.uri), item.localConfiguration?.uri)
        assertEquals(MediaItem.RequestMetadata.Builder().setMediaUri(Uri.parse(audio.uri)).build().mediaUri, item.requestMetadata.mediaUri)
    }
}
