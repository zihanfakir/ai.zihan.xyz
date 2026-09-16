package xyz.zihan.aloai.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import xyz.zihan.aloai.api.RateLimitData
import xyz.zihan.aloai.api.UserData

@Composable
fun QuotaDialog(
    user: UserData?,
    rateLimit: RateLimitData?,
    userPlan: String,
    onOpenRedeem: () -> Unit,
    onDismiss: () -> Unit
) {
    Dialog(onDismissRequest = onDismiss) {
        Surface(
            shape = RoundedCornerShape(20.dp),
            color = Color(0xFF18181B),
            modifier = Modifier.fillMaxWidth()
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(24.dp)
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column {
                        Text(
                            text = user?.name?.ifBlank { "ব্যবহারকারী" } ?: "ব্যবহারকারী",
                            fontSize = 18.sp,
                            fontWeight = FontWeight.Bold,
                            color = Color.White
                        )
                        Text(
                            text = user?.email ?: "",
                            fontSize = 12.sp,
                            color = Color(0xFF94A3B8)
                        )
                    }

                    Surface(
                        color = when (userPlan) {
                            "Max" -> Color(0xFFEAB308).copy(alpha = 0.2f)
                            "Pro" -> Color(0xFF8B5CF6).copy(alpha = 0.2f)
                            else -> Color(0xFF3B82F6).copy(alpha = 0.2f)
                        },
                        shape = RoundedCornerShape(8.dp)
                    ) {
                        Text(
                            text = "$userPlan Plan",
                            color = when (userPlan) {
                                "Max" -> Color(0xFFFDE047)
                                "Pro" -> Color(0xFFA78BFA)
                                else -> Color(0xFF60A5FA)
                            },
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Bold,
                            modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp)
                        )
                    }
                }

                Spacer(modifier = Modifier.height(20.dp))
                HorizontalDivider(color = Color(0xFF27272A))
                Spacer(modifier = Modifier.height(20.dp))

                // Messages Quota
                val usedMsg = rateLimit?.used ?: 0
                val limitMsg = rateLimit?.limit ?: 10
                val percentMsg = if (limitMsg > 0) (usedMsg.toFloat() / limitMsg).coerceIn(0f, 1f) else 0f

                Text(
                    text = "বার্তা ব্যবহারের সীমা",
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Medium,
                    color = Color(0xFFCBD5E1)
                )
                Spacer(modifier = Modifier.height(6.dp))
                LinearProgressIndicator(
                    progress = { percentMsg },
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(8.dp),
                    color = if (percentMsg > 0.8f) Color(0xFFEF4444) else Color(0xFF3B82F6),
                    trackColor = Color(0xFF27272A),
                )
                Spacer(modifier = Modifier.height(4.dp))
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Text(
                        text = "ব্যবহৃত: $usedMsg / $limitMsg",
                        fontSize = 11.sp,
                        color = Color(0xFF94A3B8)
                    )
                    Text(
                        text = "অবশিষ্ট: ${rateLimit?.remaining ?: (limitMsg - usedMsg)}",
                        fontSize = 11.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = Color(0xFF38BDF8)
                    )
                }

                Spacer(modifier = Modifier.height(16.dp))

                // Images Quota
                val usedImg = rateLimit?.imageUsed ?: 0
                val limitImg = rateLimit?.imageLimit ?: 3
                val percentImg = if (limitImg > 0) (usedImg.toFloat() / limitImg).coerceIn(0f, 1f) else 0f

                Text(
                    text = "ছবি তৈরির সীমা",
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Medium,
                    color = Color(0xFFCBD5E1)
                )
                Spacer(modifier = Modifier.height(6.dp))
                LinearProgressIndicator(
                    progress = { percentImg },
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(8.dp),
                    color = Color(0xFF10B981),
                    trackColor = Color(0xFF27272A),
                )
                Spacer(modifier = Modifier.height(4.dp))
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Text(
                        text = "ব্যবহৃত: $usedImg / $limitImg",
                        fontSize = 11.sp,
                        color = Color(0xFF94A3B8)
                    )
                    Text(
                        text = "অবশিষ্ট: ${rateLimit?.imageRemaining ?: (limitImg - usedImg)}",
                        fontSize = 11.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = Color(0xFF34D399)
                    )
                }

                Spacer(modifier = Modifier.height(16.dp))
                val resetMins = rateLimit?.resetInMinutes ?: 180
                Text(
                    text = "🔄 পরবর্তী রিসেট: $resetMins মিনিট পর",
                    fontSize = 12.sp,
                    color = Color(0xFF94A3B8)
                )

                Spacer(modifier = Modifier.height(24.dp))

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    OutlinedButton(
                        onClick = {
                            onDismiss()
                            onOpenRedeem()
                        },
                        modifier = Modifier.weight(1f),
                        shape = RoundedCornerShape(12.dp),
                        colors = ButtonDefaults.outlinedButtonColors(
                            contentColor = Color(0xFF60A5FA)
                        )
                    ) {
                        Text("কোড রিডিম", fontSize = 13.sp)
                    }

                    Button(
                        onClick = onDismiss,
                        modifier = Modifier.weight(1f),
                        shape = RoundedCornerShape(12.dp),
                        colors = ButtonDefaults.buttonColors(
                            containerColor = Color(0xFF3B82F6),
                            contentColor = Color.White
                        )
                    ) {
                        Text("ঠিক আছে", fontSize = 13.sp)
                    }
                }
            }
        }
    }
}
