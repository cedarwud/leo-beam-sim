import type { ModqnReplaySceneBeamRole } from '../modqnReplaySceneVisuals';

export const LAYER_ORIGIN: [number, number, number] = [0, 0, -36];
export const BOARD_WIDTH_WORLD = 220;
export const BOARD_DEPTH_WORLD = 175;
export const BOARD_Y_WORLD = 2.6;
export const DISC_Y_WORLD = 5.2;
export const PRODUCER_MARKER_Y_WORLD = 84;
export const ARC_CONTROL_Y_WORLD = 44;
export const SEGMENTS = 96;

export const ROLE_COLORS: Record<ModqnReplaySceneBeamRole, string> = {
  inactive: '#94a3b8',
  previous: '#38bdf8',
  selected: '#f59e0b',
  'previous-and-selected': '#facc15',
};

export const REPLAY_CANVAS_ATTRIBUTES = [
  'data-modqn-replay-scene-layer',
  'data-modqn-replay-scene-renderer',
  'data-modqn-replay-scene-source',
  'data-modqn-replay-scene-event-kind',
  'data-modqn-replay-scene-selection-source',
  'data-modqn-replay-scene-previous-beam',
  'data-modqn-replay-scene-selected-beam',
  'data-modqn-replay-scene-previous-position',
  'data-modqn-replay-scene-selected-position',
  'data-modqn-replay-scene-source-row',
] as const;

export function roleLabel(role: ModqnReplaySceneBeamRole): string | null {
  switch (role) {
    case 'previous':
      return 'PREV';
    case 'selected':
      return 'SELECT';
    case 'previous-and-selected':
      return 'PREV + SELECT';
    case 'inactive':
      return null;
  }
}
