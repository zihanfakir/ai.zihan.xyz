package xyz.zihan.aloai.api

import androidx.annotation.Keep
import com.google.gson.annotations.SerializedName
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.Header
import retrofit2.http.POST

@Keep
data class LoginRequest(
    @SerializedName("email") val email: String,
    @SerializedName("password") val password: String,
    @SerializedName("stay_signed_in") val stay_signed_in: Boolean = true
)

@Keep
data class RegisterRequest(
    @SerializedName("name") val name: String,
    @SerializedName("email") val email: String,
    @SerializedName("password") val password: String
)

@Keep
data class AuthResponse(
    @SerializedName("success") val success: Boolean,
    @SerializedName("message") val message: String?,
    @SerializedName("error") val error: String?,
    @SerializedName("token") val token: String?,
    @SerializedName("user") val user: UserData?
)

@Keep
data class UserData(
    @SerializedName("id") val id: String?,
    @SerializedName("_id") val _id: String?,
    @SerializedName("name") val name: String?,
    @SerializedName("email") val email: String?,
    @SerializedName("role") val role: String?,
    @SerializedName("avatar") val avatar: String?,
    @SerializedName("subscription") val subscription: SubscriptionData?
)

@Keep
data class SubscriptionData(
    @SerializedName("plan_name") val plan_name: String?,
    @SerializedName("is_active") val is_active: Boolean?,
    @SerializedName("expires_at") val expires_at: String?
)

@Keep
data class ChatMessagePayload(
    @SerializedName("role") val role: String,
    @SerializedName("content") val content: String
)

@Keep
data class ChatCompletionRequest(
    @SerializedName("model") val model: String,
    @SerializedName("messages") val messages: List<ChatMessagePayload>,
    @SerializedName("stream") val stream: Boolean = true
)

@Keep
data class AiModelItem(
    @SerializedName("id") val id: String,
    @SerializedName("name") val name: String,
    @SerializedName("provider") val provider: String? = "Alokpoth AI",
    @SerializedName("type") val type: String? = null,
    @SerializedName("premium") val premium: Boolean? = false,
    @SerializedName("efficient") val efficient: Boolean? = false,
    @SerializedName("order") val order: Int? = 0
)

@Keep
data class AiModelResponse(
    @SerializedName("success") val success: Boolean,
    @SerializedName("models") val models: List<AiModelItem>?,
    @SerializedName("error") val error: String?
)

@Keep
data class RateLimitData(
    @SerializedName("used") val used: Int? = 0,
    @SerializedName("limit") val limit: Int? = 10,
    @SerializedName("remaining") val remaining: Int? = 10,
    @SerializedName("imageUsed") val imageUsed: Int? = 0,
    @SerializedName("imageLimit") val imageLimit: Int? = 3,
    @SerializedName("imageRemaining") val imageRemaining: Int? = 3,
    @SerializedName("resetInMinutes") val resetInMinutes: Int? = 180,
    @SerializedName("windowHours") val windowHours: Int? = 3
)

@Keep
data class UserMeResponse(
    @SerializedName("success") val success: Boolean,
    @SerializedName("user") val user: UserData?,
    @SerializedName("rateLimit") val rateLimit: RateLimitData?,
    @SerializedName("error") val error: String?
)

@Keep
data class RedeemRequest(
    @SerializedName("code") val code: String
)

@Keep
data class RedeemResponse(
    @SerializedName("success") val success: Boolean,
    @SerializedName("message") val message: String?,
    @SerializedName("error") val error: String?,
    @SerializedName("plan") val plan: String?,
    @SerializedName("expires_at") val expires_at: String?
)

interface AloApi {
    @POST("api/auth/login")
    suspend fun login(@Body request: LoginRequest): Response<AuthResponse>

    @POST("api/auth/register")
    suspend fun register(@Body request: RegisterRequest): Response<AuthResponse>

    @GET("api/chat/models")
    suspend fun getModels(): Response<AiModelResponse>

    @GET("api/auth/me")
    suspend fun getMe(@Header("Authorization") token: String): Response<UserMeResponse>

    @POST("api/redeem/claim")
    suspend fun claimRedeem(
        @Header("Authorization") token: String,
        @Body request: RedeemRequest
    ): Response<RedeemResponse>
}
