#!/usr/bin/env node

// validate:modqn:decode-parity — the decode-port parity gate.
//
// Locks the pure-TS decode engine (src/modqn/decode/) bit-for-bit against the
// FROZEN producer decode (route_b_factorial/auction_decode.py) and the recorded
// dense-Q window. This is the decode version of the vendor-on-demand rule:
// source-side Python golden oracle + zero-drift gate.
//
// Coverage:
//   [purity]     src/modqn/decode/ imports nothing from react/three/viz/app/scene.
//   [provenance] every golden carries a producer-rev provenance header (blocks a
//                hand-edited golden).
//   [goldens]    each golden's TS decode deep-equals the Python expected output
//                (incl. auction audit) AND is deterministic (re-run identical).
//   [fixture a]  real dense-q window: argmax(masked scalarizedQByAction) reproduces
//                selectedActionIndex for all 1000 rows (self-check).
//   [fixture b]  real dense-q window: TS scalarize(objectiveQByAction, recorded ω)
//                matches the exported scalarizedQByAction (rel 1e-6) and re-argmaxes
//                to the same selected action.
//
// Goldens / purity / provenance are data-free and ALWAYS run (hosted CI included);
// only the real-window fixtures skip — visibly — when the /tmp staging is absent.
//
// Assertions are BEHAVIORAL (run fixtures, compare outputs) — NOT source-pinned
// string greps (frontend-change-contract Rule 4). The two structural asserts
// (purity, provenance) guard the engine's boundary + the golden's authenticity.
//
// Discovered automatically by validate:static:all (node --import, no '&&').

import assert from 'node:assert/strict';
import { createReadStream, existsSync, readFileSync, readdirSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  decodeA0Argmax,
  decodeAfPhysicalAuction,
  scalarizeMatrix,
  scalarizeRow,
  valuation,
  vMatrixFromNested,
  vMatrixToNested,
  type DecodeGolden,
} from '../src/modqn/decode/index.ts';
import { skipIfDataUnavailable } from './lib/ci-data-guard.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = dirname(HERE);
const DECODE_DIR = join(REPO_ROOT, 'src/modqn/decode');
const GOLDENS_DIR = join(DECODE_DIR, 'fixtures/goldens');

// Real dense-q window — staged via the same /tmp symlink convention as phase7e.
// /tmp is cleared on reboot, so the error path prints the exact rebuild command.
const STAGING = '/tmp/leo-beam-sim/modqn-bundles/dense-q-proof-window-600-130';
const PRODUCER_TARGET =
  '/home/u24/papers/modqn-paper-reproduction/artifacts/dense-q-proof-window-600-130';
const TIMELINE = join(STAGING, 'timeline/step-trace.jsonl');
const EXPECTED_ROWS = 1000;

// CI-environment guard (P2 SN-3c; placement fixed 2026-07-10): the staged /tmp
// symlink is the data contract of the REAL-WINDOW section ONLY. The committed
// goldens + purity + provenance sections are data-free and must run
// UNCONDITIONALLY — including on a hosted CI runner — so a decode-engine
// regression can never ride a data-unavailable skip through CI. The guard
// therefore fires in main() right before the data-dependent section (a
// pre-guard assert failure exits 1, so a real red can never be mislabeled as a
// skip). See scripts/lib/ci-data-guard.ts for the SKIP semantics.
function skipRealWindowIfUnstaged(): void {
  skipIfDataUnavailable([{
    path: TIMELINE,
    why: 'staged dense-Q proof window for real-data decode parity '
      + '(goldens/purity/provenance DID run and pass before this skip) — /tmp cleared on reboot; '
      + `restore: npm run stage:h2 (or ln -sfn ${PRODUCER_TARGET} ${STAGING})`,
  }]);
}

// -inf-aware float compare for nested (number|null)[][] (null == -Infinity).
function assertNestedClose(
  actual: (number | null)[][],
  expected: ReadonlyArray<ReadonlyArray<number | null>>,
  tol: number,
  label: string,
): void {
  assert.equal(actual.length, expected.length, `${label}: row count`);
  for (let i = 0; i < expected.length; i += 1) {
    assert.equal(actual[i].length, expected[i].length, `${label}: row ${i} length`);
    for (let j = 0; j < expected[i].length; j += 1) {
      const e = expected[i][j];
      const a = actual[i][j];
      if (e === null) {
        assert.equal(a, null, `${label}: [${i}][${j}] expected -inf`);
      } else {
        assert.ok(a !== null, `${label}: [${i}][${j}] expected finite ${e}, got -inf`);
        const diff = Math.abs((a as number) - e);
        assert.ok(
          diff <= tol * Math.max(1, Math.abs(e)),
          `${label}: [${i}][${j}] ${a} vs ${e} (diff ${diff} > tol)`,
        );
      }
    }
  }
}

