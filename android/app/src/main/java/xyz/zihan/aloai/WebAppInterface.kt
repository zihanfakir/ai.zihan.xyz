package xyz.zihan.aloai

import android.content.Context
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import android.webkit.JavascriptInterface
import android.widget.Toast

class WebAppInterface(private val activity: MainActivity) {

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
    fun isNativeApp(): Boolean = true

    @JavascriptInterface
    fun getAppVersion(): String = "1.0.6"
}
