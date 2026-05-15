// MODQN ω-Handover S1 + S2 — sidebar truth-up hook.
//
// Owns:
//   * ω draft / active state (RuntimeOmegaState)
//   * omegaSource lineage (bundle / user-applied / user-applied-not-paper)
//   * The runtime handover mode (RuntimeHandoverMode), in-memory only this slice
//   * The bundle sidebar snapshot: ModqnPolicyDiagnostics + manifest fields the
//     evidence tab displays (paperId, bundleSchemaVersion, baselineSurface)
//
// S2 internal change (SDD §9.3):
//   * `getBundleSidebarSnapshot(envelope, slotOffset)` reads envelope-level
//     diagnostics (`ModqnReplayEnvelopeProducerTruth.policyDiagnostics`) plus
//     the current-slot row's `policyDiagnostics`. When called with no envelope
//     (e.g. test mounts, headless renders) the function falls back to a
//     paper-default synthesized snapshot so S1 validator continues to pass and
//     the demo still renders if the fetch is in flight.
//   * `useModqnHandoverState()` now subscribes to a `ModqnEnvelopeContext`.
//     Until App.tsx provides an envelope (S2 fetch landing), the context value
//     is `null` and the hook behaves identically to S1.
//   * Exported hook surface unchanged — S3/S4 lock onto the shape this slice
//     left behind.
//
// Notes for S3/S4 readers:
//   * S1 does NOT subscribe an engine consumer to `omegaActive` / `mode`.
//     Apply/Reset/setMode mutate hook state and that is it.
//   * S3 will install an engine override that reads `omegaActive` and triggers
//     bundle re-scalarization. S4 will add the omega-heuristic decision path
//     plus the four-line disclosure (banner / capture metadata / non-persistence
//     / naming) from SDD §4.4. Neither slice should need to change this hook's
//     return signature.
//
// References: docs/modqn-omega-handover-sdd.md §3.1 (ω fields), §3.5 (Apply
// semantics), §5.2 (RuntimeOmegaState / RuntimeHandoverMode), §9.2 (S1
// acceptance), §9.3 (S2 acceptance), §12.8 (paper default ω).
import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  MODQN_BASELINE_BEAMS_PER_SATELLITE,
  MODQN_TOTAL_BASELINE_BEAMS,
} from '../modqn/replay-bundle/identity';
import {
  MODQN_PHASE7F_REPLAY_PLAYBACK_SHELL_MODEL,
} from '../modqn/replay-bundle/playback-shell';
import {
  SELECTED_MODQN_PHASE7C_REPLAY_BUNDLE_PATH,
  type ModqnReplayEnvelope,
} from '../modqn/replay-bundle/replay-state';
import {
  MODQN_PAPER_ID,
  MODQN_REPLAY_BUNDLE_SCHEMA_VERSION,
  type ModqnBaselineSurface,
  type ModqnPaperId,
  type ModqnPolicyDiagnostics,
  type ModqnReplayBundleSchemaVersion,
} from '../modqn/replay-bundle/types';

// Three modes from SDD §3.2. S1 holds the type + the local state. S3 wires
// `modqn-replay` to the override hook from S0. S4 wires `omega-heuristic`.
export type RuntimeHandoverMode =
  | 'sinr-offset'
  | 'modqn-replay'
  | 'omega-heuristic';

export const DEFAULT_RUNTIME_HANDOVER_MODE: RuntimeHandoverMode = 'sinr-offset';

// MODQN paper-faithful training-time ω, from SDD §12.8.
export const MODQN_PAPER_FAITHFUL_OMEGA = Object.freeze({
  throughput: 0.4,
  handover: 0.3,
  loadBalance: 0.3,
});

// `omegaSource` is a 3-value lineage tag per the S1 prompt contract.
// SDD §5.2 sketches a 4-value enum that further splits the user-applied state
// by mode; the S1 prompt collapses that to 3. S3/S4 may need to widen this
// when they wire mode-specific source tracking.
export type RuntimeOmegaSource =
  | 'bundle'
  | 'user-applied'
  | 'user-applied-not-paper';

