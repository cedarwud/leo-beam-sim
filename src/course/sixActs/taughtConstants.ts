/**
 * Every number the classroom slice puts on screen, with where it came from.
 *
 * Ruling 2026-08-22: a constant may be taught, but it must be labelled for what
 * it is. `sinrThresholdDb = -5` appears identically in all six shipped profiles
 * and has NO recorded source — it is a simulator operating constant, not a
 * paper value and not a standard. Teaching it is fine ("this is the rule this
 * engine applies"); presenting it as a paper or 3GPP value is not. Unlabelled,
 * it becomes the next invented constant driving a headline number.
 *
 * The registry exists so a surface cannot show a value without its badge: the
 * caption travels with the number.
 *
 * See docs/sdd/SIX-ACTS-P0-VERTICAL-SLICE-SDD.md (M2/M5).
 */

export type SixActsConstantProvenance =
  /** Traceable to the thesis / paper authority. `sourceRef` names where. */
  | 'PAPER'
  /** A simulator operating constant with no recorded source. `sourceRef` null. */
  | 'ENGINE-OPERATING'
  /** A scenario/policy setting chosen for this study. */
  | 'STUDY-POLICY'
  /** Narrative the engine does not produce. */
  | 'COURSE-ASSUMPTION';

export interface SixActsTaughtConstant {
  readonly id: string;
  readonly value: number;
  readonly unit: string;
  readonly provenance: SixActsConstantProvenance;
  /** Where it comes from, or null when nothing records a source. */
  readonly sourceRef: string | null;
  /** The badge line that must appear wherever the value does. */
  readonly captionZhHant: string;
}

export const SIX_ACTS_TAUGHT_CONSTANTS: readonly SixActsTaughtConstant[] = Object.freeze([
  Object.freeze({
    id: 'engine-attach-threshold-db',
    value: -5,
    unit: 'dB',
    provenance: 'ENGINE-OPERATING' as const,
    sourceRef: null,
    captionZhHant:
      '這是本模擬器判定 UE 能不能掛上／重掛的運作門檻（六個 profile 一致）。'
      + '沒有論文或標準出處——它是引擎的規則，不是論文值。',
  }),
  Object.freeze({
    id: 'engine-reattach-relax-db',
    value: 3,
    unit: 'dB',
    provenance: 'ENGINE-OPERATING' as const,
    sourceRef: null,
    captionZhHant:
      '斷線後重掛時，引擎把上面那個門檻放寬 3 dB。同樣沒有出處，是引擎的規則。',
  }),
  Object.freeze({
    id: 'handover-offset-db',
    value: 3,
    unit: 'dB',
    provenance: 'STUDY-POLICY' as const,
    sourceRef: 'artifacts/tle-event-atlas/20260818-ntpu-90d — 圖集挖掘所用政策',
    captionZhHant: '候選要比服務好這麼多才算數。這是本研究挑窗用的政策設定。',
  }),
  Object.freeze({
    id: 'handover-ttt-sec',
    value: 30,
    unit: 's',
    provenance: 'STUDY-POLICY' as const,
    sourceRef: 'artifacts/tle-event-atlas/20260818-ntpu-90d — 圖集挖掘所用政策',
    captionZhHant: '上面的條件還要連續成立這麼久才換手。同樣是政策設定。',
  }),
  Object.freeze({
    id: 'beam-power-cap-w',
    value: 1.65,
    unit: 'W',
    provenance: 'PAPER' as const,
    sourceRef: 'thesis-mc ch5 表 5-2；DEFAULT_SIMULATOR_PARAMETERS.beamPowerCapW',
    captionZhHant: '每道波束的額定 RF 上限。這是硬體常數，不是可調的政策旋鈕。',
  }),
  Object.freeze({
    id: 'frequency-reuse',
    value: 3,
    unit: 'colours',
    provenance: 'PAPER' as const,
    sourceRef: 'thesis-mc ch5 表 5-2（3 色重用）；環境端 (q-r) mod 3',
    captionZhHant: '三色頻率重用：只有三分之一的鄰近波束會互相干擾。',
  }),
  Object.freeze({
    id: 'beam-bandwidth-mhz',
    value: 500 / 3,
    unit: 'MHz',
    provenance: 'PAPER' as const,
    sourceRef: 'thesis-mc ch5 表 5-2（B^w = 166.667 MHz）；500 MHz 系統頻寬 / 3 色',
    captionZhHant: '每道波束分到的頻寬 B^w。圖集用的就是這個值。',
  }),
  Object.freeze({
    id: 'atlas-visibility-elevation-deg',
    value: 0,
    unit: 'deg',
    provenance: 'STUDY-POLICY' as const,
    sourceRef: 'ntpu-exact-sgp4-horizon-v1；src/simulator/observer.ts',
    captionZhHant:
      '圖集判定「看得見」用的是幾何地平線（0°）。'
      + 'Act 1 敘事講的 10° 圓錐是另一回事，兩者不可混用。',
  }),
]);

export function getSixActsTaughtConstant(id: string): SixActsTaughtConstant {
  const constant = SIX_ACTS_TAUGHT_CONSTANTS.find(candidate => candidate.id === id);
  if (constant === undefined) throw new RangeError(`no taught constant ${id}`);
  return constant;
}

/**
 * The engine's attach threshold, as a labelled constant.
 *
 * `LOW_SINR_RATIO` binds to this: the field then means "how long the link sat
 * below the level that decides whether the UE can stay attached", which is the
 * Act 5 causal chain verbatim. Callers take the whole record, not a bare
 * number, so the caption cannot be dropped on the way to the screen.
 */
export function getSixActsAttachThreshold(): SixActsTaughtConstant {
  return getSixActsTaughtConstant('engine-attach-threshold-db');
}

/**
 * Declares an ad-hoc threshold that is NOT the engine's own.
 *
 * The escape hatch is deliberately noisy: it forces a caption, and it stamps
 * `COURSE-ASSUMPTION`, so a value chosen for a lesson can never be mistaken on
 * screen for something the engine or the paper says.
 */
export function declareSixActsCourseThreshold(
  value: number,
  captionZhHant: string,
  unit = 'dB',
): SixActsTaughtConstant {
  if (captionZhHant.trim() === '') {
    throw new RangeError('a course-assumption constant must say what it is and why');
  }
  return Object.freeze({
    id: 'course-assumption-threshold',
    value,
    unit,
    provenance: 'COURSE-ASSUMPTION' as const,
    sourceRef: null,
    captionZhHant,
  });
}
