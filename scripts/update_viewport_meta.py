import glob
import re

html_files = sorted(glob.glob('*.html'))
for f in html_files:
    with open(f, 'r', encoding='utf-8') as fp:
        content = fp.read()
    
    if 'interactive-widget=' not in content:
        new_content = re.sub(
            r'(<meta\s+name=["\']viewport["\']\s+content=["\'][^"\']+)(["\']>)',
            r'\1, interactive-widget=resizes-content\2',
            content
        )
        if new_content != content:
            with open(f, 'w', encoding='utf-8') as fp:
                fp.write(new_content)
            print(f'Added interactive-widget to {f}')
        else:
            print(f'No match for viewport tag in {f}')
    else:
        print(f'Already has interactive-widget: {f}')
