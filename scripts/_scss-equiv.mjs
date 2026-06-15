// THROWAWAY render-equivalence checker for the main.scss family-split refactor.
// Compares two COMPILED css files (expanded style). Proves the extraction moved
// rules without dropping/changing/adding any (the multiset of normalized
// top-level rules must be identical) and that no duplicate selector lost an
// occurrence. It does NOT prove cascade-order equivalence for reordered rules —
// that residual is covered by before/after screenshots. Usage:
//   node scripts/_scss-equiv.mjs /tmp/before.css /tmp/after.css
import { readFileSync } from 'node:fs';

function topLevelRules(css) {
  const out = [];
  let depth = 0, buf = '', prelude = null;
  for (let i = 0; i < css.length; i++) {
    const ch = css[i];
    buf += ch;
    if (ch === '{') { if (depth === 0) prelude = buf.slice(0, -1).replace(/\s+/g, ' ').trim(); depth++; }
    else if (ch === '}') { depth--; if (depth === 0) { out.push({ prelude, norm: buf.replace(/\s+/g, ' ').trim() }); buf = ''; prelude = null; } }
  }
  return out;
}

function multiset(arr) {
  const m = new Map();
  for (const r of arr) m.set(r.norm, (m.get(r.norm) || 0) + 1);
  return m;
}

const [aPath, bPath] = process.argv.slice(2);
const a = topLevelRules(readFileSync(aPath, 'utf8'));
const b = topLevelRules(readFileSync(bPath, 'utf8'));
const ma = multiset(a), mb = multiset(b);
let fail = 0;

for (const [k, v] of ma) {
  const w = mb.get(k) || 0;
  if (w !== v) { console.log(`  CHANGED/MISSING (before x${v} after x${w}): ${k.slice(0, 140)}`); fail++; }
}
for (const [k, v] of mb) {
  if (!ma.has(k)) { console.log(`  EXTRA in after: ${k.slice(0, 140)}`); fail++; }
}

// duplicate-prelude occurrence-count must be preserved (a selector defined N
// times must still appear N times — catches a dup being merged/lost).
const seqCount = (arr) => { const m = new Map(); for (const r of arr) m.set(r.prelude, (m.get(r.prelude) || 0) + 1); return m; };
const ca = seqCount(a), cb = seqCount(b);
for (const [p, n] of ca) { if (n > 1 && (cb.get(p) || 0) !== n) { console.log(`  DUP-COUNT changed for "${p}": before ${n} after ${cb.get(p) || 0}`); fail++; } }

console.log(`rules: before=${a.length} after=${b.length}`);
console.log(fail === 0 ? 'EQUIV OK — rule multiset identical (no rule dropped/changed/added)' : `EQUIV FAIL — ${fail} discrepancy(ies)`);
process.exit(fail === 0 ? 0 : 1);
