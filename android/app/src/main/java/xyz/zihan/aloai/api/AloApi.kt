package xyz.zihan.aloai.api

import androidx.annotation.Keep
import com.google.gson.annotations.SerializedName
import retrofit2.Response
import retrofit2.http.Body
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
    @SerializedName("subscription") val subscription: SubscriptionData?
)

@Keep
data class SubscriptionData(
    @SerializedName("plan_name") val plan_name: String?,
    @SerializedName("is_active") val is_active: Boolean?,
    @SerializedName("expires_at") val expires_at: String?
)

interface AloApi {
    @POST("api/auth/login")
    suspend fun login(@Body request: LoginRequest): Response<AuthResponse>

    @POST("api/auth/register")
    suspend fun register(@Body request: RegisterRequest): Response<AuthResponse>
}
