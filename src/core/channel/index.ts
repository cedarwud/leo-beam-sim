/**
 * Channel module barrel export.
 *
 * SDD: sdd/ntn-sim-core-sdd.md §9.2
 * This file must not import React, Three.js, or scene code.
 */

export type {
  ChannelResult,
  SinrResult,
  BeamGainInput,
  InterferingSignal,
  SinrComputeOptions,
  LinkBudgetOptions,
  ShadowFadingParams,
} from './types';

export { computeFspl } from './fspl';
export { getShadowFadingParams, sampleShadowFading, classifyBand } from './shadow-fading';
export type { FrequencyBand } from './shadow-fading';
export { computeBeamGain, computeOffAxisAngle } from './beam-gain';
export { computeSinr } from './sinr';
export { computeLinkBudget } from './link-budget';
export { sampleShadowedRicianDb } from './small-scale-fading';
export { computeDopplerShiftHz, estimateRadialVelocityKmS, dopplerSinrDegradationDb } from './doppler';
