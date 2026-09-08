// windowReplayCue.ts — P3 slice-3 pure display adapter.
//
// Derives the replay-proof lane's cue from the SAME recorded window frame the
// scene renders, for a focus UE. It replaces the baseline JSONL decision (a single
// `sat-0` row that had nothing to do with the on-screen window field) so the cue and
// the scene tell one consistent story (frontend-change-contract Rule#6 — no lie).
//
// DISPLAY-ONLY (Rule#7): it reads producer served / serving / target truth already
// baked into the window frame and derives no channel metric, no scalarized objective,
// no policy. A plain data->data function — NO React / Three / engine / scene / viz /
// app import (locked by the coverage validator).

export type WindowReplayCueEventKind =
  | 'intra-satellite-beam-switch'
  | 'inter-satellite-handover'
  | 'serving-beam-hold';

/** How the focus UE for the cue was chosen (honest provenance of the pick). */
export type WindowReplayCueFocusSelection = 'elevated' | 'handover' | 'primary';

/**
 * Minimal structural view of ONE recorded-window UE row — producer truth only.
 * `NormalizedUe` (the scene frame's UE) is structurally assignable to this, so App
 * passes the memoised window frame straight through with no adapter/normalizer coupling.
 */
export interface WindowReplayCueUe {
  readonly id: string;
  readonly servingSatelliteId: string;
  readonly servingBeamId: string;
  readonly targetSatelliteId: string | null;
  readonly targetBeamId: string | null;
  /** Producer coverage truth when the window carries it (H2 scene payloads). */
  readonly served?: boolean;
  readonly starved?: boolean;
  readonly decisionRef?: string;
}

/** Minimal structural view of a recorded-window frame (NormalizedSceneFrame-compatible). */
export interface WindowReplayCueFrame {
  readonly frameIndex: number;
  readonly tSec: number;
  readonly ues: readonly WindowReplayCueUe[];
}

export interface WindowReplayCue {
  readonly focusUeId: string;
  readonly focusSelection: WindowReplayCueFocusSelection;
  readonly frameIndex: number;
  readonly tSec: number;
  readonly served: boolean;
  readonly starved: boolean;
  readonly servingSatelliteId: string;
  readonly servingBeamId: string;
  readonly servingBeamLabel: string;
  readonly targetSatelliteId: string | null;
  readonly targetBeamId: string | null;
  readonly targetBeamLabel: string | null;
  readonly eventKind: WindowReplayCueEventKind;
  readonly decisionRef: string | null;
}

// "sat-73-beam-24" -> "B24"; falls back to the raw id when it does not parse.
function beamLabel(beamId: string | null): string | null {
  if (beamId === null) return null;
  const match = /beam-(\d+)$/.exec(beamId);
  return match ? `B${match[1]}` : beamId;
}

function isPendingHandover(ue: WindowReplayCueUe): boolean {
  return ue.targetBeamId !== null && ue.targetBeamId !== ue.servingBeamId;
}

function classifyEvent(ue: WindowReplayCueUe): WindowReplayCueEventKind {
  if (!isPendingHandover(ue)) return 'serving-beam-hold';
  const interSatellite =
    ue.targetSatelliteId !== null && ue.targetSatelliteId !== ue.servingSatelliteId;
  return interSatellite ? 'inter-satellite-handover' : 'intra-satellite-beam-switch';
}

/**
 * Focus-UE selection (SDD §2): the elevated UE if the user pinned one, else a UE
 * mid-handover this frame (the most cue-worthy), else the primary UE. Returns null
 * only for an empty frame.
 */
function pickFocusUe(
  ues: readonly WindowReplayCueUe[],
  focusUeId: string | null,
): { readonly ue: WindowReplayCueUe; readonly selection: WindowReplayCueFocusSelection } | null {
  if (ues.length === 0) return null;
  if (focusUeId !== null) {
    const elevated = ues.find(candidate => candidate.id === focusUeId);
    if (elevated !== undefined) return { ue: elevated, selection: 'elevated' };
  }
  const handingOver = ues.find(isPendingHandover);
  if (handingOver !== undefined) return { ue: handingOver, selection: 'handover' };
  return { ue: ues[0], selection: 'primary' };
}

/**
 * Build the window cue for a focus UE from a recorded-window frame. Pure: every
 * field is read straight off the producer UE row (served/serving/target); nothing
 * is inferred. Returns null for a missing/empty frame (the caller falls back to the
 * baseline cue).
 */
export function deriveWindowReplayCue(
  frame: WindowReplayCueFrame | null,
  focusUeId: string | null,
): WindowReplayCue | null {
  if (frame === null) return null;
  const pick = pickFocusUe(frame.ues, focusUeId);
  if (pick === null) return null;
  const { ue, selection } = pick;
  const starved = ue.starved ?? false;
  const served = ue.served ?? !starved;
  return {
    focusUeId: ue.id,
    focusSelection: selection,
    frameIndex: frame.frameIndex,
    tSec: frame.tSec,
    served,
    starved,
    servingSatelliteId: ue.servingSatelliteId,
    servingBeamId: ue.servingBeamId,
    servingBeamLabel: beamLabel(ue.servingBeamId) ?? ue.servingBeamId,
    targetSatelliteId: ue.targetSatelliteId,
    targetBeamId: ue.targetBeamId,
    targetBeamLabel: beamLabel(ue.targetBeamId),
    eventKind: classifyEvent(ue),
    decisionRef: ue.decisionRef ?? null,
  };
}
