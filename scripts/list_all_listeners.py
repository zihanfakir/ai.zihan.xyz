import glob
import re

html_files = sorted(glob.glob('*.html'))

for fname in html_files:
    with open(fname, 'r', encoding='utf-8') as f:
        lines = f.readlines()
    
    print(f"\n=================== {fname} ===================")
    for i, line in enumerate(lines):
        line_num = i + 1
        if '.addEventListener' in line:
            # Let's print line
            print(f"L{line_num:4d}: {line.strip()}")