// Run a golden's TS decode; returns a comparable, serialisable result.
function runGolden(g: DecodeGolden): unknown {
  switch (g.kind) {
    case 'valuation': {
      const v = valuation(g.inputs.channelQuality!, g.inputs.masks!, g.inputs.nActions!);
      return { V: vMatrixToNested(v) };
    }
    case 'argmax': {
      const v = vMatrixFromNested(g.inputs.V!);
      return { argmaxOut: decodeA0Argmax(v) };
    }
    case 'scalarize-argmax': {
      const v = scalarizeMatrix(
        g.inputs.objectiveQByAction!,
        g.inputs.objectiveWeights!,
        g.inputs.mask!,
        g.inputs.invalidActionSentinel,
      );
      return { scalarized: vMatrixToNested(v), argmaxOut: decodeA0Argmax(v) };
    }
    case 'auction': {
      const v = vMatrixFromNested(g.inputs.V!);
      const res = decodeAfPhysicalAuction(v, g.inputs.slotCell!, g.params!, { returnAudit: true });
      return { auctionOut: res.out, audit: res.audit };
    }
    default:
      throw new Error(`unknown golden kind ${JSON.stringify((g as DecodeGolden).kind)}`);
  }
}

function assertGoldenMatches(g: DecodeGolden, result: any): void {
  const id = g.provenance.caseId;
  switch (g.kind) {
    case 'valuation':
      // log2 may differ by a ULP across numpy/JS; compare values with a tight
      // tolerance AND require the -inf placement + the resulting argmax to match.
      assertNestedClose(result.V, g.expected.V!, 1e-9, `${id} V`);
      assert.deepEqual(
        decodeA0Argmax(vMatrixFromNested(result.V)),
        decodeA0Argmax(vMatrixFromNested(g.expected.V!)),
        `${id}: valuation argmax parity`,
      );
      break;
    case 'argmax':
      assert.deepEqual(result.argmaxOut, g.expected.argmaxOut, `${id}: argmax`);
      break;
    case 'scalarize-argmax':
      assertNestedClose(result.scalarized, g.expected.scalarized!, 1e-9, `${id} scalarized`);
      assert.deepEqual(result.argmaxOut, g.expected.argmaxOut, `${id}: scalarize argmax`);
      break;
    case 'auction':
      assert.deepEqual(result.auctionOut, g.expected.auctionOut, `${id}: auction out`);
      assert.deepEqual(result.audit, g.expected.audit, `${id}: auction audit`);
      break;
    default:
      throw new Error(`unknown golden kind ${JSON.stringify((g as DecodeGolden).kind)}`);
  }
}

function checkPurity(): void {
  const forbidden = /^(react|three)(\/|$)/;
  const forbiddenPath = /(?:^|\/)(?:viz|app|scene)\//;
  const importRe = /(?:import|export)[^'"]*?from\s+['"]([^'"]+)['"]/g;
  const files = readdirSync(DECODE_DIR).filter((f) => f.endsWith('.ts'));
  assert.ok(files.length >= 4, 'decode module has its source files');
  for (const file of files) {
    const src = readFileSync(join(DECODE_DIR, file), 'utf8');
    let m: RegExpExecArray | null;
    // eslint-disable-next-line no-cond-assign
    while ((m = importRe.exec(src)) !== null) {
      const spec = m[1];
      assert.ok(
        !forbidden.test(spec) && !forbiddenPath.test(spec),
        `PURITY: src/modqn/decode/${file} imports forbidden module '${spec}' (no react/three/viz/app/scene in the decode engine)`,
      );
    }
  }
  console.log(`  [purity] ${files.length} decode source files clean (no render deps)`);
}

