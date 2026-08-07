import {
  DEFAULT_CHANNEL_LOSS_OVERRIDES,
  DEFAULT_TR38811_CHANNEL,
  resolveMaxTxPowerDbm,
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
    maxTxPowerDbm: resolveMaxTxPowerDbm(profile.channel),
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

/**
 * ENGINE-REBUILD key. Changing this string cold-starts the simulation, so it
 * covers only the two fields the engine cannot apply in place.
 *
 * 🔴 Do NOT add Tx power, bandwidth or any other field here to make the energy
 * ledger reset. Every field added to this key makes the beams disappear for a
 * moment on every drag of that slider — a regression that has already been
 * fixed once. The energy ledger has its own, independent key:
 * {@link getEnergyLedgerSignalKey}.
 */
export function getSignalTuningResetKey(tuning: SignalTuningState): string {
  return [
    tuning.beamwidth3dBDeg.toFixed(3),
    tuning.maxSteeringAngleDeg.toFixed(3),
  ].join('|');
}

/**
 * ENERGY-LEDGER key — the signal-side half of the teaching energy ledger's
 * accumulation window (`src/teaching/energyLedger.ts`). When this string
 * changes, every Σ in the ledger describes a different experiment and must be
 * restarted; nothing about the engine or the scene is rebuilt.
 *
 * Coverage: every field of `SignalTuningState`. That is not laziness — each
 * field lands in the EE numerator, the denominator, or both:
 *
 *   Denominator (P_total, via `computePowerTrain`)
 *     - maxTxPowerDbm ......... P_RF -> P_PA -> P_total. The single largest
 *                               lever on the denominator.
 *
 *   Numerator (R = (B / K) * log2(1 + SINR))
 *     - bandwidthMHz .......... B directly, and the thermal noise floor.
 *     - frequencyReuse ........ K, the divisor on B.
 *     - noisePsdDbmHz ......... noise power -> SINR.
 *     - frequencyGHz .......... FSPL -> received power -> SINR.
 *     - maxGainDbi ............ satellite antenna gain -> SINR.
 *     - ueAntennaMaxGainDbi ... UE antenna gain -> SINR.
 *     - atmosphericZenithLossDb,
 *       scintillationScaleDb,
 *       shadowFadingMarginDb,
 *       tr38811NlosClutterLossDb,
 *       pathLossComponents .... path-loss budget -> SINR.
 *     - model,
 *       beamwidth3dBDeg,
 *       maxSteeringAngleDeg,
 *       scanLossAtMaxSteeringDb  beam pattern -> serving gain and inter-beam
 *                               interference -> SINR.
 *
 * The trade-off taken here is deliberate: over-resetting (a field that turns
 * out not to matter still restarts the window) costs the student a restarted
 * accumulation, which is visible and self-explanatory. Under-resetting silently
 * publishes a Σ that mixes two configurations and never happened under either —
 * which is exactly the failure this key exists to prevent. So the rule is: any
 * new field on `SignalTuningState` goes in here unless someone can show it
 * cannot touch P_total or R.
 *
 * The formatting mirrors `getSignalTuningEvidenceKey` (same rounding, same
 * order) so the two stay diff-able, but they are separate functions on purpose:
 * the evidence key exists for provenance display and may gain fields for
 * reasons that have nothing to do with energy.
 */
export function getEnergyLedgerSignalKey(tuning: SignalTuningState): string {
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
