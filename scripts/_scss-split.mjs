// THROWAWAY family-extractor for main.scss. Parses the top-level rules and moves
// every rule whose FIRST `.leo-<family>` selector is in TARGET into one partial,
// VERBATIM (rule text unchanged, only relocated). @media/@keyframes/@container
// blocks and non-.leo base rules stay in main.scss. Leading comment lines stick
// to the rule below them. Adds `@use '<partial>'` to the end of the @use block.
// Safety is proven by scripts/_scss-equiv.mjs (rule multiset) + screenshots.
//   node scripts/_scss-split.mjs <comma-families> <partialName>
//   e.g. node scripts/_scss-split.mjs modqn,replay,proof,decision,reward,jobs,objective,hyperparam,integration,boundary modqn
import { readFileSync, writeFileSync } from 'node:fs';

const MAIN = 'src/styles/main.scss';
const [familiesArg, partialName] = process.argv.slice(2);
const TARGET = new Set(familiesArg.split(',').map((s) => s.trim()).filter(Boolean));
const PARTIAL = `src/styles/_${partialName}.scss`;
const USE_LINE = `@use './${partialName}';`;

const lines = readFileSync(MAIN, 'utf8').split('\n');

// --- header: contiguous @use lines (+ interleaved blanks) at the very top ---
let h = 0;
const useLines = [];
while (h < lines.length && (lines[h].startsWith('@use ') || lines[h].trim() === '')) {
  if (lines[h].startsWith('@use ')) useLines.push(lines[h]);
  h++;
}
const body = lines.slice(h);

// --- parse body into units (brace-balanced top-level blocks + leading comments) ---
const units = [];
let i = 0;
const familyOf = (prelude) => { const m = prelude.match(/\.leo-([a-z0-9]+)/); return m ? m[1] : null; };

while (i < body.length) {
  if (body[i].trim() === '') { i++; continue; } // skip blank separators
  const start = i;
  // gather leading comment-only lines (col-0 // or /* ... */)
  let j = i;
  while (j < body.length && (body[j].startsWith('//') || body[j].startsWith('/*'))) {
    if (body[j].startsWith('/*') && !body[j].includes('*/')) { while (j < body.length && !body[j].includes('*/')) j++; }
    j++;
    if (j < body.length && body[j].trim() === '') break; // standalone comment block
  }
  if (j >= body.length || body[j].trim() === '') {
    units.push({ text: body.slice(start, j), kind: 'comment', family: null });
    i = j;
    continue;
  }
  // accumulate the rule (incl leading comments) until brace-balanced
  let depth = 0, opened = false, k = j;
  const preludeParts = [];
  let inPrelude = true;
  for (; k < body.length; k++) {
    const line = body[k];
    if (inPrelude) {
      if (line.includes('{')) { preludeParts.push(line.split('{')[0]); inPrelude = false; }
      else preludeParts.push(line);
    }
    for (const ch of line) { if (ch === '{') { depth++; opened = true; } else if (ch === '}') depth--; }
    if (opened && depth === 0) { k++; break; }
  }
  const prelude = preludeParts.join(' ').replace(/\s+/g, ' ').trim();
  const kind = prelude.startsWith('@') ? 'atrule' : 'rule';
  units.push({ text: body.slice(start, k), kind, family: kind === 'rule' ? familyOf(prelude) : null, prelude });
  i = k;
}

// --- partition ---
const moved = [], stay = [];
for (const u of units) {
  if (u.kind === 'rule' && u.family && TARGET.has(u.family)) moved.push(u);
  else stay.push(u);
}

const blockText = (arr) => arr.flatMap((u) => [...u.text, '']).join('\n').replace(/\n{3,}/g, '\n\n').replace(/\n+$/, '\n');

writeFileSync(PARTIAL, [
  `// ${partialName} family CSS — extracted VERBATIM from main.scss by`,
  `// scripts/_scss-split.mjs (families: ${[...TARGET].join(', ')}). Rules are`,
  `// unchanged, only relocated. Verified render-equivalent (_scss-equiv.mjs) + screenshots.`,
  '',
  blockText(moved),
].join('\n'));

writeFileSync(MAIN, [
  [...useLines, USE_LINE].join('\n'),
  '',
  blockText(stay),
].join('\n'));

console.log(`moved ${moved.length} rules -> ${PARTIAL}`);
console.log(`stayed ${stay.length} units in main.scss`);
const byFam = {};
for (const u of moved) byFam[u.family] = (byFam[u.family] || 0) + 1;
console.log('moved by family:', JSON.stringify(byFam));
