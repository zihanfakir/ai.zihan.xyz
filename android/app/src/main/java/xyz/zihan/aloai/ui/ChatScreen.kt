package xyz.zihan.aloai.ui

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.widget.Toast
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.*
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.launch
import xyz.zihan.aloai.R
import xyz.zihan.aloai.data.ChatMessage
import xyz.zihan.aloai.ui.components.ModelPickerSheet
import xyz.zihan.aloai.ui.components.QuotaDialog
import xyz.zihan.aloai.ui.components.RedeemDialog
import java.text.SimpleDateFormat
import java.util.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ChatScreen(
    viewModel: ChatViewModel,
    isListeningVoice: Boolean = false,
    onStartVoiceInput: () -> Unit,
    onStopVoiceInput: () -> Unit,
    onSpeakText: (String) -> Unit,
    onLogout: () -> Unit
) {
    val context = LocalContext.current
    val coroutineScope = rememberCoroutineScope()
    val drawerState = rememberDrawerState(initialValue = DrawerValue.Closed)
    val listState = rememberLazyListState()

    val sessions by viewModel.sessions.collectAsState()
    val currentSession by viewModel.currentSession.collectAsState()
    val messages by viewModel.messages.collectAsState()
    val models by viewModel.models.collectAsState()
    val selectedModel by viewModel.selectedModel.collectAsState()
    val isStreaming by viewModel.isStreaming.collectAsState()
    val userData by viewModel.userData.collectAsState()
    val rateLimit by viewModel.rateLimitData.collectAsState()
    val userPlan by viewModel.userPlan.collectAsState()
    val errorMessage by viewModel.errorMessage.collectAsState()

    var inputText by remember { mutableStateOf("") }
    var showModelSheet by remember { mutableStateOf(false) }
    var showQuotaDialog by remember { mutableStateOf(false) }
    var showRedeemDialog by remember { mutableStateOf(false) }

    // Auto-scroll on new message or stream chunk
    LaunchedEffect(messages.size, messages.lastOrNull()?.content?.length) {
        if (messages.isNotEmpty()) {
            listState.animateScrollToItem(messages.size - 1)
        }
    }

    // Error toast
    LaunchedEffect(errorMessage) {
        errorMessage?.let {
            Toast.makeText(context, it, Toast.LENGTH_LONG).show()
            viewModel.clearError()
        }
    }

    ModalNavigationDrawer(
        drawerState = drawerState,
        drawerContent = {
            ModalDrawerSheet(
                drawerContainerColor = Color(0xFF121214),
                drawerContentColor = Color.White,
                modifier = Modifier.width(310.dp)
            ) {
                // Drawer Header
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(20.dp)
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        Image(
                            painter = painterResource(id = R.drawable.app_logo),
                            contentDescription = "Logo",
                            modifier = Modifier
                                .size(36.dp)
                                .clip(RoundedCornerShape(8.dp))
                        )
                        Column {
                            Text(
                                text = "Alokpoth AI",
                                fontSize = 18.sp,
                                fontWeight = FontWeight.Bold,
                                color = Color.White
                            )
                            Text(
                                text = "v1.1.0 Full Native",
                                fontSize = 11.sp,
                                color = Color(0xFF60A5FA)
                            )
                        }
                    }

                    Spacer(modifier = Modifier.height(16.dp))

                    // New Chat Button
                    Button(
                        onClick = {
                            viewModel.startNewChat()
                            coroutineScope.launch { drawerState.close() }
                        },
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(12.dp),
                        colors = ButtonDefaults.buttonColors(
                            containerColor = Color(0xFF2563EB),
                            contentColor = Color.White
                        )
                    ) {
                        Icon(Icons.Default.Add, contentDescription = null, modifier = Modifier.size(18.dp))
                        Spacer(modifier = Modifier.width(8.dp))
                        Text("নতুন চ্যাট", fontSize = 14.sp, fontWeight = FontWeight.SemiBold)
                    }
                }

                HorizontalDivider(color = Color(0xFF27272A))

                // Sessions List
                Text(
                    text = "চ্যাট হিস্ট্রি",
                    fontSize = 12.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = Color(0xFF94A3B8),
                    modifier = Modifier.padding(horizontal = 20.dp, vertical = 12.dp)
                )

                LazyColumn(
                    modifier = Modifier
                        .weight(1f)
                        .padding(horizontal = 12.dp),
                    verticalArrangement = Arrangement.spacedBy(4.dp)
                ) {
                    items(sessions) { session ->
                        val isSelected = session.id == currentSession?.id
                        val sdf = SimpleDateFormat("dd MMM, hh:mm a", Locale.getDefault())
                        val timeStr = sdf.format(Date(session.updatedAt))

                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(10.dp))
                                .background(
                                    if (isSelected) Color(0xFF27272A) else Color.Transparent
                                )
                                .clickable {
                                    viewModel.selectSession(session.id)
                                    coroutineScope.launch { drawerState.close() }
                                }
                                .padding(horizontal = 12.dp, vertical = 10.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Icon(
                                imageVector = Icons.Default.ChatBubbleOutline,
                                contentDescription = null,
                                tint = if (isSelected) Color(0xFF60A5FA) else Color(0xFF71717A),
                                modifier = Modifier.size(18.dp)
                            )
                            Spacer(modifier = Modifier.width(10.dp))
                            Column(modifier = Modifier.weight(1f)) {
                                Text(
                                    text = session.title,
                                    fontSize = 13.sp,
                                    fontWeight = if (isSelected) FontWeight.SemiBold else FontWeight.Normal,
                                    color = if (isSelected) Color.White else Color(0xFFE2E8F0),
                                    maxLines = 1
                                )
                                Text(
                                    text = timeStr,
                                    fontSize = 10.sp,
                                    color = Color(0xFF71717A)
                                )
                            }
                            IconButton(
                                onClick = { viewModel.deleteSession(session.id) },
                                modifier = Modifier.size(28.dp)
                            ) {
                                Icon(
                                    imageVector = Icons.Default.DeleteOutline,
                                    contentDescription = "Delete",
                                    tint = Color(0xFF71717A),
                                    modifier = Modifier.size(16.dp)
                                )
                            }
                        }
                    }
                }

                HorizontalDivider(color = Color(0xFF27272A))

                // User Profile Footer
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable { showQuotaDialog = true }
                        .padding(16.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Surface(
                        shape = CircleShape,
                        color = Color(0xFF3B82F6),
                        modifier = Modifier.size(40.dp)
                    ) {
                        Box(contentAlignment = Alignment.Center) {
                            Text(
                                text = (userData?.name?.firstOrNull()?.uppercase() ?: "U"),
                                color = Color.White,
                                fontWeight = FontWeight.Bold,
                                fontSize = 16.sp
                            )
                        }
                    }

                    Spacer(modifier = Modifier.width(10.dp))

                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            text = userData?.name?.ifBlank { "User" } ?: "User",
                            fontSize = 14.sp,
                            fontWeight = FontWeight.SemiBold,
                            color = Color.White,
                            maxLines = 1
                        )
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Surface(
                                color = when (userPlan) {
                                    "Max" -> Color(0xFFEAB308).copy(alpha = 0.2f)
                                    "Pro" -> Color(0xFF8B5CF6).copy(alpha = 0.2f)
                                    else -> Color(0xFF3B82F6).copy(alpha = 0.2f)
                                },
                                shape = RoundedCornerShape(4.dp)
                            ) {
                                Text(
                                    text = userPlan,
                                    fontSize = 10.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = when (userPlan) {
                                        "Max" -> Color(0xFFFDE047)
                                        "Pro" -> Color(0xFFA78BFA)
                                        else -> Color(0xFF60A5FA)
                                    },
                                    modifier = Modifier.padding(horizontal = 4.dp, vertical = 1.dp)
                                )
                            }
                        }
                    }

                    IconButton(
                        onClick = {
                            viewModel.logout {
                                onLogout()
                            }
                        }
                    ) {
                        Icon(
                            imageVector = Icons.Default.Logout,
                            contentDescription = "Logout",
                            tint = Color(0xFFEF4444)
                        )
                    }
                }
            }
        }
    ) {
        Scaffold(
            containerColor = Color(0xFF09090B),
            topBar = {
                TopAppBar(
                    colors = TopAppBarDefaults.topAppBarColors(
                        containerColor = Color(0xFF09090B),
                        titleContentColor = Color.White
                    ),
                    navigationIcon = {
                        IconButton(onClick = { coroutineScope.launch { drawerState.open() } }) {
                            Icon(Icons.Default.Menu, contentDescription = "Menu", tint = Color.White)
                        }
                    },
                    title = {
                        // Model Selector Pill
                        Surface(
                            color = Color(0xFF18181B),
                            shape = RoundedCornerShape(20.dp),
                            border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFF27272A)),
                            modifier = Modifier
                                .clickable { showModelSheet = true }
                                .padding(vertical = 4.dp)
                        ) {
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp)
                            ) {
                                Text(
                                    text = selectedModel.name,
                                    fontSize = 13.sp,
                                    fontWeight = FontWeight.Medium,
                                    color = Color.White
                                )
                                Spacer(modifier = Modifier.width(4.dp))
                                Icon(
                                    imageVector = Icons.Default.ArrowDropDown,
                                    contentDescription = null,
                                    tint = Color(0xFF94A3B8),
                                    modifier = Modifier.size(18.dp)
                                )
                            }
                        }
                    },
                    actions = {
                        // Quota badge
                        IconButton(onClick = { showQuotaDialog = true }) {
                            Icon(
                                imageVector = Icons.Default.Speed,
                                contentDescription = "Limits",
                                tint = Color(0xFF60A5FA)
                            )
                        }
                        // New Chat
                        IconButton(onClick = { viewModel.startNewChat() }) {
                            Icon(
                                imageVector = Icons.Default.Add,
                                contentDescription = "New Chat",
                                tint = Color.White
                            )
                        }
                    }
                )
            },
            bottomBar = {
                // Bottom Input Area
                Surface(
                    color = Color(0xFF09090B),
                    modifier = Modifier
                        .fillMaxWidth()
                        .navigationBarsPadding()
                        .imePadding()
                ) {
                    Column {
                        HorizontalDivider(color = Color(0xFF18181B))
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(horizontal = 12.dp, vertical = 8.dp),
                            verticalAlignment = Alignment.Bottom
                        ) {
                            // Voice Input Button
                            val voiceColor = if (isListeningVoice) Color(0xFFEF4444) else Color(0xFF71717A)
                            IconButton(
                                onClick = {
                                    if (isListeningVoice) onStopVoiceInput() else onStartVoiceInput()
                                },
                                modifier = Modifier
                                    .padding(bottom = 2.dp)
                                    .size(40.dp)
                                    .background(
                                        if (isListeningVoice) Color(0xFFEF4444).copy(alpha = 0.2f) else Color.Transparent,
                                        CircleShape
                                    )
                            ) {
                                Icon(
                                    imageVector = if (isListeningVoice) Icons.Default.MicOff else Icons.Default.Mic,
                                    contentDescription = "Voice",
                                    tint = voiceColor,
                                    modifier = Modifier.size(22.dp)
                                )
                            }

                            // Text Input Field
                            TextField(
                                value = inputText,
                                onValueChange = { inputText = it },
                                placeholder = {
                                    Text(
                                        if (isListeningVoice) "শুনছি... কথা বলুন..." else "একটি বার্তা লিখুন...",
                                        color = Color(0xFF71717A),
                                        fontSize = 14.sp
                                    )
                                },
                                maxLines = 5,
                                colors = TextFieldDefaults.colors(
                                    focusedContainerColor = Color(0xFF18181B),
                                    unfocusedContainerColor = Color(0xFF18181B),
                                    disabledContainerColor = Color(0xFF18181B),
                                    cursorColor = Color(0xFF3B82F6),
                                    focusedIndicatorColor = Color.Transparent,
                                    unfocusedIndicatorColor = Color.Transparent,
                                    focusedTextColor = Color.White,
                                    unfocusedTextColor = Color.White
                                ),
                                shape = RoundedCornerShape(20.dp),
                                modifier = Modifier
                                    .weight(1f)
                                    .padding(horizontal = 8.dp)
                                    .border(1.dp, Color(0xFF27272A), RoundedCornerShape(20.dp))
                            )

                            // Send or Stop Button
                            val canSend = inputText.isNotBlank() && !isStreaming
                            IconButton(
                                onClick = {
                                    if (isStreaming) {
                                        viewModel.stopStreaming()
                                    } else if (inputText.isNotBlank()) {
                                        viewModel.sendMessage(inputText)
                                        inputText = ""
                                    }
                                },
                                enabled = isStreaming || canSend,
                                modifier = Modifier
                                    .padding(bottom = 2.dp)
                                    .size(40.dp)
                                    .background(
                                        if (isStreaming) Color(0xFFEF4444)
                                        else if (canSend) Color(0xFF3B82F6)
                                        else Color(0xFF27272A),
                                        CircleShape
                                    )
                            ) {
                                if (isStreaming) {
                                    Icon(
                                        imageVector = Icons.Default.Stop,
                                        contentDescription = "Stop",
                                        tint = Color.White,
                                        modifier = Modifier.size(20.dp)
                                    )
                                } else {
                                    Icon(
                                        imageVector = Icons.Default.ArrowUpward,
                                        contentDescription = "Send",
                                        tint = if (canSend) Color.White else Color(0xFF71717A),
                                        modifier = Modifier.size(20.dp)
                                    )
                                }
                            }
                        }
                    }
                }
            }
        ) { paddingValues ->
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(paddingValues)
            ) {
                if (messages.isEmpty()) {
                    // Empty state welcome screen
                    EmptyChatWelcome(
                        onSelectPrompt = { prompt ->
                            inputText = prompt
                            viewModel.sendMessage(prompt)
                            inputText = ""
                        }
                    )
                } else {
                    LazyColumn(
                        state = listState,
                        modifier = Modifier
                            .fillMaxSize()
                            .padding(horizontal = 16.dp),
                        verticalArrangement = Arrangement.spacedBy(16.dp),
                        contentPadding = PaddingValues(vertical = 16.dp)
                    ) {
                        items(messages, key = { it.id }) { msg ->
                            if (msg.role == "user") {
                                UserMessageBubble(
                                    message = msg,
                                    onCopy = {
                                        copyToClipboard(context, msg.content)
                                    }
                                )
                            } else {
                                AssistantMessageBubble(
                                    message = msg,
                                    isStreamingThis = isStreaming && messages.lastOrNull()?.id == msg.id,
                                    onCopy = {
                                        copyToClipboard(context, msg.content)
                                    },
                                    onSpeak = {
                                        onSpeakText(msg.content)
                                    }
                                )
                            }
                        }
                    }
                }
            }
        }
    }

    // Dialogs
    if (showModelSheet) {
        ModelPickerSheet(
            models = models,
            selectedModel = selectedModel,
            userPlan = userPlan,
            onModelSelected = { viewModel.selectModel(it) },
            onDismiss = { showModelSheet = false }
        )
    }

    if (showQuotaDialog) {
        QuotaDialog(
            user = userData,
            rateLimit = rateLimit,
            userPlan = userPlan,
            onOpenRedeem = { showRedeemDialog = true },
            onDismiss = { showQuotaDialog = false }
        )
    }

    if (showRedeemDialog) {
        RedeemDialog(
            onRedeem = { code, callback ->
                viewModel.redeemCode(code, callback)
            },
            onDismiss = { showRedeemDialog = false }
        )
    }
}

