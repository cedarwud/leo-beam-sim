/**
 * Act 3's automatic demonstration.
 *
 * The proposal asks for one comparison, run twice over the same pass:
 *
 *   (a) 中軸固定星下點 — the beam keeps pointing straight down, so as the
 *       satellite moves on, θ grows, G^T falls, and the recursion pushes power
 *       up and up. The energy bill for a pointing error, drawn.
 *   (b) 中軸鎖定 UE — the beam steers to follow, so θ stays near zero and the
 *       power holds flat. What runs out instead is the steering range.
 *
 * Same geometry, same physics, one changed decision. Slow motion exists because
 * the interesting part — gain collapsing while power climbs — happens over a
 * couple of degrees.
 */

export type AngleLabDemoMode = 'off' | 'fixed-nadir' | 'track-ue';

export interface AngleLabDemoSpec {
  readonly id: AngleLabDemoMode;
  readonly labelZhHant: string;
  readonly narrationZhHant: string;
}

export const ANGLE_LAB_DEMOS: readonly AngleLabDemoSpec[] = Object.freeze([
  Object.freeze({
    id: 'fixed-nadir' as const,
    labelZhHant: '(a) 中軸固定星下點',
    narrationZhHant: '波束不動，衛星飛過去。你離準心越來越遠，增益一路掉，功率為了補回來一路爬。',
  }),
  Object.freeze({
    id: 'track-ue' as const,
    labelZhHant: '(b) 中軸鎖定 UE',
    narrationZhHant: '波束歪頭照你。θ 幾乎維持 0、功率穩住——但掃描角一直在逼近極限。歪到極限，就得換人。',
  }),
]);

/** Slow motion matters here: the collapse happens across about two degrees. */
export const ANGLE_LAB_DEMO_SPEEDS: readonly { readonly value: number; readonly label: string }[] =
  Object.freeze([
    Object.freeze({ value: 0.25, label: '慢動作 ×0.25' }),
    Object.freeze({ value: 1, label: '×1' }),
    Object.freeze({ value: 3, label: '×3' }),
  ]);

/** How far off nadir the pass runs, in degrees. */
export const ANGLE_LAB_DEMO_MAX_NADIR_DEG = 11;
/** Seconds of wall clock for one pass at ×1. */
export const ANGLE_LAB_DEMO_DURATION_SEC = 12;

export interface AngleLabDemoState {
  readonly ueNadirDeg: number;
  readonly steeringDeg: number;
  /** 0..1 through the pass. */
  readonly progress: number;
}

/**
 * The demo's geometry at a point in the pass.
 *
 * In mode (b) the axis follows the user exactly, so the STEERING angle is the
 * quantity that grows — which is the point: one mode spends power, the other
 * spends steering range, and both run out.
 */
export function angleLabDemoStateAt(
  mode: Exclude<AngleLabDemoMode, 'off'>,
  progress: number,
): AngleLabDemoState {
  const clamped = Math.max(0, Math.min(1, progress));
  const ueNadirDeg = clamped * ANGLE_LAB_DEMO_MAX_NADIR_DEG;
  return Object.freeze({
    ueNadirDeg,
    steeringDeg: mode === 'track-ue' ? ueNadirDeg : 0,
    progress: clamped,
  });
}
