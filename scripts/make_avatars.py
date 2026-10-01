import os

os.makedirs('avatars', exist_ok=True)

avatars = {
    'avatar_1.svg': '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <defs>
    <linearGradient id="bg1" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#1e1b4b"/>
      <stop offset="100%" stop-color="#0f172a"/>
    </linearGradient>
    <linearGradient id="glow1" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#38bdf8"/>
      <stop offset="100%" stop-color="#818cf8"/>
    </linearGradient>
  </defs>
  <rect width="100" height="100" rx="50" fill="url(#bg1)"/>
  <circle cx="50" cy="50" r="28" fill="none" stroke="url(#glow1)" stroke-width="2.5" opacity="0.35"/>
  <circle cx="50" cy="50" r="18" fill="none" stroke="url(#glow1)" stroke-width="3" opacity="0.8"/>
  <circle cx="50" cy="50" r="8" fill="url(#glow1)"/>
</svg>''',

    'avatar_2.svg': '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <defs>
    <linearGradient id="bg2" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#064e3b"/>
      <stop offset="100%" stop-color="#022c22"/>
    </linearGradient>
    <linearGradient id="star2" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#6ee7b7"/>
      <stop offset="100%" stop-color="#10b981"/>
    </linearGradient>
  </defs>
  <rect width="100" height="100" rx="50" fill="url(#bg2)"/>
  <path d="M50 18 Q50 50 18 50 Q50 50 50 82 Q50 50 82 50 Q50 50 50 18 Z" fill="url(#star2)"/>
  <circle cx="74" cy="26" r="3.5" fill="#a7f3d0"/>
</svg>''',

    'avatar_3.svg': '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <defs>
    <linearGradient id="bg3" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#9a3412"/>
      <stop offset="100%" stop-color="#431407"/>
    </linearGradient>
    <linearGradient id="fox3" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#fdba74"/>
      <stop offset="100%" stop-color="#fb923c"/>
    </linearGradient>
  </defs>
  <rect width="100" height="100" rx="50" fill="url(#bg3)"/>
  <polygon points="50,74 24,38 32,24 50,42 68,24 76,38" fill="url(#fox3)"/>
  <polygon points="50,74 38,46 62,46" fill="#ffffff" opacity="0.9"/>
  <polygon points="50,74 46,67 54,67" fill="#1e293b"/>
</svg>''',

    'avatar_4.svg': '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <defs>
    <linearGradient id="bg4" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#581c87"/>
      <stop offset="100%" stop-color="#2e1065"/>
    </linearGradient>
    <linearGradient id="gem4" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#f0abfc"/>
      <stop offset="100%" stop-color="#c084fc"/>
    </linearGradient>
  </defs>
  <rect width="100" height="100" rx="50" fill="url(#bg4)"/>
  <polygon points="50,20 76,38 50,80 24,38" fill="url(#gem4)"/>
  <polygon points="50,20 50,80 24,38" fill="#ffffff" opacity="0.2"/>
  <polyline points="24,38 50,48 76,38" fill="none" stroke="#ffffff" stroke-width="1.5" opacity="0.45"/>
</svg>''',

    'avatar_5.svg': '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <defs>
    <linearGradient id="bg5" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0c4a6e"/>
      <stop offset="100%" stop-color="#082f49"/>
    </linearGradient>
  </defs>
  <rect width="100" height="100" rx="50" fill="url(#bg5)"/>
  <path d="M22 62 C32 44, 44 44, 52 56 C60 68, 68 68, 78 50" fill="none" stroke="#38bdf8" stroke-width="5" stroke-linecap="round"/>
  <path d="M24 46 C34 32, 44 32, 52 42 C60 52, 68 52, 76 36" fill="none" stroke="#2dd4bf" stroke-width="4" stroke-linecap="round" opacity="0.9"/>
</svg>''',

    'avatar_6.svg': '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <defs>
    <linearGradient id="bg6" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#1e293b"/>
      <stop offset="100%" stop-color="#0f172a"/>
    </linearGradient>
    <linearGradient id="visor6" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#fbbf24"/>
      <stop offset="100%" stop-color="#f59e0b"/>
    </linearGradient>
  </defs>
  <rect width="100" height="100" rx="50" fill="url(#bg6)"/>
  <circle cx="50" cy="50" r="26" fill="#f8fafc"/>
  <rect x="31" y="38" width="38" height="22" rx="11" fill="url(#visor6)"/>
  <ellipse cx="44" cy="44" rx="8" ry="4" fill="#ffffff" opacity="0.4"/>
</svg>''',

    'avatar_7.svg': '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <defs>
    <linearGradient id="bg7" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#312e81"/>
      <stop offset="100%" stop-color="#1e1b4b"/>
    </linearGradient>
  </defs>
  <rect width="100" height="100" rx="50" fill="url(#bg7)"/>
  <polygon points="32,32 37,52 23,48" fill="#c7d2fe"/>
  <polygon points="68,32 63,52 77,48" fill="#c7d2fe"/>
  <circle cx="50" cy="54" r="22" fill="#c7d2fe"/>
  <ellipse cx="42" cy="52" rx="3" ry="4.5" fill="#1e1b4b"/>
  <ellipse cx="58" cy="52" rx="3" ry="4.5" fill="#1e1b4b"/>
  <polygon points="50,60 47,63 53,63" fill="#f43f5e"/>
</svg>''',

    'avatar_8.svg': '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <defs>
    <linearGradient id="bg8" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#1e3a8a"/>
      <stop offset="100%" stop-color="#172554"/>
    </linearGradient>
  </defs>
  <rect width="100" height="100" rx="50" fill="url(#bg8)"/>
  <line x1="50" y1="20" x2="50" y2="30" stroke="#93c5fd" stroke-width="3" stroke-linecap="round"/>
  <circle cx="50" cy="18" r="4" fill="#60a5fa"/>
  <rect x="26" y="30" width="48" height="42" rx="12" fill="#bfdbfe"/>
  <rect x="33" y="42" width="34" height="14" rx="7" fill="#1d4ed8"/>
  <circle cx="42" cy="49" r="3" fill="#60a5fa"/>
  <circle cx="58" cy="49" r="3" fill="#60a5fa"/>
</svg>''',

    'avatar_9.svg': '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <defs>
    <linearGradient id="bg9" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#881337"/>
      <stop offset="100%" stop-color="#4c0519"/>
    </linearGradient>
    <linearGradient id="flame9" x1="0%" y1="100%" x2="0%" y2="0%">
      <stop offset="0%" stop-color="#f43f5e"/>
      <stop offset="100%" stop-color="#fbbf24"/>
    </linearGradient>
  </defs>
  <rect width="100" height="100" rx="50" fill="url(#bg9)"/>
  <path d="M50 18 C54 32, 68 42, 68 58 C68 70, 58 78, 50 78 C42 78, 32 70, 32 58 C32 46, 42 38, 44 26 C46 32, 52 38, 54 44 C56 36, 52 26, 50 18 Z" fill="url(#flame9)"/>
</svg>''',

    'avatar_10.svg': '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <defs>
    <linearGradient id="bg10" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#14532d"/>
      <stop offset="100%" stop-color="#052e16"/>
    </linearGradient>
  </defs>
  <rect width="100" height="100" rx="50" fill="url(#bg10)"/>
  <path d="M50 20 C68 26, 76 46, 70 66 C50 72, 30 64, 28 48 C26 32, 40 22, 50 20 Z" fill="#4ade80"/>
  <path d="M28 72 Q46 60, 50 20" fill="none" stroke="#14532d" stroke-width="2.5" stroke-linecap="round"/>
</svg>''',

    'avatar_11.svg': '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <defs>
    <linearGradient id="bg11" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#27272a"/>
      <stop offset="100%" stop-color="#09090b"/>
    </linearGradient>
  </defs>
  <rect width="100" height="100" rx="50" fill="url(#bg11)"/>
  <polygon points="54,18 26,50 48,50 44,82 74,46 50,46" fill="#facc15"/>
</svg>''',

    'avatar_12.svg': '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <defs>
    <linearGradient id="bg12" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0f172a"/>
      <stop offset="100%" stop-color="#020617"/>
    </linearGradient>
  </defs>
  <rect width="100" height="100" rx="50" fill="url(#bg12)"/>
  <path d="M56 24 A24 24 0 1 0 76 68 A28 28 0 1 1 56 24 Z" fill="#e2e8f0"/>
  <circle cx="32" cy="34" r="2" fill="#94a3b8" opacity="0.8"/>
  <circle cx="70" cy="30" r="1.5" fill="#94a3b8" opacity="0.6"/>
</svg>'''
}

for name, content in avatars.items():
    p = os.path.join('avatars', name)
    with open(p, 'w', encoding='utf-8') as f:
        f.write(content.strip())
    print('Generated:', p, os.path.getsize(p), 'bytes')
