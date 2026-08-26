package com.tepmex.hsk4listening.data

import kotlin.random.Random

data class QuizState(
    val questions: List<Question>,
    val index: Int = 0,
    val selectedIndex: Int? = null,
    val revealed: Boolean = false,
    val correctCount: Int = 0,
    val answeredCount: Int = 0,
) {
    val total: Int get() = questions.size
    val current: Question? get() = questions.getOrNull(index)
    val isFinished: Boolean get() = questions.isNotEmpty() && index >= questions.size
    val isCorrect: Boolean get() = selectedIndex != null && selectedIndex == current?.correctIndex
    val progressLabel: String
        get() = if (isFinished) "$total / $total" else "${index + 1} / $total"
}

class QuizSession(
    questions: List<Question>,
    random: Random = Random.Default,
) {
    private val order = if (questions.isEmpty()) {
        emptyList()
    } else {
        questions.shuffled(random)
    }

    var state: QuizState = QuizState(questions = order)
        private set

    fun select(optionIndex: Int): QuizState {
        val current = state.current ?: return state
        if (state.revealed) return state
        if (optionIndex !in current.options.indices) return state
        val correct = optionIndex == current.correctIndex
        state = state.copy(
            selectedIndex = optionIndex,
            revealed = true,
            correctCount = state.correctCount + if (correct) 1 else 0,
            answeredCount = state.answeredCount + 1,
        )
        return state
    }

    fun next(): QuizState {
        if (!state.revealed || state.isFinished) return state
        state = state.copy(
            index = state.index + 1,
            selectedIndex = null,
            revealed = false,
        )
        return state
    }

    fun restart(random: Random = Random.Default): QuizState {
        state = QuizState(questions = order.shuffled(random))
        return state
    }
}
