import glob
import re

html_files = sorted(glob.glob('*.html'))

def inspect_file(fname):
    with open(fname, 'r', encoding='utf-8') as f:
        content = f.read()
        lines = content.splitlines()

    issues = []

    # 1. Look for addEventListener without null checks
    # Regex for variable.addEventListener or chain.addEventListener
    # Cases like: document.getElementById('x').addEventListener (without ?.)
    matches = re.finditer(r'document\.(getElementById|querySelector|querySelectorAll)\s*\([^)]+\)\.addEventListener', content)
    for m in matches:
        line_no = content[:m.start()].count('\n') + 1
        issues.append(('UNSAFE_DIRECT_LISTENER', line_no, m.group(0)))

    # Look for: const/let/var x = document.getElementById(...); followed by x.addEventListener without ?. and without if (x)
    var_assigns = re.finditer(r'(?:const|let|var)\s+([a-zA-Z0-9_$]+)\s*=\s*document\.(getElementById|querySelector)\s*\(([^)]+)\);', content)
    for m in var_assigns:
        var_name = m.group(1)
        elem_selector = m.group(3)
        # Search ahead
        start = m.end()
        end = min(len(content), start + 2500)
        scope = content[start:end]
        
        # Check if var_name.addEventListener is called
        call_match = re.search(r'\b' + re.escape(var_name) + r'\.addEventListener\b', scope)
        if call_match:
            # Check if there is if (var_name) or var_name && or var_name?.
            prefix = scope[:call_match.start()]
            has_check = bool(re.search(r'\bif\s*\(\s*' + re.escape(var_name) + r'\b', prefix) or
                            re.search(r'\b' + re.escape(var_name) + r'\s*&&', prefix) or
                            re.search(r'\bif\s*\([^)]*\b' + re.escape(var_name) + r'\b', prefix))
            if not has_check:
                line_no = content[:start + call_match.start()].count('\n') + 1
                issues.append(('UNCHECKED_VAR_LISTENER', line_no, f"{var_name} ({elem_selector}).addEventListener"))

    # 2. LocalStorage keys
    # Search for all strings passed to localStorage
    storage_matches = re.findall(r'localStorage\.(?:getItem|setItem|removeItem)\s*\(\s*["\']([^"\']+)["\']', content)
    
    # 3. Fetch calls and 401 handling
    fetches = []
    fetch_matches = re.finditer(r'\bfetch\s*\(([^)]+)\)', content)
    for fm in fetch_matches:
        f_line = content[:fm.start()].count('\n') + 1
        fetches.append((f_line, fm.group(0)[:80]))

    # Check if 401 is handled in fetch response
    has_401 = '401' in content or 'Unauthorized' in content or 'status === 401' in content

    # 4. Modals and overlay pointer-events/display
    # Check overlays: style="... display: none ..." or class overlay with display: none / pointer-events
    # Also check if any overlay has opacity: 0 without pointer-events: none
    
    return {
        'issues': issues,
        'storage_keys': set(storage_matches),
        'fetches': fetches,
        'has_401': has_401
    }

print("RUNNING COMPREHENSIVE SCANNER...\n")
all_keys = set()
for f in html_files:
    res = inspect_file(f)
    all_keys.update(res['storage_keys'])
    print(f"=== {f} ===")
    print(f"  Fetches count: {len(res['fetches'])}, Handles 401: {res['has_401']}")
    if res['issues']:
        print(f"  Listener issues ({len(res['issues'])}):")
        for itype, lno, snippet in res['issues']:
            print(f"    Line {lno} [{itype}]: {snippet}")
    else:
        print("  No obvious unchecked listener issues found.")

print("\nALL STORAGE KEYS FOUND:")
for k in sorted(all_keys):
    print(f"  - {k}")
