package com.tepmex.hsk4listening.data

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class QuestionCatalog(
    @SerialName("source_repository") val sourceRepository: String = "",
    @SerialName("source_commit") val sourceCommit: String = "",
    @SerialName("source_license") val sourceLicense: String = "",
    @SerialName("included_cards") val includedCards: Int = 0,
    val questions: List<Question> = emptyList(),
)

@Serializable
data class Question(
    val id: String,
    @SerialName("test_number") val testNumber: Int,
    @SerialName("test_title") val testTitle: String = "",
    @SerialName("question_number") val questionNumber: Int,
    val type: String,
    val prompt: String = "",
    val options: List<String>,
    @SerialName("correct_index") val correctIndex: Int,
    val transcript: String = "",
    val audio: String,
    val source: String = "",
    @SerialName("source_url") val sourceUrl: String = "",
) {
    val isTrueFalse: Boolean get() = type == "listening_true_false"
    val hasTranscript: Boolean get() = transcript.isNotBlank()

    fun optionKey(index: Int): String {
        if (isTrueFalse) {
            return if (index == 0) "对" else "错"
        }
        return ('A' + index).toString()
    }
}
