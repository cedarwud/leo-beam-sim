import type { SceneLane } from '../app/sceneLane';
import type { CellAssignment } from '../engine/cells/cellScheduler';
import type { NormalizedSceneFrame } from './NormalizedSceneFrame';
import type {
  CellReassignment,
  CellScheduleViz,
  CellWorldPlacement,
} from './useCellSchedule';

export type HandoverStorySource =
  | 'sinr-live'
  | 'profile-derived-demo'
  | 'modqn-replay-proof'
  | 'artifact-owned'
  | 'source-gap';

export type HandoverStoryEventKind = 'intra' | 'inter';

export interface HandoverStoryWorldPoint {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface HandoverStoryGroundPoint {
  readonly x: number;
  readonly z: number;
}

export interface HandoverStoryEndpoint {
  readonly satId: string;
  readonly beamIndex: number;
  readonly label: string;
  readonly satelliteWorld?: HandoverStoryWorldPoint;
}

export interface HandoverStoryEvent {
  readonly kind: HandoverStoryEventKind;
  readonly cellId: number;
  readonly source: HandoverStoryEndpoint;
  readonly target: HandoverStoryEndpoint;
  readonly ground: HandoverStoryGroundPoint;
  readonly radiusWorld: number;
}

export interface HandoverStoryBeamSlot {
  readonly cellId: number;
  readonly satId: string | null;
  readonly beamIndex: number | null;
  readonly ground: HandoverStoryGroundPoint;
  readonly radiusWorld: number;
}

export interface HandoverStoryFocus {
  readonly ueId: string | null;
  readonly ueWorld?: HandoverStoryWorldPoint;
  readonly cellId: number | null;
}

export interface HandoverStoryModel {
  readonly lane: SceneLane;
  readonly source: HandoverStorySource;
  readonly label: string;
  readonly notBaselineProof: boolean;
  readonly focus: HandoverStoryFocus;
  readonly events: readonly HandoverStoryEvent[];
  readonly aggregateEventCount: number;
  readonly activeSlots: readonly HandoverStoryBeamSlot[];
  readonly inactiveSlots: readonly HandoverStoryBeamSlot[];
  readonly nextSlots: readonly HandoverStoryBeamSlot[];
  readonly sourceGaps: readonly string[];
}

export interface DeriveProfileHandoverStoryModelInput {
  readonly sceneLane: SceneLane;
  readonly sceneFrame: NormalizedSceneFrame;
  readonly schedule: CellScheduleViz;
  readonly satelliteWorldById: ReadonlyMap<string, HandoverStoryWorldPoint>;
}

function beamIdentityLabel(satId: string, beamIndex: number): string {
  return `${satId} B${beamIndex + 1}`;
}

function pointFromTuple(tuple: readonly [number, number, number] | undefined): HandoverStoryWorldPoint | undefined {
  return tuple === undefined ? undefined : { x: tuple[0], y: tuple[1], z: tuple[2] };
}

function slotFromAssignment(
  assignment: CellAssignment,
  placement: CellWorldPlacement,
): HandoverStoryBeamSlot {
  return {
    cellId: placement.cellId,
    satId: assignment.satId,
    beamIndex: assignment.beamIndex,
    ground: { x: placement.worldX, z: placement.worldZ },
    radiusWorld: placement.radiusWorld,
  };
}

function inactiveSlot(placement: CellWorldPlacement): HandoverStoryBeamSlot {
  return {
    cellId: placement.cellId,
    satId: null,
    beamIndex: null,
    ground: { x: placement.worldX, z: placement.worldZ },
    radiusWorld: placement.radiusWorld,
  };
}

function distanceSqToFocus(
  reassignment: CellReassignment,
  focusWorld: HandoverStoryWorldPoint | undefined,
): number {
  if (focusWorld === undefined) return 0;
  const dx = reassignment.worldX - focusWorld.x;
  const dz = reassignment.worldZ - focusWorld.z;
  return dx * dx + dz * dz;
}

function eventFromReassignment(
  reassignment: CellReassignment,
  placement: CellWorldPlacement,
  satelliteWorldById: ReadonlyMap<string, HandoverStoryWorldPoint>,
): HandoverStoryEvent {
  return {
    kind: reassignment.kind,
    cellId: reassignment.cellId,
    source: {
      satId: reassignment.fromSatId,
      beamIndex: reassignment.fromBeamIndex,
      label: beamIdentityLabel(reassignment.fromSatId, reassignment.fromBeamIndex),
      satelliteWorld: satelliteWorldById.get(reassignment.fromSatId),
    },
    target: {
      satId: reassignment.toSatId,
      beamIndex: reassignment.toBeamIndex,
      label: beamIdentityLabel(reassignment.toSatId, reassignment.toBeamIndex),
      satelliteWorld: satelliteWorldById.get(reassignment.toSatId),
    },
    ground: { x: placement.worldX, z: placement.worldZ },
    radiusWorld: placement.radiusWorld,
  };
}

export function deriveProfileHandoverStoryModel({
  sceneLane,
  sceneFrame,
  schedule,
  satelliteWorldById,
}: DeriveProfileHandoverStoryModelInput): HandoverStoryModel {
  const primaryUe = sceneFrame.ues[0];
  const focusWorld = pointFromTuple(primaryUe?.worldPos);
  const placementByCellId = new Map(schedule.placements.map(placement => [placement.cellId, placement]));
  const activeSlots = schedule.slot.assignments.flatMap(assignment => {
    const placement = placementByCellId.get(assignment.cellId);
    return placement === undefined ? [] : [slotFromAssignment(assignment, placement)];
  });
  const inactiveSlots = schedule.placements
    .filter(placement => !schedule.assignmentByCellId.has(placement.cellId))
    .map(inactiveSlot);
  const nextSlots = schedule.nextSlot.assignments.flatMap(assignment => {
    const current = schedule.assignmentByCellId.get(assignment.cellId);
    const isNewOrChanged = current === undefined
      || current.satId !== assignment.satId
      || current.beamIndex !== assignment.beamIndex;
    if (!isNewOrChanged) return [];
    const placement = placementByCellId.get(assignment.cellId);
    return placement === undefined ? [] : [slotFromAssignment(assignment, placement)];
  });

  const sortedReassignments = [...schedule.cellReassignments]
    .sort((a, b) => (
      distanceSqToFocus(a, focusWorld) - distanceSqToFocus(b, focusWorld)
      || a.cellId - b.cellId
    ));
  const focusedReassignment = sortedReassignments[0];
  const events = focusedReassignment === undefined
    ? []
    : [eventFromReassignment(
      focusedReassignment,
      placementByCellId.get(focusedReassignment.cellId) ?? {
        cellId: focusedReassignment.cellId,
        center: { cellId: focusedReassignment.cellId, latDeg: 0, lonDeg: 0, localXKm: 0, localYKm: 0 },
        worldX: focusedReassignment.worldX,
        worldZ: focusedReassignment.worldZ,
        radiusWorld: 1,
      },
      satelliteWorldById,
    )];

  return {
    lane: sceneLane,
    source: 'profile-derived-demo',
    label: 'profile-derived handover story',
    notBaselineProof: true,
    focus: {
      ueId: primaryUe?.id ?? null,
      ueWorld: focusWorld,
      cellId: events[0]?.cellId ?? null,
    },
    events,
    aggregateEventCount: Math.max(0, sortedReassignments.length - events.length),
    activeSlots,
    inactiveSlots,
    nextSlots,
    sourceGaps: [],
  };
}

export function replayProofBeamHoppingSourceGap(): string {
  return 'beam-hopping-schedule';
}
