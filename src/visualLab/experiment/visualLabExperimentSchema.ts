import {
  DEFAULT_SIMULATOR_PARAMETERS,
  type SimulatorParameters,
} from '../../simulator/types';

/** The two domains that own editable experiment inputs. */
export type VisualLabInputGroupKey = 'sinr' | 'power';

/** Progressive-disclosure subgroups within the two editable domains. */
export type VisualLabInputSubgroupKey =
  | 'antenna-channel'
  | 'noise-interference'
  | 'bandwidth-service-demand'
  | 'limits'
  | 'amplifier'
  | 'rf-baseband-circuitry';

/** The complete, intentionally finite formula-input inventory. */
export type VisualLabInputKey =
  | 'frequencyReuse'
  | 'antennaNoiseTemperatureK'
  | 'noiseFigureDb'
  | 'noiseReferenceTemperatureK'
  | 'g0Linear'
  | 'theta3dbRad'
  | 'carrierFrequencyGHz'
  | 'atmosphericZenithLossDb'
  | 'receiveGainDbi'
  | 'beamPowerCapW'
  | 'satellitePowerCapW'
  | 'minimumRateBps'
  | 'systemBandwidthHz'
  | 'etaMax'
  | 'backoffDb'
  | 'rfcPowerW'
  | 'basebandPerSatelliteW';

export const VISUAL_LAB_INPUT_KEYS = [
  'frequencyReuse',
  'antennaNoiseTemperatureK',
  'noiseFigureDb',
  'noiseReferenceTemperatureK',
  'g0Linear',
  'theta3dbRad',
  'carrierFrequencyGHz',
  'atmosphericZenithLossDb',
  'receiveGainDbi',
  'beamPowerCapW',
  'satellitePowerCapW',
  'minimumRateBps',
  'systemBandwidthHz',
  'etaMax',
  'backoffDb',
  'rfcPowerW',
  'basebandPerSatelliteW',
] as const satisfies readonly VisualLabInputKey[];

export type VisualLabInputValues = Pick<SimulatorParameters, VisualLabInputKey>;

/** Numeric values shown by controls, keyed by the same canonical fields. */
export type VisualLabFormValues = Readonly<Record<VisualLabInputKey, number>>;

export type VisualLabLocale = 'zh-Hant' | 'en';
export type LocalizedCopy = Readonly<Record<VisualLabLocale, string>>;
export type LocalizedSearchTerms = Readonly<Record<VisualLabLocale, readonly string[]>>;

/** Tags are finite semantic handles for causal focus and scene highlighting. */
export type VisualLabCausalTargetTag =
  | 'beam-gain'
  | 'beam-shape'
  | 'path-loss'
  | 'channel'
  | 'received-signal'
  | 'noise'
  | 'interference'
  | 'frequency-reuse'
  | 'bandwidth'
  | 'service-target'
  | 'required-power'
  | 'power-cap'
  | 'actual-downlink-power'
  | 'pa-efficiency'
  | 'rf-chain-power'
  | 'baseband-power'
  | 'system-power'
  | 'sinr'
  | 'throughput'
  | 'energy-efficiency';

export type VisualLabSceneHighlightTarget =
  | 'scene-beams'
  | 'scene-link'
  | 'scene-noise'
  | 'scene-interference'
  | 'scene-energy';

export type VisualLabInputValueKind = 'number' | 'integer';
export type VisualLabDisclosureLevel = 'primary' | 'advanced';

export interface VisualLabInputDefinition {
  readonly key: VisualLabInputKey;
  readonly group: VisualLabInputGroupKey;
  readonly subgroup: VisualLabInputSubgroupKey;
  readonly symbol: string;
  /** The unit used by the canonical SimulatorParameters value. */
  readonly canonicalUnit: string;
  /** The unit shown by an editing control. */
  readonly displayUnit: string;
  /** Alias retained for control adapters that only need the visible unit. */
  readonly unit: string;
  readonly valueKind: VisualLabInputValueKind;
  /** Bounds and step are expressed in display units. */
  readonly min: number;
  readonly max: number;
  readonly step: number;
  readonly range: Readonly<{ min: number; max: number; step: number }>;
  /** Default in canonical SimulatorParameters units. */
  readonly defaultValue: number;
  readonly defaultDisplayValue: number;
  readonly label: LocalizedCopy;
  readonly description: LocalizedCopy;
  readonly causalPath: LocalizedCopy;
  readonly provenance: LocalizedCopy;
  /** Grouped copy is convenient for search/card adapters. */
  readonly copy: Readonly<{
    readonly label: LocalizedCopy;
    readonly description: LocalizedCopy;
    readonly causalPath: LocalizedCopy;
    readonly provenance: LocalizedCopy;
  }>;
  readonly searchTerms: LocalizedSearchTerms;
  readonly causalTargetTags: readonly VisualLabCausalTargetTag[];
  /** Alias for callers that describe the same tags as causal targets. */
  readonly causalTargets: readonly VisualLabCausalTargetTag[];
  readonly sceneHighlightTargets: readonly VisualLabSceneHighlightTarget[];
  readonly toDisplayValue: (value: number) => number;
  readonly fromDisplayValue: (value: number) => number;
  readonly formatDisplayValue: (value: number) => string;
}

export interface VisualLabInputSubgroupDefinition {
  readonly key: VisualLabInputSubgroupKey;
  readonly group: VisualLabInputGroupKey;
  readonly order: number;
  readonly disclosure: VisualLabDisclosureLevel;
  readonly defaultExpanded: boolean;
  readonly label: LocalizedCopy;
  readonly description: LocalizedCopy;
  readonly copy: Readonly<{ label: LocalizedCopy; description: LocalizedCopy }>;
  readonly searchTerms: LocalizedSearchTerms;
}

