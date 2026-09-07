import {
  degreesFromRadians,
  offAxisAngleRadForVisualLabUe,
  positionForVisualLabUeOffAxisAngle,
  type VisualLabGroundPositionKm,
  type VisualLabUeAnglePositionRequest,
} from '../prototype/visual-lab-g0/visualLabUeGeometry';

export interface WalkerVisualLabUeGeometryInput {
  readonly link: {
    readonly satelliteDistanceKm: number;
    readonly satelliteElevationDeg: number;
  };
  readonly geometry: {
    readonly beamCenterKm: VisualLabGroundPositionKm;
    readonly acceptedPositionKm: VisualLabGroundPositionKm;
    readonly cellRadiusKm: number;
    readonly worldUnitsPerKm: number;
  };
  readonly representativeUserIndex: number;
  readonly selectedUeWorldPosition: Readonly<{ x: number; z: number }> | null;
}

export interface WalkerVisualLabUeGeometryResult {
  readonly scale: number;
  readonly representativeUserIndex: number;
  readonly angleInput: VisualLabUeAnglePositionRequest;
  readonly acceptedAngleDeg: number;
  readonly draftAngleDeg: number;
  readonly maxAngleDeg: number;
  readonly hasDraft: boolean;
}

export function deriveWalkerVisualLabUeGeometry(
  input: WalkerVisualLabUeGeometryInput,
): WalkerVisualLabUeGeometryResult {
  const scale = input.geometry.worldUnitsPerKm;
  const acceptedPositionKm = input.geometry.acceptedPositionKm;
  const draftPositionKm: VisualLabGroundPositionKm = input.selectedUeWorldPosition === null
    ? acceptedPositionKm
    : [
        input.selectedUeWorldPosition.x / scale,
        -input.selectedUeWorldPosition.z / scale,
      ];
  const beamCenterKm = input.geometry.beamCenterKm;
  const maxRadiusKm = input.geometry.cellRadiusKm * .96;
  const directionVector = [
    acceptedPositionKm[0] - beamCenterKm[0],
    acceptedPositionKm[1] - beamCenterKm[1],
  ] as const;
  const directionLength = Math.hypot(directionVector[0], directionVector[1]);
  const direction = directionLength > 1e-12
    ? [directionVector[0] / directionLength, directionVector[1] / directionLength] as const
    : undefined;
  const angleInput: VisualLabUeAnglePositionRequest = {
    satelliteDistanceKm: input.link.satelliteDistanceKm,
    satelliteElevationDeg: input.link.satelliteElevationDeg,
    beamCenterKm,
    userPositionKm: draftPositionKm,
    maxRadiusKm,
    direction,
  };
  const acceptedAngleRad = offAxisAngleRadForVisualLabUe({
    satelliteDistanceKm: angleInput.satelliteDistanceKm,
    satelliteElevationDeg: angleInput.satelliteElevationDeg,
    beamCenterKm,
    userPositionKm: acceptedPositionKm,
  });
  const draftAngleRad = offAxisAngleRadForVisualLabUe(angleInput);
  const maxPositionKm = positionForVisualLabUeOffAxisAngle(angleInput, Math.PI);
  const maxAngleRad = offAxisAngleRadForVisualLabUe({
    satelliteDistanceKm: angleInput.satelliteDistanceKm,
    satelliteElevationDeg: angleInput.satelliteElevationDeg,
    beamCenterKm,
    userPositionKm: maxPositionKm,
  });
  return {
    scale,
    representativeUserIndex: input.representativeUserIndex,
    angleInput,
    acceptedAngleDeg: degreesFromRadians(acceptedAngleRad),
    draftAngleDeg: degreesFromRadians(draftAngleRad),
    maxAngleDeg: Math.max(degreesFromRadians(maxAngleRad), .01),
    hasDraft: input.selectedUeWorldPosition !== null,
  };
}

export function positionForWalkerVisualLabUeAngle(
  geometry: Pick<WalkerVisualLabUeGeometryResult, 'angleInput'>,
  targetAngleRad: number,
): VisualLabGroundPositionKm {
  return positionForVisualLabUeOffAxisAngle(geometry.angleInput, targetAngleRad);
}
