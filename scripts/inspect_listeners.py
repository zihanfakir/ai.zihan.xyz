import glob
import re

html_files = sorted(glob.glob('*.html'))

print("=== CHECKING ALL ADDEVENTLISTENER CALLS ===")
for fname in html_files:
    with open(fname, 'r', encoding='utf-8') as f:
        lines = f.readlines()
    for idx, line in enumerate(lines):
        line_num = idx + 1
        if '.addEventListener' in line:
            # Let's inspect the caller of .addEventListener
            stripped = line.strip()
            # check if it's safe (e.g. ?.addEventListener or inside if (el))
            # look at preceding lines if needed
            print(f"{fname}:{line_num}: {stripped}")
