/**
 * Recorded-replay served/starved field colour (P2 replay stage) — pure, display-only.
 *
 * The MODQN replay STAGE (`modqn-replay-proof` lane) colours each recorded UE by a
 * LIFE/DEATH encoding: a served UE renders GREEN, a starved UE renders RED. This is
 * the sim's signature "red sea → green" beat — the abstract coverage improvement made
 * instantly visible, one dot per person.
 *
 * Colour SOURCE (H2 onward): the recorded window carries PRODUCER coverage truth per
 * UE (`served` / `starved`, joined from the kpiOverlay step-trace). When present, the
 * field colours by THAT producer truth — this is the real coverage win axis, not an
 * invented threshold. Only when a window lacks the flags (older windows) does the field
 * fall back to a display sinr-floor proxy (`channelMetric.dB` ≥ floor ⇒ green).
 *
 * Honesty (frontend-change-contract Rule#7 / CLAUDE.md Rule#2):
 * - Display-ONLY. It READS producer `served` / `starved` (or, in fallback, the recorded
 *   per-UE SINR) purely to PICK a marker colour. It computes no SINR and no coverage,
 *   and alters no serving / handover / decode / geometry / provenance value. Carrying a
 *   producer boolean into a colour is strictly more honest than the old sinr-floor proxy.
 * - The sinr-floor is a DISPLAY threshold used only as the legacy fallback (SINR below
 *   ~0 dB ⇒ below the noise floor ⇒ can't decode ⇒ "starved"); it is not a producer QoS
 *   truth and never feeds any truth surface.
 */

/** Display served-floor (LEGACY FALLBACK only): SINR at/above renders GREEN, below RED. */
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
  /**
   * Producer coverage truth (kpiOverlay), when the recorded window carries it.
   * `served` / `starved` are complementary; either one settles the colour and
   * takes precedence over the sinr-floor fallback.
   */
  readonly served?: boolean;
  readonly starved?: boolean;
}

const SERVED_MARKER: ReplayFieldMarkerColor = {
  markerColor: REPLAY_FIELD_SERVED_COLOR,
  markerEmissive: REPLAY_FIELD_SERVED_EMISSIVE,
};
const STARVED_MARKER: ReplayFieldMarkerColor = {
  markerColor: REPLAY_FIELD_STARVED_COLOR,
  markerEmissive: REPLAY_FIELD_STARVED_EMISSIVE,
};

/**
 * Producer served truth for a UE, or `undefined` when the window carries neither
 * flag. `served` wins if present; otherwise `starved` is inverted.
 */
function producerServed(ue: ReplayFieldUeInput): boolean | undefined {
  if (typeof ue.served === 'boolean') return ue.served;
  if (typeof ue.starved === 'boolean') return !ue.starved;
  return undefined;
}

/**
 * True when the UE renders RED. Prefers producer `served` / `starved` truth;
 * falls back to the display sinr-floor proxy only when neither flag is present.
 */
export function isReplayFieldStarved(ue: ReplayFieldUeInput): boolean {
  const served = producerServed(ue);
  if (served !== undefined) return !served;
  const dB = ue.channelMetric.dB;
  return !(Number.isFinite(dB) && dB >= REPLAY_FIELD_SERVED_SINR_FLOOR_DB);
}

/**
 * LEGACY FALLBACK colour: green if the recorded SINR clears the served floor,
 * else red. Used only for windows without producer coverage flags.
 */
export function replayFieldColorForSinrDb(sinrDb: number): ReplayFieldMarkerColor {
  return Number.isFinite(sinrDb) && sinrDb >= REPLAY_FIELD_SERVED_SINR_FLOOR_DB
    ? SERVED_MARKER
    : STARVED_MARKER;
}

/** Marker colour for one UE: producer served/starved truth when present, else sinr-floor. */
export function replayFieldColorForUe(ue: ReplayFieldUeInput): ReplayFieldMarkerColor {
  return isReplayFieldStarved(ue) ? STARVED_MARKER : SERVED_MARKER;
}

/** Per-UE served/starved marker colours keyed by UE id, for the recorded replay field. */
export function buildReplayServedStarvedColorMap(
  ues: ReadonlyArray<ReplayFieldUeInput>,
): Map<string, ReplayFieldMarkerColor> {
  const out = new Map<string, ReplayFieldMarkerColor>();
  for (const ue of ues) {
    out.set(ue.id, replayFieldColorForUe(ue));
  }
  return out;
}

/** Count of starved (red) UEs — for an honest on-screen "N starved" readout / telemetry. */
export function countStarvedUes(ues: ReadonlyArray<ReplayFieldUeInput>): number {
  let starved = 0;
  for (const ue of ues) {
    if (isReplayFieldStarved(ue)) starved += 1;
  }
  return starved;
}
