import type { ReactNode } from 'react';

export type TuningTabKey =
  | 'signal-power'
  | 'loss'
  | 'beam'
  | 'receiver-gain'
  | 'interference'
  | 'thermal-noise';

export type TuningPageKey = 'sinr-formula' | 'handover-policy';

export type SignalDrawerState = 'collapsed' | 'tuning' | 'diagnostics';

export interface TuningPageRequest {
  page: TuningPageKey;
  sequence: number;
}

export interface TuningTab {
  key: TuningTabKey;
  symbol: ReactNode;
  title: string;
  subtitle: string;
  formula: ReactNode;
  note: string;
}
export interface TuningPage {
  key: TuningPageKey;
  title: string;
  subtitle: string;
}
