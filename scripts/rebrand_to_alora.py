import os

replacements = {
    'index.html': [
        ('<title>Alokpoth</title>', '<title>Alora</title>'),
        ('alt="Alokpoth"', 'alt="Alora"'),
        ('<span>Alokpoth</span>', '<span>Alora</span>'),
        ('alt="Alokpoth App Logo"', 'alt="Alora App Logo"'),
        ('Alokpoth Mobile (Android &amp; iOS)', 'Alora Mobile (Android &amp; iOS)'),
        ('<div style="font-size: 1.25rem; font-weight: 700; color: var(--text-main);">Alokpoth</div>', '<div style="font-size: 1.25rem; font-weight: 700; color: var(--text-main);">Alora</div>'),
        ('alt="Alokpoth Logo"', 'alt="Alora Logo"'),
        ('placeholder="Ask Alokpoth..."', 'placeholder="Ask Alora..."'),
        (': (isEn ? "Ask Alokpoth anything..." : "আলোকপথ AI-কে জিজ্ঞাসা করুন..."));', ': (isEn ? "Ask Alora anything..." : "Alora AI-কে জিজ্ঞাসা করুন..."));'),
        ('userInputEl.placeholder = isCurrentEn ? "Ask Alokpoth anything..." : "আলোকপথ AI-কে জিজ্ঞাসা করুন...";', 'userInputEl.placeholder = isCurrentEn ? "Ask Alora anything..." : "Alora AI-কে জিজ্ঞাসা করুন...";'),
        ('appBrand: "Alokpoth",', 'appBrand: "Alora",'),
        ('drawerNoChatsSub: "আপনার Alokpoth-এর সাথে চ্যাট এখানে প্রদর্শিত হবে।",', 'drawerNoChatsSub: "আপনার Alora-এর সাথে চ্যাট এখানে প্রদর্শিত হবে।",'),
        ('inputPlaceholder: "আলোকপথ AI-কে জিজ্ঞাসা করুন...",', 'inputPlaceholder: "Alora AI-কে জিজ্ঞাসা করুন...",'),
        ('footerDisclaimer: "আলোকপথ AI ভুল করতে পারে। গুরুত্বপূর্ণ তথ্যাদি যাচাই করে নিন।",', 'footerDisclaimer: "Alora AI ভুল করতে পারে। গুরুত্বপূর্ণ তথ্যাদি যাচাই করে নিন।",'),
        ('drawerNoChatsSub: "Your conversations with Alokpoth will appear here.",', 'drawerNoChatsSub: "Your conversations with Alora will appear here.",'),
        ('inputPlaceholder: "Ask Alokpoth anything...",', 'inputPlaceholder: "Ask Alora anything...",'),
        ('footerDisclaimer: "Alokpoth can make mistakes. Please verify important info.",', 'footerDisclaimer: "Alora can make mistakes. Please verify important info.",'),
        ('(cleanModel || "Alo AI")', '(cleanModel || "Alora")'),
        ('(cleanModel || \'Alo AI\')', '(cleanModel || \'Alora\')'),
        ('provider: m.provider || "Alokpoth",', 'provider: m.provider || "Alora",'),
        ('(m.id || "Alokpoth");', '(m.id || "Alora");'),
        ('const modName = curMod ? curMod.name : "Alokpoth";', 'const modName = curMod ? curMod.name : "Alora";'),
        ('navigator.share({ title: "Alokpoth", text: textToShare })', 'navigator.share({ title: "Alora", text: textToShare })'),
        ('a.download = `alokpoth-ai-image-${Date.now()}.png`;', 'a.download = `alora-ai-image-${Date.now()}.png`;'),
    ],
    'account.html': [
        ('<title>Settings — Alokpoth</title>', '<title>Settings — Alora</title>'),
        ('<strong style="color: #fff;">Alokpoth Platform</strong>', '<strong style="color: #fff;">Alora Platform</strong>'),
        ('Alokpoth remembers your preferred language (Bengali or English)', 'Alora remembers your preferred language (Bengali or English)'),
        ('pageTitle: "সেটিংস — Alokpoth",', 'pageTitle: "সেটিংস — Alora",'),
        ('pageTitle: "Settings — Alokpoth",', 'pageTitle: "Settings — Alora",')
    ],
    'admin.html': [
        ('<title>Alokpoth - অ্যাডমিন প্যানেল</title>', '<title>Alora - অ্যাডমিন প্যানেল</title>'),
        ('alt="Alokpoth"', 'alt="Alora"'),
        ('placeholder="e.g. Alokpoth GPT-4o Mini"', 'placeholder="e.g. Alora GPT-4o Mini"')
    ],
    'download.html': [
        ('<title>Download App — Alokpoth</title>', '<title>Download App — Alora</title>'),
        ('alt="Alokpoth App Logo"', 'alt="Alora App Logo"'),
        ('<h1 class="hero-title" id="heroTitle">Alokpoth for Android & iOS</h1>', '<h1 class="hero-title" id="heroTitle">Alora for Android & iOS</h1>'),
        ('enjoy lag-free Alokpoth!', 'enjoy lag-free Alora!'),
        ('Launch Alokpoth directly from your home screen with zero browser bars!', 'Launch Alora directly from your home screen with zero browser bars!'),
        ('You can install Alokpoth as a dedicated desktop application.', 'You can install Alora as a dedicated desktop application.'),
        ('"Install Alokpoth"', '"Install Alora"'),
        ('Alokpoth v1.1.0', 'Alora v1.1.0'),
        ('pageTitle: "Download App — Alokpoth",', 'pageTitle: "Download App — Alora",'),
        ('heroTitle: "Alokpoth for Android & iOS",', 'heroTitle: "Alora for Android & iOS",'),
        ('step4: \'Tap <strong>Install</strong> and enjoy lag-free Alokpoth!\',', 'step4: \'Tap <strong>Install</strong> and enjoy lag-free Alora!\','),
        ('iosStep4: "Launch Alokpoth directly from your home screen with zero browser bars!",', 'iosStep4: "Launch Alora directly from your home screen with zero browser bars!",'),
        ('pageTitle: "অ্যাপ ডাউনলোড — আলোকপথ",', 'pageTitle: "অ্যাপ ডাউনলোড — Alora",'),
        ('heroTitle: "অ্যান্ড্রয়েড ও আইওএসের জন্য আলোকপথ",', 'heroTitle: "অ্যান্ড্রয়েড ও আইওএসের জন্য Alora",'),
        ('iosStep4: "এখন কোনো ব্রাউজার বার ছাড়া সরাসরি হোম স্ক্রিন থেকে আলোকপথ ব্যবহার করুন!",', 'iosStep4: "এখন কোনো ব্রাউজার বার ছাড়া সরাসরি হোম স্ক্রিন থেকে Alora ব্যবহার করুন!",'),
        ('ল্যাপটপে আলোকপথ একটি আলাদা অ্যাপ হিসেবে ইন্সটল করতে পারেন।', 'ল্যাপটপে Alora একটি আলাদা অ্যাপ হিসেবে ইন্সটল করতে পারেন।'),
    ],
    'help.html': [
        ('<title>Help Center — Alokpoth</title>', '<title>Help Center — Alora</title>'),
        ('<div class="faq-q" id="faqQ1">What is Alokpoth?</div>', '<div class="faq-q" id="faqQ1">What is Alora?</div>'),
        ('Alokpoth is a high-speed intelligence platform built for coding, academic research, generative image synthesis, and Bengali language conversational mastery.', 'Alora is a high-speed intelligence platform built for coding, academic research, generative image synthesis, and Bengali language conversational mastery.'),
        ('Alokpoth v2.0.0 (Native AMOLED Edition)', 'Alora v2.0.0 (Native AMOLED Edition)'),
        ('faqQ1: "Alokpoth কী?",', 'faqQ1: "Alora কী?",'),
        ('faqA1: "Alokpoth হলো একটি দ্রুতগতির কৃত্রিম বুদ্ধিমত্তা প্ল্যাটফর্ম যা কোডিং, গবেষণা, ছবি তৈরি ও সাবলীল বাংলা কথোপকথনের জন্য বিশেষভাবে তৈরি।",', 'faqA1: "Alora হলো একটি দ্রুতগতির কৃত্রিম বুদ্ধিমত্তা প্ল্যাটফর্ম যা কোডিং, গবেষণা, ছবি তৈরি ও সাবলীল বাংলা কথোপকথনের জন্য বিশেষভাবে তৈরি।",'),
        ('version: "Alokpoth সংস্করণ ২.০.০ (অ্যামোলেড এডিশন)"', 'version: "Alora সংস্করণ ২.০.০ (অ্যামোলেড এডিশন)"'),
        ('faqQ1: "What is Alokpoth?",', 'faqQ1: "What is Alora?",'),
        ('faqA1: "Alokpoth is a high-speed intelligence platform built for coding, academic research, generative image synthesis, and Bengali language conversational mastery.",', 'faqA1: "Alora is a high-speed intelligence platform built for coding, academic research, generative image synthesis, and Bengali language conversational mastery.",'),
        ('version: "Alokpoth v2.0.0 (Native AMOLED Edition)"', 'version: "Alora v2.0.0 (Native AMOLED Edition)"'),
        ('document.title = `${d.pageTitle} — Alokpoth`;', 'document.title = `${d.pageTitle} — Alora`;')
    ],
    'language.html': [
        ('<title>App Language — Alokpoth</title>', '<title>App Language — Alora</title>'),
        ('document.title = `${d.pageTitle} — Alokpoth`;', 'document.title = `${d.pageTitle} — Alora`;')
    ],
    'login.html': [
        ('<title>লগইন ও সাইন-আপ — Alokpoth</title>', '<title>লগইন ও সাইন-আপ — Alora</title>'),
        ('<span id="backToChatText">Alokpoth</span>', '<span id="backToChatText">Alora</span>'),
        ('<div class="top-bar-center" id="loginPageHeaderTitle">Alokpoth</div>', '<div class="top-bar-center" id="loginPageHeaderTitle">Alora</div>'),
        ('alt="Alokpoth"', 'alt="Alora"'),
        ('<p class="auth-subtitle" id="cardSubtitle">Alokpoth-তে প্রবেশ করতে লগইন করুন</p>', '<p class="auth-subtitle" id="cardSubtitle">Alora-তে প্রবেশ করতে লগইন করুন</p>'),
        ('pageTitle: "লগইন ও সাইন-আপ — Alokpoth",', 'pageTitle: "লগইন ও সাইন-আপ — Alora",'),
        ('backToChat: "Alokpoth",', 'backToChat: "Alora",'),
        ('welcomeSub: "Alokpoth-তে প্রবেশ করতে লগইন করুন",', 'welcomeSub: "Alora-তে প্রবেশ করতে লগইন করুন",'),
        ('registerSub: "Alokpoth-এর সাথে শুরু করুন",', 'registerSub: "Alora-এর সাথে শুরু করুন",'),
        ('loggedInSub: "Alokpoth প্রফাইল ও চ্যাট অ্যাক্সেস করুন",', 'loggedInSub: "Alora প্রফাইল ও চ্যাট অ্যাক্সেস করুন",'),
        ('pageTitle: "Log In & Sign Up — Alokpoth",', 'pageTitle: "Log In & Sign Up — Alora",'),
        ('welcomeSub: "Sign in to access Alokpoth",', 'welcomeSub: "Sign in to access Alora",'),
        ('registerSub: "Get started with Alokpoth",', 'registerSub: "Get started with Alora",'),
        ('loggedInSub: "Access your Alokpoth profile and chats",', 'loggedInSub: "Access your Alora profile and chats",')
    ],
    'personalization.html': [
        ('<title>Personalization — Alokpoth</title>', '<title>Personalization — Alora</title>'),
        ("placeholder=\"Tell Alokpoth how you'd like it to respond (e.g., 'I am a software engineer, prefer JavaScript code snippets with concise explanations').\"", "placeholder=\"Tell Alora how you'd like it to respond (e.g., 'I am a software engineer, prefer JavaScript code snippets with concise explanations').\""),
        ('placeholder: "Alokpoth আপনাকে কীভাবে উত্তর দেবে তা লিখুন', 'placeholder: "Alora আপনাকে কীভাবে উত্তর দেবে তা লিখুন'),
        ('placeholder: "Tell Alokpoth how you\'d like it to respond', 'placeholder: "Tell Alora how you\'d like it to respond'),
        ('document.title = `${d.pageTitle} — Alokpoth`;', 'document.title = `${d.pageTitle} — Alora`;')
    ],
    'plans.html': [
        ('<title>প্ল্যান ও মূল্য তালিকা — Alokpoth</title>', '<title>প্ল্যান ও মূল্য তালিকা — Alora</title>'),
        ('<span id="backToChatText">Alokpoth</span>', '<span id="backToChatText">Alora</span>'),
        ('alt="Alokpoth"', 'alt="Alora"'),
        ('<span id="heroBadgeText">Alokpoth Plans</span>', '<span id="heroBadgeText">Alora Plans</span>'),
        ('pageTitle: "প্ল্যান ও মূল্য — Alokpoth",', 'pageTitle: "প্ল্যান ও মূল্য — Alora",'),
        ('backToChat: "Alokpoth",', 'backToChat: "Alora",'),
        ('pageTitle: "Plans & Pricing — Alokpoth",', 'pageTitle: "Plans & Pricing — Alora",')
    ],
    'profile.html': [
        ('<title>Edit Profile — Alokpoth</title>', '<title>Edit Profile — Alora</title>'),
        ('in Alokpoth.', 'in Alora.'),
        ('hint: "আপনার নামটি Alokpoth-এর চ্যাট', 'hint: "আপনার নামটি Alora-এর চ্যাট'),
        ('hint: "Your name will be visible across chats, shared sessions, and account summaries in Alokpoth."', 'hint: "Your name will be visible across chats, shared sessions, and account summaries in Alora."'),
        ('document.title = `${d.pageTitle} — Alokpoth`;', 'document.title = `${d.pageTitle} — Alora`;')
    ],
    'redeem.html': [
        ('<title>Redeem Code — Alokpoth</title>', '<title>Redeem Code — Alora</title>'),
        ('document.title = `${d.pageTitle} — Alokpoth`;', 'document.title = `${d.pageTitle} — Alora`;')
    ],
    'security.html': [
        ('<title>Account &amp; Security — Alokpoth</title>', '<title>Account &amp; Security — Alora</title>'),
        ('🔒 Alokpoth uses industry standard bcrypt encryption and hardened tokens to safeguard your conversations and profile. Never share your password or auth tokens with anyone.', '🔒 Alora uses industry standard bcrypt encryption and hardened tokens to safeguard your conversations and profile. Never share your password or auth tokens with anyone.'),
        ('securityTips: "🔒 Alokpoth আপনার চ্যাট ও ব্যক্তিগত তথ্য সুরক্ষিত রাখতে', 'securityTips: "🔒 Alora আপনার চ্যাট ও ব্যক্তিগত তথ্য সুরক্ষিত রাখতে'),
        ('securityTips: "🔒 Alokpoth uses industry standard bcrypt encryption and hardened tokens to safeguard your conversations and profile. Never share your password or auth tokens with anyone.",', 'securityTips: "🔒 Alora uses industry standard bcrypt encryption and hardened tokens to safeguard your conversations and profile. Never share your password or auth tokens with anyone.",'),
        ('document.title = `${d.pageTitle} — Alokpoth`;', 'document.title = `${d.pageTitle} — Alora`;')
    ],
    'sound.html': [
        ('<title>Sound Settings — Alokpoth</title>', '<title>Sound Settings — Alora</title>'),
        ('document.title = `${d.pageTitle} — Alokpoth`;', 'document.title = `${d.pageTitle} — Alora`;')
    ],
    'subscription.html': [
        ('<title>Subscription — Alokpoth</title>', '<title>Subscription — Alora</title>'),
        ('document.title = `${d.pageTitle} — Alokpoth`;', 'document.title = `${d.pageTitle} — Alora`;')
    ],
    'theme.html': [
        ('<title>Color Theme — Alokpoth</title>', '<title>Color Theme — Alora</title>'),
        ('document.title = `${d.pageTitle} — Alokpoth`;', 'document.title = `${d.pageTitle} — Alora`;')
    ],
    'usage.html': [
        ('<title>Usage &amp; Quota — Alokpoth</title>', '<title>Usage &amp; Quota — Alora</title>'),
        ('document.title = `${d.pageTitle} — Alokpoth`;', 'document.title = `${d.pageTitle} — Alora`;')
    ],
    'server/models/AiModel.js': [
        ("provider: { type: String, default: 'Alokpoth' }", "provider: { type: String, default: 'Alora' }"),
        ('provider: "Alokpoth"', 'provider: "Alora"')
    ],
    'server/routes/chatRoutes.js': [
        ('provider: "Alokpoth AI",', 'provider: "Alora",'),
        ("cleanModel || 'Alo AI'", "cleanModel || 'Alora'")
    ],
    'server/controllers/adminController.js': [
        ("provider: 'Alokpoth'", "provider: 'Alora'"),
        ("provider || 'Alokpoth'", "provider || 'Alora'")
    ],
    'server/controllers/chatController.js': [
        ('You were developed exclusively by Alokpoth AI (আলোকপথ).', 'You were developed exclusively by Alora (অ্যালোরা / Alora AI).'),
        ('আমি ${adminModelName}, আলোকপথ (Alokpoth AI) দ্বারা নির্মিত একটি এআই অ্যাসিস্ট্যান্ট।', 'আমি ${adminModelName}, Alora (Alora AI) দ্বারা নির্মিত একটি এআই অ্যাসিস্ট্যান্ট।'),
        ('I am ${adminModelName}, an AI assistant developed by Alokpoth AI.', 'I am ${adminModelName}, an AI assistant developed by Alora.')
    ],
    'server/server.js': [
        ("server: 'Alokpoth AI Backend Running'", "server: 'Alora AI Backend Running'"),
        ("[Alokpoth AI Server] Running", "[Alora AI Server] Running")
    ]
}

total_count = 0
for filename, rules in replacements.items():
    if not os.path.exists(filename):
        print(f'Warning: {filename} does not exist!')
        continue
    with open(filename, 'r', encoding='utf-8') as f:
        content = f.read()
    orig = content
    for old, new in rules:
        if old in content:
            content = content.replace(old, new)
            total_count += 1
        else:
            print(f'Note: "{old[:40]}..." not found in {filename}')
    if content != orig:
        with open(filename, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f'Successfully updated {filename}')

print(f'Total replacements made: {total_count}')
