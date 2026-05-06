import { formatBeamIdentityLabel, getBeamFrequencyIndex } from './beamFrequency';

function shellCodeFromShellId(shellId: string): string {
  const trailingDegrees = shellId.match(/(\d{2,3})$/)?.[1];

  if (shellId.includes('polar')) {
    return `P${trailingDegrees ?? '90'}`;
  }

  if (shellId.includes('retro')) {
    return `R${trailingDegrees ?? '000'}`;
  }

  if (shellId.includes('pro')) {
    return `G${trailingDegrees ?? '000'}`;
  }

  return shellId.replace(/^shell-/, '').toUpperCase();
}

export function formatSatelliteLabel(rawId: string | null): string {
  if (!rawId) return '—';

  const match = rawId.match(/^(.*)-P(\d+)-S(\d+)$/);
  if (!match) return rawId;

  const [, shellId, planeIndexRaw, satIndexRaw] = match;
  const shellCode = shellCodeFromShellId(shellId);
  const planeNumber = String(Number(planeIndexRaw) + 1).padStart(2, '0');
  const satNumber = String(Number(satIndexRaw) + 1).padStart(2, '0');

  return `${shellCode}-${planeNumber}-${satNumber}`;
}

export function formatBeamLabel(beamId: number | null): string {
  if (beamId === null) return '—';
  return `Beam ${beamId}`;
}

export function formatBeamIdentityByIndex({
  satId,
  beamId,
  frequencyIndex,
}: {
  satId: string | null;
  beamId: number;
  frequencyIndex: number;
}): string {
  return `${formatSatelliteLabel(satId)} · ${formatBeamIdentityLabel(frequencyIndex, beamId)}`;
}

export function formatBeamIdentity({
  satId,
  beamId,
  frequencyReuse,
}: {
  satId: string | null;
  beamId: number;
  frequencyReuse: number;
}): string {
  return formatBeamIdentityByIndex({
    satId,
    beamId,
    frequencyIndex: getBeamFrequencyIndex(beamId, frequencyReuse),
  });
}

export function formatHandoverReason(rawReason: string, frequencyReuse?: number): string {
  if (!rawReason) return rawReason;

  return rawReason.replace(
    /([A-Za-z0-9-]+-P\d+-S\d+)(?:\s+B(\d+))?/g,
    (_match, satId: string, beamId?: string) => {
      const satelliteLabel = formatSatelliteLabel(satId);
      if (beamId === undefined) return satelliteLabel;
      if (frequencyReuse !== undefined) {
        return formatBeamIdentity({ satId, beamId: Number(beamId), frequencyReuse });
      }
      return `${satelliteLabel} ${formatBeamLabel(Number(beamId))}`;
    },
  );
}
