import {
  DEFAULT_CHANNEL_LOSS_OVERRIDES,
  DEFAULT_TR38811_CHANNEL,
  type ChannelLossOverrides,
  type GainModel,
  type PathLossComponent,
  type Profile,
  type Tr38811ChannelConfig,
} from './profiles/types';

export interface SignalTuningState {
  frequencyGHz: number;
  atmosphericZenithLossDb: number;
  scintillationScaleDb: number;
  shadowFadingMarginDb: number;
  tr38811NlosClutterLossDb: number;
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

function resolveLossOverrides(profile: Profile): ChannelLossOverrides {
  return {
    ...DEFAULT_CHANNEL_LOSS_OVERRIDES,
    ...profile.channel.lossOverrides,
  };
}

function resolveTr38811Config(profile: Profile): Tr38811ChannelConfig {
  return {
    ...DEFAULT_TR38811_CHANNEL,
    ...profile.channel.tr38811,
  };
}

export function createSignalTuningState(profile: Profile): SignalTuningState {
  const lossOverrides = resolveLossOverrides(profile);
  const tr38811 = resolveTr38811Config(profile);

  return {
    frequencyGHz: profile.channel.frequencyGHz,
    atmosphericZenithLossDb: lossOverrides.atmosphericZenithLossDb,
    scintillationScaleDb: lossOverrides.scintillationScaleDb,
    shadowFadingMarginDb: lossOverrides.shadowFadingMarginDb,
    tr38811NlosClutterLossDb: tr38811.nlosClutterLossDb,
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
      lossOverrides: {
        ...profile.channel.lossOverrides,
        atmosphericZenithLossDb: tuning.atmosphericZenithLossDb,
        scintillationScaleDb: tuning.scintillationScaleDb,
        shadowFadingMarginDb: tuning.shadowFadingMarginDb,
      },
      tr38811: {
        ...profile.channel.tr38811,
        environment: profile.channel.tr38811?.environment ?? DEFAULT_TR38811_CHANNEL.environment,
        nlosClutterLossDb: tuning.tr38811NlosClutterLossDb,
      },
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
    || base.atmosphericZenithLossDb !== tuning.atmosphericZenithLossDb
    || base.scintillationScaleDb !== tuning.scintillationScaleDb
    || base.shadowFadingMarginDb !== tuning.shadowFadingMarginDb
    || base.tr38811NlosClutterLossDb !== tuning.tr38811NlosClutterLossDb
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

export function getSignalTuningEvidenceKey(tuning: SignalTuningState): string {
  return [
    tuning.frequencyGHz.toFixed(3),
    tuning.atmosphericZenithLossDb.toFixed(3),
    tuning.scintillationScaleDb.toFixed(3),
    tuning.shadowFadingMarginDb.toFixed(3),
    tuning.tr38811NlosClutterLossDb.toFixed(3),
    tuning.bandwidthMHz.toFixed(3),
    tuning.maxTxPowerDbm.toFixed(3),
    tuning.noisePsdDbmHz.toFixed(3),
    tuning.maxGainDbi.toFixed(3),
    tuning.ueAntennaMaxGainDbi.toFixed(3),
    tuning.beamwidth3dBDeg.toFixed(3),
    tuning.model,
    tuning.maxSteeringAngleDeg.toFixed(3),
    tuning.scanLossAtMaxSteeringDb.toFixed(3),
    tuning.frequencyReuse.toFixed(0),
    tuning.pathLossComponents.join(','),
  ].join('|');
}

export function getSignalTuningResetKey(tuning: SignalTuningState): string {
  return [
    tuning.beamwidth3dBDeg.toFixed(3),
    tuning.maxSteeringAngleDeg.toFixed(3),
  ].join('|');
}
