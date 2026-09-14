package xyz.zihan.aloai.auth

import android.content.Context
import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.launch
import org.json.JSONObject
import xyz.zihan.aloai.MainActivity
import xyz.zihan.aloai.api.ApiClient
import xyz.zihan.aloai.api.AuthResponse
import xyz.zihan.aloai.api.LoginRequest
import xyz.zihan.aloai.api.RegisterRequest
import xyz.zihan.aloai.api.UserData

class AuthActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableHighRefreshRate()
        
        val prefs = getSharedPreferences("AloAiPrefs", Context.MODE_PRIVATE)
        if (prefs.getString("auth_token", null) != null) {
            startActivity(Intent(this, MainActivity::class.java))
            finish()
            return
        }

        setContent {
            MaterialTheme(
                colorScheme = darkColorScheme(
                    background = Color(0xFF09090B),
                    surface = Color(0xFF18181B),
                    primary = Color(0xFF3B82F6),
                    onPrimary = Color.White,
                    error = Color(0xFFEF4444)
                )
            ) {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = MaterialTheme.colorScheme.background
                ) {
                    AuthNavHost(onAuthSuccess = { authRes ->
                        val token = authRes.token ?: ""
                        val user = authRes.user
                        val plan = user?.subscription?.plan_name ?: (if (user?.email == "zihanfakir@gmail.com") "Max" else "Free")
                        
                        prefs.edit()
                            .putString("auth_token", token)
                            .putString("user_name", user?.name ?: "")
                            .putString("user_email", user?.email ?: "")
                            .putString("user_plan", plan)
                            .apply()
                        
                        startActivity(Intent(this@AuthActivity, MainActivity::class.java))
                        finish()
                    })
                }
            }
        }
    }

    private fun enableHighRefreshRate() {
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.M) {
            val display = windowManager.defaultDisplay
            val maxMode = display.supportedModes.maxByOrNull { it.refreshRate }
            maxMode?.let {
                window.attributes = window.attributes.apply {
                    preferredDisplayModeId = it.modeId
                }
            }
        }
    }
}

fun extractError(response: retrofit2.Response<*>): String {
    return try {
        val errorStr = response.errorBody()?.string()
        if (!errorStr.isNullOrBlank()) {
            val json = JSONObject(errorStr)
            json.optString("error", "অনুরোধটি সম্পন্ন করা যায়নি (${response.code()})")
        } else {
            "অনুরোধটি ব্যর্থ হয়েছে (${response.code()})"
        }
    } catch (e: Exception) {
        "সার্ভারের সাথে সংযোগে ত্রুটি (${response.code()})"
    }
}

@Composable
fun AuthNavHost(onAuthSuccess: (AuthResponse) -> Unit) {
    var isLoginMode by remember { mutableStateOf(true) }

    if (isLoginMode) {
        LoginScreen(
            onLoginSuccess = onAuthSuccess,
            onNavigateToRegister = { isLoginMode = false }
        )
    } else {
        RegisterScreen(
            onRegisterSuccess = onAuthSuccess,
            onNavigateToLogin = { isLoginMode = true }
        )
    }
}

@Composable
fun LoginScreen(onLoginSuccess: (AuthResponse) -> Unit, onNavigateToRegister: () -> Unit) {
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var isLoading by remember { mutableStateOf(false) }
    var errorMessage by remember { mutableStateOf<String?>(null) }
    val coroutineScope = rememberCoroutineScope()

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(24.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Text(
            text = "Alokpoth AI",
            fontSize = 28.sp,
            fontWeight = FontWeight.Bold,
            color = Color.White
        )
        Text(
            text = "আপনার অ্যাকাউন্টে লগইন করুন",
            fontSize = 14.sp,
            color = Color(0xFF94A3B8),
            modifier = Modifier.padding(top = 4.dp, bottom = 32.dp)
        )

        OutlinedTextField(
            value = email,
            onValueChange = { email = it },
            label = { Text("ইমেইল ঠিকানা") },
            placeholder = { Text("example@gmail.com") },
            singleLine = true,
            shape = RoundedCornerShape(12.dp),
            modifier = Modifier.fillMaxWidth()
        )
        Spacer(modifier = Modifier.height(16.dp))

        OutlinedTextField(
            value = password,
            onValueChange = { password = it },
            label = { Text("পাসওয়ার্ড") },
            singleLine = true,
            visualTransformation = PasswordVisualTransformation(),
            shape = RoundedCornerShape(12.dp),
            modifier = Modifier.fillMaxWidth()
        )
        Spacer(modifier = Modifier.height(16.dp))

        if (errorMessage != null) {
            Text(
                text = errorMessage!!,
                color = MaterialTheme.colorScheme.error,
                fontSize = 13.sp,
                modifier = Modifier.padding(bottom = 12.dp)
            )
        }

        Button(
            onClick = {
                if (email.isBlank() || password.isBlank()) {
                    errorMessage = "অনুগ্রহ করে ইমেইল এবং পাসওয়ার্ড দিন"
                    return@Button
                }
                isLoading = true
                errorMessage = null
                coroutineScope.launch {
                    try {
                        val response = ApiClient.apiService.login(LoginRequest(email.trim(), password.trim()))
                        if (response.isSuccessful && response.body()?.success == true && response.body()?.token != null) {
                            onLoginSuccess(response.body()!!)
                        } else {
                            errorMessage = extractError(response)
                        }
                    } catch (e: Exception) {
                        errorMessage = "সার্ভার সংযোগে ত্রুটি: ${e.localizedMessage ?: e.message}"
                    } finally {
                        isLoading = false
                    }
                }
            },
            shape = RoundedCornerShape(12.dp),
            modifier = Modifier
                .fillMaxWidth()
                .height(50.dp),
            enabled = !isLoading
        ) {
            if (isLoading) {
                CircularProgressIndicator(
                    color = Color.White,
                    modifier = Modifier.size(22.dp),
                    strokeWidth = 2.dp
                )
            } else {
                Text("লগইন করুন", fontSize = 16.sp, fontWeight = FontWeight.SemiBold)
            }
        }

        Spacer(modifier = Modifier.height(20.dp))
        TextButton(onClick = onNavigateToRegister) {
            Text(
                "কোনো অ্যাকাউন্ট নেই? নতুন তৈরি করুন",
                color = Color(0xFF60A5FA),
                fontSize = 14.sp
            )
        }
    }
}

