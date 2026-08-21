package com.tepmex.sttplayerdroid.sync

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import com.tepmex.sttplayerdroid.MainActivity
import com.tepmex.sttplayerdroid.R

/**
 * Public, expandable BigText notification for reading a found book fragment on the lock screen
 * without unlocking the device.
 */
class TextMatchNotifier(private val context: Context) {
    fun ensureChannel() {
        val manager = context.getSystemService(NotificationManager::class.java) ?: return
        val channel = NotificationChannel(
            CHANNEL_ID,
            context.getString(R.string.text_match_channel_name),
            NotificationManager.IMPORTANCE_DEFAULT,
        ).apply {
            description = context.getString(R.string.text_match_channel_description)
            setShowBadge(false)
            lockscreenVisibility = NotificationCompat.VISIBILITY_PUBLIC
        }
        manager.createNotificationChannel(channel)
    }

    fun showSearching(bookTitle: String?) {
        ensureChannel()
        val title = context.getString(R.string.text_match_searching_title)
        val body = bookTitle?.takeIf { it.isNotBlank() }
            ?: context.getString(R.string.text_match_searching_body)
        post(
            NotificationCompat.Builder(context, CHANNEL_ID)
                .setSmallIcon(R.drawable.ic_book)
                .setContentTitle(title)
                .setContentText(body)
                .setStyle(NotificationCompat.BigTextStyle().bigText(body).setBigContentTitle(title))
                .setOngoing(true)
                .setOnlyAlertOnce(true)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setCategory(NotificationCompat.CATEGORY_STATUS)
                .setContentIntent(openAppIntent())
                .setPriority(NotificationCompat.PRIORITY_DEFAULT),
        )
    }

    fun showMatch(bookTitle: String?, fragment: String) {
        ensureChannel()
        val title = bookTitle?.takeIf { it.isNotBlank() }
            ?: context.getString(R.string.text_match_found_title)
        val preview = MatchedTextPresenter.collapsedPreview(fragment)
        post(
            NotificationCompat.Builder(context, CHANNEL_ID)
                .setSmallIcon(R.drawable.ic_book)
                .setContentTitle(title)
                .setContentText(preview)
                .setStyle(
                    NotificationCompat.BigTextStyle()
                        .bigText(fragment)
                        .setBigContentTitle(title)
                        .setSummaryText(context.getString(R.string.text_match_expand_hint)),
                )
                .setOngoing(false)
                .setAutoCancel(true)
                .setOnlyAlertOnce(true)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setCategory(NotificationCompat.CATEGORY_MESSAGE)
                .setContentIntent(openAppIntent())
                .setPriority(NotificationCompat.PRIORITY_DEFAULT),
        )
    }

    fun showError(message: String) {
        ensureChannel()
        val title = context.getString(R.string.text_match_error_title)
        val body = message.lineSequence().firstOrNull().orEmpty().ifBlank { message }
        post(
            NotificationCompat.Builder(context, CHANNEL_ID)
                .setSmallIcon(R.drawable.ic_book)
                .setContentTitle(title)
                .setContentText(body)
                .setStyle(NotificationCompat.BigTextStyle().bigText(message).setBigContentTitle(title))
                .setOngoing(false)
                .setAutoCancel(true)
                .setOnlyAlertOnce(true)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setCategory(NotificationCompat.CATEGORY_ERROR)
                .setContentIntent(openAppIntent())
                .setPriority(NotificationCompat.PRIORITY_DEFAULT),
        )
    }

    private fun post(builder: NotificationCompat.Builder) {
        runCatching {
            NotificationManagerCompat.from(context).notify(NOTIFICATION_ID, builder.build())
        }
    }

    private fun openAppIntent(): PendingIntent {
        val intent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        return PendingIntent.getActivity(
            context,
            REQUEST_OPEN,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
    }

    companion object {
        const val CHANNEL_ID = "text_match"
        const val NOTIFICATION_ID = 42_017
        private const val REQUEST_OPEN = 42_018
    }
}
