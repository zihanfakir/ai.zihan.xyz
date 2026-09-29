package xyz.zihan.aloai

import android.app.DownloadManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
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
            val vibrator = getVibratorService()
            if (vibrator != null && vibrator.hasVibrator()) {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    val effect = when {
                        milliseconds <= 15 -> VibrationEffect.createPredefined(VibrationEffect.EFFECT_TICK)
                        milliseconds <= 40 -> VibrationEffect.createPredefined(VibrationEffect.EFFECT_CLICK)
                        else -> VibrationEffect.createPredefined(VibrationEffect.EFFECT_HEAVY_CLICK)
                    }
                    vibrator.vibrate(effect)
                } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    vibrator.vibrate(VibrationEffect.createOneShot(milliseconds, VibrationEffect.DEFAULT_AMPLITUDE))
                } else {
                    @Suppress("DEPRECATION")
                    vibrator.vibrate(milliseconds)
                }
            }
        } catch (_: Exception) {}
    }

    @JavascriptInterface
    fun haptic(type: String?) {
        try {
            val vibrator = getVibratorService() ?: return
            if (!vibrator.hasVibrator()) return

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                val effect = when (type?.lowercase()) {
                    "light", "tick" -> VibrationEffect.createPredefined(VibrationEffect.EFFECT_TICK)
                    "heavy" -> VibrationEffect.createPredefined(VibrationEffect.EFFECT_HEAVY_CLICK)
                    else -> VibrationEffect.createPredefined(VibrationEffect.EFFECT_CLICK)
                }
                vibrator.vibrate(effect)
            } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                val ms = if (type == "heavy") 50L else 20L
                vibrator.vibrate(VibrationEffect.createOneShot(ms, VibrationEffect.DEFAULT_AMPLITUDE))
            } else {
                @Suppress("DEPRECATION")
                vibrator.vibrate(25L)
            }
        } catch (_: Exception) {}
    }

    private fun getVibratorService(): Vibrator? {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            val vibratorManager = activity.getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as? VibratorManager
            vibratorManager?.defaultVibrator
        } else {
            @Suppress("DEPRECATION")
            activity.getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator
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
    fun shareText(text: String?) {
        if (!text.isNullOrBlank()) {
            activity.runOnUiThread {
                try {
                    val sendIntent = Intent().apply {
                        action = Intent.ACTION_SEND
                        putExtra(Intent.EXTRA_TEXT, text)
                        type = "text/plain"
                    }
                    val shareIntent = Intent.createChooser(sendIntent, "Alo AI - Share")
                    activity.startActivity(shareIntent)
                } catch (_: Exception) {}
            }
        }
    }

    @JavascriptInterface
    fun downloadImage(url: String?, filename: String?) {
        if (url.isNullOrBlank()) return
        activity.runOnUiThread {
            try {
                val dm = activity.getSystemService(Context.DOWNLOAD_SERVICE) as? DownloadManager ?: return@runOnUiThread
                val uri = Uri.parse(url)
                val targetName = filename ?: "AloAI_Image_${System.currentTimeMillis()}.png"
                val request = DownloadManager.Request(uri)
                    .setTitle(targetName)
                    .setDescription("Alo AI Image Download")
                    .setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
                    .setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, targetName)
                    .setAllowedOverMetered(true)
                    .setAllowedOverRoaming(true)
                dm.enqueue(request)
                Toast.makeText(activity, "ছবি ডাউনলোড শুরু হয়েছে...", Toast.LENGTH_SHORT).show()
            } catch (e: Exception) {
                Toast.makeText(activity, "ডাউনলোড ব্যর্থ হয়েছে", Toast.LENGTH_SHORT).show()
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
    fun getAppVersion(): String = "1.1.0"
}