export interface RuntimeOmegaState {
  readonly throughput: number;
  readonly handover: number;
  readonly loadBalance: number;
}

// `snapshotOrigin` is a S2 marker that the validator uses to prove the hook's
// `bundlePolicyDiagnostics` flowed through the runtime envelope path rather
// than the S1 paper-default synthesizer. It is namespaced on the
// `ModqnPolicyDiagnostics.diagnosticsVersion` field via a fixed prefix.
export const S1_PAPER_DEFAULT_DIAGNOSTICS_VERSION = 's1-sidebar-snapshot-paper-default' as const;
export const S2_ENVELOPE_DIAGNOSTICS_VERSION_PREFIX = 's2-envelope-row:' as const;

// Snapshot of the bundle fields the sidebar evidence tab displays. S1 reads
// this from a paper-faithful constants accessor + the existing shell model.
// S2 reads it from the runtime envelope when available; the interface remains
// stable across that swap.
export interface BundleSidebarSnapshot {
  readonly paperId: ModqnPaperId;
  readonly bundleSchemaVersion: ModqnReplayBundleSchemaVersion;
  readonly baselineSurface: Pick<
    ModqnBaselineSurface,
    'beamCountPerSatellite' | 'totalBeamCount' | 'episodesCompleted' | 'satelliteCount'
  >;
  readonly policyDiagnostics: ModqnPolicyDiagnostics;
  readonly sourcePath: string;
  readonly rowCount: number;
  readonly slotCount: number;
}

export interface UseModqnHandoverState {
  readonly omegaDraft: RuntimeOmegaState;
  readonly omegaActive: RuntimeOmegaState;
  readonly omegaSource: RuntimeOmegaSource;
  readonly bundlePolicyDiagnostics: ModqnPolicyDiagnostics | null;
  readonly bundleSidebarSnapshot: BundleSidebarSnapshot | null;
  readonly setOmegaDraft: (next: RuntimeOmegaState) => void;
  readonly applyOmega: () => void;
  readonly resetOmega: () => void;
  readonly mode: RuntimeHandoverMode;
  readonly setMode: (next: RuntimeHandoverMode) => void;
}

export interface ModqnEnvelopeContextValue {
  readonly envelope: ModqnReplayEnvelope | null;
  readonly slotOffset: number;
}

const DEFAULT_ENVELOPE_CONTEXT: ModqnEnvelopeContextValue = {
  envelope: null,
  slotOffset: 0,
};

const ModqnEnvelopeContext = createContext<ModqnEnvelopeContextValue>(
  DEFAULT_ENVELOPE_CONTEXT,
);

export interface ModqnEnvelopeProviderProps {
  readonly envelope: ModqnReplayEnvelope | null;
  readonly slotOffset?: number;
  readonly children: ReactNode;
}

