package xyz.zihan.aloai.api

import com.google.gson.Gson
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.flow.flowOn
import okhttp3.Call
import okhttp3.Callback
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.Response
import org.json.JSONObject
import java.io.BufferedReader
import java.io.IOException
import java.io.InputStreamReader

object ChatStreamManager {
    private val gson = Gson()
    private val jsonMediaType = "application/json; charset=utf-8".toMediaType()
    private var activeCall: Call? = null

    fun stopStream() {
        try {
            activeCall?.cancel()
            activeCall = null
        } catch (_: Exception) {}
    }

    fun streamChat(
        token: String,
        requestPayload: ChatCompletionRequest
    ): Flow<String> = callbackFlow {
        val url = "${ApiClient.BASE_URL}api/chat/completions"
        val jsonString = gson.toJson(requestPayload)
        val body = jsonString.toRequestBody(jsonMediaType)

        val request = Request.Builder()
            .url(url)
            .post(body)
            .addHeader("Authorization", if (token.startsWith("Bearer ")) token else "Bearer $token")
            .addHeader("Accept", "text/event-stream")
            .addHeader("Cache-Control", "no-cache")
            .build()

        val call = ApiClient.okHttpClient.newCall(request)
        activeCall = call

        call.enqueue(object : Callback {
            override fun onFailure(call: Call, e: IOException) {
                if (!call.isCanceled()) {
                    close(Exception("সার্ভারের সাথে সংযোগ বিচ্ছিন্ন হয়েছে: ${e.localizedMessage ?: e.message}"))
                } else {
                    close()
                }
            }

            override fun onResponse(call: Call, response: Response) {
                if (!response.isSuccessful) {
                    val errorBody = response.body?.string() ?: ""
                    val errorMsg = try {
                        val json = JSONObject(errorBody)
                        json.optString("error", "অনুরোধটি ব্যর্থ হয়েছে (${response.code})")
                    } catch (_: Exception) {
                        "সার্ভার ত্রুটি (${response.code})"
                    }
                    close(Exception(errorMsg))
                    return
                }

                val responseBody = response.body
                if (responseBody == null) {
                    close(Exception("সার্ভার থেকে কোনো তথ্য আসেনি"))
                    return
                }

                try {
                    val reader = BufferedReader(InputStreamReader(responseBody.byteStream(), Charsets.UTF_8))
                    var line: String? = reader.readLine()
                    while (line != null) {
                        if (call.isCanceled()) break

                        val trimmed = line.trim()
                        if (trimmed.startsWith("data:")) {
                            val dataStr = trimmed.substring(5).trim()
                            if (dataStr == "[DONE]") {
                                break
                            }
                            if (dataStr.isNotEmpty()) {
                                try {
                                    val json = JSONObject(dataStr)
                                    if (json.has("error")) {
                                        close(Exception(json.getString("error")))
                                        return
                                    }
                                    val choices = json.optJSONArray("choices")
                                    if (choices != null && choices.length() > 0) {
                                        val firstChoice = choices.getJSONObject(0)
                                        val delta = firstChoice.optJSONObject("delta")
                                        val content = delta?.optString("content", "") ?: ""
                                        if (content.isNotEmpty()) {
                                            trySend(content)
                                        }
                                    }
                                } catch (_: Exception) {
                                    // Non-JSON delta or heartbeats
                                }
                            }
                        }
                        line = reader.readLine()
                    }
                    close()
                } catch (e: Exception) {
                    if (!call.isCanceled()) {
                        close(e)
                    } else {
                        close()
                    }
                } finally {
                    try { responseBody.close() } catch (_: Exception) {}
                    if (activeCall == call) activeCall = null
                }
            }
        })

        awaitClose {
            if (activeCall == call) {
                call.cancel()
                activeCall = null
            }
        }
    }.flowOn(Dispatchers.IO)
}
