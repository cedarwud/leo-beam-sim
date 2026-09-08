/**
 * SceneGeometry — shell-level + handover-trigger geometry parameters needed by
 * `useBeamViz` (and its consumers) that are NOT per-frame producer truth.
 *
 * Rationale (SDD §3 Q7 C4 / §4 D9):
 *   Today `useBeamViz` reads `Profile.shell.altitudeKm`,
 *   `profile.antenna.beamwidth3dBRad`, `profile.frequencyReuse.*`,
 *   `profile.handover.triggerTimeSec` directly. The artifact has none of these
 *   as a Profile. This module decouples those constants into a small
 *   interface that BOTH adapters (`liveSimToScene`, `showcaseArtifactToScene`)
 *   fill.
 *
 * Brand mechanism (SDD §3 Q7 last paragraph):
 *   `LIVE_GEOMETRY_BRAND` / `REPLAY_GEOMETRY_BRAND` are private symbols
 *   embedded on the returned object. `showcaseArtifactToScene` runtime-asserts
 *   the symbol matches `REPLAY_GEOMETRY_BRAND` (and vice versa for the live
 *   adapter). This prevents accidentally filling `geometry` with the live
 *   `Profile` on the replay path (R1 risk).
 *
 * Constraints:
 *   - No imports from `core/channel`, `core/beam`, `HandoverManager`,
 *     `computeLinkBudget`, `buildLinkContext`, `runtimeFrameStep`.
 *   - No SINR/SNR computation, no handover classification.
 *
 * TODO P1e: ESLint `no-restricted-imports` rule will enforce the above at
 * lint time.
 */

import type {
  VisualShowcaseArtifact,
  VisualShowcaseBeamEntity,
} from './visual-showcase-contract';
import { computeBeamGeometry } from './beam-geometry-pure';

// ---------------------------------------------------------------------------
// Branding
// ---------------------------------------------------------------------------

/** Private brand symbol — only `liveSimToScene` may stamp this. */
const LIVE_GEOMETRY_BRAND_SYMBOL: unique symbol = Symbol('SceneGeometry/live');
/** Private brand symbol — only `showcaseArtifactToScene` may stamp this. */
const REPLAY_GEOMETRY_BRAND_SYMBOL: unique symbol = Symbol('SceneGeometry/replay');

/** Exported brand identifier (typeof-only) for runtime equality checks. */
export const LIVE_GEOMETRY_BRAND = LIVE_GEOMETRY_BRAND_SYMBOL;
export const REPLAY_GEOMETRY_BRAND = REPLAY_GEOMETRY_BRAND_SYMBOL;

export type SceneGeometryBrand =
  | typeof LIVE_GEOMETRY_BRAND_SYMBOL
  | typeof REPLAY_GEOMETRY_BRAND_SYMBOL;

// ---------------------------------------------------------------------------
// Public interface
// ---------------------------------------------------------------------------

/**
 * Per-shell geometry constants needed by the renderer. Both adapters fill
 * this; neither adapter recomputes any value not present in its source.
 */
export interface SceneGeometryFields {
  /** Orbital shell altitude in km (used by `computeApproachPreviews` / cone scale). */
  readonly shellAltitudeKm: number;
  /** Antenna 3 dB beamwidth in radians. */
  readonly beamwidth3dBRad: number;
  /**
   * Frequency-reuse group labels keyed by beam id. Producer-declared
   * (`paper-unspecified` is allowed). Live path derives from
   * `profile.frequencyReuse.*`.
   */
  readonly frequencyReuseGroups: ReadonlyMap<string, string | null>;
  /**
   * Handover trigger time in seconds (live: `profile.handover.triggerTimeSec`).
   * Replay: optional — producer truth supplies per-frame `phase`/`kind` so
   * this constant is informational only.
   */
  readonly handoverTriggerTimeSec?: number;
  /**
   * Per-shell footprint geometry cache. Live: built from
   * `profile.orbit.shells` × `profile.antenna.beamwidth3dBRad` via
   * `computeBeamGeometry`. Replay: built from the single resolved
   * `entities.shell` (or fallback table) with the artifact's
   * `entities.beams[0].halfAngleDeg` as the beamwidth proxy. Keyed by
   * `shellId`. `useBeamViz` reads this to size cones / footprint rings.
   */
  readonly shellLayouts: ReadonlyMap<string, { footprintRadiusKm: number }>;
  /**
   * Beam-frequency-reuse count (e.g. 3 in 3-color reuse). Live: sourced from
   * `profile.beams.frequencyReuse`. Replay: undefined — the artifact carries
   * per-beam `frequencyReuseGroup` strings instead of a count. `useBeamViz`
   * uses this only for live-side visual frequency-index resolution.
   */
  readonly beamFrequencyReuseCount?: number;
  /** Adaptive visual alpha scale factor (defaults to 1.0). */
  readonly visualAlpha?: number;
  /** Downscaled visual satellite altitude in world units (e.g. 600 or 900). */
  readonly visualSatelliteAltitude?: number;
  /**
   * Scene map scale in km/world-unit. Derived by inscribing the paper UE area
   * into the active GLB bounds; not a physics input.
   */
  readonly kmPerWorldUnit?: number;
}

