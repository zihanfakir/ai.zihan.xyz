import glob
import re
import sys

sys.stdout.reconfigure(encoding='utf-8')

for fname in sorted(glob.glob('*.html')):
    with open(fname, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Check for onclick="... "..."
    # A standard attribute matches: onclick="([^"]*)"
    # If immediately after it there are more quotes before >
    matches = re.finditer(r'on[a-z]+="[^"]*"[^>]*"', content)
    for m in matches:
        line_no = content[:m.start()].count('\n') + 1
        # Let's inspect
        matched_str = m.group(0)
        # Check if there is an unescaped double quote inside
        print(f"Suspicious attribute syntax at {fname}:{line_no} -> {matched_str[:100]}")
