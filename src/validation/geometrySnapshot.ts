// Consolidation S0 — geometry trace capture + tolerance diff (shared harness).
//
// Generalizes the proven d6 golden-snapshot protocol
// (the earlier visual-showcase state-snapshot validator): every
// consolidation slice must prove before==after on DATA, not pixels. A trace
// pairs, per fixed step:
//   (a) TRUTH  — SimFrame fields (serving/pending/HO/satellites/per-UE/cell
//       truth). Truth-layer slices (S1 coords, S3 step/reset) must hold (a)
//       bit-identical (within float tolerance).
//   (b) DISPLAY — the VizFrame projection (display sats, beam sets, beam
//       targets, footprint). Display-layer slices (S2 identity, S5 render)
//       hold (a) clean and pin (b) except fields declared via ignorePaths.
//
// diffGeometryTrace supports path-prefix ignores so a slice can declare
// "these display fields legitimately change" while everything else stays
// locked. Runners must include the two d6 meta-gates: run-twice determinism
// (A==B) and a perturbation positive control (must FAIL at > tolerance).
//
// Pure module: no React (VizFrame capture lives in vizFrameProbe.tsx).

import type { SimFrame, VizFrame } from '../scene/types';

const ROUND = 1e6; // serialize floats at 1e-6 — matches the d6 tolerance

function round(value: number | null | undefined): number | null {
  if (value === null || value === undefined || !Number.isFinite(value)) return null;
  return Math.round(value * ROUND) / ROUND;
}

export interface GeometryTraceStep {
  readonly step: number;
  readonly simTimeSec: number | null;
  readonly truth: {
    readonly ue: { readonly groundX: number | null; readonly groundZ: number | null };
    readonly serving: { readonly satId: string | null; readonly beamId: number | null; readonly sinrDb: number | null };
    readonly pendingTarget: { readonly satId: string | null; readonly beamId: number | null };
    readonly hoCount: number;
    readonly satellites: readonly {
      readonly id: string;
      readonly world: readonly [number | null, number | null, number | null];
      readonly altitudeKm: number | null;
    }[];
    readonly perUeServing: readonly string[]; // sorted "ueId>satId:beamId" (unserved omitted)
    readonly cellServing: readonly string[]; // sorted "satId:cellId" from sinrLiveCells (if attached)
  };
  readonly display: {
    readonly displaySats: readonly { readonly id: string; readonly world: readonly [number | null, number | null, number | null] }[];
    readonly beamSatIds: readonly string[];
    readonly eventSatIds: readonly string[];
    readonly satBeams: readonly {
      readonly satId: string;
      readonly beams: readonly {
        readonly beamId: number;
        readonly ground: readonly [number | null, number | null];
        readonly isServing: boolean;
        readonly frequencyIndex: number;
        /** Display-order-derived today (audit: churns without a real HO) — S2 pins satId-stable. */
        readonly satelliteTintColor: string;
      }[];
    }[];
    readonly footprintRadiusWorld: number | null;
    readonly sinrLabelCount: number;
  };
}

export interface GeometryTrace {
  readonly profileId: string;
  readonly ueCount: number;
  readonly stepSec: number;
  readonly floatTolerance: number;
  readonly steps: readonly GeometryTraceStep[];
}

