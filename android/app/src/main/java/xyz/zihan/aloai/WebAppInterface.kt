package xyz.zihan.aloai

import android.content.Context
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import android.speech.tts.TextToSpeech
import android.webkit.JavascriptInterface
import android.widget.Toast
import java.util.Locale

class WebAppInterface(private val activity: MainActivity) : TextToSpeech.OnInitListener {

    private var tts: TextToSpeech? = null
    private var isTtsInitialized = false

    init {
        try {
            tts = TextToSpeech(activity.applicationContext, this)
        } catch (_: Exception) {}
    }

    override fun onInit(status: Int) {
        if (status == TextToSpeech.SUCCESS) {
            isTtsInitialized = true
            try {
                val bnLocale = Locale("bn", "BD")
                val result = tts?.setLanguage(bnLocale)
                if (result == TextToSpeech.LANG_MISSING_DATA || result == TextToSpeech.LANG_NOT_SUPPORTED) {
                    tts?.setLanguage(Locale.US)
                }
            } catch (_: Exception) {}
        }
    }

    @JavascriptInterface
    fun speakText(text: String?, lang: String?): Boolean {
        if (text.isNullOrBlank()) return false
        val engine = tts ?: return false
        if (!isTtsInitialized) return false
        return try {
            val targetLocale = if (lang?.equals("en", ignoreCase = true) == true) {
                Locale.US
            } else {
                Locale("bn", "BD")
            }
            var langResult = engine.setLanguage(targetLocale)
            if (langResult == TextToSpeech.LANG_MISSING_DATA || langResult == TextToSpeech.LANG_NOT_SUPPORTED) {
                // Try Indian Bengali fallback
                langResult = engine.setLanguage(Locale("bn", "IN"))
                if (langResult == TextToSpeech.LANG_MISSING_DATA || langResult == TextToSpeech.LANG_NOT_SUPPORTED) {
                    // Native TTS lacks Bengali voice data on this device. Return false to trigger web audio fallback.
                    return false
                }
            }
            val speakResult = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                engine.speak(text, TextToSpeech.QUEUE_FLUSH, null, "AloAiTts_${System.currentTimeMillis()}")
            } else {
                @Suppress("DEPRECATION")
                engine.speak(text, TextToSpeech.QUEUE_FLUSH, null)
            }
            speakResult == TextToSpeech.SUCCESS
        } catch (_: Exception) {
            false
        }
    }

    @JavascriptInterface
    fun stopSpeech() {
        try {
            tts?.stop()
        } catch (_: Exception) {}
    }

    @JavascriptInterface
    fun isSpeaking(): Boolean {
        return try {
            tts?.isSpeaking == true
        } catch (_: Exception) {
            false
        }
    }

    fun destroy() {
        try {
            tts?.stop()
            tts?.shutdown()
        } catch (_: Exception) {}
        tts = null
        isTtsInitialized = false
    }

    @JavascriptInterface
    fun vibrate(milliseconds: Long) {
        try {
            val vibrator = activity.getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator
            if (vibrator != null && vibrator.hasVibrator()) {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    vibrator.vibrate(VibrationEffect.createOneShot(milliseconds, VibrationEffect.DEFAULT_AMPLITUDE))
                } else {
                    @Suppress("DEPRECATION")
                    vibrator.vibrate(milliseconds)
                }
            }
        } catch (_: Exception) {
        }
    }

    @JavascriptInterface
    fun showToast(message: String?) {
        if (!message.isNullOrBlank()) {
            activity.runOnUiThread {
                Toast.makeText(activity, message, Toast.LENGTH_SHORT).show()
            }
        }
    }

    @JavascriptInterface
    fun reload() {
        activity.runOnUiThread { activity.reloadWebView() }
    }

    @JavascriptInterface
    fun logout() {
        activity.runOnUiThread {
            activity.logoutAndGoToAuth()
        }
    }

    @JavascriptInterface
    fun saveAuth(token: String?, name: String?, email: String?, plan: String?) {
        if (!token.isNullOrBlank()) {
            val prefs = activity.getSharedPreferences("AloAiPrefs", Context.MODE_PRIVATE)
            prefs.edit()
                .putString("auth_token", token)
                .putString("user_name", name ?: "")
                .putString("user_email", email ?: "")
                .putString("user_plan", plan ?: "Free")
                .apply()
        }
    }

    @JavascriptInterface
    fun isNativeApp(): Boolean = true

    @JavascriptInterface
    fun getAppVersion(): String = "1.0.9"
}
