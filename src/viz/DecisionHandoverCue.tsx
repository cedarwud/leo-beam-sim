import { Line, Text } from '@react-three/drei';
import * as THREE from 'three';

import type { AuthorityHandoverTransition } from '../scene/handoverAuthorityJoin';
import { cellIdFromLinkBudgetBeamId } from '../scene/sinrLiveCellModel';
import type { SinrLiveCellPlacement } from './SinrLiveCellBeamCones';

type CuePoint = readonly [number, number, number];

export interface DecisionHandoverCueGeometry {
  readonly fromCellId: number;
  readonly toCellId: number;
  readonly from: CuePoint;
  readonly to: CuePoint;
  readonly path: readonly CuePoint[];
}

export interface DecisionHandoverCueLabels {
  readonly kindLabel: string;
  readonly sourceLabel: string;
  readonly targetLabel: string;
}

/** Display-only copy of the already accepted pair; it never infers a transition kind. */
export function resolveDecisionHandoverCueLabels(
  transition: Pick<AuthorityHandoverTransition, 'kind' | 'from' | 'to'>,
): DecisionHandoverCueLabels {
  return Object.freeze({
    kindLabel: transition.kind === 'intra'
      ? 'INTRA · SAME SATELLITE'
      : 'INTER · SATELLITE CHANGE',
    sourceLabel: `SOURCE · ${transition.from.satelliteId} / B${transition.from.beamId}`,
    targetLabel: `TARGET · ${transition.to.satelliteId} / B${transition.to.beamId}`,
  });
}

export function resolveDecisionHandoverCueGeometry(
  transition: AuthorityHandoverTransition | null,
  placementByCellId: ReadonlyMap<number, SinrLiveCellPlacement>,
): DecisionHandoverCueGeometry | null {
  if (transition === null) return null;
  const fromCellId = cellIdFromLinkBudgetBeamId(transition.from.beamId);
  const toCellId = cellIdFromLinkBudgetBeamId(transition.to.beamId);
  const fromPlacement = placementByCellId.get(fromCellId);
  const toPlacement = placementByCellId.get(toCellId);
  if (fromPlacement === undefined || toPlacement === undefined) return null;

  const from: CuePoint = [fromPlacement.worldX, 0.55, fromPlacement.worldZ];
  const to: CuePoint = [toPlacement.worldX, 0.55, toPlacement.worldZ];
  const coincident = Math.hypot(to[0] - from[0], to[2] - from[2]) < 0.5;
  const midpoint: CuePoint = [
    (from[0] + to[0]) / 2 + (coincident ? 18 : 0),
    10,
    (from[2] + to[2]) / 2 + (coincident ? 6 : 0),
  ];
  return Object.freeze({
    fromCellId,
    toCellId,
    from,
    to,
    path: Object.freeze([from, midpoint, to]),
  });
}

const ENDPOINT_LABEL_OFFSET = 11;
const ENDPOINT_LABEL_LIFT = 8;
const KIND_LABEL_LIFT = 7;

function resolveCueDirection(geometry: DecisionHandoverCueGeometry): readonly [number, number] {
  let dx = geometry.to[0] - geometry.from[0];
  let dz = geometry.to[2] - geometry.from[2];
  let length = Math.hypot(dx, dz);
  if (length < 0.5) {
    dx = geometry.path[1][0] - geometry.from[0];
    dz = geometry.path[1][2] - geometry.from[2];
    length = Math.hypot(dx, dz);
  }
  return length < 0.5 ? [1, 0] : [dx / length, dz / length];
}

function endpointLabelPosition(
  endpoint: CuePoint,
  direction: readonly [number, number],
  side: -1 | 1,
): CuePoint {
  return [
    endpoint[0] + direction[0] * ENDPOINT_LABEL_OFFSET * side,
    endpoint[1] + ENDPOINT_LABEL_LIFT,
    endpoint[2] + direction[1] * ENDPOINT_LABEL_OFFSET * side,
  ];
}

