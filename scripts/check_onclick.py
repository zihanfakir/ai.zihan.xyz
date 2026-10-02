import glob
import re
import sys

# Ensure UTF-8 output
sys.stdout.reconfigure(encoding='utf-8')

for fname in sorted(glob.glob('*.html')):
    with open(fname, 'r', encoding='utf-8') as fp:
        lines = fp.readlines()
    for i, line in enumerate(lines):
        if 'onclick=' in line or 'onload=' in line or 'onerror=' in line or 'onsubmit=' in line:
            # Check for bad quotes like onclick="... "..." ..."
            # Look at quotes after onclick=
            m = re.search(r'onclick="([^"]*)"', line)
            # If line has onclick="... "..." where quotes are nested improperly
            print(f"{fname}:{i+1}: {line.strip()[:140]}")