function loadGoldens(): DecodeGolden[] {
  assert.ok(existsSync(GOLDENS_DIR), `goldens dir missing: ${GOLDENS_DIR} (run: python3 scripts/gen-decode-goldens.py)`);
  const files = readdirSync(GOLDENS_DIR).filter((f) => f.endsWith('.json')).sort();
  assert.ok(files.length > 0, 'at least one golden fixture exists');
  return files.map((f) => {
    const g = JSON.parse(readFileSync(join(GOLDENS_DIR, f), 'utf8')) as DecodeGolden;
    // [provenance] a hand-edited golden without a real header is rejected.
    const p = g.provenance;
    assert.ok(p && typeof p === 'object', `${f}: missing provenance`);
    for (const key of ['producerRev', 'sourcePath', 'generatedAt', 'caseId'] as const) {
      assert.ok(typeof p[key] === 'string' && p[key].length > 0, `${f}: provenance.${key} missing`);
    }
    assert.equal(`${p.caseId}.json`, f, `${f}: provenance.caseId must equal the filename stem`);
    return g;
  });
}

function runGoldenParity(goldens: DecodeGolden[]): void {
  const byId = new Map<string, unknown>();
  for (const g of goldens) {
    const first = runGolden(g);
    assertGoldenMatches(g, first);
    // [determinism] a second run must be byte-identical (no hidden state / RNG).
    const second = runGolden(g);
    assert.deepEqual(second, first, `${g.provenance.caseId}: non-deterministic decode`);
    byId.set(g.provenance.caseId, first);
  }
  // per-user additive-offset invariance cross-check (shift-on).
  const base = byId.get('auction-offset-base') as any;
  const shifted = byId.get('auction-offset-shifted') as any;
  if (base && shifted) {
    assert.deepEqual(
      shifted.auctionOut,
      base.auctionOut,
      'per-user additive Q offset must not change the shift-on assignment (FOLD-2 invariance)',
    );
  }
  console.log(`  [goldens] ${goldens.length} golden cases parity + determinism OK`);
}

// A shape-2 auction golden is a scalarize-argmax golden that ALSO carries the
// physical-auction payload (slotCell + params + expected auctionOut/audit). The
// generic scalarize-argmax path above already locks the argmax-anchor; this block
// locks the full shape-2 chain on REAL leo-verified H2 dense-Q: stack the per-user
// 3-objective Q (U×A×3) -> ω scalarize -> decodeAfPhysicalAuction must reproduce the
// RECORDED serving (selectedServing.beamIndex) + auctionAudit. The predicate uniquely
// selects the shape-2 golden — the 18 synthetic goldens either lack objectiveQByAction
// (auction-*) or the auction payload (scalarize-argmax-omega-*).
function isShape2AuctionGolden(g: DecodeGolden): boolean {
  return (
    g.kind === 'scalarize-argmax'
    && Array.isArray(g.inputs.objectiveQByAction)
    && Array.isArray(g.inputs.slotCell)
    && g.params !== undefined
    && Array.isArray(g.expected.auctionOut)
    && g.expected.audit !== undefined
  );
}

function runShape2AuctionFixtures(goldens: DecodeGolden[]): void {
  const shape2 = goldens.filter(isShape2AuctionGolden);
  assert.ok(
    shape2.length >= 1,
    'at least one shape-2 auction golden exists (real leo-verified H2 dense-Q slot)',
  );
  for (const g of shape2) {
    const id = g.provenance.caseId;
    const inp = g.inputs;
    // shape-2: stack the U×A per-action 3-objective Q into a scalarized V (ω·Q).
    const v = scalarizeMatrix(
      inp.objectiveQByAction!,
      inp.objectiveWeights!,
      inp.mask!,
      inp.invalidActionSentinel,
    );
    // the auction decodes the SAME scalarized V the generic scalarize-argmax path froze.
    assertNestedClose(vMatrixToNested(v), g.expected.scalarized!, 1e-9, `${id} shape-2 scalarized`);
    const res = decodeAfPhysicalAuction(v, inp.slotCell!, g.params!, { returnAudit: true });
    assert.deepEqual(res.out, g.expected.auctionOut, `${id}: shape-2 auction out != recorded serving`);
    assert.deepEqual(res.audit, g.expected.audit, `${id}: shape-2 auction audit != recorded audit`);
    // [determinism] a second run must be byte-identical (no hidden state / RNG).
    const res2 = decodeAfPhysicalAuction(v, inp.slotCell!, g.params!, { returnAudit: true });
    assert.deepEqual(res2.out, res.out, `${id}: non-deterministic shape-2 auction out`);
    assert.deepEqual(res2.audit, res.audit, `${id}: non-deterministic shape-2 auction audit`);
    const anchor = g.expected.argmaxOut ?? [];
    const decouple = res.out.filter((s, u) => s !== anchor[u]).length;
    console.log(
      `  [shape-2 auction] ${id}: ${res.out.length} UE ω-scalarize→auction reproduce serving + audit `
        + `${JSON.stringify(res.audit!.openedPerSlot)}/nFallback ${res.audit!.nFallback}; `
        + `decouple ${decouple}/${res.out.length} vs argmax-anchor`,
    );
  }
}

