import type { ReactNode } from 'react';

/**
 * Top-level tabs. The formula-term tabs below are a *secondary* level inside
 * `sinr`, so nothing that was already wired up is lost — only the first thing
 * you look at changed.
 *
 * `handover` is not a third formula: it decides which satellite the link is on,
 * so it belongs neither in the SINR fraction nor in the power train. It only
 * appears when the app hands the panel a handover section.
 *
 * `scene` is not a formula either, and that is exactly why it is up here. Its
 * fields — how many satellites, how many beams each, how many users and how
 * they move — are the shape of the simulated world, not terms of γ. While it
 * sat inside SINR as a seventh "formula term" (under the symbol N_sat) it read
 * as though the satellite count were a factor of the fraction, which it is not:
 *
 *     γ = (P_t · H · G^T · G^R) / (I^a + I^b + σ²)
 *
 * contains none of them. Changing one restarts the run; changing a real term
 * only recomputes it.
 */
export type MainTabKey = 'sinr' | 'energy' | 'handover' | 'scene';

/**
 * The six terms of γ, one sub-tab each. `topology` is deliberately NOT here any
 * more — see `MainTabKey.scene` above.
 */
export type TuningTabKey =
  | 'signal-power'
  | 'loss'
  | 'beam'
  | 'receiver-gain'
  | 'interference'
  | 'thermal-noise';

export type SignalDrawerState = 'collapsed' | 'tuning' | 'diagnostics';

export interface TuningTab {
  key: TuningTabKey;
  symbol: ReactNode;
  title: string;
  subtitle: string;
  /** Canonical description. Some entries are a sentence, not notation. */
  formula: ReactNode;
  /**
   * Notation-only form shown on screen. When present the panel renders this
   * and keeps `formula` in the hidden canonical block, so a tab body reads as
   * mathematics rather than as an English sentence.
   */
  formulaExpr?: ReactNode;
  note: string;
  tabClass?: 'paper-facing' | 'simulation-setting';
}
