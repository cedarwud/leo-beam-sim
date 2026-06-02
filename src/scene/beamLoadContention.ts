// Phase 3 beam-load contention (the paper's r3 load-balance story: #UEs sharing
// each serving beam). STEP 0 / INV-3: this is producer-backed/real because it is
// a COUNT of AUTHORITATIVE per-UE serving assignments — NOT display-invented
// queue depth, and NOT the nearest-display-cell projection (ModqnServiceMap's
// `ueCountByCellId`), which can split UEs that share one serving beam across
// different display cells and so misrepresent beam load (codex S2 [P2]).
//
// Authoritative source = per-UE serving (satId, beamId): live runtime
// `perUePositions[i].servingSatId/servingBeamId` (HandoverManager truth) or
// replay `allUeServingHistory` (visual-showcase-v1 producer-backed). This module
// stays lane-agnostic: callers adapt their lane's serving to UeServingAssignment.

// servingBeamId is source-agnostic: the live runtime emits numeric local beam
// IDs (`runtimeUeFrame.ts` / HandoverManager), while visual-showcase-v1 replay
// emits canonical producer string IDs (e.g. `sat-0-beam-4`). beamKeyOf folds
// both into a stable string key — never coerce with Number() (that would NaN
// the producer IDs and fabricate/lose replay load) (codex S2 [P2]).
export interface UeServingAssignment {
  readonly ueId: string;
  readonly servingSatId: string | null;
  readonly servingBeamId: number | string | null;
}

export interface UeBeamLoadContention {
  readonly ueId: string;
  readonly beamKey: string | null; // `${servingSatId}|${servingBeamId}` when served, else null
  readonly load: number; // #UEs served by THIS ue's beam (0 if unserved)
  readonly normalizedLoad: number; // load / maxLoad in [0,1] (0 when unserved or maxLoad===0)
  readonly served: boolean; // both servingSatId and servingBeamId present
}

export interface BeamLoadContentionModel {
  readonly byUeId: ReadonlyMap<string, UeBeamLoadContention>;
  readonly loadByBeamKey: ReadonlyMap<string, number>; // authoritative #UEs per serving beam
  readonly maxLoad: number; // max loadByBeamKey value (0 if none served)
  readonly servedUeCount: number; // UEs with a full (sat, beam) serving assignment
  readonly loadedBeamCount: number; // distinct serving beams with >=1 served UE
}

export const EMPTY_BEAM_LOAD_CONTENTION: BeamLoadContentionModel = {
  byUeId: new Map(),
  loadByBeamKey: new Map(),
  maxLoad: 0,
  servedUeCount: 0,
  loadedBeamCount: 0,
};

export function beamKeyOf(
  servingSatId: string | null,
  servingBeamId: number | string | null,
): string | null {
  // Absent serving = no contention. Several existing normalized-scene adapters
  // (e.g. liveSimToScene / deriveLiveSceneFields `?? ''`) use the EMPTY STRING
  // as the "no serving sat/beam" sentinel, not null — so treat '' as absent too,
  // else an unserved UE would fabricate a `|`-keyed beam load (codex S2 [P2]).
  // A numeric beam id of 0 is a real beam (0 !== ''), so it is preserved.
  if (servingSatId === null || servingSatId === '') return null;
  if (servingBeamId === null || servingBeamId === '') return null;
  return `${servingSatId}|${servingBeamId}`;
}

export function deriveBeamLoadContention(
  ues: readonly UeServingAssignment[],
): BeamLoadContentionModel {
  if (ues.length === 0) return EMPTY_BEAM_LOAD_CONTENTION;

  // Pass 1: count authoritative serving-beam membership (real assignments only).
  const loadByBeamKey = new Map<string, number>();
  let servedUeCount = 0;
  for (const ue of ues) {
    const key = beamKeyOf(ue.servingSatId, ue.servingBeamId);
    if (key === null) continue;
    loadByBeamKey.set(key, (loadByBeamKey.get(key) ?? 0) + 1);
    servedUeCount += 1;
  }

  let maxLoad = 0;
  for (const load of loadByBeamKey.values()) {
    if (load > maxLoad) maxLoad = load;
  }

  // Pass 2: project each UE onto its own beam's load. Unserved UEs stay at 0 —
  // never borrow a neighbour's load (INV-3: count, do not invent).
  const byUeId = new Map<string, UeBeamLoadContention>();
  for (const ue of ues) {
    const key = beamKeyOf(ue.servingSatId, ue.servingBeamId);
    const served = key !== null;
    const load = served ? loadByBeamKey.get(key) ?? 0 : 0;
    byUeId.set(ue.ueId, {
      ueId: ue.ueId,
      beamKey: key,
      load,
      normalizedLoad: clamp01(maxLoad > 0 ? load / maxLoad : 0),
      served,
    });
  }

  return {
    byUeId,
    loadByBeamKey,
    maxLoad,
    servedUeCount,
    loadedBeamCount: loadByBeamKey.size,
  };
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}
