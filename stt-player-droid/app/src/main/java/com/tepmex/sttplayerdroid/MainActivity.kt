package com.tepmex.sttplayerdroid

import android.os.Bundle
import android.os.Build
import android.Manifest
import androidx.activity.ComponentActivity
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.activity.viewModels
import androidx.core.app.ActivityCompat
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Audiotrack
import androidx.compose.material.icons.filled.BarChart
import androidx.compose.material.icons.filled.Description
import androidx.compose.material.icons.filled.History
import androidx.compose.material.icons.filled.Forward10
import androidx.compose.material.icons.filled.Pause
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.Replay10
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Slider
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.tepmex.sttplayerdroid.model.ModelState
import com.tepmex.sttplayerdroid.sync.SyncState
import com.tepmex.sttplayerdroid.ui.PlayerViewModel

class MainActivity : ComponentActivity() {
    private val viewModel by viewModels<PlayerViewModel>()
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        if (Build.VERSION.SDK_INT >= 33) {
            ActivityCompat.requestPermissions(this, arrayOf(Manifest.permission.POST_NOTIFICATIONS), 41)
        }
        setContent { MaterialTheme { SttPlayerScreen(viewModel) } }
    }
}

@Composable
private fun SttPlayerScreen(viewModel: PlayerViewModel) {
    val model by viewModel.modelState.collectAsState()
    when (val value = model) {
        ModelState.Checking -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { CircularProgressIndicator() }
        ModelState.Missing -> ModelInstallScreen(0, null, viewModel::installModel)
        is ModelState.Downloading -> ModelInstallScreen(value.progress, null, {})
        is ModelState.Error -> ModelInstallScreen(0, value.message, viewModel::retryModel)
        is ModelState.Ready -> PlayerContent(viewModel)
    }
}

