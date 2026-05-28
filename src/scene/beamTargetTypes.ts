import type { BeamCodeRole, HandoverBeamRole } from '../constants/beamRoleTokens';
import type { GlyphKind } from '../contracts/glyphTypes';
import type { BeamFrequencyIndexResolution } from '../utils/beamFrequency';
import type { VisualShowcaseChannelMetricKind } from './visual-showcase-contract';

/** A beam with its ground-projected center in world coordinates. */
export interface BeamTarget {
  beamId: number;
  groundX: number;
  groundZ: number;
  isServing: boolean;
  isScheduledActive: boolean;
  isPrimary: boolean;
  showBeam: boolean;
  frequencyIndex: number;
  satelliteTintColor: string;
  satelliteGlyph: GlyphKind;
  satelliteVisualIndex: number;
  visualColorSource?: 'frequency' | 'satellite';
  loadRatio?: number;
  role?: BeamCodeRole;
  isTransitioningSource?: boolean;
  sinrDb?: number | null;
  /**
   * P1e (c) audit-list hook (PR-0.5 backfill): the channel-metric kind that
   * accompanies `sinrDb`. Live engine = `'sinr-with-interference'`; replay =
   * `'snr-no-interference'`. Optional; live-sim path does not populate this
   * yet. Full kind-aware rendering (callout label branching via
   * `formatBeamSinrWithKind` / `formatBeamChannelMetric`) is reserved for the
   * slice PRs — this declaration only exposes the contract surface so future
   * wiring does not need a downstream BeamTarget change.
   */
  channelMetricKind?: VisualShowcaseChannelMetricKind;
  handoverRole?: HandoverBeamRole;
  handoverTransitionProgress?: number | null;
}

export type VisualBeamTarget = BeamTarget & BeamFrequencyIndexResolution;

