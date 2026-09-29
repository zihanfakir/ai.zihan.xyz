import os
import subprocess
import shutil
from PIL import Image, ImageFilter

# New Alo AI Logo: "The Celestial Light Prism" (আলো - Quantum Light & Intelligence)
# Modern, futuristic, ultra-crisp vector design

new_dark_svg = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="1024" height="1024">
  <defs>
    <!-- Background Ambient Glows -->
    <radialGradient id="bgGlowBlue" cx="40%" cy="40%" r="60%">
      <stop offset="0%" stop-color="#0066FF" stop-opacity="0.25"/>
      <stop offset="50%" stop-color="#3B82F6" stop-opacity="0.10"/>
      <stop offset="100%" stop-color="#050608" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="bgGlowPurple" cx="65%" cy="65%" r="55%">
      <stop offset="0%" stop-color="#8B5CF6" stop-opacity="0.22"/>
      <stop offset="60%" stop-color="#6366F1" stop-opacity="0.08"/>
      <stop offset="100%" stop-color="#050608" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="coreAura" cx="50%" cy="50%" r="35%">
      <stop offset="0%" stop-color="#38BDF8" stop-opacity="0.45"/>
      <stop offset="35%" stop-color="#6366F1" stop-opacity="0.20"/>
      <stop offset="100%" stop-color="#050608" stop-opacity="0"/>
    </radialGradient>

    <!-- Blade 1: Cyan to Electric Blue (Left Upward Wing) -->
    <linearGradient id="facetCyan" x1="10%" y1="90%" x2="70%" y2="10%">
      <stop offset="0%" stop-color="#0052D4"/>
      <stop offset="35%" stop-color="#4364F7"/>
      <stop offset="70%" stop-color="#00C6FF"/>
      <stop offset="100%" stop-color="#E0F7FF"/>
    </linearGradient>

    <!-- Blade 2: Electric Indigo to Vivid Violet (Right Downward Wing) -->
    <linearGradient id="facetPurple" x1="20%" y1="10%" x2="90%" y2="90%">
      <stop offset="0%" stop-color="#3B82F6"/>
      <stop offset="45%" stop-color="#6366F1"/>
      <stop offset="75%" stop-color="#8B5CF6"/>
      <stop offset="100%" stop-color="#C084FC"/>
    </linearGradient>

    <!-- Blade 3: Magenta to Radiant Peach & Gold (Bottom Horizon Arc) -->
    <linearGradient id="facetMagenta" x1="90%" y1="60%" x2="10%" y2="70%">
      <stop offset="0%" stop-color="#C084FC"/>
      <stop offset="40%" stop-color="#A855F7"/>
      <stop offset="70%" stop-color="#EC4899"/>
      <stop offset="100%" stop-color="#06B6D4"/>
    </linearGradient>

    <!-- Center Spark Glow Gradient -->
    <linearGradient id="sparkGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FFFFFF"/>
      <stop offset="50%" stop-color="#E0F2FE"/>
      <stop offset="100%" stop-color="#38BDF8"/>
    </linearGradient>

    <!-- Drop Shadows for 3D Floating Depth -->
    <filter id="softGaze" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="8" stdDeviation="16" flood-color="#000000" flood-opacity="0.55"/>
    </filter>
    <filter id="bloomSpark" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="4" result="blur"/>
      <feMerge>
        <feMergeNode in="blur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>

  <!-- Deep Obsidian AMOLED Canvas -->
  <rect width="512" height="512" rx="115" fill="#060709"/>

  <!-- Subtle Ambient Glows -->
  <circle cx="210" cy="210" r="230" fill="url(#bgGlowBlue)"/>
  <circle cx="320" cy="310" r="210" fill="url(#bgGlowPurple)"/>
  <circle cx="256" cy="256" r="150" fill="url(#coreAura)"/>

  <!-- Subtle Outer Precision Ring -->
  <circle cx="256" cy="256" r="192" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="1.5" stroke-dasharray="6 6"/>

  <!-- Main Geometric Light Prism (Modern Interlocking Tri-Facet Architecture) -->
  <g filter="url(#softGaze)">
    <!-- Facet 1: Left Ascending Blade (Luminous Cyan / Blue) -->
    <path d="M 256 92 C 270 92 284 102 292 118 L 366 250 C 374 265 370 282 358 292 L 256 376 C 248 382 238 380 234 372 L 180 264 C 172 248 174 228 184 214 L 236 112 C 242 100 248 92 256 92 Z"
          fill="url(#facetCyan)" opacity="0.95"/>

    <!-- Facet 2: Right Descending Blade (Electric Indigo / Violet) with sleek overlap -->
    <path d="M 378 198 C 390 206 396 222 392 238 L 354 366 C 348 384 332 396 314 396 L 182 396 C 168 396 156 388 152 376 L 194 286 C 198 276 210 270 220 274 L 322 308 C 334 312 346 304 350 292 L 362 216 C 364 204 370 196 378 198 Z"
          fill="url(#facetPurple)" opacity="0.92"/>

    <!-- Facet 3: Base Swirl / Horizon Beam (Vivid Magenta / Violet / Cyan) -->
    <path d="M 146 314 C 138 302 140 284 150 274 L 242 174 C 254 162 272 160 284 170 L 320 200 C 330 208 330 222 320 230 L 226 312 C 214 322 198 324 186 318 L 146 314 Z"
          fill="url(#facetMagenta)" opacity="0.88"/>
  </g>

  <!-- Central Celestial Light Star / Spark (The Spark of AI 'Alo') -->
  <g filter="url(#bloomSpark)">
    <!-- 4-point Diamond Starburst -->
    <path d="M 256 182 Q 256 256 182 256 Q 256 256 256 330 Q 256 256 330 256 Q 256 256 256 182 Z"
          fill="url(#sparkGrad)"/>
    <!-- Center Core Glow Point -->
    <circle cx="256" cy="256" r="14" fill="#FFFFFF"/>
    <circle cx="256" cy="256" r="6" fill="#E0F7FF"/>
  </g>

  <!-- Accent Micro-Sparks -->
  <circle cx="196" cy="180" r="2.5" fill="#38BDF8" opacity="0.8"/>
  <circle cx="340" cy="186" r="2" fill="#C084FC" opacity="0.7"/>
  <circle cx="362" cy="330" r="2.5" fill="#60A5FA" opacity="0.75"/>
  <circle cx="168" cy="336" r="2" fill="#F472B6" opacity="0.6"/>
