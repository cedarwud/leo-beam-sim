import type {
  AcceptedHandoverPresentationSession,
  AcceptedHandoverPresentationSnapshot,
} from '../../scene/acceptedHandoverPresentationSnapshot';
import {
  buildHomepageAcceptedSnapshotSession,
} from './acceptedSnapshot';
import {
  buildHomepageBeamMetrics,
} from './beamMetrics';
import {
  resolveHomepageBeamBudgets,
} from '../../scene/sinrLiveBeamBudget';
import type {
  HomepageAcceptedSnapshot,
  HomepageBeamMetricsProjection,
  HomepageSourceFrame,
} from './contracts';
import type { CandidateLinkKey } from '../../engine/handover/candidateDecisionContract';

/**
 * Plain-data inputs for the homepage's accepted render authority.
 *
 * React owns the refs and publication cadence around this value. It does not
 * own the value's construction: this function is also the headless entry point
 * used by the render-timeline audit.
 */
export interface HomepageRenderAuthorityInput {
  readonly sourceFrame: HomepageSourceFrame | null;
  readonly policyConfigHash: string;
  readonly pinnedKey?: CandidateLinkKey | null;
  readonly previousSnapshot?: HomepageAcceptedSnapshot | null;
  readonly previousMetrics?: HomepageBeamMetricsProjection | null;
  readonly servingBeamCount?: number;
  readonly candidateBeamCount?: number;
  readonly profileBeamsPerSatellite: number;
  readonly beamCountBySatellite?: Readonly<Record<string, number>>;
  readonly configuredBeamCount?: number;
}

export interface HomepageRenderAuthority {
  /** The canonical accepted session, or null before a decision is present. */
  readonly session: AcceptedHandoverPresentationSession | null;
  /** The exact snapshot a homepage render would read, including the bridge hold. */
  readonly snapshot: HomepageAcceptedSnapshot | null;
  /** The exact homepage metric projection a homepage render would read. */
  readonly beamMetrics: HomepageBeamMetricsProjection | null;
}

/**
 * Construct the homepage render authority from plain source data.
 *
 * This is deliberately a composition point, not a second implementation of
 * snapshot or metric logic. The accepted-snapshot builder remains responsible
 * for plan identity allocation; the metrics builder remains responsible for
 * same-frame EE normalisation. Both React and Node call this same function.
 */
export function resolveHomepageRenderAuthority(
  input: HomepageRenderAuthorityInput,
): HomepageRenderAuthority {
  const sourceFrame = input.sourceFrame;
  const session = sourceFrame?.decision === null || sourceFrame?.decision === undefined
    ? null
    : buildHomepageAcceptedSnapshotSession({
      decisionBoundary: Object.freeze({
        sourceFrameId: sourceFrame.sourceFrameId,
        epochToken: sourceFrame.epochToken,
        simTimeMs: sourceFrame.simTimeMs,
        phase: sourceFrame.decision.phase,
        decision: sourceFrame.decision,
      }),
      policyConfigHash: input.policyConfigHash,
      pinnedKey: input.pinnedKey ?? null,
      previousSnapshot: input.previousSnapshot ?? null,
      displayAllHardEligibleCandidates: true,
      displayOnlyTriggerSatisfiedCandidates: true,
      configuredBeamCount: input.configuredBeamCount,
    });

  const snapshot = session?.snapshot ?? input.previousSnapshot ?? null;
  const beamMetrics = sourceFrame === null
    ? input.previousMetrics ?? null
    : buildHomepageBeamMetrics({
      sourceFrame,
      snapshot,
      ...resolveHomepageBeamBudgets({
        servingBeamCount: input.servingBeamCount,
        candidateBeamCount: input.candidateBeamCount,
        profileBeamsPerSatellite: input.profileBeamsPerSatellite,
      }),
      beamCountBySatellite: input.beamCountBySatellite,
      previousMetrics: input.previousMetrics ?? null,
      eeDisplayPolicy: 'source',
    });

  return Object.freeze({ session, snapshot, beamMetrics });
}

/** Keep the accepted snapshot type visible at this seam for consumers/tests. */
export type HomepageAcceptedRenderSnapshot = AcceptedHandoverPresentationSnapshot;
