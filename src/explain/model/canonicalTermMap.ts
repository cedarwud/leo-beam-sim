import { selectCanonicalHDiagnostics } from '../../analysis/canonicalEe/producer';
import type {
  CanonicalTermContext,
  CanonicalTermDelta,
  CanonicalTermDefinition,
  CanonicalCausalEdgeDefinition,
  CanonicalTermKey,
  CanonicalTermValue,
  CausalProbeEvidence,
  ExplanatoryEvidence,
} from './types';

type AvailableTermValue = Extract<CanonicalTermValue, { readonly status: 'available' }>;

export interface CanonicalFrameTermContext {
  readonly frame: Pick<
    CanonicalTermContext['frame'],
    'selectedSatelliteId' | 'inputs' | 'scenario' | 'canonical' | 'parameters'
  >;
  readonly identity: CanonicalTermContext['identity'];
  readonly evaluationBitsPerJ?: number;
}

function available(unit: string, value: number): CanonicalTermValue {
  if (!Number.isFinite(value)) return { status: 'unavailable', unit, reason: 'canonical term is non-finite' };
  return Object.freeze({ status: 'available', unit, value });
}

function unavailable(unit: string, reason: string): CanonicalTermValue {
  return Object.freeze({ status: 'unavailable', unit, reason });
}

function indices(context: CanonicalTermContext): {
  readonly u: number;
  readonly b: number;
  readonly frame: CanonicalTermContext['frame'];
} | null {
  const { frame: suppliedFrame, identity } = context;
  if (!Number.isInteger(identity.userIndex) || identity.userIndex < 0
    || identity.userId !== `ue-${identity.userIndex + 1}`) return null;
  if (suppliedFrame.runAnchor === undefined
    || suppliedFrame.runAnchor.runId !== context.run.analysisRunId
    || suppliedFrame.runAnchor.geometryRunId !== context.run.geometryRunId
    || context.run.geometryRunId !== context.run.geometryRun.runId) return null;
  const { anchorIndex } = suppliedFrame.runAnchor;
  if (!Number.isInteger(anchorIndex) || anchorIndex < 0 || anchorIndex >= context.run.anchorCount
    || suppliedFrame.runAnchor.anchorCount !== context.run.anchorCount
    || suppliedFrame.runAnchor.elapsedSec !== anchorIndex * context.run.stepS
    || suppliedFrame.runAnchor.durationSec !== context.run.durationS
    || suppliedFrame.runAnchor.stepSec !== context.run.stepS
    || suppliedFrame.instantUtc !== context.run.geometryRun.getAnchorUtc(anchorIndex)) return null;
  const canonicalFrame = context.run.getFrame(anchorIndex);
  if (canonicalFrame === null || canonicalFrame.runAnchor === undefined
    || canonicalFrame.frameId !== suppliedFrame.frameId
    || canonicalFrame.instantUtc !== suppliedFrame.instantUtc
    || canonicalFrame.tleFrameId !== suppliedFrame.tleFrameId
    || canonicalFrame.selectedSatelliteId !== suppliedFrame.selectedSatelliteId
    || canonicalFrame.runAnchor.passPolicyRevision !== suppliedFrame.runAnchor.passPolicyRevision
    || canonicalFrame.runAnchor.servingPassId !== suppliedFrame.runAnchor.servingPassId
    || canonicalFrame.runAnchor.candidatePassId !== suppliedFrame.runAnchor.candidatePassId) return null;
  if (canonicalFrame.selectedSatelliteId !== identity.satelliteId) return null;
  if (canonicalFrame.inputs.frame.servingBeamU[identity.userIndex] !== identity.beamId) return null;
  return { u: identity.userIndex, b: identity.beamId, frame: canonicalFrame };
}

function frameIndices(context: CanonicalFrameTermContext): {
  readonly u: number;
  readonly b: number;
  readonly frame: CanonicalFrameTermContext['frame'];
} | null {
  const { frame, identity } = context;
  if (!Number.isInteger(identity.userIndex) || identity.userIndex < 0
    || identity.userId !== `ue-${identity.userIndex + 1}`
    || frame.selectedSatelliteId !== identity.satelliteId
    || frame.inputs.frame.servingBeamU[identity.userIndex] !== identity.beamId
    || frame.inputs.frame.beamActiveB[identity.beamId] !== true) return null;
  return { u: identity.userIndex, b: identity.beamId, frame };
}