/**
 * Branded scene-geometry record. Use `sceneGeometryFromProfile` (live) or
 * `sceneGeometryFromArtifact` (replay) to construct.
 */
export interface SceneGeometry extends SceneGeometryFields {
  /** Provenance brand — runtime-asserted in adapters. */
  readonly __brand: SceneGeometryBrand;
}

/** Runtime check used by adapters. */
export function isLiveSceneGeometry(g: SceneGeometry): boolean {
  return g.__brand === LIVE_GEOMETRY_BRAND_SYMBOL;
}
export function isReplaySceneGeometry(g: SceneGeometry): boolean {
  return g.__brand === REPLAY_GEOMETRY_BRAND_SYMBOL;
}

// ---------------------------------------------------------------------------
// Live-path builder (called by liveSimToScene)
// ---------------------------------------------------------------------------

/**
 * Minimal profile-shape input — kept structural so we do not import the live
 * `Profile` type here (which would pull engine code into scene types).
 *
 * NOTE: live-path callers must pass `profile` straight through from the
 * runtime config; do NOT synthesize a fake profile for the replay path.
 */
export interface LiveProfileGeometryInput {
  shell?: { altitudeKm?: number } | null;
  antenna?: { beamwidth3dBRad?: number } | null;
  frequencyReuse?: { groupsByBeamId?: ReadonlyMap<string, string | null> } | null;
  handover?: { triggerTimeSec?: number } | null;
  /**
   * P1d: orbit-shell list used to build `shellLayouts`. Each entry's
   * `altitudeKm` × `antenna.beamwidth3dBRad` feeds `computeBeamGeometry`.
   * Optional — when absent, `shellLayouts` is built as a single-entry map
   * keyed by an empty string from `shell.altitudeKm`.
   */
  orbit?: {
    shells?: ReadonlyArray<{ id: string; altitudeKm: number }>;
  } | null;
  /**
   * P1d: live `profile.beams.frequencyReuse` count. Forwarded into
   * `geometry.beamFrequencyReuseCount` so `useBeamViz` can resolve visual
   * frequency indices without re-reading `Profile`.
   */
  beams?: { frequencyReuse?: number } | null;
  /** Adaptive visual alpha scale factor. */
  visualAlpha?: number;
  /** Downscaled visual satellite altitude in world units. */
  visualSatelliteAltitude?: number;
  /** Active scene km/world-unit scale derived from the inscribed paper UE area. */
  kmPerWorldUnit?: number;
}

/**
 * Build a live `SceneGeometry` from a live-engine profile. Stamps
 * {@link LIVE_GEOMETRY_BRAND}.
 *
 * P1c: now wired from `MainScene.tsx` via `useMemo`. Live caller passes
 * `profile.orbit.shells[0].altitudeKm`, `profile.antenna.beamwidth3dBRad`,
 * and `profile.handover.triggerTimeSec` through to this builder. Tests
 * remain a secondary consumer.
 */
