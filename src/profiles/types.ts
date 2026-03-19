export type GainModel = 'bessel-j1-j3' | 'bessel-j1' | 'flat';

export interface Profile {
  id: string;
  paper: string;

  orbit: {
    type: 'walker';
    altitudeKm: number;
    inclinationDeg: number;
    planes: number;
    satsPerPlane: number;
    observerLatDeg: number;
    observerLonDeg: number;
    servingRadiusKm: number;
  };

  antenna: {
    model: GainModel;
    maxGainDbi: number;
    beamwidth3dBRad: number;
    efficiency: number;
  };

  channel: {
    frequencyGHz: number;
    bandwidthMHz: number;
    maxTxPowerDbm: number;
    noisePsdDbmHz: number;
    pathLossComponents: string[];
  };

  handover: {
    policy: 'sinr-offset' | 'rsrp-a3' | 'elevation';
    sinrThresholdDb: number;
    offsetDb: number;
    triggerTimeSec: number;
    pingPongGuardSec: number;
  };

  beams: {
    perSatellite: number;
    maxActivePerSat: number;
    frequencyReuse: number;
  };
}
