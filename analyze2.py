import re

file_path = r'e:\Alo Ai\index.html'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

lines = content.split('\n')
issues = []

def add_issue(category, line_num, desc, impact, fix, line_content):
    issues.append({
        'category': category,
        'line': line_num,
        'desc': desc,
        'impact': impact,
        'fix': fix,
        'content': line_content.strip()
    })

# CSS Performance
for i, line in enumerate(lines):
    if 'animation:' in line or 'transition:' in line:
        if 'height' in line or 'width' in line or 'margin' in line or 'padding' in line or 'top' in line or 'left' in line:
             add_issue('CSS Performance', i+1, 'Animation/transition on layout-triggering property.', 'Medium', 'Use transform (scale, translate) instead of width/height/margin.', line)
    if 'base64,' in line and len(line) > 500:
         add_issue('Resource Loading', i+1, 'Large inline base64 data.', 'Low', 'Move to external asset to reduce HTML bundle size.', line[:100]+'...')

# JS Performance
for i, line in enumerate(lines):
    if 'for ' in line or 'while ' in line or '.forEach' in line or 'for(' in line or 'while(' in line:
        for j in range(1, 10):
            if i + j < len(lines):
                if 'document.getElementById' in lines[i+j] or 'document.querySelector' in lines[i+j]:
                    add_issue('DOM Performance', i+j+1, 'DOM query inside a loop.', 'High', 'Cache the DOM query outside the loop.', lines[i+j])
                    
    if '.style.' in line and i < len(lines) - 1:
        if 'offsetHeight' in lines[i+1] or 'offsetWidth' in lines[i+1] or 'clientHeight' in lines[i+1] or 'clientWidth' in lines[i+1]:
            add_issue('Render Performance', i+2, 'Potential forced reflow (reading layout property after writing style).', 'High', 'Batch DOM reads and writes separately using requestAnimationFrame.', line)
            
    if 'setInterval(' in line or 'setTimeout(' in line:
        # Check if it's assigned to a variable
        if '=' not in line and 'return' not in line:
            add_issue('Memory Leaks', i+1, 'Timer created without storing its ID.', 'Medium', 'Store timer ID and call clearInterval/clearTimeout when appropriate.', line)
        
    if 'addEventListener(\'scroll\'' in line or 'addEventListener(\"scroll\"' in line or 'addEventListener(\'resize\'' in line:
        add_issue('Render Performance', i+1, 'Scroll/Resize event listener added.', 'High', 'Debounce or throttle the event listener to avoid main thread blocking.', line)

    if '.innerHTML +=' in line or '.innerHTML = .innerHTML' in line:
         add_issue('Render Performance', i+1, 'innerHTML concatenation.', 'High', 'Use insertAdjacentHTML or appendChild for better performance and to avoid layout thrashing.', line)

with open('audit_report.txt', 'w', encoding='utf-8') as out:
    for issue in issues:
        out.write(f"[{issue['category']}] Line {issue['line']}: {issue['desc']}\n")
        out.write(f"Impact: {issue['impact']}\n")
        out.write(f"Fix: {issue['fix']}\n")
        out.write(f"Code: {issue['content']}\n\n")

print(f'Wrote {len(issues)} issues to audit_report.txt')
