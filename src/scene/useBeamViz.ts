import { useMemo, useRef } from 'react';
import type { Profile } from '../profiles/types';
import { FOOTPRINT_RADIUS_WORLD, computeBeamGeometry, generateBeamOffsetsKm } from './beam-layout';
import type { PresentationMode, SimFrame, VizFrame, VisibleSat } from './types';

const MAX_DISPLAY_SATS = 8;
const MAX_EVENT_SATS = 3;
const MAX_BEAM_SATS = 3;
const SKY_DOME_V_RADIUS = 400;
const FOCUS_CORRIDOR_Y_CENTER = 0.68;
const FOCUS_CORRIDOR_Y_HALFSPAN = 0.16;

interface ShellVizLayout {
  footprintRadiusKm: number;
  offsetsByBeamId: Map<number, { dEastKm: number; dNorthKm: number }>;
}

function scoreCorridorFit(sat: VisibleSat): number {
  const yRatio = sat.world.y / SKY_DOME_V_RADIUS;
  const delta = Math.abs(yRatio - FOCUS_CORRIDOR_Y_CENTER);
  if (delta > FOCUS_CORRIDOR_Y_HALFSPAN) return 0;
  return 20 * (1 - delta / FOCUS_CORRIDOR_Y_HALFSPAN);
}

export function useBeamViz(
  sim: SimFrame,
  profile: Profile,
  mode: PresentationMode,
): VizFrame {
  const previousDisplayIdsRef = useRef<Set<string>>(new Set());
  const previousEventIdsRef = useRef<Set<string>>(new Set());

  return useMemo(() => {
    const shellLayouts = new Map<string, ShellVizLayout>(
      profile.orbit.shells.map(shell => {
        const geometry = computeBeamGeometry(shell.altitudeKm, profile.antenna.beamwidth3dBRad);
        const offsets = generateBeamOffsetsKm(geometry.spacingKm, profile.beams.perSatellite);
        return [
          shell.id,
          {
            footprintRadiusKm: geometry.footprintRadiusKm,
            offsetsByBeamId: new Map(
              offsets.map(offset => [offset.beamId, { dEastKm: offset.dEastKm, dNorthKm: offset.dNorthKm }]),
            ),
          },
        ];
      }),
    );

    const bestSinrPerSat = new Map<string, number>();
    for (const sample of sim.linkSamples) {
      const currentBest = bestSinrPerSat.get(sample.satId) ?? -Infinity;
      if (sample.sinrDb > currentBest) bestSinrPerSat.set(sample.satId, sample.sinrDb);
    }

    const displaySats = [...sim.satellites].sort((a, b) => {
      const prevA = previousDisplayIdsRef.current.has(a.id) ? 15 : 0;
      const prevB = previousDisplayIdsRef.current.has(b.id) ? 15 : 0;
      const corridorA = mode === 'demo-readability' ? scoreCorridorFit(a) : 0;
      const corridorB = mode === 'demo-readability' ? scoreCorridorFit(b) : 0;
      const servingA = a.id === sim.serving.satId ? 1000 : 0;
      const servingB = b.id === sim.serving.satId ? 1000 : 0;

      const scoreA = a.topo.elevationDeg + prevA + corridorA + servingA;
      const scoreB = b.topo.elevationDeg + prevB + corridorB + servingB;
      return scoreB - scoreA || a.id.localeCompare(b.id);
    });

    const shownSats = displaySats.slice(0, MAX_DISPLAY_SATS);
    if (sim.serving.satId && !shownSats.some(sat => sat.id === sim.serving.satId)) {
      const servingSat = sim.satellites.find(sat => sat.id === sim.serving.satId);
      if (servingSat) shownSats[shownSats.length - 1] = servingSat;
    }

    const eventRoles = new Map<string, VizFrame['eventRoles'] extends Map<string, infer T> ? T : never>();
    if (sim.serving.satId) {
      eventRoles.set(
        sim.serving.satId,
        sim.recentHoTargetSatId === sim.serving.satId ? 'post-ho' : 'serving',
      );
    }

    const eventSatIds = new Set<string>(eventRoles.keys());
    const rankedCandidates = [...shownSats]
      .filter(sat => sat.id !== sim.serving.satId)
      .sort((a, b) => {
        const prevA = previousEventIdsRef.current.has(a.id) ? 8 : 0;
        const prevB = previousEventIdsRef.current.has(b.id) ? 8 : 0;
        const sinrA = bestSinrPerSat.get(a.id) ?? -Infinity;
        const sinrB = bestSinrPerSat.get(b.id) ?? -Infinity;
        return (sinrB + prevB) - (sinrA + prevA) || a.id.localeCompare(b.id);
      });

    for (const sat of rankedCandidates) {
      if (eventSatIds.size >= MAX_EVENT_SATS) break;
      eventSatIds.add(sat.id);
    }

    const beamSatIds = new Set<string>();
    for (const satId of eventSatIds) {
      if (beamSatIds.size >= MAX_BEAM_SATS) break;
      beamSatIds.add(satId);
    }

    if (beamSatIds.size === 0 && sim.serving.satId) {
      beamSatIds.add(sim.serving.satId);
    }

    const satBeams = new Map<string, VizFrame['satBeams'] extends Map<string, infer T> ? T : never>();
    for (const sat of shownSats) {
      if (!beamSatIds.has(sat.id)) continue;

      const layout = shellLayouts.get(sat.shellId);
      if (!layout) continue;

      const scale = FOOTPRINT_RADIUS_WORLD / Math.max(layout.footprintRadiusKm, 1e-6);
      const satSamples = sim.linkSamples
        .filter(sample => sample.satId === sat.id)
        .sort((a, b) => b.sinrDb - a.sinrDb)
        .slice(0, profile.beams.maxActivePerSat);

      satBeams.set(
        sat.id,
        satSamples.flatMap(sample => {
          const offset = layout.offsetsByBeamId.get(sample.beamId);
          if (!offset) return [];

          return [{
            beamId: sample.beamId,
            groundX: sat.world.x + offset.dEastKm * scale,
            groundZ: sat.world.z - offset.dNorthKm * scale,
            isServing: sample.satId === sim.serving.satId && sample.beamId === sim.serving.beamId,
          }];
        }),
      );
    }

    const sinrLabels = [...beamSatIds]
      .map(satId => {
        const sat = shownSats.find(entry => entry.id === satId);
        const sinrDb = bestSinrPerSat.get(satId);
        if (!sat || sinrDb === undefined) return null;
        return {
          position: sat.world,
          sinrDb,
          isServing: satId === sim.serving.satId,
        };
      })
      .filter((label): label is NonNullable<typeof label> => label !== null);

    previousDisplayIdsRef.current = new Set(shownSats.map(sat => sat.id));
    previousEventIdsRef.current = new Set(eventSatIds);

    return {
      displaySats: shownSats,
      eventSatIds,
      eventRoles,
      beamSatIds,
      satBeams,
      sinrLabels,
      footprintRadiusWorld: FOOTPRINT_RADIUS_WORLD,
    };
  }, [mode, profile, sim]);
}
