import os
import shutil
from PIL import Image, ImageDraw

ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))

# Sources
WHITE_PNG_SRC = os.path.join(ROOT_DIR, 'logo', 'ALORA png', '4.png')
BLACK_PNG_SRC = os.path.join(ROOT_DIR, 'logo', 'ALORA png', '5.png')
SVG_SRC = os.path.join(ROOT_DIR, 'logo', 'ALORA svg', '4.svg')

print(f"Loading source glyphs...")
img_white_src = Image.open(WHITE_PNG_SRC).convert('RGBA')
bbox_white = img_white_src.getbbox()
cropped_white = img_white_src.crop(bbox_white)

img_black_src = Image.open(BLACK_PNG_SRC).convert('RGBA')
bbox_black = img_black_src.getbbox()
cropped_black = img_black_src.crop(bbox_black)

print(f"Cropped white glyph: {cropped_white.size}")
print(f"Cropped black glyph: {cropped_black.size}")

def render_icon(target_size, bg_mode='rounded', bg_color=(9, 9, 11, 255), glyph_scale=0.72, is_black_glyph=False):
    """
    Renders an icon at target_size with supersampling for crisp edges.
    bg_mode:
      - 'square': solid background across full canvas
      - 'rounded': rounded rectangle badge on transparent canvas
      - 'circle': circle mask on transparent canvas
      - 'transparent': transparent canvas, glyph only
    """
    ss = 4
    canvas_sz = target_size * ss
    img = Image.new('RGBA', (canvas_sz, canvas_sz), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    if bg_mode == 'square':
        draw.rectangle([0, 0, canvas_sz, canvas_sz], fill=bg_color)
    elif bg_mode == 'rounded':
        r = int(canvas_sz * 0.22)
        draw.rounded_rectangle([0, 0, canvas_sz - 1, canvas_sz - 1], radius=r, fill=bg_color)
    elif bg_mode == 'circle':
        draw.ellipse([0, 0, canvas_sz - 1, canvas_sz - 1], fill=bg_color)

    glyph = cropped_black if is_black_glyph else cropped_white
    gw = int(canvas_sz * glyph_scale)
    gh = int(glyph.height * (gw / glyph.width))

    resized_glyph = glyph.resize((gw, gh), Image.Resampling.LANCZOS)
    gx = (canvas_sz - gw) // 2
    gy = (canvas_sz - gh) // 2
    img.alpha_composite(resized_glyph, (gx, gy))

    final_img = img.resize((target_size, target_size), Image.Resampling.LANCZOS)
    return final_img

# 1. Generate Favicon Suite
print("\n--- Generating Favicon Suite ---")
fav16 = render_icon(16, bg_mode='rounded', glyph_scale=0.75)
fav32 = render_icon(32, bg_mode='rounded', glyph_scale=0.74)
fav48 = render_icon(48, bg_mode='rounded', glyph_scale=0.72)
fav64 = render_icon(64, bg_mode='rounded', glyph_scale=0.72)
fav192 = render_icon(192, bg_mode='rounded', glyph_scale=0.72)

# Save favicon-16x16.png, favicon-32x32.png, favicon.png
fav16.save(os.path.join(ROOT_DIR, 'favicon-16x16.png'), 'PNG')
fav32.save(os.path.join(ROOT_DIR, 'favicon-32x32.png'), 'PNG')
fav192.save(os.path.join(ROOT_DIR, 'favicon.png'), 'PNG')
print("Saved favicon-16x16.png, favicon-32x32.png, favicon.png")

# Save multi-size favicon.ico
fav_ico_path = os.path.join(ROOT_DIR, 'favicon.ico')
# Pillow ICO format takes master image and appends others
fav64.save(fav_ico_path, format='ICO', append_images=[fav48, fav32, fav16])
print(f"Saved {fav_ico_path} (sizes: 16, 32, 48, 64)")

# Apple Touch Icon (180x180 solid background)
apple_touch = render_icon(180, bg_mode='square', glyph_scale=0.70)
apple_touch.save(os.path.join(ROOT_DIR, 'apple-touch-icon.png'), 'PNG')
print("Saved apple-touch-icon.png")

# 2. Master App Logos (512x512)
print("\n--- Generating Master App Logos ---")
app_logo_square = render_icon(512, bg_mode='square', glyph_scale=0.72)
app_logo_square.save(os.path.join(ROOT_DIR, 'app_logo.png'), 'PNG')
# Also overwrite legacy 'app logo.png' (with space)
app_logo_square.save(os.path.join(ROOT_DIR, 'app logo.png'), 'PNG')

app_logo_trans_white = render_icon(512, bg_mode='transparent', glyph_scale=0.80)
app_logo_trans_white.save(os.path.join(ROOT_DIR, 'app_logo_transparent.png'), 'PNG')
app_logo_trans_white.save(os.path.join(ROOT_DIR, 'logo_icon_white.png'), 'PNG')

app_logo_trans_black = render_icon(512, bg_mode='transparent', glyph_scale=0.80, is_black_glyph=True)
app_logo_trans_black.save(os.path.join(ROOT_DIR, 'app_logo_transparent_black.png'), 'PNG')
app_logo_trans_black.save(os.path.join(ROOT_DIR, 'logo_icon_black.png'), 'PNG')
print("Saved app_logo.png, 'app logo.png', app_logo_transparent.png, logo_icon_white.png, logo_icon_black.png")

# 3. Vector SVGs
print("\n--- Generating Clean Vector SVGs ---")
with open(SVG_SRC, 'r', encoding='utf-8') as f:
    svg_raw = f.read()

# Extract the inner SVG definition (defs and g)
defs_start = svg_raw.find('<defs>')
g_end = svg_raw.rfind('</svg>')
inner_svg = svg_raw[defs_start:g_end]

# favicon.svg (with stylish rounded dark squircle badge)
favicon_svg = f'''<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 750 750" width="100%" height="100%">
  <rect width="750" height="750" rx="165" fill="#09090b"/>
  {inner_svg}
</svg>'''

with open(os.path.join(ROOT_DIR, 'favicon.svg'), 'w', encoding='utf-8') as f:
    f.write(favicon_svg)
print("Saved favicon.svg")

# app_logo.svg (with solid dark square)
app_logo_svg = f'''<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 750 750" width="100%" height="100%">
  <rect width="750" height="750" fill="#09090b"/>
  {inner_svg}
</svg>'''

with open(os.path.join(ROOT_DIR, 'app_logo.svg'), 'w', encoding='utf-8') as f:
    f.write(app_logo_svg)
print("Saved app_logo.svg")

# app_logo_transparent.svg
app_logo_trans_svg = f'''<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 750 750" width="100%" height="100%">
  {inner_svg}
</svg>'''

with open(os.path.join(ROOT_DIR, 'app_logo_transparent.svg'), 'w', encoding='utf-8') as f:
    f.write(app_logo_trans_svg)
print("Saved app_logo_transparent.svg")

# 4. Android Native Mipmaps & Drawables
print("\n--- Generating Android Native Icons ---")
android_res = os.path.join(ROOT_DIR, 'android', 'app', 'src', 'main', 'res')
os.makedirs(os.path.join(android_res, 'drawable'), exist_ok=True)

# drawable/app_logo.png (512x512)
app_logo_square.save(os.path.join(android_res, 'drawable', 'app_logo.png'), 'PNG')
print("Saved android drawable/app_logo.png")

android_densities = {
    'mipmap-mdpi': 48,
    'mipmap-hdpi': 72,
    'mipmap-xhdpi': 96,
    'mipmap-xxhdpi': 144,
    'mipmap-xxxhdpi': 192
}

for folder, sz in android_densities.items():
    folder_path = os.path.join(android_res, folder)
    os.makedirs(folder_path, exist_ok=True)

    # Square launcher icon
    ic_square = render_icon(sz, bg_mode='square', glyph_scale=0.72)
    ic_square.save(os.path.join(folder_path, 'ic_launcher.png'), 'PNG')

    # Round launcher icon
    ic_round = render_icon(sz, bg_mode='circle', glyph_scale=0.70)
    ic_round.save(os.path.join(folder_path, 'ic_launcher_round.png'), 'PNG')
    print(f"Saved {folder}/ic_launcher.png and ic_launcher_round.png ({sz}x{sz})")

# 5. iOS Asset Catalog Icons
print("\n--- Generating iOS AppIcon Catalog ---")
ios_iconset = os.path.join(ROOT_DIR, 'ios', 'AloAI', 'Assets.xcassets', 'AppIcon.appiconset')
os.makedirs(ios_iconset, exist_ok=True)

ios_sizes = {
    'app_icon_1024.png': 1024,
    'app_icon_180.png': 180,
    'app_icon_167.png': 167,
    'app_icon_152.png': 152,
    'app_icon_120.png': 120,
    'app_icon_87.png': 87,
    'app_icon_80.png': 80,
    'app_icon_76.png': 76,
    'app_icon_60.png': 60,
    'app_icon_58.png': 58,
    'app_icon_40.png': 40,
    'app_icon_29.png': 29,
    'app_icon_20.png': 20,
}

for name, sz in ios_sizes.items():
    # Apple AppIcon requires solid background without alpha
    icon_img = render_icon(sz, bg_mode='square', glyph_scale=0.72)
    rgb_icon = Image.new('RGB', (sz, sz), (9, 9, 11))
    rgb_icon.paste(icon_img, (0, 0), icon_img)
    rgb_icon.save(os.path.join(ios_iconset, name), 'PNG')
    print(f"Saved iOS {name} ({sz}x{sz})")

# 6. Copy All New Assets into logo/ Folder for Reference and Completeness
print("\n--- Syncing to logo/ Directory ---")
logo_dir = os.path.join(ROOT_DIR, 'logo')
assets_to_sync = [
    'favicon.ico', 'favicon.svg', 'favicon.png', 'favicon-32x32.png', 'favicon-16x16.png',
    'apple-touch-icon.png', 'app_logo.png', 'app_logo_transparent.png', 'app_logo_transparent_black.png',
    'app_logo.svg', 'app_logo_transparent.svg'
]

for asset in assets_to_sync:
    src_file = os.path.join(ROOT_DIR, asset)
    dst_file = os.path.join(logo_dir, asset)
    if os.path.exists(src_file):
        shutil.copy2(src_file, dst_file)
        print(f"Synced {asset} to logo/")

print("\n=== Brand Asset Generation Complete Successfully! ===")
