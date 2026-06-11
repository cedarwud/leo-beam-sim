/**
 * Consolidation S1b — REPLAY geometry-trace golden gate (Verdict 3 guard).
 *
 * The live geometry-trace golden (`validate:s0:geometry-trace`) captures ONLY
 * the live lane (`liveSimToScene` → `useBeamViz`). S1b folds the REPLAY
 * satellite projection onto the typed `worldFrame` discriminator: the adapter
 * now tags replay sats `'replay-worldpos'` and `projectSatelliteRenderWorld`
 * selects the ecef-km normalise branch by TYPE instead of the residual
 * `mag > 1000` magnitude guess. Verdict 3 of the S1 coordinate map: a naive
 * swap would SILENTLY misscale any replay satellite whose post-`coordToWorld`
 * magnitude is ≤ 1000 (old: scaled by `satPosScaleFactor`; new: normalised to
 * the visual altitude).
 *
 * This gate pins the replay DISPLAY geometry (the projected `displaySats[].world`
 * — the projection OUTPUT) byte-identical across the fold. It deliberately does
 * NOT pin the `worldFrame` tag itself: that tag is the thing that flips
 * (undefined → `'replay-worldpos'`); the guard is that the projected pixels do
 * not move. A real misscale surfaces as a non-zero diff on `displaySats`.
 *
 * Source artifact: the repo-local synthetic `visual-showcase-v1` fixture
 * (`createSyntheticVisualShowcaseArtifact`) — FORCED, never the env / pinned
 * producer path — so the golden is reproducible on any machine.
 *
 * Meta-gates (d6 protocol): run-twice in-process determinism (A==B) and a
 * perturbation positive control (a 1e-3 bump must FAIL the diff). First run
 * writes the fixture; future runs diff at 1e-6. A slice declaring a legitimate
 * replay display change passes ignore prefixes via `S1B_TRACE_IGNORE`, then
 * re-baselines in its own commit.
 */
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

// ---- Monotonic-clock patch (d6 protocol; matches s0/s1) ----
const CLOCK_EPOCH_MS = 1_700_000_000_000;
let clockMs = CLOCK_EPOCH_MS;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).performance = {
  ...((globalThis as any).performance ?? {}),
  now: () => clockMs - CLOCK_EPOCH_MS,
};
Date.now = () => clockMs;

import { loadShowcaseArtifact } from '../src/showcase/loadShowcaseArtifact.ts';
import { showcaseArtifactToScene } from '../src/showcase/showcaseArtifactToScene.ts';
import { showcaseArtifactToSceneInterpolated } from '../src/showcase/showcaseArtifactToSceneInterpolated.ts';
import { projectSatelliteRenderWorld } from '../src/scene/satelliteRenderProjection.ts';
import { SKY_DOME_V_RADIUS } from '../src/scene/sceneScale.ts';
import { deriveRuntimeVisualSettings } from '../src/scene/runtimeConfig.ts';
import type { RuntimeConfig } from '../src/scene/types.ts';
import { captureReplayVizFrame } from '../src/validation/vizFrameProbe.tsx';
import { diffGeometryTrace } from '../src/validation/geometrySnapshot.ts';
import { createSyntheticVisualShowcaseArtifact } from './visualShowcaseValidatorFixture.ts';

const GATE = 'validate:s1b:replay-geometry-trace';
const FLOAT_TOLERANCE = 1e-6;
const FIXTURE_PATH = path.join('fixtures', 's1b-replay-geometry', 'synthetic-baseline.json');

const ROUND = 1e6;
function round(v: number | null | undefined): number | null {
  if (v === null || v === undefined || !Number.isFinite(v)) return null;
  return Math.round(v * ROUND) / ROUND;
}

interface ReplayTraceStep {
  readonly frameIndex: number;
  readonly tSec: number | null;
  /** coordToWorld output (projection INPUT) — proves upstream unchanged. */
  readonly satWorldPos: readonly { readonly id: string; readonly world: readonly [number | null, number | null, number | null] }[];
  /** projectSatelliteRenderWorld output (projection OUTPUT) — the byte-identical guard. */
  readonly displaySats: readonly { readonly id: string; readonly world: readonly [number | null, number | null, number | null] }[];
  readonly beamSatIds: readonly string[];
  readonly footprintRadiusWorld: number | null;
  readonly sinrLabelCount: number;
}
interface ReplayTrace {
  readonly artifactId: string;
  readonly frameCount: number;
  readonly floatTolerance: number;
  readonly steps: readonly ReplayTraceStep[];
}

function buildArtifact() {
  // FORCE synthetic — never the env / pinned producer path — for reproducibility.
  return loadShowcaseArtifact(
    JSON.parse(JSON.stringify(createSyntheticVisualShowcaseArtifact())) as unknown,
  );
}

const RUNTIME: RuntimeConfig = {
  appMode: 'modqn-demo',
  presentationMode: 'demo-readability',
  replay: { epochUtcMs: CLOCK_EPOCH_MS, startOffsetSec: 0, loop: false, windowLengthSec: 7200 },
  ...deriveRuntimeVisualSettings('tuning', false),
  beamDensity: 'all',
  viewport: { width: 1600, height: 1000 },
  ueCount: 100,
  uePrimaryAnchorMode: 'observer',
};

