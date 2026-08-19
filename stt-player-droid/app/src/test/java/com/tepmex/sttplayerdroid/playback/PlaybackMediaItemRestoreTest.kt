package com.tepmex.sttplayerdroid.playback

import android.net.Uri
import androidx.media3.common.MediaItem
import androidx.media3.common.MediaMetadata
import androidx.media3.common.MimeTypes
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertSame
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34])
class PlaybackMediaItemRestoreTest {
    @Test
    fun `restorePlayableMediaItem rebuilds uri from mediaId when localConfiguration is missing`() {
        val uri = Uri.parse("content://com.android.providers.downloads.documents/document/42")
        // Simulate MediaController → MediaSession binder: metadata/mediaId kept, local URI stripped.
        val stripped = MediaItem.Builder()
            .setMediaId(uri.toString())
            .setRequestMetadata(MediaItem.RequestMetadata.Builder().setMediaUri(uri).build())
            .setMediaMetadata(MediaMetadata.Builder().setTitle("Debt.mp3").build())
            .build()
        assertNull(stripped.localConfiguration)

        val restored = restorePlayableMediaItem(stripped)
        assertEquals(uri, restored.localConfiguration?.uri)
        assertEquals(uri.toString(), restored.mediaId)
        assertEquals("Debt.mp3", restored.mediaMetadata.title.toString())
        assertEquals(MimeTypes.AUDIO_MPEG, restored.localConfiguration?.mimeType)
    }

    @Test
    fun `restorePlayableMediaItem prefers existing localConfiguration`() {
        val uri = Uri.parse("content://com.example/audio/1")
        val original = MediaItem.Builder()
            .setUri(uri)
            .setMediaId(uri.toString())
            .setMimeType(MimeTypes.AUDIO_MPEG)
            .build()
        assertSame(original, restorePlayableMediaItem(original))
    }

    @Test
    fun `resolvePlaybackUri falls back from requestMetadata then mediaId`() {
        val uri = Uri.parse("content://com.example/audio/fallback")
        val fromRequest = MediaItem.Builder()
            .setMediaId("ignored-id")
            .setRequestMetadata(MediaItem.RequestMetadata.Builder().setMediaUri(uri).build())
            .build()
        assertEquals(uri, resolvePlaybackUri(fromRequest))

        val fromMediaId = MediaItem.Builder().setMediaId(uri.toString()).build()
        assertEquals(uri, resolvePlaybackUri(fromMediaId))

        assertNull(resolvePlaybackUri(MediaItem.Builder().build()))
    }

    @Test
    fun `resolvePlaybackUri keeps local uri when present`() {
        val uri = Uri.parse("file:///sdcard/book.mp3")
        val item = MediaItem.Builder().setUri(uri).setMediaId("other").build()
        assertNotNull(item.localConfiguration)
        assertEquals(uri, resolvePlaybackUri(item))
    }
}
