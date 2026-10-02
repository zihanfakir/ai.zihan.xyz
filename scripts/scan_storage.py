import glob
import re

html_files = sorted(glob.glob('*.html'))
pattern = re.compile(r'localStorage\.[a-zA-Z]+\s*\(\s*["\']([^"\']+)["\']')

print("LOCALSTORAGE CALLS PER FILE:")
for f in html_files:
    with open(f, 'r', encoding='utf-8') as fp:
        c = fp.read()
    matches = pattern.findall(c)
    print(f"\n{f}:")
    for k in sorted(set(matches)):
        print(f"  {k}")

# Also check for variable names passed to localStorage
var_pattern = re.compile(r'localStorage\.[a-zA-Z]+\s*\(\s*([a-zA-Z0-9_$]+)\s*[,)]')
print("\nVARIABLE KEYS PASSED TO LOCALSTORAGE:")
for f in html_files:
    with open(f, 'r', encoding='utf-8') as fp:
        c = fp.read()
    matches = var_pattern.findall(c)
    filtered = [m for m in matches if m not in ['JSON', 'true', 'false', 'null', 'undefined']]
    if filtered:
        print(f"{f}: {set(filtered)}")
