const fs = require('fs');
const files = ['account.html', 'admin.html', 'plans.html', 'redeem.html', 'security.html', 'sound.html', 'usage.html', 'index.html'];
const bugs = [];
files.forEach(file => {
    const content = fs.readFileSync(file, 'utf8');
    const lines = content.split('\n');
    lines.forEach((line, i) => {
        const lineNum = i + 1;
        if (line.match(/TODO|FIXME|HACK/i)) {
            bugs.push({ file, lineNum, desc: 'TODO/FIXME comment found', sev: 'Low', line: line.trim() });
        }
        if (line.match(/document\.getElementById\(['"][^'"]+['"]\)\./) && !line.match(/\?\.|\&\&/)) {
            bugs.push({ file, lineNum, desc: 'getElementById used without null check', sev: 'Medium', line: line.trim() });
        }
        if (line.match(/querySelector\(['"][^'"]+['"]\)\./) && !line.match(/\?\.|\&\&/)) {
            bugs.push({ file, lineNum, desc: 'querySelector used without null check', sev: 'Medium', line: line.trim() });
        }
        if (line.match(/await fetch/) && !content.substring(Math.max(0, content.indexOf(line)-500), content.indexOf(line)+500).includes('try')) {
            // Very rudimentary, will refine.
        }
    });
});
console.log(JSON.stringify(bugs, null, 2));