export const CANONICAL_TERM_KEYS: readonly CanonicalTermKey[] = Object.freeze([
  'theta', 'transmitGain', 'receiveGain', 'largeScaleGain', 'ricianGain', 'rawH', 'hDiv',
  'minimumRate', 'beamLoad', 'beamBandwidth', 'gammaReq', 'laggedInterference', 'pReqUser', 'pReqBeam',
  'beamPowerCap', 'satellitePowerCap', 'preSatelliteCapPower', 'actualBeamRf', 'signal',
  'intraSatelliteInterference', 'interSatelliteInterference', 'interference', 'noise',
  'sinr', 'representativeRate', 'totalRate', 'paEfficiency', 'paPower', 'rfcPower',
  'basebandPower', 'eventPower', 'systemPower', 'eeInst', 'eeEval', 'p0',
]);

export function selectCanonicalTermValue(
  term: CanonicalTermKey,
  context: CanonicalTermContext,
): CanonicalTermValue {
  const selected = indices(context);
  if (selected === null) return unavailable('unknown', 'representative link identity does not match the frame');
  return selectCanonicalFrameTermValue(term, {
    frame: selected.frame,
    identity: context.identity,
    evaluationBitsPerJ: context.run.evaluation.evaluationBitsPerJ,
  });
}

/**
 * Read one canonical term from an already-built immutable frame.
 *
 * Unlike `selectCanonicalTermValue`, this seam does not claim that the frame
 * belongs to an accepted two-hour run.  It is used by bounded Explore
 * experiments that preserve the accepted TLE instant while rebuilding the
 * local seven-cell canonical frame.  Identity, serving-beam ownership, and
 * every value still come from the supplied immutable frame.
 */
export function selectCanonicalFrameTermValue(
  term: CanonicalTermKey,
  context: CanonicalFrameTermContext,
): CanonicalTermValue {
  const selected = frameIndices(context);
  if (selected === null) return unavailable('unknown', 'representative link identity does not match the frame');
  const { u, b, frame } = selected;
  const channel = frame.scenario.channelTermsUb[u]?.[b];
  switch (term) {
    case 'theta': return available('rad', frame.inputs.frame.thetaRadUb[u]?.[b] ?? Number.NaN);
    case 'transmitGain': return available('linear', frame.canonical.transmitGainUb[u]?.[b] ?? Number.NaN);
    case 'receiveGain': return available('linear', frame.inputs.frame.receiveGainUb[u]?.[b] ?? Number.NaN);
    case 'largeScaleGain': return available('linear', channel?.largeScaleGain ?? Number.NaN);
    case 'ricianGain': return available('linear', channel?.ricianGain ?? Number.NaN);
    case 'rawH': return available('linear', selectCanonicalHDiagnostics(frame.canonical, u, b).rawH);
    case 'hDiv': return available('linear', selectCanonicalHDiagnostics(frame.canonical, u, b).hDiv);
    case 'minimumRate': return available('bit/s', frame.parameters.minimumRateBps);
    case 'beamLoad': return available('users', frame.inputs.frame.beamLoadB[b] ?? Number.NaN);
    case 'beamBandwidth': return available('Hz', frame.inputs.config.beamBandwidthHz);
    case 'gammaReq': return available('linear', frame.canonical.gammaReqB[b] ?? Number.NaN);
    case 'laggedInterference': return available('W', frame.inputs.frame.laggedInterferenceUW[u] ?? Number.NaN);
    case 'pReqUser': return available('W', frame.canonical.power.pReqUW[u] ?? Number.NaN);
    case 'pReqBeam': return available('W', frame.canonical.power.pReqBW[b] ?? Number.NaN);
    case 'beamPowerCap': return available('W', frame.parameters.beamPowerCapW);
    case 'satellitePowerCap': return available('W', frame.parameters.satellitePowerCapW);
    case 'preSatelliteCapPower': return available('W', frame.canonical.power.pDlBeforeSatelliteCapBW[b] ?? Number.NaN);
    case 'actualBeamRf': return available('W', frame.canonical.power.pDlActualBW[b] ?? Number.NaN);
    case 'signal': return available('W', frame.canonical.throughput.signalUW[u] ?? Number.NaN);
    case 'intraSatelliteInterference': return available('W', frame.canonical.throughput.intraSatelliteInterferenceUW[u] ?? Number.NaN);
    case 'interSatelliteInterference': return available('W', frame.canonical.throughput.interSatelliteInterferenceUW[u] ?? Number.NaN);
    case 'interference': return available('W', frame.canonical.throughput.interferenceUW[u] ?? Number.NaN);
    case 'noise': return available('W', frame.inputs.config.noisePowerW);
    case 'sinr': return available('linear', frame.canonical.throughput.sinrU[u] ?? Number.NaN);
    case 'representativeRate': return available('bit/s', frame.canonical.throughput.rateUBps[u] ?? Number.NaN);
    case 'totalRate': return available('bit/s', frame.canonical.throughput.totalRateBps);
    case 'paEfficiency': return available('linear', frame.canonical.power.paEfficiencyB[b] ?? Number.NaN);
    case 'paPower': return available('W', frame.canonical.power.pPaBW[b] ?? Number.NaN);
    case 'rfcPower': return available('W', frame.canonical.power.pRfcBW[b] ?? Number.NaN);
    case 'basebandPower': return available('W', frame.canonical.power.pBbBW[b] ?? Number.NaN);
    case 'eventPower': return available('W', frame.canonical.power.pEventBW[b] ?? Number.NaN);
    case 'systemPower': return available('W', frame.canonical.power.systemPowerW);
    case 'eeInst': return available('bit/J', frame.canonical.ee.systemEeBitsPerJ);
    case 'eeEval': return context.evaluationBitsPerJ === undefined
      ? unavailable('bit/J', 'interval evaluation is outside this instantaneous Explore frame')
      : available('bit/J', context.evaluationBitsPerJ);
    case 'p0': return unavailable('W', 'P_0 has no canonical numeric diagnostic seam');
  }
}

