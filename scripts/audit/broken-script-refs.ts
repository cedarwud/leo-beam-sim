/**
 * Fails when a package.json script points at a file that does not exist.
 *
 * Why this exists: a ~15,000-line MODQN removal deleted 13 validator files but
 * left their npm scripts behind. Nothing caught it. `tsc` cannot — an npm script
 * is a string, not code — and no test runs a validator that no longer exists.
 * The orphans were found only because a human asked "are you sure it is clean?".
 *
 * ## The bug this file was born with, kept as a comment because it is the point
 *
 * The first version of this check reported 107 broken references. All but 13
 * were false, from its own regex:
 *
 *     /\.(ts|tsx|mjs|js)/     <-- `ts` alternates before `tsx`
 *
 * so `foo.tsx` matched as `foo.ts` plus a stray `x`, and every .tsx validator in
 * the repo looked missing. Alternation order in a regex is not cosmetic. The
 * fix is to put the longer extension first and anchor the end:
 *
 *     /\.(?:tsx|ts|mjs|js)(?=\s|$|")/
 *
 * A checker that cries wolf on 94 healthy scripts is worse than no checker: the
 * next person learns to ignore it.
 */
import * as fs from 'node:fs';

interface Broken { readonly script: string; readonly path: string }

const REFERENCE = /(?:scripts|src)\/[A-Za-z0-9._/-]+?\.(?:tsx|ts|mjs|js)(?=\s|$|")/g;

export function findBrokenScriptRefs(scripts: Record<string, string>): Broken[] {
  const broken: Broken[] = [];
  for (const [script, command] of Object.entries(scripts)) {
    for (const path of command.match(REFERENCE) ?? []) {
      if (!fs.existsSync(path)) broken.push({ script, path });
    }
  }
  return broken;
}

const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8')) as { scripts: Record<string, string> };
const broken = findBrokenScriptRefs(pkg.scripts);

if (broken.length === 0) {
  const total = Object.keys(pkg.scripts).length;
  console.log(`broken-script-refs: GREEN — ${total} scripts, every referenced file exists`);
  process.exit(0);
}
console.error(`broken-script-refs: ${broken.length} script(s) point at a missing file`);
for (const b of broken) console.error(`  ${b.script} -> ${b.path}`);
process.exit(1);
