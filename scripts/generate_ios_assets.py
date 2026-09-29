import os
from PIL import Image

ios_assets_dir = os.path.join('ios', 'AloAI', 'Assets.xcassets', 'AppIcon.appiconset')
os.makedirs(ios_assets_dir, exist_ok=True)

# Master 1024x1024 dark logo
img_master = Image.open('master_app_logo_1024.png')

# Save 1024x1024
img_master.save(os.path.join(ios_assets_dir, 'app_icon_1024.png'), 'PNG')

# Generate all required iOS icon sizes
ios_sizes = {
    'app_icon_180.png': 180,
    'app_icon_120.png': 120,
    'app_icon_87.png': 87,
    'app_icon_58.png': 58,
    'app_icon_60.png': 60,
    'app_icon_40.png': 40,
    'app_icon_167.png': 167,
    'app_icon_152.png': 152,
    'app_icon_76.png': 76
}

for filename, size in ios_sizes.items():
    resized = img_master.resize((size, size), Image.Resampling.LANCZOS)
    resized.save(os.path.join(ios_assets_dir, filename), 'PNG')
    print(f"Generated {filename} ({size}x{size})")

contents_json = '''{
  "images" : [
    {
      "idiom" : "iphone",
      "scale" : "2x",
      "size" : "20x20",
      "filename" : "app_icon_40.png"
    },
    {
      "idiom" : "iphone",
      "scale" : "3x",
      "size" : "20x20",
      "filename" : "app_icon_60.png"
    },
    {
      "idiom" : "iphone",
      "scale" : "2x",
      "size" : "29x29",
      "filename" : "app_icon_58.png"
    },
    {
      "idiom" : "iphone",
      "scale" : "3x",
      "size" : "29x29",
      "filename" : "app_icon_87.png"
    },
    {
      "idiom" : "iphone",
      "scale" : "2x",
      "size" : "40x40",
      "filename" : "app_icon_80.png"
    },
    {
      "idiom" : "iphone",
      "scale" : "3x",
      "size" : "40x40",
      "filename" : "app_icon_120.png"
    },
    {
      "idiom" : "iphone",
      "scale" : "2x",
      "size" : "60x60",
      "filename" : "app_icon_120.png"
    },
    {
      "idiom" : "iphone",
      "scale" : "3x",
      "size" : "60x60",
      "filename" : "app_icon_180.png"
    },
    {
      "idiom" : "ipad",
      "scale" : "1x",
      "size" : "20x20",
      "filename" : "app_icon_20.png"
    },
    {
      "idiom" : "ipad",
      "scale" : "2x",
      "size" : "20x20",
      "filename" : "app_icon_40.png"
    },
    {
      "idiom" : "ipad",
      "scale" : "1x",
      "size" : "29x29",
      "filename" : "app_icon_29.png"
    },
    {
      "idiom" : "ipad",
      "scale" : "2x",
      "size" : "29x29",
      "filename" : "app_icon_58.png"
    },
    {
      "idiom" : "ipad",
      "scale" : "1x",
      "size" : "40x40",
      "filename" : "app_icon_40.png"
    },
    {
      "idiom" : "ipad",
      "scale" : "2x",
      "size" : "40x40",
      "filename" : "app_icon_80.png"
    },
    {
      "idiom" : "ipad",
      "scale" : "1x",
      "size" : "76x76",
      "filename" : "app_icon_76.png"
    },
    {
      "idiom" : "ipad",
      "scale" : "2x",
      "size" : "76x76",
      "filename" : "app_icon_152.png"
    },
    {
      "idiom" : "ipad",
      "scale" : "2x",
      "size" : "83.5x83.5",
      "filename" : "app_icon_167.png"
    },
    {
      "idiom" : "ios-marketing",
      "scale" : "1x",
      "size" : "1024x1024",
      "filename" : "app_icon_1024.png"
    }
  ],
  "info" : {
    "author" : "xcode",
    "version" : 1
  }
}'''

# Also generate 20, 29, 80 px icons for completeness
for extra_name, sz in [('app_icon_20.png', 20), ('app_icon_29.png', 29), ('app_icon_80.png', 80)]:
    img_master.resize((sz, sz), Image.Resampling.LANCZOS).save(os.path.join(ios_assets_dir, extra_name), 'PNG')

with open(os.path.join(ios_assets_dir, 'Contents.json'), 'w', encoding='utf-8') as f:
    f.write(contents_json)

print("iOS AppIcon.appiconset generated successfully!")
