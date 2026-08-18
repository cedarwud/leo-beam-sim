import type { VisualLabInputKey } from '../../visualLab/experiment';

export type VisualLabInputSceneFocus = 'geometry' | 'handover' | 'energy';

/**
 * Presentation focus selected after an accepted input edit.  This map owns no
 * science; it only keeps the central scene on the visual layer most likely to
 * reveal the corresponding canonical change.
 */
export const VISUAL_LAB_INPUT_SCENE_FOCUS: Readonly<Record<
  VisualLabInputKey,
  VisualLabInputSceneFocus
>> = Object.freeze({
  frequencyReuse: 'handover',
  antennaNoiseTemperatureK: 'handover',
  noiseFigureDb: 'handover',
  noiseReferenceTemperatureK: 'handover',
  g0Linear: 'geometry',
  theta3dbRad: 'geometry',
  carrierFrequencyGHz: 'geometry',
  atmosphericZenithLossDb: 'geometry',
  receiveGainDbi: 'geometry',
  minimumRateBps: 'handover',
  systemBandwidthHz: 'handover',
  beamPowerCapW: 'energy',
  satellitePowerCapW: 'energy',
  etaMax: 'energy',
  backoffDb: 'energy',
  rfcPowerW: 'energy',
  basebandPerSatelliteW: 'energy',
});

export function focusForVisualLabInput(key: VisualLabInputKey): VisualLabInputSceneFocus {
  return VISUAL_LAB_INPUT_SCENE_FOCUS[key];
}
