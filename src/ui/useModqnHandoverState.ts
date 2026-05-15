// MODQN ω-Handover S1 — sidebar truth-up hook.
//
// Owns:
//   * ω draft / active state (RuntimeOmegaState)
//   * omegaSource lineage (bundle / user-applied / user-applied-not-paper)
//   * The runtime handover mode (RuntimeHandoverMode), in-memory only this slice
//   * The bundle sidebar snapshot: ModqnPolicyDiagnostics + manifest fields the
//     evidence tab displays (paperId, bundleSchemaVersion, baselineSurface)
//
// Notes for S2/S3/S4 readers:
//   * S1 does NOT subscribe an engine consumer to `omegaActive` / `mode`.
//     Apply/Reset/setMode mutate hook state and that is it.
//   * S2 will replace `getBundleSidebarSnapshot` with the runtime fetch of the
//     real envelope from `src/modqn/replay-bundle/replay-state.ts`. The
//     `BundleSidebarSnapshot` shape returned by this accessor is the hook's
//     contract surface; do not widen it without a follow-up SDD revision.
//   * S3 will install an engine override that reads `omegaActive` and triggers
//     bundle re-scalarization. S4 will add the omega-heuristic decision path
//     plus the four-line disclosure (banner / capture metadata / non-persistence
//     / naming) from SDD §4.4. Neither slice should need to change this hook's
//     return signature.
//
// References: docs/modqn-omega-handover-sdd.md §3.1 (ω fields), §3.5 (Apply
// semantics), §5.2 (RuntimeOmegaState / RuntimeHandoverMode), §9.2 (S1
// acceptance), §12.8 (paper default ω).
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  MODQN_BASELINE_BEAMS_PER_SATELLITE,
  MODQN_TOTAL_BASELINE_BEAMS,
} from '../modqn/replay-bundle/identity';
import {
  MODQN_PHASE7F_REPLAY_PLAYBACK_SHELL_MODEL,
} from '../modqn/replay-bundle/playback-shell';
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

// Snapshot of the bundle fields the sidebar evidence tab displays. S1 reads
// this from a paper-faithful constants accessor + the existing shell model.
// S2 will swap the accessor for the runtime envelope; this interface remains
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

// S1 sidebar snapshot accessor. Synthesizes the manifest + policy diagnostics
// fields the evidence tab displays. The shell model in playback-shell.ts is
// the runtime accessor today; the paper-faithful ω + ID constants come from
// types.ts + identity.ts + SDD §12.8. S2 will replace this with a read from
// the runtime envelope (`ModqnReplayEnvelope.paperId`, `.sourceSchemaVersion`,
// `.diagnostics.adapter.*`, plus per-row `policyDiagnostics.objectiveWeights`).
export function getBundleSidebarSnapshot(): BundleSidebarSnapshot {
  const shell = MODQN_PHASE7F_REPLAY_PLAYBACK_SHELL_MODEL;
  const policyDiagnostics: ModqnPolicyDiagnostics = {
    diagnosticsVersion: 's1-sidebar-snapshot-paper-default',
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
      // it from manifest.baselineSurface.episodesCompleted; until then the
      // sidebar uses the shell's slotCount as an evidence-coherent proxy of
      // recorded replay slots, surfaced under the same row.
      episodesCompleted: shell.slotCount,
      satelliteCount: 4,
    },
    policyDiagnostics,
    sourcePath: shell.sourcePath,
    rowCount: shell.rowCount,
    slotCount: shell.slotCount,
  };
}

export function useModqnHandoverState(): UseModqnHandoverState {
  const snapshotRef = useRef<BundleSidebarSnapshot | null>(null);
  if (snapshotRef.current === null) {
    snapshotRef.current = getBundleSidebarSnapshot();
  }
  const bundleSidebarSnapshot = snapshotRef.current;

  const bundleOmega = useMemo<RuntimeOmegaState>(
    () => omegaFromObjectiveWeights(bundleSidebarSnapshot?.policyDiagnostics.objectiveWeights),
    [bundleSidebarSnapshot],
  );

  const [omegaDraft, setOmegaDraftState] = useState<RuntimeOmegaState>(bundleOmega);
  const [omegaActive, setOmegaActive] = useState<RuntimeOmegaState>(bundleOmega);
  const [omegaSource, setOmegaSource] = useState<RuntimeOmegaSource>('bundle');
  const [mode, setMode] = useState<RuntimeHandoverMode>(DEFAULT_RUNTIME_HANDOVER_MODE);

  const setOmegaDraft = useCallback((next: RuntimeOmegaState) => {
    setOmegaDraftState(normalizeOmega(next));
  }, []);

  // SDD §3.5: Apply commits draft → active. omegaSource becomes 'user-applied'
  // unless the draft is identical to the bundle's training-time ω.
  // S4 will replace 'user-applied' with 'user-applied-not-paper' when the
  // active mode is `omega-heuristic`. For S1 (mode default `sinr-offset`),
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

  const bundlePolicyDiagnostics = bundleSidebarSnapshot?.policyDiagnostics ?? null;

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
