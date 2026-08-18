import type { VisualLabDensity } from './VisualLabScene';

/**
 * Scene assets remain solid; information density controls overlays, labels,
 * satellites and UE counts rather than fading the physical NTPU substrate.
 */
export function substrateOpacityForDensity(_density: VisualLabDensity): number {
  return 1;
}
