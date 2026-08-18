import { DEFAULT_SIMULATOR_PARAMETERS } from '../../simulator/types';
import { TLE_RUN_ANCHOR_COUNT } from '../../tle/run';
import type { ScientificFixtureManifest } from './types';

function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== 'object') return value;
  if (!Object.isFrozen(value)) Object.freeze(value);
  for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
  return value;
}

export const ACCEPTED_SCIENTIFIC_FIXTURE_MANIFEST = deepFreeze({
  schemaVersion: 'scientific-fixture-manifest-v1',
  status: 'ACCEPTED',
  acceptedBy: 'fresh-context:s1-semantic-review+s1-integration-review',
  acceptedAtUtc: '2026-08-14T13:07:38Z',
  source: {
    constellation: 'oneweb',
    archiveId: 'oneweb-20250727-20260812-0954fc6c0e90',
    archiveContentSha256: '0954fc6c0e90bb0cfa770661368f5452e1f37ce4481ea650609e54e9ea11dd1c',
    archiveDate: '20260807',
    snapshotPath: '/tle-archive/oneweb/oneweb_20260807.tle',
    selectedTleSha256: 'a1137a105d277ee527b6498beacdac51c9826557408017b25c90fc3f91bfac00',
    requestedInstantUtc: '2026-08-07T23:59:59.000Z',
    sourceKind: 'ARCHIVED_TLE',
    propagationModel: 'SGP4',
    geometryRunId: 'tle-run:oneweb-20250727-20260812-0954fc6c0e90:a1137a105d277ee527b6498beacdac51c9826557408017b25c90fc3f91bfac00:2026-08-07T23%3A59%3A59.000Z:7200:30:136d475e',
  },
  referenceParameters: { ...DEFAULT_SIMULATOR_PARAMETERS },
  fixtures: {
    method: {
      fixtureId: 'method-state-v1',
      anchorIndex: 47,
      analysisRunId: 'analysis-run-03ef0a2a',
      frameId: 'analysis-ee7fbeeb',
      identity: { satelliteId: '55796', beamId: 1, userIndex: 29, userId: 'ue-30' },
      expectedTerms: {
        theta: 0.011240719179150774,
        transmitGain: 1807.121891561789,
        rawH: 5.666452889890504e-12,
        hDiv: 5.666452889890504e-12,
        gammaReq: 0.06437018245335979,
        pReqUser: 0.0063335756717664456,
        pReqBeam: 0.0063335756717664456,
        actualBeamRf: 0.0063335756717664456,
        sinr: 0.0643687378670359,
        representativeRate: 999978.2437959356,
        totalRate: 104343850.29633254,
        systemPower: 6.139252237548544,
        eeInst: 16996182.313238513,
      },
      expectedEvaluation: {
        evaluationBitsPerJ: 10106075.046823049,
        deliveredBits: 652062698599.6354,
        consumedEnergyJ: 64521.853991636264,
        durationS: 7200,
        sampleCount: 240,
        aggregation: 'ratio-of-sums',
      },
    },
    angleResponse: {
      fixtureId: 'angle-response-v1',
      anchorIndex: 47,
      referenceAnalysisRunId: 'analysis-run-03ef0a2a',
      probeAnalysisRunId: 'analysis-run-811f283d',
      referenceFrameId: 'analysis-ee7fbeeb',
      probeFrameId: 'analysis-613fa1bf',
      referenceParameterDigest: 'sha256:59c3048c229803d5783f67dfd5380dbb6fb588ad1746f806abeea473400d2953',
      probeParameterDigest: 'sha256:e87c0b75c20db25be040113c2484cc748ab1f7c13ccf20291a6bb09902dd8b29',
      identity: { satelliteId: '55796', beamId: 1, userIndex: 29, userId: 'ue-30' },
      control: {
        parameterKey: 'theta3dbRad',
        unit: 'rad',
        referenceValue: 0.05794493116621174,
        probeValue: 0.06981317007977318,
      },
      capToleranceW: null,
      eeEvalPolicy: 'exclude-frame-scoped',
      expectedReferenceTerms: {
        theta: 0.011240719179150774,
        transmitGain: 1807.121891561789,
        rawH: 5.666452889890504e-12,
        hDiv: 5.666452889890504e-12,
        gammaReq: 0.06437018245335979,
        pReqUser: 0.0063335756717664456,
        actualBeamRf: 0.0063335756717664456,
        sinr: 0.0643687378670359,
        representativeRate: 999978.2437959356,
        totalRate: 104343850.29633254,
        systemPower: 6.139252237548544,
        eeInst: 16996182.313238513,
      },
      expectedProbeTerms: {
        theta: 0.011240719179150774,
        transmitGain: 1865.2235869334672,
        rawH: 5.848637899758239e-12,
        hDiv: 5.848637899758239e-12,
        gammaReq: 0.06437018245335979,
        pReqUser: 0.006136284855334381,
        actualBeamRf: 0.006136284855334381,
        sinr: 0.06436853364858752,
        representativeRate: 999975.1681599532,
        totalRate: 102105993.40342464,
        systemPower: 6.083946197243504,
        eeInst: 16782856.076157693,
      },
    },
    serviceTargetStress: {
      fixtureId: 'service-target-stress-v1',
      anchorIndex: 0,
      referenceAnalysisRunId: 'analysis-run-03ef0a2a',
      probeAnalysisRunId: 'analysis-run-7c50d6c0',
      referenceFrameId: 'analysis-baff6517',
      probeFrameId: 'analysis-4945e173',
      referenceParameterDigest: 'sha256:59c3048c229803d5783f67dfd5380dbb6fb588ad1746f806abeea473400d2953',
      probeParameterDigest: 'sha256:664622f18085e48bd64c23658c23e39fd8efb993c58e2fbdfa31b1412e451d8b',
      identity: { satelliteId: '49283', beamId: 0, userIndex: 14, userId: 'ue-15' },
      control: {
        parameterKey: 'minimumRateBps',
        unit: 'bit/s',
        referenceValue: 1_000_000,
        probeValue: 10_000_000,
      },
      capToleranceW: 1e-9,
      eeEvalPolicy: 'include-only-if-full-sequence-equal',
      expectedReferenceTerms: {
        theta: 0.00923307049223942,
        transmitGain: 1867.9329455558454,
        rawH: 4.342470907839322e-12,
        hDiv: 4.342470907839322e-12,
        gammaReq: 0.06437018245335979,
        pReqUser: 0.008264628348766156,
        actualBeamRf: 0.008264628348766156,
        sinr: 0.06100996275370267,
        representativeRate: 949313.367179494,
        totalRate: 102540809.3332609,
        systemPower: 6.603336434654891,
        eeInst: 15528636.220186766,
      },
      expectedProbeTerms: {
        theta: 0.00923307049223942,
        transmitGain: 1867.9329455558454,
        rawH: 4.342470907839322e-12,
        hDiv: 4.342470907839322e-12,
        gammaReq: 0.8660659830736148,
        pReqUser: 0.11119610358100875,
        actualBeamRf: 0.11119610358100875,
        sinr: 0.5018368078131729,
        representativeRate: 6519200.618096798,
        totalRate: 916747032.0867406,
        systemPower: 17.266420169959165,
        eeInst: 53094215.42293609,
      },
    },
    servingChange: {
      fixtureId: 'serving-change-v1',
      analysisRunId: 'analysis-run-03ef0a2a',
      traceDigest: 'tle-trace-v1-ffb9b40e',
      eventId: 'tle-event-v1-e9303f64',
      sourceEvent: 'forced-continuity',
      beforeAnchorIndex: 21,
      decisionAnchorIndex: 22,
      afterAnchorIndex: 23,
      beforeFrameId: 'analysis-919d3246',
      decisionFrameId: 'analysis-bda9b14d',
      afterFrameId: 'analysis-af29ef65',
    },
  },
  negativeFixtureIds: ['target-reset-no-event-v1', 'failed-rebuild-v1'],
  secondarySource: {
    fixtureId: 'constellation-switch-starlink-v1',
    constellation: 'starlink',
    archiveId: 'starlink-20250727-20260812-20a059bc3e83',
    archiveContentSha256: '20a059bc3e8358e955728ce7c29948ff472ca9143f27e0f314ac0e50d40b3a81',
    archiveDate: '20260807',
    snapshotPath: '/tle-archive/starlink/starlink_20260807.tle',
    selectedTleSha256: '89e9f26999395fb549c9706deb73ad8ce83f57a92f17299073186b40c956ba40',
    requestedInstantUtc: '2026-08-07T23:59:59.000Z',
    selectedSatelliteId: '64385',
    selectedTleEpochUtc: '2026-08-06T22:43:02.525Z',
    tleFrameId: 'tle-sgp4-f72a575c',
    singleFrameId: 'analysis-9fe6ddad',
    geometryRunId: 'tle-run:starlink-20250727-20260812-20a059bc3e83:89e9f26999395fb549c9706deb73ad8ce83f57a92f17299073186b40c956ba40:2026-08-07T23%3A59%3A59.000Z:7200:30:9b089349',
    analysisRunId: 'analysis-run-c2163cd8',
    satelliteCount: 10760,
    passCount: 3510,
    unavailableAnchorCount: 0,
    claimBoundary: 'constellation-switch-only-not-performance-comparison',
  },
} as const satisfies ScientificFixtureManifest);

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

