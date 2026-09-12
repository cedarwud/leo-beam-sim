import type { HomepageRailProjection } from '../homepage/controller/contracts';
import { acceptedHandoverStoryPhase } from './handoverStoryFrame';
import {
  resolveAcceptedHandoverSurfaceStatus,
  type HandoverSurfaceBinding,
  type HandoverSurfaceContractStatus,
} from './handoverSurfaceBinding';

export type AcceptedHandoverSurfaceProducer = 'walker' | 'tle';

/**
 * Shell-owned accepted identity projection consumed mechanically by the rail.
 * The rail keeps its existing value rows, but it never remaps engine phase,
 * rebuilds the source/target pair, or guesses accepted provenance itself.
 */
export interface HandoverAcceptedSurfaceProjection {
  readonly binding: HandoverSurfaceBinding | null;
  readonly contractStatus: HandoverSurfaceContractStatus;
}

function storyMatchesRailRoot(projection: HomepageRailProjection): boolean {
  const story = projection.handoverStory ?? null;
  return story === null
    || (
      story.snapshotId === projection.snapshotId
      && story.sourceFrameId === projection.sourceFrameId
      && story.phase === projection.phase
    );
}

/**
 * Compose the accepted rail identity once at the shell boundary.
 * Mismatches remain publishable telemetry so the production gate turns red;
 * no renderer is allowed to repair or reinterpret them locally.
 */
export function resolveHandoverAcceptedSurfaceProjection(
  binding: HandoverSurfaceBinding | null,
  projection: HomepageRailProjection | null,
  producer: AcceptedHandoverSurfaceProducer,
): HandoverAcceptedSurfaceProjection {
  const story = projection?.handoverStory ?? null;
  const expected = projection === null || story === null
    ? null
    : {
      snapshotId: projection.snapshotId,
      sourceFrameId: projection.sourceFrameId,
      kind: story.kind,
      phase: acceptedHandoverStoryPhase(
        projection.phase,
        story.selectionStatus === 'committed',
      ),
      clockBasis: 'simulation-time' as const,
      producer,
      from: {
        satelliteId: story.source.satelliteId,
        beamId: String(story.source.beamId),
      },
      to: {
        satelliteId: story.target.satelliteId,
        beamId: String(story.target.beamId),
      },
    };
  const contractStatus = projection !== null && !storyMatchesRailRoot(projection)
    ? 'mismatch'
    : resolveAcceptedHandoverSurfaceStatus(binding, expected);
  return Object.freeze({ binding, contractStatus });
}
