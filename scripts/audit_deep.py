import glob
import re
import os

html_files = sorted(glob.glob('*.html'))
print(f"Found {len(html_files)} HTML files: {html_files}")

# 1. LocalStorage analysis
storage_pattern = re.compile(r'localStorage\.(getItem|setItem|removeItem)\s*\(\s*["\']([^"\']+)["\']')
key_usage = {}
for fname in html_files:
    with open(fname, 'r', encoding='utf-8') as f:
        content = f.read()
    for match in storage_pattern.finditer(content):
        op, key = match.groups()
        if key not in key_usage:
            key_usage[key] = []
        key_usage[key].append((fname, op))

print("\n=== LOCALSTORAGE KEYS ===")
for key in sorted(key_usage.keys()):
    ops_by_file = {}
    for fname, op in key_usage[key]:
        ops_by_file.setdefault(fname, set()).add(op)
    details = ", ".join(f"{fn} ({'/'.join(sorted(ops))})" for fn, ops in sorted(ops_by_file.items()))
    print(f"- {key}: {details}")

# 2. API_BASE definitions and fetch calls
print("\n=== API_BASE DEFINITIONS ===")
for fname in html_files:
    with open(fname, 'r', encoding='utf-8') as f:
        lines = f.readlines()
    for i, line in enumerate(lines):
        if 'API_BASE' in line or 'API_URL' in line or 'apiUrl' in line:
            if '=' in line and ('http' in line or '/api' in line or 'location' in line):
                print(f"{fname}:{i+1}: {line.strip()}")

# 3. Direct .addEventListener calls on document.getElementById / querySelector without null checks
print("\n=== POTENTIAL NULL DEREFERENCES ON EVENT LISTENERS ===")
listener_patterns = [
    re.compile(r'document\.getElementById\s*\(\s*["\']([^"\']+)["\']\s*\)\.addEventListener'),
    re.compile(r'document\.querySelector\s*\(\s*["\']([^"\']+)["\']\s*\)\.addEventListener'),
]

for fname in html_files:
    with open(fname, 'r', encoding='utf-8') as f:
        lines = f.readlines()
    for i, line in enumerate(lines):
        for pattern in listener_patterns:
            for match in pattern.finditer(line):
                target = match.group(1)
                # Check if it has optional chaining or if it's direct
                print(f"[DIRECT LISTENER] {fname}:{i+1} -> target: {target}")

# 4. Check for variable assignments from getElementById followed by addEventListener without null checks
print("\n=== CHECK VARIABLE getElementById THEN addEventListener ===")
var_assign = re.compile(r'(?:const|let|var)\s+([a-zA-Z0-9_$]+)\s*=\s*document\.getElementById\s*\(\s*["\']([^"\']+)["\']\s*\);')
for fname in html_files:
    with open(fname, 'r', encoding='utf-8') as f:
        text = f.read()
    # Find all assignments
    assignments = list(var_assign.finditer(text))
    for m in assignments:
        var_name = m.group(1)
        elem_id = m.group(2)
        # Search for var_name.addEventListener in following text within ~30 lines
        start_pos = m.end()
        next_chunk = text[start_pos:start_pos+1500]
        # Check if var_name.addEventListener is called without if (var_name)
        pattern_listener = re.compile(r'\b' + re.escape(var_name) + r'\.addEventListener\b')
        if pattern_listener.search(next_chunk):
            # Check if there is an if statement checking var_name before
            # Or if it's optional chaining var_name?.
            pat_safe = re.compile(r'(if\s*\(\s*' + re.escape(var_name) + r'\s*\)|' + re.escape(var_name) + r'\?\.)')
            if not pat_safe.search(next_chunk[:pattern_listener.search(next_chunk).start()]):
                print(f"[UNCHECKED VAR LISTENER] {fname}: var '{var_name}' (id='{elem_id}') called with .addEventListener without prior if-check")
