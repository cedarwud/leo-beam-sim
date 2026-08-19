import { MANUAL_HANDOVER_DISPLAY_MS } from './manualHandoverDemo';

/** Wall-clock teaching duration expressed on the moving simulation timeline. */
export const INTRA_PRESENTATION_DURATION_SEC = MANUAL_HANDOVER_DISPLAY_MS / 1000;
/** Keep a conservative simulation-time gap around a source-backed inter event. */
export const INTRA_PRESENTATION_INTER_GUARD_SEC = 45;
/** Do not turn the ambient scene into a chain of back-to-back teaching cues. */
export const INTRA_PRESENTATION_MIN_SPACING_SEC = 120;

export interface IntraPresentationSlot {
  readonly startSec: number;
  readonly endSec: number;
}

export interface BuildIntraPresentationSlotsInput {
  readonly interEventTimesSec: readonly number[];
  readonly startSec: number;
  readonly endSec: number;
  readonly durationSec?: number;
  readonly interGuardSec?: number;
  readonly minSpacingSec?: number;
  readonly maxSlots?: number;
}

/**
 * Place display-only intra stories in gaps that are disjoint from indexed
 * inter stories. The returned intervals are reservations, not handover truth:
 * they only decide when the existing manual Show Intra visual may be armed.
 */
export function buildNonOverlappingIntraPresentationSlots(
  input: BuildIntraPresentationSlotsInput,
): readonly IntraPresentationSlot[] {
  const durationSec = Number.isFinite(input.durationSec)
    ? Math.max(0, input.durationSec ?? INTRA_PRESENTATION_DURATION_SEC)
    : INTRA_PRESENTATION_DURATION_SEC;
  const guardSec = Number.isFinite(input.interGuardSec)
    ? Math.max(0, input.interGuardSec ?? INTRA_PRESENTATION_INTER_GUARD_SEC)
    : INTRA_PRESENTATION_INTER_GUARD_SEC;
  const minSpacingSec = Number.isFinite(input.minSpacingSec)
    ? Math.max(durationSec, input.minSpacingSec ?? INTRA_PRESENTATION_MIN_SPACING_SEC)
    : Math.max(durationSec, INTRA_PRESENTATION_MIN_SPACING_SEC);
  const startSec = Number.isFinite(input.startSec) ? input.startSec : 0;
  const endSec = Number.isFinite(input.endSec) ? input.endSec : startSec;
  const maxSlots = Number.isFinite(input.maxSlots)
    ? Math.max(0, Math.trunc(input.maxSlots ?? 0))
    : Number.POSITIVE_INFINITY;
  if (endSec <= startSec || durationSec <= 0 || maxSlots === 0) return [];

  const interTimes = [...new Set(input.interEventTimesSec)]
    .filter(timeSec => Number.isFinite(timeSec))
    .sort((left, right) => left - right);
  const slots: IntraPresentationSlot[] = [];
  let cursorSec = startSec;

  for (const interTimeSec of interTimes) {
    const blockedStartSec = Math.max(startSec, interTimeSec - guardSec);
    const blockedEndSec = Math.min(endSec, interTimeSec + guardSec);
    if (blockedEndSec <= startSec || blockedStartSec >= endSec) continue;

    while (
      slots.length < maxSlots
      && cursorSec + durationSec <= blockedStartSec
      && cursorSec + durationSec <= endSec
    ) {
      slots.push({ startSec: cursorSec, endSec: cursorSec + durationSec });
      cursorSec += minSpacingSec;
    }
    cursorSec = Math.max(cursorSec, blockedEndSec);
    if (slots.length >= maxSlots) return slots;
  }

  while (
    slots.length < maxSlots
    && cursorSec + durationSec <= endSec
  ) {
    slots.push({ startSec: cursorSec, endSec: cursorSec + durationSec });
    cursorSec += minSpacingSec;
  }
  return slots;
}
