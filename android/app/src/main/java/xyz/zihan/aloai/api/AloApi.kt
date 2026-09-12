package xyz.zihan.aloai.api

import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.POST

data class LoginRequest(val email: String, val password: String, val stay_signed_in: Boolean = true)
data class RegisterRequest(val name: String, val email: String, val password: String)

data class AuthResponse(
    val success: Boolean,
    val message: String?,
    val error: String?,
    val token: String?,
    val user: UserData?
)

data class UserData(
    val id: String?,
    val name: String?,
    val email: String?,
    val role: String?,
    val subscription: SubscriptionData?
)

data class SubscriptionData(
    val plan_name: String?,
    val is_active: Boolean?,
    val expires_at: String?
)

interface AloApi {
    @POST("api/auth/login")
    suspend fun login(@Body request: LoginRequest): Response<AuthResponse>

    @POST("api/auth/register")
    suspend fun register(@Body request: RegisterRequest): Response<AuthResponse>
}
