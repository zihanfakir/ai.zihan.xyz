import os
import subprocess
import shutil
from PIL import Image

edge = r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'

# 1. Dark App Icon SVG (512x512 viewBox)
dark_svg = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="1024" height="1024">
  <defs>
    <radialGradient id="spaceAura" cx="50%" cy="48%" r="62%">
      <stop offset="0%" stop-color="#2563EB" stop-opacity="0.32"/>
      <stop offset="45%" stop-color="#7C3AED" stop-opacity="0.14"/>
      <stop offset="100%" stop-color="#050608" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="apexGlow" cx="50%" cy="18%" r="35%">
      <stop offset="0%" stop-color="#38BDF8" stop-opacity="0.65"/>
      <stop offset="60%" stop-color="#6366F1" stop-opacity="0.15"/>
      <stop offset="100%" stop-color="#050608" stop-opacity="0"/>
    </radialGradient>

    <linearGradient id="leftWingGrad" x1="50%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#FFFFFF"/>
      <stop offset="12%" stop-color="#38BDF8"/>
      <stop offset="45%" stop-color="#0284C7"/>
      <stop offset="100%" stop-color="#1D4ED8"/>
    </linearGradient>

    <linearGradient id="rightWingGrad" x1="50%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FFFFFF"/>
      <stop offset="15%" stop-color="#C084FC"/>
      <stop offset="55%" stop-color="#9333EA"/>
      <stop offset="100%" stop-color="#6B21A8"/>
    </linearGradient>

    <linearGradient id="bridgeGrad" x1="0%" y1="50%" x2="100%" y2="50%">
      <stop offset="0%" stop-color="#06B6D4"/>
      <stop offset="35%" stop-color="#3B82F6"/>
      <stop offset="70%" stop-color="#8B5CF6"/>
      <stop offset="100%" stop-color="#D946EF"/>
    </linearGradient>

    <linearGradient id="sparkGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FFFFFF"/>
      <stop offset="45%" stop-color="#F0F9FF"/>
      <stop offset="100%" stop-color="#38BDF8"/>
    </linearGradient>

    <linearGradient id="leftEdgeLight" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FFFFFF" stop-opacity="1"/>
      <stop offset="30%" stop-color="#7DD3FC" stop-opacity="0.8"/>
      <stop offset="100%" stop-color="#0284C7" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="rightEdgeLight" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FFFFFF" stop-opacity="1"/>
      <stop offset="30%" stop-color="#E879F9" stop-opacity="0.8"/>
      <stop offset="100%" stop-color="#9333EA" stop-opacity="0"/>
    </linearGradient>

    <filter id="shadow3D" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="14" stdDeviation="18" flood-color="#000000" flood-opacity="0.8"/>
    </filter>
    <filter id="bloomSpark" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="6" result="blur"/>
      <feMerge>
        <feMergeNode in="blur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>

  <rect width="512" height="512" fill="#060709"/>

  <circle cx="256" cy="256" r="235" fill="url(#spaceAura)"/>
  <circle cx="256" cy="160" r="160" fill="url(#apexGlow)"/>

  <circle cx="256" cy="256" r="205" fill="none" stroke="rgba(255,255,255,0.04)" stroke-width="1.5" stroke-dasharray="4 8"/>
  <polygon points="256,76 432,380 80,380" fill="none" stroke="rgba(56,189,248,0.06)" stroke-width="1"/>

  <g filter="url(#shadow3D)">
    <path d="M 162 292 L 350 292 C 358 292 364 298 360 306 L 348 332 C 344 340 336 346 328 346 L 184 346 C 176 346 168 340 164 332 L 152 306 C 148 298 154 292 162 292 Z"
          fill="url(#bridgeGrad)"/>

    <path d="M 256 78 C 264 78 270 84 266 92 L 244 146 L 156 364 C 150 378 136 388 120 388 L 96 388 C 86 388 80 376 86 367 L 230 88 C 237 79 246 78 256 78 Z"
          fill="url(#leftWingGrad)"/>
    <path d="M 256 78 L 86 367" fill="none" stroke="url(#leftEdgeLight)" stroke-width="3.5" stroke-linecap="round"/>

    <path d="M 256 78 C 248 78 242 84 246 92 L 268 146 L 356 364 C 362 378 376 388 392 388 L 416 388 C 426 388 432 376 426 367 L 282 88 C 275 79 266 78 256 78 Z"
          fill="url(#rightWingGrad)"/>
    <path d="M 256 78 L 426 367" fill="none" stroke="url(#rightEdgeLight)" stroke-width="3.5" stroke-linecap="round"/>

    <circle cx="256" cy="78" r="6" fill="#FFFFFF"/>
    <circle cx="256" cy="78" r="3" fill="#E0F2FE"/>
  </g>

  <g filter="url(#bloomSpark)">
    <path d="M 256 168 Q 256 236 188 236 Q 256 236 256 304 Q 256 236 324 236 Q 256 236 256 168 Z"
          fill="url(#sparkGrad)"/>
    <circle cx="256" cy="236" r="15" fill="#FFFFFF"/>
    <circle cx="256" cy="236" r="7.5" fill="#38BDF8"/>
  </g>

  <circle cx="120" cy="388" r="2.5" fill="#38BDF8"/>
  <circle cx="392" cy="388" r="2.5" fill="#C084FC"/>
  <circle cx="346" cy="314" r="2" fill="#E879F9"/>
  <circle cx="166" cy="314" r="2" fill="#06B6D4"/>
