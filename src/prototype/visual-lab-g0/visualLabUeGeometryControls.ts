import {
  degreesFromRadians,
  offAxisAngleRadForVisualLabUe,
  positionForVisualLabUeOffAxisAngle,
  type VisualLabUeAnglePositionRequest,
} from './visualLabUeGeometry';

export interface VisualLabUeGeometryControlsInput {
  readonly satelliteDistanceKm: number;
  readonly satelliteElevationDeg: number;
  readonly beamCenterKm: readonly [number, number];
  readonly acceptedPositionKm: readonly [number, number];
  readonly maxRadiusKm: number;
  readonly worldUnitsPerKm: number;
  readonly selectedUeWorldPosition: { readonly x: number; readonly z: number } | null;
}

export interface VisualLabUeGeometryDerived {
  readonly scale: number;
  readonly angleInput: VisualLabUeAnglePositionRequest;
  readonly acceptedAngleDeg: number;
  readonly draftAngleDeg: number;
  readonly maxAngleDeg: number;
  readonly hasDraft: boolean;
}

/** Derive slider values and its inverse request without React or scene state. */
export function deriveVisualLabUeGeometryControls(
  input: VisualLabUeGeometryControlsInput,
): VisualLabUeGeometryDerived | null {
  if (
    !Number.isFinite(input.satelliteDistanceKm)
    || !Number.isFinite(input.satelliteElevationDeg)
    || !Number.isFinite(input.maxRadiusKm)
    || input.maxRadiusKm <= 0
    || !Number.isFinite(input.worldUnitsPerKm)
    || input.worldUnitsPerKm <= 0
  ) return null;

  const acceptedPositionKm = input.acceptedPositionKm;
  const draftPositionKm: readonly [number, number] = input.selectedUeWorldPosition === null
    ? acceptedPositionKm
    : [
        input.selectedUeWorldPosition.x / input.worldUnitsPerKm,
        -input.selectedUeWorldPosition.z / input.worldUnitsPerKm,
      ];
  const directionVector = [
    acceptedPositionKm[0] - input.beamCenterKm[0],
    acceptedPositionKm[1] - input.beamCenterKm[1],
  ] as const;
  const directionLength = Math.hypot(directionVector[0], directionVector[1]);
  const direction = directionLength > 1e-12
    ? [directionVector[0] / directionLength, directionVector[1] / directionLength] as const
    : undefined;
  const angleInput: VisualLabUeAnglePositionRequest = {
    satelliteDistanceKm: input.satelliteDistanceKm,
    satelliteElevationDeg: input.satelliteElevationDeg,
    beamCenterKm: input.beamCenterKm,
    userPositionKm: draftPositionKm,
    maxRadiusKm: input.maxRadiusKm,
    direction,
  };
  const acceptedAngleRad = offAxisAngleRadForVisualLabUe({
    satelliteDistanceKm: input.satelliteDistanceKm,
    satelliteElevationDeg: input.satelliteElevationDeg,
    beamCenterKm: input.beamCenterKm,
    userPositionKm: acceptedPositionKm,
  });
  const draftAngleRad = offAxisAngleRadForVisualLabUe(angleInput);
  const maxPositionKm = positionForVisualLabUeOffAxisAngle(angleInput, Math.PI);
  const maxAngleRad = offAxisAngleRadForVisualLabUe({
    satelliteDistanceKm: input.satelliteDistanceKm,
    satelliteElevationDeg: input.satelliteElevationDeg,
    beamCenterKm: input.beamCenterKm,
    userPositionKm: maxPositionKm,
  });
  return Object.freeze({
    scale: input.worldUnitsPerKm,
    angleInput,
    acceptedAngleDeg: degreesFromRadians(acceptedAngleRad),
    draftAngleDeg: degreesFromRadians(draftAngleRad),
    maxAngleDeg: Math.max(degreesFromRadians(maxAngleRad), .01),
    hasDraft: input.selectedUeWorldPosition !== null,
  });
}