export function sceneGeometryFromProfile(profile: LiveProfileGeometryInput): SceneGeometry {
  const shellAltitudeKm = profile.shell?.altitudeKm;
  const beamwidth3dBRad = profile.antenna?.beamwidth3dBRad;
  if (typeof shellAltitudeKm !== 'number' || !Number.isFinite(shellAltitudeKm)) {
    throw new Error(
      '[SceneGeometry/live] profile.shell.altitudeKm missing or non-finite',
    );
  }
  if (typeof beamwidth3dBRad !== 'number' || !Number.isFinite(beamwidth3dBRad)) {
    throw new Error(
      '[SceneGeometry/live] profile.antenna.beamwidth3dBRad missing or non-finite',
    );
  }
  const shellLayouts = new Map<string, { footprintRadiusKm: number }>();
  const shells = profile.orbit?.shells;
  if (shells && shells.length > 0) {
    for (const shell of shells) {
      const geometry = computeBeamGeometry(shell.altitudeKm, beamwidth3dBRad);
      shellLayouts.set(shell.id, { footprintRadiusKm: geometry.footprintRadiusKm });
    }
  } else {
    const geometry = computeBeamGeometry(shellAltitudeKm, beamwidth3dBRad);
    shellLayouts.set('', { footprintRadiusKm: geometry.footprintRadiusKm });
  }

  return {
    shellAltitudeKm,
    beamwidth3dBRad,
    frequencyReuseGroups: profile.frequencyReuse?.groupsByBeamId ?? new Map(),
    handoverTriggerTimeSec: profile.handover?.triggerTimeSec,
    shellLayouts,
    beamFrequencyReuseCount: profile.beams?.frequencyReuse,
    visualAlpha: profile.visualAlpha,
    visualSatelliteAltitude: profile.visualSatelliteAltitude,
    kmPerWorldUnit: profile.kmPerWorldUnit,
    __brand: LIVE_GEOMETRY_BRAND_SYMBOL,
  };
}

// ---------------------------------------------------------------------------
// Replay-path builder (called by showcaseArtifactToScene)
// ---------------------------------------------------------------------------

/**
 * OQ-9 (i) → (ii) fallback table for shell geometry.
 *
 * Producer-side reopen for v1.2 to ship `entities.shell` is the preferred path
 * (i). Until that ships, this table is the pact: shell-level physical
 * constants the producer also uses internally, externalised here only because
 * the artifact does not carry them. Keyed by `entities.satellites[].shellId`.
 *
 * TODO OQ-9 (when producer ships v1.2): once `entities.shell` exists in
 * the artifact, this table becomes the path (iii) "scope-cut" fallback only.
 */
const shellGeometryDefaults: ReadonlyMap<
  string,
  { altitudeKm: number; beamwidth3dBRad: number }
> = new Map();

/**
 * Subset of the artifact used to build a replay `SceneGeometry`. We intentionally
 * accept the partial shape so this function can be unit-tested with a stripped
 * fixture; the full artifact is the only production caller.
 */
export interface ReplayArtifactGeometryInput {
  entities: {
    satellites: ReadonlyArray<{ shellId: string }>;
    beams: ReadonlyArray<Pick<VisualShowcaseBeamEntity, 'id' | 'frequencyReuseGroup' | 'halfAngleDeg'>>;
    // Path (i) preferred — present when producer ships v1.2.
    shell?: { altitudeKm?: number; antennaBeamwidth3dBRad?: number } | null;
  };
}

/**
 * Build a replay `SceneGeometry` from a parsed `visual-showcase-v1` artifact.
 * Stamps {@link REPLAY_GEOMETRY_BRAND}.
 *
 * Resolution order per OQ-9:
 *   (i) `entities.shell` present → use it directly.
 *   (ii) `entities.shell` absent → look up `shellGeometryDefaults[shellId]` for
 *        the FIRST satellite (homogeneous shell assumption) and warn at
 *        runtime.
 *   (iii) Neither (i) nor (ii) resolves → throw with an instructive error.
 */