</svg>
'''

new_transparent_svg = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="100%" height="100%">
  <defs>
    <!-- Blade 1: Cyan to Electric Blue -->
    <linearGradient id="facetCyanT" x1="10%" y1="90%" x2="70%" y2="10%">
      <stop offset="0%" stop-color="#0052D4"/>
      <stop offset="35%" stop-color="#4364F7"/>
      <stop offset="70%" stop-color="#00C6FF"/>
      <stop offset="100%" stop-color="#E0F7FF"/>
    </linearGradient>

    <!-- Blade 2: Electric Indigo to Vivid Violet -->
    <linearGradient id="facetPurpleT" x1="20%" y1="10%" x2="90%" y2="90%">
      <stop offset="0%" stop-color="#3B82F6"/>
      <stop offset="45%" stop-color="#6366F1"/>
      <stop offset="75%" stop-color="#8B5CF6"/>
      <stop offset="100%" stop-color="#C084FC"/>
    </linearGradient>

    <!-- Blade 3: Magenta to Radiant Peach & Cyan -->
    <linearGradient id="facetMagentaT" x1="90%" y1="60%" x2="10%" y2="70%">
      <stop offset="0%" stop-color="#C084FC"/>
      <stop offset="40%" stop-color="#A855F7"/>
      <stop offset="70%" stop-color="#EC4899"/>
      <stop offset="100%" stop-color="#06B6D4"/>
    </linearGradient>

    <!-- Center Spark Glow Gradient -->
    <linearGradient id="sparkGradT" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FFFFFF"/>
      <stop offset="50%" stop-color="#E0F2FE"/>
      <stop offset="100%" stop-color="#38BDF8"/>
    </linearGradient>

    <filter id="softGazeT" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="6" stdDeviation="12" flood-color="#000000" flood-opacity="0.45"/>
    </filter>
    <filter id="bloomSparkT" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="3" result="blur"/>
      <feMerge>
        <feMergeNode in="blur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>

  <g filter="url(#softGazeT)">
    <path d="M 256 92 C 270 92 284 102 292 118 L 366 250 C 374 265 370 282 358 292 L 256 376 C 248 382 238 380 234 372 L 180 264 C 172 248 174 228 184 214 L 236 112 C 242 100 248 92 256 92 Z"
          fill="url(#facetCyanT)" opacity="0.95"/>

    <path d="M 378 198 C 390 206 396 222 392 238 L 354 366 C 348 384 332 396 314 396 L 182 396 C 168 396 156 388 152 376 L 194 286 C 198 276 210 270 220 274 L 322 308 C 334 312 346 304 350 292 L 362 216 C 364 204 370 196 378 198 Z"
          fill="url(#facetPurpleT)" opacity="0.92"/>

    <path d="M 146 314 C 138 302 140 284 150 274 L 242 174 C 254 162 272 160 284 170 L 320 200 C 330 208 330 222 320 230 L 226 312 C 214 322 198 324 186 318 L 146 314 Z"
          fill="url(#facetMagentaT)" opacity="0.88"/>
  </g>

  <g filter="url(#bloomSparkT)">
    <path d="M 256 182 Q 256 256 182 256 Q 256 256 256 330 Q 256 256 330 256 Q 256 256 256 182 Z"
          fill="url(#sparkGradT)"/>
    <circle cx="256" cy="256" r="14" fill="#FFFFFF"/>
    <circle cx="256" cy="256" r="6" fill="#E0F7FF"/>
  </g>
</svg>
'''

