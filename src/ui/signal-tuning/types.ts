import type { ReactNode } from 'react';

/**
 * Top-level tab state used by the tuning panel.
 *
 * The visible navigation starts with the local scenario-data preview, followed
 * by the four canonical analysis projections. `handover` and `scene` remain in
 * this state union because their panels and runtime props are still part of the
 * Walker/handover scene contract; `MainTabList` does not expose those legacy
 * views as tabs.
 */
export type MainTabKey =
  | 'scenario'
  | 'sinr'
  | 'energy'
  | 'power'
  | 'throughput'
  | 'handover'
  | 'scene';

/**
 * The four visible terms of γ. The former loss/beam/receiver-gain keys remain
 * as compatibility aliases for older deep links and validation fixtures, but
 * they are represented by the single visible effective-channel tab.
 */
export type TuningTabKey =
  | 'signal-power'
  | 'channel'
  | 'interference'
  | 'thermal-noise'
  // Compatibility aliases; not rendered in the visible tab strip.
  | 'loss'
  | 'beam'
  | 'receiver-gain';

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
