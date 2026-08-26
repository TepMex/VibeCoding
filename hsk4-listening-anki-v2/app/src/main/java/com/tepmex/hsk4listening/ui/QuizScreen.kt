package com.tepmex.hsk4listening.ui

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Pause
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.Replay
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.tepmex.hsk4listening.data.Question

@Composable
fun QuizApp(viewModel: QuizViewModel) {
    val state by viewModel.state.collectAsState()
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
            .statusBarsPadding()
            .navigationBarsPadding(),
    ) {
        when {
            state.loading -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(modifier = Modifier.testTag("loading"))
            }
            state.error != null -> ErrorPane(state.error!!, onRetry = viewModel::retry)
            state.quiz.isFinished -> FinishedPane(
                correct = state.quiz.correctCount,
                total = state.quiz.total,
                onRestart = viewModel::restart,
            )
            state.quiz.current != null -> QuestionPane(
                ui = state,
                onSelect = viewModel::select,
                onNext = viewModel::next,
                onPlayPause = viewModel::playOrPause,
                onReplay = viewModel::replay,
                onToggleTranscript = viewModel::toggleTranscript,
            )
        }
    }
}

@Composable
private fun ErrorPane(message: String, onRetry: () -> Unit) {
    Column(
        Modifier.fillMaxSize().padding(24.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text(message, color = MaterialTheme.colorScheme.error, textAlign = TextAlign.Center)
        Spacer(Modifier.height(16.dp))
        Button(onRetry) { Text("Повторить") }
    }
}

@Composable
private fun FinishedPane(correct: Int, total: Int, onRestart: () -> Unit) {
    Column(
        Modifier
            .fillMaxSize()
            .padding(24.dp)
            .testTag("finished"),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text("Сессия завершена", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
        Spacer(Modifier.height(8.dp))
        Text("$correct из $total верно", color = MaterialTheme.colorScheme.onSurfaceVariant)
        Spacer(Modifier.height(24.dp))
        Button(onRestart, modifier = Modifier.testTag("restart")) { Text("Ещё раз, в новом порядке") }
    }
}

@Composable
private fun QuestionPane(
    ui: QuizUiState,
    onSelect: (Int) -> Unit,
    onNext: () -> Unit,
    onPlayPause: () -> Unit,
    onReplay: () -> Unit,
    onToggleTranscript: () -> Unit,
) {
    val question = ui.quiz.current ?: return
    Column(
        Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 16.dp, vertical = 12.dp),
    ) {
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            Surface(
                color = MaterialTheme.colorScheme.primaryContainer,
                shape = RoundedCornerShape(999.dp),
            ) {
                Text(
                    "HSK 4 · 听力",
                    modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp),
                    color = MaterialTheme.colorScheme.primary,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Bold,
                )
            }
            Text(
                "Test ${question.testNumber.toString().padStart(2, '0')} · № ${question.questionNumber}",
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                fontSize = 13.sp,
            )
        }
        Text(
            ui.quiz.progressLabel,
            modifier = Modifier.padding(top = 6.dp).testTag("progress"),
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            fontSize = 13.sp,
        )
        Spacer(Modifier.height(16.dp))
        AudioBar(playing = ui.playing, onPlayPause = onPlayPause, onReplay = onReplay)
        Text(
            if (question.isTrueFalse) {
                "听录音，然后判断正误"
            } else {
                "听录音，选择正确答案"
            },
            modifier = Modifier.padding(top = 16.dp),
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            fontSize = 13.sp,
        )
        if (question.prompt.isNotBlank()) {
            Text(
                question.prompt,
                modifier = Modifier.padding(top = 10.dp).testTag("prompt"),
                style = MaterialTheme.typography.headlineSmall,
                fontWeight = FontWeight.SemiBold,
                lineHeight = 32.sp,
            )
        }
        Spacer(Modifier.height(16.dp))
        question.options.forEachIndexed { index, option ->
            OptionButton(
                question = question,
                index = index,
                text = option,
                selectedIndex = ui.quiz.selectedIndex,
                revealed = ui.quiz.revealed,
                onSelect = onSelect,
            )
            Spacer(Modifier.height(10.dp))
        }
        AnimatedVisibility(ui.quiz.revealed) {
            Column {
                ResultBanner(correct = ui.quiz.isCorrect)
                if (question.hasTranscript) {
                    TextButton(
                        onToggleTranscript,
                        modifier = Modifier.testTag("toggle_transcript"),
                    ) {
                        Text(if (ui.showTranscript) "Скрыть транскрипт" else "Показать транскрипт · 听力原文")
                    }
                    AnimatedVisibility(ui.showTranscript) {
                        TranscriptCard(question.transcript)
                    }
                }
                Button(
                    onNext,
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(top = 8.dp)
                        .testTag("next"),
                    colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.primary),
                ) {
                    Text(if (ui.quiz.index + 1 >= ui.quiz.total) "Завершить" else "Следующий вопрос")
                }
                Text(
                    "Mandarin Zone · CC BY-NC-SA 4.0",
                    modifier = Modifier.padding(top = 8.dp, bottom = 16.dp),
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    fontSize = 11.sp,
                )
            }
        }
    }
}