with open('app_logo.svg', 'w', encoding='utf-8') as f:
    f.write(new_dark_svg)

with open('app_logo_transparent.svg', 'w', encoding='utf-8') as f:
    f.write(new_transparent_svg)

edge = r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'

# 1. Render master high-res 1024x1024 dark logo
temp_html_dark = os.path.abspath('temp_render_dark.html')
master_dark_png = os.path.abspath('master_dark_1024.png')
with open(temp_html_dark, 'w', encoding='utf-8') as f:
    f.write('<!DOCTYPE html><html><head><style>html,body{margin:0;padding:0;background:#060709;overflow:hidden;}</style></head><body>' + new_dark_svg + '</body></html>')

cmd_dark = [
    edge,
    '--headless=new',
    '--disable-gpu',
    f'--screenshot={master_dark_png}',
    '--window-size=1024,1024',
    f'file:///{temp_html_dark.replace(os.sep, "/")}'
]
subprocess.run(cmd_dark, capture_output=True)

# 2. Render master high-res transparent logo
temp_html_trans = os.path.abspath('temp_render_trans.html')
master_trans_png = os.path.abspath('master_trans_1024.png')
with open(temp_html_trans, 'w', encoding='utf-8') as f:
    f.write('<!DOCTYPE html><html><head><style>html,body{margin:0;padding:0;background:transparent;overflow:hidden;}</style></head><body>' + new_transparent_svg + '</body></html>')

cmd_trans = [
    edge,
    '--headless=new',
    '--disable-gpu',
    '--default-background-color=00000000',
    f'--screenshot={master_trans_png}',
    '--window-size=1024,1024',
    f'file:///{temp_html_trans.replace(os.sep, "/")}'
]
subprocess.run(cmd_trans, capture_output=True)

# Clean up temp htmls
for tmp in [temp_html_dark, temp_html_trans]:
    if os.path.exists(tmp):
        try: os.remove(tmp)
        except: pass

print("Rendered master 1024x1024 images successfully.")
