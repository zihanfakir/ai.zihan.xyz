package xyz.zihan.aloai.ui

import android.app.Application
import android.content.Context
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import xyz.zihan.aloai.api.*
import xyz.zihan.aloai.data.ChatMessage
import xyz.zihan.aloai.data.ChatSession
import xyz.zihan.aloai.data.SessionStorage

class ChatViewModel(application: Application) : AndroidViewModel(application) {
    private val context: Context get() = getApplication()
    private val sessionStorage = SessionStorage(context)
    private val prefs = context.getSharedPreferences("AloAiPrefs", Context.MODE_PRIVATE)

    private val _sessions = MutableStateFlow<List<ChatSession>>(emptyList())
    val sessions: StateFlow<List<ChatSession>> = _sessions.asStateFlow()

    private val _currentSession = MutableStateFlow<ChatSession?>(null)
    val currentSession: StateFlow<ChatSession?> = _currentSession.asStateFlow()

    private val _messages = MutableStateFlow<List<ChatMessage>>(emptyList())
    val messages: StateFlow<List<ChatMessage>> = _messages.asStateFlow()

    private val _models = MutableStateFlow<List<AiModelItem>>(
        listOf(
            AiModelItem(id = "hy3", name = "Alo HY3", premium = false, efficient = true),
            AiModelItem(id = "openai/gpt-oss-120b", name = "Alo Pro 120B", premium = true, efficient = false)
        )
    )
    val models: StateFlow<List<AiModelItem>> = _models.asStateFlow()

    private val _selectedModel = MutableStateFlow(
        AiModelItem(id = "hy3", name = "Alo HY3", premium = false, efficient = true)
    )
    val selectedModel: StateFlow<AiModelItem> = _selectedModel.asStateFlow()

    private val _isStreaming = MutableStateFlow(false)
    val isStreaming: StateFlow<Boolean> = _isStreaming.asStateFlow()

    private val _userData = MutableStateFlow<UserData?>(null)
    val userData: StateFlow<UserData?> = _userData.asStateFlow()

    private val _rateLimitData = MutableStateFlow<RateLimitData?>(null)
    val rateLimitData: StateFlow<RateLimitData?> = _rateLimitData.asStateFlow()

    private val _userPlan = MutableStateFlow("Free")
    val userPlan: StateFlow<String> = _userPlan.asStateFlow()

    private val _errorMessage = MutableStateFlow<String?>(null)
    val errorMessage: StateFlow<String?> = _errorMessage.asStateFlow()

    init {
        loadInitialData()
    }

    fun clearError() {
        _errorMessage.value = null
    }

    fun loadInitialData() {
        val token = prefs.getString("auth_token", null) ?: return
        val savedPlan = prefs.getString("user_plan", "Free") ?: "Free"
        val savedName = prefs.getString("user_name", "") ?: ""
        val savedEmail = prefs.getString("user_email", "") ?: ""
        _userPlan.value = savedPlan
        _userData.value = UserData(
            id = null,
            _id = null,
            name = savedName,
            email = savedEmail,
            role = if (savedPlan == "Max") "admin" else "user",
            avatar = null,
            subscription = SubscriptionData(plan_name = savedPlan, is_active = true, expires_at = null)
        )

        // Load sessions from disk
        val loadedSessions = sessionStorage.loadSessions()
        if (loadedSessions.isEmpty()) {
            val newSession = sessionStorage.createNewSession("নতুন চ্যাট")
            _sessions.value = listOf(newSession)
            _currentSession.value = newSession
            _messages.value = emptyList()
        } else {
            _sessions.value = loadedSessions
            val activeId = sessionStorage.getActiveSessionId()
            val activeSession = loadedSessions.find { it.id == activeId } ?: loadedSessions.first()
            _currentSession.value = activeSession
            _messages.value = activeSession.messages.toList()
        }

        // Fetch models & profile in parallel
        viewModelScope.launch {
            try {
                val modelResp = ApiClient.apiService.getModels()
                if (modelResp.isSuccessful && modelResp.body()?.success == true) {
                    val fetchedModels = modelResp.body()?.models ?: emptyList()
                    if (fetchedModels.isNotEmpty()) {
                        _models.value = fetchedModels
                        // Ensure current model is accessible
                        val current = _selectedModel.value
                        val exists = fetchedModels.find { it.id == current.id }
                        if (exists == null || (exists.premium == true && _userPlan.value == "Free")) {
                            val freeFallback = fetchedModels.find { it.premium != true } ?: fetchedModels.first()
                            _selectedModel.value = freeFallback
                        } else {
                            _selectedModel.value = exists
                        }
                    }
                }
            } catch (_: Exception) {}

            refreshUserProfile()
        }
    }

