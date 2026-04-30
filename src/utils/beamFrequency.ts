export function normalizeFrequencyReuse(frequencyReuse: number): number {
  if (!Number.isFinite(frequencyReuse)) return 1;
  return Math.max(1, Math.floor(frequencyReuse));
}

export function getBeamFrequencyIndex(beamId: number, frequencyReuse: number): number {
  const groups = normalizeFrequencyReuse(frequencyReuse);
  const normalizedBeamId = Math.max(1, Math.floor(beamId));
  return (normalizedBeamId - 1) % groups;
}

export function formatFrequencyLabel(frequencyIndex: number): string {
  return `F${Math.max(0, Math.floor(frequencyIndex)) + 1}`;
}

export function formatBeamIdentityLabel(frequencyIndex: number, beamId: number): string {
  return `${formatFrequencyLabel(frequencyIndex)} B${Math.max(1, Math.floor(beamId))}`;
}
