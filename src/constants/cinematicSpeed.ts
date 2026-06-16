/**
 * Cinematic-tier playback speed (0.25x) the slow-mo handover cinema / director
 * focus drops to while a focus is active. Shared by the three cinema browser
 * gates so their tier assertion has one source instead of three hand-copied
 * literals.
 *
 * The runtime source-of-truth is `DIRECTOR_FOCUS_SPEED` in
 * `usePlaybackControls.ts` (pinned to 0.25 by validate:phase-c:camera-preset
 * section (i)); this mirror exists only to de-duplicate the gate-side copies and
 * MUST stay equal to it.
 */
export const CINEMATIC_SPEED = 0.25;
