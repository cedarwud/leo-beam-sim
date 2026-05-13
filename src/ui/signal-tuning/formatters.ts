export function formatWithUnit(value: number, unit: string, digits = 1): string {
  return `${value.toFixed(digits)} ${unit}`;
}
export function formatDbm(value: number): string {
  if (!Number.isFinite(value)) return '—';
  return `${value.toFixed(1)} dBm`;
}

export function formatDbi(value: number): string {
  if (!Number.isFinite(value)) return '—';
  return `${value.toFixed(1)} dBi`;
}
