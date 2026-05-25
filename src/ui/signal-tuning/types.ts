import type { ReactNode } from 'react';

export type TuningTabKey =
  | 'signal-power'
  | 'loss'
  | 'beam'
  | 'receiver-gain'
  | 'interference'
  | 'thermal-noise'
  | 'topology';

export type SignalDrawerState = 'collapsed' | 'tuning' | 'diagnostics';

export interface TuningTab {
  key: TuningTabKey;
  symbol: ReactNode;
  title: string;
  subtitle: string;
  formula: ReactNode;
  note: string;
  tabClass?: 'paper-facing' | 'simulation-setting';
}
