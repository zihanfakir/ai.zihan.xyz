package xyz.zihan.aloai.data

import android.content.Context
import androidx.annotation.Keep
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import java.util.UUID

@Keep
data class ChatMessage(
    val id: String = UUID.randomUUID().toString(),
    val role: String, // "user", "assistant"
    var content: String,
    val timestamp: Long = System.currentTimeMillis(),
    val modelName: String? = null,
    var isError: Boolean = false
)

@Keep
data class ChatSession(
    val id: String = UUID.randomUUID().toString(),
    var title: String = "নতুন চ্যাট",
    val createdAt: Long = System.currentTimeMillis(),
    var updatedAt: Long = System.currentTimeMillis(),
    val messages: MutableList<ChatMessage> = mutableListOf()
)

class SessionStorage(context: Context) {
    private val prefs = context.getSharedPreferences("AloAiSessions", Context.MODE_PRIVATE)
    private val gson = Gson()
    private val sessionsKey = "saved_sessions_json"
    private val activeSessionKey = "active_session_id"

    fun loadSessions(): MutableList<ChatSession> {
        val json = prefs.getString(sessionsKey, null) ?: return mutableListOf()
        return try {
            val type = object : TypeToken<MutableList<ChatSession>>() {}.type
            gson.fromJson(json, type) ?: mutableListOf()
        } catch (_: Exception) {
            mutableListOf()
        }
    }

    fun saveSessions(sessions: List<ChatSession>) {
        try {
            val json = gson.toJson(sessions)
            prefs.edit().putString(sessionsKey, json).apply()
        } catch (_: Exception) {}
    }

    fun getActiveSessionId(): String? {
        return prefs.getString(activeSessionKey, null)
    }

    fun setActiveSessionId(sessionId: String) {
        prefs.edit().putString(activeSessionKey, sessionId).apply()
    }

    fun createNewSession(title: String = "নতুন চ্যাট"): ChatSession {
        val newSession = ChatSession(
            id = UUID.randomUUID().toString(),
            title = title,
            createdAt = System.currentTimeMillis(),
            updatedAt = System.currentTimeMillis(),
            messages = mutableListOf()
        )
        val sessions = loadSessions()
        sessions.add(0, newSession)
        saveSessions(sessions)
        setActiveSessionId(newSession.id)
        return newSession
    }

    fun deleteSession(sessionId: String) {
        val sessions = loadSessions()
        val filtered = sessions.filter { it.id != sessionId }
        saveSessions(filtered)
        if (getActiveSessionId() == sessionId) {
            if (filtered.isNotEmpty()) {
                setActiveSessionId(filtered[0].id)
            } else {
                prefs.edit().remove(activeSessionKey).apply()
            }
        }
    }

    fun updateSession(session: ChatSession) {
        val sessions = loadSessions()
        val index = sessions.indexOfFirst { it.id == session.id }
        if (index != -1) {
            session.updatedAt = System.currentTimeMillis()
            sessions[index] = session
            saveSessions(sessions)
        } else {
            sessions.add(0, session)
            saveSessions(sessions)
        }
    }
}
