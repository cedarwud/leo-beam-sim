import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ReactElement } from 'react';
import profileJson from '../src/profiles/modqn-4sat-7beam-paper-faithful.json' with { type: 'json' };
import { buildAppRuntimeConfig } from '../src/app/appRuntimeConfig.ts';
import type { AppRuntimeConfigInput } from '../src/app/appRuntimeConfig.ts';
import type { Profile } from '../src/profiles/types';
import { createSceneTopologyState } from '../src/sceneTopology.ts';
import {
  MODQN_SERVING_COUNT_OPTIONS,
  MODQN_BEAMS_PER_SERVING_SATELLITE,
} from '../src/modqn/servingCount.ts';
import {
  DISPLAY_CELL_SCHEDULE_MAX_ACTIVE_CELLS_PER_SLOT,
  computeCellScheduleViz,
} from '../src/scene/useCellSchedule.ts';
import { TopologyTab } from '../src/ui/signal-tuning/TopologyTab.tsx';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEG_TO_RAD = Math.PI / 180;
const CENTER_LAT_DEG = 40;
const CENTER_LON_DEG = 116;
const ALTITUDE_KM = 780;
const BEAMWIDTH_3DB_RAD = 2 * DEG_TO_RAD;
const WORLD_UNITS_PER_KM = 2;
const SERVING_COUNTS = [2, 4, 8] as const;
const baseProfile = profileJson as Profile;

const PASSED: string[] = [];

interface TestElementProps {
  readonly children?: unknown;
  readonly checked?: boolean;
  readonly onChange?: () => void;
  readonly onClick?: () => void;
  readonly 'data-testid'?: string;
}

type TestElement = ReactElement<TestElementProps>;

interface RealGeoFixtureSatellite {
  readonly id: string;
  readonly latDeg: number;
  readonly lonDeg: number;
  readonly altitudeKm: number;
}

function pass(label: string): void {
  PASSED.push(label);
  console.log(`PASS ${String(PASSED.length).padStart(2, '0')}: ${label}`);
}

function expect(condition: boolean, label: string): void {
  assert.ok(condition, label);
  pass(label);
}

function expectEqual<T>(actual: T, expected: T, label: string): void {
  assert.deepEqual(actual, expected, label);
  pass(label);
}

function isElement(node: unknown): node is TestElement {
  return Boolean(
    node
      && typeof node === 'object'
      && 'props' in node
      && typeof (node as { props?: unknown }).props === 'object',
  );
}

function findAllByTestId(node: unknown, testId: string): TestElement[] {
  const found: TestElement[] = [];

  function visit(current: unknown): void {
    if (Array.isArray(current)) {
      for (const child of current) visit(child);
      return;
    }

    if (!isElement(current)) return;

    if (current.props['data-testid'] === testId) {
      found.push(current);
    }

    visit(current.props.children);
  }

  visit(node);
  return found;
}

function latestSpyArg(spyCalls: SceneTopologySpyCall[]): SceneTopologySpyCall {
  const latest = spyCalls.at(-1);
  assert.ok(latest, 'expected spy to have at least one call');
  return latest;
}

type SceneTopologySpyCall = ReturnType<typeof createSceneTopologyState>;

function renderTopologyTab(
  appMode: 'modqn-demo' | 'sinr-experiment',
  cellServingCount: number | null = null,
  spyCalls: SceneTopologySpyCall[] = [],
): TestElement {
  return TopologyTab({
    topology: { ...createSceneTopologyState(), cellServingCount },
    baseProfile,
    appMode,
    onTopologyChange: next => spyCalls.push(next),
    onReset: () => undefined,
  }) as TestElement;
}

