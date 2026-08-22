import { type ReactElement } from 'react';

/**
 * Display-only substrate for the classroom surface.
 *
 * The prototype's visual language is a dark, low-contrast grid that gives the
 * beam footprint room to read. The actual serving/candidate hexagons remain
 * owned by SinrLiveCellFootprintRings; this component must not draw a second
 * cell layout with guessed centres or radii.
 */

const TEACHING_GRID_SIZE_WORLD = 1600;
const TEACHING_GRID_DIVISIONS = 32;

export function TeachingFloor(): ReactElement {
  return (
    <group name="teaching-floor">
      <mesh name="teaching-floor-surface" position={[0, -8, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[TEACHING_GRID_SIZE_WORLD, TEACHING_GRID_SIZE_WORLD]} />
        <meshBasicMaterial color="#020b0d" transparent opacity={0.54} />
      </mesh>
      <gridHelper
        name="teaching-floor-grid"
        args={[TEACHING_GRID_SIZE_WORLD, TEACHING_GRID_DIVISIONS, '#1d4b45', '#102b28']}
        position={[0, -3.5, 0]}
      />
    </group>
  );
}
