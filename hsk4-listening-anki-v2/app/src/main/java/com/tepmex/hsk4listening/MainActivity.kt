package com.tepmex.hsk4listening

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.viewModels
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import com.tepmex.hsk4listening.ui.QuizApp
import com.tepmex.hsk4listening.ui.QuizViewModel

class MainActivity : ComponentActivity() {
    private val viewModel by viewModels<QuizViewModel>()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            HskTheme {
                QuizApp(viewModel)
            }
        }
    }
}

private val Accent = Color(0xFF176B52)
private val AccentSoft = Color(0xFFE3F2EC)
private val Correct = Color(0xFF137047)
private val CorrectSoft = Color(0xFFE1F4E9)
private val Wrong = Color(0xFFB33C34)
private val WrongSoft = Color(0xFFFAE7E4)
private val Paper = Color(0xFFF5F2EB)
private val SurfaceLight = Color(0xFFFFFDF8)
private val Ink = Color(0xFF17221D)

private val AccentDark = Color(0xFF62C5A1)
private val AccentSoftDark = Color(0xFF203D33)
private val CorrectDark = Color(0xFF73D6A5)
private val CorrectSoftDark = Color(0xFF203F30)
private val WrongDark = Color(0xFFFF9289)
private val WrongSoftDark = Color(0xFF492B2A)
private val PaperDark = Color(0xFF121815)
private val SurfaceDark = Color(0xFF1B2420)
private val InkDark = Color(0xFFEDF3EF)

@Composable
private fun HskTheme(content: @Composable () -> Unit) {
    val dark = isSystemInDarkTheme()
    val colors = if (dark) {
        darkColorScheme(
            primary = AccentDark,
            onPrimary = PaperDark,
            primaryContainer = AccentSoftDark,
            onPrimaryContainer = AccentDark,
            background = PaperDark,
            surface = SurfaceDark,
            onBackground = InkDark,
            onSurface = InkDark,
            tertiary = CorrectDark,
            tertiaryContainer = CorrectSoftDark,
            onTertiaryContainer = CorrectDark,
            error = WrongDark,
            errorContainer = WrongSoftDark,
            onErrorContainer = WrongDark,
        )
    } else {
        lightColorScheme(
            primary = Accent,
            onPrimary = Color.White,
            primaryContainer = AccentSoft,
            onPrimaryContainer = Accent,
            background = Paper,
            surface = SurfaceLight,
            onBackground = Ink,
            onSurface = Ink,
            tertiary = Correct,
            tertiaryContainer = CorrectSoft,
            onTertiaryContainer = Correct,
            error = Wrong,
            errorContainer = WrongSoft,
            onErrorContainer = Wrong,
        )
    }
    MaterialTheme(colorScheme = colors, content = content)
}
