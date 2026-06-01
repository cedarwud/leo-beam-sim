export type ModqnVisualLayerPreset =
  | 'baseline-faithful'
  | 'explain-handover'
  | 'debug';

export interface ModqnVisualLayerFlags {
  readonly serviceMap: boolean;
  readonly activeCellOverlay: boolean;
  readonly ueCountBadges: boolean;
  readonly beamCones: boolean;
  readonly handoverStory: boolean;
  readonly handoverCues: boolean;
  readonly footprintEllipses: boolean;
  readonly diagnostics: boolean;
}

export const DEFAULT_MODQN_VISUAL_LAYER_PRESET: ModqnVisualLayerPreset = 'baseline-faithful';

export const MODQN_VISUAL_LAYER_PRESETS: readonly ModqnVisualLayerPreset[] = [
  'baseline-faithful',
  'explain-handover',
  'debug',
];

const BASELINE_FAITHFUL_LAYERS: ModqnVisualLayerFlags = {
  serviceMap: true,
  activeCellOverlay: true,
  ueCountBadges: true,
  beamCones: false,
  handoverStory: false,
  handoverCues: false,
  footprintEllipses: false,
  diagnostics: false,
};

const EXPLAIN_HANDOVER_LAYERS: ModqnVisualLayerFlags = {
  serviceMap: true,
  activeCellOverlay: true,
  ueCountBadges: true,
  beamCones: true,
  handoverStory: true,
  handoverCues: true,
  footprintEllipses: false,
  diagnostics: false,
};

const DEBUG_LAYERS: ModqnVisualLayerFlags = {
  serviceMap: true,
  activeCellOverlay: true,
  ueCountBadges: true,
  beamCones: true,
  handoverStory: true,
  handoverCues: true,
  footprintEllipses: true,
  diagnostics: true,
};

export function isModqnVisualLayerPreset(value: string): value is ModqnVisualLayerPreset {
  return MODQN_VISUAL_LAYER_PRESETS.includes(value as ModqnVisualLayerPreset);
}

export function resolveModqnVisualLayers(
  preset: ModqnVisualLayerPreset = DEFAULT_MODQN_VISUAL_LAYER_PRESET,
): ModqnVisualLayerFlags {
  if (preset === 'debug') return DEBUG_LAYERS;
  if (preset === 'explain-handover') return EXPLAIN_HANDOVER_LAYERS;
  return BASELINE_FAITHFUL_LAYERS;
}
