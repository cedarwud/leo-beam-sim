import { Line } from '@react-three/drei';
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
