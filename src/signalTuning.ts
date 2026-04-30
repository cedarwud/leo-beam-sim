import type { GainModel, PathLossComponent, Profile } from './profiles/types';

export interface SignalTuningState {
  frequencyGHz: number;
  bandwidthMHz: number;
  maxTxPowerDbm: number;
  noisePsdDbmHz: number;
  maxGainDbi: number;
  ueAntennaMaxGainDbi: number;
  beamwidth3dBDeg: number;
  model: GainModel;
  maxSteeringAngleDeg: number;
  scanLossAtMaxSteeringDb: number;
  frequencyReuse: number;
  pathLossComponents: PathLossComponent[];
}

export const PATH_LOSS_COMPONENT_ORDER: readonly PathLossComponent[] = [
  'fspl',
  'atmospheric',
  'scintillation',
  'shadow-fading',
];

function radToDeg(radians: number): number {
  return (radians * 180) / Math.PI;
}

function degToRad(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

export function normalizePathLossComponents(
  components: readonly PathLossComponent[],
): PathLossComponent[] {
  const selected = new Set(components);
  return PATH_LOSS_COMPONENT_ORDER.filter(component => selected.has(component));
}

export function createSignalTuningState(profile: Profile): SignalTuningState {
  return {
    frequencyGHz: profile.channel.frequencyGHz,
    bandwidthMHz: profile.channel.bandwidthMHz,
    maxTxPowerDbm: profile.channel.maxTxPowerDbm,
    noisePsdDbmHz: profile.channel.noisePsdDbmHz,
    maxGainDbi: profile.antenna.maxGainDbi,
    ueAntennaMaxGainDbi: profile.ueAntenna.maxGainDbi,
    beamwidth3dBDeg: radToDeg(profile.antenna.beamwidth3dBRad),
    model: profile.antenna.model,
    maxSteeringAngleDeg: profile.antenna.maxSteeringAngleDeg,
    scanLossAtMaxSteeringDb: profile.antenna.scanLossAtMaxSteeringDb,
    frequencyReuse: profile.beams.frequencyReuse,
    pathLossComponents: normalizePathLossComponents(profile.channel.pathLossComponents),
  };
}

export function applySignalTuning(
  profile: Profile,
  tuning: SignalTuningState,
): Profile {
  return {
    ...profile,
    antenna: {
      ...profile.antenna,
      maxGainDbi: tuning.maxGainDbi,
      beamwidth3dBRad: degToRad(tuning.beamwidth3dBDeg),
      model: tuning.model,
      maxSteeringAngleDeg: tuning.maxSteeringAngleDeg,
      scanLossAtMaxSteeringDb: tuning.scanLossAtMaxSteeringDb,
    },
    ueAntenna: {
      ...profile.ueAntenna,
      maxGainDbi: tuning.ueAntennaMaxGainDbi,
    },
    channel: {
      ...profile.channel,
      frequencyGHz: tuning.frequencyGHz,
      bandwidthMHz: tuning.bandwidthMHz,
      maxTxPowerDbm: tuning.maxTxPowerDbm,
      noisePsdDbmHz: tuning.noisePsdDbmHz,
      pathLossComponents: normalizePathLossComponents(tuning.pathLossComponents),
    },
    beams: {
      ...profile.beams,
      frequencyReuse: tuning.frequencyReuse,
    },
  };
}

export function hasSignalTuningOverrides(
  profile: Profile,
  tuning: SignalTuningState,
): boolean {
  const base = createSignalTuningState(profile);
  return base.frequencyGHz !== tuning.frequencyGHz
    || base.bandwidthMHz !== tuning.bandwidthMHz
    || base.maxTxPowerDbm !== tuning.maxTxPowerDbm
    || base.noisePsdDbmHz !== tuning.noisePsdDbmHz
    || base.maxGainDbi !== tuning.maxGainDbi
    || base.ueAntennaMaxGainDbi !== tuning.ueAntennaMaxGainDbi
    || base.beamwidth3dBDeg !== tuning.beamwidth3dBDeg
    || base.model !== tuning.model
    || base.maxSteeringAngleDeg !== tuning.maxSteeringAngleDeg
    || base.scanLossAtMaxSteeringDb !== tuning.scanLossAtMaxSteeringDb
    || base.frequencyReuse !== tuning.frequencyReuse
    || base.pathLossComponents.join(',') !== tuning.pathLossComponents.join(',');
}

export function getSignalTuningResetKey(tuning: SignalTuningState): string {
  return [
    tuning.beamwidth3dBDeg.toFixed(3),
    tuning.maxSteeringAngleDeg.toFixed(3),
  ].join('|');
}