function runtimeInput(
  appMode: 'modqn-demo' | 'sinr-experiment',
  cellServingCount: number | null,
): AppRuntimeConfigInput {
  return {
    appMode,
    effectiveProfile: baseProfile,
    demoStartOffsetSec: 0,
    signalResetKey: 'signal',
    handoverResetKey: 'handover',
    runtimeVisualSettings: {
      beamDensity: 'event-only',
      effectsEnabled: {
        spineParticles: false,
        orbitTrail: false,
        servingRipple: false,
        pendingRipple: false,
      },
      cinematicMode: 'off',
      reducedMotion: true,
    },
    beamDensityOverride: null,
    beamCalloutsEnabled: false,
    effectiveCinematicMode: 'off',
    cameraCommand: undefined,
    viewport: { width: 1440, height: 900 },
    sceneTopology: { ...createSceneTopologyState(), cellServingCount },
    selectedTrainingEnvAxes: undefined,
  };
}

function buildRealGeoFixture(): readonly RealGeoFixtureSatellite[] {
  const offsets: readonly [number, number][] = [
    [0, 0],
    [0.08, 0],
    [0, 0.08],
    [-0.08, 0],
    [0, -0.08],
    [0.16, 0],
    [0, 0.16],
    [-0.16, 0],
    [0, -0.16],
    [0.24, 0.08],
    [-0.24, -0.08],
    [0.08, -0.24],
  ];

  return offsets.map(([latOffsetDeg, lonOffsetDeg], index) => ({
    id: `fixture-sat-${String(index).padStart(2, '0')}`,
    latDeg: CENTER_LAT_DEG + latOffsetDeg,
    lonDeg: CENTER_LON_DEG + lonOffsetDeg,
    altitudeKm: ALTITUDE_KM,
  }));
}

function scheduleForServingCount(servingCount: number) {
  return computeCellScheduleViz({
    simTimeSec: 0,
    altitudeKm: ALTITUDE_KM,
    beamwidth3dBRad: BEAMWIDTH_3DB_RAD,
    centerLatDeg: CENTER_LAT_DEG,
    centerLonDeg: CENTER_LON_DEG,
    worldUnitsPerKm: WORLD_UNITS_PER_KM,
    satellites: buildRealGeoFixture(),
    servingCount,
  });
}

const demoSpyCalls: SceneTopologySpyCall[] = [];
const demoTree = renderTopologyTab('modqn-demo', null, demoSpyCalls);
expectEqual(findAllByTestId(demoTree, 'topology-tab-serving-count-radio').length, 1, 'modqn-demo renders serving-count fieldset');
for (const option of MODQN_SERVING_COUNT_OPTIONS) {
  expectEqual(findAllByTestId(demoTree, `topology-tab-serving-count-option-${option}`).length, 1, `modqn-demo renders L=${option} option`);
}
expectEqual(findAllByTestId(demoTree, 'topology-tab-serving-count-option-12').length, 0, 'modqn-demo omits non-formal L=12 option');
expectEqual(findAllByTestId(demoTree, 'topology-tab-serving-count-option-8')[0]?.props.checked, true, 'default serving count checks L=8');
expectEqual(findAllByTestId(demoTree, 'topology-tab-serving-count-option-4')[0]?.props.checked, false, 'default serving count leaves L=4 unchecked');

const l4Tree = renderTopologyTab('modqn-demo', 4);
expectEqual(findAllByTestId(l4Tree, 'topology-tab-serving-count-option-4')[0]?.props.checked, true, 'override serving count checks baseline L=4');
expectEqual(findAllByTestId(l4Tree, 'topology-tab-serving-count-option-8')[0]?.props.checked, false, 'override serving count unchecks L=8');

findAllByTestId(demoTree, 'topology-tab-serving-count-option-4')[0]?.props.onChange?.();
expectEqual(latestSpyArg(demoSpyCalls).cellServingCount, 4, 'L=4 onChange writes cellServingCount 4');
findAllByTestId(demoTree, 'topology-tab-serving-count-option-8')[0]?.props.onChange?.();
expectEqual(latestSpyArg(demoSpyCalls).cellServingCount, 8, 'L=8 onChange writes cellServingCount 8');
findAllByTestId(demoTree, 'topology-tab-serving-count-clear-override')[0]?.props.onClick?.();
expectEqual(latestSpyArg(demoSpyCalls).cellServingCount, null, 'clear serving override writes cellServingCount null');

