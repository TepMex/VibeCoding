package com.tepmex.sttplayerdroid.data

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase
import androidx.room.TypeConverter
import androidx.room.TypeConverters
import androidx.room.migration.Migration
import androidx.sqlite.db.SupportSQLiteDatabase
import com.tepmex.sttplayerdroid.SttLanguage

class Converters {
    @TypeConverter fun fromLanguage(value: SttLanguage): String = value.code
    @TypeConverter fun toLanguage(value: String): SttLanguage =
        SttLanguage.entries.firstOrNull { it.code == value } ?: SttLanguage.English
}

@Database(
    entities = [
        BookEntity::class,
        AudioFileEntity::class,
        ChunkEntity::class,
        IndexMetadataEntity::class,
        PerformanceLogEntity::class,
        PlaybackEventEntity::class,
    ],
    version = 2,
    exportSchema = true,
)
@TypeConverters(Converters::class)
abstract class AppDatabase : RoomDatabase() {
    abstract fun library(): LibraryDao
    abstract fun metadata(): MetadataDao

    companion object {
        val MIGRATION_1_2 = object : Migration(1, 2) {
            override fun migrate(db: SupportSQLiteDatabase) {
                db.execSQL(
                    "ALTER TABLE audio_files ADD COLUMN lastPausedAt INTEGER NOT NULL DEFAULT 0",
                )
                db.execSQL(
                    "ALTER TABLE audio_files ADD COLUMN lastPlayedAt INTEGER NOT NULL DEFAULT 0",
                )
                db.execSQL("UPDATE audio_files SET lastPlayedAt = lastOpenedAt")
                db.execSQL(
                    "CREATE INDEX IF NOT EXISTS `index_audio_files_lastPlayedAt` ON `audio_files` (`lastPlayedAt`)",
                )
                db.execSQL(
                    """
                    CREATE TABLE IF NOT EXISTS `playback_events` (
                        `id` INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
                        `audioUri` TEXT NOT NULL,
                        `kind` TEXT NOT NULL,
                        `positionMs` INTEGER NOT NULL,
                        `createdAt` INTEGER NOT NULL
                    )
                    """.trimIndent(),
                )
                db.execSQL(
                    "CREATE INDEX IF NOT EXISTS `index_playback_events_audioUri_createdAt` " +
                        "ON `playback_events` (`audioUri`, `createdAt`)",
                )
            }
        }

        fun create(context: Context): AppDatabase = Room.databaseBuilder(
            context.applicationContext,
            AppDatabase::class.java,
            "stt-player.db",
        )
            .addMigrations(MIGRATION_1_2)
            .fallbackToDestructiveMigration(dropAllTables = true)
            .build()
    }
}