interface TermMetadata {
  readonly thesisSymbol: string;
  readonly label: string;
  readonly unit: string;
  readonly target: 'link' | 'beam' | 'system';
  readonly dependencies: readonly CanonicalTermKey[];
}

const TERM_METADATA: Readonly<Record<CanonicalTermKey, TermMetadata>> = Object.freeze({
  theta: { thesisSymbol: '\\theta_{u,s,v}', label: '偏軸角', unit: 'rad', target: 'link', dependencies: [] },
  transmitGain: { thesisSymbol: 'G^T', label: '發射天線增益', unit: 'linear', target: 'link', dependencies: ['theta'] },
  receiveGain: { thesisSymbol: 'G^R_{u,s,v}', label: '接收天線增益', unit: 'linear', target: 'link', dependencies: [] },
  largeScaleGain: { thesisSymbol: 'G^{LS}_{u,s,v}', label: '大尺度通道增益', unit: 'linear', target: 'link', dependencies: [] },
  ricianGain: { thesisSymbol: 'g_{u,s,v}', label: 'Rician 小尺度增益', unit: 'linear', target: 'link', dependencies: [] },
  rawH: { thesisSymbol: 'H_{u,s,v}G^T', label: '原始通道功率增益', unit: 'linear', target: 'link', dependencies: ['transmitGain', 'receiveGain', 'largeScaleGain', 'ricianGain'] },
  hDiv: { thesisSymbol: 'h^{div}_{u,s,v}', label: '除法用通道增益', unit: 'linear', target: 'link', dependencies: ['rawH'] },
  minimumRate: { thesisSymbol: 'R_{\\min}', label: '每位使用者最低傳輸速率目標', unit: 'bit/s', target: 'system', dependencies: [] },
  beamLoad: { thesisSymbol: 'U_{s,v}', label: '波束服務使用者數', unit: 'users', target: 'beam', dependencies: [] },
  beamBandwidth: { thesisSymbol: 'B^w', label: '每波束頻寬', unit: 'Hz', target: 'beam', dependencies: [] },
  gammaReq: { thesisSymbol: '\\gamma_{\\mathrm{req}}', label: '需求 SINR', unit: 'linear', target: 'beam', dependencies: ['minimumRate', 'beamLoad', 'beamBandwidth'] },
  laggedInterference: { thesisSymbol: '\\widehat{I}_{u,s,v}', label: '前一狀態干擾估計', unit: 'W', target: 'link', dependencies: [] },
  pReqUser: { thesisSymbol: 'p^{\\mathrm{req}}_{u,s,v}', label: '使用者需求功率', unit: 'W', target: 'link', dependencies: ['gammaReq', 'hDiv', 'laggedInterference', 'noise'] },
  pReqBeam: { thesisSymbol: 'P^{\\mathrm{req}}_{s,v}', label: '波束需求功率', unit: 'W', target: 'beam', dependencies: ['pReqUser'] },
  beamPowerCap: { thesisSymbol: 'P_{\\mathrm{beam},\\max}', label: '波束功率上限', unit: 'W', target: 'beam', dependencies: [] },
  satellitePowerCap: { thesisSymbol: 'P_{\\mathrm{sat},\\max}', label: '衛星功率上限', unit: 'W', target: 'system', dependencies: [] },
  preSatelliteCapPower: { thesisSymbol: 'P^{DL}_{s,v}', label: '衛星上限前射頻需求', unit: 'W', target: 'beam', dependencies: ['pReqBeam', 'beamPowerCap'] },
  actualBeamRf: { thesisSymbol: 'P^{DL}_{s,v}', label: '實際波束射頻輸出', unit: 'W', target: 'beam', dependencies: ['preSatelliteCapPower', 'satellitePowerCap'] },
  signal: { thesisSymbol: 'S_{u,s,v}', label: '接收訊號項', unit: 'W', target: 'link', dependencies: ['actualBeamRf', 'rawH'] },
  intraSatelliteInterference: { thesisSymbol: 'I^{\\mathrm{intra}}_{u,s,v}', label: '同衛星干擾', unit: 'W', target: 'link', dependencies: ['actualBeamRf', 'rawH'] },
  interSatelliteInterference: { thesisSymbol: 'I^{\\mathrm{inter}}_{u,s,v}', label: '跨衛星干擾', unit: 'W', target: 'link', dependencies: ['actualBeamRf', 'rawH'] },
  interference: { thesisSymbol: 'I_{u,s,v}', label: '總干擾', unit: 'W', target: 'link', dependencies: ['intraSatelliteInterference', 'interSatelliteInterference'] },
  noise: { thesisSymbol: '\\sigma^2', label: '雜訊功率', unit: 'W', target: 'link', dependencies: ['beamBandwidth'] },
  sinr: { thesisSymbol: '\\gamma_{u,s,v}', label: '實現 SINR', unit: 'linear', target: 'link', dependencies: ['signal', 'interference', 'noise'] },
  representativeRate: { thesisSymbol: 'R_{u,s,v}', label: '代表鏈路傳輸速率', unit: 'bit/s', target: 'link', dependencies: ['sinr', 'beamBandwidth', 'beamLoad'] },
  totalRate: { thesisSymbol: '\\sum R_{u,s,v}', label: '系統總吞吐量', unit: 'bit/s', target: 'system', dependencies: ['representativeRate'] },
  paEfficiency: { thesisSymbol: '\\xi_{u,s,v}', label: '功率放大器效率', unit: 'linear', target: 'beam', dependencies: ['actualBeamRf', 'p0'] },
  paPower: { thesisSymbol: 'P^p_{u,s,v}', label: '功率放大器直流功率', unit: 'W', target: 'beam', dependencies: ['actualBeamRf', 'paEfficiency'] },
  rfcPower: { thesisSymbol: 'P^{\\mathrm{RFC}}_{s,v}', label: '射頻鏈功率', unit: 'W', target: 'beam', dependencies: [] },
  basebandPower: { thesisSymbol: 'P^{\\mathrm{BB}}_{s,v}', label: '基頻功率分攤', unit: 'W', target: 'beam', dependencies: [] },
  eventPower: { thesisSymbol: 'P^{\\mathrm{event}}_{s,v}', label: '事件功率', unit: 'W', target: 'beam', dependencies: [] },
  systemPower: { thesisSymbol: 'P^N', label: '模型邊界內系統功率', unit: 'W', target: 'system', dependencies: ['paPower', 'rfcPower', 'basebandPower', 'eventPower'] },
  eeInst: { thesisSymbol: 'EE_{\\mathrm{inst}}', label: '瞬時系統能效', unit: 'bit/J', target: 'system', dependencies: ['totalRate', 'systemPower'] },
  eeEval: { thesisSymbol: 'EE_{\\mathrm{eval}}', label: '區間 ratio-of-sums 能效', unit: 'bit/J', target: 'system', dependencies: ['totalRate', 'systemPower'] },
  p0: { thesisSymbol: 'P_0', label: '功率放大器飽和參考功率', unit: 'W', target: 'beam', dependencies: [] },
});

