export type R4HandoverSource = 'accepted' | 'teaching';

export interface R4SurfaceTelemetry {
  readonly surface: string;
  readonly binding: string;
  readonly contract: string;
  readonly activeSource: string;
  readonly source: string;
  readonly storyId: string;
  readonly kind: string;
  readonly pairKey: string;
  readonly phase: string;
  readonly committed: string;
  readonly producer: string;
  readonly claimClass: string;
  readonly decisionEvidence: string;
  readonly disclosure: string;
  readonly decisionInputAllowed: string;
  readonly snapshotId: string;
  readonly episodeId: string;
  readonly sourceFrameId: string;
  readonly clockBasis: string;
  readonly clockCurrentSec: string;
  readonly clockDurationSec: string;
  readonly identity: string;
}

export interface R4AcceptedRootTelemetry {
  readonly snapshotId: string;
  readonly episodeId: string;
  readonly sourceFrameId: string;
  readonly phase: string;
  readonly simTimeSec: string;
}

export const R4_COMPARABLE_FIELDS = Object.freeze([
  'activeSource',
  'source',
  'storyId',
  'kind',
  'pairKey',
  'phase',
  'committed',
  'producer',
  'claimClass',
  'decisionEvidence',
  'disclosure',
  'decisionInputAllowed',
  'snapshotId',
  'episodeId',
  'sourceFrameId',
  'clockBasis',
  'clockCurrentSec',
  'clockDurationSec',
  'identity',
] as const satisfies readonly (keyof R4SurfaceTelemetry)[]);

const STORY_PHASES = new Set([
  'serving', 'measuring', 'holding', 'switching', 'settled',
]);

function requireValue(
  errors: string[],
  surface: string,
  field: keyof R4SurfaceTelemetry,
  value: string,
): void {
  if (value.length === 0) errors.push(`${surface}.${field} is empty`);
}

function validateSurfaceEnvelope(
  telemetry: R4SurfaceTelemetry,
  expectedSurface: 'scene' | 'rail' | 'caption',
  errors: string[],
): void {
  if (telemetry.surface !== expectedSurface) {
    errors.push(`${expectedSurface}.surface=${telemetry.surface}`);
  }
  if (telemetry.binding !== 'bound') {
    errors.push(`${expectedSurface}.binding=${telemetry.binding}`);
  }
  if (expectedSurface !== 'scene' && telemetry.contract !== 'matched') {
    errors.push(`${expectedSurface}.contract=${telemetry.contract}`);
  }
  requireValue(errors, expectedSurface, 'storyId', telemetry.storyId);
  requireValue(errors, expectedSurface, 'pairKey', telemetry.pairKey);
  requireValue(errors, expectedSurface, 'identity', telemetry.identity);
}

function validateSharedFields(
  scene: R4SurfaceTelemetry,
  surface: R4SurfaceTelemetry,
  label: 'rail' | 'caption',
  errors: string[],
): void {
  for (const field of R4_COMPARABLE_FIELDS) {
    if (surface[field] !== scene[field]) {
      errors.push(`${label}.${field}=${surface[field]} != scene.${field}=${scene[field]}`);
    }
  }
}

function validateCommonIdentity(
  expectedSource: R4HandoverSource,
  scene: R4SurfaceTelemetry,
  errors: string[],
): void {
  if (scene.activeSource !== expectedSource) {
    errors.push(`scene.activeSource=${scene.activeSource}`);
  }
  if (scene.source !== expectedSource) errors.push(`scene.source=${scene.source}`);
  if (scene.kind !== 'intra' && scene.kind !== 'inter') {
    errors.push(`scene.kind=${scene.kind}`);
  }
  if (!STORY_PHASES.has(scene.phase)) errors.push(`scene.phase=${scene.phase}`);
  if (scene.committed !== 'true' && scene.committed !== 'false') {
    errors.push(`scene.committed=${scene.committed}`);
  }
  if (scene.decisionInputAllowed !== 'false') {
    errors.push(`scene.decisionInputAllowed=${scene.decisionInputAllowed}`);
  }
}

