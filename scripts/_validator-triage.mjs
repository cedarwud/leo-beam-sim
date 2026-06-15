// THROWAWAY: run every STATIC leaf validate:* script, record pass/fail.
// Reveals how many of the ~128 non-governance:full static validators have
// silently rotted (the recurrence problem). Output: red list + census.
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const pkg = JSON.parse(readFileSync('package.json', 'utf8')).scripts;
const leaf = Object.keys(pkg).filter((k) => k.startsWith('validate:') && !pkg[k].includes('&&') && pkg[k].includes('node --import'));

const items = [];
for (const k of leaf) {
  const m = pkg[k].match(/scripts\/(\S+)/);
  if (!m) continue;
  let src = '';
  try { src = readFileSync('scripts/' + m[1], 'utf8'); } catch { continue; }
  if (/chromium|playwright|newPage|APP_URL/.test(src)) continue; // skip browser
  items.push({ key: k, file: m[1] });
}

const red = [], green = [];
for (const it of items) {
  try {
    execFileSync('node', ['--import', 'tsx/esm', 'scripts/' + it.file], { stdio: 'pipe', timeout: 60000 });
    green.push(it.key);
  } catch (e) {
    const tail = (e.stdout?.toString() || '' + e.stderr?.toString() || '').split('\n').filter((l) => /Assertion|FAIL|Error|expected/i.test(l)).slice(-1)[0] || (e.message || '').slice(0, 120);
    red.push({ key: it.key, why: tail.trim().slice(0, 160) });
  }
}

console.log(`\n===== STATIC VALIDATOR TRIAGE: ${green.length} GREEN / ${red.length} RED (of ${items.length}) =====`);
console.log('\n--- RED (silently rotted) ---');
for (const r of red) console.log(`  ✗ ${r.key}\n      ${r.why}`);
console.log(`\nGREEN count: ${green.length}`);
