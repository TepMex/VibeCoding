package com.tepmex.hsk4listening.data

import android.content.res.AssetManager
import kotlinx.serialization.json.Json

object QuestionCatalogLoader {
    private val json = Json {
        ignoreUnknownKeys = true
        isLenient = true
    }

    fun load(assets: AssetManager, path: String = "questions.json"): QuestionCatalog {
        val text = assets.open(path).bufferedReader().use { it.readText() }
        return parse(text)
    }

    fun parse(text: String): QuestionCatalog {
        val catalog = json.decodeFromString(QuestionCatalog.serializer(), text)
        require(catalog.questions.isNotEmpty()) { "Question catalog is empty" }
        catalog.questions.forEach { question ->
            require(question.options.isNotEmpty()) { "Question ${question.id} has no options" }
            require(question.correctIndex in question.options.indices) {
                "Question ${question.id} has invalid correct_index"
            }
        }
        return catalog
    }
}
