export type ModqnVisualLayerPreset =
  | 'minimal'
  | 'baseline-faithful'
  | 'service-allocation'
  | 'explain-handover'
  | 'debug';

export type ModqnBeamConeScope =
  | 'none'
  | 'focus-satellite'
  | 'all-serving-satellites';

export interface ModqnVisualLayerFlags {
  readonly serviceMap: boolean;
  readonly activeCellOverlay: boolean;
  readonly ueCountBadges: boolean;
  readonly beamCones: boolean;
  readonly beamConeScope: ModqnBeamConeScope;
  readonly handoverStory: boolean;
  readonly handoverCues: boolean;
  readonly footprintEllipses: boolean;
  readonly diagnostics: boolean;
}

// S-ADV-3: the default MODQN-LIVE preset is `minimal` (hex cell rings only). The
// richer presets — the all-UE service map, profile-derived handover-story cues, and
// next-slot cell-change arcs — are profile-derived overlays that earn their place
// only as an explicit Advanced opt-in (Rule#10), so the default surface stays the
// clean hex overlay + cones + markers + cinema + HUD. This also keeps the default
// minimal even after the producer un-park flips the service-allocation gate on
// (`showModqnServiceAllocation`) — a user must pick Baseline/Service in Advanced to
// see the all-UE map.
export const DEFAULT_MODQN_VISUAL_LAYER_PRESET: ModqnVisualLayerPreset = 'minimal';

export const MODQN_VISUAL_LAYER_PRESETS: readonly ModqnVisualLayerPreset[] = [
  'minimal',
  'baseline-faithful',
  'service-allocation',
  'explain-handover',
  'debug',
];

// Hex cell rings only — the clean default. Everything else (service map, badges,
// cones, story cues, handover arcs, footprints, diagnostics) is opt-in.
const MINIMAL_LAYERS: ModqnVisualLayerFlags = {
  serviceMap: false,
  activeCellOverlay: true,
  ueCountBadges: false,
  beamCones: false,
  beamConeScope: 'none',
  handoverStory: false,
  handoverCues: false,
  footprintEllipses: false,
  diagnostics: false,
};

const BASELINE_FAITHFUL_LAYERS: ModqnVisualLayerFlags = {
  serviceMap: true,
  activeCellOverlay: true,
  ueCountBadges: true,
  beamCones: false,
  beamConeScope: 'none',
  handoverStory: false,
  handoverCues: false,
  footprintEllipses: false,
  diagnostics: false,
};

const SERVICE_ALLOCATION_LAYERS: ModqnVisualLayerFlags = {
  serviceMap: true,
  activeCellOverlay: true,
  ueCountBadges: true,
  beamCones: true,
  beamConeScope: 'all-serving-satellites',
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
  beamConeScope: 'focus-satellite',
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
  beamConeScope: 'all-serving-satellites',
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
  if (preset === 'service-allocation') return SERVICE_ALLOCATION_LAYERS;
  if (preset === 'explain-handover') return EXPLAIN_HANDOVER_LAYERS;
  if (preset === 'baseline-faithful') return BASELINE_FAITHFUL_LAYERS;
  return MINIMAL_LAYERS;
}
