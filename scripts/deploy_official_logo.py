import os
import subprocess
import shutil
from PIL import Image, ImageDraw

p_blade = "M 50.0 50.0 L 45.3 24.3 C 45.3 19.5 42.5 14.5 39.0 13.8 C 48.0 11.5 62.0 11.8 71.5 14.8 C 77.5 17.0 81.0 22.0 81.0 28.5 C 81.0 38.0 72.0 46.5 61.0 49.5 C 56.0 51.0 52.0 50.5 50.0 50.0 Z"

# 1. Dark App Icon SVG (viewBox 0 0 100 100, rendered at 1024x1024)
dark_svg = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="1024" height="1024">
  <defs>
    <linearGradient id="aloGradTop" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#60a5fa"/>
      <stop offset="40%" stop-color="#3b82f6"/>
      <stop offset="100%" stop-color="#2563eb"/>
    </linearGradient>
    <linearGradient id="aloGradRight" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#3b82f6"/>
      <stop offset="50%" stop-color="#4f46e5"/>
      <stop offset="100%" stop-color="#6366f1"/>
    </linearGradient>
    <linearGradient id="aloGradLeft" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#818cf8"/>
      <stop offset="50%" stop-color="#a855f7"/>
      <stop offset="100%" stop-color="#c084fc"/>
    </linearGradient>
    <filter id="aloBladeShadow" x="-15%" y="-15%" width="130%" height="130%">
      <feDropShadow dx="-1" dy="1" stdDeviation="1.5" flood-color="#000000" flood-opacity="0.35"/>
    </filter>
    <radialGradient id="aloBgGlow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#3b82f6" stop-opacity="0.12"/>
      <stop offset="100%" stop-color="#07080a" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <!-- Dark canvas matching AMOLED background -->
  <rect width="100" height="100" fill="#07080a"/>
  <!-- Ambient glow -->
  <circle cx="50" cy="50" r="46" fill="url(#aloBgGlow)"/>
  <!-- Swirl Blades -->
  <g>
    <path d="{p_blade}" fill="url(#aloGradTop)" filter="url(#aloBladeShadow)"/>
    <path d="{p_blade}" fill="url(#aloGradRight)" transform="rotate(120 50 50)" filter="url(#aloBladeShadow)"/>
    <path d="{p_blade}" fill="url(#aloGradLeft)" transform="rotate(240 50 50)" filter="url(#aloBladeShadow)"/>
  </g>
</svg>'''

# 2. Transparent Logo SVG
transparent_svg = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100%" height="100%">
  <defs>
    <linearGradient id="aloGradTopT" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#60a5fa"/>
      <stop offset="40%" stop-color="#3b82f6"/>
      <stop offset="100%" stop-color="#2563eb"/>
    </linearGradient>
    <linearGradient id="aloGradRightT" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#3b82f6"/>
      <stop offset="50%" stop-color="#4f46e5"/>
      <stop offset="100%" stop-color="#6366f1"/>
    </linearGradient>
    <linearGradient id="aloGradLeftT" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#818cf8"/>
      <stop offset="50%" stop-color="#a855f7"/>
      <stop offset="100%" stop-color="#c084fc"/>
    </linearGradient>
    <filter id="aloBladeShadowT" x="-15%" y="-15%" width="130%" height="130%">
      <feDropShadow dx="-1" dy="1" stdDeviation="1.5" flood-color="#000000" flood-opacity="0.35"/>
    </filter>
  </defs>
  <g>
    <path d="{p_blade}" fill="url(#aloGradTopT)" filter="url(#aloBladeShadowT)"/>
    <path d="{p_blade}" fill="url(#aloGradRightT)" transform="rotate(120 50 50)" filter="url(#aloBladeShadowT)"/>
    <path d="{p_blade}" fill="url(#aloGradLeftT)" transform="rotate(240 50 50)" filter="url(#aloBladeShadowT)"/>
  </g>
</svg>'''

# Write SVGs
with open('app_logo.svg', 'w', encoding='utf-8') as f:
    f.write(dark_svg)