function validateSourceProvenance(
  expectedSource: R4HandoverSource,
  scene: R4SurfaceTelemetry,
  errors: string[],
): void {
  if (expectedSource === 'accepted') {
    if (scene.producer !== 'walker' && scene.producer !== 'tle') {
      errors.push(`accepted.producer=${scene.producer}`);
    }
    if (scene.claimClass !== 'accepted-decision') {
      errors.push(`accepted.claimClass=${scene.claimClass}`);
    }
    if (scene.decisionEvidence !== 'accepted') {
      errors.push(`accepted.decisionEvidence=${scene.decisionEvidence}`);
    }
    if (scene.disclosure !== 'accepted-decision-read-only') {
      errors.push(`accepted.disclosure=${scene.disclosure}`);
    }
    if (scene.clockBasis !== 'simulation-time') {
      errors.push(`accepted.clockBasis=${scene.clockBasis}`);
    }
    for (const [field, value] of [
      ['snapshotId', scene.snapshotId],
      ['episodeId', scene.episodeId],
      ['sourceFrameId', scene.sourceFrameId],
      ['clockCurrentSec', scene.clockCurrentSec],
    ] as const) {
      if (value.length === 0) errors.push(`accepted.${field} is empty`);
    }
    if (scene.clockDurationSec !== '') {
      errors.push(`accepted.clockDurationSec=${scene.clockDurationSec}`);
    }
    return;
  }
  if (scene.producer !== 'teaching') errors.push(`teaching.producer=${scene.producer}`);
  if (scene.claimClass !== 'authored-teaching') {
    errors.push(`teaching.claimClass=${scene.claimClass}`);
  }
  if (scene.decisionEvidence !== 'none') {
    errors.push(`teaching.decisionEvidence=${scene.decisionEvidence}`);
  }
  if (scene.disclosure !== 'authored-teaching-not-measured') {
    errors.push(`teaching.disclosure=${scene.disclosure}`);
  }
  if (scene.clockBasis !== 'teaching-script') {
    errors.push(`teaching.clockBasis=${scene.clockBasis}`);
  }
  if (scene.clockCurrentSec.length === 0) {
    errors.push('teaching.clockCurrentSec is empty');
  }
  if (scene.clockDurationSec.length === 0) {
    errors.push('teaching.clockDurationSec is empty');
  }
  for (const [field, value] of [
    ['snapshotId', scene.snapshotId],
    ['episodeId', scene.episodeId],
    ['sourceFrameId', scene.sourceFrameId],
  ] as const) {
    if (value !== '') errors.push(`teaching.${field}=${value}`);
  }
}

export function validateR4SurfaceSet(
  expectedSource: R4HandoverSource,
  scene: R4SurfaceTelemetry,
  rail: R4SurfaceTelemetry,
  caption: R4SurfaceTelemetry,
): readonly string[] {
  const errors: string[] = [];
  validateSurfaceEnvelope(scene, 'scene', errors);
  validateSurfaceEnvelope(rail, 'rail', errors);
  validateSurfaceEnvelope(caption, 'caption', errors);
  validateSharedFields(scene, rail, 'rail', errors);
  validateSharedFields(scene, caption, 'caption', errors);
  validateCommonIdentity(expectedSource, scene, errors);
  validateSourceProvenance(expectedSource, scene, errors);
  return errors;
}

export function assertR4SurfaceSet(
  expectedSource: R4HandoverSource,
  scene: R4SurfaceTelemetry,
  rail: R4SurfaceTelemetry,
  caption: R4SurfaceTelemetry,
): void {
  const errors = validateR4SurfaceSet(expectedSource, scene, rail, caption);
  if (errors.length > 0) {
    throw new Error(`R4 ${expectedSource} surface mismatch:\n${errors.join('\n')}`);
  }
}

function acceptedStoryPhase(rawPhase: string, committed: string): string {
  if (committed === 'true' && (rawPhase === 'guard' || rawPhase === 'monitoring')) {
    return 'settled';
  }
  switch (rawPhase) {
    case 'initial-attach':
    case 'monitoring': return 'serving';
    case 'evaluating':
    case 'qualifying': return 'measuring';
    case 'selection-hold': return 'holding';
    case 'switching': return 'switching';
    case 'guard': return 'settled';
    default: return '';
  }
}

export function validateR4AcceptedRoot(
  scene: R4SurfaceTelemetry,
  root: R4AcceptedRootTelemetry,
): readonly string[] {
  const errors: string[] = [];
  if (root.snapshotId !== scene.snapshotId) errors.push('root.snapshotId mismatch');
  if (root.episodeId !== scene.episodeId) errors.push('root.episodeId mismatch');
  if (root.sourceFrameId !== scene.sourceFrameId) errors.push('root.sourceFrameId mismatch');
  if (acceptedStoryPhase(root.phase, scene.committed) !== scene.phase) {
    errors.push(`root.phase=${root.phase} does not project to scene.phase=${scene.phase}`);
  }
  const sceneTime = Number(scene.clockCurrentSec);
  const rootTime = Number(root.simTimeSec);
  if (!Number.isFinite(sceneTime) || !Number.isFinite(rootTime)) {
    errors.push('accepted clock is not finite');
  } else if (Math.abs(sceneTime - rootTime) > 0.001) {
    errors.push(`root.simTimeSec=${root.simTimeSec} != scene.clockCurrentSec=${scene.clockCurrentSec}`);
  }
  return errors;
}

export function assertR4AcceptedRoot(
  scene: R4SurfaceTelemetry,
  root: R4AcceptedRootTelemetry,
): void {
  const errors = validateR4AcceptedRoot(scene, root);
  if (errors.length > 0) {
    throw new Error(`R4 accepted root mismatch:\n${errors.join('\n')}`);
  }
}