@Composable
fun EmptyChatWelcome(onSelectPrompt: (String) -> Unit) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Image(
            painter = painterResource(id = R.drawable.app_logo),
            contentDescription = "Logo",
            modifier = Modifier
                .size(72.dp)
                .clip(RoundedCornerShape(16.dp))
        )
        Spacer(modifier = Modifier.height(16.dp))
        Text(
            text = "আজ আপনাকে কীভাবে সাহায্য করতে পারি?",
            fontSize = 20.sp,
            fontWeight = FontWeight.Bold,
            color = Color.White
        )
        Text(
            text = "প্রশ্ন করুন, কোড তৈরি করুন, বা যেকোনো বিষয় নিয়ে কথা বলুন",
            fontSize = 13.sp,
            color = Color(0xFF94A3B8),
            modifier = Modifier.padding(top = 6.dp, bottom = 28.dp)
        )

        val samplePrompts = listOf(
            "আমাকে একটি মজার ছোট গল্প বলো",
            "পাইথনে একটি সুন্দর ক্যালকুলেটর কোড লিখো",
            "কৃত্রিম বুদ্ধিমত্তা কী এবং এটি কীভাবে কাজ করে?",
            "দৈনিক পড়াশোনার একটি উপযুক্ত রুটিন বানিয়ে দাও"
        )

        samplePrompts.forEach { prompt ->
            Surface(
                color = Color(0xFF18181B),
                shape = RoundedCornerShape(12.dp),
                border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFF27272A)),
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(vertical = 4.dp)
                    .clickable { onSelectPrompt(prompt) }
            ) {
                Row(
                    modifier = Modifier.padding(horizontal = 16.dp, vertical = 12.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = prompt,
                        fontSize = 13.sp,
                        color = Color(0xFFE2E8F0),
                        modifier = Modifier.weight(1f)
                    )
                    Icon(
                        imageVector = Icons.Default.ArrowForward,
                        contentDescription = null,
                        tint = Color(0xFF60A5FA),
                        modifier = Modifier.size(16.dp)
                    )
                }
            }
        }
    }
}