export function DecisionHandoverCue({
  transition,
  placementByCellId,
  sourceColor,
  targetColor,
  progress01 = 0,
}: {
  readonly transition: AuthorityHandoverTransition | null;
  readonly placementByCellId: ReadonlyMap<number, SinrLiveCellPlacement>;
  readonly sourceColor: string;
  readonly targetColor: string;
  /** Presentation-clock progress; never feeds the decision authority. */
  readonly progress01?: number;
}) {
  const geometry = resolveDecisionHandoverCueGeometry(transition, placementByCellId);
  if (transition === null || geometry === null) return null;
  const committed = transition.boundary === 'committed';
  const progress = Math.max(0, Math.min(1, Number.isFinite(progress01) ? progress01 : 0));
  const sourceOpacity = Math.max(0.12, 0.72 * (1 - progress));
  const targetOpacity = 0.34 + 0.58 * progress;
  const sourceScale = 1 - 0.28 * progress;
  const targetScale = 0.72 + 0.42 * progress;
  const labels = resolveDecisionHandoverCueLabels(transition);
  const direction = resolveCueDirection(geometry);
  const sourceLabelPosition = endpointLabelPosition(geometry.from, direction, -1);
  const targetLabelPosition = endpointLabelPosition(geometry.to, direction, 1);
  const kindLabelPosition: CuePoint = [
    geometry.path[1][0],
    geometry.path[1][1] + KIND_LABEL_LIFT,
    geometry.path[1][2],
  ];
  const sourceLabelOpacity = Math.max(0.42, sourceOpacity);
  const targetLabelOpacity = Math.max(0.42, targetOpacity);

  return (
    <group
      name={`decision-handover-cue-${transition.eventId}`}
      userData={{
        eventId: transition.eventId,
        kind: transition.kind,
        boundary: transition.boundary,
        fromSatelliteId: transition.from.satelliteId,
        fromBeamId: transition.from.beamId,
        toSatelliteId: transition.to.satelliteId,
        toBeamId: transition.to.beamId,
        isDataLink: false,
      }}
    >
      <Line
        name="decision-handover-ground-transition-path"
        points={geometry.path}
        color={targetColor}
        lineWidth={2.2}
        transparent
        opacity={committed ? 0.72 : 0.58}
        dashed
        dashSize={5}
        gapSize={4}
        depthWrite={false}
        renderOrder={25}
        userData={{ isDataLink: false, transitionBoundary: transition.boundary }}
      />
      <Text
        name="decision-handover-kind-label"
        position={kindLabelPosition}
        fontSize={6.2}
        color={targetColor}
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.65}
        outlineColor="#000000"
        fillOpacity={Math.max(sourceLabelOpacity, targetLabelOpacity)}
        renderOrder={28}
      >
        {labels.kindLabel}
      </Text>
      <Text
        name="decision-handover-source-label"
        position={sourceLabelPosition}
        fontSize={5.2}
        color={sourceColor}
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.55}
        outlineColor="#000000"
        fillOpacity={sourceLabelOpacity}
        renderOrder={28}
      >
        {labels.sourceLabel}
      </Text>
      <Text
        name="decision-handover-target-label"
        position={targetLabelPosition}
        fontSize={5.2}
        color={targetColor}
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.55}
        outlineColor="#000000"
        fillOpacity={targetLabelOpacity}
        renderOrder={28}
      >
        {labels.targetLabel}
      </Text>
      <mesh
        name="decision-handover-source-boundary"
        position={geometry.from}
        rotation={[-Math.PI / 2, 0, 0]}
        scale={[sourceScale, sourceScale, 1]}
        renderOrder={26}
      >
        <ringGeometry args={[5.4, 7.2, 40]} />
        <meshBasicMaterial
          color={sourceColor}
          transparent
          opacity={sourceOpacity}
          side={THREE.DoubleSide}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
      <mesh
        name="decision-handover-target-boundary"
        position={geometry.to}
        rotation={[-Math.PI / 2, 0, 0]}
        scale={[targetScale, targetScale, 1]}
        renderOrder={27}
      >
        <ringGeometry args={[5.4, committed ? 9.2 : 7.2, 40]} />
        <meshBasicMaterial
          color={targetColor}
          transparent
          opacity={targetOpacity}
          side={THREE.DoubleSide}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}