with open('app_logo_transparent.svg', 'w', encoding='utf-8') as f:
    f.write(transparent_svg)

edge = r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'

# Render 1024x1024 dark logo
temp_html_dark = os.path.abspath('temp_render_official_dark.html')
master_dark_png = os.path.abspath('official_dark_1024.png')
with open(temp_html_dark, 'w', encoding='utf-8') as f:
    f.write('<!DOCTYPE html><html><head><style>html,body{margin:0;padding:0;background:#07080a;overflow:hidden;}</style></head><body>' + dark_svg + '</body></html>')

cmd_dark = [
    edge,
    '--headless=new',
    '--disable-gpu',
    f'--screenshot={master_dark_png}',
    '--window-size=1024,1024',
    f'file:///{temp_html_dark.replace(os.sep, "/")}'
]
subprocess.run(cmd_dark, capture_output=True)

# Render 1024x1024 transparent logo
temp_html_trans = os.path.abspath('temp_render_official_trans.html')
master_trans_png = os.path.abspath('official_trans_1024.png')
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

img_dark = Image.open(master_dark_png)
img_trans = Image.open(master_trans_png)

# 1. Root images
img_dark.resize((512, 512), Image.Resampling.LANCZOS).save('app_logo.png', 'PNG')
shutil.copy2('app_logo.png', 'app logo.png')
img_trans.resize((512, 512), Image.Resampling.LANCZOS).save('app_logo_transparent.png', 'PNG')
img_dark.resize((192, 192), Image.Resampling.LANCZOS).save('favicon.png', 'PNG')

# 2. Android Drawable
android_drawable = os.path.join('android', 'app', 'src', 'main', 'res', 'drawable', 'app_logo.png')
if os.path.exists(os.path.dirname(android_drawable)):
    img_dark.resize((512, 512), Image.Resampling.LANCZOS).save(android_drawable, 'PNG')

# 3. Android Mipmaps
def make_round(img):
    mask = Image.new('L', img.size, 0)
    draw = ImageDraw.Draw(mask)
    draw.ellipse((0, 0, img.size[0], img.size[1]), fill=255)
    result = Image.new('RGBA', img.size, (0, 0, 0, 0))
    result.paste(img, (0, 0), mask=mask)
    return result

densities = {
    'mdpi': 48,
    'hdpi': 72,
    'xhdpi': 96,
    'xxhdpi': 144,
    'xxxhdpi': 192
}

for dens, sz in densities.items():
    folder = os.path.join('android', 'app', 'src', 'main', 'res', f'mipmap-{dens}')
    if os.path.exists(folder):
        resized = img_dark.resize((sz, sz), Image.Resampling.LANCZOS)
        resized.save(os.path.join(folder, 'ic_launcher.png'), 'PNG')
        round_icon = make_round(resized)
        round_icon.save(os.path.join(folder, 'ic_launcher_round.png'), 'PNG')

# 4. iOS Asset Catalog
ios_assets_dir = os.path.join('ios', 'AloAI', 'Assets.xcassets', 'AppIcon.appiconset')
if os.path.exists(ios_assets_dir):
    img_dark.save(os.path.join(ios_assets_dir, 'app_icon_1024.png'), 'PNG')
    ios_sizes = {
        'app_icon_180.png': 180,
        'app_icon_120.png': 120,
        'app_icon_87.png': 87,
        'app_icon_58.png': 58,
        'app_icon_60.png': 60,
        'app_icon_40.png': 40,
        'app_icon_167.png': 167,
        'app_icon_152.png': 152,
        'app_icon_76.png': 76,
        'app_icon_20.png': 20,
        'app_icon_29.png': 29,
        'app_icon_80.png': 80
    }
    for filename, size in ios_sizes.items():
        resized = img_dark.resize((size, size), Image.Resampling.LANCZOS)
        resized.save(os.path.join(ios_assets_dir, filename), 'PNG')

for tmp in [master_dark_png, master_trans_png]:
    if os.path.exists(tmp):
        try: os.remove(tmp)
        except: pass

print("Official 3-blade swirl logo successfully deployed to Web, Android, and iOS!")
