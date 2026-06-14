// Handover-rail + MODQN-replay-visual-timeline builders, extracted verbatim from
// App.tsx (Tier-2a de-coupling, frontend-coupling-audit E1 seam). These are pure
// module-scope functions — they read artifact / envelope / SimState truth and
// emit display rail events + a display-stretched replay timeline. They close over
// NO component state, so the move is behavior-preserving (Rule#6: display-only).
//
// Governance note: the display-stretched MODQN replay axis here is deliberately
// SEPARATE from the producer source horizon (Rule#8). The
// scene-lane-governance / handover-story / camera-preset / phase7k validators
// assert these builders exist + keep that separation; they now read THIS file
// instead of App.tsx (Rule#9 atomic — the assertions moved with the code).
import type { SimState } from '../scene/types';
import type { VisualShowcaseArtifact } from '../scene/visual-showcase-contract';
import type { HandoverRailEvent, HandoverRailEventKind } from '../ui/HandoverEventRail';
import type {
  ModqnReplayEnvelope,
  ModqnReplayPlaybackShellModel,
  ModqnReplayPlaybackSlot,
} from '../modqn/replay-bundle';
import { APP_EPOCH_MS } from './appRuntimeConfig';

const MODQN_REPLAY_HANDOVER_SLOT_SEC = 3.2;
const MODQN_REPLAY_STABLE_SLOT_SEC = 0.9;
const MODQN_REPLAY_VISUAL_MIN_DISPLAY_DURATION_SEC = 60;

export interface ModqnReplayVisualTimeline {
  readonly durationSec: number;
  readonly currentTimeSec: number;
  readonly slotMidpointSecByIndex: ReadonlyMap<number, number>;
}

function formatRailBeamLabel(satId: string | null | undefined, beamId: string | number | null | undefined): string {
  const satLabel = satId ?? 'unknown';
  if (beamId === null || beamId === undefined || beamId === '') return satLabel;
  return `${satLabel} B${beamId}`;
}

function normalizeRailEventKind(kind: string | undefined): HandoverRailEventKind | null {
  const value = kind?.toLowerCase() ?? '';
  if (value.includes('inter')) return 'inter';
  if (value.includes('intra') || value.includes('beam-switch') || value.includes('beam')) return 'intra';
  return null;
}

function getNearestShowcaseFrame(
  artifact: VisualShowcaseArtifact,
  timeSec: number,
): VisualShowcaseArtifact['timeline'][number] | null {
  let nearest: VisualShowcaseArtifact['timeline'][number] | null = null;
  let bestDistance = Infinity;
  for (const frame of artifact.timeline) {
    const distance = Math.abs(frame.tSec - timeSec);
    if (distance < bestDistance) {
      nearest = frame;
      bestDistance = distance;
    }
  }
  return nearest;
}

function deriveArtifactRailEventKind(
  artifact: VisualShowcaseArtifact,
  timeSec: number,
  eventType: string,
): HandoverRailEventKind | null {
  const frame = getNearestShowcaseFrame(artifact, timeSec);
  const sourceKind = normalizeRailEventKind(eventType) ?? normalizeRailEventKind(frame?.handoverState.kind);
  if (sourceKind !== null) return sourceKind;

  const handover = frame?.handoverState;
  if (handover?.targetSatelliteId && handover.targetSatelliteId !== handover.servingSatelliteId) return 'inter';
  if (handover?.targetBeamId && handover.targetBeamId !== handover.servingBeamId) return 'intra';
  return null;
}

