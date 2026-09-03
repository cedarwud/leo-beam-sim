import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  buildSimulationAnalysisFrame,
  createSimulatorTleState,
} from '../../simulator/analysis';
import {
  loadTleSnapshotSelection,
  loadTleWebArchiveCatalog,
} from '../../simulator/archive';
import {
  DEFAULT_SIMULATOR_PARAMETERS,
  type SimulatorParameters,
} from '../../simulator/types';
import { TleArchiveError } from '../../tle/errors';
import {
  TLE_RUN_ANCHOR_COUNT,
  TLE_RUN_STEP_S,
  TleRunError,
  buildTleRunBundle,
} from '../../tle/run';
import {
  acceptHomepageCanonicalParameterCandidate,
  buildHomepageFirstFrame,
  HomepageCanonicalEvaluationSession,
  shouldAttemptHomepageTleTimeFallback,
  yieldForHomepageFirstFramePaint,
} from './useHomepageCanonicalAnalysis';

const fetchFromPublic = async (path: RequestInfo | URL): Promise<Response> => (
  new Response(await readFile(`public${String(path)}`), { status: 200 })
);

const hookSource = await readFile(new URL('./useHomepageCanonicalAnalysis.ts', import.meta.url), 'utf8');
assert.match(
  hookSource,
  /const HOMEPAGE_CANONICAL_TAIPEI_LOCAL = LATEST_TLE_REFERENCE_TAIPEI_LOCAL;/,
  'homepage default must open on the latest checked-in archive date',
);
assert.match(
  hookSource,
  /await yieldForHomepageFirstFramePaint\(\);/,
  'the full run must wait for the first-frame paint yield',
);
assert.match(
  hookSource,
  /preloadHomepageFirstFrameArtifact\(\)/,
  'the default immutable artifact must start loading before catalog parsing completes',
);
assert.match(
  hookSource,
  /new URLSearchParams\(window\.location\.search\)\.get\('visualLabFullRun'\) === '0'/,
  'the checked-in complete run is the default path with one explicit diagnostic opt-out',
);
assert.doesNotMatch(
  hookSource,
  /fullRunArtifactOptOut\s*=\s*import\.meta\.env\.DEV/,
  'development mode must not silently disable the immutable complete-run artifact',
);
assert.match(
  hookSource,
  /readHomepageFirstFrameSessionCache\(firstFrameExpectation\)/,
  'warm reloads must attempt the key-validated compact session path before the artifact/full snapshot path',
);
assert.match(
  hookSource,
  /homepageFirstFrameSource/,
  'the first-frame source must be observable for live timing evidence',
);
assert.match(
  hookSource,
  /requestAnimationFrame[\s\S]*globalThis\.setTimeout/,
  'the paint yield must use rAF followed by a timer task',
);
const previousRafDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'requestAnimationFrame');
const paintEvents: string[] = [];
Object.defineProperty(globalThis, 'requestAnimationFrame', {
  configurable: true,
  value: (callback: FrameRequestCallback) => {
    paintEvents.push('raf');
    callback(0);
    return 1;
  },
});
try {
  await yieldForHomepageFirstFramePaint();
  assert.deepEqual(paintEvents, ['raf'], 'first-frame yield must pass through rAF before the timer task');
} finally {
  if (previousRafDescriptor === undefined) {
    const globalWithRaf = globalThis as { requestAnimationFrame?: unknown };
    delete globalWithRaf.requestAnimationFrame;
  } else {
    Object.defineProperty(globalThis, 'requestAnimationFrame', previousRafDescriptor);
  }
}
assert.match(
  hookSource,
  /const selectTimelineTimeSec = \(targetSec: number\) => \{\s*if \(!runReady \|\| !Number\.isFinite\(targetSec\)\) return;/,
  'programmatic timeline selection must fail closed until the complete TLE run is ready',
);
assert.match(
  hookSource,
  /Math\.floor\(boundedTimeSec \/ TLE_RUN_STEP_S\)/,
  'continuous visual time must use the lower completed TLE anchor as its canonical bracket',
);
assert.doesNotMatch(
  hookSource,
  /Math\.round\(targetSec \/ TLE_RUN_STEP_S\)/,
  'timeline playback must not quantize visual motion to nearest 30-second anchors',
);
assert.match(
  hookSource,
  /useEffect\(\(\) => \{[\s\S]*?\}, \[appliedOrbitRequest(?:, enabled)?\]\);/,
  'draft constellation/time edits must not trigger the archived-TLE build effect',
);
const applyBlock = hookSource.match(
  /const applyRequestedOrbitSettings = \(\) => \{[\s\S]*?\n  \};/,
)?.[0] ?? '';
assert.match(
  applyBlock,
  /setAppliedOrbitRequest\(/,
  'explicit Apply must start one source request transaction',
);
assert.match(
  applyBlock,
  /analysisRebuildAbortController\.current\?\.abort\(\);[\s\S]*?analysisWorkerTransport\.current\?\.dispose\(\);[\s\S]*?analysisWorkerTransport\.current = null;[\s\S]*?activeAbortController\.current\?\.abort\(\);/,
  'source Apply must terminate any synchronous analysis Worker before starting the replacement source run',
);
assert.match(
  applyBlock,
  /publishedRunRef\.current = null;[\s\S]*?setPublishedRun\(null\);[\s\S]*?lastAcceptedFrame\.current = null;[\s\S]*?publishEvaluation\(evaluationSession\.current!\.reset\(\)\);[\s\S]*?setTimelineSelection\(\{ currentTimeSec: 0, anchorIndex: 0 \}\);/,
  'explicit Apply must clear the accepted scene, results, evaluation, and timeline before rebuilding',
);
assert.match(
  hookSource,
  /const allowFirstFramePublication = appliedOrbitRequest\.revision === 0;[\s\S]*?if \(allowFirstFramePublication && !retainPreviousAccepted\)/,
  'only initial load may expose a verified first frame; explicit Apply stays empty until complete',
);
assert.match(
  hookSource,
  /lastAcceptedFrame\.current = nextFrame;[\s\S]*?evaluationSession\.current!\.reset\(\);[\s\S]*?acceptEvaluationFrame\(nextFrame\);[\s\S]*?const nextPublication = \{ analysisRun, geometryRun, selection, timeResolution \};[\s\S]*?publishedRunRef\.current = nextPublication;[\s\S]*?setPublishedRun\(nextPublication\)/,
  'only a complete new run may atomically replace the accepted publication and evaluation interval',
);
assert.match(
  hookSource,
  /transport\.rebuildAnalysis\(\{[\s\S]*?passPlan: basePublication\.analysisRun\.passPlan/,
  'accepted geometry and pass planning must be reused by the analysis Worker',
);
assert.match(
  hookSource,
  /analysisRebuildAbortController\.current\?\.abort\(\);[\s\S]*?analysisWorkerTransport\.current\?\.dispose\(\);[\s\S]*?analysisWorkerTransport\.current = null;/,
  'a newer edit must terminate the synchronous analysis Worker instead of queuing behind stale work',
);
assert.match(
  hookSource,
  /experimentPublicationCache\.current\.get\([\s\S]*?homepageExperimentAnalysisRunId/,
  'an exact accepted experiment may be restored from the bounded in-memory run cache',
);
assert.match(
  hookSource,
  /cachedPublication\.analysisRun\.geometryRunId === baseGeometryRunId[\s\S]*?publishAccepted\(cachedPublication\)/,
  'a cached experiment must retain the current accepted geometry before atomic publication',
);
assert.match(
  hookSource,
  /while \(cache\.size > HOMEPAGE_EXPERIMENT_CACHE_LIMIT\)/,
  'the accepted experiment cache must remain bounded',
);
const parameterUpdateBlock = hookSource.match(
  /const updateParameters = \(next: SimulatorParameters\) => \{[\s\S]*?\n  \};\n\n  const resetParameters/,
)?.[0] ?? '';
assert.match(parameterUpdateBlock, /rebuildAcceptedExperiment\(/);
assert.doesNotMatch(
  parameterUpdateBlock,
  /\.withParameters\(|\.withExperiment\(/,
  'a parameter input event must not synchronously rebuild all accepted anchors',
);
assert.match(
  hookSource,
  /setRequestedConstellation: next => \{\s*if \(next === requestedConstellation\) return;\s*setRequestedConstellation\(next\);\s*\}/,
  'constellation selection must remain a draft-only edit',
);
assert.match(
  hookSource,
  /new HomepageCanonicalEvaluationSession\(\)/,
  'the hook must own a resettable session-scoped EE accumulator',
);
assert.match(
  hookSource,
  /readonly durationSec: number;/,
  'public evaluation must expose elapsed accepted-frame duration',
);
assert.doesNotMatch(
  hookSource,
  /export interface HomepageCanonicalEvaluation \{[^}]*readonly sampleCount: number;/,
  'sample count must remain internal rather than defining the public evaluation window',
);
assert.match(
  hookSource,
  /evaluationSession\.current!\.accept\(publishedFrame\)/,
  'published timeline frames must feed the session accumulator',
);
assert.match(
  hookSource,
  /publishEvaluation\(evaluationSession\.current!\.reset\(\)\)/,
  'manual evaluation reset must clear the session accumulator',
);
assert.doesNotMatch(
  hookSource,
  /homepageEvaluationFromRun/,
  'the hook must not publish the fixed two-hour run evaluation as EE_eval',
);
assert.match(
  hookSource,
  /setTaipeiDateTime: next => \{\s*if \(next === taipeiDateTime\) return;\s*setTaipeiDateTime\(next\);\s*\}/,
  'date/time selection must remain a draft-only edit',
);

assert.equal(
  shouldAttemptHomepageTleTimeFallback(
    new TleArchiveError('NO_PRIOR_SNAPSHOT', 'no archive covers the requested instant'),
    'selection',
  ),
  true,
  'a temporal archive-coverage failure may try a catalog boundary',
);
assert.equal(
  shouldAttemptHomepageTleTimeFallback(
    new TleArchiveError('INVALID_MANIFEST', 'one snapshot resource is unavailable'),
    'selection',
  ),
  true,
  'a broken selected publication may try a different catalog boundary',
);
assert.equal(
  shouldAttemptHomepageTleTimeFallback(
    new TleRunError('PROPAGATION_FAILED', 'no valid satellite remains'),
    'geometry',
  ),
  true,
  'a source-dependent complete-run propagation failure may try a boundary',
);
assert.equal(
  shouldAttemptHomepageTleTimeFallback(
    new TleRunError('INVALID_CONFIG', 'duration drift'),
    'geometry',
  ),
  false,
  'an internal run-contract error must fail immediately',
);
assert.equal(
  shouldAttemptHomepageTleTimeFallback(
    new RangeError('beamPowerCapW must be positive'),
    'analysis',
  ),
  false,
  'a canonical parameter error must not be disguised as a time fallback',
);
assert.equal(
  shouldAttemptHomepageTleTimeFallback(
    new Error('archived TLE run cannot publish: no real NTPU-visible serving satellite at anchors 17'),
    'analysis',
  ),
  true,
  'an NTPU visibility gap may try a different catalog boundary',
);
assert.equal(
  shouldAttemptHomepageTleTimeFallback(
    new TleArchiveError('PROPAGATION_FAILED', 'SGP4 failed for 47380 at 2026-08-12T12:00:00.000Z'),
    'analysis',
  ),
  true,
  'a first-frame SGP4 failure must advance to the next bounded time candidate',
);

const catalog = await loadTleWebArchiveCatalog(
  '/tle-archive/oneweb/catalog.json',
  fetchFromPublic,
);
const selection = await loadTleSnapshotSelection(
  catalog,
  '2026-08-07T23:59:59.000Z',
  fetchFromPublic,
);
const tleState = createSimulatorTleState(selection, '2026-08-07T23:59:59.000Z');
const currentParameters: SimulatorParameters = { ...DEFAULT_SIMULATOR_PARAMETERS };
const previousFrame = buildSimulationAnalysisFrame(tleState, currentParameters);
const firstFrameBuild = buildHomepageFirstFrame(
  '2026-08-07T23:59:59.000Z',
  '2026-08-07T23:59:59.000Z',
  catalog,
  selection,
  currentParameters,
);
assert.equal(firstFrameBuild.source, 'computed');
assert.equal(firstFrameBuild.frame.provenance.propagationModel, 'SGP4');
assert.equal(firstFrameBuild.frame.provenance.archiveId, catalog.archiveId);
assert.equal(firstFrameBuild.frame.instantUtc, '2026-08-07T23:59:59.000Z');
assert.equal(
  buildHomepageFirstFrame(
    '2026-08-07T23:59:59.000Z',
    '2026-08-07T23:59:59.000Z',
    catalog,
    selection,
    currentParameters,
  ).source,
  'module',
);

// Regression: one malformed Starlink record (NORAD 46052) fails SGP4 at the
// requested instant, but the complete run keeps the other per-satellite
// records. The first-frame producer must use that same exclusion boundary so
// the exact requested instant is accepted instead of being time-fallbacked.
const targetInstantUtc = '2026-07-27T12:00:00.000Z';
const targetStarlinkCatalog = await loadTleWebArchiveCatalog(
  '/tle-archive/starlink/catalog.json',
  fetchFromPublic,
);
const targetSelection = await loadTleSnapshotSelection(
  targetStarlinkCatalog,
  targetInstantUtc,
  fetchFromPublic,
);
const targetFirstFrame = buildHomepageFirstFrame(
  targetInstantUtc,
  targetInstantUtc,
  targetStarlinkCatalog,
  targetSelection,
  currentParameters,
);
assert.equal(targetFirstFrame.source, 'computed');
assert.equal(targetFirstFrame.frame.instantUtc, targetInstantUtc);
assert.equal(targetFirstFrame.frame.tleState.requestedInstantUtc, targetInstantUtc);
assert.equal(
  targetFirstFrame.frame.tleState.propagationFrame.satellites.some(
    satellite => satellite.satelliteId === '46052',
  ),
  false,
  'first-frame SGP4 producer must exclude only the failing NORAD 46052 record',
);
assert.equal(
  targetFirstFrame.frame.tleState.propagationFrame.satellites.length,
  targetSelection.manifest.entries.length - 1,
);

const targetRun = await buildTleRunBundle({
  selection: targetSelection,
  t0Utc: targetInstantUtc,
  yieldEveryAnchors: TLE_RUN_ANCHOR_COUNT,
});
assert.equal(targetRun.t0Utc, targetInstantUtc);
assert.equal(targetRun.getSatelliteIndex('46052'), undefined);
assert.equal(targetRun.exclusionProvenance.excludedCount, 1);
assert.equal(targetRun.exclusionProvenance.exclusions[0]?.satelliteId, '46052');
assert.equal(targetRun.satelliteCount, targetSelection.manifest.entries.length - 1);

const onlyInvalidSelection = {
  ...targetSelection,
  manifest: {
    ...targetSelection.manifest,
    entries: targetSelection.manifest.entries.filter(entry => entry.satelliteId === '46052'),
  },
};
assert.throws(
  () => createSimulatorTleState(onlyInvalidSelection, targetInstantUtc),
  (error: unknown) => error instanceof TleArchiveError
    && error.code === 'PROPAGATION_FAILED'
    && error.details?.excludedCount === 1,
  'first-frame producer must fail closed when per-satellite exclusion would remove the entire catalog',
);

const invalidCandidate: SimulatorParameters = {
  ...currentParameters,
  beamPowerCapW: Number.NaN,
};
const rejected = acceptHomepageCanonicalParameterCandidate(
  currentParameters,
  invalidCandidate,
  tleState,
  previousFrame,
);

assert.equal(rejected.accepted, false);
assert.deepEqual(rejected.parameters, currentParameters);
assert.equal(rejected.frame, previousFrame);
assert.match(rejected.error ?? '', /beamPowerCapW/);

const validCandidate: SimulatorParameters = {
  ...currentParameters,
  beamPowerCapW: 1,
};
const accepted = acceptHomepageCanonicalParameterCandidate(
  currentParameters,
  validCandidate,
  tleState,
  previousFrame,
);

assert.equal(accepted.accepted, true);
assert.deepEqual(accepted.parameters, validCandidate);
assert.notEqual(accepted.frame, previousFrame);
const acceptedBeamPowerCap = accepted.frame?.inputs.config.beamPowerCapW;
assert.equal(
  typeof acceptedBeamPowerCap === 'number' ? acceptedBeamPowerCap : acceptedBeamPowerCap?.[0],
  1,
);

const secondSelection = await loadTleSnapshotSelection(
  catalog,
  '2026-08-08T00:00:00.000Z',
  fetchFromPublic,
);
const secondTleState = createSimulatorTleState(secondSelection, '2026-08-08T00:00:00.000Z');
const secondFrame = buildSimulationAnalysisFrame(secondTleState, currentParameters);

const session = new HomepageCanonicalEvaluationSession();
const firstEvaluation = session.accept(previousFrame);
assert.equal(firstEvaluation.sampleCount, 1);
assert.equal(firstEvaluation.durationSec, TLE_RUN_STEP_S);
assert.equal(
  firstEvaluation.deliveredBits,
  previousFrame.throughput.totalRateBps * TLE_RUN_STEP_S,
);
assert.equal(
  firstEvaluation.consumedEnergyJ,
  previousFrame.power.systemPowerW * TLE_RUN_STEP_S,
);

// Replaying the same accepted producer frame is a no-op. This is the
// StrictMode/re-render guard and must not double the session totals.
const duplicateEvaluation = session.accept(previousFrame);
assert.deepEqual(duplicateEvaluation, firstEvaluation);

// A date/time change creates a distinct frame but retains the model context,
// so the ratio-of-sums window continues rather than resetting.
const continuedEvaluation = session.accept(secondFrame);
assert.equal(continuedEvaluation.sampleCount, 2);
assert.equal(
  continuedEvaluation.durationSec,
  TLE_RUN_STEP_S * 2,
);
assert.equal(
  continuedEvaluation.deliveredBits,
  firstEvaluation.deliveredBits
    + secondFrame.throughput.totalRateBps * TLE_RUN_STEP_S,
);
assert.equal(
  continuedEvaluation.consumedEnergyJ,
  firstEvaluation.consumedEnergyJ
    + secondFrame.power.systemPowerW * TLE_RUN_STEP_S,
);
assert.equal(
  continuedEvaluation.energyEfficiencyBitsPerJ,
  continuedEvaluation.deliveredBits / continuedEvaluation.consumedEnergyJ,
);

// A manual reset starts a fresh window; the next accepted frame is counted
// once even when it has the same producer identity as the previous window.
assert.deepEqual(session.reset(), {
  deliveredBits: 0,
  consumedEnergyJ: 0,
  energyEfficiencyBitsPerJ: 0,
  durationSec: 0,
  sampleCount: 0,
});
const resumedEvaluation = session.accept(secondFrame);
assert.equal(resumedEvaluation.sampleCount, 1);
assert.equal(resumedEvaluation.durationSec, TLE_RUN_STEP_S);
assert.deepEqual(session.accept(secondFrame), resumedEvaluation);

// The homepage first-frame transport uses the same fixed timeline step as the
// completed run even though the canonical single-frame producer remains 1 s.
const longDurationFrame = {
  ...secondFrame,
  frameId: `${secondFrame.frameId}-two-second-window`,
  inputs: {
    ...secondFrame.inputs,
    config: { ...secondFrame.inputs.config, frameDurationS: 2 },
  },
};
const durationSession = new HomepageCanonicalEvaluationSession();
const durationFirst = durationSession.accept(previousFrame);
const durationSecond = durationSession.accept(longDurationFrame);
assert.equal(durationSecond.durationSec, durationFirst.durationSec + TLE_RUN_STEP_S);
assert.equal(
  durationSecond.deliveredBits,
  previousFrame.throughput.totalRateBps * TLE_RUN_STEP_S
    + secondFrame.throughput.totalRateBps * TLE_RUN_STEP_S,
);
assert.equal(
  durationSecond.consumedEnergyJ,
  previousFrame.power.systemPowerW * TLE_RUN_STEP_S
    + secondFrame.power.systemPowerW * TLE_RUN_STEP_S,
);

// The fast first-frame path and the completed run can wrap the same
// calculation in different transport identities (`runAnchor` changes the
// producer frameId). The session must still count that visible calculation
// once when the completed run replaces the provisional frame.
const provisionalReplacementSession = new HomepageCanonicalEvaluationSession();
const provisionalEvaluation = provisionalReplacementSession.accept(previousFrame);
const completedAnchorZeroFrame = {
  ...previousFrame,
  frameId: `${previousFrame.frameId}-completed-anchor-0`,
  runAnchor: {
    runId: 'test-run',
    geometryRunId: 'test-geometry-run',
    anchorIndex: 0,
    anchorCount: 241,
    elapsedSec: 0,
    durationSec: 7_200,
    stepSec: TLE_RUN_STEP_S,
    passPolicyRevision: 'test-pass-policy',
    servingPassId: null,
    candidatePassId: null,
  },
};
assert.deepEqual(
  provisionalReplacementSession.accept(completedAnchorZeroFrame),
  provisionalEvaluation,
);

// Completed TLE anchors represent 30-second evaluation intervals even though
// the canonical per-frame config remains the 1-second UI calculation frame.
const testRunAnchor = (anchorIndex: number) => ({
  runId: 'test-run',
  geometryRunId: 'test-geometry-run',
  anchorIndex,
  anchorCount: 241,
  elapsedSec: anchorIndex * 30,
  durationSec: 7_200,
  stepSec: 30,
  passPolicyRevision: 'test-pass-policy',
  servingPassId: null,
  candidatePassId: null,
});
const runAnchorZeroFrame = {
  ...previousFrame,
  frameId: `${previousFrame.frameId}-run-anchor-0`,
  runAnchor: testRunAnchor(0),
};
const completedAnchorOneFrame = {
  ...secondFrame,
  frameId: `${secondFrame.frameId}-run-anchor-1`,
  runAnchor: testRunAnchor(1),
};
const runAnchorSession = new HomepageCanonicalEvaluationSession();
const anchorZeroEvaluation = runAnchorSession.accept(runAnchorZeroFrame);
assert.equal(anchorZeroEvaluation.durationSec, 30);
assert.equal(
  anchorZeroEvaluation.deliveredBits,
  previousFrame.throughput.totalRateBps * 30,
);
assert.equal(
  anchorZeroEvaluation.consumedEnergyJ,
  previousFrame.power.systemPowerW * 30,
);
const anchorOneEvaluation = runAnchorSession.accept(completedAnchorOneFrame);
assert.equal(anchorOneEvaluation.durationSec, 60);
assert.equal(
  anchorOneEvaluation.deliveredBits,
  previousFrame.throughput.totalRateBps * 30 + secondFrame.throughput.totalRateBps * 30,
);
assert.equal(
  anchorOneEvaluation.consumedEnergyJ,
  previousFrame.power.systemPowerW * 30 + secondFrame.power.systemPowerW * 30,
);

// The final display anchor has no following interval. It remains displayable,
// but must not add another 30 seconds to the evaluation window.
const terminalAnchorFrame = {
  ...secondFrame,
  frameId: `${secondFrame.frameId}-run-terminal-anchor`,
  runAnchor: testRunAnchor(240),
};
const terminalSession = new HomepageCanonicalEvaluationSession();
const terminalEvaluation = terminalSession.accept(terminalAnchorFrame);
assert.equal(terminalEvaluation.durationSec, 0);
assert.equal(terminalEvaluation.sampleCount, 0);
const terminalAfterIntervalSession = new HomepageCanonicalEvaluationSession();
terminalAfterIntervalSession.accept(runAnchorZeroFrame);
const terminalAfterIntervalEvaluation = terminalAfterIntervalSession.accept(terminalAnchorFrame);
assert.equal(terminalAfterIntervalEvaluation.durationSec, 30);
assert.equal(terminalAfterIntervalEvaluation.sampleCount, 1);

const runAnchorResetSession = new HomepageCanonicalEvaluationSession();
runAnchorResetSession.accept(completedAnchorOneFrame);
assert.equal(runAnchorResetSession.reset().durationSec, 0);
assert.equal(runAnchorResetSession.accept(completedAnchorOneFrame).durationSec, 30);

// Changing a model parameter resets before the first frame in the new
// context is appended.
const changedParameterFrame = buildSimulationAnalysisFrame(
  tleState,
  { ...currentParameters, beamPowerCapW: 1 },
);
const changedContextEvaluation = session.accept(changedParameterFrame);
assert.equal(changedContextEvaluation.sampleCount, 1);
assert.equal(changedContextEvaluation.durationSec, TLE_RUN_STEP_S);
assert.equal(
  changedContextEvaluation.deliveredBits,
  changedParameterFrame.throughput.totalRateBps * TLE_RUN_STEP_S,
);

// Channel/RF controls are model conditions too. They alter H or G^R while a
// new TLE instant alone must continue the same evaluation window.
const channelContextSession = new HomepageCanonicalEvaluationSession();
assert.equal(channelContextSession.accept(previousFrame).sampleCount, 1);
const changedChannelFrame = buildSimulationAnalysisFrame(
  tleState,
  { ...currentParameters, carrierFrequencyGHz: currentParameters.carrierFrequencyGHz + 2 },
);
assert.equal(channelContextSession.accept(changedChannelFrame).sampleCount, 1);

// Constellation is part of the context identity as well.
const starlinkCatalog = await loadTleWebArchiveCatalog(
  '/tle-archive/starlink/catalog.json',
  fetchFromPublic,
);
const starlinkSelection = await loadTleSnapshotSelection(
  starlinkCatalog,
  '2026-08-07T23:59:59.000Z',
  fetchFromPublic,
);
const starlinkTleState = createSimulatorTleState(starlinkSelection, '2026-08-07T23:59:59.000Z');
const starlinkFrame = buildSimulationAnalysisFrame(starlinkTleState, currentParameters);
const constellationEvaluation = session.accept(starlinkFrame);
assert.equal(constellationEvaluation.sampleCount, 1);
assert.equal(
  constellationEvaluation.deliveredBits,
  starlinkFrame.throughput.totalRateBps * TLE_RUN_STEP_S,
);

console.log('Homepage canonical parameter acceptance keeps rejected inputs and frames atomic.');
console.log('Homepage canonical session evaluation de-duplicates frames and supports manual/context resets.');
