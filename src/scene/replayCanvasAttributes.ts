/**
 * The canvas dataset attributes the recorded MODQN replay path may stamp on the
 * WebGL canvas. `SceneTelemetry` clears them on lane-leave so a stale replay
 * attribute never bleeds into a live lane's browser-smoke read (a LIVE render
 * path, independent of any replay scene layer).
 *
 * Relocated here (P3 slice-3) from the retired `modqn-replay-visuals/` board dir
 * when the `ModqnReplaySceneLayer` was clean-deleted — the attribute list is the
 * only piece of that dir a live consumer still needs, so it lives in this neutral
 * module instead of a board-owned `constants.ts`.
 */
export const REPLAY_CANVAS_ATTRIBUTES = [
  'data-modqn-replay-scene-layer',
  'data-modqn-replay-scene-renderer',
  'data-modqn-replay-scene-source',
  'data-modqn-replay-scene-geometry-source',
  'data-modqn-replay-scene-event-kind',
  'data-modqn-replay-scene-selection-source',
  'data-modqn-replay-scene-previous-beam',
  'data-modqn-replay-scene-selected-beam',
  'data-modqn-replay-scene-previous-position',
  'data-modqn-replay-scene-selected-position',
  'data-modqn-replay-scene-source-row',
  'data-modqn-replay-producer-satellite-state-count',
  'data-modqn-replay-rendered-satellite-state-count',
  'data-modqn-replay-expected-satellite-count',
  'data-modqn-replay-slot-decision-row-count',
  'data-modqn-replay-truth-level',
  'data-modqn-replay-source-gap-count',
  'data-handover-story-source-gap',
  'data-handover-story-fake-beam-hopping',
] as const;
