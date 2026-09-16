package xyz.zihan.aloai.ui.components

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog

@Composable
fun RedeemDialog(
    onRedeem: (String, (Boolean, String) -> Unit) -> Unit,
    onDismiss: () -> Unit
) {
    var code by remember { mutableStateOf("") }
    var isLoading by remember { mutableStateOf(false) }
    var message by remember { mutableStateOf<String?>(null) }
    var isSuccess by remember { mutableStateOf(false) }

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
                Text(
                    text = "প্রোমো / গিফট কোড রিডিম",
                    fontSize = 18.sp,
                    fontWeight = FontWeight.Bold,
                    color = Color.White
                )
                Text(
                    text = "আপনার ভাউচার বা প্রোমো কোড দিন প্ল্যান আপগ্রেড করতে",
                    fontSize = 12.sp,
                    color = Color(0xFF94A3B8),
                    modifier = Modifier.padding(top = 4.dp, bottom = 18.dp)
                )

                OutlinedTextField(
                    value = code,
                    onValueChange = {
                        code = it.uppercase()
                        message = null
                    },
                    placeholder = { Text("যেমন: PRO-ALO-2026") },
                    singleLine = true,
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier.fillMaxWidth()
                )

                if (message != null) {
                    Spacer(modifier = Modifier.height(10.dp))
                    Text(
                        text = message!!,
                        color = if (isSuccess) Color(0xFF34D399) else Color(0xFFEF4444),
                        fontSize = 13.sp
                    )
                }

                Spacer(modifier = Modifier.height(20.dp))

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    OutlinedButton(
                        onClick = onDismiss,
                        modifier = Modifier.weight(1f),
                        shape = RoundedCornerShape(12.dp)
                    ) {
                        Text("বাতিল", fontSize = 13.sp)
                    }

                    Button(
                        onClick = {
                            if (code.isBlank()) {
                                message = "দয়া করে কোড লিখুন"
                                isSuccess = false
                                return@Button
                            }
                            isLoading = true
                            message = null
                            onRedeem(code) { success, msg ->
                                isLoading = false
                                isSuccess = success
                                message = msg
                                if (success) {
                                    code = ""
                                }
                            }
                        },
                        enabled = !isLoading,
                        modifier = Modifier.weight(1f),
                        shape = RoundedCornerShape(12.dp),
                        colors = ButtonDefaults.buttonColors(
                            containerColor = Color(0xFF3B82F6),
                            contentColor = Color.White
                        )
                    ) {
                        if (isLoading) {
                            CircularProgressIndicator(
                                modifier = Modifier.size(16.dp),
                                color = Color.White,
                                strokeWidth = 2.dp
                            )
                        } else {
                            Text("সাবমিট", fontSize = 13.sp)
                        }
                    }
                }
            }
        }
    }
}
