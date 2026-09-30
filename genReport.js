
const fs = require("fs");
function scanFile(file) {
    const content = fs.readFileSync(file, "utf8");
    const lines = content.split("\n");
    let bugs = [];
    lines.forEach((line, i) => {
        const lineNum = i + 1;
        const trim = line.trim();
        if (trim.includes("console.error(")) {
            bugs.push({ file, lineNum, desc: "console.error found indicating a potential unhandled issue or logging that should be cleaned up.", sev: "Low", fix: "Properly handle the error instead of just logging it, or remove in production.", code: trim });
        }
        if (trim.match(/\/\/\s*(TODO|FIXME|HACK)/)) {
            bugs.push({ file, lineNum, desc: "TODO/FIXME comment indicating technical debt or known bug.", sev: "Low", fix: "Resolve the issue mentioned in the comment.", code: trim });
        }
        if (trim.match(/(document\.getElementById|querySelector)\([\x27\x22][^\x27\x22]+[\x27\x22]\)\.(value|textContent|innerHTML|style|addEventListener|classList|src|disabled)/) && !trim.includes("?.")) {
            bugs.push({ file, lineNum, desc: "DOM element accessed directly without null check. Can cause TypeError if element is missing.", sev: "Medium", fix: "Use optional chaining (e.g. element?.value) or check for null before accessing.", code: trim });
        }
        if (trim.match(/\.catch\(\s*\(\)\s*=>\s*\{\s*\}\s*\)/) || trim.match(/\.catch\(\s*\(\)\s*=>\s*\(\{\}\)\s*\)/)) {
            bugs.push({ file, lineNum, desc: "Empty catch block or silently swallowing promise rejection.", sev: "High", fix: "Handle the error properly, e.g., show a user-facing error message or fallback state.", code: trim });
        }
        if (trim.match(/localStorage\.(setItem|getItem)/) && !content.substring(Math.max(0, content.indexOf(line)-200), content.indexOf(line)+200).includes("try")) {
            bugs.push({ file, lineNum, desc: "localStorage operation not wrapped in try-catch. Can throw QuotaExceededError or SecurityError.", sev: "High", fix: "Wrap localStorage operations in try-catch blocks.", code: trim });
        }
    });
    return bugs;
}
const files = ["account.html", "admin.html", "plans.html", "redeem.html", "security.html", "sound.html", "usage.html", "index.html"];
let allBugs = [];
files.forEach(f => {
    try { allBugs = allBugs.concat(scanFile(f)); } catch(e){}
});
let md = "# Security and Bug Audit Report\n\n";
allBugs.forEach(b => {
    md += "- **File**: `" + b.file + "`, Line: ~" + b.lineNum + "\n";
    md += "  - **Description**: " + b.desc + "\n";
    md += "  - **Severity**: " + b.sev + "\n";
    md += "  - **Suggested Fix**: " + b.fix + "\n";
    md += "  - *Code snippet*: `" + b.code.substring(0, 100) + "`\n\n";
});
fs.writeFileSync("audit_report.md", md, "utf8");