    fun refreshUserProfile() {
        val token = prefs.getString("auth_token", null) ?: return
        viewModelScope.launch {
            try {
                val userResp = ApiClient.apiService.getMe("Bearer $token")
                if (userResp.isSuccessful && userResp.body()?.success == true) {
                    val body = userResp.body()!!
                    body.user?.let { u ->
                        _userData.value = u
                        val plan = u.subscription?.plan_name ?: "Free"
                        _userPlan.value = plan
                        prefs.edit().putString("user_plan", plan).apply()
                    }
                    body.rateLimit?.let { rl ->
                        _rateLimitData.value = rl
                    }
                }
            } catch (_: Exception) {}
        }
    }

    fun selectModel(model: AiModelItem) {
        if (model.premium == true && _userPlan.value == "Free") {
            _errorMessage.value = "এই মডেলটি শুধুমাত্র Pro ও Max প্ল্যানের জন্য নির্ধারিত। অনুগ্রহ করে আপগ্রেড করুন।"
            return
        }
        _selectedModel.value = model
    }

    fun startNewChat() {
        val newSession = sessionStorage.createNewSession("নতুন চ্যাট")
        val updated = sessionStorage.loadSessions()
        _sessions.value = updated
        _currentSession.value = newSession
        _messages.value = emptyList()
    }

    fun selectSession(sessionId: String) {
        val session = _sessions.value.find { it.id == sessionId } ?: return
        sessionStorage.setActiveSessionId(session.id)
        _currentSession.value = session
        _messages.value = session.messages.toList()
    }

    fun deleteSession(sessionId: String) {
        sessionStorage.deleteSession(sessionId)
        val updated = sessionStorage.loadSessions()
        if (updated.isEmpty()) {
            val newSession = sessionStorage.createNewSession("নতুন চ্যাট")
            _sessions.value = listOf(newSession)
            _currentSession.value = newSession
            _messages.value = emptyList()
        } else {
            _sessions.value = updated
            if (_currentSession.value?.id == sessionId) {
                val next = updated.first()
                _currentSession.value = next
                _messages.value = next.messages.toList()
            }
        }
    }