const SHA256 = /^[0-9a-f]{64}$/;
const PREFIXED_SHA256 = /^sha256:[0-9a-f]{64}$/;
const ARCHIVE_DATE = /^\d{8}$/;
const PARAMETER_KEYS = Object.freeze(Object.keys(DEFAULT_SIMULATOR_PARAMETERS));
const METHOD_TERM_KEYS = Object.freeze([
  'theta', 'transmitGain', 'rawH', 'hDiv', 'gammaReq', 'pReqUser', 'pReqBeam',
  'actualBeamRf', 'sinr', 'representativeRate', 'totalRate', 'systemPower', 'eeInst',
]);
const PROBE_TERM_KEYS = Object.freeze([
  'theta', 'transmitGain', 'rawH', 'hDiv', 'gammaReq', 'pReqUser', 'actualBeamRf',
  'sinr', 'representativeRate', 'totalRate', 'systemPower', 'eeInst',
]);

function validateExactKeys(value: Record<string, unknown>, allowedKeys: readonly string[], label: string): void {
  const actual = Object.keys(value).sort();
  const allowed = [...allowedKeys].sort();
  if (JSON.stringify(actual) !== JSON.stringify(allowed)) {
    throw new Error(`${label} contains unknown or missing fields`);
  }
}

function nonEmpty(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.trim() === '') throw new Error(`${label} must be a non-empty string`);
  return value;
}

