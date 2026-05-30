import { useMemo, useRef } from 'react';
import type { JSX } from 'react';
import { Line, Text } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import {
  HANDOVER_SOURCE_COLOR,
  HANDOVER_TARGET_COLOR,
} from '../constants/beamRoleTokens';
import type {
  HandoverStoryBeamSlot,
  HandoverStoryEvent,
  HandoverStoryModel,
  HandoverStoryWorldPoint,
} from '../scene/handoverStoryModel';

interface HandoverStoryLayerProps {
  readonly model: HandoverStoryModel | null;
  readonly satelliteTintById: ReadonlyMap<string, string>;
  readonly visible?: boolean;
}

const ACTIVE_FALLBACK = '#facc15';
const INACTIVE_COLOR = '#94a3b8';
const NEXT_SLOT_COLOR = '#fbbf24';
const INTER_RIBBON_COLOR = '#a855f7';
const UE_CUE_COLOR = '#ffffff';
const STORY_Y = 3.4;

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function hexPoints(radius: number, y = 0): [number, number, number][] {
  return Array.from({ length: 7 }, (_, index) => {
    const angle = (index / 6) * Math.PI * 2 - Math.PI / 2;
    return [Math.cos(angle) * radius, y, Math.sin(angle) * radius];
  });
}

function ringMesh(
  innerRadius: number,
  outerRadius: number,
  color: string,
  opacity: number,
  renderOrder: number,
): JSX.Element {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} renderOrder={renderOrder}>
      <ringGeometry args={[innerRadius, outerRadius, 72]} />
      <meshBasicMaterial
        color={color}
        transparent
        opacity={opacity}
        depthWrite={false}
        depthTest={false}
        blending={THREE.AdditiveBlending}
        toneMapped={false}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

function BeamSlotRing({
  slot,
  color,
  kind,
}: {
  readonly slot: HandoverStoryBeamSlot;
  readonly color: string;
  readonly kind: 'active' | 'inactive' | 'next';
}) {
  const points = hexPoints(slot.radiusWorld * (kind === 'next' ? 1.12 : 1));
  const opacity = kind === 'active' ? 0.9 : kind === 'next' ? 0.68 : 0.2;
  const lineWidth = kind === 'active' ? 3.2 : kind === 'next' ? 2.2 : 1.2;

  return (
    <group
      position={[slot.ground.x, STORY_Y, slot.ground.z]}
      userData={{
        cellId: slot.cellId,
        satId: slot.satId,
        beamIndex: slot.beamIndex,
        slotKind: kind,
      }}
    >
      <Line
        points={points}
        color={color}
        lineWidth={lineWidth}
        transparent
        opacity={opacity}
        dashed={kind === 'next'}
        dashSize={6}
        gapSize={4}
        depthWrite={false}
        renderOrder={kind === 'active' ? 36 : kind === 'next' ? 35 : 30}
      />
    </group>
  );
}

function buildGroundArcPoints(event: HandoverStoryEvent): [number, number, number][] {
  const radius = Math.max(event.radiusWorld, 8);
  const from = new THREE.Vector3(event.ground.x - radius * 0.62, STORY_Y + 2, event.ground.z);
  const to = new THREE.Vector3(event.ground.x + radius * 0.62, STORY_Y + 2, event.ground.z);
  const mid = new THREE.Vector3(event.ground.x, STORY_Y + radius * 0.58, event.ground.z);
  const curve = new THREE.QuadraticBezierCurve3(from, mid, to);
  return Array.from({ length: 34 }, (_, index) => {
    const p = curve.getPoint(index / 33);
    return [p.x, p.y, p.z];
  });
}

function buildSkyCurve(source: HandoverStoryWorldPoint, target: HandoverStoryWorldPoint): THREE.QuadraticBezierCurve3 {
  const from = new THREE.Vector3(source.x, source.y, source.z);
  const to = new THREE.Vector3(target.x, target.y, target.z);
  const mid = from.clone().lerp(to, 0.5);
  mid.y += Math.max(40, from.distanceTo(to) * 0.28);
  return new THREE.QuadraticBezierCurve3(from, mid, to);
}

function PulseDot({
  curve,
  color,
  radius,
  renderOrder,
}: {
  readonly curve: THREE.Curve<THREE.Vector3>;
  readonly color: string;
  readonly radius: number;
  readonly renderOrder: number;
}) {
  const ref = useRef<THREE.Mesh | null>(null);

  useFrame(({ clock }) => {
    const mesh = ref.current;
    if (!mesh) return;
    const t = clamp01((Math.sin(clock.getElapsedTime() * 2.8) + 1) / 2);
    const point = curve.getPoint(t);
    mesh.position.set(point.x, point.y, point.z);
    mesh.scale.setScalar(0.82 + t * 0.28);
  });

  return (
    <mesh ref={ref} renderOrder={renderOrder} frustumCulled={false}>
      <sphereGeometry args={[radius, 18, 12]} />
      <meshBasicMaterial
        color={color}
        transparent
        opacity={0.92}
        depthWrite={false}
        depthTest={false}
        blending={THREE.AdditiveBlending}
        toneMapped={false}
      />
    </mesh>
  );
}