interface RowDiag {
  candidateActionOrder: unknown[];
  decisionActionValidityMask: boolean[];
  objectiveQByAction: Record<string, number>[];
  objectiveWeights: Record<string, number>;
  scalarizedQByAction: number[];
  selectedActionIndex: number;
  invalidActionSentinel?: number;
}

async function runRealDataFixtures(): Promise<void> {
  if (!existsSync(TIMELINE)) {
    throw new Error(
      `real dense-q staging missing: ${TIMELINE}\n`
        + `  (/tmp is cleared on reboot — this is the known-fragile staging convention).\n`
        + `  Re-stage everything: npm run stage:h2\n`
        + `  (or rebuild just this symlink:\n`
        + `    mkdir -p ${dirname(STAGING)}\n`
        + `    ln -sfn ${PRODUCER_TARGET} ${STAGING})`,
    );
  }
  const rl = createInterface({ input: createReadStream(TIMELINE), crlfDelay: Infinity });
  let rows = 0;
  let argmaxMismatch = 0; // fixture a
  let scalarizeMismatch = 0; // fixture b (value)
  let rescalarizeArgmaxMismatch = 0; // fixture b (argmax)
  const REL_TOL = 1e-6;
  for await (const line of rl) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const pd = (JSON.parse(trimmed) as { policyDiagnostics: RowDiag }).policyDiagnostics;
    const mask = pd.decisionActionValidityMask;
    const selected = pd.selectedActionIndex;

    // fixture a: argmax(masked scalarizedQByAction) === selectedActionIndex
    const scRow = pd.scalarizedQByAction.map((x, a) => (mask[a] ? x : null));
    const outA = decodeA0Argmax(vMatrixFromNested([scRow]));
    if (outA[0] !== selected) argmaxMismatch += 1;

    // fixture b: re-scalarize the recorded ω over objectiveQByAction
    const scal = scalarizeRow(pd.objectiveQByAction, pd.objectiveWeights, mask, pd.invalidActionSentinel);
    for (let a = 0; a < mask.length; a += 1) {
      if (!mask[a]) continue;
      const exported = pd.scalarizedQByAction[a];
      if (typeof exported !== 'number' || !Number.isFinite(exported)) continue;
      const diff = Math.abs(scal[a] - exported);
      if (diff > REL_TOL * Math.max(1, Math.abs(exported))) scalarizeMismatch += 1;
    }
    const outB = decodeA0Argmax(vMatrixFromNested([Array.from(scal, (x) => (x === -Infinity ? null : x))]));
    if (outB[0] !== selected) rescalarizeArgmaxMismatch += 1;

    rows += 1;
  }
  assert.equal(rows, EXPECTED_ROWS, `real window row count (${rows}) == ${EXPECTED_ROWS}`);
  assert.equal(argmaxMismatch, 0, `[fixture a] ${argmaxMismatch}/${rows} argmax self-check mismatches`);
  assert.equal(scalarizeMismatch, 0, `[fixture b] ${scalarizeMismatch} scalarize value mismatches (rel ${REL_TOL})`);
  assert.equal(
    rescalarizeArgmaxMismatch,
    0,
    `[fixture b] ${rescalarizeArgmaxMismatch}/${rows} re-scalarized argmax mismatches`,
  );
  console.log(`  [fixture a] ${rows}/${rows} argmax self-check reproduce selectedActionIndex`);
  console.log(`  [fixture b] ${rows}/${rows} ω re-scalarize matches export (rel ${REL_TOL}) + re-argmax OK`);
}

async function main(): Promise<void> {
  console.log('validate:modqn:decode-parity');
  checkPurity();
  const goldens = loadGoldens();
  runGoldenParity(goldens);
  runShape2AuctionFixtures(goldens);
  skipRealWindowIfUnstaged();
  await runRealDataFixtures();
  console.log('PASS: TS decode engine reproduces the frozen Python decode + the recorded dense-Q self-check.');
}

main().catch((err) => {
  console.error(`FAIL: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
