# Alokpoth AI — ai.zihan.xyz

বাংলাদেশের পূর্ণাঙ্গ, বহু-মডেল সমর্থিত AI চ্যাট অ্যাপ্লিকেশন। সকল API Key সার্ভার সাইডে সুরক্ষিত।

## Features

- 🤖 **১১টি AI মডেল** — Gemini, Groq, OpenRouter, VyceAI, B.AI সহ বিভিন্ন সেবা
- 🔐 **সম্পূর্ণ সুরক্ষিত** — কোনো API Key ফ্রন্টএন্ডে নেই
- 🌐 **Web Search** — লাইভ সার্চ সাপোর্ট
- 🖼️ **Image Generation** — AI দিয়ে ছবি তৈরি
- 📄 **File Upload** — PDF, TXT, CSV, JS, Python ইত্যাদি
- 🎨 **৪টি Theme** — Dark, Light, OLED, Eye Care
- 📱 **Responsive** — সব ডিভাইসে কাজ করে
- 🔑 **Authentication** — JWT লগইন/রেজিস্ট্রেশন
- 👑 **Admin Panel** — সব কিছু ম্যানেজ করুন
- 💳 **Plan System** — Free / Pro / Max সহ Rate Limiting
- 🛡️ **Rate Limiting** — IP-ভিত্তিক DDoS সুরক্ষা

## Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Vanilla HTML/CSS/JS, Marked.js, PDF.js |
| Backend | Node.js + Express.js |
| Database | MongoDB + In-Memory Fallback |
| Auth | JWT + bcryptjs |

## Quick Start

```bash
git clone https://github.com/ZihanFakir/ai.zihan.xyz.git
cd ai.zihan.xyz/server
npm install
node server.js
```

## Environment Variables

```env
PORT=5000
JWT_SECRET=your_super_secret_key
MONGO_URI=mongodb+srv://...
OPENROUTER_API_KEY=sk-or-v1-...
GROQ_API_KEY=gsk_...
VYCE_API_KEY=sk-...
BAI_API_KEY=sk-...
```

## Live

**[ai.zihan.xyz](https://ai.zihan.xyz)** | Made with ❤️ by [Zihan Fakir](https://github.com/ZihanFakir)