@Composable
fun UserMessageBubble(message: ChatMessage, onCopy: () -> Unit) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.End
    ) {
        Column(horizontalAlignment = Alignment.End) {
            Surface(
                shape = RoundedCornerShape(topStart = 16.dp, topEnd = 4.dp, bottomStart = 16.dp, bottomEnd = 16.dp),
                color = Color(0xFF2563EB),
                modifier = Modifier.widthIn(max = 290.dp)
            ) {
                Text(
                    text = message.content,
                    fontSize = 14.sp,
                    color = Color.White,
                    modifier = Modifier.padding(horizontal = 14.dp, vertical = 10.dp)
                )
            }
            IconButton(
                onClick = onCopy,
                modifier = Modifier.size(24.dp).padding(top = 2.dp)
            ) {
                Icon(
                    imageVector = Icons.Default.ContentCopy,
                    contentDescription = "Copy",
                    tint = Color(0xFF64748B),
                    modifier = Modifier.size(12.dp)
                )
            }
        }
    }
}

@Composable
fun AssistantMessageBubble(
    message: ChatMessage,
    isStreamingThis: Boolean,
    onCopy: () -> Unit,
    onSpeak: () -> Unit
) {
    val context = LocalContext.current

    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.Start
    ) {
        Image(
            painter = painterResource(id = R.drawable.app_logo),
            contentDescription = "AI",
            modifier = Modifier
                .size(28.dp)
                .clip(CircleShape)
                .padding(top = 2.dp)
        )

        Spacer(modifier = Modifier.width(8.dp))

        Column(modifier = Modifier.weight(1f)) {
            // Model name badge
            Text(
                text = message.modelName ?: "Alo AI",
                fontSize = 11.sp,
                fontWeight = FontWeight.SemiBold,
                color = Color(0xFF60A5FA),
                modifier = Modifier.padding(bottom = 4.dp)
            )

            Surface(
                shape = RoundedCornerShape(topStart = 4.dp, topEnd = 16.dp, bottomStart = 16.dp, bottomEnd = 16.dp),
                color = Color(0xFF18181B),
                border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFF27272A)),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(modifier = Modifier.padding(14.dp)) {
                    if (message.content.isBlank() && isStreamingThis) {
                        PulsingDots()
                    } else {
                        RenderFormattedContent(
                            content = message.content,
                            onCopyCode = { code ->
                                copyToClipboard(context, code)
                            }
                        )
                    }
                }
            }

            // Action buttons row
            if (message.content.isNotBlank() && !isStreamingThis) {
                Row(
                    modifier = Modifier.padding(top = 4.dp),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    IconButton(onClick = onCopy, modifier = Modifier.size(28.dp)) {
                        Icon(
                            imageVector = Icons.Default.ContentCopy,
                            contentDescription = "Copy message",
                            tint = Color(0xFF94A3B8),
                            modifier = Modifier.size(14.dp)
                        )
                    }
                    IconButton(onClick = onSpeak, modifier = Modifier.size(28.dp)) {
                        Icon(
                            imageVector = Icons.Default.VolumeUp,
                            contentDescription = "Speak",
                            tint = Color(0xFF94A3B8),
                            modifier = Modifier.size(16.dp)
                        )
                    }
                }
            }
        }
    }
}