function IntraStoryEvent({ event }: { readonly event: HandoverStoryEvent }) {
  const arcPoints = useMemo(() => buildGroundArcPoints(event), [event]);
  const pulseCurve = useMemo(() => {
    const points = arcPoints.map(point => new THREE.Vector3(...point));
    return new THREE.CatmullRomCurve3(points);
  }, [arcPoints]);
  const sourceOuter = event.radiusWorld * 0.9;
  const targetOuter = event.radiusWorld * 1.14;

  return (
    <group
      name="handover-story-intra"
      userData={{
        cellId: event.cellId,
        source: event.source.label,
        target: event.target.label,
      }}
    >
      <group position={[event.ground.x, STORY_Y + 0.6, event.ground.z]}>
        {ringMesh(sourceOuter, sourceOuter + 3.2, HANDOVER_SOURCE_COLOR, 0.78, 45)}
        {ringMesh(targetOuter, targetOuter + 4.8, HANDOVER_TARGET_COLOR, 0.9, 46)}
      </group>
      <Line
        points={arcPoints}
        color={HANDOVER_TARGET_COLOR}
        lineWidth={4.8}
        transparent
        opacity={0.95}
        depthWrite={false}
        renderOrder={47}
      />
      <PulseDot curve={pulseCurve} color="#ffffff" radius={3.2} renderOrder={49} />
      <Text
        position={[event.ground.x, STORY_Y + event.radiusWorld * 1.05, event.ground.z]}
        fontSize={8.5}
        color="#fff7ed"
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.42}
        outlineColor="#020617"
      >
        {`${event.source.label} -> ${event.target.label}`}
      </Text>
    </group>
  );
}

function InterStoryEvent({
  event,
  ueWorld,
}: {
  readonly event: HandoverStoryEvent;
  readonly ueWorld?: HandoverStoryWorldPoint;
}) {
  const sourceSat = event.source.satelliteWorld;
  const targetSat = event.target.satelliteWorld;
  const skyCurve = useMemo(
    () => sourceSat && targetSat ? buildSkyCurve(sourceSat, targetSat) : null,
    [sourceSat, targetSat],
  );
  const skyPoints = useMemo(
    () => skyCurve === null
      ? []
      : Array.from({ length: 52 }, (_, index) => {
        const p = skyCurve.getPoint(index / 51);
        return [p.x, p.y, p.z] as [number, number, number];
      }),
    [skyCurve],
  );
  const targetGround: [number, number, number] = [event.ground.x, STORY_Y + 3, event.ground.z];
  const targetSatPoint: [number, number, number] | null = targetSat
    ? [targetSat.x, targetSat.y, targetSat.z]
    : null;

  return (
    <group
      name="handover-story-inter"
      userData={{
        cellId: event.cellId,
        source: event.source.label,
        target: event.target.label,
      }}
    >
      <group position={[event.ground.x, STORY_Y + 0.8, event.ground.z]}>
        {ringMesh(event.radiusWorld * 1.02, event.radiusWorld * 1.12, INTER_RIBBON_COLOR, 0.78, 45)}
      </group>
      {skyCurve !== null && skyPoints.length > 0 ? (
        <>
          <Line
            points={skyPoints}
            color={INTER_RIBBON_COLOR}
            lineWidth={5.4}
            transparent
            opacity={0.82}
            depthWrite={false}
            renderOrder={48}
          />
          <PulseDot curve={skyCurve} color="#ffffff" radius={3.4} renderOrder={50} />
        </>
      ) : null}
      {targetSatPoint ? (
        <Line
          points={[targetSatPoint, targetGround]}
          color={HANDOVER_TARGET_COLOR}
          lineWidth={3.4}
          transparent
          opacity={0.72}
          depthWrite={false}
          renderOrder={46}
        />
      ) : null}
      {ueWorld ? (
        <Line
          points={[[ueWorld.x, STORY_Y + 6, ueWorld.z], targetGround]}
          color={UE_CUE_COLOR}
          lineWidth={2.2}
          transparent
          opacity={0.58}
          dashed
          dashSize={7}
          gapSize={5}
          depthWrite={false}
          renderOrder={44}
        />
      ) : null}
      <Text
        position={[event.ground.x, STORY_Y + event.radiusWorld * 1.18, event.ground.z]}
        fontSize={8.5}
        color="#f5e8ff"
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.42}
        outlineColor="#020617"
      >
        {`${event.source.label} -> ${event.target.label}`}
      </Text>
    </group>
  );
}

export function HandoverStoryLayer({
  model,
  satelliteTintById,
  visible = true,
}: HandoverStoryLayerProps): JSX.Element | null {
  if (!visible || model === null) return null;
  const event = model.events[0];

  return (
    <group
      name="handover-story-layer"
      userData={{
        lane: model.lane,
        source: model.source,
        activeCount: model.activeSlots.length,
        inactiveCount: model.inactiveSlots.length,
        nextCount: model.nextSlots.length,
        eventCount: model.events.length,
        aggregateEventCount: model.aggregateEventCount,
        notBaselineProof: model.notBaselineProof,
      }}
    >
      {model.inactiveSlots.map(slot => (
        <BeamSlotRing
          key={`inactive-${slot.cellId}`}
          slot={slot}
          color={INACTIVE_COLOR}
          kind="inactive"
        />
      ))}
      {model.nextSlots.map(slot => (
        <BeamSlotRing
          key={`next-${slot.cellId}-${slot.satId}-${slot.beamIndex}`}
          slot={slot}
          color={NEXT_SLOT_COLOR}
          kind="next"
        />
      ))}
      {model.activeSlots.map(slot => (
        <BeamSlotRing
          key={`active-${slot.cellId}-${slot.satId}-${slot.beamIndex}`}
          slot={slot}
          color={slot.satId ? satelliteTintById.get(slot.satId) ?? ACTIVE_FALLBACK : ACTIVE_FALLBACK}
          kind="active"
        />
      ))}
      {event?.kind === 'intra' ? <IntraStoryEvent event={event} /> : null}
      {event?.kind === 'inter' ? (
        <InterStoryEvent event={event} ueWorld={model.focus.ueWorld} />
      ) : null}
    </group>
  );
}