@Composable
fun RegisterScreen(onRegisterSuccess: (AuthResponse) -> Unit, onNavigateToLogin: () -> Unit) {
    var name by remember { mutableStateOf("") }
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var isLoading by remember { mutableStateOf(false) }
    var errorMessage by remember { mutableStateOf<String?>(null) }
    val coroutineScope = rememberCoroutineScope()

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(24.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Text(
            text = "নতুন অ্যাকাউন্ট তৈরি করুন",
            fontSize = 26.sp,
            fontWeight = FontWeight.Bold,
            color = Color.White
        )
        Text(
            text = "Alokpoth AI-তে স্বাগতম",
            fontSize = 14.sp,
            color = Color(0xFF94A3B8),
            modifier = Modifier.padding(top = 4.dp, bottom = 28.dp)
        )

        OutlinedTextField(
            value = name,
            onValueChange = { name = it },
            label = { Text("আপনার নাম") },
            placeholder = { Text("যেমন: জিহাদ") },
            singleLine = true,
            shape = RoundedCornerShape(12.dp),
            modifier = Modifier.fillMaxWidth()
        )
        Spacer(modifier = Modifier.height(14.dp))

        OutlinedTextField(
            value = email,
            onValueChange = { email = it },
            label = { Text("ইমেইল ঠিকানা") },
            placeholder = { Text("example@gmail.com") },
            singleLine = true,
            shape = RoundedCornerShape(12.dp),
            modifier = Modifier.fillMaxWidth()
        )
        Spacer(modifier = Modifier.height(14.dp))

        OutlinedTextField(
            value = password,
            onValueChange = { password = it },
            label = { Text("পাসওয়ার্ড (কমপক্ষে ৬ অক্ষর)") },
            singleLine = true,
            visualTransformation = PasswordVisualTransformation(),
            shape = RoundedCornerShape(12.dp),
            modifier = Modifier.fillMaxWidth()
        )
        Spacer(modifier = Modifier.height(14.dp))

        if (errorMessage != null) {
            Text(
                text = errorMessage!!,
                color = MaterialTheme.colorScheme.error,
                fontSize = 13.sp,
                modifier = Modifier.padding(bottom = 12.dp)
            )
        }

        Button(
            onClick = {
                if (name.isBlank() || email.isBlank() || password.isBlank()) {
                    errorMessage = "সবগুলো ঘর সঠিকভাবে পূরণ করুন"
                    return@Button
                }
                if (password.trim().length < 6) {
                    errorMessage = "পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে"
                    return@Button
                }
                isLoading = true
                errorMessage = null
                coroutineScope.launch {
                    try {
                        val response = ApiClient.apiService.register(RegisterRequest(name.trim(), email.trim(), password.trim()))
                        if (response.isSuccessful && response.body()?.success == true && response.body()?.token != null) {
                            onRegisterSuccess(response.body()!!)
                        } else {
                            errorMessage = extractError(response)
                        }
                    } catch (e: Exception) {
                        errorMessage = "সার্ভার সংযোগে ত্রুটি: ${e.localizedMessage ?: e.message}"
                    } finally {
                        isLoading = false
                    }
                }
            },
            shape = RoundedCornerShape(12.dp),
            modifier = Modifier
                .fillMaxWidth()
                .height(50.dp),
            enabled = !isLoading
        ) {
            if (isLoading) {
                CircularProgressIndicator(
                    color = Color.White,
                    modifier = Modifier.size(22.dp),
                    strokeWidth = 2.dp
                )
            } else {
                Text("রেজিস্ট্রেশন সম্পূর্ণ করুন", fontSize = 16.sp, fontWeight = FontWeight.SemiBold)
            }
        }

        Spacer(modifier = Modifier.height(20.dp))
        TextButton(onClick = onNavigateToLogin) {
            Text(
                "ইতিমধ্যে অ্যাকাউন্ট আছে? লগইন করুন",
                color = Color(0xFF60A5FA),
                fontSize = 14.sp
            )
        }
    }
}
