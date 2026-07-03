/**
 * Recorded-replay served/starved field colour (P2 replay stage) — pure, display-only.
 *
 * The MODQN replay STAGE (`modqn-replay-proof` lane) colours each recorded UE by a
 * LIFE/DEATH encoding: a UE whose recorded SINR clears the served floor renders GREEN
 * (served), else RED (starved / buffering). This is the sim's signature "red sea → green"
 * beat — the abstract coverage improvement made instantly visible, one dot per person.
 *
 * Honesty (frontend-change-contract Rule#7 / CLAUDE.md Rule#2):
 * - Display-ONLY. It reads the already-recorded per-UE SINR (`channelMetric.dB`, producer
 *   truth from the visual-showcase-v1 window) purely to pick a marker colour. It computes
 *   no SINR, and alters no serving / handover / decode / geometry / provenance value.
 * - The served floor is a DISPLAY threshold (SINR below ~0 dB ⇒ below the noise floor ⇒
 *   can't decode ⇒ "starved"), NOT a producer QoS truth, and never feeds any truth surface.
 */

/** Display served-floor: SINR at/above this renders GREEN, below renders RED. */
export const REPLAY_FIELD_SERVED_SINR_FLOOR_DB = 0;

// Life/death field palette (display-only; distinct from the beam serving palette).
export const REPLAY_FIELD_SERVED_COLOR = '#22c55e'; // green — served
export const REPLAY_FIELD_SERVED_EMISSIVE = '#15803d';
export const REPLAY_FIELD_STARVED_COLOR = '#ef4444'; // red — starved / buffering
export const REPLAY_FIELD_STARVED_EMISSIVE = '#7f1d1d';

export interface ReplayFieldMarkerColor {
  readonly markerColor: string;
  readonly markerEmissive: string;
}

export interface ReplayFieldUeInput {
  readonly id: string;
  readonly channelMetric: { readonly dB: number };
}

/** Green if the recorded SINR clears the served floor, else red (starved). */
export function replayFieldColorForSinrDb(sinrDb: number): ReplayFieldMarkerColor {
  return Number.isFinite(sinrDb) && sinrDb >= REPLAY_FIELD_SERVED_SINR_FLOOR_DB
    ? { markerColor: REPLAY_FIELD_SERVED_COLOR, markerEmissive: REPLAY_FIELD_SERVED_EMISSIVE }
    : { markerColor: REPLAY_FIELD_STARVED_COLOR, markerEmissive: REPLAY_FIELD_STARVED_EMISSIVE };
}

/** Per-UE served/starved marker colours keyed by UE id, for the recorded replay field. */
export function buildReplayServedStarvedColorMap(
  ues: ReadonlyArray<ReplayFieldUeInput>,
): Map<string, ReplayFieldMarkerColor> {
  const out = new Map<string, ReplayFieldMarkerColor>();
  for (const ue of ues) {
    out.set(ue.id, replayFieldColorForSinrDb(ue.channelMetric.dB));
  }
  return out;
}

/** Count of starved (red) UEs — for an honest on-screen "N starved" readout / telemetry. */
export function countStarvedUes(ues: ReadonlyArray<ReplayFieldUeInput>): number {
  let starved = 0;
  for (const ue of ues) {
    if (!(Number.isFinite(ue.channelMetric.dB) && ue.channelMetric.dB >= REPLAY_FIELD_SERVED_SINR_FLOOR_DB)) {
      starved += 1;
    }
  }
  return starved;
}
