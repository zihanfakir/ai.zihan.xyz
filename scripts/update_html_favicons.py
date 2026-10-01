import glob
import re

new_favicon_block = '''  <link rel="icon" type="image/svg+xml" href="favicon.svg?v=3">
  <link rel="icon" type="image/png" sizes="32x32" href="favicon-32x32.png?v=3">
  <link rel="icon" type="image/png" sizes="16x16" href="favicon-16x16.png?v=3">
  <link rel="shortcut icon" href="favicon.ico?v=3">
  <link rel="apple-touch-icon" sizes="180x180" href="apple-touch-icon.png?v=3">'''

pattern_multi = re.compile(
    r'[ \t]*<link rel="icon" type="image/png" href="favicon\.png">\s*'
    r'[ \t]*<link rel="shortcut icon" type="image/png" href="app_logo\.png">\s*'
    r'[ \t]*<link rel="apple-touch-icon" href="app_logo\.png">',
    re.MULTILINE
)

pattern_single = re.compile(
    r'[ \t]*<link rel="icon" type="image/png" href="favicon\.png">',
    re.MULTILINE
)

html_files = sorted(glob.glob('*.html'))
updated_count = 0

for filepath in html_files:
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    new_content = content
    if pattern_multi.search(new_content):
        new_content = pattern_multi.sub(new_favicon_block, new_content, count=1)
        print(f"Updated multi-icon block in {filepath}")
    elif pattern_single.search(new_content):
        new_content = pattern_single.sub(new_favicon_block, new_content, count=1)
        print(f"Updated single-icon block in {filepath}")
    else:
        print(f"WARNING: No matching icon block found in {filepath}")
        continue

    if new_content != content:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(new_content)
        updated_count += 1

print(f"\nSuccessfully updated {updated_count}/{len(html_files)} HTML files.")
