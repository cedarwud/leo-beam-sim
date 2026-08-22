import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { approvedTransmitGainLinear } from '../analysis/canonicalEe';
import {
  loadTleSnapshotSelection,
  loadTleWebArchiveCatalog,
  parseTleWebArchiveCatalog,
} from './archive';
import {
  buildSimulationAnalysisFrame,
  createSimulatorTleState,
  deriveTaipeiLinkGeometry,
} from './analysis';
import { receiveGainDbiToLinear } from './canonicalChannelAdapter';
import {
  DEFAULT_SIMULATOR_PARAMETERS,
  NON_EDITABLE_SIMULATOR_PARAMETER_KEYS,
  SIMULATOR_PARAMETER_OWNERSHIP,
  SIMULATOR_CATALOG_URLS,
  SIMULATOR_TABS,
} from './types';

const fetchFromPublic = async (path: RequestInfo | URL): Promise<Response> => (
  new Response(await readFile(`public${String(path)}`), { status: 200 })
);

const catalog = await loadTleWebArchiveCatalog(
  '/tle-archive/oneweb/catalog.json',
  fetchFromPublic,
);

assert.equal(catalog.schemaVersion, 'tle-web-archive-v1');
assert.equal(catalog.snapshotCount, catalog.snapshots.length);
assert.equal(catalog.snapshots[0]?.identityCount, catalog.snapshots[0]?.recordCount);
assert.deepEqual(SIMULATOR_TABS.map(tab => tab.id), ['sinr', 'ee', 'power', 'throughput']);
for (const [key, value] of Object.entries(DEFAULT_SIMULATOR_PARAMETERS)) {
  assert.ok(Number.isFinite(value), `${key} default must be finite`);
}
assert.equal(DEFAULT_SIMULATOR_PARAMETERS.beamPowerCapW, 1.65);
assert.equal(DEFAULT_SIMULATOR_PARAMETERS.satellitePowerCapW, 10 ** (13 / 10));
assert.equal(DEFAULT_SIMULATOR_PARAMETERS.etaMax, 0.35);
assert.equal(DEFAULT_SIMULATOR_PARAMETERS.backoffDb, 5);
assert.equal(DEFAULT_SIMULATOR_PARAMETERS.rfcPowerW, 0.338);
assert.equal(DEFAULT_SIMULATOR_PARAMETERS.basebandPerSatelliteW, 0.2);
assert.equal(DEFAULT_SIMULATOR_PARAMETERS.frequencyReuse, 3);
assert.equal(DEFAULT_SIMULATOR_PARAMETERS.antennaNoiseTemperatureK, 150);
assert.equal(DEFAULT_SIMULATOR_PARAMETERS.noiseFigureDb, 1.2);
assert.equal(DEFAULT_SIMULATOR_PARAMETERS.noiseReferenceTemperatureK, 290);
assert.equal(DEFAULT_SIMULATOR_PARAMETERS.g0Linear, 2_000);
assert.equal(DEFAULT_SIMULATOR_PARAMETERS.theta3dbRad, 3.32 * Math.PI / 180);
assert.equal(DEFAULT_SIMULATOR_PARAMETERS.carrierFrequencyGHz, 20);
assert.equal(DEFAULT_SIMULATOR_PARAMETERS.atmosphericZenithLossDb, 0.05);
assert.equal(DEFAULT_SIMULATOR_PARAMETERS.scintillationScaleDb, 0);
assert.equal(DEFAULT_SIMULATOR_PARAMETERS.shadowFadingMarginDb, 0);
assert.equal(DEFAULT_SIMULATOR_PARAMETERS.receiveGainDbi, 35);
assert.equal(DEFAULT_SIMULATOR_PARAMETERS.minimumRateBps, 1_000_000);
assert.equal(DEFAULT_SIMULATOR_PARAMETERS.systemBandwidthHz, 500_000_000);