    fun sendMessage(userText: String) {
        val trimmed = userText.trim()
        if (trimmed.isEmpty() || _isStreaming.value) return

        val token = prefs.getString("auth_token", null)
        if (token.isNullOrEmpty()) {
            _errorMessage.value = "লগইন সেশন পাওয়া যায়নি। অনুগ্রহ করে পুনরায় লগইন করুন।"
            return
        }

        // Quota check
        val rl = _rateLimitData.value
        if (rl != null && (rl.remaining ?: 1) <= 0) {
            _errorMessage.value = "আপনার প্ল্যানের বার্তা সীমা শেষ হয়েছে! পরবর্তী রিসেট পর্যন্ত অপেক্ষা করুন অথবা আপগ্রেড করুন।"
            return
        }

        val session = _currentSession.value ?: sessionStorage.createNewSession("নতুন চ্যাট")
        
        // Auto-update session title from first message
        if (session.messages.isEmpty()) {
            session.title = if (trimmed.length > 25) trimmed.take(25) + "..." else trimmed
        }

        val userMessage = ChatMessage(
            role = "user",
            content = trimmed,
            timestamp = System.currentTimeMillis()
        )
        session.messages.add(userMessage)
        sessionStorage.updateSession(session)

        val assistantMessage = ChatMessage(
            role = "assistant",
            content = "",
            timestamp = System.currentTimeMillis(),
            modelName = _selectedModel.value.name
        )
        session.messages.add(assistantMessage)
        
        _currentSession.value = session
        _messages.value = session.messages.toList()
        _isStreaming.value = true

        viewModelScope.launch {
            try {
                val modelName = _selectedModel.value.name
                val systemPrompt = "You are $modelName, an AI model built by Alokpoth AI (আলোকপথ). You must respond fluently and completely in Bengali (Bangla script), unless the user specifically asks for another language. Write complete, detailed, clean code and answers without cutting off."

                val messagePayloads = mutableListOf<ChatMessagePayload>()
                messagePayloads.add(ChatMessagePayload(role = "system", content = systemPrompt))

                // Send last 10 messages for context
                val recentMessages = session.messages.dropLast(1).takeLast(10)
                for (m in recentMessages) {
                    messagePayloads.add(ChatMessagePayload(role = m.role, content = m.content))
                }

                val request = ChatCompletionRequest(
                    model = _selectedModel.value.id,
                    messages = messagePayloads,
                    stream = true
                )

                ChatStreamManager.streamChat(token, request).collect { chunk ->
                    assistantMessage.content += chunk
                    _messages.value = session.messages.toList()
                }

                // Final save
                sessionStorage.updateSession(session)
                _sessions.value = sessionStorage.loadSessions()
                refreshUserProfile()
            } catch (e: Exception) {
                if (assistantMessage.content.isEmpty()) {
                    assistantMessage.content = "ত্রুটি: ${e.localizedMessage ?: e.message ?: "সার্ভার থেকে উত্তর পাওয়া যায়নি"}"
                    assistantMessage.isError = true
                }
                sessionStorage.updateSession(session)
                _messages.value = session.messages.toList()
                _errorMessage.value = e.localizedMessage ?: e.message
            } finally {
                _isStreaming.value = false
            }
        }
    }

    fun stopStreaming() {
        ChatStreamManager.stopStream()
        _isStreaming.value = false
        _currentSession.value?.let { sessionStorage.updateSession(it) }
    }

    fun redeemCode(code: String, onResult: (Boolean, String) -> Unit) {
        val token = prefs.getString("auth_token", null) ?: run {
            onResult(false, "লগইন করুন")
            return
        }
        viewModelScope.launch {
            try {
                val resp = ApiClient.apiService.claimRedeem("Bearer $token", RedeemRequest(code.trim()))
                if (resp.isSuccessful && resp.body()?.success == true) {
                    val body = resp.body()!!
                    val newPlan = body.plan ?: "Pro"
                    _userPlan.value = newPlan
                    prefs.edit().putString("user_plan", newPlan).apply()
                    refreshUserProfile()
                    onResult(true, body.message ?: "সফলভাবে আপগ্রেড হয়েছে!")
                } else {
                    val errorBody = resp.errorBody()?.string() ?: ""
                    val msg = try {
                        org.json.JSONObject(errorBody).optString("error", "রিডিম কোডটি সঠিক নয়")
                    } catch (_: Exception) {
                        "রিডিম কোডটি সঠিক নয়"
                    }
                    onResult(false, msg)
                }
            } catch (e: Exception) {
                onResult(false, "সার্ভার ত্রুটি: ${e.localizedMessage ?: e.message}")
            }
        }
    }

    fun logout(onComplete: () -> Unit) {
        prefs.edit().clear().apply()
        onComplete()
    }
}