</svg>'''

# 2. Transparent SVG
transparent_svg = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="100%" height="100%">
  <defs>
    <linearGradient id="leftWingGradT" x1="50%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#FFFFFF"/>
      <stop offset="12%" stop-color="#38BDF8"/>
      <stop offset="45%" stop-color="#0284C7"/>
      <stop offset="100%" stop-color="#1D4ED8"/>
    </linearGradient>

    <linearGradient id="rightWingGradT" x1="50%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FFFFFF"/>
      <stop offset="15%" stop-color="#C084FC"/>
      <stop offset="55%" stop-color="#9333EA"/>
      <stop offset="100%" stop-color="#6B21A8"/>
    </linearGradient>

    <linearGradient id="bridgeGradT" x1="0%" y1="50%" x2="100%" y2="50%">
      <stop offset="0%" stop-color="#06B6D4"/>
      <stop offset="35%" stop-color="#3B82F6"/>
      <stop offset="70%" stop-color="#8B5CF6"/>
      <stop offset="100%" stop-color="#D946EF"/>
    </linearGradient>

    <linearGradient id="sparkGradT" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FFFFFF"/>
      <stop offset="45%" stop-color="#F0F9FF"/>
      <stop offset="100%" stop-color="#38BDF8"/>
    </linearGradient>

    <linearGradient id="leftEdgeLightT" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FFFFFF" stop-opacity="1"/>
      <stop offset="30%" stop-color="#7DD3FC" stop-opacity="0.8"/>
      <stop offset="100%" stop-color="#0284C7" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="rightEdgeLightT" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FFFFFF" stop-opacity="1"/>
      <stop offset="30%" stop-color="#E879F9" stop-opacity="0.8"/>
      <stop offset="100%" stop-color="#9333EA" stop-opacity="0"/>
    </linearGradient>

    <filter id="shadow3DT" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="10" stdDeviation="14" flood-color="#000000" flood-opacity="0.6"/>
    </filter>
    <filter id="bloomSparkT" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="5" result="blur"/>
      <feMerge>
        <feMergeNode in="blur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>

  <g filter="url(#shadow3DT)">
    <path d="M 162 292 L 350 292 C 358 292 364 298 360 306 L 348 332 C 344 340 336 346 328 346 L 184 346 C 176 346 168 340 164 332 L 152 306 C 148 298 154 292 162 292 Z"
          fill="url(#bridgeGradT)"/>

    <path d="M 256 78 C 264 78 270 84 266 92 L 244 146 L 156 364 C 150 378 136 388 120 388 L 96 388 C 86 388 80 376 86 367 L 230 88 C 237 79 246 78 256 78 Z"
          fill="url(#leftWingGradT)"/>
    <path d="M 256 78 L 86 367" fill="none" stroke="url(#leftEdgeLightT)" stroke-width="3.5" stroke-linecap="round"/>

    <path d="M 256 78 C 248 78 242 84 246 92 L 268 146 L 356 364 C 362 378 376 388 392 388 L 416 388 C 426 388 432 376 426 367 L 282 88 C 275 79 266 78 256 78 Z"
          fill="url(#rightWingGradT)"/>
    <path d="M 256 78 L 426 367" fill="none" stroke="url(#rightEdgeLightT)" stroke-width="3.5" stroke-linecap="round"/>

    <circle cx="256" cy="78" r="6" fill="#FFFFFF"/>
    <circle cx="256" cy="78" r="3" fill="#E0F2FE"/>
  </g>

  <g filter="url(#bloomSparkT)">
    <path d="M 256 168 Q 256 236 188 236 Q 256 236 256 304 Q 256 236 324 236 Q 256 236 256 168 Z"
          fill="url(#sparkGradT)"/>
    <circle cx="256" cy="236" r="15" fill="#FFFFFF"/>
    <circle cx="256" cy="236" r="7.5" fill="#38BDF8"/>
  </g>
</svg>'''