const entrySource = await readFile('src/main.tsx', 'utf8');
const canonicalTabSources = {
  sinr: await readFile('src/ui/signal-tuning/CanonicalSinrTab.tsx', 'utf8'),
  ee: await readFile('src/ui/signal-tuning/CanonicalEeTab.tsx', 'utf8'),
  power: await readFile('src/ui/signal-tuning/PowerTab.tsx', 'utf8'),
  throughput: await readFile('src/ui/signal-tuning/ThroughputTab.tsx', 'utf8'),
} as const;

// Coverage gate: every SimulatorParameters key is either a formal editable
// input with one primary owner or an explicitly quarantined compatibility
// field. A read-only evidence copy on another page does not count as a second
// owner; the source check below requires each declared control to exist in the
// declared page and to mention the corresponding parameter in its change path.
const parameterKeys = Object.keys(DEFAULT_SIMULATOR_PARAMETERS).sort();
const ownershipEntries = Object.entries(SIMULATOR_PARAMETER_OWNERSHIP) as Array<[
  keyof typeof DEFAULT_SIMULATOR_PARAMETERS,
  (typeof SIMULATOR_PARAMETER_OWNERSHIP)[keyof typeof SIMULATOR_PARAMETER_OWNERSHIP],
]>;
const editableParameterKeys = ownershipEntries.map(([key]) => key).sort();
const nonEditableParameterKeys = [...NON_EDITABLE_SIMULATOR_PARAMETER_KEYS].sort();
assert.deepEqual(
  [...editableParameterKeys, ...nonEditableParameterKeys].sort(),
  parameterKeys,
  'every SimulatorParameters key must be editable or explicitly quarantined',
);
assert.equal(
  editableParameterKeys.filter(key => nonEditableParameterKeys.includes(key as never)).length,
  0,
  'an editable parameter cannot also be quarantined',
);
assert.deepEqual(
  nonEditableParameterKeys,
  ['channelGainScale', 'scintillationScaleDb', 'shadowFadingMarginDb'],
  'only the three non-formal channel extensions may remain quarantined',
);
const primaryControlIds = ownershipEntries.map(([, owner]) => owner.controlTestId);
assert.equal(
  new Set(primaryControlIds).size,
  primaryControlIds.length,
  'each editable parameter must have a unique primary control id',
);
for (const [parameterKey, owner] of ownershipEntries) {
  const source = canonicalTabSources[owner.tab];
  const marker = `testId="${owner.controlTestId}"`;
  const markerCount = source.split(marker).length - 1;
  assert.equal(markerCount, 1, `${parameterKey} must be rendered once by its primary tab`);
  const markerIndex = source.indexOf(marker);
  const controlStart = source.lastIndexOf('<NumericControl', markerIndex);
  const closingControl = source.slice(markerIndex).match(/\n\s*\/>/);
  const controlEnd = closingControl?.index === undefined
    ? -1
    : markerIndex + closingControl.index + closingControl[0].length;
  assert.ok(controlStart >= 0 && controlEnd > markerIndex, `${parameterKey} must use a NumericControl`);
  const controlSource = source.slice(controlStart, controlEnd);
  assert.match(
    controlSource,
    new RegExp(`\\b${String(parameterKey).replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')}\\b`),
    `${parameterKey} must be wired through its declared control`,
  );
}
assert.deepEqual(
  ownershipEntries
    .filter(([, owner]) => owner.tab === 'ee')
    .map(([key]) => key)
    .sort(),
  ['backoffDb', 'basebandPerSatelliteW', 'etaMax', 'rfcPowerW'],
  'EE owns exactly the four canonical energy-consumption inputs',
);
assert.match(
  entrySource,
  /isUnifiedVisualLabRoute = window\.location\.pathname === '\/simulator'[\s\S]*window\.location\.pathname === '\/visual-lab'[\s\S]*window\.location\.pathname === '\/explain'[\s\S]*window\.location\.pathname === '\/prototype\/scientific-explain'[\s\S]*window\.location\.pathname === '\/prototype\/scientific-explain-3d'/,
  'the public simulator route and visual-lab aliases must select the unified visual-lab route',
);
assert.match(
  entrySource,
  /isLegacyWalkerRoute = window\.location\.pathname === '\/'[\s\S]*window\.location\.pathname === '\/legacy'[\s\S]*window\.location\.pathname === '\/walker'/,
  'the homepage and legacy aliases must select the original Walker shell',
);
assert.match(
  entrySource,
  /if \(isUnifiedVisualLabRoute\)[\s\S]{0,360}UnifiedVisualLabPrototype/,
  'public simulator aliases must render UnifiedVisualLabPrototype',
);
assert.match(
  entrySource,
  /isCanonicalSimulatorDevelopmentRoute = window\.location\.pathname !== '\/simulator'[\s\S]*query\.get\('simulator'\) === 'canonical'/,
  'the explicit canonical query remains available as a non-public development route',
);
assert.match(
  entrySource,
  /if \(isCanonicalSimulatorDevelopmentRoute\)[\s\S]{0,220}SimulatorRoute/,
  'the canonical development query must retain its SimulatorRoute implementation',
);
assert.match(
  entrySource,
  /isStandaloneScientificExplain3DRoute = window\.location\.pathname === '\/prototype\/scientific-explain-legacy-3d'/,
  'the standalone 3D scientific prototype must have an explicit route',
);
assert.match(
  entrySource,
  /if \(isStandaloneScientificExplain3DRoute\)[\s\S]{0,360}ScientificExplain3DPrototype/,
  'the standalone 3D route must mount only the original 3D prototype',
);
assert.match(
  entrySource,
  /isStandaloneGlobalConstellationRoute = window\.location\.pathname === '\/prototype\/global-constellation'/,
  'the standalone global constellation prototype must have an explicit route',
);
assert.match(
  entrySource,
  /if \(isStandaloneGlobalConstellationRoute\)[\s\S]{0,420}GlobalConstellationPrototype/,
  'the standalone global route must mount the constellation prototype',
);
assert.doesNotMatch(
  entrySource,
  /scientific-explain-legacy-2d|scientific-explain-2d|ScientificExplainPrototype/,
  'the retired 2D scientific prototype must not remain routable',
);
assert.doesNotMatch(
  entrySource,
  /if \(isUnifiedVisualLabRoute\)[\s\S]{0,360}(?:ScientificExplainPrototype|ScientificExplain3DPrototype|ScientificExplanationRoute)/,
  'the unified visual-lab route must not mount a second explanation renderer or calculator',
);
const homeAppSource = await readFile('src/App.tsx', 'utf8');
const simulatorRouteSource = await readFile('src/simulator/SimulatorRoute.tsx', 'utf8');
assert.doesNotMatch(
  homeAppSource,
  /(?:href|assign)\s*(?:=|\()\s*['"]\/course\/c120/,
  'the original homepage must not expose a C-120 jump control',
);
assert.doesNotMatch(
  simulatorRouteSource,
  /(?:href|assign)\s*(?:=|\()\s*['"]\/course\/c120/,
  'the formal simulator must not expose a C-120 jump control',
);

// Select one complete prior publication rather than merging overlapping daily
// revisions into a synthetic manifest.
const boundarySelection = await loadTleSnapshotSelection(
  catalog,
  '2026-08-07T23:59:59.000Z',
  fetchFromPublic,
);
assert.equal(boundarySelection.snapshot.metadata.archiveDate, '20260807');
assert.ok(boundarySelection.manifest.entries.length > 0);
assert.ok(boundarySelection.manifest.entries.length <= boundarySelection.snapshot.entries.length);

const state = createSimulatorTleState(boundarySelection, '2026-08-07T23:59:59.000Z');
assert.equal(state.propagationFrame.satellites.length, boundarySelection.manifest.entries.length);
assert.ok(state.trajectory.length >= 10);
assert.ok(state.selectedSatelliteId.length > 0);
assert.ok(state.candidateSatellite, 'the same TLE frame should expose an above-horizon comparison candidate');
assert.notEqual(state.candidateSatellite?.satelliteId, state.selectedSatelliteId);
assert.ok(state.selectedSnapshot.sourcePath.endsWith('.tle'));

const analysisFrame = buildSimulationAnalysisFrame(state, DEFAULT_SIMULATOR_PARAMETERS);
assert.ok(Object.isFrozen(analysisFrame));
const analysisLink = analysisFrame.links[0]!;
const analysisLinkUserIndex = Number(analysisLink.userId.replace('ue-', '')) - 1;
const expectedAnalysisLinkUserIndex = analysisFrame.inputs.frame.servingBeamU.reduce(
  (selected, servingBeam, userIndex) => {
    if (servingBeam < 0) return selected;
    if (selected < 0) return userIndex;
    return (analysisFrame.power.pReqUW[userIndex] ?? -Infinity)
      > (analysisFrame.power.pReqUW[selected] ?? -Infinity)
      ? userIndex
      : selected;
  },
  -1,
);
assert.equal(analysisLinkUserIndex, expectedAnalysisLinkUserIndex);
assert.equal(analysisLink.beamId, analysisFrame.inputs.frame.servingBeamU[expectedAnalysisLinkUserIndex]);
assert.equal(analysisLink.actualPowerW, analysisFrame.power.pDlActualBW[analysisLink.beamId]);
assert.equal(analysisLink.beforeSatelliteCapPowerW, analysisFrame.power.pDlBeforeSatelliteCapBW[analysisLink.beamId]);
assert.equal(analysisLink.requestedPowerW, analysisFrame.power.pReqUW[analysisLinkUserIndex]);
assert.equal(analysisLink.requestedPowerW, analysisFrame.power.pReqBW[analysisLink.beamId]);
assert.equal(analysisLink.offAxisAngleRad, analysisFrame.inputs.frame.thetaRadUb[analysisLinkUserIndex]?.[analysisLink.beamId]);
assert.equal(analysisLink.sinrLinear, analysisFrame.throughput.sinrU[analysisLinkUserIndex]);
assert.ok(analysisFrame.candidateLink, 'the immutable analysis frame should include the bounded candidate projection');
assert.equal(analysisFrame.candidateLink?.satelliteId, state.candidateSatellite?.satelliteId);
assert.notEqual(analysisFrame.candidateLink?.satelliteId, analysisFrame.links[0]?.satelliteId);
assert.ok((analysisFrame.candidateLink?.elevationDeg ?? -90) >= 0);
assert.ok(Object.isFrozen(analysisFrame.candidateLink));
assert.ok(Number.isFinite(analysisFrame.candidateLink?.beforeSatelliteCapPowerW));
assert.ok((analysisFrame.candidateLink?.beforeSatelliteCapPowerW ?? -1) >= 0);
assert.equal(analysisFrame.ee.aggregation, 'ratio-of-sums');
assert.ok(analysisFrame.provenance.selectedTlePath.startsWith('/tle-archive/oneweb/'));
assert.equal(analysisFrame.provenance.constellation, 'oneweb');
assert.equal(analysisFrame.provenance.archiveCatalogUrl, SIMULATOR_CATALOG_URLS.oneweb);

// Homepage controls are real canonical inputs, not display-only sliders. Each
// accepted edit is stamped into a new immutable frame and reaches the single
// producer configuration used by all four projections.
const configuredFrame = buildSimulationAnalysisFrame(state, {
  ...DEFAULT_SIMULATOR_PARAMETERS,
  antennaNoiseTemperatureK: DEFAULT_SIMULATOR_PARAMETERS.antennaNoiseTemperatureK * 2,
  frequencyReuse: 1,
  g0Linear: DEFAULT_SIMULATOR_PARAMETERS.g0Linear * 10,
  theta3dbRad: DEFAULT_SIMULATOR_PARAMETERS.theta3dbRad * 1.5,
  backoffDb: DEFAULT_SIMULATOR_PARAMETERS.backoffDb + 1,
});
assert.notEqual(configuredFrame.frameId, analysisFrame.frameId);
assert.equal(
  configuredFrame.scenario.derived.systemNoiseTemperatureK,
  DEFAULT_SIMULATOR_PARAMETERS.antennaNoiseTemperatureK * 2
    + DEFAULT_SIMULATOR_PARAMETERS.noiseReferenceTemperatureK
      * (10 ** (DEFAULT_SIMULATOR_PARAMETERS.noiseFigureDb / 10) - 1),
);
assert.equal(configuredFrame.inputs.config.g0Linear, DEFAULT_SIMULATOR_PARAMETERS.g0Linear * 10);
const configuredFullHpbwRad = DEFAULT_SIMULATOR_PARAMETERS.theta3dbRad * 1.5;
assert.equal(configuredFrame.inputs.config.theta3dbRad, configuredFullHpbwRad / 2);
assert.equal(
  configuredFrame.inputs.frame.receiveGainUb[0]?.[0],
  receiveGainDbiToLinear(DEFAULT_SIMULATOR_PARAMETERS.receiveGainDbi),
);
assert.equal(configuredFrame.inputs.frame.laggedInterferenceUW[0], 0);
assert.equal(configuredFrame.inputs.frame.beamLoadB.reduce((sum, load) => sum + load, 0), 100);
assert.equal(configuredFrame.throughput.rateUBps.length, 100);
assert.equal(configuredFrame.inputs.config.backoffDb, DEFAULT_SIMULATOR_PARAMETERS.backoffDb + 1);
const configuredLink = configuredFrame.links[0]!;
const configuredLinkUserIndex = Number(configuredLink.userId.replace('ue-', '')) - 1;
const expectedConfiguredLinkUserIndex = configuredFrame.inputs.frame.servingBeamU.reduce(
  (selected, servingBeam, userIndex) => {
    if (servingBeam < 0) return selected;
    if (selected < 0) return userIndex;
    return (configuredFrame.power.pReqUW[userIndex] ?? -Infinity)
      > (configuredFrame.power.pReqUW[selected] ?? -Infinity)
      ? userIndex
      : selected;
  },
  -1,
);
assert.equal(configuredLinkUserIndex, expectedConfiguredLinkUserIndex);
assert.equal(configuredLink.beamId, configuredFrame.inputs.frame.servingBeamU[expectedConfiguredLinkUserIndex]);
assert.equal(configuredLink.actualPowerW, configuredFrame.power.pDlActualBW[configuredLink.beamId]);
assert.equal(configuredLink.beforeSatelliteCapPowerW, configuredFrame.power.pDlBeforeSatelliteCapBW[configuredLink.beamId]);
assert.equal(configuredLink.requestedPowerW, configuredFrame.power.pReqUW[configuredLinkUserIndex]);
assert.equal(configuredLink.sinrLinear, configuredFrame.throughput.sinrU[configuredLinkUserIndex]);
assert.equal(configuredFrame.candidateLink?.satelliteId, analysisFrame.candidateLink?.satelliteId);

// The sidebar exposes the authority's full HPBW. The frozen Bessel producer
// consumes the corresponding one-sided half-power angle; this parity check
// prevents silently reverting to the old full-width denominator.
const configuredThetaRad = configuredFrame.inputs.frame.thetaRadUb[0]?.[0] ?? 0;
const expectedConfiguredGain = approvedTransmitGainLinear(
  configuredThetaRad,
  configuredFrame.inputs.config.g0Linear,
  configuredFullHpbwRad / 2,
);
assert.equal(configuredFrame.inputs.config.theta3dbRad, configuredFullHpbwRad / 2);
assert.ok(
  Math.abs((configuredFrame.canonical.transmitGainUb[0]?.[0] ?? 0) - expectedConfiguredGain)
    <= Number.EPSILON * Math.max(1, Math.abs(expectedConfiguredGain)) * 16,
  'full HPBW must reach the canonical Bessel producer as its half-angle denominator',
);

// RF/channel controls are model inputs, not TLE fields.  Each one must reach
// the same canonical H/G^R frame and change the resulting requested power in a
// non-binding-cap comparison frame.
const channelTrackingParameters = {
  ...DEFAULT_SIMULATOR_PARAMETERS,
  beamPowerCapW: Math.max(
    DEFAULT_SIMULATOR_PARAMETERS.beamPowerCapW,
    (analysisFrame.links[0]?.requestedPowerW ?? 1) * 10,
  ),
  satellitePowerCapW: Math.max(
    DEFAULT_SIMULATOR_PARAMETERS.satellitePowerCapW,
    (analysisFrame.links[0]?.requestedPowerW ?? 1) * 10,
  ),
};
const channelTrackingFrame = buildSimulationAnalysisFrame(state, channelTrackingParameters);
assert.ok(Number.isFinite(channelTrackingFrame.inputs.frame.propagationGainUb[0]?.[0] ?? NaN));
assert.ok(Number.isFinite(channelTrackingFrame.inputs.frame.receiveGainUb[0]?.[0] ?? NaN));

const channelControlCases = [
  ['carrier frequency', { carrierFrequencyGHz: DEFAULT_SIMULATOR_PARAMETERS.carrierFrequencyGHz + 2 }],
  ['atmospheric loss', { atmosphericZenithLossDb: DEFAULT_SIMULATOR_PARAMETERS.atmosphericZenithLossDb + 0.1 }],
  ['receive gain', { receiveGainDbi: DEFAULT_SIMULATOR_PARAMETERS.receiveGainDbi - 5 }],
] as const;
for (const [label, patch] of channelControlCases) {
  const changed = buildSimulationAnalysisFrame(state, {
    ...channelTrackingParameters,
    ...patch,
  });
  if (label === 'receive gain') {
    assert.notEqual(
      changed.inputs.frame.receiveGainUb[0]?.[0],
      channelTrackingFrame.inputs.frame.receiveGainUb[0]?.[0],
      `${label} must reach canonical G^R`,
    );
  } else {
    assert.notEqual(
      changed.inputs.frame.propagationGainUb[0]?.[0],
      channelTrackingFrame.inputs.frame.propagationGainUb[0]?.[0],
      `${label} must reach canonical H`,
    );
  }
  assert.notEqual(
    changed.links[0]?.requestedPowerW,
    channelTrackingFrame.links[0]?.requestedPowerW,
    `${label} must change canonical requested power`,
  );
}

for (const [label, patch] of [
  ['scintillation', { scintillationScaleDb: DEFAULT_SIMULATOR_PARAMETERS.scintillationScaleDb + 5 }],
  ['shadow fading', { shadowFadingMarginDb: DEFAULT_SIMULATOR_PARAMETERS.shadowFadingMarginDb + 5 }],
  ['legacy channel scale', { channelGainScale: DEFAULT_SIMULATOR_PARAMETERS.channelGainScale * 10 }],
] as const) {
  const unchanged = buildSimulationAnalysisFrame(state, {
    ...channelTrackingParameters,
    ...patch,
  });
  assert.equal(
    unchanged.inputs.frame.propagationGainUb[0]?.[0],
    channelTrackingFrame.inputs.frame.propagationGainUb[0]?.[0],
    `${label} must stay outside the formal G^LS path`,
  );
  assert.equal(
    unchanged.links[0]?.requestedPowerW,
    channelTrackingFrame.links[0]?.requestedPowerW,
    `${label} must not alter formal requested power`,
  );
}

assert.equal(
  channelTrackingFrame.inputs.frame.receiveGainUb[0]?.[0],
  receiveGainDbiToLinear(DEFAULT_SIMULATOR_PARAMETERS.receiveGainDbi),
  'receive gain dBi must be converted to dimensionless linear G^R',
);
assert.ok(
  channelTrackingFrame.inputs.frame.propagationGainUb[0]?.[0] !== undefined
    && channelTrackingFrame.inputs.frame.propagationGainUb[0]![0]! >= 0,
  'canonical H must be finite and non-negative',
);

// Choose caps from the first requested-power result so this assertion proves
// the target-tracking branch itself, rather than accidentally testing a
// constellation/time sample where a default cap already binds.
const trackingPowerCapW = Math.max(
  DEFAULT_SIMULATOR_PARAMETERS.beamPowerCapW,
  (analysisFrame.links[0]?.requestedPowerW ?? 1) * 3,
);
const trackingParameters = {
  ...DEFAULT_SIMULATOR_PARAMETERS,
  beamPowerCapW: trackingPowerCapW,
  satellitePowerCapW: trackingPowerCapW,
};
const trackingFrame = buildSimulationAnalysisFrame(state, trackingParameters);
const higherNoiseFrame = buildSimulationAnalysisFrame(state, {
  ...trackingParameters,
  antennaNoiseTemperatureK: trackingParameters.antennaNoiseTemperatureK * 2,
});
assert.equal(trackingFrame.links[0]?.powerLimited, false);
assert.equal(higherNoiseFrame.links[0]?.powerLimited, false);
assert.ok(
  (higherNoiseFrame.links[0]?.requestedPowerW ?? 0) > (trackingFrame.links[0]?.requestedPowerW ?? 0),
  'raising antenna noise temperature must raise requested power in the target-tracking branch',
);
assert.ok(
  Math.abs((higherNoiseFrame.links[0]?.sinrLinear ?? 0) - (trackingFrame.links[0]?.sinrLinear ?? 0)) < 1e-12,
  'before a cap binds, requested power must compensate noise and preserve gamma_req',
);

const higherChannelScaleFrame = buildSimulationAnalysisFrame(state, {
  ...trackingParameters,
  channelGainScale: 10,
});
assert.equal(higherChannelScaleFrame.links[0]?.powerLimited, false);
assert.equal(
  higherChannelScaleFrame.inputs.frame.propagationGainUb[0]?.[0],
  trackingFrame.inputs.frame.propagationGainUb[0]?.[0],
  'the legacy channel scale must stay outside canonical H',
);
assert.equal(
  higherChannelScaleFrame.links[0]?.requestedPowerW,
  trackingFrame.links[0]?.requestedPowerW,
  'the legacy channel scale must not alter formal requested power',
);

const higherBackoffFrame = buildSimulationAnalysisFrame(state, {
  ...DEFAULT_SIMULATOR_PARAMETERS,
  backoffDb: DEFAULT_SIMULATOR_PARAMETERS.backoffDb + 1,
});
assert.ok(
  higherBackoffFrame.power.systemPowerW > analysisFrame.power.systemPowerW,
  'more PA backoff must lower efficiency and raise system power for the same RF output',
);

const starlinkCatalog = await loadTleWebArchiveCatalog(
  SIMULATOR_CATALOG_URLS.starlink,
  fetchFromPublic,
);
const starlinkSelection = await loadTleSnapshotSelection(
  starlinkCatalog,
  '2026-08-08T03:00:00.000Z',
  fetchFromPublic,
);
assert.ok(starlinkSelection.manifest.entries.length > 5_000);
const starlinkState = createSimulatorTleState(starlinkSelection, '2026-08-08T03:00:00.000Z');
assert.equal(starlinkState.propagationFrame.satellites.length, starlinkSelection.manifest.entries.length);
const starlinkFrame = buildSimulationAnalysisFrame(starlinkState, DEFAULT_SIMULATOR_PARAMETERS);
assert.equal(starlinkFrame.provenance.constellation, 'starlink');
assert.equal(starlinkFrame.provenance.archiveCatalogUrl, SIMULATOR_CATALOG_URLS.starlink);
assert.ok(starlinkFrame.provenance.selectedTlePath.startsWith('/tle-archive/starlink/'));
assert.notEqual(starlinkFrame.tleFrameId, analysisFrame.tleFrameId);

const overhead = deriveTaipeiLinkGeometry(
  { x: 0, y: 0, z: 7_500 },
  '2026-08-07T23:59:59.000Z',
);
assert.ok(overhead.offAxisAngleRad >= 0 && overhead.offAxisAngleRad <= Math.PI);
assert.ok(Number.isFinite(overhead.elevationDeg));

assert.throws(() => parseTleWebArchiveCatalog({
  ...catalog,
  snapshots: [{ ...catalog.snapshots[0]!, path: '/outside/evil.tle' }],
  snapshotCount: 1,
  firstArchiveDate: catalog.snapshots[0]!.archiveDate,
  lastArchiveDate: catalog.snapshots[0]!.archiveDate,
}), /bind to its archiveDate|path/);

console.log('simulator tests passed');
