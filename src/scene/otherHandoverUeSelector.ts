/**
 * Select secondary UEs whose live handover manager is still accumulating its
 * trigger time. This is a display-only projection over the existing per-UE
 * pending-target state; it does not alter serving or handover decisions.
 */

export interface OtherHandoverUeState {
  readonly id: string;
  readonly pendingTargetSatId: string | null;
  readonly triggerProgressSec: number;
}

export interface SelectOtherHandoverUeIdsInput {
  readonly ues: ReadonlyArray<OtherHandoverUeState>;
  readonly primaryUeId: string | undefined;
  readonly triggerTimeSec: number;
  readonly maxOtherHandoverUes: number;
}

function isOngoingHandover(
  ue: OtherHandoverUeState,
  triggerTimeSec: number,
): boolean {
  return ue.pendingTargetSatId !== null
    && ue.pendingTargetSatId.length > 0
    && Number.isFinite(triggerTimeSec)
    && triggerTimeSec > 0
    && Number.isFinite(ue.triggerProgressSec)
    && ue.triggerProgressSec >= 0
    // A manager clears pendingTarget on commit; the strict bound also fails
    // closed if a just-committed snapshot is observed before that clear.
    && ue.triggerProgressSec < triggerTimeSec;
}

function resolveCap(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.floor(value));
}

/**
 * Return stable UE ids for the display filter. Higher trigger progress wins;
 * ties retain the source UE order, which is stable across frame updates.
 */
export function selectOtherHandoverUeIds(
  input: SelectOtherHandoverUeIdsInput,
): readonly string[] {
  const cap = resolveCap(input.maxOtherHandoverUes);
  if (cap === 0) return [];

  return input.ues
    .map((ue, sourceIndex) => ({ ue, sourceIndex }))
    .filter(({ ue }) => ue.id !== input.primaryUeId && isOngoingHandover(ue, input.triggerTimeSec))
    .sort((left, right) => (
      right.ue.triggerProgressSec - left.ue.triggerProgressSec
      || left.sourceIndex - right.sourceIndex
      || left.ue.id.localeCompare(right.ue.id)
    ))
    .slice(0, cap)
    .map(({ ue }) => ue.id);
}

/**
 * Apply the checkbox display policy to renderer-facing UEs. An empty secondary
 * selection means "no concurrent secondary handover right now", not "hide all
 * UEs", so the normal population remains visible until a match exists.
 */
export function filterOtherHandoverDisplayUes<T extends { readonly id: string }>(
  ues: readonly T[],
  primaryUeId: string | undefined,
  selectedOtherUeIds: ReadonlySet<string>,
): readonly T[] {
  if (selectedOtherUeIds.size === 0) return ues;
  return ues.filter(ue => ue.id === primaryUeId || selectedOtherUeIds.has(ue.id));
}

/**
 * Attach the display-only cue state after filtering. The primary UE is never
 * marked as an "other" handover UE, even if a malformed selection contains its
 * id. Keeping this annotation explicit prevents the renderer from inferring
 * handover state from array position or marker colour.
 */
export function annotateOtherHandoverDisplayUes<T extends { readonly id: string }>(
  ues: readonly T[],
  primaryUeId: string | undefined,
  selectedOtherUeIds: ReadonlySet<string>,
): readonly (T & { readonly isOtherHandover: boolean })[] {
  return ues.map(ue => ({
    ...ue,
    isOtherHandover: ue.id !== primaryUeId && selectedOtherUeIds.has(ue.id),
  }));
}
