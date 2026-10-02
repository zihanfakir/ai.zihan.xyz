import glob
import re

for f in sorted(glob.glob('*.html')):
    with open(f, 'r', encoding='utf-8') as fp:
        for idx, line in enumerate(fp, 1):
            matches = re.findall(r'href=[\'"](account|plans|profile|security|subscription|usage|theme|sound|personalization|language|download|help|redeem|login)[\'"]', line)
            if matches:
                print(f"{f}:{idx}: {matches}")
