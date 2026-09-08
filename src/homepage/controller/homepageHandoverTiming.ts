/**
 * Compatibility exports for homepage wiring. The display-window decision is
 * owned by `src/appearance/handoverTimingEnvelope.ts`; this controller keeps
 * only the homepage playback-speed policy below.
 */
export {
  HOMEPAGE_INTRA_HANDOVER_DISPLAY_MS,
  HOMEPAGE_INTER_HANDOVER_DISPLAY_MS,
} from '../../appearance/handoverTimingEnvelope';

/**
 * Playback rate the two teaching buttons pin while a story is armed.
 *
 * Real time, deliberately. The armed story is paced by the scripted EE ramp in
 * `homepageTeachingHandoverRamp`, whose phase budget is written in simulated
 * seconds, so one-to-one is what makes those numbers the lecturer's numbers
 * too. It is also the fastest rate at which the orbital geometry still visibly
 * moves underneath the readouts. The homepage otherwise defaults to 5x, at
 * which the whole decision chain is over before it can be read.
 *
 * Display-only: dt scales in lockstep and no decision evidence moves. HO Slow's
 * own cap still applies on top and can only lower this rate, never raise it.
 */
export const HOMEPAGE_TEACHING_PLAYBACK_SPEED = 1;
