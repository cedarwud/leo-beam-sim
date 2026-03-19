export type GainModel = 'bessel-j1-j3' | 'bessel-j1' | 'flat';
export type ProfileClass = 'paper-default' | 'candidate-rich';

export interface Shell {
  id: string;
  altitudeKm: number;
  inclinationDeg: number;
  planes: number;
  satsPerPlane: number;
}

export interface Profile {
  id: string;
  paper: string;
  profileClass: ProfileClass;

  orbit: {
    type: 'walker';
    shells: Shell[];
    observerLatDeg: number;
    observerLonDeg: number;
  };

  antenna: {
    model: GainModel;
    maxGainDbi: number;
    beamwidth3dBRad: number;
    efficiency: number;
    maxSteeringAngleDeg: number;
    scanLossAtMaxSteeringDb: number;
  };

  channel: {
    frequencyGHz: number;
    bandwidthMHz: number;
    maxTxPowerDbm: number;
    noisePsdDbmHz: number;
    pathLossComponents: string[];
  };

  handover: {
    policy: 'sinr-offset';
    sinrThresholdDb: number;
    offsetDb: number;
    triggerTimeSec: number;
    pingPongGuardSec: number;
    pendingTargetHoldSec: number;
    intraSwitchTimeSec: number;
    sinrSmoothingSec: number;
  };

  beams: {
    perSatellite: number;
    maxActivePerSat: number;
    frequencyReuse: number;
  };

  /** Pre-calculated or manually selected start time for the demo */
  demoStartOffsetSec?: number;
}