export function sceneGeometryFromArtifact(
  artifact: ReplayArtifactGeometryInput,
): SceneGeometry {
  const sats = artifact.entities.satellites;
  if (!sats || sats.length === 0) {
    throw new Error(
      '[SceneGeometry/replay] artifact.entities.satellites is empty — cannot derive shell geometry',
    );
  }

  let shellAltitudeKm: number | undefined;
  let beamwidth3dBRad: number | undefined;
  let resolutionPath: 'producer-shell-block' | 'shellGeometryDefaults-fallback';

  if (
    artifact.entities.shell &&
    typeof artifact.entities.shell.altitudeKm === 'number' &&
    Number.isFinite(artifact.entities.shell.altitudeKm)
  ) {
    // Path (i): producer-supplied (v1.2+).
    shellAltitudeKm = artifact.entities.shell.altitudeKm;
    beamwidth3dBRad =
      typeof artifact.entities.shell.antennaBeamwidth3dBRad === 'number'
        ? artifact.entities.shell.antennaBeamwidth3dBRad
        : undefined;
    resolutionPath = 'producer-shell-block';
  } else {
    // Path (ii): fallback table.
    const shellId = sats[0].shellId;
    const defaults = shellGeometryDefaults.get(shellId);
    if (!defaults) {
      throw new Error(
        `[SceneGeometry/replay] OQ-9 unresolved: artifact has no entities.shell ` +
          `block and shellGeometryDefaults has no entry for shellId='${shellId}'. ` +
          `Either wait for producer v1.2 (path i), add a vetted defaults entry ` +
          `(path ii), or take the scope-cut (path iii) by skipping beam-cone ` +
          `rendering for this shell.`,
      );
    }
    shellAltitudeKm = defaults.altitudeKm;
    beamwidth3dBRad = defaults.beamwidth3dBRad;
    resolutionPath = 'shellGeometryDefaults-fallback';
    // eslint-disable-next-line no-console
    console.warn(
      `[SceneGeometry/replay] OQ-9 path (ii): entities.shell absent for ` +
        `shellId='${shellId}'; using shellGeometryDefaults fallback ` +
        `(altitudeKm=${shellAltitudeKm}, beamwidth3dBRad=${beamwidth3dBRad}). ` +
        `Request producer v1.2 contract bump to ship entities.shell.`,
    );
  }

  // beamwidth fallback: if shell block had no antennaBeamwidth3dBRad, defaults
  // table value (already set in path ii) or use first-beam halfAngle as last
  // resort. We do NOT compute beamwidth from any signal.
  if (typeof beamwidth3dBRad !== 'number' || !Number.isFinite(beamwidth3dBRad)) {
    const firstHalfAngle = artifact.entities.beams[0]?.halfAngleDeg;
    if (typeof firstHalfAngle !== 'number' || !Number.isFinite(firstHalfAngle)) {
      throw new Error(
        '[SceneGeometry/replay] cannot derive beamwidth3dBRad: ' +
          'no shell.antennaBeamwidth3dBRad and no entities.beams[0].halfAngleDeg',
      );
    }
    // Half-angle (deg) → full 3 dB beamwidth (rad), informational only.
    beamwidth3dBRad = (firstHalfAngle * 2 * Math.PI) / 180;
  }

  // Frequency-reuse groups: producer truth, beam-keyed.
  const fr = new Map<string, string | null>();
  for (const beam of artifact.entities.beams) {
    fr.set(beam.id, beam.frequencyReuseGroup);
  }

  // Tag the path so callers can read it for diagnostics if they want; the
  // brand itself stays REPLAY regardless of which sub-path resolved.
  void resolutionPath;

  const shellLayouts = new Map<string, { footprintRadiusKm: number }>();
  const replayShellId = sats[0].shellId;
  const replayGeometry = computeBeamGeometry(shellAltitudeKm, beamwidth3dBRad);
  shellLayouts.set(replayShellId, { footprintRadiusKm: replayGeometry.footprintRadiusKm });

  return {
    shellAltitudeKm,
    beamwidth3dBRad,
    frequencyReuseGroups: fr,
    // Replay: producer truth supplies per-frame phase; no live trigger time.
    handoverTriggerTimeSec: undefined,
    shellLayouts,
    visualAlpha: 1.0,
    visualSatelliteAltitude: 900,
    __brand: REPLAY_GEOMETRY_BRAND_SYMBOL,
  };
}

/**
 * Convenience: accept a full `VisualShowcaseArtifact` (the common production
 * caller).
 */
export function sceneGeometryFromFullArtifact(
  artifact: VisualShowcaseArtifact,
): SceneGeometry {
  return sceneGeometryFromArtifact({
    entities: {
      satellites: artifact.entities.satellites,
      beams: artifact.entities.beams,
      // v1.1 contract: no `entities.shell` field. Cast to unknown -> typed
      // intentionally; once v1.2 ships, the cast can be dropped.
      shell: (artifact.entities as unknown as { shell?: { altitudeKm?: number; antennaBeamwidth3dBRad?: number } | null })
        .shell ?? null,
    },
  });
}