export function buildArtifactHandoverRailEvents(
  artifact: VisualShowcaseArtifact | null,
): readonly HandoverRailEvent[] {
  if (artifact === null) return [];

  return artifact.events.flatMap(event => {
    if (!event.type.toLowerCase().includes('handover')) return [];
    const kind = deriveArtifactRailEventKind(artifact, event.tSec, event.type);
    if (kind === null) return [];
    const frame = getNearestShowcaseFrame(artifact, event.tSec);
    const handover = frame?.handoverState;
    // Director D6 framing IDs. The camera focuses the PRIMARY UE (ues[0]), so the
    // per-frame primary MODQN decision is the only coherent source/target pair.
    // Attach it ONLY when that primary decision is itself an inter-satellite change
    // (previousSatelliteId != selectedSatelliteId). Multi-UE artifacts can carry a
    // secondary UE's handover event at this frame while the primary decision is
    // unchanged — those correctly fail closed (null → legacy pose on the primary
    // UE), never misattributing the primary's satellites to a secondary event.
    // Pure producer truth; no fabricated pair.
    const decision = frame?.modqnDecision;
    const decisionSource = decision?.previousSatelliteId ?? null;
    const decisionTarget = decision?.selectedSatelliteId ?? null;
    const primaryInterHo =
      decisionSource !== null && decisionTarget !== null && decisionSource !== decisionTarget;
    const fromSatId = primaryInterHo ? decisionSource : null;
    const toSatId = primaryInterHo ? decisionTarget : null;
    return [{
      id: `artifact-${event.id.replace(/[^a-zA-Z0-9_-]/g, '_')}`,
      timeSec: event.tSec,
      kind,
      title: event.title,
      fromLabel: formatRailBeamLabel(handover?.servingSatelliteId, handover?.servingBeamId),
      toLabel: formatRailBeamLabel(handover?.targetSatelliteId ?? handover?.servingSatelliteId, handover?.targetBeamId),
      fromSatId,
      toSatId: toSatId ?? null,
      detail: event.type,
      source: 'artifact-replay' as const,
    }];
  });
}

interface ModqnRailEventBucket {
  event: HandoverRailEvent;
  fromLabels: Set<string>;
  toLabels: Set<string>;
}

function summarizeRailLabelSet(labels: ReadonlySet<string>, pluralLabel: string): string {
  const values = [...labels];
  if (values.length === 0) return 'unknown';
  if (values.length === 1) return values[0] ?? 'unknown';
  return `${values.length} ${pluralLabel}`;
}

export function buildModqnHandoverRailEvents(
  envelope: ModqnReplayEnvelope | null,
  displayTimeSecBySlotIndex: ReadonlyMap<number, number> = new Map(),
): readonly HandoverRailEvent[] {
  if (envelope === null) return [];

  const grouped = new Map<string, ModqnRailEventBucket>();
  for (const slot of envelope.replaySlots) {
    for (const row of slot.rows) {
      const eventKind = row.producerTruth.handoverEvent.kind;
      const kind = normalizeRailEventKind(eventKind);
      if (eventKind === 'none' || kind === null) continue;
      const previous = row.producerTruth.previousServing;
      const selected = row.producerTruth.selectedServing;
      const timeSec = row.producerTruth.timestamps.timeSec;
      const displayTimeSec = displayTimeSecBySlotIndex.get(slot.slotIndex);
      const fromLabel = formatRailBeamLabel(previous.satId, previous.localBeamIndex + 1);
      const toLabel = formatRailBeamLabel(selected.satId, selected.localBeamIndex + 1);
      const key = `${timeSec.toFixed(3)}:${kind}`;
      const existing = grouped.get(key);
      if (existing) {
        existing.fromLabels.add(fromLabel);
        existing.toLabels.add(toLabel);
        const count = (existing.event.count ?? 1) + 1;
        existing.event = {
          ...existing.event,
          title: kind === 'inter' ? 'Satellite handover window' : 'Beam switch window',
          fromLabel: summarizeRailLabelSet(existing.fromLabels, 'sources'),
          toLabel: summarizeRailLabelSet(existing.toLabels, 'targets'),
          count,
        };
        continue;
      }
      grouped.set(key, {
        event: {
          id: `modqn-${kind}-${timeSec.toFixed(3).replace(/[^0-9]/g, '_')}`,
          timeSec,
          displayTimeSec,
          kind,
          title: kind === 'inter' ? 'Satellite handover' : 'Beam switch',
          fromLabel,
          toLabel,
          detail: `slot ${slot.slotIndex}`,
          source: 'modqn-replay',
          count: 1,
        },
        fromLabels: new Set([fromLabel]),
        toLabels: new Set([toLabel]),
      });
    }
  }

  return [...grouped.values()].map(bucket => bucket.event);
}