function finite(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`${label} must be finite`);
  return value;
}

function nonNegativeInteger(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative integer`);
  }
  return value;
}

function runAnchorIndex(value: unknown, label: string): number {
  const anchor = nonNegativeInteger(value, label);
  if (anchor >= TLE_RUN_ANCHOR_COUNT) {
    throw new Error(`${label} must be within the accepted run`);
  }
  return anchor;
}

function validateIdentity(value: unknown, label: string): void {
  const identity = record(value);
  if (identity === null) throw new Error(`${label} identity is missing`);
  validateExactKeys(identity, ['satelliteId', 'beamId', 'userIndex', 'userId'], `${label}.identity`);
  nonEmpty(identity.satelliteId, `${label}.satelliteId`);
  const beamId = nonNegativeInteger(identity.beamId, `${label}.beamId`);
  const userIndex = nonNegativeInteger(identity.userIndex, `${label}.userIndex`);
  const userId = nonEmpty(identity.userId, `${label}.userId`);
  if (userId !== `ue-${userIndex + 1}` || beamId > 6) throw new Error(`${label} identity is inconsistent`);
}

function validateExactFiniteMap(value: unknown, requiredKeys: readonly string[], label: string): void {
  const candidate = record(value);
  if (candidate === null) throw new Error(`${label} must be an object`);
  const keys = Object.keys(candidate).sort();
  const required = [...requiredKeys].sort();
  if (JSON.stringify(keys) !== JSON.stringify(required)) throw new Error(`${label} must contain the complete accepted term set`);
  for (const key of requiredKeys) finite(candidate[key], `${label}.${key}`);
}

function validateReferenceParameters(value: unknown): void {
  const parameters = record(value);
  if (parameters === null) throw new Error('reference parameter set is missing');
  if (JSON.stringify(Object.keys(parameters).sort()) !== JSON.stringify([...PARAMETER_KEYS].sort())) {
    throw new Error('reference parameter set does not contain the complete canonical parameter set');
  }
  for (const key of PARAMETER_KEYS) finite(parameters[key], `referenceParameters.${key}`);
}

function validateSource(source: Record<string, unknown> | null): void {
  if (source === null || source.constellation !== 'oneweb') throw new Error('main source fixture is incomplete');
  validateExactKeys(source, [
    'constellation', 'archiveId', 'archiveContentSha256', 'archiveDate', 'snapshotPath',
    'selectedTleSha256', 'requestedInstantUtc', 'sourceKind', 'propagationModel', 'geometryRunId',
  ], 'source');
  nonEmpty(source.archiveId, 'source.archiveId');
  if (typeof source.archiveContentSha256 !== 'string' || !SHA256.test(source.archiveContentSha256)) {
    throw new Error('source.archiveContentSha256 is invalid');
  }
  if (typeof source.archiveDate !== 'string' || !ARCHIVE_DATE.test(source.archiveDate)) throw new Error('source.archiveDate is invalid');
  nonEmpty(source.snapshotPath, 'source.snapshotPath');
  if (typeof source.selectedTleSha256 !== 'string' || !SHA256.test(source.selectedTleSha256)) {
    throw new Error('source.selectedTleSha256 is invalid');
  }
  if (typeof source.requestedInstantUtc !== 'string' || !Number.isFinite(Date.parse(source.requestedInstantUtc))) {
    throw new Error('source.requestedInstantUtc is invalid');
  }
  if (source.sourceKind !== 'ARCHIVED_TLE' || source.propagationModel !== 'SGP4') {
    throw new Error('source model identity is invalid');
  }
  nonEmpty(source.geometryRunId, 'source.geometryRunId');
}

function validateMethod(method: Record<string, unknown>): void {
  validateExactKeys(method, [
    'fixtureId', 'anchorIndex', 'analysisRunId', 'frameId', 'identity',
    'expectedTerms', 'expectedEvaluation',
  ], 'method-state-v1');
  runAnchorIndex(method.anchorIndex, 'method-state-v1.anchorIndex');
  nonEmpty(method.analysisRunId, 'method-state-v1.analysisRunId');
  nonEmpty(method.frameId, 'method-state-v1.frameId');
  validateIdentity(method.identity, 'method-state-v1');
  validateExactFiniteMap(method.expectedTerms, METHOD_TERM_KEYS, 'method-state-v1.expectedTerms');
  const evaluation = record(method.expectedEvaluation);
  if (evaluation === null) throw new Error('method-state-v1 expected evaluation is missing');
  validateExactKeys(evaluation, [
    'evaluationBitsPerJ', 'deliveredBits', 'consumedEnergyJ', 'durationS', 'sampleCount', 'aggregation',
  ], 'method-state-v1.expectedEvaluation');
  finite(evaluation.evaluationBitsPerJ, 'method-state-v1.evaluationBitsPerJ');
  finite(evaluation.deliveredBits, 'method-state-v1.deliveredBits');
  finite(evaluation.consumedEnergyJ, 'method-state-v1.consumedEnergyJ');
  if (evaluation.durationS !== 7200 || evaluation.sampleCount !== 240 || evaluation.aggregation !== 'ratio-of-sums') {
    throw new Error('method-state-v1 evaluation interval is invalid');
  }
}

function validateProbe(fixture: Record<string, unknown>, fixtureId: string): void {
  validateExactKeys(fixture, [
    'fixtureId', 'anchorIndex', 'referenceAnalysisRunId', 'probeAnalysisRunId',
    'referenceFrameId', 'probeFrameId', 'referenceParameterDigest', 'probeParameterDigest',
    'identity', 'control', 'capToleranceW', 'eeEvalPolicy',
    'expectedReferenceTerms', 'expectedProbeTerms',
  ], fixtureId);
  runAnchorIndex(fixture.anchorIndex, `${fixtureId}.anchorIndex`);
  for (const key of ['referenceAnalysisRunId', 'probeAnalysisRunId', 'referenceFrameId', 'probeFrameId'] as const) {
    nonEmpty(fixture[key], `${fixtureId}.${key}`);
  }
  for (const key of ['referenceParameterDigest', 'probeParameterDigest'] as const) {
    if (typeof fixture[key] !== 'string' || !PREFIXED_SHA256.test(fixture[key])) throw new Error(`${fixtureId}.${key} is invalid`);
  }
  validateIdentity(fixture.identity, fixtureId);
  const control = record(fixture.control);
  if (control === null
    || typeof control.parameterKey !== 'string'
    || !PARAMETER_KEYS.includes(control.parameterKey)
      || typeof control.unit !== 'string'
      || control.unit.length === 0) throw new Error(`${fixtureId} control is invalid`);
  validateExactKeys(control, ['parameterKey', 'unit', 'referenceValue', 'probeValue'], `${fixtureId}.control`);
  finite(control.referenceValue, `${fixtureId}.control.referenceValue`);
  finite(control.probeValue, `${fixtureId}.control.probeValue`);
  if (control.referenceValue === control.probeValue) throw new Error(`${fixtureId} control must change exactly one value`);
  if (fixtureId === 'angle-response-v1'
    && (control.parameterKey !== 'theta3dbRad' || control.unit !== 'rad' || fixture.eeEvalPolicy !== 'exclude-frame-scoped')) {
    throw new Error('angle-response-v1 control contract is invalid');
  }
  if (fixtureId === 'service-target-stress-v1'
    && (control.parameterKey !== 'minimumRateBps'
      || control.unit !== 'bit/s'
      || control.referenceValue !== 1_000_000
      || control.probeValue !== 10_000_000
      || fixture.eeEvalPolicy !== 'include-only-if-full-sequence-equal')) {
    throw new Error('service-target-stress-v1 control contract is invalid');
  }
  if (fixture.capToleranceW !== null && !(finite(fixture.capToleranceW, `${fixtureId}.capToleranceW`) > 0)) {
    throw new Error(`${fixtureId}.capToleranceW must be null or positive`);
  }
  validateExactFiniteMap(fixture.expectedReferenceTerms, PROBE_TERM_KEYS, `${fixtureId}.expectedReferenceTerms`);
  validateExactFiniteMap(fixture.expectedProbeTerms, PROBE_TERM_KEYS, `${fixtureId}.expectedProbeTerms`);
}

function validateServingChange(fixture: Record<string, unknown>): void {
  validateExactKeys(fixture, [
    'fixtureId', 'analysisRunId', 'traceDigest', 'eventId', 'sourceEvent',
    'beforeAnchorIndex', 'decisionAnchorIndex', 'afterAnchorIndex',
    'beforeFrameId', 'decisionFrameId', 'afterFrameId',
  ], 'serving-change-v1');
  for (const key of ['analysisRunId', 'traceDigest', 'eventId', 'beforeFrameId', 'decisionFrameId', 'afterFrameId'] as const) {
    nonEmpty(fixture[key], `serving-change-v1.${key}`);
  }
  if (fixture.sourceEvent !== 'forced-continuity' && fixture.sourceEvent !== 'inter-handover') {
    throw new Error('serving-change-v1.sourceEvent is invalid');
  }
  const before = runAnchorIndex(fixture.beforeAnchorIndex, 'serving-change-v1.beforeAnchorIndex');
  const decision = runAnchorIndex(fixture.decisionAnchorIndex, 'serving-change-v1.decisionAnchorIndex');
  const after = runAnchorIndex(fixture.afterAnchorIndex, 'serving-change-v1.afterAnchorIndex');
  if (decision !== before + 1 || after !== decision + 1) throw new Error('serving-change-v1 anchors must be adjacent');
}

function validateSecondarySource(value: unknown): void {
  const source = record(value);
  if (source === null
    || source.fixtureId !== 'constellation-switch-starlink-v1'
    || source.claimBoundary !== 'constellation-switch-only-not-performance-comparison'
    || source.constellation !== 'starlink') throw new Error('secondary constellation-switch fixture is missing or overclaims');
  validateExactKeys(source, [
    'fixtureId', 'constellation', 'archiveId', 'archiveContentSha256', 'archiveDate', 'snapshotPath',
    'selectedTleSha256', 'requestedInstantUtc', 'selectedSatelliteId', 'selectedTleEpochUtc',
    'tleFrameId', 'singleFrameId', 'geometryRunId', 'analysisRunId', 'satelliteCount',
    'passCount', 'unavailableAnchorCount', 'claimBoundary',
  ], 'secondarySource');
  for (const key of ['archiveId', 'snapshotPath', 'requestedInstantUtc', 'selectedSatelliteId', 'selectedTleEpochUtc', 'tleFrameId', 'singleFrameId', 'geometryRunId', 'analysisRunId'] as const) {
    nonEmpty(source[key], `secondarySource.${key}`);
  }
  if (typeof source.archiveContentSha256 !== 'string' || !SHA256.test(source.archiveContentSha256)
    || typeof source.selectedTleSha256 !== 'string' || !SHA256.test(source.selectedTleSha256)
    || typeof source.archiveDate !== 'string' || !ARCHIVE_DATE.test(source.archiveDate)) {
    throw new Error('secondary source digest or date is invalid');
  }
  if (!Number.isFinite(Date.parse(source.requestedInstantUtc as string))
    || !Number.isFinite(Date.parse(source.selectedTleEpochUtc as string))) throw new Error('secondary source time is invalid');
  if (!(nonNegativeInteger(source.satelliteCount, 'secondarySource.satelliteCount') > 0)
    || !(nonNegativeInteger(source.passCount, 'secondarySource.passCount') > 0)
    || source.unavailableAnchorCount !== 0) throw new Error('secondary source run evidence is incomplete');
}

export function parseScientificFixtureManifest(raw: unknown): ScientificFixtureManifest {
  const root = record(raw);
  if (root === null || root.schemaVersion !== 'scientific-fixture-manifest-v1') {
    throw new Error('invalid scientific fixture manifest schema');
  }
  validateExactKeys(root, [
    'schemaVersion', 'status', 'acceptedBy', 'acceptedAtUtc', 'source', 'referenceParameters',
    'fixtures', 'negativeFixtureIds', 'secondarySource',
  ], 'scientific fixture manifest');
  if (root.status !== 'ACCEPTED') throw new Error('fixture manifest must be accepted before S2 publication');
  if (typeof root.acceptedBy !== 'string' || root.acceptedBy.length === 0) {
    throw new Error('fixture manifest acceptedBy is required');
  }
  if (typeof root.acceptedAtUtc !== 'string' || !Number.isFinite(Date.parse(root.acceptedAtUtc))) {
    throw new Error('fixture manifest acceptedAtUtc is invalid');
  }
  const fixtures = record(root.fixtures);
  if (fixtures === null) throw new Error('scientific fixture set is missing');
  validateExactKeys(fixtures, ['method', 'angleResponse', 'serviceTargetStress', 'servingChange'], 'fixtures');
  const required = [
    ['method', 'method-state-v1'],
    ['angleResponse', 'angle-response-v1'],
    ['serviceTargetStress', 'service-target-stress-v1'],
    ['servingChange', 'serving-change-v1'],
  ] as const;
  for (const [key, fixtureId] of required) {
    const fixture = record(fixtures?.[key]);
    if (fixture?.fixtureId !== fixtureId) throw new Error(`required fixture ${fixtureId} is missing`);
  }
  validateSource(record(root.source));
  validateReferenceParameters(root.referenceParameters);
  const method = record(fixtures?.method)!;
  validateMethod(method);
  for (const key of ['angleResponse', 'serviceTargetStress'] as const) {
    const fixture = record(fixtures?.[key])!;
    validateProbe(fixture, fixture.fixtureId as string);
  }
  validateServingChange(record(fixtures?.servingChange)!);
  const negativeIds = root.negativeFixtureIds;
  if (!Array.isArray(negativeIds)
    || negativeIds.length !== 2
    || negativeIds[0] !== 'target-reset-no-event-v1'
    || negativeIds[1] !== 'failed-rebuild-v1') {
    throw new Error('required negative fixtures are missing');
  }
  validateSecondarySource(root.secondarySource);
  return deepFreeze(raw as ScientificFixtureManifest);
}