function evidenceContext(evidence: ExplanatoryEvidence): CanonicalTermContext {
  return { run: evidence.run, frame: evidence.frame, identity: evidence.representativeLink };
}

function termSceneTargets(term: CanonicalTermKey, evidence: ExplanatoryEvidence): readonly string[] {
  const identity = evidence.representativeLink;
  const target = TERM_METADATA[term].target;
  if (target === 'system') return Object.freeze([`system:${evidence.frame.frameId}`]);
  if (target === 'beam') return Object.freeze([`beam:${identity.satelliteId}:${identity.beamId}`]);
  return Object.freeze([`link:${identity.satelliteId}:${identity.beamId}:${identity.userId}`]);
}

export const CANONICAL_TERM_REGISTRY: Readonly<Record<CanonicalTermKey, CanonicalTermDefinition>> = Object.freeze(
  Object.fromEntries(CANONICAL_TERM_KEYS.map(key => {
    const metadata = TERM_METADATA[key];
    const dependents = CANONICAL_TERM_KEYS.filter(candidate => TERM_METADATA[candidate].dependencies.includes(key));
    const definition: CanonicalTermDefinition = Object.freeze({
      key,
      thesisSymbol: metadata.thesisSymbol,
      label: metadata.label,
      unit: metadata.unit,
      sourceSelector: (evidence: ExplanatoryEvidence) => selectCanonicalTermValue(key, evidenceContext(evidence)),
      sceneTargets: (evidence: ExplanatoryEvidence) => termSceneTargets(key, evidence),
      dependencies: Object.freeze([...metadata.dependencies]),
      dependents: Object.freeze(dependents),
      ...(key === 'p0'
        ? { unavailableReason: () => 'P_0 has no canonical numeric diagnostic seam' }
        : {}),
    });
    return [key, definition];
  })) as Record<CanonicalTermKey, CanonicalTermDefinition>,
);

