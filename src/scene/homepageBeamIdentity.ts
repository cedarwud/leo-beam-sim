import { type HomepageBeamIdentity } from '../homepage/controller/homepageBeamVisibility';

function homepageBeamIdentityFromCell(
  satelliteId: string | null | undefined,
  cellId: number | null | undefined,
  beamId: number | null | undefined = null,
): HomepageBeamIdentity | null {
  if (
    typeof satelliteId !== 'string'
    || satelliteId.trim().length === 0
    || cellId === null
    || cellId === undefined
    || !Number.isInteger(cellId)
  ) return null;
  return { satelliteId, cellId, beamId };
}

export { homepageBeamIdentityFromCell };
