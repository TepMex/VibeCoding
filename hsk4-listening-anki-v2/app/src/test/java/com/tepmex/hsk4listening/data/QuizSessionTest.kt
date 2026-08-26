package com.tepmex.hsk4listening.data

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import kotlin.random.Random

class QuizSessionTest {
    private val questions = listOf(
        question("a", 0, "今天天气很好。"),
        question("b", 1, "他们去植物园了。"),
        question("c", 2),
    )

    @Test
    fun `shuffles questions instead of source order`() {
        val many = (0 until 12).map { index ->
            question("q$index", index % 4, if (index == 0) "原文" else "")
        }
        val session = QuizSession(many, Random(7))
        assertEquals(12, session.state.total)
        assertEquals(session.state.questions.map { it.id }.toSet(), many.map { it.id }.toSet())
        assertNotEquals(many.map { it.id }, session.state.questions.map { it.id })
    }

    @Test
    fun `selecting an option reveals correct or incorrect without changing until next`() {
        val session = QuizSession(questions, Random(1))
        val current = session.state.current!!
        val wrong = if (current.correctIndex == 0) 1 else 0

        session.select(wrong)
        assertTrue(session.state.revealed)
        assertFalse(session.state.isCorrect)
        assertEquals(0, session.state.correctCount)

        session.select(current.correctIndex)
        assertEquals(wrong, session.state.selectedIndex)
        assertEquals(0, session.state.correctCount)
    }

    @Test
    fun `next advances and transcript is only meaningful after reveal`() {
        val session = QuizSession(questions, Random(2))
        val firstId = session.state.current!!.id
        session.select(session.state.current!!.correctIndex)
        assertTrue(session.state.current!!.hasTranscript)
        session.next()
        assertFalse(session.state.revealed)
        assertNotEquals(firstId, session.state.current!!.id)
        assertEquals(1, session.state.correctCount)
    }

    @Test
    fun `finishes after the last revealed question`() {
        val session = QuizSession(questions, Random(3))
        repeat(3) {
            session.select(session.state.current!!.correctIndex)
            session.next()
        }
        assertTrue(session.state.isFinished)
        assertEquals(3, session.state.correctCount)
    }

    @Test
    fun `parses catalog and keeps transcript hanzi`() {
        val catalog = QuestionCatalogLoader.parse(
            """
            {
              "questions": [
                {
                  "id": "hsk4-t01-q001",
                  "test_number": 1,
                  "question_number": 1,
                  "type": "listening_true_false",
                  "prompt": "他们去植物园了。",
                  "options": ["对", "错"],
                  "correct_index": 0,
                  "transcript": "今天天气非常好，我们去植物园了。",
                  "audio": "audio/hsk4-t01-q001.mp3"
                }
              ]
            }
            """.trimIndent(),
        )
        assertEquals(1, catalog.questions.size)
        assertEquals("今天天气非常好，我们去植物园了。", catalog.questions[0].transcript)
        assertEquals("对", catalog.questions[0].optionKey(0))
    }

    private fun question(id: String, correct: Int, transcript: String = ""): Question {
        return Question(
            id = id,
            testNumber = 1,
            questionNumber = id.hashCode().and(0xff),
            type = "listening_choice",
            prompt = "问题 $id",
            options = listOf("A", "B", "C", "D"),
            correctIndex = correct,
            transcript = transcript,
            audio = "audio/$id.mp3",
        )
    }
}