export function liveObservedHandoverRailEventFromState(state: SimState): HandoverRailEvent | null {
  const event = state.lastHoEvent;
  if (event === null || event.fromSatId === null || event.fromBeamId === null) return null;

  const kind = event.action === 'inter-handover' ? 'inter' : event.action === 'intra-switch' ? 'intra' : null;
  if (kind === null) return null;

  const eventTimeSec = (event.timeMs - APP_EPOCH_MS) / 1000;
  const timeSec = Number.isFinite(eventTimeSec) && eventTimeSec >= 0
    ? eventTimeSec
    : state.simTimeSec;

  return {
    id: `live-${kind}-${event.timeMs}-${event.fromSatId}-${event.fromBeamId}-${event.toSatId}-${event.toBeamId}`,
    timeSec,
    kind,
    title: kind === 'inter' ? 'Observed satellite handover' : 'Observed beam switch',
    fromLabel: formatRailBeamLabel(event.fromSatId, event.fromBeamId),
    toLabel: formatRailBeamLabel(event.toSatId, event.toBeamId),
    source: 'live-observed',
  };
}

function getModqnReplayVisualSlotDuration(slot: ModqnReplayPlaybackSlot): number {
  return slot.focusRow.handoverEventKind === 'none'
    ? MODQN_REPLAY_STABLE_SLOT_SEC
    : MODQN_REPLAY_HANDOVER_SLOT_SEC;
}

export function getModqnReplayVisualTimeline(
  model: ModqnReplayPlaybackShellModel,
  elapsedSec: number,
): ModqnReplayVisualTimeline {
  const baseSlotDurations = model.slots.map(slot => getModqnReplayVisualSlotDuration(slot));
  const baseDurationSec = baseSlotDurations.reduce((sum, durationSec) => sum + durationSec, 0);
  const displayScale = baseDurationSec > 0
    ? Math.max(1, MODQN_REPLAY_VISUAL_MIN_DISPLAY_DURATION_SEC / baseDurationSec)
    : 1;
  let cursorSec = 0;
  const slotMidpointSecByIndex = new Map<number, number>();
  for (let index = 0; index < model.slots.length; index += 1) {
    const slot = model.slots[index];
    if (slot === undefined) continue;
    const baseDurationSec = baseSlotDurations[index] ?? 0;
    const durationSec = baseDurationSec * displayScale;
    slotMidpointSecByIndex.set(slot.slotIndex, cursorSec + (durationSec / 2));
    cursorSec += durationSec;
  }

  const roundedCursorSec = Number(cursorSec.toFixed(6));
  const durationSec = Number.isFinite(roundedCursorSec) && roundedCursorSec > 0 ? roundedCursorSec : 0;
  return {
    durationSec,
    currentTimeSec: durationSec > 0 ? Math.max(0, elapsedSec) % durationSec : 0,
    slotMidpointSecByIndex,
  };
}

export function resolveModqnReplayVisualSlotOffset(
  model: ModqnReplayPlaybackShellModel,
  elapsedSec: number,
): number {
  if (model.slots.length === 0) return 0;

  const totalSec = model.slots.reduce(
    (sum, slot) => sum + getModqnReplayVisualSlotDuration(slot),
    0,
  );
  if (!Number.isFinite(totalSec) || totalSec <= 0) return 0;

  let cursor = Math.max(0, elapsedSec) % totalSec;
  for (let index = 0; index < model.slots.length; index += 1) {
    const slot = model.slots[index];
    if (slot === undefined) continue;
    const durationSec = getModqnReplayVisualSlotDuration(slot);
    if (cursor < durationSec) return index;
    cursor -= durationSec;
  }

  return Math.max(0, model.slots.length - 1);
}