@Composable
fun RenderFormattedContent(content: String, onCopyCode: (String) -> Unit) {
    val parts = content.split("```")
    for (i in parts.indices) {
        val part = parts[i]
        if (i % 2 == 1) {
            // Code block
            val lines = part.trim().lines()
            val language = if (lines.isNotEmpty() && lines[0].matches(Regex("^[a-zA-Z0-9_-]+$"))) lines[0] else ""
            val codeBody = if (language.isNotEmpty()) lines.drop(1).joinToString("\n") else part.trim()

            Surface(
                color = Color(0xFF0F172A),
                shape = RoundedCornerShape(8.dp),
                border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFF334155)),
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(vertical = 6.dp)
            ) {
                Column {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .background(Color(0xFF1E293B))
                            .padding(horizontal = 10.dp, vertical = 4.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = language.ifBlank { "code" },
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Medium,
                            color = Color(0xFF94A3B8)
                        )
                        Text(
                            text = "কপি",
                            fontSize = 11.sp,
                            fontWeight = FontWeight.SemiBold,
                            color = Color(0xFF38BDF8),
                            modifier = Modifier
                                .clickable { onCopyCode(codeBody) }
                                .padding(4.dp)
                        )
                    }
                    Box(
                        modifier = Modifier
                            .horizontalScroll(rememberScrollState())
                            .padding(10.dp)
                    ) {
                        Text(
                            text = codeBody,
                            fontFamily = FontFamily.Monospace,
                            fontSize = 12.sp,
                            color = Color(0xFFE2E8F0)
                        )
                    }
                }
            }
        } else {
            // Regular text
            if (part.isNotBlank()) {
                Text(
                    text = part,
                    fontSize = 14.sp,
                    color = Color(0xFFF1F5F9),
                    lineHeight = 22.sp
                )
            }
        }
    }
}

@Composable
fun PulsingDots() {
    val infiniteTransition = rememberInfiniteTransition()
    val alpha by infiniteTransition.animateFloat(
        initialValue = 0.2f,
        targetValue = 1f,
        animationSpec = infiniteRepeatable(
            animation = tween(600, easing = LinearEasing),
            repeatMode = RepeatMode.Reverse
        )
    )

    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(4.dp)
    ) {
        repeat(3) {
            Box(
                modifier = Modifier
                    .size(8.dp)
                    .background(Color(0xFF3B82F6).copy(alpha = alpha), CircleShape)
            )
        }
    }
}

fun copyToClipboard(context: Context, text: String) {
    val clipboard = context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
    val clip = ClipData.newPlainText("Alo AI", text)
    clipboard.setPrimaryClip(clip)
    Toast.makeText(context, "কপি করা হয়েছে", Toast.LENGTH_SHORT).show()
}
