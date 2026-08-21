/**
 * Path loss model per HOBS Eq.(1)-(2).
 * L = L_fs + L_g + L_sc + L_sf + L_N
 *
 * L_N is the optional NLoS clutter term; scan loss L_st is kept as a
 * separate factor in H so the public H expansion matches the link budget.
 *
 * Source: PAP-2024-HOBS, ITU-R P.676-13
 */

import {
  DEFAULT_CHANNEL_LOSS_OVERRIDES,
  type ChannelLossOverrides,
  type PathLossComponent,
} from '../../profiles/types';

/** Free-space path loss in dB. L_fs = 20log(f_c) + 20log(d) - 147.55 */
export function computeFsplDb(rangeKm: number, frequencyGHz: number): number {
  return 92.45 + 20 * Math.log10(Math.max(rangeKm, 0.001)) + 20 * Math.log10(frequencyGHz);
}

/** Atmospheric gas absorption (elevation-dependent approximation). */
function atmosphericLossDb(elevationDeg: number, zenithLossDb: number): number {
  const sinEl = Math.sin(Math.max(elevationDeg, 5) * Math.PI / 180);
  return zenithLossDb / Math.max(sinEl, 0.087); // capped at ~5° min
}

/** Tropospheric scintillation (elevation-dependent). */
function scintillationLossDb(elevationDeg: number, scaleDb: number): number {
  const sinEl = Math.sin(Math.max(elevationDeg, 5) * Math.PI / 180);
  return scaleDb / Math.max(sinEl, 0.087);
}

/** Shadow fading (deterministic mean for link budget; no random draw). */
function shadowFadingLossDb(marginDb: number): number {
  return marginDb;
}

/**
 * Compute composite path loss in dB.
 */
export interface PathLossOptions {
  isLos?: boolean;
  nlosClutterLossDb?: number;
  overrides?: Partial<ChannelLossOverrides>;
}

function resolveLossOverrides(
  overrides: Partial<ChannelLossOverrides> | undefined,
): ChannelLossOverrides {
  return {
    ...DEFAULT_CHANNEL_LOSS_OVERRIDES,
    ...overrides,
  };
}

export function computePathLossDb(
  rangeKm: number,
  frequencyGHz: number,
  elevationDeg: number,
  components: readonly PathLossComponent[],
  options: PathLossOptions = {},
): number {
  const enabledComponents = new Set(components);
  const lossOverrides = resolveLossOverrides(options.overrides);
  let loss = enabledComponents.has('fspl')
    ? computeFsplDb(rangeKm, frequencyGHz)
    : 0;

  for (const comp of enabledComponents) {
    switch (comp) {
      case 'atmospheric':
        loss += atmosphericLossDb(elevationDeg, lossOverrides.atmosphericZenithLossDb);
        break;
      case 'scintillation':
        loss += scintillationLossDb(elevationDeg, lossOverrides.scintillationScaleDb);
        break;
      case 'shadow-fading':
        loss += shadowFadingLossDb(lossOverrides.shadowFadingMarginDb);
        break;
      case 'fspl':
        break;
    }
  }

  if (options.isLos === false) {
    loss += options.nlosClutterLossDb ?? 0;
  }

  return loss;
}