export interface VisualLabInputGroupDefinition {
  readonly key: VisualLabInputGroupKey;
  readonly order: number;
  readonly label: LocalizedCopy;
  readonly description: LocalizedCopy;
  readonly copy: Readonly<{ label: LocalizedCopy; description: LocalizedCopy }>;
  readonly searchTerms: LocalizedSearchTerms;
}

/** Result concepts intentionally have no mutable input owner. */
export type VisualLabResultDomainKey = 'throughput' | 'ee';

export interface VisualLabResultDomainDefinition {
  readonly key: VisualLabResultDomainKey;
  readonly readOnly: true;
  readonly inputOwner: null;
  readonly label: LocalizedCopy;
  readonly description: LocalizedCopy;
  readonly copy: Readonly<{ label: LocalizedCopy; description: LocalizedCopy }>;
  readonly searchTerms: LocalizedSearchTerms;
}

const localized = (zhHant: string, en: string): LocalizedCopy => Object.freeze({
  'zh-Hant': zhHant,
  en,
});

const searchTerms = (
  zhHant: readonly string[],
  en: readonly string[],
): LocalizedSearchTerms => Object.freeze({
  'zh-Hant': Object.freeze([...zhHant]),
  en: Object.freeze([...en]),
});

const copyBundle = (
  label: LocalizedCopy,
  description: LocalizedCopy,
  causalPath?: LocalizedCopy,
  provenance?: LocalizedCopy,
) => Object.freeze({
  label,
  description,
  ...(causalPath === undefined ? {} : { causalPath }),
  ...(provenance === undefined ? {} : { provenance }),
});

const identity = (value: number): number => value;

const degreesToRadians = (value: number): number => value * Math.PI / 180;
const radiansToDegrees = (value: number): number => value * 180 / Math.PI;

const linearToDbi = (value: number): number => 10 * Math.log10(Math.max(value, Number.MIN_VALUE));

/**
 * Keep the inverse display conversion stable for canonical decimal values.
 * This is a unit conversion only; it does not clamp or derive a model result.
 */
const dbiToLinear = (value: number): number => Number((10 ** (value / 10)).toPrecision(15));

const fixed = (digits: number) => (value: number): string => value.toFixed(digits);

