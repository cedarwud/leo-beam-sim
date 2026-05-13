export function normalizeFrequencyReuse(frequencyReuse: number): number {
  if (!Number.isFinite(frequencyReuse)) return 1;
  return Math.max(1, Math.floor(frequencyReuse));
}

export type MetadataBackedFrequencyIndexSource =
  | 'core-layout'
  | 'runtime-frequency-reuse-compatibility';

export type BeamFrequencyIndexSource =
  | MetadataBackedFrequencyIndexSource
  | 'fallback-numeric-modulo';

export interface BeamFrequencyIndexResolution {
  frequencyIndex: number;
  frequencyIndexSource: BeamFrequencyIndexSource;
  reuseGroup?: number;
  reuseGroupSource?: MetadataBackedFrequencyIndexSource;
  runtimeFrequencyReuse?: number;
  coreLayoutFrequencyReuse?: number;
}

interface BeamFrequencyIndexInput {
  beamId: number;
  frequencyReuse: number;
  reuseGroup?: number | null;
  reuseGroupSource?: MetadataBackedFrequencyIndexSource | null;
  runtimeFrequencyReuse?: number | null;
  coreLayoutFrequencyReuse?: number | null;
}

function normalizeFrequencyIndex(frequencyIndex: number): number {
  if (!Number.isFinite(frequencyIndex)) return 0;
  return Math.max(0, Math.floor(frequencyIndex));
}

function isMetadataBackedFrequencyIndexSource(
  source: string | null | undefined,
): source is MetadataBackedFrequencyIndexSource {
  return source === 'core-layout' || source === 'runtime-frequency-reuse-compatibility';
}

function inferMetadataBackedFrequencyIndexSource(
  frequencyReuse: number,
): MetadataBackedFrequencyIndexSource {
  const normalizedFrequencyReuse = normalizeFrequencyReuse(frequencyReuse);
  return normalizedFrequencyReuse === 1
    || normalizedFrequencyReuse === 3
    || normalizedFrequencyReuse === 7
    ? 'core-layout'
    : 'runtime-frequency-reuse-compatibility';
}

export function getBeamFrequencyIndex(beamId: number, frequencyReuse: number): number {
  const groups = normalizeFrequencyReuse(frequencyReuse);
  const normalizedBeamId = Math.max(1, Math.floor(beamId));
  return (normalizedBeamId - 1) % groups;
}

export function resolveBeamFrequencyIndex(
  input: BeamFrequencyIndexInput,
): BeamFrequencyIndexResolution {
  if (input.reuseGroup !== null && input.reuseGroup !== undefined && Number.isFinite(input.reuseGroup)) {
    const reuseGroupSource = isMetadataBackedFrequencyIndexSource(input.reuseGroupSource)
      ? input.reuseGroupSource
      : inferMetadataBackedFrequencyIndexSource(input.frequencyReuse);

    return {
      frequencyIndex: normalizeFrequencyIndex(input.reuseGroup),
      frequencyIndexSource: reuseGroupSource,
      reuseGroup: normalizeFrequencyIndex(input.reuseGroup),
      reuseGroupSource,
      ...(Number.isFinite(input.runtimeFrequencyReuse)
        ? { runtimeFrequencyReuse: normalizeFrequencyReuse(input.runtimeFrequencyReuse as number) }
        : {}),
      ...(Number.isFinite(input.coreLayoutFrequencyReuse)
        ? { coreLayoutFrequencyReuse: normalizeFrequencyReuse(input.coreLayoutFrequencyReuse as number) }
        : {}),
    };
  }

  return {
    frequencyIndex: getBeamFrequencyIndex(input.beamId, input.frequencyReuse),
    frequencyIndexSource: 'fallback-numeric-modulo',
  };
}

export function formatFrequencyLabel(frequencyIndex: number): string {
  return `F${Math.max(0, Math.floor(frequencyIndex)) + 1}`;
}

export function formatBeamIdentityLabel(frequencyIndex: number, beamId: number): string {
  return `${formatFrequencyLabel(frequencyIndex)} B${Math.max(1, Math.floor(beamId))}`;
}
