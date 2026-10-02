import glob
import re

html_files = sorted(glob.glob('*.html'))

for fname in html_files:
    with open(fname, 'r', encoding='utf-8') as f:
        content = f.read()
        lines = content.splitlines()

    print(f"\n==============================\nAUDITING: {fname}\n==============================")
    
    # Check all getElementById and querySelector followed by addEventListener
    # 1. document.getElementById("foo").addEventListener
    for i, line in enumerate(lines):
        m = re.search(r'document\.getElementById\s*\(\s*["\']([^"\']+)["\']\s*\)\.addEventListener', line)
        if m:
            elem_id = m.group(1)
            # Check if elem_id exists in content as id="elem_id"
            exists = f'id="{elem_id}"' in content or f"id='{elem_id}'" in content
            print(f"Line {i+1}: DIRECT document.getElementById('{elem_id}').addEventListener - In DOM: {exists}")
            
    # 2. Check variable references
    # Pattern: const/let/var x = document.getElementById("foo"); ... x.addEventListener(...)
    assigns = list(re.finditer(r'(?:const|let|var)\s+([a-zA-Z0-9_$]+)\s*=\s*document\.getElementById\s*\(\s*["\']([^"\']+)["\']\s*\)', content))
    for m in assigns:
        var_name = m.group(1)
        elem_id = m.group(2)
        exists = f'id="{elem_id}"' in content or f"id='{elem_id}'" in content
        
        # Check where var_name.addEventListener is called
        call_pattern = re.compile(r'\b' + re.escape(var_name) + r'\.addEventListener\s*\(')
        for call_m in call_pattern.finditer(content):
            # Check if this call happens in scope of this assignment
            call_pos = call_m.start()
            if call_pos > m.start():
                # Check lines between m.end() and call_pos
                between = content[m.end():call_pos]
                # Is there a null check like if (x) or x &&?
                # Also check if optional chaining x?.addEventListener
                is_safe = bool(re.search(r'\bif\s*\([^)]*\b' + re.escape(var_name) + r'\b[^)]*\)', between) or
                              re.search(r'\b' + re.escape(var_name) + r'\s*&&', between) or
                              content[call_m.start()-2:call_m.start()] == '?.')
                call_line = content[:call_pos].count('\n') + 1
                if not is_safe or not exists:
                    print(f"Line {call_line}: var '{var_name}' (id='{elem_id}', in DOM: {exists}) - Checked: {is_safe}")
