/**
 * Homepage-only teaching envelopes for the visible handover story.
 *
 * This changes only how long the accepted event remains readable on `/`.
 * Handover qualification, TTT, commit, and the simulation clock are not
 * changed by this constant.
 */
export const HOMEPAGE_INTRA_HANDOVER_DISPLAY_MS = 16_000;

/**
 * Inter-satellite handover needs a shorter, but still narratable, envelope:
 * the bottom rail must have time to move from the serving satellite to the
 * candidate satellite's seven-beam roster before the scene settles.
 */
export const HOMEPAGE_INTER_HANDOVER_DISPLAY_MS = 12_000;

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