export const CANONICAL_TERM_DEFINITIONS: readonly CanonicalTermDefinition[] = Object.freeze(
  CANONICAL_TERM_KEYS.map(key => CANONICAL_TERM_REGISTRY[key]),
);

function termForPair(pair: CausalProbeEvidence, member: 'reference' | 'probe', term: CanonicalTermKey): CanonicalTermValue {
  const evidence = pair[member];
  return selectCanonicalTermValue(term, { run: evidence.run, frame: evidence.frame, identity: pair.identity });
}

function causalEdge(
  edgeId: string,
  sourceTerm: CanonicalTermKey,
  operationOrConstraint: string,
  targetTerm: CanonicalTermKey,
  sourceLocator: string,
): CanonicalCausalEdgeDefinition {
  return Object.freeze({
    edgeId,
    sourceTerm,
    operationOrConstraint,
    targetTerm,
    sourceLocator,
    referenceSelector: (pair: CausalProbeEvidence) => termForPair(pair, 'reference', targetTerm),
    probeSelector: (pair: CausalProbeEvidence) => termForPair(pair, 'probe', targetTerm),
    unit: TERM_METADATA[targetTerm].unit,
    allowedRelationship: 'fixture-observed-no-universal-direction',
  });
}

export const CANONICAL_CAUSAL_EDGE_REGISTRY: readonly CanonicalCausalEdgeDefinition[] = Object.freeze([
  causalEdge('edge-angle-to-transmit-gain', 'theta', 'full-HPBW antenna pattern', 'transmitGain', 'ADR-003 §3.1 G^T(theta)'),
  causalEdge('edge-gains-to-raw-h', 'transmitGain', 'multiplicative channel closure', 'rawH', 'ADR-003 §3.1 canonical causal chain'),
  causalEdge('edge-raw-h-to-h-div', 'rawH', 'max(h, epsilon_h) division floor', 'hDiv', 'ADR-003 §3.1 h_div'),
  causalEdge('edge-minimum-rate-to-gamma-req', 'minimumRate', '2^(R_min U_b / B_beam) - 1', 'gammaReq', 'ADR-003 §3.1 gamma_req(U_b)'),
  causalEdge('edge-lagged-interference-to-user-request', 'laggedInterference', 'gamma_req (I_hat + sigma^2) / h_div', 'pReqUser', 'ADR-003 §3.1 p_req'),
  causalEdge('edge-gamma-to-user-request', 'gammaReq', 'gamma_req (I_hat + sigma^2) / h_div', 'pReqUser', 'ADR-003 §3.1 p_req'),
  causalEdge('edge-user-to-beam-request', 'pReqUser', 'max over served UEs', 'pReqBeam', 'ADR-003 §3.1 P_b_req'),
  causalEdge('edge-beam-request-to-pre-satellite', 'pReqBeam', 'beam power cap', 'preSatelliteCapPower', 'ADR-003 §3.1 P_b_DL'),
  causalEdge('edge-pre-satellite-to-actual-rf', 'preSatelliteCapPower', 'per-satellite proportional cap', 'actualBeamRf', 'ADR-003 §3.1 tilde P_b_DL'),
  causalEdge('edge-actual-rf-to-signal', 'actualBeamRf', 'actual RF times raw h', 'signal', 'ADR-003 §3.1 realized signal'),
  causalEdge('edge-signal-to-sinr', 'signal', 'signal / (interference + noise)', 'sinr', 'ADR-003 §3.1 realized SINR'),
  causalEdge('edge-sinr-to-rate', 'sinr', 'TDMA Shannon rate', 'representativeRate', 'ADR-003 §3.1 realized rate'),
  causalEdge('edge-rate-to-total-rate', 'representativeRate', 'sum over served UEs', 'totalRate', 'ADR-003 §3.2 sum_u R_u'),
  causalEdge('edge-actual-rf-to-pa-power', 'actualBeamRf', 'piecewise PA DC input', 'paPower', 'ADR-003 §3.1 PA domain'),
  causalEdge('edge-pa-to-system-power', 'paPower', 'PA plus RFC, BB and event terms', 'systemPower', 'ADR-003 §3.2 P_sys'),
  causalEdge('edge-throughput-to-ee-inst', 'totalRate', 'total rate / P_sys', 'eeInst', 'ADR-003 §3.2 EE_inst'),
  causalEdge('edge-system-power-to-ee-inst', 'systemPower', 'total rate / P_sys', 'eeInst', 'ADR-003 §3.2 EE_inst'),
]);