const formatCompact = (value: number): string => {
  const absolute = Math.abs(value);
  if (absolute >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(2)} G`;
  if (absolute >= 1_000_000) return `${(value / 1_000_000).toFixed(2)} M`;
  if (absolute >= 1_000) return `${(value / 1_000).toFixed(1)} k`;
  return value.toFixed(0);
};

const definition = (spec: Omit<VisualLabInputDefinition, 'copy' | 'unit' | 'range' | 'defaultDisplayValue' | 'causalTargets'>): VisualLabInputDefinition => {
  const copy = Object.freeze({
    label: spec.label,
    description: spec.description,
    causalPath: spec.causalPath,
    provenance: spec.provenance,
  });
  return Object.freeze({
    ...spec,
    unit: spec.displayUnit,
    range: Object.freeze({ min: spec.min, max: spec.max, step: spec.step }),
    defaultDisplayValue: spec.toDisplayValue(spec.defaultValue),
    copy,
    causalTargets: spec.causalTargetTags,
  });
};

/** Defaults are owned by the canonical simulator parameter registry. */
export const DEFAULT_VISUAL_LAB_INPUTS: Readonly<VisualLabInputValues> = Object.freeze({
  frequencyReuse: DEFAULT_SIMULATOR_PARAMETERS.frequencyReuse,
  antennaNoiseTemperatureK: DEFAULT_SIMULATOR_PARAMETERS.antennaNoiseTemperatureK,
  noiseFigureDb: DEFAULT_SIMULATOR_PARAMETERS.noiseFigureDb,
  noiseReferenceTemperatureK: DEFAULT_SIMULATOR_PARAMETERS.noiseReferenceTemperatureK,
  g0Linear: DEFAULT_SIMULATOR_PARAMETERS.g0Linear,
  theta3dbRad: DEFAULT_SIMULATOR_PARAMETERS.theta3dbRad,
  carrierFrequencyGHz: DEFAULT_SIMULATOR_PARAMETERS.carrierFrequencyGHz,
  atmosphericZenithLossDb: DEFAULT_SIMULATOR_PARAMETERS.atmosphericZenithLossDb,
  receiveGainDbi: DEFAULT_SIMULATOR_PARAMETERS.receiveGainDbi,
  beamPowerCapW: DEFAULT_SIMULATOR_PARAMETERS.beamPowerCapW,
  satellitePowerCapW: DEFAULT_SIMULATOR_PARAMETERS.satellitePowerCapW,
  minimumRateBps: DEFAULT_SIMULATOR_PARAMETERS.minimumRateBps,
  systemBandwidthHz: DEFAULT_SIMULATOR_PARAMETERS.systemBandwidthHz,
  etaMax: DEFAULT_SIMULATOR_PARAMETERS.etaMax,
  backoffDb: DEFAULT_SIMULATOR_PARAMETERS.backoffDb,
  rfcPowerW: DEFAULT_SIMULATOR_PARAMETERS.rfcPowerW,
  basebandPerSatelliteW: DEFAULT_SIMULATOR_PARAMETERS.basebandPerSatelliteW,
});

/** Named alias for code that treats the inventory as parameter values. */
export const DEFAULT_VISUAL_LAB_PARAMETERS = DEFAULT_VISUAL_LAB_INPUTS;

export const VISUAL_LAB_INPUT_SUBGROUPS: readonly VisualLabInputSubgroupDefinition[] = [
  {
    key: 'antenna-channel',
    group: 'sinr',
    order: 1,
    disclosure: 'primary',
    defaultExpanded: true,
    label: localized('天線與通道', 'Antenna and channel'),
    description: localized('增益、波束形狀、載波與路徑條件。', 'Gain, beam shape, carrier and path conditions.'),
    copy: copyBundle(
      localized('天線與通道', 'Antenna and channel'),
      localized('增益、波束形狀、載波與路徑條件。', 'Gain, beam shape, carrier and path conditions.'),
    ),
    searchTerms: searchTerms(['天線', '通道', '增益', '波束'], ['antenna', 'channel', 'gain', 'beam']),
  },
  {
    key: 'noise-interference',
    group: 'sinr',
    order: 2,
    disclosure: 'advanced',
    defaultExpanded: false,
    label: localized('雜訊與干擾', 'Noise and interference'),
    description: localized('σ² = B^w · N_0 與總干擾 I 的條件。', 'The σ² = B^w · N_0 and total-interference I conditions.'),
    copy: copyBundle(
      localized('雜訊與干擾', 'Noise and interference'),
      localized('熱雜訊、接收器雜訊與頻率重用。', 'Thermal noise, receiver noise and frequency reuse.'),
    ),
    searchTerms: searchTerms(['雜訊', '干擾', '頻率重用', 'I', 'B^w'], ['noise', 'interference', 'frequency reuse', 'I', 'B^w']),
  },
  {
    key: 'bandwidth-service-demand',
    group: 'sinr',
    order: 3,
    disclosure: 'primary',
    defaultExpanded: true,
    label: localized('頻寬與服務需求', 'Bandwidth and service demand'),
    description: localized('B^w 與服務負載條件。', 'B^w and serving-load conditions.'),
    copy: copyBundle(
      localized('頻寬與服務需求', 'Bandwidth and service demand'),
      localized('系統頻寬與最低服務速率目標。', 'System bandwidth and minimum service-rate target.'),
    ),
    searchTerms: searchTerms(['頻寬', '服務負載'], ['bandwidth', 'serving load']),
  },
  {
    key: 'limits',
    group: 'power',
    order: 1,
    disclosure: 'primary',
    defaultExpanded: true,
    label: localized('功率上限', 'Power limits'),
    description: localized('單波束與單衛星的 RF 功率約束。', 'RF power constraints per beam and satellite.'),
    copy: copyBundle(
      localized('功率上限', 'Power limits'),
      localized('單波束與單衛星的 RF 功率約束。', 'RF power constraints per beam and satellite.'),
    ),
    searchTerms: searchTerms(['功率上限', '單波束', '單衛星'], ['power cap', 'beam cap', 'satellite cap']),
  },
  {
    key: 'amplifier',
    group: 'power',
    order: 2,
    disclosure: 'advanced',
    defaultExpanded: false,
    label: localized('功率放大器', 'Power amplifier'),
    description: localized('PA 效率上限與輸出回退。', 'PA efficiency ceiling and output back-off.'),
    copy: copyBundle(
      localized('功率放大器', 'Power amplifier'),
      localized('PA 效率上限與輸出回退。', 'PA efficiency ceiling and output back-off.'),
    ),
    searchTerms: searchTerms(['功率放大器', 'PA 效率', '回退'], ['power amplifier', 'PA efficiency', 'back-off']),
  },
  {
    key: 'rf-baseband-circuitry',
    group: 'power',
    order: 3,
    disclosure: 'advanced',
    defaultExpanded: false,
    label: localized('RF／Baseband 電路', 'RF and baseband circuitry'),
    description: localized('固定 RF chain 與衛星 baseband 消耗。', 'Fixed RF-chain and satellite baseband consumption.'),
    copy: copyBundle(
      localized('RF／Baseband 電路', 'RF and baseband circuitry'),
      localized('固定 RF chain 與衛星 baseband 消耗。', 'Fixed RF-chain and satellite baseband consumption.'),
    ),
    searchTerms: searchTerms(['RF chain', 'Baseband', '電路功率'], ['RF chain', 'baseband', 'circuit power']),
  },
] as const;

export const VISUAL_LAB_INPUT_GROUPS: readonly VisualLabInputGroupDefinition[] = [
  {
    key: 'sinr',
    order: 1,
    label: localized('SINR', 'SINR'),
    description: localized('鏈路品質、雜訊與同頻干擾。', 'Link quality, noise and co-channel interference.'),
    copy: copyBundle(
      localized('SINR', 'SINR'),
      localized('鏈路品質、雜訊與同頻干擾。', 'Link quality, noise and co-channel interference.'),
    ),
    searchTerms: searchTerms(['SINR', '鏈路品質', '雜訊'], ['SINR', 'link quality', 'noise']),
  },
  {
    key: 'power',
    order: 2,
    label: localized('功率', 'Power'),
    description: localized('RF、PA 與電路功率。', 'RF, PA and circuit power.'),
    copy: copyBundle(
      localized('功率', 'Power'),
      localized('RF、PA 與電路功率。', 'RF, PA and circuit power.'),
    ),
    searchTerms: searchTerms(['功率', 'RF', 'PA', '電路'], ['power', 'RF', 'PA', 'circuit']),
  },
] as const;

export const VISUAL_LAB_RESULT_DOMAINS: readonly VisualLabResultDomainDefinition[] = [
  {
    key: 'throughput',
    readOnly: true,
    inputOwner: null,
    label: localized('吞吐量', 'Throughput'),
    description: localized('由同一 accepted frame 的速率結果彙總。', 'Aggregated from rate results in the same accepted frame.'),
    copy: copyBundle(
      localized('吞吐量', 'Throughput'),
      localized('由同一 accepted frame 的速率結果彙總。', 'Aggregated from rate results in the same accepted frame.'),
    ),
    searchTerms: searchTerms(['吞吐量', '速率', '資料'], ['throughput', 'rate', 'data']),
  },
  {
    key: 'ee',
    readOnly: true,
    inputOwner: null,
    label: localized('能源效率', 'Energy efficiency'),
    description: localized('由同一 accepted frame 的 delivered bits 與 consumed energy 計算。', 'Computed from delivered bits and consumed energy in the same accepted frame.'),
    copy: copyBundle(
      localized('能源效率', 'Energy efficiency'),
      localized('由同一 accepted frame 的 delivered bits 與 consumed energy 計算。', 'Computed from delivered bits and consumed energy in the same accepted frame.'),
    ),
    searchTerms: searchTerms(['能源效率', 'EE', '能量'], ['energy efficiency', 'EE', 'energy']),
  },
] as const;

/** Alias makes the read-only result boundary explicit at call sites. */
export const VISUAL_LAB_DERIVED_RESULT_DOMAINS = VISUAL_LAB_RESULT_DOMAINS;

export const VISUAL_LAB_INPUT_DEFINITIONS: readonly VisualLabInputDefinition[] = [
  definition({
    key: 'frequencyReuse',
    group: 'sinr',
    subgroup: 'noise-interference',
    symbol: 'I_{u,s,v}(t, boldtheta)',
    canonicalUnit: 'groups',
    displayUnit: 'groups',
    valueKind: 'integer',
    min: 1,
    max: 7,
    step: 1,
    defaultValue: DEFAULT_VISUAL_LAB_INPUTS.frequencyReuse,
    label: localized('頻率重用群組數', 'Frequency-reuse groups'),
    description: localized('決定每波束頻寬與同頻干擾分組。', 'Sets per-beam bandwidth and co-channel grouping.'),
    causalPath: localized('頻率重用 → I_{u,s,v}(t, boldtheta) 與 B^w → SINR／速率／EE', 'Frequency reuse → I_{u,s,v}(t, boldtheta) and B^w → SINR / rate / EE'),
    provenance: localized('canonical seven-cell scenario；群組數是正式輸入。', 'Canonical seven-cell scenario; group count is a formal input.'),
    searchTerms: searchTerms(['頻率重用', 'K_FR', '同頻干擾'], ['frequency reuse', 'K_FR', 'co-channel interference']),
    causalTargetTags: ['frequency-reuse', 'bandwidth', 'interference', 'sinr', 'throughput', 'energy-efficiency'],
    sceneHighlightTargets: ['scene-beams', 'scene-interference', 'scene-link'],
    toDisplayValue: identity,
    fromDisplayValue: identity,
    formatDisplayValue: fixed(0),
  }),
  definition({
    key: 'antennaNoiseTemperatureK',
    group: 'sinr',
    subgroup: 'noise-interference',
    symbol: '',
    canonicalUnit: 'K',
    displayUnit: 'K',
    valueKind: 'number',
    min: 1,
    max: 2_000,
    step: 1,
    defaultValue: DEFAULT_VISUAL_LAB_INPUTS.antennaNoiseTemperatureK,
    label: localized('天線雜訊溫度', 'Antenna noise temperature'),
    description: localized('天線端的熱雜訊溫度。', 'Thermal noise temperature at the antenna.'),
    causalPath: localized('已收合於 σ² = B^w · N_0', 'Included in σ² = B^w · N_0'),
    provenance: localized('canonical physical-noise construction。', 'Canonical physical-noise construction.'),
    searchTerms: searchTerms(['天線雜訊溫度', 'T_ant', '熱雜訊'], ['antenna noise temperature', 'T_ant', 'thermal noise']),
    causalTargetTags: ['noise', 'sinr', 'throughput', 'energy-efficiency'],
    sceneHighlightTargets: ['scene-noise', 'scene-link'],
    toDisplayValue: identity,
    fromDisplayValue: identity,
    formatDisplayValue: fixed(0),
  }),
  definition({
    key: 'noiseFigureDb',
    group: 'sinr',
    subgroup: 'noise-interference',
    symbol: '',
    canonicalUnit: 'dB',
    displayUnit: 'dB',
    valueKind: 'number',
    min: 0,
    max: 20,
    step: 0.1,
    defaultValue: DEFAULT_VISUAL_LAB_INPUTS.noiseFigureDb,
    label: localized('接收器雜訊指數', 'Receiver noise figure'),
    description: localized('接收器額外加入的雜訊劣化。', 'Additional receiver noise degradation.'),
    causalPath: localized('已收合於 σ² = B^w · N_0', 'Included in σ² = B^w · N_0'),
    provenance: localized('canonical physical-noise construction。', 'Canonical physical-noise construction.'),
    searchTerms: searchTerms(['雜訊指數', 'NF', '接收器雜訊'], ['noise figure', 'NF', 'receiver noise']),
    causalTargetTags: ['noise', 'sinr', 'throughput', 'energy-efficiency'],
    sceneHighlightTargets: ['scene-noise', 'scene-link'],
    toDisplayValue: identity,
    fromDisplayValue: identity,
    formatDisplayValue: fixed(1),
  }),
  definition({
    key: 'noiseReferenceTemperatureK',
    group: 'sinr',
    subgroup: 'noise-interference',
    symbol: '',
    canonicalUnit: 'K',
    displayUnit: 'K',
    valueKind: 'number',
    min: 1,
    max: 2_000,
    step: 1,
    defaultValue: DEFAULT_VISUAL_LAB_INPUTS.noiseReferenceTemperatureK,
    label: localized('雜訊參考溫度', 'Noise-reference temperature'),
    description: localized('接收器雜訊指數使用的參考溫度。', 'Reference temperature used by the receiver noise figure.'),
    causalPath: localized('已收合於 σ² = B^w · N_0', 'Included in σ² = B^w · N_0'),
    provenance: localized('canonical physical-noise construction。', 'Canonical physical-noise construction.'),
    searchTerms: searchTerms(['雜訊參考溫度', 'T_0', '參考溫度'], ['noise-reference temperature', 'T_0', 'reference temperature']),
    causalTargetTags: ['noise', 'sinr', 'throughput', 'energy-efficiency'],
    sceneHighlightTargets: ['scene-noise', 'scene-link'],
    toDisplayValue: identity,
    fromDisplayValue: identity,
    formatDisplayValue: fixed(0),
  }),
  definition({
    key: 'g0Linear',
    group: 'sinr',
    subgroup: 'antenna-channel',
    symbol: 'G^T(0)',
    canonicalUnit: 'linear',
    displayUnit: 'dBi',
    valueKind: 'number',
    min: 0,
    max: 40,
    step: 0.1,
    defaultValue: DEFAULT_VISUAL_LAB_INPUTS.g0Linear,
    label: localized('波束中心發射增益', 'Boresight transmit gain'),
    description: localized('波束正中心的線性發射增益；以 dBi 編輯。', 'Linear boresight transmit gain, edited in dBi.'),
    causalPath: localized('G^T(0) → G^T(θ_{u,s,v}) → SINR／速率／EE', 'G^T(0) → G^T(θ_{u,s,v}) → SINR / rate / EE'),
    provenance: localized('G^T(0)；dBi 僅為顯示單位。', 'G^T(0); dBi is a display unit only.'),
    searchTerms: searchTerms(['波束中心增益', 'G^T(0)', 'dBi', '發射增益'], ['boresight gain', 'G^T(0)', 'dBi', 'transmit gain']),
    causalTargetTags: ['beam-gain', 'channel', 'received-signal', 'sinr', 'throughput', 'energy-efficiency'],
    sceneHighlightTargets: ['scene-beams', 'scene-link'],
    toDisplayValue: linearToDbi,
    fromDisplayValue: dbiToLinear,
    formatDisplayValue: fixed(2),
  }),
  definition({
    key: 'theta3dbRad',
    group: 'sinr',
    subgroup: 'antenna-channel',
    symbol: 'G^T(θ_{u,s,v})',
    canonicalUnit: 'rad',
    displayUnit: 'degree',
    valueKind: 'number',
    min: 1,
    max: 20,
    step: 0.01,
    defaultValue: DEFAULT_VISUAL_LAB_INPUTS.theta3dbRad,
    label: localized('完整 3 dB 波束寬度', 'Full 3 dB beamwidth'),
    description: localized('完整半功率波束寬度；公式內部使用弧度。', 'Full half-power beamwidth; formulas use radians.'),
    causalPath: localized('波束寬度 → G^T(θ_{u,s,v}) → SINR／速率／EE', 'Beam width → G^T(θ_{u,s,v}) → SINR / rate / EE'),
    provenance: localized('G^T(θ_{u,s,v}) 的角度條件；degree 僅為顯示單位。', 'Angle condition for G^T(θ_{u,s,v}); degrees are a display unit only.'),
    searchTerms: searchTerms(['3 dB 波束寬度', 'G^T(θ)', '波束寬度'], ['3 dB beamwidth', 'G^T(θ)', 'beamwidth']),
    causalTargetTags: ['beam-shape', 'beam-gain', 'channel', 'received-signal', 'sinr', 'throughput', 'energy-efficiency'],
    sceneHighlightTargets: ['scene-beams', 'scene-link'],
    toDisplayValue: radiansToDegrees,
    fromDisplayValue: degreesToRadians,
    formatDisplayValue: fixed(2),
  }),
  definition({
    key: 'carrierFrequencyGHz',
    group: 'sinr',
    subgroup: 'antenna-channel',
    symbol: 'H_{u,s,v}(t)',
    canonicalUnit: 'GHz',
    displayUnit: 'GHz',
    valueKind: 'number',
    min: 1,
    max: 100,
    step: 0.1,
    defaultValue: DEFAULT_VISUAL_LAB_INPUTS.carrierFrequencyGHz,
    label: localized('載波頻率', 'Carrier frequency'),
    description: localized('鏈路路徑損耗使用的載波頻率，不是 TLE 欄位。', 'Carrier frequency used by link path loss, not a TLE field.'),
    causalPath: localized('H_{u,s,v}(t) → SINR／速率／EE', 'H_{u,s,v}(t) → SINR / rate / EE'),
    provenance: localized('正式 canonical channel adapter。', 'Formal canonical channel adapter.'),
    searchTerms: searchTerms(['載波頻率', 'H', 'GHz'], ['carrier frequency', 'H', 'GHz']),
    causalTargetTags: ['path-loss', 'channel', 'received-signal', 'sinr', 'throughput', 'energy-efficiency'],
    sceneHighlightTargets: ['scene-link'],
    toDisplayValue: identity,
    fromDisplayValue: identity,
    formatDisplayValue: fixed(1),
  }),
  definition({
    key: 'atmosphericZenithLossDb',
    group: 'sinr',
    subgroup: 'antenna-channel',
    symbol: 'H_{u,s,v}(t)',
    canonicalUnit: 'dB/km',
    displayUnit: 'dB/km',
    valueKind: 'number',
    min: 0,
    max: 1,
    step: 0.01,
    defaultValue: DEFAULT_VISUAL_LAB_INPUTS.atmosphericZenithLossDb,
    label: localized('大氣衰減係數', 'Atmospheric attenuation coefficient'),
    description: localized('路徑中的大氣衰減假設。', 'Atmospheric attenuation assumption along the path.'),
    causalPath: localized('H_{u,s,v}(t) → SINR／速率／EE', 'H_{u,s,v}(t) → SINR / rate / EE'),
    provenance: localized('正式 canonical channel adapter。', 'Formal canonical channel adapter.'),
    searchTerms: searchTerms(['大氣衰減', 'chi_atm', '路徑損耗'], ['atmospheric attenuation', 'chi_atm', 'path loss']),
    causalTargetTags: ['path-loss', 'channel', 'received-signal', 'sinr', 'throughput', 'energy-efficiency'],
    sceneHighlightTargets: ['scene-link'],
    toDisplayValue: identity,
    fromDisplayValue: identity,
    formatDisplayValue: fixed(2),
  }),
  definition({
    key: 'receiveGainDbi',
    group: 'sinr',
    subgroup: 'antenna-channel',
    symbol: 'H_{u,s,v}(t)',
    canonicalUnit: 'dBi',
    displayUnit: 'dBi',
    valueKind: 'number',
    min: -10,
    max: 60,
    step: 0.1,
    defaultValue: DEFAULT_VISUAL_LAB_INPUTS.receiveGainDbi,
    label: localized('接收天線增益', 'Receive-antenna gain'),
    description: localized('接收側增益；進入 canonical 線性鏈路增益。', 'Receive-side gain entering the canonical linear link gain.'),
    causalPath: localized('H_{u,s,v}(t) → SINR／速率／EE', 'H_{u,s,v}(t) → SINR / rate / EE'),
    provenance: localized('正式 canonical receive-gain adapter。', 'Formal canonical receive-gain adapter.'),
    searchTerms: searchTerms(['接收天線增益', 'H', 'dBi'], ['receive antenna gain', 'H', 'dBi']),
    causalTargetTags: ['channel', 'received-signal', 'sinr', 'throughput', 'energy-efficiency'],
    sceneHighlightTargets: ['scene-link'],
    toDisplayValue: identity,
    fromDisplayValue: identity,
    formatDisplayValue: fixed(1),
  }),
  definition({
    key: 'beamPowerCapW',
    group: 'power',
    subgroup: 'limits',
    symbol: '',
    canonicalUnit: 'W',
    displayUnit: 'W',
    valueKind: 'number',
    min: 0.001,
    max: 20,
    step: 0.01,
    defaultValue: DEFAULT_VISUAL_LAB_INPUTS.beamPowerCapW,
    label: localized('單波束功率上限', 'Per-beam power cap'),
    description: localized('每一啟用波束的 RF 功率上限。', 'RF power cap for each active beam.'),
    causalPath: localized('非正式相容欄位；不屬於簡化 Power 公式。', 'Compatibility field; not part of the simplified Power formula.'),
    provenance: localized('canonical power boundary。', 'Canonical power boundary.'),
    searchTerms: searchTerms(['單波束功率上限', 'P_beam,max', 'RF 功率'], ['per-beam power cap', 'P_beam,max', 'RF power']),
    causalTargetTags: ['power-cap', 'actual-downlink-power', 'sinr', 'throughput', 'system-power', 'energy-efficiency'],
    sceneHighlightTargets: ['scene-beams', 'scene-link', 'scene-energy'],
    toDisplayValue: identity,
    fromDisplayValue: identity,
    formatDisplayValue: fixed(2),
  }),
  definition({
    key: 'satellitePowerCapW',
    group: 'power',
    subgroup: 'limits',
    symbol: '',
    canonicalUnit: 'W',
    displayUnit: 'W',
    valueKind: 'number',
    min: 0.001,
    max: 40,
    step: 0.01,
    defaultValue: DEFAULT_VISUAL_LAB_INPUTS.satellitePowerCapW,
    label: localized('單衛星功率上限', 'Per-satellite power cap'),
    description: localized('所有啟用波束合計的衛星 RF 功率上限。', 'Satellite RF power cap across active beams.'),
    causalPath: localized('非正式相容欄位；不屬於簡化 Power 公式。', 'Compatibility field; not part of the simplified Power formula.'),
    provenance: localized('canonical power boundary。', 'Canonical power boundary.'),
    searchTerms: searchTerms(['單衛星功率上限', 'P_sat,max', '衛星 RF'], ['per-satellite power cap', 'P_sat,max', 'satellite RF']),
    causalTargetTags: ['power-cap', 'actual-downlink-power', 'sinr', 'throughput', 'system-power', 'energy-efficiency'],
    sceneHighlightTargets: ['scene-beams', 'scene-link', 'scene-energy'],
    toDisplayValue: identity,
    fromDisplayValue: identity,
    formatDisplayValue: fixed(2),
  }),
  definition({
    key: 'minimumRateBps',
    group: 'sinr',
    subgroup: 'bandwidth-service-demand',
    symbol: 'R_{u,s,v}(t, boldtheta)',
    canonicalUnit: 'bit/s',
    displayUnit: 'bit/s',
    valueKind: 'number',
    min: 1_000,
    max: 10_000_000,
    step: 1_000,
    defaultValue: DEFAULT_VISUAL_LAB_INPUTS.minimumRateBps,
    label: localized('最低傳輸速率目標', 'Minimum service-rate target'),
    description: localized('功率控制與服務品質比較使用的最低速率目標。', 'Minimum target used for power control and service comparison.'),
    causalPath: localized('非正式服務目標；不屬於簡化 Throughput 公式。', 'Legacy service target; not part of the simplified Throughput formula.'),
    provenance: localized('canonical service target。', 'Canonical service target.'),
    searchTerms: searchTerms(['最低傳輸速率', 'R', '服務品質'], ['minimum rate', 'R', 'service quality']),
    causalTargetTags: ['service-target', 'required-power', 'actual-downlink-power', 'sinr', 'throughput', 'system-power', 'energy-efficiency'],
    sceneHighlightTargets: ['scene-link', 'scene-energy'],
    toDisplayValue: identity,
    fromDisplayValue: identity,
    formatDisplayValue: formatCompact,
  }),
  definition({
    key: 'systemBandwidthHz',
    group: 'sinr',
    subgroup: 'bandwidth-service-demand',
    symbol: 'B^w',
    canonicalUnit: 'Hz',
    displayUnit: 'Hz',
    valueKind: 'number',
    min: 1_000_000,
    max: 2_000_000_000,
    step: 1_000_000,
    defaultValue: DEFAULT_VISUAL_LAB_INPUTS.systemBandwidthHz,
    label: localized('系統頻寬', 'System bandwidth'),
    description: localized('系統總頻寬；每波束頻寬由頻率重用條件推導。', 'Total system bandwidth; per-beam bandwidth follows the frequency-reuse condition.'),
    causalPath: localized('B^w → σ² 與 R_{u,s,v}(t, boldtheta)', 'B^w → σ² and R_{u,s,v}(t, boldtheta)'),
    provenance: localized('canonical bandwidth owner。', 'Canonical bandwidth owner.'),
    searchTerms: searchTerms(['系統頻寬', 'B_sys', '每波束頻寬'], ['system bandwidth', 'B_sys', 'per-beam bandwidth']),
    causalTargetTags: ['bandwidth', 'noise', 'sinr', 'throughput', 'energy-efficiency'],
    sceneHighlightTargets: ['scene-link', 'scene-energy'],
    toDisplayValue: identity,
    fromDisplayValue: identity,
    formatDisplayValue: formatCompact,
  }),
  definition({
    key: 'etaMax',
    group: 'power',
    subgroup: 'amplifier',
    symbol: 'ξ_{u,s,v}(t, θ_{u,s,v})',
    canonicalUnit: 'ratio',
    displayUnit: 'ratio',
    valueKind: 'number',
    min: 0.01,
    max: 1,
    step: 0.01,
    defaultValue: DEFAULT_VISUAL_LAB_INPUTS.etaMax,
    label: localized('PA 效率上限', 'PA efficiency ceiling'),
    description: localized('功率放大器效率曲線的上限。', 'Upper bound of the power-amplifier efficiency curve.'),
    causalPath: localized('ξ_{u,s,v}(t, θ_{u,s,v}) → P^p_{u,s,v}(t, θ_{u,s,v}) → P^N', 'ξ_{u,s,v}(t, θ_{u,s,v}) → P^p_{u,s,v}(t, θ_{u,s,v}) → P^N'),
    provenance: localized('canonical PA model。', 'Canonical PA model.'),
    searchTerms: searchTerms(['PA 效率', 'eta_max', '放大器效率'], ['PA efficiency', 'eta_max', 'amplifier efficiency']),
    causalTargetTags: ['pa-efficiency', 'system-power', 'energy-efficiency'],
    sceneHighlightTargets: ['scene-energy'],
    toDisplayValue: identity,
    fromDisplayValue: identity,
    formatDisplayValue: fixed(2),
  }),
  definition({
    key: 'backoffDb',
    group: 'power',
    subgroup: 'amplifier',
    symbol: 'ξ_{u,s,v}(t, θ_{u,s,v})',
    canonicalUnit: 'dB',
    displayUnit: 'dB',
    valueKind: 'number',
    min: 0,
    max: 10,
    step: 0.1,
    defaultValue: DEFAULT_VISUAL_LAB_INPUTS.backoffDb,
    label: localized('PA 輸出回退', 'PA output back-off'),
    description: localized('PA 操作點相對於效率上限的輸出回退。', 'Output back-off from the PA efficiency ceiling.'),
    causalPath: localized('ξ_{u,s,v}(t, θ_{u,s,v}) → P^p_{u,s,v}(t, θ_{u,s,v}) → P^N', 'ξ_{u,s,v}(t, θ_{u,s,v}) → P^p_{u,s,v}(t, θ_{u,s,v}) → P^N'),
    provenance: localized('canonical PA model。', 'Canonical PA model.'),
    searchTerms: searchTerms(['PA 輸出回退', 'BO', '回退 dB'], ['PA output back-off', 'BO', 'back-off dB']),
    causalTargetTags: ['pa-efficiency', 'system-power', 'energy-efficiency'],
    sceneHighlightTargets: ['scene-energy'],
    toDisplayValue: identity,
    fromDisplayValue: identity,
    formatDisplayValue: fixed(1),
  }),
  definition({
    key: 'rfcPowerW',
    group: 'power',
    subgroup: 'rf-baseband-circuitry',
    symbol: 'P^f(t)',
    canonicalUnit: 'W/active beam',
    displayUnit: 'W/beam',
    valueKind: 'number',
    min: 0.001,
    max: 10,
    step: 0.001,
    defaultValue: DEFAULT_VISUAL_LAB_INPUTS.rfcPowerW,
    label: localized('每個啟用波束的 RF chain 功率', 'RF-chain power per active beam'),
    description: localized('每個啟用波束的固定 RF chain 消耗。', 'Fixed RF-chain consumption for each active beam.'),
    causalPath: localized('P^f(t) → P^N(t, boldtheta) → EE', 'P^f(t) → P^N(t, boldtheta) → EE'),
    provenance: localized('canonical power ledger。', 'Canonical power ledger.'),
    searchTerms: searchTerms(['固定功率', 'P^f', '啟用波束'], ['fixed power', 'P^f', 'active beam']),
    causalTargetTags: ['rf-chain-power', 'system-power', 'energy-efficiency'],
    sceneHighlightTargets: ['scene-beams', 'scene-energy'],
    toDisplayValue: identity,
    fromDisplayValue: identity,
    formatDisplayValue: fixed(3),
  }),
  definition({
    key: 'basebandPerSatelliteW',
    group: 'power',
    subgroup: 'rf-baseband-circuitry',
    symbol: 'P^f(t)',
    canonicalUnit: 'W/satellite',
    displayUnit: 'W/satellite',
    valueKind: 'number',
    min: 0.001,
    max: 20,
    step: 0.001,
    defaultValue: DEFAULT_VISUAL_LAB_INPUTS.basebandPerSatelliteW,
    label: localized('每顆啟用衛星的 baseband 功率', 'Baseband power per active satellite'),
    description: localized('每顆啟用衛星的固定 baseband 消耗。', 'Fixed baseband consumption for each active satellite.'),
    causalPath: localized('P^f(t) → P^N(t, boldtheta) → EE', 'P^f(t) → P^N(t, boldtheta) → EE'),
    provenance: localized('canonical power ledger。', 'Canonical power ledger.'),
    searchTerms: searchTerms(['固定功率', 'P^f', '啟用衛星'], ['fixed power', 'P^f', 'active satellite']),
    causalTargetTags: ['baseband-power', 'system-power', 'energy-efficiency'],
    sceneHighlightTargets: ['scene-energy'],
    toDisplayValue: identity,
    fromDisplayValue: identity,
    formatDisplayValue: fixed(3),
  }),
] as const;

export interface VisualLabExperimentSchema {
  readonly version: 'visual-lab-experiment-v1';
  readonly locales: readonly VisualLabLocale[];
  readonly inputKeys: typeof VISUAL_LAB_INPUT_KEYS;
  readonly groups: typeof VISUAL_LAB_INPUT_GROUPS;
  readonly subgroups: typeof VISUAL_LAB_INPUT_SUBGROUPS;
  readonly inputs: typeof VISUAL_LAB_INPUT_DEFINITIONS;
  readonly resultDomains: typeof VISUAL_LAB_RESULT_DOMAINS;
  readonly defaultValues: Readonly<VisualLabInputValues>;
}

/** One framework-agnostic registry for control, copy, and causal adapters. */
export const VISUAL_LAB_EXPERIMENT_SCHEMA: VisualLabExperimentSchema = Object.freeze({
  version: 'visual-lab-experiment-v1',
  locales: Object.freeze(['zh-Hant', 'en'] as const),
  inputKeys: VISUAL_LAB_INPUT_KEYS,
  groups: VISUAL_LAB_INPUT_GROUPS,
  subgroups: VISUAL_LAB_INPUT_SUBGROUPS,
  inputs: VISUAL_LAB_INPUT_DEFINITIONS,
  resultDomains: VISUAL_LAB_RESULT_DOMAINS,
  defaultValues: DEFAULT_VISUAL_LAB_INPUTS,
});

export const VISUAL_LAB_INPUT_SCHEMA = VISUAL_LAB_EXPERIMENT_SCHEMA;

export const VISUAL_LAB_EXPERIMENT_INPUT_DEFINITIONS = VISUAL_LAB_INPUT_DEFINITIONS;
export const VISUAL_LAB_EXPERIMENT_GROUPS = VISUAL_LAB_INPUT_GROUPS;
export const VISUAL_LAB_EXPERIMENT_SUBGROUPS = VISUAL_LAB_INPUT_SUBGROUPS;
export const VISUAL_LAB_EXPERIMENT_DEFAULTS = DEFAULT_VISUAL_LAB_INPUTS;

const definitionByKey = new Map<VisualLabInputKey, VisualLabInputDefinition>(
  VISUAL_LAB_INPUT_DEFINITIONS.map((item) => [item.key, item]),
);

const mapValues = (
  values: VisualLabInputValues | VisualLabFormValues,
  direction: 'to-display' | 'from-display',
): VisualLabFormValues | VisualLabInputValues => {
  const mapped = {} as Record<VisualLabInputKey, number>;
  for (const key of VISUAL_LAB_INPUT_KEYS) {
    const item = definitionByKey.get(key);
    if (item === undefined) throw new Error(`Missing experiment definition for ${key}`);
    const value = values[key];
    mapped[key] = direction === 'to-display'
      ? item.toDisplayValue(value)
      : item.fromDisplayValue(value);
  }
  return Object.freeze(mapped) as VisualLabFormValues | VisualLabInputValues;
};

/** Convert canonical SimulatorParameters fields to display-unit form values. */
export function toVisualLabFormValues(parameters: VisualLabInputValues): VisualLabFormValues {
  return mapValues(parameters, 'to-display') as VisualLabFormValues;
}

/**
 * Convert display-unit form values to the exact 17 canonical fields.
 * No range clamp, fallback, or scientific calculation occurs here.
 */
export function fromVisualLabFormValues(values: VisualLabFormValues): VisualLabInputValues;
/** Apply converted values to a full SimulatorParameters object, preserving compatibility fields. */
export function fromVisualLabFormValues(values: VisualLabFormValues, baseParameters: SimulatorParameters): SimulatorParameters;
export function fromVisualLabFormValues(
  values: VisualLabFormValues,
  baseParameters?: SimulatorParameters,
): VisualLabInputValues | SimulatorParameters {
  const canonical = mapValues(values, 'from-display') as VisualLabInputValues;
  if (baseParameters === undefined) return canonical;
  return Object.freeze({ ...baseParameters, ...canonical });
}

/** Explicit name for callers that are applying a form edit to a full frame input. */
export function applyVisualLabFormValues(
  baseParameters: SimulatorParameters,
  values: VisualLabFormValues,
): SimulatorParameters {
  return fromVisualLabFormValues(values, baseParameters);
}

export const simulatorParametersToFormValues = toVisualLabFormValues;
export const formValuesToVisualLabInputValues = fromVisualLabFormValues;
export const formValuesToSimulatorParameters = applyVisualLabFormValues;
export const toFormValues = toVisualLabFormValues;
export const fromFormValues = fromVisualLabFormValues;

export const DEFAULT_VISUAL_LAB_FORM_VALUES = toVisualLabFormValues(DEFAULT_VISUAL_LAB_INPUTS);
