package xyz.zihan.aloai

import android.Manifest
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import android.speech.tts.TextToSpeech
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.activity.viewModels
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.core.content.ContextCompat
import xyz.zihan.aloai.auth.AuthActivity
import xyz.zihan.aloai.ui.ChatScreen
import xyz.zihan.aloai.ui.ChatViewModel
import java.util.Locale

class MainActivity : ComponentActivity(), TextToSpeech.OnInitListener {

    private val chatViewModel: ChatViewModel by viewModels()
    private var textToSpeech: TextToSpeech? = null
    private var speechRecognizer: SpeechRecognizer? = null
    private var isListeningVoice by mutableStateOf(false)
    private var lastBackPressTime = 0L

    private val permissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { isGranted ->
        if (isGranted) {
            startListening()
        } else {
            Toast.makeText(this, "ভয়েস ইনপুটের জন্য মাইক্রোফোন অনুমতি প্রয়োজন", Toast.LENGTH_SHORT).show()
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableHighRefreshRate()

        // Verify native auth token
        val prefs = getSharedPreferences("AloAiPrefs", Context.MODE_PRIVATE)
        val token = prefs.getString("auth_token", null)
        if (token.isNullOrEmpty()) {
            startActivity(Intent(this, AuthActivity::class.java))
            finish()
            return
        }

        // Initialize Text to Speech
        textToSpeech = TextToSpeech(this, this)

        // Initialize Speech Recognizer
        if (SpeechRecognizer.isRecognitionAvailable(this)) {
            speechRecognizer = SpeechRecognizer.createSpeechRecognizer(this).apply {
                setRecognitionListener(object : RecognitionListener {
                    override fun onReadyForSpeech(params: Bundle?) {
                        isListeningVoice = true
                    }
                    override fun onBeginningOfSpeech() {}
                    override fun onRmsChanged(rmsdB: Float) {}
                    override fun onBufferReceived(buffer: ByteArray?) {}
                    override fun onEndOfSpeech() {
                        isListeningVoice = false
                    }
                    override fun onError(error: Int) {
                        isListeningVoice = false
                    }
                    override fun onResults(results: Bundle?) {
                        isListeningVoice = false
                        val matches = results?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
                        if (!matches.isNullOrEmpty()) {
                            val text = matches[0]
                            chatViewModel.sendMessage(text)
                        }
                    }
                    override fun onPartialResults(partialResults: Bundle?) {}
                    override fun onEvent(eventType: Int, params: Bundle?) {}
                })
            }
        }

        setContent {
            MaterialTheme(
                colorScheme = darkColorScheme(
                    background = Color(0xFF09090B),
                    surface = Color(0xFF18181B),
                    surfaceVariant = Color(0xFF27272A),
                    primary = Color(0xFF3B82F6),
                    onPrimary = Color.White,
                    error = Color(0xFFEF4444)
                )
            ) {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = MaterialTheme.colorScheme.background
                ) {
                    ChatScreen(
                        viewModel = chatViewModel,
                        isListeningVoice = isListeningVoice,
                        onStartVoiceInput = { checkMicPermissionAndListen() },
                        onStopVoiceInput = { stopListening() },
                        onSpeakText = { text -> speakOut(text) },
                        onLogout = {
                            val intent = Intent(this@MainActivity, AuthActivity::class.java).apply {
                                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
                            }
                            startActivity(intent)
                            finish()
                        }
                    )
                }
            }
        }
    }

    private fun checkMicPermissionAndListen() {
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) {
            startListening()
        } else {
            permissionLauncher.launch(Manifest.permission.RECORD_AUDIO)
        }
    }

    private fun startListening() {
        val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
            putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
            putExtra(RecognizerIntent.EXTRA_LANGUAGE, "bn-BD")
            putExtra(RecognizerIntent.EXTRA_LANGUAGE_PREFERENCE, "bn-BD")
            putExtra(RecognizerIntent.EXTRA_ONLY_RETURN_LANGUAGE_PREFERENCE, "bn-BD")
            putExtra(RecognizerIntent.EXTRA_PROMPT, "কথা বলুন...")
        }
        try {
            speechRecognizer?.startListening(intent)
            isListeningVoice = true
        } catch (_: Exception) {
            isListeningVoice = false
            Toast.makeText(this, "ভয়েস রিকগনিশন চালু করা যায়নি", Toast.LENGTH_SHORT).show()
        }
    }

    private fun stopListening() {
        try {
            speechRecognizer?.stopListening()
        } catch (_: Exception) {}
        isListeningVoice = false
    }

    override fun onInit(status: Int) {
        if (status == TextToSpeech.SUCCESS) {
            val result = textToSpeech?.setLanguage(Locale("bn", "BD"))
            if (result == TextToSpeech.LANG_MISSING_DATA || result == TextToSpeech.LANG_NOT_SUPPORTED) {
                textToSpeech?.setLanguage(Locale("bn", "IN"))
            }
        }
    }

    private fun speakOut(text: String) {
        if (text.isBlank()) return
        // Strip Markdown code blocks and tags before speaking
        val cleanText = text.replace(Regex("```[\\s\\S]*?```"), "")
            .replace(Regex("[#*_`\\[\\]]"), "")
            .trim()
        if (cleanText.isNotBlank()) {
            textToSpeech?.speak(cleanText, TextToSpeech.QUEUE_FLUSH, null, "AloAiTts")
        }
    }

    private fun enableHighRefreshRate() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            val currentDisplay = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                this.display
            } else {
                @Suppress("DEPRECATION")
                windowManager.defaultDisplay
            }
            val maxMode = currentDisplay?.supportedModes?.maxByOrNull { it.refreshRate }
            maxMode?.let {
                window.attributes = window.attributes.apply {
                    preferredDisplayModeId = it.modeId
                    preferredRefreshRate = it.refreshRate
                }
            }
        }
    }

    @Deprecated("Deprecated in Java")
    override fun onBackPressed() {
        val currentTime = System.currentTimeMillis()
        if (currentTime - lastBackPressTime < 2000L) {
            super.onBackPressed()
        } else {
            lastBackPressTime = currentTime
            Toast.makeText(this, "অ্যাপ থেকে বের হতে আবার চাপুন", Toast.LENGTH_SHORT).show()
        }
    }

    override fun onDestroy() {
        try {
            textToSpeech?.stop()
            textToSpeech?.shutdown()
            speechRecognizer?.destroy()
        } catch (_: Exception) {}
        super.onDestroy()
    }
}
