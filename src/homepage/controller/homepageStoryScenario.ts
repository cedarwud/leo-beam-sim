/**
 * The deterministic source geometry for the homepage's natural handover story.
 *
 * This is not a presentation cue and it does not choose a handover. It is the
 * one shared input that keeps the live SINR scene and its source-backed event
 * index on the same primary-UE trajectory, so the timeline can naturally show
 * intra before inter under the canonical EE decision engine.
 */
export const HOMEPAGE_NATURAL_HANDOVER_STORY_PRIMARY_JOG_KM = Object.freeze({
  // Keep the protagonist inside the established central geographic cell while
  // the canonical EE decision engine selects its measured same-cell variant.
  // A larger jog crosses the cell boundary before the variant commit and makes
  // the source transition look like an inter-cell move, which is not the
  // homepage's intended Intra-cell teaching story.
  east: 10,
  north: 0,
} as const);