function captureTrace(): ReplayTrace {
  clockMs = CLOCK_EPOCH_MS;
  const artifact = buildArtifact();
  const frameCount = artifact.timeline.length;
  const steps: ReplayTraceStep[] = [];
  for (let frameIndex = 0; frameIndex < frameCount; frameIndex += 1) {
    const frame = showcaseArtifactToScene(artifact, frameIndex);
    const viz = captureReplayVizFrame({ artifact, frameIndex, runtime: RUNTIME });
    steps.push({
      frameIndex,
      tSec: round(frame.tSec),
      satWorldPos: [...frame.satellites]
        .sort((a, b) => a.id.localeCompare(b.id))
        .map(s => ({ id: s.id, world: [round(s.worldPos[0]), round(s.worldPos[1]), round(s.worldPos[2])] as const })),
      displaySats: [...viz.displaySats]
        .sort((a, b) => a.id.localeCompare(b.id))
        .map(d => ({ id: d.id, world: [round(d.world.x), round(d.world.y), round(d.world.z)] as const })),
      beamSatIds: [...viz.beamSatIds].sort(),
      footprintRadiusWorld: round(viz.footprintRadiusWorld),
      sinrLabelCount: viz.sinrLabels.length,
    });
  }
  return { artifactId: artifact.artifactId, frameCount, floatTolerance: FLOAT_TOLERANCE, steps };
}

// ---- Run twice in-process: determinism gate ----
const traceA = captureTrace();
const traceB = captureTrace();
const determinismDiffs = diffGeometryTrace(traceA, traceB, { floatTolerance: 1e-9 });
assert.equal(
  determinismDiffs.length,
  0,
  `replay pipeline is nondeterministic under the fixed-clock protocol:\n${determinismDiffs.slice(0, 10).join('\n')}`,
);

// ---- Non-vacuous: every frame projects display satellites ----
const everyFrameHasDisplaySats = traceA.steps.every(s => s.displaySats.length > 0);
assert.ok(everyFrameHasDisplaySats, 'vacuous trace: a frame produced zero display satellites');
const satCount = traceA.steps[0]?.displaySats.length ?? 0;
assert.ok(satCount > 0, 'no display satellites captured at all');

// ---- New-vs-legacy projection equality oracle (S2 + B2) ----
// The byte-identical claim is "the typed 'replay-worldpos' projection ==
// the retired legacy magnitude-guess for every real replay worldPos." Prove it
// DIRECTLY (not by golden timing): the legacy branch still exists in
// `projectSatelliteRenderWorld` for untagged coords, so it is a live oracle.
//   - Equality holds iff |worldPos| > 1000 (else new normalises, legacy scales)
//     → asserting equality ENFORCES the >1000 guarantee that was only a comment.
//   - Covered on BOTH the integer-frame adapter AND the interpolated adapter the
//     render lane (App.tsx) actually mounts: `showcaseArtifactToSceneInterpolated`
//     world-space-lerps worldPos (a chord that can dip magnitude below the
//     endpoints), so it is the path most likely to cross ≤ 1000.
let minInputMag = Infinity;
{
  const oracleArtifact = buildArtifact();
  const geom = showcaseArtifactToScene(oracleArtifact, 0).geometry;
  const alt = typeof geom.visualSatelliteAltitude === 'number' && Number.isFinite(geom.visualSatelliteAltitude)
    ? geom.visualSatelliteAltitude
    : 900;
  const scale = alt / SKY_DOME_V_RADIUS;
  const close = (a: number, b: number): boolean => Math.abs(a - b) <= 1e-9;
  let oracleChecks = 0;
  const assertEqualsLegacy = (wp: readonly [number, number, number], label: string): void => {
    const nu = projectSatelliteRenderWorld(wp, 'replay-worldpos', alt, scale);
    const lg = projectSatelliteRenderWorld(wp, undefined, alt, scale);
    assert.ok(
      close(nu.x, lg.x) && close(nu.y, lg.y) && close(nu.z, lg.z),
      `replay-worldpos projection diverges from legacy at ${label} (|worldPos|=${Math.hypot(wp[0], wp[1], wp[2]).toFixed(2)}): new=(${nu.x},${nu.y},${nu.z}) vs legacy=(${lg.x},${lg.y},${lg.z}) — swap NOT byte-identical here`,
    );
    oracleChecks += 1;
    minInputMag = Math.min(minInputMag, Math.hypot(wp[0], wp[1], wp[2]));
  };

  // Cross-check the oracle's alt/scale faithfully replicate useBeamViz: the
  // typed projection of the integer worldPos must equal the captured
  // displaySats (the real render output), id-matched.
  const f0 = showcaseArtifactToScene(oracleArtifact, 0);
  const vizById = new Map(
    captureReplayVizFrame({ artifact: oracleArtifact, frameIndex: 0, runtime: RUNTIME }).displaySats.map(d => [d.id, d.world]),
  );
  for (const s of f0.satellites) {
    const disp = vizById.get(s.id);
    assert.ok(disp, `oracle cross-check: displaySat ${s.id} missing from useBeamViz output`);
    const nu = projectSatelliteRenderWorld(s.worldPos, 'replay-worldpos', alt, scale);
    assert.ok(
      close(nu.x, disp.x) && close(nu.y, disp.y) && close(nu.z, disp.z),
      `oracle alt/scale (${alt}/${scale}) do not replicate useBeamViz displaySats for ${s.id} — oracle is not faithful to the render`,
    );
  }

  // Integer frames (the static adapter).
  for (let fi = 0; fi < oracleArtifact.timeline.length; fi += 1) {
    for (const s of showcaseArtifactToScene(oracleArtifact, fi).satellites) {
      assertEqualsLegacy(s.worldPos, `frame ${fi} sat ${s.id}`);
    }
  }
  // Interpolated frames (the production render path) — dense alpha grid across
  // each adjacent pair; chord midpoints dip the magnitude the most.
  const times = oracleArtifact.timebase.timesSec ?? oracleArtifact.timeline.map(f => f.tSec);
  const alphas = [0.1, 0.25, 0.5, 0.75, 0.9];
  for (let i = 0; i < times.length - 1; i += 1) {
    const ta = times[i];
    const tb = times[i + 1];
    if (ta === undefined || tb === undefined) continue;
    for (const a of alphas) {
      const tSec = ta * (1 - a) + tb * a;
      for (const s of showcaseArtifactToSceneInterpolated(oracleArtifact, tSec).satellites) {
        assertEqualsLegacy(s.worldPos, `interp t=${tSec.toFixed(3)} sat ${s.id}`);
      }
    }
  }
  assert.ok(oracleChecks > 100, `oracle vacuous: only ${oracleChecks} projection comparisons`);
  assert.ok(
    minInputMag > 1000,
    `a replay worldPos has |worldPos|=${minInputMag.toFixed(2)} <= 1000 — typed projection no longer byte-identical to the retired legacy path there`,
  );
  console.log(`[${GATE}] new-vs-legacy oracle: ${oracleChecks} projections byte-identical (integer + interpolated render path), min |worldPos|=${minInputMag.toFixed(1)} > 1000`);
}

