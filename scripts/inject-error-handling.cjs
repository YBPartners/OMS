// ============================================================
// R12 에러 핸들링 주입기 v2 — 안전한 AST-free brace matcher
// 문자열/템플릿 리터럴을 정확히 스킵하며 함수 끝을 찾음
// ============================================================
const fs = require('fs');
const path = require('path');

const dir = 'public/static/js/pages';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.js'));

let totalWrapped = 0;

function findFuncEnd(code, startPos) {
  // startPos: position of opening { of the function body
  let depth = 0;
  let i = startPos;
  
  while (i < code.length) {
    const ch = code[i];
    
    // Skip template literals (backticks)
    if (ch === '`') {
      i++;
      while (i < code.length) {
        if (code[i] === '\\') { i += 2; continue; }
        if (code[i] === '$' && code[i+1] === '{') {
          // Nested expression in template - count braces
          i += 2;
          let exprDepth = 1;
          while (i < code.length && exprDepth > 0) {
            if (code[i] === '`') {
              // Nested template literal inside expression
              i++;
              while (i < code.length && code[i] !== '`') {
                if (code[i] === '\\') { i++; }
                if (code[i] === '$' && code[i+1] === '{') {
                  // Double-nested template
                  i += 2;
                  let nd = 1;
                  while (i < code.length && nd > 0) {
                    if (code[i] === '{') nd++;
                    else if (code[i] === '}') nd--;
                    if (nd > 0) i++;
                  }
                }
                i++;
              }
              i++; // skip closing `
              continue;
            }
            if (code[i] === '{') exprDepth++;
            else if (code[i] === '}') exprDepth--;
            if (exprDepth > 0) i++;
          }
          i++; // skip closing }
          continue;
        }
        if (code[i] === '`') break;
        i++;
      }
      i++; // skip closing `
      continue;
    }
    
    // Skip single-quoted strings
    if (ch === "'") {
      i++;
      while (i < code.length && code[i] !== "'") {
        if (code[i] === '\\') i++;
        i++;
      }
      i++; // skip closing '
      continue;
    }
    
    // Skip double-quoted strings
    if (ch === '"') {
      i++;
      while (i < code.length && code[i] !== '"') {
        if (code[i] === '\\') i++;
        i++;
      }
      i++; // skip closing "
      continue;
    }
    
    // Skip single-line comments
    if (ch === '/' && code[i+1] === '/') {
      while (i < code.length && code[i] !== '\n') i++;
      continue;
    }
    
    // Skip multi-line comments
    if (ch === '/' && code[i+1] === '*') {
      i += 2;
      while (i < code.length && !(code[i] === '*' && code[i+1] === '/')) i++;
      i += 2;
      continue;
    }
    
    // Count braces
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return i; // Found function end
    }
    
    i++;
  }
  return -1; // Not found
}

for (const file of files) {
  const filePath = path.join(dir, file);
  let code = fs.readFileSync(filePath, 'utf8');
  
  // Find all async functions that need wrapping
  const funcRegex = /^([ \t]*)(async\s+function\s+(\w+)\s*\([^)]*\)\s*\{)/gm;
  let match;
  const targets = [];
  
  while ((match = funcRegex.exec(code)) !== null) {
    const indent = match[1];
    const funcHeader = match[2];
    const funcName = match[3];
    const funcBodyStart = match.index + match[0].length;
    
    // Find the opening { position
    const openBracePos = match.index + match[0].lastIndexOf('{');
    
    // Check if next non-whitespace lines already have try {
    const afterOpen = code.substring(funcBodyStart, funcBodyStart + 100).trimStart();
    if (afterOpen.startsWith('try')) continue; // Already has try
    
    // Check if function uses apiAction
    const funcEnd = findFuncEnd(code, openBracePos);
    if (funcEnd === -1) {
      console.log(`  WARN: ${file}:${funcName} - cannot find end`);
      continue;
    }
    
    const funcBody = code.substring(funcBodyStart, funcEnd);
    const usesApiAction = funcBody.includes('apiAction(');
    
    // Skip functions that only use apiAction (already protected)
    if (usesApiAction && funcBody.split('\n').length < 15) continue;
    
    targets.push({
      funcName,
      indent,
      bodyStart: funcBodyStart,
      bodyEnd: funcEnd,
      usesApiAction,
      hasElParam: funcHeader.includes('(el') || funcHeader.includes('( el'),
    });
  }
  
  if (targets.length === 0) continue;
  
  // Apply in reverse order to maintain positions
  let newCode = code;
  let wrapped = 0;
  
  for (let i = targets.length - 1; i >= 0; i--) {
    const t = targets[i];
    const innerIndent = t.indent + '  ';
    
    // Determine error handler based on function type
    let catchBody;
    if (t.hasElParam) {
      // Render functions with el parameter - show error UI
      catchBody = `${innerIndent}console.error('[${t.funcName}]', e);\n${innerIndent}el.innerHTML = '<div class="p-8 text-center text-red-500"><i class="fas fa-exclamation-triangle text-3xl mb-3"></i><p>로드 실패</p><p class="text-xs mt-1 text-gray-400">' + (e.message||e) + '</p></div>';`;
    } else {
      // Other functions - toast
      catchBody = `${innerIndent}console.error('[${t.funcName}]', e);\n${innerIndent}if (typeof showToast === 'function') showToast('처리 실패: ' + (e.message||e), 'error');`;
    }
    
    // Insert try { after function opening brace
    const tryOpen = `\n${t.indent}  try {`;
    // Insert } catch before function closing brace
    const catchClose = `\n${t.indent}  } catch (e) {\n${catchBody}\n${t.indent}  }\n`;
    
    // Insert catch before closing }
    newCode = newCode.substring(0, t.bodyEnd) + catchClose + newCode.substring(t.bodyEnd);
    // Insert try after opening {
    newCode = newCode.substring(0, t.bodyStart) + tryOpen + newCode.substring(t.bodyStart);
    
    wrapped++;
  }
  
  if (wrapped > 0) {
    fs.writeFileSync(filePath, newCode, 'utf8');
    totalWrapped += wrapped;
    console.log(`${file}: ${wrapped} functions wrapped`);
  }
}

console.log(`\nTotal: ${totalWrapped} functions wrapped`);