@Composable
private fun AudioBar(playing: Boolean, onPlayPause: () -> Unit, onReplay: () -> Unit) {
    Surface(
        modifier = Modifier.fillMaxWidth().testTag("audio_bar"),
        shape = RoundedCornerShape(16.dp),
        color = MaterialTheme.colorScheme.surface,
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
    ) {
        Row(
            Modifier.padding(horizontal = 12.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween,
        ) {
            Text("Аудио", color = MaterialTheme.colorScheme.onSurfaceVariant)
            Row {
                IconButton(onReplay, modifier = Modifier.testTag("replay")) {
                    Icon(Icons.Default.Replay, contentDescription = "Повторить аудио")
                }
                IconButton(onPlayPause, modifier = Modifier.testTag("play_pause")) {
                    Icon(
                        if (playing) Icons.Default.Pause else Icons.Default.PlayArrow,
                        contentDescription = if (playing) "Пауза" else "Воспроизведение",
                    )
                }
            }
        }
    }
}

@Composable
private fun OptionButton(
    question: Question,
    index: Int,
    text: String,
    selectedIndex: Int?,
    revealed: Boolean,
    onSelect: (Int) -> Unit,
) {
    val isCorrect = index == question.correctIndex
    val isSelected = selectedIndex == index
    val colors = when {
        revealed && isCorrect -> MaterialTheme.colorScheme.tertiaryContainer to MaterialTheme.colorScheme.onTertiaryContainer
        revealed && isSelected && !isCorrect -> MaterialTheme.colorScheme.errorContainer to MaterialTheme.colorScheme.onErrorContainer
        isSelected -> MaterialTheme.colorScheme.primaryContainer to MaterialTheme.colorScheme.onPrimaryContainer
        else -> MaterialTheme.colorScheme.surface to MaterialTheme.colorScheme.onSurface
    }
    val border = when {
        revealed && isCorrect -> MaterialTheme.colorScheme.tertiary
        revealed && isSelected && !isCorrect -> MaterialTheme.colorScheme.error
        isSelected -> MaterialTheme.colorScheme.primary
        else -> MaterialTheme.colorScheme.outlineVariant
    }
    Surface(
        onClick = { onSelect(index) },
        enabled = !revealed,
        modifier = Modifier
            .fillMaxWidth()
            .testTag("option_$index")
            .semantics {
                role = Role.Button
                selected = isSelected
            },
        shape = RoundedCornerShape(14.dp),
        color = colors.first,
        border = BorderStroke(1.5.dp, border),
    ) {
        Row(
            Modifier.padding(horizontal = 12.dp, vertical = 14.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Box(
                Modifier
                    .size(28.dp)
                    .background(MaterialTheme.colorScheme.background, CircleShape),
                contentAlignment = Alignment.Center,
            ) {
                Text(question.optionKey(index), fontSize = 12.sp, fontWeight = FontWeight.Bold)
            }
            Text(text, style = MaterialTheme.typography.bodyLarge)
        }
    }
}

@Composable
private fun ResultBanner(correct: Boolean) {
    Text(
        if (correct) "✓ Верно" else "✕ Неверно",
        modifier = Modifier
            .padding(top = 4.dp, bottom = 4.dp)
            .testTag("result"),
        color = if (correct) MaterialTheme.colorScheme.tertiary else MaterialTheme.colorScheme.error,
        fontWeight = FontWeight.Bold,
        fontSize = 18.sp,
    )
}

@Composable
private fun TranscriptCard(text: String) {
    Surface(
        modifier = Modifier
            .fillMaxWidth()
            .padding(bottom = 8.dp)
            .testTag("transcript"),
        shape = RoundedCornerShape(14.dp),
        color = MaterialTheme.colorScheme.surface,
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
    ) {
        Column(Modifier.padding(14.dp)) {
            Text("听力原文", color = MaterialTheme.colorScheme.primary, fontWeight = FontWeight.Bold)
            Text(
                text,
                modifier = Modifier.padding(top = 8.dp),
                style = MaterialTheme.typography.bodyLarge,
                lineHeight = 28.sp,
            )
        }
    }
}
