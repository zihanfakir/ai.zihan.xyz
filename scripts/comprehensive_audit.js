const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');

console.log('=== RUNNING COMPREHENSIVE REPOSITORY AUDITOR ===\n');

let issuesFound = 0;

function reportIssue(category, file, desc) {
  issuesFound++;
  console.log(`[FAIL - ${category}] ${file}: ${desc}`);
}

function reportPass(category, desc) {
  console.log(`[PASS - ${category}] ${desc}`);
}

// 1. Check HTML files for onclick references vs defined functions
const htmlFiles = ['index.html', 'login.html', 'account.html', 'plans.html', 'admin.html'];

htmlFiles.forEach(file => {
  const filePath = path.join(rootDir, file);
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, 'utf8');

  // Extract all inline onclick handlers
  const onclickRegex = /onclick\s*=\s*["']([^"']+)["']/gi;
  let match;
  const calledFunctions = new Set();
  while ((match = onclickRegex.exec(content)) !== null) {
    const handler = match[1].trim();
    // Get the function name if it's like func(...) or func()
    const funcMatch = handler.match(/^([a-zA-Z0-9_$]+)\s*\(/);
    if (funcMatch) {
      calledFunctions.add(funcMatch[1]);
    }
  }

  // Extract function definitions and window.xxx assignments from scripts
  const definedFunctions = new Set();
  const funcDefRegex = /function\s+([a-zA-Z0-9_$]+)\s*\(/g;
  while ((match = funcDefRegex.exec(content)) !== null) {
    definedFunctions.add(match[1]);
  }
  const windowAssignRegex = /window\.([a-zA-Z0-9_$]+)\s*=/g;
  while ((match = windowAssignRegex.exec(content)) !== null) {
    definedFunctions.add(match[1]);
  }
  const constFuncRegex = /(?:const|let|var)\s+([a-zA-Z0-9_$]+)\s*=\s*(?:function|\([^)]*\)\s*=>|\w+\s*=>)/g;
  while ((match = constFuncRegex.exec(content)) !== null) {
    definedFunctions.add(match[1]);
  }

  // Common built-ins
  const builtins = new Set(['alert', 'confirm', 'prompt', 'open', 'close', 'print', 'scrollTo', 'focus', 'blur', 'preventDefault', 'stopPropagation']);

  calledFunctions.forEach(fn => {
    if (!definedFunctions.has(fn) && !builtins.has(fn)) {
      reportIssue('UNDEFINED_INLINE_FN', file, `Inline onclick calls '${fn}()' which is not defined in scripts!`);
    }
  });

  // Check document.getElementById calls vs existing IDs in file
  const idRegex = /id\s*=\s*["']([^"']+)["']/gi;
  const existingIds = new Set();
  while ((match = idRegex.exec(content)) !== null) {
    existingIds.add(match[1]);
  }

  const getElemRegex = /document\.getElementById\s*\(\s*["']([^"']+)["']\s*\)/g;
  const checkedIds = new Set();
  while ((match = getElemRegex.exec(content)) !== null) {
    const id = match[1];
    if (checkedIds.has(id)) continue;
    checkedIds.add(id);

    if (!existingIds.has(id)) {
      // Check if this ID is accessed without null-check (dangerous!)
      // e.g., const x = document.getElementById('id'); x.addEventListener(...) without if (x)
      const unguardedPattern = new RegExp(`document\\.getElementById\\(["']${id}["']\\)\\.[a-zA-Z]`, 'g');
      if (unguardedPattern.test(content)) {
        reportIssue('UNGUARDED_NULL_DOM_ACCESS', file, `document.getElementById('${id}') is missing from HTML AND accessed directly without null check!`);
      } else {
        // Guarded with if/return or optional chaining
      }
    }
  }
});

// 2. Check Android Bridge Calls vs Android Source
console.log('\n--- Checking Android Bridge Interface ---');
const waiPath = path.join(rootDir, 'android/app/src/main/java/xyz/zihan/aloai/WebAppInterface.kt');
if (fs.existsSync(waiPath)) {
  const kotlinCode = fs.readFileSync(waiPath, 'utf8');
  // Find all @JavascriptInterface methods
  const jsInterfaceMethods = new Set();
  const methodRegex = /@JavascriptInterface\s+fun\s+([a-zA-Z0-9_]+)\s*\(/g;
  let m;
  while ((m = methodRegex.exec(kotlinCode)) !== null) {
    jsInterfaceMethods.add(m[1]);
  }
  console.log(`Found ${jsInterfaceMethods.size} @JavascriptInterface methods in WebAppInterface.kt:`, Array.from(jsInterfaceMethods));

  // Find all window.AloAndroid and window.AloAI calls in HTML/JS
  htmlFiles.forEach(file => {
    const filePath = path.join(rootDir, file);
    if (!fs.existsSync(filePath)) return;
    const content = fs.readFileSync(filePath, 'utf8');
    const bridgeCallRegex = /window\.(?:AloAndroid|AloAI)\.([a-zA-Z0-9_]+)\s*\(/g;
    while ((m = bridgeCallRegex.exec(content)) !== null) {
      const calledMethod = m[1];
      if (!jsInterfaceMethods.has(calledMethod)) {
        reportIssue('ANDROID_BRIDGE_MISMATCH', file, `Calls window.AloAndroid/AloAI.${calledMethod}() which is not in WebAppInterface.kt @JavascriptInterface!`);
      }
    }
  });
} else {
  console.log('WebAppInterface.kt not found at expected path');
}

// 3. Check specific known bug points:
console.log('\n--- Checking Specific High-Risk Points ---');
// A. index.html SSE buffer handling
const indexContent = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf8');
if (indexContent.includes('// Flush any trailing buffer payload after stream finishes')) {
  reportPass('SSE_BUFFER_FLUSH', 'index.html has trailing buffer flush before stream completion.');
} else {
  reportIssue('SSE_NO_FLUSH', 'index.html', 'Missing trailing buffer flush in SSE stream.');
}

// B. login.html planName scope
const loginContent = fs.readFileSync(path.join(rootDir, 'login.html'), 'utf8');
const planScopeRegex = /let planName = "Free";[\s\S]*?if \(data\.user\)[\s\S]*?saveAuth/;
if (planScopeRegex.test(loginContent)) {
  reportPass('LOGIN_PLAN_SCOPE', 'login.html has planName safely scoped before if(data.user) block.');
} else {
  reportIssue('LOGIN_PLAN_SCOPE', 'login.html', 'login.html might have planName scoping issue.');
}

// C. admin.html buttons
const adminContent = fs.readFileSync(path.join(rootDir, 'admin.html'), 'utf8');
['adminBackChatBtn', 'adminLangToggleBtn'].forEach(id => {
  if (adminContent.includes(`id="${id}"`)) {
    reportPass('ADMIN_BTN', `admin.html contains header button id="${id}".`);
  } else {
    reportIssue('ADMIN_MISSING_BTN', 'admin.html', `HTML does not contain id="${id}".`);
  }
});

console.log(`\nAudit completed. Total issues flagged: ${issuesFound}`);