export function serializeGeometryTraceStep(input: {
  readonly step: number;
  readonly sim: SimFrame;
  readonly viz: VizFrame;
}): GeometryTraceStep {
  const { sim, viz } = input;
  return {
    step: input.step,
    simTimeSec: round(sim.simTimeSec),
    truth: {
      ue: { groundX: round(sim.ueGroundX), groundZ: round(sim.ueGroundZ) },
      serving: {
        satId: sim.serving.satId,
        beamId: sim.serving.beamId,
        sinrDb: round(sim.serving.sinrDb),
      },
      pendingTarget: {
        satId: sim.pendingTargetSatId,
        beamId: sim.pendingTargetBeamId,
      },
      hoCount: sim.hoCount,
      satellites: [...sim.satellites]
        .sort((a, b) => a.id.localeCompare(b.id))
        .map(sat => ({
          id: sat.id,
          world: [round(sat.world.x), round(sat.world.y), round(sat.world.z)] as const,
          altitudeKm: round(sat.altitudeKm),
        })),
      perUeServing: sim.perUePositions
        .filter(ue => ue.servingSatId !== null && ue.servingBeamId !== null)
        .map(ue => `${ue.id}>${ue.servingSatId}:${ue.servingBeamId}`)
        .sort(),
      cellServing: (sim.sinrLiveCells?.illuminatedBeams ?? [])
        .filter(beam => beam.serving)
        .map(beam => `${beam.satId}:${beam.cellId}`)
        .sort(),
    },
    display: {
      displaySats: [...viz.displaySats]
        .sort((a, b) => a.id.localeCompare(b.id))
        .map(sat => ({
          id: sat.id,
          world: [round(sat.world.x), round(sat.world.y), round(sat.world.z)] as const,
        })),
      beamSatIds: [...viz.beamSatIds].sort(),
      eventSatIds: [...viz.eventSatIds].sort(),
      satBeams: [...viz.satBeams.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([satId, beams]) => ({
          satId,
          beams: beams.map(beam => ({
            beamId: beam.beamId,
            ground: [round(beam.groundX), round(beam.groundZ)] as const,
            isServing: beam.isServing,
            frequencyIndex: beam.frequencyIndex,
            satelliteTintColor: beam.satelliteTintColor,
          })),
        })),
      footprintRadiusWorld: round(viz.footprintRadiusWorld),
      sinrLabelCount: viz.sinrLabels.length,
    },
  };
}

/**
 * Recursive tolerance diff (d6 diffSnapshots, generalized). Returns difference
 * descriptions ("path: a vs b"); empty array == traces match. ignorePaths are
 * PREFIX matches on dotted paths (e.g. "steps.3.display.satBeams",
 * "steps.*.display" with '*' matching one segment).
 */
export function diffGeometryTrace(
  a: unknown,
  b: unknown,
  options: { readonly floatTolerance?: number; readonly ignorePaths?: readonly string[] } = {},
): string[] {
  const tolerance = options.floatTolerance ?? 1e-6;
  const ignorePaths = options.ignorePaths ?? [];
  const diffs: string[] = [];

  const ignored = (path: string): boolean =>
    ignorePaths.some(prefix => {
      const prefixParts = prefix.split('.');
      const pathParts = path.split('.');
      if (prefixParts.length > pathParts.length) return false;
      return prefixParts.every((part, i) => part === '*' || part === pathParts[i]);
    });

  const walk = (left: unknown, right: unknown, path: string): void => {
    if (ignored(path)) return;
    if (typeof left === 'number' && typeof right === 'number') {
      if (Math.abs(left - right) > tolerance) diffs.push(`${path}: ${left} vs ${right}`);
      return;
    }
    if (Array.isArray(left) && Array.isArray(right)) {
      if (left.length !== right.length) {
        diffs.push(`${path}.length: ${left.length} vs ${right.length}`);
        return;
      }
      left.forEach((item, i) => walk(item, right[i], `${path}.${i}`));
      return;
    }
    if (left !== null && right !== null && typeof left === 'object' && typeof right === 'object') {
      const keys = [...new Set([...Object.keys(left), ...Object.keys(right)])].sort();
      for (const key of keys) {
        walk(
          (left as Record<string, unknown>)[key],
          (right as Record<string, unknown>)[key],
          path === '' ? key : `${path}.${key}`,
        );
      }
      return;
    }
    if (left !== right) diffs.push(`${path}: ${JSON.stringify(left)} vs ${JSON.stringify(right)}`);
  };

  walk(a, b, '');
  return diffs;
}
