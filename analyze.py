import re

file_path = r'e:\Alo Ai\index.html'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

lines = content.split('\n')

issues = []

# CSS Performance
for i, line in enumerate(lines):
    if 'animation:' in line or 'transition:' in line:
        if 'height' in line or 'width' in line or 'margin' in line or 'padding' in line or 'top' in line or 'left' in line:
             issues.append(f'Line {i+1}: CSS Animation on layout-triggering property. ({line.strip()})')

# JS Performance
for i, line in enumerate(lines):
    # DOM queries in loops
    if 'for ' in line or 'while ' in line or '.forEach' in line or 'for(' in line or 'while(' in line:
        # Check next few lines for getElementById or querySelector
        for j in range(1, 10):
            if i + j < len(lines):
                if 'document.getElementById' in lines[i+j] or 'document.querySelector' in lines[i+j]:
                    issues.append(f'Line {i+j+1}: DOM query inside loop started at {i+1}. ({lines[i+j].strip()})')
                    
    # Reflow / Layout Thrashing
    if '.style.' in line and i < len(lines) - 1:
        if 'offsetHeight' in lines[i+1] or 'offsetWidth' in lines[i+1] or 'clientHeight' in lines[i+1] or 'clientWidth' in lines[i+1]:
            issues.append(f'Line {i+2}: Potential forced reflow (reading layout property after writing style on line {i+1}).')
            
    # Timers
    if 'setInterval(' in line or 'setTimeout(' in line:
        issues.append(f'Line {i+1}: Timer created. Ensure it is cleared. ({line.strip()})')
        
    if 'addEventListener(\'scroll\'' in line or 'addEventListener(\"scroll\"' in line or 'addEventListener(\'resize\'' in line:
        issues.append(f'Line {i+1}: Scroll/Resize event listener added. Ensure it is debounced/throttled. ({line.strip()})')

    if '.innerHTML += ' in line or '.innerHTML +=' in line:
         issues.append(f'Line {i+1}: innerHTML concatenation can be slow and cause reflows. ({line.strip()})')
         
print(f'Found {len(issues)} potential issues in index.html')
for issue in issues[:100]:
    print(issue)

