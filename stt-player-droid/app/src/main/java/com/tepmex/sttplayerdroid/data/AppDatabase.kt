package com.tepmex.sttplayerdroid.data

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase
import androidx.room.TypeConverter
import androidx.room.TypeConverters
import com.tepmex.sttplayerdroid.SttLanguage

class Converters {
    @TypeConverter fun fromLanguage(value: SttLanguage): String = value.code
    @TypeConverter fun toLanguage(value: String): SttLanguage =
        SttLanguage.entries.firstOrNull { it.code == value } ?: SttLanguage.English
}

@Database(
    entities = [BookEntity::class, AudioFileEntity::class, ChunkEntity::class,
        IndexMetadataEntity::class, PerformanceLogEntity::class],
    version = 1,
    exportSchema = true,
)
@TypeConverters(Converters::class)
abstract class AppDatabase : RoomDatabase() {
    abstract fun library(): LibraryDao
    abstract fun metadata(): MetadataDao

    companion object {
        fun create(context: Context): AppDatabase = Room.databaseBuilder(
            context.applicationContext,
            AppDatabase::class.java,
            "stt-player.db",
        ).fallbackToDestructiveMigration(dropAllTables = true).build()
    }
}