const sinrTree = renderTopologyTab('sinr-experiment');
expectEqual(findAllByTestId(sinrTree, 'topology-tab-serving-count-radio').length, 0, 'sinr-experiment omits serving-count selector');

expectEqual(buildAppRuntimeConfig(runtimeInput('modqn-demo', 4)).cellServingCount, 4, 'runtime maps modqn-demo L=4');
expectEqual(buildAppRuntimeConfig(runtimeInput('modqn-demo', 8)).cellServingCount, 8, 'runtime maps modqn-demo L=8');
expectEqual(buildAppRuntimeConfig(runtimeInput('modqn-demo', 12)).cellServingCount, 8, 'runtime migrates legacy L=12 to L=8');
expectEqual(buildAppRuntimeConfig(runtimeInput('modqn-demo', null)).cellServingCount, undefined, 'runtime omits default modqn-demo serving count');
expectEqual(buildAppRuntimeConfig(runtimeInput('sinr-experiment', 12)).cellServingCount, undefined, 'runtime omits serving count outside modqn-demo');

const distinctAssignedSatCountByL = new Map<number, number>();
for (const servingCount of SERVING_COUNTS) {
  const schedule = scheduleForServingCount(servingCount);
  distinctAssignedSatCountByL.set(
    servingCount,
    new Set(schedule.slot.assignments.map(assignment => assignment.satId)).size,
  );
  expectEqual(schedule.servingCount, servingCount, `cell schedule resolves servingCount L=${servingCount}`);
  const expectedDisplayActive = Math.min(
    schedule.layout.count,
    servingCount * MODQN_BEAMS_PER_SERVING_SATELLITE,
    DISPLAY_CELL_SCHEDULE_MAX_ACTIVE_CELLS_PER_SLOT,
  );
  expectEqual(schedule.slot.assignments.length, expectedDisplayActive, `cell schedule applies display-only active-cell cap at L=${servingCount}`);
  expectEqual(schedule.slot.idleCellIds.length, schedule.layout.count - expectedDisplayActive, `cell schedule reports display idle cells at L=${servingCount}`);
  expectEqual(schedule.visibleCount, 12, `cell schedule sees 12 visible real-geo sats at L=${servingCount}`);
}
expect(
  (distinctAssignedSatCountByL.get(8) ?? 0) > (distinctAssignedSatCountByL.get(4) ?? 0),
  'L=8 assigns cells across more distinct sats than L=4',
);

expectEqual(createSceneTopologyState().cellServingCount, null, 'createSceneTopologyState initializes cellServingCount null');

const mainSceneSource = readFileSync(path.join(REPO_ROOT, 'src/scene/MainScene.tsx'), 'utf8');
expect(
  mainSceneSource.includes('runtime.cellServingCount ?? DEFAULT_SERVING_COUNT'),
  'MainScene passes runtime cellServingCount with default fallback',
);

const runtimeConfigSource = readFileSync(path.join(REPO_ROOT, 'src/app/appRuntimeConfig.ts'), 'utf8');
expect(
  runtimeConfigSource.includes('cellServingCount') && runtimeConfigSource.includes("appMode === 'modqn-demo'"),
  'appRuntimeConfig gates cellServingCount to modqn-demo',
);

const persistenceSource = readFileSync(path.join(REPO_ROOT, 'src/app/appPersistence.ts'), 'utf8');
expect(persistenceSource.includes('cellServingCount'), 'appPersistence reads cellServingCount');

assert.ok(PASSED.length >= 18, `expected >=18 assertions; got ${PASSED.length}`);
console.log(`validate-phase-i-s7b-serving-count-selector: PASS (${PASSED.length}/0 assertions)`);