export function ModqnEnvelopeProvider({
  envelope,
  slotOffset = 0,
  children,
}: ModqnEnvelopeProviderProps) {
  const value = useMemo(
    () => ({ envelope, slotOffset }),
    [envelope, slotOffset],
  );
  // Use createElement to keep this module .ts (the S1 validator imports it
  // from `useModqnHandoverState.ts`; renaming would break that import).
  return createElement(
    ModqnEnvelopeContext.Provider,
    { value },
    children,
  );
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

function normalizeOmega(state: RuntimeOmegaState): RuntimeOmegaState {
  return {
    throughput: clamp01(state.throughput),
    handover: clamp01(state.handover),
    loadBalance: clamp01(state.loadBalance),
  };
}

function omegaFromObjectiveWeights(
  weights: ModqnPolicyDiagnostics['objectiveWeights'] | undefined,
): RuntimeOmegaState {
  // SDD §3.1 names the ω vector with `throughput / handover / loadBalance`
  // labels at the consumer side. The producer bundle's reward vector uses
  // `r1Throughput / r2Handover / r3LoadBalance` — see playback-shell.ts top-K
  // fixtures. We accept either spelling so the hook is forward-compatible
  // with a future producer that emits the cleaner naming directly.
  const throughputCandidate = weights?.throughput ?? weights?.r1Throughput;
  const handoverCandidate = weights?.handover ?? weights?.r2Handover;
  const loadBalanceCandidate = weights?.loadBalance ?? weights?.r3LoadBalance;

  return normalizeOmega({
    throughput: throughputCandidate ?? MODQN_PAPER_FAITHFUL_OMEGA.throughput,
    handover: handoverCandidate ?? MODQN_PAPER_FAITHFUL_OMEGA.handover,
    loadBalance: loadBalanceCandidate ?? MODQN_PAPER_FAITHFUL_OMEGA.loadBalance,
  });
}

function omegaEquals(left: RuntimeOmegaState, right: RuntimeOmegaState): boolean {
  return left.throughput === right.throughput
    && left.handover === right.handover
    && left.loadBalance === right.loadBalance;
}

function getPaperDefaultBundleSidebarSnapshot(): BundleSidebarSnapshot {
  // S1 paper-default fallback. Used when the runtime fetch has not yet landed
  // (or in headless validators / tests without an envelope). The diagnostics
  // version string is the S1 marker that the S2 validator uses to confirm the
  // hook switched to envelope-read semantics under context.
  const shell = MODQN_PHASE7F_REPLAY_PLAYBACK_SHELL_MODEL;
  const policyDiagnostics: ModqnPolicyDiagnostics = {
    diagnosticsVersion: S1_PAPER_DEFAULT_DIAGNOSTICS_VERSION,
    objectiveWeights: {
      throughput: MODQN_PAPER_FAITHFUL_OMEGA.throughput,
      handover: MODQN_PAPER_FAITHFUL_OMEGA.handover,
      loadBalance: MODQN_PAPER_FAITHFUL_OMEGA.loadBalance,
    },
  };

  return {
    paperId: MODQN_PAPER_ID,
    bundleSchemaVersion: MODQN_REPLAY_BUNDLE_SCHEMA_VERSION,
    baselineSurface: {
      beamCountPerSatellite: MODQN_BASELINE_BEAMS_PER_SATELLITE,
      totalBeamCount: MODQN_TOTAL_BASELINE_BEAMS,
      // The shell model does not surface episodesCompleted yet. S2 will read
      // it from manifest.baselineSurface.episodesCompleted when an envelope is
      // present; until then the sidebar uses the shell's slotCount as an
      // evidence-coherent proxy of recorded replay slots.
      episodesCompleted: shell.slotCount,
      satelliteCount: 4,
    },
    policyDiagnostics,
    sourcePath: shell.sourcePath,
    rowCount: shell.rowCount,
    slotCount: shell.slotCount,
  };
}

function clampSlotOffset(envelope: ModqnReplayEnvelope, slotOffset: number): number {
  const max = Math.max(envelope.replaySlots.length - 1, 0);
  return Math.min(Math.max(Math.trunc(slotOffset), 0), max);
}

function getEnvelopeBundleSidebarSnapshot(
  envelope: ModqnReplayEnvelope,
  slotOffset: number,
): BundleSidebarSnapshot {
  // Pick the focus row at `slotOffset`. Falls back to the first row in slot
  // 0 if the envelope is degenerate (defensively — replay-state asserts at
  // least one row per slot, so this branch should not fire on accepted
  // bundles).
  const safeSlotOffset = clampSlotOffset(envelope, slotOffset);
  const slot = envelope.replaySlots[safeSlotOffset] ?? envelope.replaySlots[0];
  const row = slot?.rows[0];

  // Envelope-level / per-row policyDiagnostics — SDD §9.3.
  //   * `row.producerTruth.policyDiagnostics` — per-row, may be undefined for
  //     a producer who skipped the optional surface.
  //   * `envelope.replaySlots[0].rows[0].producerTruth.policyDiagnostics` is
  //     the "envelope-level" approximation (slot 0 row 0) used as the bundle's
  //     training-time ω anchor when no slot is active yet. SDD §3.1 names
  //     `ModqnPolicyDiagnostics.objectiveWeights` as the training-time ω
  //     record; the producer pipeline keeps that constant across rows.
  const envelopeAnchorRow = envelope.replaySlots[0]?.rows[0];
  const envelopeAnchorDiagnostics = envelopeAnchorRow?.producerTruth.policyDiagnostics;
  const rowDiagnostics = row?.producerTruth.policyDiagnostics;

  // Merge: prefer the current-slot row's diagnostics but fall back to the
  // envelope anchor for objective weights (required by the sidebar even when
  // a row has no top-K). The S2 validator confirms the resulting diagnostics
  // version is namespaced with the envelope-row prefix and not the S1
  // paper-default version.
  const effectiveObjectiveWeights =
    rowDiagnostics?.objectiveWeights
    ?? envelopeAnchorDiagnostics?.objectiveWeights;

  const mergedDiagnostics: ModqnPolicyDiagnostics = rowDiagnostics === undefined
    ? {
        diagnosticsVersion: `${S2_ENVELOPE_DIAGNOSTICS_VERSION_PREFIX}slot-${safeSlotOffset}-missing`,
        ...(effectiveObjectiveWeights === undefined
          ? {}
          : { objectiveWeights: effectiveObjectiveWeights }),
      }
    : {
        ...rowDiagnostics,
        diagnosticsVersion: `${S2_ENVELOPE_DIAGNOSTICS_VERSION_PREFIX}slot-${safeSlotOffset}`,
        ...(rowDiagnostics.objectiveWeights === undefined && effectiveObjectiveWeights !== undefined
          ? { objectiveWeights: effectiveObjectiveWeights }
          : {}),
      };

  const manifestBaselineSurface = envelopeAnchorRow !== undefined
    ? envelope.diagnostics.adapter
    : null;

  // Source-of-truth fields are envelope-derived. Manifest's beamCountPerSatellite
  // /totalBeamCount are echoed via the envelope diagnostics. episodesCompleted
  // is not surfaced via the envelope; we fall back to slotCount the same way
  // S1 did, so the evidence tab continues to render an integer.
  return {
    paperId: envelope.paperId,
    bundleSchemaVersion: envelope.sourceSchemaVersion,
    baselineSurface: {
      beamCountPerSatellite:
        manifestBaselineSurface?.beamCountPerSatellite ?? MODQN_BASELINE_BEAMS_PER_SATELLITE,
      totalBeamCount:
        manifestBaselineSurface?.totalBeamCount ?? MODQN_TOTAL_BASELINE_BEAMS,
      episodesCompleted:
        manifestBaselineSurface?.slotCount ?? envelope.replaySlots.length,
      satelliteCount: manifestBaselineSurface?.satelliteCount ?? 4,
    },
    policyDiagnostics: mergedDiagnostics,
    sourcePath: envelope.sourcePath,
    rowCount: envelope.diagnostics.adapter.rowCount,
    slotCount: envelope.diagnostics.adapter.slotCount,
  };
}

// S1 + S2 sidebar snapshot accessor. When called with no arguments it returns
// the paper-default fallback (preserves S1 validator + headless renders that
// pre-date the runtime fetch). When called with an envelope it routes through
// `getEnvelopeBundleSidebarSnapshot` to surface envelope-level + current-slot
// row policy diagnostics.
//
// SDD §9.3: "S2 replaces the synthesis with envelope reads … surfaces at least
// the current-slot row's policyDiagnostics through the existing
// getBundleSidebarSnapshot() accessor without changing the hook's return
// shape".
export function getBundleSidebarSnapshot(
  envelope?: ModqnReplayEnvelope | null,
  slotOffset?: number,
): BundleSidebarSnapshot {
  if (envelope === null || envelope === undefined) {
    return getPaperDefaultBundleSidebarSnapshot();
  }
  return getEnvelopeBundleSidebarSnapshot(envelope, slotOffset ?? 0);
}

// Reference path constant re-export so consumers don't have to reach into
// replay-state.ts to know which artifact path the hook is anchored on.
export { SELECTED_MODQN_PHASE7C_REPLAY_BUNDLE_PATH };

export function useModqnHandoverState(): UseModqnHandoverState {
  const { envelope, slotOffset } = useContext(ModqnEnvelopeContext);

  // Recompute the snapshot when the envelope or current slot changes. The
  // snapshot is stable as long as both inputs are stable; this keeps the hook
  // surface side-effect-free for S3/S4 to compose with.
  const bundleSidebarSnapshot = useMemo<BundleSidebarSnapshot>(
    () => getBundleSidebarSnapshot(envelope, slotOffset),
    [envelope, slotOffset],
  );

  const bundleOmega = useMemo<RuntimeOmegaState>(
    () => omegaFromObjectiveWeights(bundleSidebarSnapshot.policyDiagnostics.objectiveWeights),
    [bundleSidebarSnapshot],
  );

  const [omegaDraft, setOmegaDraftState] = useState<RuntimeOmegaState>(bundleOmega);
  const [omegaActive, setOmegaActive] = useState<RuntimeOmegaState>(bundleOmega);
  const [omegaSource, setOmegaSource] = useState<RuntimeOmegaSource>('bundle');
  const [mode, setMode] = useState<RuntimeHandoverMode>(DEFAULT_RUNTIME_HANDOVER_MODE);

  // When the envelope arrives (or the slot moves), re-anchor the bundle ω
  // baseline for Apply/Reset bookkeeping. We only update state if the user has
  // not edited the ω draft since the last bundle anchor (omegaSource ===
  // 'bundle'), so the user's in-flight changes survive an envelope swap.
  const lastAnchorOmegaRef = useRef<RuntimeOmegaState>(bundleOmega);
  if (!omegaEquals(lastAnchorOmegaRef.current, bundleOmega) && omegaSource === 'bundle') {
    lastAnchorOmegaRef.current = bundleOmega;
    setOmegaDraftState(bundleOmega);
    setOmegaActive(bundleOmega);
  } else if (!omegaEquals(lastAnchorOmegaRef.current, bundleOmega)) {
    // Track the new bundle anchor without overwriting user state, so a later
    // Reset still returns to the envelope-derived ω.
    lastAnchorOmegaRef.current = bundleOmega;
  }

  const setOmegaDraft = useCallback((next: RuntimeOmegaState) => {
    setOmegaDraftState(normalizeOmega(next));
  }, []);

  // SDD §3.5: Apply commits draft → active. omegaSource becomes 'user-applied'
  // unless the draft is identical to the bundle's training-time ω.
  // S4 will replace 'user-applied' with 'user-applied-not-paper' when the
  // active mode is `omega-heuristic`. For S1/S2 (mode default `sinr-offset`),
  // 'user-applied' covers both modqn-replay and sinr-offset edits.
  const applyOmega = useCallback(() => {
    setOmegaActive(omegaDraft);
    if (omegaEquals(omegaDraft, bundleOmega)) {
      setOmegaSource('bundle');
    } else if (mode === 'omega-heuristic') {
      setOmegaSource('user-applied-not-paper');
    } else {
      setOmegaSource('user-applied');
    }
  }, [bundleOmega, mode, omegaDraft]);

  // SDD §3.5: Reset returns BOTH omegaDraft and omegaActive to the bundle ω.
  const resetOmega = useCallback(() => {
    setOmegaDraftState(bundleOmega);
    setOmegaActive(bundleOmega);
    setOmegaSource('bundle');
  }, [bundleOmega]);

  const bundlePolicyDiagnostics = bundleSidebarSnapshot.policyDiagnostics;

  return {
    omegaDraft,
    omegaActive,
    omegaSource,
    bundlePolicyDiagnostics,
    bundleSidebarSnapshot,
    setOmegaDraft,
    applyOmega,
    resetOmega,
    mode,
    setMode,
  };
}