const ANGLE_DELTA_TERMS: readonly CanonicalTermKey[] = Object.freeze([
  'theta', 'transmitGain', 'rawH', 'hDiv', 'gammaReq', 'pReqUser', 'actualBeamRf',
  'sinr', 'representativeRate', 'totalRate', 'systemPower', 'eeInst',
]);
const TARGET_DELTA_TERMS: readonly CanonicalTermKey[] = Object.freeze([
  'gammaReq', 'pReqUser', 'actualBeamRf', 'sinr', 'representativeRate',
  'totalRate', 'systemPower', 'eeInst',
]);

function requireAvailable(value: CanonicalTermValue, term: CanonicalTermKey): AvailableTermValue {
  if (value.status === 'unavailable') throw new Error(`${term} is unavailable: ${value.reason}`);
  return value;
}

export function deriveCanonicalTermDeltas(pair: CausalProbeEvidence): readonly CanonicalTermDelta[] {
  const terms = pair.fixtureId === 'angle-response-v1' ? ANGLE_DELTA_TERMS : TARGET_DELTA_TERMS;
  return Object.freeze(terms.map(term => {
    const reference = requireAvailable(selectCanonicalTermValue(term, {
      run: pair.reference.run,
      frame: pair.reference.frame,
      identity: pair.identity,
    }), term);
    const probe = requireAvailable(selectCanonicalTermValue(term, {
      run: pair.probe.run,
      frame: pair.probe.frame,
      identity: pair.identity,
    }), term);
    if (reference.unit !== probe.unit) throw new Error(`${term} unit mismatch`);
    const signedDelta = probe.value - reference.value;
    return Object.freeze({
      term,
      unit: reference.unit,
      referenceValue: reference.value,
      probeValue: probe.value,
      signedDelta,
      relativeDeltaRatio: reference.value === 0 ? null : signedDelta / Math.abs(reference.value),
      direction: signedDelta > 0 ? 'increase' : signedDelta < 0 ? 'decrease' : 'unchanged',
    });
  }));
}
