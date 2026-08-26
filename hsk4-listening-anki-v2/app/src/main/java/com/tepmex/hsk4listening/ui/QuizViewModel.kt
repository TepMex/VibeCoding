package com.tepmex.hsk4listening.ui

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.tepmex.hsk4listening.audio.ClipPlayer
import com.tepmex.hsk4listening.data.QuestionCatalogLoader
import com.tepmex.hsk4listening.data.QuizSession
import com.tepmex.hsk4listening.data.QuizState
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

data class QuizUiState(
    val loading: Boolean = true,
    val error: String? = null,
    val quiz: QuizState = QuizState(questions = emptyList()),
    val showTranscript: Boolean = false,
    val playing: Boolean = false,
)

class QuizViewModel(application: Application) : AndroidViewModel(application) {
    private val player = ClipPlayer(application)
    private var session: QuizSession? = null

    private val mutableState = MutableStateFlow(QuizUiState())
    val state: StateFlow<QuizUiState> = mutableState.asStateFlow()

    init {
        viewModelScope.launch { load() }
    }

    private suspend fun load() {
        mutableState.value = QuizUiState(loading = true)
        runCatching {
            withContext(Dispatchers.IO) {
                QuestionCatalogLoader.load(getApplication<Application>().assets)
            }
        }.onSuccess { catalog ->
            val quiz = QuizSession(catalog.questions)
            session = quiz
            mutableState.value = QuizUiState(loading = false, quiz = quiz.state)
            playCurrent(replay = true)
        }.onFailure { error ->
            mutableState.value = QuizUiState(
                loading = false,
                error = error.message ?: "Не удалось загрузить задания",
            )
        }
    }

    fun select(optionIndex: Int) {
        val quiz = session ?: return
        mutableState.value = mutableState.value.copy(
            quiz = quiz.select(optionIndex),
            showTranscript = false,
        )
    }

    fun next() {
        val quiz = session ?: return
        val nextState = quiz.next()
        mutableState.value = mutableState.value.copy(
            quiz = nextState,
            showTranscript = false,
        )
        if (!nextState.isFinished) playCurrent(replay = true)
    }

    fun retry() {
        viewModelScope.launch { load() }
    }

    fun restart() {
        val quiz = session ?: return retry()
        mutableState.value = mutableState.value.copy(
            quiz = quiz.restart(),
            showTranscript = false,
        )
        playCurrent(replay = true)
    }

    fun toggleTranscript() {
        val current = mutableState.value
        if (!current.quiz.revealed) return
        mutableState.value = current.copy(showTranscript = !current.showTranscript)
    }

    fun playOrPause() {
        val current = mutableState.value.quiz.current ?: return
        if (player.isPlaying) {
            player.pause()
            mutableState.value = mutableState.value.copy(playing = false)
        } else {
            player.play(current.audio)
            mutableState.value = mutableState.value.copy(playing = true)
        }
    }

    fun replay() {
        playCurrent(replay = true)
    }

    private fun playCurrent(replay: Boolean) {
        val current = mutableState.value.quiz.current ?: return
        player.play(current.audio, replay = replay)
        mutableState.value = mutableState.value.copy(playing = true)
    }

    override fun onCleared() {
        player.release()
        super.onCleared()
    }
}