// ---- Perturbation positive control: the diff must catch a 1e-3 bump ----
const perturbed = JSON.parse(JSON.stringify(traceA)) as ReplayTrace & { steps: { displaySats: { world: (number | null)[] }[] }[] };
const mid = Math.floor(traceA.steps.length / 2);
const targetWorld = perturbed.steps[mid].displaySats[0].world;
targetWorld[0] = (targetWorld[0] ?? 0) + 1e-3;
const perturbDiffs = diffGeometryTrace(traceA, perturbed, { floatTolerance: FLOAT_TOLERANCE });
assert.ok(
  perturbDiffs.length > 0,
  'perturbation positive control failed: a 1e-3 display-geometry change was not detected — the diff measures nothing',
);

// ---- Golden fixture gate (write-on-first-run, then diff forever) ----
if (!existsSync(FIXTURE_PATH)) {
  mkdirSync(path.dirname(FIXTURE_PATH), { recursive: true });
  writeFileSync(FIXTURE_PATH, `${JSON.stringify(traceA, null, 2)}\n`, 'utf8');
  console.log(`[${GATE}] baseline fixture WRITTEN: ${FIXTURE_PATH} (${traceA.steps.length} frames, ${satCount} sats/frame) — commit it; future runs diff against it`);
} else {
  const golden = JSON.parse(readFileSync(FIXTURE_PATH, 'utf8')) as ReplayTrace;
  const ignorePaths = (process.env.S1B_TRACE_IGNORE ?? '')
    .split(',')
    .map(p => p.trim())
    .filter(Boolean);
  const goldenDiffs = diffGeometryTrace(golden, traceA, { floatTolerance: FLOAT_TOLERANCE, ignorePaths });
  if (goldenDiffs.length > 0) {
    console.error(`[${GATE}] FAIL — ${goldenDiffs.length} diffs vs ${FIXTURE_PATH} (first 20):`);
    for (const diff of goldenDiffs.slice(0, 20)) console.error(`  ${diff}`);
    console.error('  (a slice declaring a legitimate replay display change passes ignore prefixes via S1B_TRACE_IGNORE, then re-baselines in its own commit)');
    process.exit(1);
  }
  console.log(`[${GATE}] PASS — replay display geometry matches golden at ${FLOAT_TOLERANCE}${ignorePaths.length > 0 ? ` (ignored: ${ignorePaths.join(', ')})` : ''}`);
}

console.log(`[${GATE}] determinism A==B verified, perturbation control verified, ${traceA.steps.length} frames × ${satCount} sats, min input |worldPos|=${minInputMag.toFixed(1)} (>1000 ⇒ swap byte-identical)`);
