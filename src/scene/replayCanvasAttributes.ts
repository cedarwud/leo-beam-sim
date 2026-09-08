/**
 * The canvas dataset attributes a recorded replay path may stamp on the WebGL
 * canvas. `SceneTelemetry` clears them on lane-leave so a stale replay attribute
 * never bleeds into a live lane's browser-smoke read.
 *
 * The list lives in this neutral module rather than in a board-owned constants
 * module so the live telemetry cleanup remains independent of a replay board.
 */
export const REPLAY_CANVAS_ATTRIBUTES = [
  'data-handover-story-source-gap',
  'data-handover-story-fake-beam-hopping',
] as const;
