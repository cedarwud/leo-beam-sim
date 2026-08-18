import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  loadTleSnapshotSelection,
  loadTleWebArchiveCatalog,
} from '../../simulator/archive';
import {
  buildSimulationAnalysisFrame,
  createSimulatorTleState,
} from '../../simulator/analysis';
import {
  DEFAULT_SIMULATOR_PARAMETERS,
  SIMULATOR_CATALOG_URLS,
  type SimulationAnalysisFrame,
  type SimulatorParameters,
} from '../../simulator/types';
import {
  VISUAL_LAB_INPUT_DEFINITIONS,
  VISUAL_LAB_INPUT_KEYS,
  type VisualLabInputDefinition,
  type VisualLabInputKey,
} from './visualLabExperimentSchema';

/**
 * This test deliberately loads the checked-in archived TLE catalog.  It is a
 * causal contract test, not a UI fixture: every assertion observes the public
 * canonical frame produced from one real SGP4 state and one parameter set.
 */
const fetchFromPublic = async (path: RequestInfo | URL): Promise<Response> => (
  new Response(await readFile(`public${String(path)}`), { status: 200 })
);

const instantUtc = '2026-08-08T12:00:00.000Z';
const catalog = await loadTleWebArchiveCatalog(
  SIMULATOR_CATALOG_URLS.oneweb,
  fetchFromPublic,
);
const selection = await loadTleSnapshotSelection(catalog, instantUtc, fetchFromPublic);
const tleState = createSimulatorTleState(selection, instantUtc);
const baseParameters: SimulatorParameters = { ...DEFAULT_SIMULATOR_PARAMETERS };
const baseFrame = buildSimulationAnalysisFrame(tleState, baseParameters);

interface MetricVector {
  readonly sinrDb: number;
  readonly systemPowerW: number;
  readonly throughputBps: number;
  readonly eeBitsPerJ: number;
}

function metrics(frame: SimulationAnalysisFrame): MetricVector {
  const serving = frame.links[0];
  assert.ok(serving !== undefined, 'the real canonical frame must expose a serving link');
  return {
    sinrDb: serving.sinrDb,
    systemPowerW: frame.power.systemPowerW,
    throughputBps: frame.throughput.totalRateBps,
    eeBitsPerJ: frame.ee.instantaneousBitsPerJ,
  };
}

function changed(before: number, after: number): boolean {
  const tolerance = Math.max(1e-9, Math.abs(before) * 1e-9);
  return Math.abs(after - before) > tolerance;
}

function changedMetricNames(before: MetricVector, after: MetricVector): readonly string[] {
  return (Object.keys(before) as (keyof MetricVector)[]).filter((key) => changed(before[key], after[key]));
}

function definitionFor(key: VisualLabInputKey): VisualLabInputDefinition {
  const definition = VISUAL_LAB_INPUT_DEFINITIONS.find((item) => item.key === key);
  assert.ok(definition !== undefined, `schema must define ${key}`);
  return definition;
}

/** Pick a materially different value while staying inside the displayed schema range. */
function legalPerturbation(key: VisualLabInputKey): number {
  const definition = definitionFor(key);
  // A higher cap can be non-binding at the base operating point.  Use the
  // legal lower boundary for these two controls so the causal test exercises
  // the canonical saturation branch rather than mistaking a dormant limit for
  // a no-op.
  if (key === 'beamPowerCapW' || key === 'satellitePowerCapW') {
    const bindingValue = definition.fromDisplayValue(definition.min);
    assert.notEqual(bindingValue, baseParameters[key], `${key} binding perturbation must change its canonical value`);
    return bindingValue;
  }
  const currentDisplay = definition.toDisplayValue(baseParameters[key]);
  const delta = definition.valueKind === 'integer'
    ? Math.max(definition.step, Math.ceil((definition.max - definition.min) * .05))
    : Math.max(definition.step * 4, (definition.max - definition.min) * .05);
  const upward = currentDisplay + delta <= definition.max;
  const nextDisplay = upward
    ? currentDisplay + delta
    : currentDisplay - delta;
  assert.ok(nextDisplay >= definition.min && nextDisplay <= definition.max, `${key} perturbation must stay in schema range`);
  const next = definition.fromDisplayValue(definition.valueKind === 'integer' ? Math.round(nextDisplay) : nextDisplay);
  assert.notEqual(next, baseParameters[key], `${key} perturbation must change its canonical value`);
  return next;
}

function frameFor(key: VisualLabInputKey, value: number): SimulationAnalysisFrame {
  return buildSimulationAnalysisFrame(tleState, {
    ...baseParameters,
    [key]: value,
  });
}

const baseMetrics = metrics(baseFrame);
assert.deepEqual([...VISUAL_LAB_INPUT_KEYS], [...VISUAL_LAB_INPUT_DEFINITIONS.map((item) => item.key)]);
assert.equal(baseFrame.provenance.sourceKind, 'ARCHIVED_TLE');
assert.equal(baseFrame.provenance.propagationModel, 'SGP4');

for (const key of VISUAL_LAB_INPUT_KEYS) {
  const nextFrame = frameFor(key, legalPerturbation(key));
  assert.notEqual(nextFrame.frameId, baseFrame.frameId, `${key} must change the canonical frame identity`);
  const changedMetrics = changedMetricNames(baseMetrics, metrics(nextFrame));
  assert.ok(
    changedMetrics.length > 0,
    `${key} must change SINR, system power, throughput, or EE; changed=${changedMetrics.join(',') || 'none'}`,
  );
}

// The power-cap controls use legal low values that actually bind the producer
// branch.  A non-binding cap would correctly leave the canonical result alone.
for (const key of ['beamPowerCapW', 'satellitePowerCapW'] as const) {
  const definition = definitionFor(key);
  const lowCap = definition.fromDisplayValue(definition.min);
  const constrainedFrame = frameFor(key, lowCap);
  const constrainedServing = constrainedFrame.links[0];
  assert.ok(constrainedServing !== undefined, `${key} constrained frame must retain a serving link`);
  const constrainedMetrics = metrics(constrainedFrame);
  const reducedKpi = constrainedMetrics.sinrDb < baseMetrics.sinrDb
    || constrainedMetrics.throughputBps < baseMetrics.throughputBps
    || constrainedMetrics.eeBitsPerJ < baseMetrics.eeBitsPerJ;
  assert.ok(
    reducedKpi || constrainedServing.powerLimited,
    `${key} low legal cap must reduce SINR/throughput/EE or mark the serving link power-limited`,
  );
  assert.equal(constrainedServing.powerLimited, true, `${key} low legal cap must bind the canonical producer`);
}

// Power-only controls are expected to leave link quality unchanged in some
// cases because power control tracks the requested SINR target.  Their causal
// contract is therefore explicitly Power or EE, not necessarily SINR.
for (const key of ['etaMax', 'backoffDb', 'rfcPowerW', 'basebandPerSatelliteW'] as const) {
  const nextFrame = frameFor(key, legalPerturbation(key));
  const before = metrics(baseFrame);
  const after = metrics(nextFrame);
  assert.ok(
    changed(before.systemPowerW, after.systemPowerW) || changed(before.eeBitsPerJ, after.eeBitsPerJ),
    `${key} must change canonical system power or EE`,
  );
}

console.log('Visual Lab canonical input causality: 17 real archived-TLE/SGP4 inputs and binding caps passed.');
