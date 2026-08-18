export type VisualLabUePoint = Readonly<{ x: number; z: number }>;
export type VisualLabUeNudgeDirection = 'left' | 'right' | 'up' | 'down';

function finite(value: number): number {
  return Number.isFinite(value) ? value : 0;
}

/**
 * Keyboard counterpart to the scene's drag interaction.  The draft remains
 * inside the same accepted representative cell and is not published until
 * the existing apply-and-recalculate action is used.
 */
export function nudgeVisualLabUe(
  current: VisualLabUePoint,
  center: VisualLabUePoint,
  radius: number,
  direction: VisualLabUeNudgeDirection,
  step = 0.12,
): VisualLabUePoint {
  const safeRadius = Math.max(0, finite(radius));
  const safeStep = Math.max(0, finite(step));
  const delta = direction === 'left'
    ? { x: -safeStep, z: 0 }
    : direction === 'right'
      ? { x: safeStep, z: 0 }
      : direction === 'up'
        ? { x: 0, z: -safeStep }
        : { x: 0, z: safeStep };
  const candidate = {
    x: finite(current.x) + delta.x,
    z: finite(current.z) + delta.z,
  };
  const dx = candidate.x - finite(center.x);
  const dz = candidate.z - finite(center.z);
  const distance = Math.hypot(dx, dz);
  if (distance <= safeRadius || distance === 0) return Object.freeze(candidate);
  const scale = safeRadius / distance;
  return Object.freeze({
    x: finite(center.x) + dx * scale,
    z: finite(center.z) + dz * scale,
  });
}

export function visualLabUeDirectionForKey(
  key: string,
): VisualLabUeNudgeDirection | null {
  if (key === 'ArrowLeft') return 'left';
  if (key === 'ArrowRight') return 'right';
  if (key === 'ArrowUp') return 'up';
  if (key === 'ArrowDown') return 'down';
  return null;
}
