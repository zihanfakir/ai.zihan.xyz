import glob
import re

for f in sorted(glob.glob('*.html')):
    with open(f, 'r', encoding='utf-8') as fp:
        for idx, line in enumerate(fp, 1):
            matches = re.findall(r'<([a-zA-Z0-9\-]+)(\s+[^>]+)>', line)
            for tag, tag_body in matches:
                attrs = re.findall(r'\b([a-zA-Z0-9\-]+)\s*=\s*[\'"][^\'"]*[\'"]', tag_body)
                seen = set()
                dups = [a for a in attrs if a in seen or seen.add(a)]
                if dups:
                    print(f"{f}:{idx}: <{tag}> duplicate attribute(s): {dups}")