with open('app_logo.svg', 'w', encoding='utf-8') as f:
    f.write(dark_svg)

with open('app_logo_transparent.svg', 'w', encoding='utf-8') as f:
    f.write(transparent_svg)

# Render master 1024x1024 dark logo
temp_html_dark = os.path.abspath('temp_render_dark.html')
master_dark_png = os.path.abspath('master_app_logo_1024.png')
with open(temp_html_dark, 'w', encoding='utf-8') as f:
    f.write('<!DOCTYPE html><html><head><style>html,body{margin:0;padding:0;background:#060709;overflow:hidden;}</style></head><body>' + dark_svg + '</body></html>')

cmd_dark = [
    edge,
    '--headless=new',
    '--disable-gpu',
    f'--screenshot={master_dark_png}',
    '--window-size=1024,1024',
    f'file:///{temp_html_dark.replace(os.sep, "/")}'
]
subprocess.run(cmd_dark, capture_output=True)

# Render master 1024x1024 transparent logo
temp_html_trans = os.path.abspath('temp_render_trans.html')
master_trans_png = os.path.abspath('master_trans_1024.png')
with open(temp_html_trans, 'w', encoding='utf-8') as f:
    f.write('<!DOCTYPE html><html><head><style>html,body{margin:0;padding:0;background:transparent;overflow:hidden;}</style></head><body>' + transparent_svg + '</body></html>')

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

for tmp in [temp_html_dark, temp_html_trans]:
    if os.path.exists(tmp):
        try: os.remove(tmp)
        except: pass

# Load PIL Image for multi-scale export
img_dark = Image.open(master_dark_png)
img_trans = Image.open(master_trans_png)

# 1. Root 512x512 app_logo.png
img_dark.resize((512, 512), Image.Resampling.LANCZOS).save('app_logo.png', 'PNG')
shutil.copy2('app_logo.png', 'app logo.png')

# 2. Root 512x512 app_logo_transparent.png
img_trans.resize((512, 512), Image.Resampling.LANCZOS).save('app_logo_transparent.png', 'PNG')

# 3. Favicon (192x192 PNG)
img_dark.resize((192, 192), Image.Resampling.LANCZOS).save('favicon.png', 'PNG')

# 4. Android Drawable
android_drawable = os.path.join('android', 'app', 'src', 'main', 'res', 'drawable', 'app_logo.png')
if os.path.exists(os.path.dirname(android_drawable)):
    img_dark.resize((512, 512), Image.Resampling.LANCZOS).save(android_drawable, 'PNG')

# 5. Android Mipmap densities
densities = {
    'mdpi': 48,
    'hdpi': 72,
    'xhdpi': 96,
    'xxhdpi': 144,
    'xxxhdpi': 192
}

# Function to create circular mask for round icon
def make_round(img):
    mask = Image.new('L', img.size, 0)
    from PIL import ImageDraw
    draw = ImageDraw.Draw(mask)
    draw.ellipse((0, 0, img.size[0], img.size[1]), fill=255)
    result = Image.new('RGBA', img.size, (0, 0, 0, 0))
    result.paste(img, (0, 0), mask=mask)
    return result

for dens, sz in densities.items():
    folder = os.path.join('android', 'app', 'src', 'main', 'res', f'mipmap-{dens}')
    if os.path.exists(folder):
        resized = img_dark.resize((sz, sz), Image.Resampling.LANCZOS)
        resized.save(os.path.join(folder, 'ic_launcher.png'), 'PNG')
        
        # Round icon with circular crop
        round_icon = make_round(resized)
        round_icon.save(os.path.join(folder, 'ic_launcher_round.png'), 'PNG')
        print(f"Android mipmap-{dens} saved ({sz}x{sz})")

print("All logo assets generated and distributed successfully!")
