/**
 * Act 5 arm strategies — baseline versus eco.
 *
 * Ruling 2026-08-22: an arm changes the SELECTION RULE, never the physics.
 *
 *   baseline — pick the candidate with the highest rate R.
 *   eco      — pick the candidate with the highest R / P^N.
 *
 * That is the paper's first change to MODQN (the first reward moves from
 * throughput to angle-aware energy efficiency) expressed as one knob, with no
 * training required. The panel control is literally "rank by R or by R/P^N".
 *
 * Two things an arm must NOT be, both structurally impossible here:
 *
 *   - a lower power cap. `P_max = 1.65 W` is a hardware constant (thesis-mc
 *     ch5 Table 5-2), not a policy knob. Changing it changes the physics, and
 *     the two arms would no longer be replaying the same immutable frames.
 *     `SixActsPowerSweep` rejects a point whose cap differs from the session's.
 *   - a different sweep start. That is a seed, not an arm.
 *
 * An arm spec therefore carries a ranking rule and nothing else — no power
 * field exists on it to set.
 *
 * See docs/sdd/SIX-ACTS-P0-VERTICAL-SLICE-SDD.md (M5).
 */

export type SixActsArm = 'baseline' | 'eco';

export type SixActsRankBy = 'rate' | 'rate-per-system-power';

export interface SixActsArmSpec {
  readonly id: SixActsArm;
  readonly rankBy: SixActsRankBy;
  /** The formula shown on screen, in ACTIVE SYMBOL AUTHORITY notation. */
  readonly formula: string;
  readonly labelZhHant: string;
  readonly whyZhHant: string;
}

export const SIX_ACTS_ARMS: readonly SixActsArmSpec[] = Object.freeze([
  Object.freeze({
    id: 'baseline',
    rankBy: 'rate',
    formula: 'R_{u,s,v}',
    labelZhHant: '選速率最大的候選',
    whyZhHant: 'baseline 規則：依即時速率 R 選擇候選，不將系統功耗納入排序。',
  }),
  Object.freeze({
    id: 'eco',
    rankBy: 'rate-per-system-power',
    formula: 'R_{u,s,v} / P^N',
    labelZhHant: '選能效最大的候選',
    whyZhHant: '本論文對 MODQN 的第一個改動：把「傳得快」換成「每焦耳傳得多」。同一組畫面、同一組物理，只換排序依據。',
  }),
]);

export function getSixActsArmSpec(arm: SixActsArm): SixActsArmSpec {
  const spec = SIX_ACTS_ARMS.find(candidate => candidate.id === arm);
  if (spec === undefined) throw new RangeError(`unknown arm ${arm}`);
  return spec;
}

export type SixActsSelectionErrorCode =
  | 'NO_CANDIDATES'
  | 'INVALID_RATE'
  | 'INVALID_SYSTEM_POWER';

export class SixActsSelectionError extends RangeError {
  readonly code: SixActsSelectionErrorCode;

  constructor(code: SixActsSelectionErrorCode, message: string) {
    super(message);
    this.name = 'SixActsSelectionError';
    this.code = code;
  }
}

/**
 * One candidate as the arms see it.
 *
 * `projectedSystemPowerW` is the system power P^N that would result from
 * serving this candidate — the arms rank on a projection, which is why the
 * decision is a prediction problem and not a lookup.
 */
export interface SixActsArmCandidate {
  readonly satelliteId: string;
  readonly beamId: number;
  readonly rateMbps: number;
  readonly projectedSystemPowerW: number;
}

export interface SixActsArmChoice {
  readonly arm: SixActsArm;
  readonly rankBy: SixActsRankBy;
  readonly chosen: SixActsArmCandidate;
  /** The score the ranking actually used, for the on-screen explanation. */
  readonly score: number;
  /**
   * True when both arms would have chosen the same candidate.
   *
   * Surfaced so a lesson never claims a difference the data does not show: at
   * many operating points the two rules agree, and saying so is the honest
   * result, not a failed demo.
   *
   * `null` when the OTHER arm's rule cannot be evaluated on this data — eco
   * needs a positive projected P^N that baseline never looks at. The selected
   * arm still returns its own pick; only the comparison is unknown, and an
   * unknown comparison is reported as unknown rather than guessed or thrown.
   */
  readonly armsAgree: boolean | null;
}

function scoreFor(candidate: SixActsArmCandidate, rankBy: SixActsRankBy): number {
  if (!Number.isFinite(candidate.rateMbps) || candidate.rateMbps < 0) {
    throw new SixActsSelectionError(
      'INVALID_RATE',
      `${candidate.satelliteId} must carry a finite non-negative rate in Mbit/s`,
    );
  }
  if (rankBy === 'rate') return candidate.rateMbps;
  if (!Number.isFinite(candidate.projectedSystemPowerW) || candidate.projectedSystemPowerW <= 0) {
    throw new SixActsSelectionError(
      'INVALID_SYSTEM_POWER',
      `${candidate.satelliteId} must carry a finite positive projected P^N in W`,
    );
  }
  return candidate.rateMbps / candidate.projectedSystemPowerW;
}

function argmax(
  candidates: readonly SixActsArmCandidate[],
  rankBy: SixActsRankBy,
): { candidate: SixActsArmCandidate; score: number } {
  let best = { candidate: candidates[0], score: scoreFor(candidates[0], rankBy) };
  for (const candidate of candidates.slice(1)) {
    const score = scoreFor(candidate, rankBy);
    // Strict improvement only: ties keep the earlier candidate so the choice is
    // deterministic across replays of the same frames.
    if (score > best.score) best = { candidate, score };
  }
  return best;
}

/** Applies one arm's ranking rule. Physics is untouched; only the pick changes. */
export function selectSixActsCandidate(
  candidates: readonly SixActsArmCandidate[],
  arm: SixActsArm,
): SixActsArmChoice {
  if (candidates.length === 0) {
    throw new SixActsSelectionError('NO_CANDIDATES', 'an arm cannot choose from an empty candidate set');
  }
  const spec = getSixActsArmSpec(arm);
  const picked = argmax(candidates, spec.rankBy);
  const other = getSixActsArmSpec(arm === 'baseline' ? 'eco' : 'baseline');

  let armsAgree: boolean | null;
  try {
    const otherPick = argmax(candidates, other.rankBy);
    armsAgree = otherPick.candidate.satelliteId === picked.candidate.satelliteId
      && otherPick.candidate.beamId === picked.candidate.beamId;
  } catch (error) {
    if (!(error instanceof SixActsSelectionError)) throw error;
    armsAgree = null;
  }

  return Object.freeze({
    arm,
    rankBy: spec.rankBy,
    chosen: picked.candidate,
    score: picked.score,
    armsAgree,
  });
}
