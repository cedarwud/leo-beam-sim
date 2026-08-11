import type { ReactNode } from 'react';

/**
 * Top-level tab state used by the tuning panel.
 *
 * The visible navigation is deliberately fixed to `sinr`, `energy`, `power`,
 * and `throughput`. `handover` and `scene` remain in this state union because
 * their panels and runtime props are still part of the Walker/handover scene
 * contract; `MainTabList` simply does not expose those legacy views as tabs.
 */
export type MainTabKey =
  | 'sinr'
  | 'energy'
  | 'power'
  | 'throughput'
  | 'handover'
  | 'scene';

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
