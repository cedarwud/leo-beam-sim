/**
 * Presentation-only scene staging.
 *
 * This module never receives a simulation frame.  It resolves a small stage ID
 * into renderer-mount visibility, so presentation choreography cannot mutate or
 * recompute TLE, SINR, Power, Throughput, EE, beam ownership, or handover state.
 */

export const SCENE_PRESENTATION_STAGE_IDS = [
  'ground',
  'constellation',
  'service',
  'comparison',
  'full',
] as const;

export type ScenePresentationStageId = typeof SCENE_PRESENTATION_STAGE_IDS[number];

export const SCENE_PRESENTATION_LAYER_IDS = [
  'backdrop',
  'campus',
  'ues',
  'ground-overlays',
  'serving-footprints',
  'selected-satellite',
  'candidate-satellite',
  'context-satellites',
  'serving-beams',
  'candidate-beams',
  'candidate-footprints',
  'ambient-beams',
  'uav',
  'motion-guides',
  'event-effects',
  'annotations',
  'load-overlays',
  'diagnostics',
] as const;

export type ScenePresentationLayerId = typeof SCENE_PRESENTATION_LAYER_IDS[number];

export interface ScenePresentationPlan {
  readonly stage: ScenePresentationStageId;
  readonly visible: Readonly<Record<ScenePresentationLayerId, boolean>>;
}

export interface ScenePresentationStageOption {
  readonly id: ScenePresentationStageId;
  readonly index: string;
  readonly label: string;
}

export const SCENE_PRESENTATION_STAGE_OPTIONS: readonly ScenePresentationStageOption[] = Object.freeze([
  { id: 'ground', index: '01', label: '地面' },
  { id: 'constellation', index: '02', label: '衛星' },
  { id: 'service', index: '03', label: '服務鏈路' },
  { id: 'comparison', index: '04', label: '候選比較' },
  { id: 'full', index: '05', label: '完整場景' },
]);

const GROUND_LAYERS: readonly ScenePresentationLayerId[] = [
  'backdrop',
  'campus',
  'ues',
  'ground-overlays',
];

const CONSTELLATION_LAYERS: readonly ScenePresentationLayerId[] = [
  ...GROUND_LAYERS,
  'selected-satellite',
  'candidate-satellite',
  'context-satellites',
];

const SERVICE_LAYERS: readonly ScenePresentationLayerId[] = [
  ...CONSTELLATION_LAYERS,
  'serving-beams',
  'serving-footprints',
];

const COMPARISON_LAYERS: readonly ScenePresentationLayerId[] = [
  ...SERVICE_LAYERS,
  'candidate-beams',
  'candidate-footprints',
];

const STAGE_LAYERS: Readonly<Record<ScenePresentationStageId, readonly ScenePresentationLayerId[]>> = {
  ground: GROUND_LAYERS,
  constellation: CONSTELLATION_LAYERS,
  service: SERVICE_LAYERS,
  comparison: COMPARISON_LAYERS,
  full: SCENE_PRESENTATION_LAYER_IDS,
};

export function isScenePresentationStageId(value: unknown): value is ScenePresentationStageId {
  return typeof value === 'string'
    && (SCENE_PRESENTATION_STAGE_IDS as readonly string[]).includes(value);
}

export function resolveScenePresentationStage(value: unknown): ScenePresentationStageId {
  return isScenePresentationStageId(value) ? value : 'full';
}

export function resolveScenePresentationPlan(value: unknown): ScenePresentationPlan {
  const stage = resolveScenePresentationStage(value);
  const enabled = new Set(STAGE_LAYERS[stage]);
  const visible = Object.freeze(Object.fromEntries(
    SCENE_PRESENTATION_LAYER_IDS.map(layer => [layer, enabled.has(layer)]),
  ) as Record<ScenePresentationLayerId, boolean>);
  return Object.freeze({ stage, visible });
}

export function readScenePresentationStageFromSearch(search: string): ScenePresentationStageId {
  return resolveScenePresentationStage(new URLSearchParams(search).get('sceneStage'));
}

export function isScenePresenterEnabled(search: string): boolean {
  return new URLSearchParams(search).get('scenePresenter') === '1';
}