@Composable
private fun ModelInstallScreen(progress: Int, error: String?, action: () -> Unit) {
    Column(
        Modifier.fillMaxSize().padding(32.dp).testTag("model_install"),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text("Локальное распознавание", style = MaterialTheme.typography.headlineSmall)
        Spacer(Modifier.height(12.dp))
        Text("Однократно загрузите Whisper Tiny (~41 МБ). После установки приложение работает полностью офлайн.")
        Spacer(Modifier.height(24.dp))
        if (progress > 0) {
            LinearProgressIndicator({ progress / 100f }, Modifier.fillMaxWidth())
            Text("$progress%", Modifier.padding(top = 8.dp))
        } else if (error != null) {
            Text(error, color = MaterialTheme.colorScheme.error)
            Button(action, Modifier.padding(top = 16.dp)) { Text("Повторить") }
        } else {
            Button(action) { Text("Установить модель") }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun PlayerContent(viewModel: PlayerViewModel) {
    val document by viewModel.document.collectAsState()
    val playback by viewModel.playback.collectAsState()
    val language by viewModel.language.collectAsState()
    val chapterId by viewModel.chapterId.collectAsState()
    val sync by viewModel.syncState.collectAsState()
    val localError by viewModel.error.collectAsState()
    val logs by viewModel.performanceLogs.collectAsState()
    val recentBooks by viewModel.recentBooks.collectAsState()
    val recentAudio by viewModel.recentAudio.collectAsState()
    var showLogs by remember { mutableStateOf(false) }
    var showRecent by remember { mutableStateOf(false) }
    var errorDialog by remember { mutableStateOf<String?>(null) }
    val snackbar = remember { SnackbarHostState() }
    val listState = rememberLazyListState()
    val clipboard = LocalClipboardManager.current
    val highlighted = (sync as? SyncState.Matched)?.result?.chunkId
    val chunks = document?.chunks.orEmpty()

    val bookPicker = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { it?.let(viewModel::openBook) }
    val audioPicker = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { it?.let(viewModel::openAudio) }
    LaunchedEffect(highlighted) {
        val index = chunks.indexOfFirst { it.id == highlighted }
        if (index >= 0) listState.animateScrollToItem(index)
    }
    LaunchedEffect(sync, localError) {
        when (val state = sync) {
            is SyncState.Error -> {
                errorDialog = state.message
                snackbar.showSnackbar(state.message.lineSequence().firstOrNull().orEmpty())
            }
            is SyncState.Matched -> snackbar.showSnackbar("Найдено за ${state.timing.totalMs} мс: «${state.transcript}»")
            else -> {
                val message = localError
                if (message != null) {
                    errorDialog = message
                    snackbar.showSnackbar(message.lineSequence().firstOrNull().orEmpty())
                }
            }
        }
    }

    if (errorDialog != null) {
        val details = errorDialog!!
        AlertDialog(
            onDismissRequest = { errorDialog = null; viewModel.clearMessage() },
            title = { Text("Ошибка") },
            text = {
                Column(Modifier.fillMaxWidth().height(360.dp)) {
                    Text(
                        details,
                        modifier = Modifier
                            .weight(1f)
                            .fillMaxWidth()
                            .verticalScroll(rememberScrollState())
                            .testTag("error_details"),
                        style = MaterialTheme.typography.bodySmall.copy(
                            fontFamily = FontFamily.Monospace,
                            fontSize = 11.sp,
                            lineHeight = 14.sp,
                        ),
                    )
                }
            },
            confirmButton = {
                TextButton({
                    clipboard.setText(AnnotatedString(details))
                }) { Text("Копировать") }
            },
            dismissButton = {
                TextButton({ errorDialog = null; viewModel.clearMessage() }) { Text("Закрыть") }
            },
        )
    }

    Scaffold(
        snackbarHost = { SnackbarHost(snackbar) },
        topBar = {
            Column {
                TopAppBar(
                    title = { Text(document?.title ?: "STT Player") },
                    actions = {
                        IconButton({ bookPicker.launch(arrayOf("text/plain", "text/html", "application/epub+zip", "application/xml", "text/xml")) }, Modifier.testTag("pick_book")) {
                            Icon(Icons.Default.Description, "Открыть книгу")
                        }
                        IconButton({ audioPicker.launch(arrayOf("audio/mpeg", "audio/mp3")) }, Modifier.testTag("pick_audio")) {
                            Icon(Icons.Default.Audiotrack, "Открыть MP3")
                        }
                        IconButton({ showLogs = !showLogs }) { Icon(Icons.Default.BarChart, "Журнал") }
                        Box {
                            IconButton({ showRecent = true }, Modifier.testTag("recent_files")) { Icon(Icons.Default.History, "Недавние файлы") }
                            DropdownMenu(showRecent, { showRecent = false }) {
                                if (recentBooks.isEmpty() && recentAudio.isEmpty()) {
                                    DropdownMenuItem({ Text("Недавних файлов нет") }, {}, enabled = false)
                                }
                                recentBooks.take(5).forEach { book ->
                                    DropdownMenuItem(
                                        text = { Text("Книга · ${book.title}") },
                                        onClick = { viewModel.openRecentBook(book.uri); showRecent = false },
                                    )
                                }
                                recentAudio.take(5).forEach { audio ->
                                    DropdownMenuItem(
                                        text = { Text("Аудио · ${audio.displayName}") },
                                        onClick = { viewModel.openRecentAudio(audio.uri); showRecent = false },
                                    )
                                }
                            }
                        }
                    },
                )
                BookOptions(document, language, chapterId, viewModel)
                AnimatedVisibility(showLogs) {
                    Column(Modifier.fillMaxWidth().background(MaterialTheme.colorScheme.surfaceVariant).padding(8.dp)) {
                        Text("Производительность", fontWeight = FontWeight.Bold)
                        logs.take(5).forEach { Text("${if (it.matched) "✓" else "×"} ${it.totalMs} мс · prep ${it.preprocessingMs} · init ${it.modelInitializationMs} · enc ${it.encodeMs} · dec ${it.decodeMs} · search ${it.searchMs}", style = MaterialTheme.typography.labelSmall) }
                    }
                }
            }
        },
        bottomBar = { PlayerBar(playback, sync, viewModel) },
    ) { padding ->
        if (document == null) {
            Box(Modifier.fillMaxSize().padding(padding), contentAlignment = Alignment.Center) { Text("Откройте книгу и MP3") }
        } else {
            LazyColumn(Modifier.fillMaxSize().padding(padding).testTag("book_text"), state = listState) {
                items(chunks, key = { it.id }) { chunk ->
                    Surface(
                        color = if (chunk.id == highlighted) MaterialTheme.colorScheme.primaryContainer else MaterialTheme.colorScheme.surface,
                        modifier = Modifier.fillMaxWidth().testTag("chunk_${chunk.id}"),
                    ) { Text(chunk.text, Modifier.padding(horizontal = 18.dp, vertical = 10.dp), style = MaterialTheme.typography.bodyLarge) }
                }
            }
        }
    }
}

@Composable
private fun BookOptions(document: BookDocument?, language: SttLanguage, chapterId: String?, viewModel: PlayerViewModel) {
    var languageMenu by remember { mutableStateOf(false) }
    var chapterMenu by remember { mutableStateOf(false) }
    Row(Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 4.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        Box {
            Button({ languageMenu = true }) { Text(language.displayName) }
            DropdownMenu(languageMenu, { languageMenu = false }) {
                SttLanguage.entries.forEach { item -> DropdownMenuItem({ Text(item.displayName) }, { viewModel.selectLanguage(item); languageMenu = false }) }
            }
        }
        if (!document?.chapters.isNullOrEmpty()) Box {
            val title = document?.chapters?.firstOrNull { it.id == chapterId }?.title ?: "Вся книга"
            Button({ chapterMenu = true }) { Text(title, maxLines = 1) }
            DropdownMenu(chapterMenu, { chapterMenu = false }) {
                DropdownMenuItem({ Text("Вся книга") }, { viewModel.selectChapter(null); chapterMenu = false })
                document!!.chapters.forEach { chapter -> DropdownMenuItem({ Text(chapter.title) }, { viewModel.selectChapter(chapter.id); chapterMenu = false }) }
            }
        }
    }
}

@Composable
private fun PlayerBar(playback: com.tepmex.sttplayerdroid.playback.PlaybackUiState, sync: SyncState, viewModel: PlayerViewModel) {
    Surface(shadowElevation = 8.dp) {
        Column(Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 6.dp)) {
            Text(playback.title.ifBlank { "MP3 не выбран" }, maxLines = 1)
            Slider(
                value = playback.positionMs.toFloat().coerceAtMost(playback.durationMs.toFloat()),
                onValueChange = { viewModel.seekTo(it.toLong()) },
                valueRange = 0f..playback.durationMs.coerceAtLeast(1).toFloat(),
                enabled = playback.durationMs > 0,
                modifier = Modifier.testTag("seek"),
            )
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceEvenly, verticalAlignment = Alignment.CenterVertically) {
                IconButton({ viewModel.seekBy(-15_000) }) { Icon(Icons.Default.Replay10, "Назад 15 секунд") }
                IconButton(viewModel::playPause, Modifier.testTag("play_pause")) { Icon(if (playback.isPlaying) Icons.Default.Pause else Icons.Default.PlayArrow, "Воспроизведение") }
                IconButton({ viewModel.seekBy(15_000) }) { Icon(Icons.Default.Forward10, "Вперёд 15 секунд") }
                Button(
                    viewModel::sync,
                    enabled = viewModel.canSync() && sync !is SyncState.Preparing && sync !is SyncState.Transcribing && sync !is SyncState.Searching,
                    modifier = Modifier.testTag("find_in_text"),
                ) {
                    if (sync is SyncState.Preparing || sync is SyncState.Transcribing || sync is SyncState.Searching) {
                        CircularProgressIndicator(Modifier.width(18.dp).height(18.dp), strokeWidth = 2.dp)
                    } else Text("Найти в тексте")
                }
            }
        }
    }
}
