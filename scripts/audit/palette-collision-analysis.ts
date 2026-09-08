/**
 * PALETTE COLLISION ANALYSIS: Allocator A (Pure Serving) vs Allocator B (Handover Visual Identity)
 *
 * ## Context & Decision to Inform
 *
 * Three allocators decide a satellite's colour in this codebase. Two matter here:
 *
 * - **Allocator A** (`servingIdentityPaletteIndex` in `src/constants/servingColour.ts`):
 *   Pure function of the satellite ID alone. Maps Walker IDs via semantic plane/slot coordinates
 *   and an interleaved 16-slot cycle; maps arbitrary IDs via deterministic FNV-1a hash.
 *   Property: STABLE everywhere, across every view, scene, and rail.
 *   Potential downside: Co-resident satellites on screen at the same time may land on the same
 *   or visually adjacent palette slots.
 *
 * - **Allocator B** (`allocateHandoverVisualIdentities` in `src/constants/handoverVisualIdentity.ts`):
 *   Contrast-optimised, state/order-dependent allocator. Inspects the co-resident set of satellites
 *   on stage, linear-probes or contrast-spreads available palette slots to maximise minimum circular
 *   hue distance between active participants, and reserves slots across an episode.
 *   Property: MAXIMISES visual contrast among satellites on screen together.
 *   Downside: A satellite's assigned color depends on who else is on screen and the order in
 *   which allocations occur; capacity is capped at 16 slots, beyond which satellites receive an
 *   identical overflow neutral fallback (`#94a3b8`, hue 215°).
 *
 * Collapsing B onto A would make a satellite's colour finally stable everywhere — but it would
 * give up B's contrast spreading, so two satellites on screen together could land on similar or
 * identical hues. Nobody has measured how bad that actually is.
 *
 * This script measures the exact trade-off across co-resident set sizes N = 4, 8, 16, 32, 64
 * under Walker-style IDs and arbitrary IDs.
 *
 * ## Metrics Measured
 *
 * For each set size N and satellite ID suite:
 * 1. Distinct colours out of N satellites.
 * 2. Exact collisions: number of satellites sharing a colour with at least one other, and worst group size.
 * 3. Near collisions: pairs of satellites whose circular hue distance is < 15° and < 30°.
 *    Circular hue distance is defined on [0°, 360°): dist(h1, h2) = min(|h1 - h2|, 360 - |h1 - h2|).
 * 4. Minimum pairwise hue distance across all N*(N-1)/2 pairs.
 *
 * Run directly with:
 *   node --import tsx/esm scripts/audit/palette-collision-analysis.ts
 */

import path from 'node:path';
import {
  servingIdentityPaletteColorAt,
  servingIdentityPaletteHueAt,
  servingIdentityPaletteIndex,
} from '../../src/constants/servingColour';
import {
  allocateHandoverVisualIdentities,
} from '../../src/constants/handoverVisualIdentity';

/** Circular hue distance on the 360° colour circle. */
export function circularHueDistance(hue1: number, hue2: number): number {
  const h1 = ((hue1 % 360) + 360) % 360;
  const h2 = ((hue2 % 360) + 360) % 360;
  const diff = Math.abs(h1 - h2);
  return Math.min(diff, 360 - diff);
}

export interface SatelliteColorAssignment {
  readonly satelliteId: string;
  readonly hexColor: string;
  readonly hueDegrees: number;
  readonly paletteIndex: number | null;
  readonly isOverflow: boolean;
}

export interface CollisionMetrics {
  readonly totalSatellites: number;
  readonly totalPairs: number;
  readonly distinctColors: number;
  readonly collidingSatellites: number;
  readonly worstGroupSize: number;
  readonly collisionGroupsCount: number;
  readonly nearCollisions15: number;
  readonly nearCollisions30: number;
  readonly exact30Pairs: number;
  readonly minPairwiseHueGap: number;
  readonly groupBreakdown: ReadonlyArray<{
    readonly hexColor: string;
    readonly hueDegrees: number;
    readonly count: number;
    readonly satelliteIds: readonly string[];
  }>;
}

export interface SuiteEvaluation {
  readonly name: string;
  readonly category: 'walker' | 'arbitrary';
  readonly setSize: number;
  readonly description: string;
  readonly satelliteIds: readonly string[];
  readonly allocatorA: CollisionMetrics;
  readonly allocatorB: CollisionMetrics;
}

/** Evaluates Allocator A (pure servingIdentityPaletteIndex). */
export function evaluateAllocatorA(satelliteIds: readonly string[]): CollisionMetrics {
  const assignments: SatelliteColorAssignment[] = satelliteIds.map(satId => {
    const paletteIndex = servingIdentityPaletteIndex(satId);
    const hexColor = servingIdentityPaletteColorAt(paletteIndex).toLowerCase();
    const hueDegrees = servingIdentityPaletteHueAt(paletteIndex);
    return {
      satelliteId: satId,
      hexColor,
      hueDegrees,
      paletteIndex,
      isOverflow: false,
    };
  });

  return computeMetrics(assignments);
}

/** Evaluates Allocator B (allocateHandoverVisualIdentities). Fresh episodeId per run. */
export function evaluateAllocatorB(
  satelliteIds: readonly string[],
  episodeId: string,
): CollisionMetrics {
  const allocation = allocateHandoverVisualIdentities({
    episodeId,
    satelliteIds,
  });

  const assignments: SatelliteColorAssignment[] = satelliteIds.map(satId => {
    const identity = allocation.identitiesBySatelliteId[satId];
    if (identity === undefined) {
      throw new Error(`Allocator B did not return identity for ${satId}`);
    }
    return {
      satelliteId: satId,
      hexColor: identity.color.toLowerCase(),
      hueDegrees: identity.hueDegrees ?? 215,
      paletteIndex: identity.paletteIndex,
      isOverflow: identity.isOverflow,
    };
  });

  return computeMetrics(assignments);
}

function computeMetrics(assignments: readonly SatelliteColorAssignment[]): CollisionMetrics {
  const n = assignments.length;
  const totalPairs = (n * (n - 1)) / 2;

  // Group by exact hex color
  const colorMap = new Map<string, { hue: number; satIds: string[] }>();
  for (const item of assignments) {
    const existing = colorMap.get(item.hexColor);
    if (existing === undefined) {
      colorMap.set(item.hexColor, { hue: item.hueDegrees, satIds: [item.satelliteId] });
    } else {
      existing.satIds.push(item.satelliteId);
    }
  }

  const distinctColors = colorMap.size;
  let collidingSatellites = 0;
  let worstGroupSize = n > 0 ? 1 : 0;
  let collisionGroupsCount = 0;
  const groupBreakdown: Array<{
    hexColor: string;
    hueDegrees: number;
    count: number;
    satelliteIds: string[];
  }> = [];

  for (const [hexColor, data] of colorMap.entries()) {
    const count = data.satIds.length;
    if (count > 1) {
      collidingSatellites += count;
      collisionGroupsCount += 1;
      if (count > worstGroupSize) worstGroupSize = count;
      groupBreakdown.push({
        hexColor,
        hueDegrees: data.hue,
        count,
        satelliteIds: data.satIds,
      });
    }
  }
  groupBreakdown.sort((a, b) => b.count - a.count);

  let nearCollisions15 = 0;
  let nearCollisions30 = 0;
  let exact30Pairs = 0;
  let minPairwiseHueGap = totalPairs > 0 ? Number.POSITIVE_INFINITY : 0;

  for (let i = 0; i < n; i += 1) {
    for (let j = i + 1; j < n; j += 1) {
      const gap = circularHueDistance(assignments[i]!.hueDegrees, assignments[j]!.hueDegrees);
      if (gap < 15) nearCollisions15 += 1;
      if (gap < 30) nearCollisions30 += 1;
      if (gap === 30) exact30Pairs += 1;
      if (gap < minPairwiseHueGap) minPairwiseHueGap = gap;
    }
  }

  if (minPairwiseHueGap === Number.POSITIVE_INFINITY) minPairwiseHueGap = 0;

  return {
    totalSatellites: n,
    totalPairs,
    distinctColors,
    collidingSatellites,
    worstGroupSize,
    collisionGroupsCount,
    nearCollisions15,
    nearCollisions30,
    exact30Pairs,
    minPairwiseHueGap,
    groupBreakdown,
  };
}

/** Generates Walker-style IDs: `${shell}-P${plane}-S${slot}` across planes and slots. */
export function generateWalkerIds(
  shell: string,
  planes: number,
  slotsPerPlane: number,
): string[] {
  const ids: string[] = [];
  for (let p = 0; p < planes; p += 1) {
    for (let s = 0; s < slotsPerPlane; s += 1) {
      ids.push(`${shell}-P${p}-S${s}`);
    }
  }
  return ids;
}

/** Generates arbitrary IDs: `sat-0`, `sat-1`, ... */
export function generateArbitraryIds(count: number): string[] {
  return Array.from({ length: count }, (_, i) => `sat-${i}`);
}

interface TestConfiguration {
  readonly name: string;
  readonly category: 'walker' | 'arbitrary';
  readonly setSize: number;
  readonly description: string;
  readonly satIds: string[];
}

function buildTestConfigurations(): TestConfiguration[] {
  const shell = 'shell-pro-53';
  return [
    // Walker Suite (Balanced Multi-Plane Grid)
    {
      name: 'Walker N=4 (2P × 2S)',
      category: 'walker',
      setSize: 4,
      description: '2 planes × 2 slots',
      satIds: generateWalkerIds(shell, 2, 2),
    },
    {
      name: 'Walker N=8 (4P × 2S)',
      category: 'walker',
      setSize: 8,
      description: '4 planes × 2 slots (inter-plane breadth)',
      satIds: generateWalkerIds(shell, 4, 2),
    },
    {
      name: 'Walker N=16 (4P × 4S)',
      category: 'walker',
      setSize: 16,
      description: '4 planes × 4 slots',
      satIds: generateWalkerIds(shell, 4, 4),
    },
    {
      name: 'Walker N=32 (4P × 8S)',
      category: 'walker',
      setSize: 32,
      description: '4 planes × 8 slots',
      satIds: generateWalkerIds(shell, 4, 8),
    },
    {
      name: 'Walker N=64 (8P × 8S)',
      category: 'walker',
      setSize: 64,
      description: '8 planes × 8 slots',
      satIds: generateWalkerIds(shell, 8, 8),
    },

    // Walker Suite (Alternate Plane/Slot Geometry: Dense In-Plane)
    {
      name: 'Walker Alt N=8 (2P × 4S)',
      category: 'walker',
      setSize: 8,
      description: '2 planes × 4 slots (dense in-plane)',
      satIds: generateWalkerIds(shell, 2, 4),
    },
    {
      name: 'Walker Alt N=16 (2P × 8S)',
      category: 'walker',
      setSize: 16,
      description: '2 planes × 8 slots (dense in-plane)',
      satIds: generateWalkerIds(shell, 2, 8),
    },
    {
      name: 'Walker Alt N=32 (8P × 4S)',
      category: 'walker',
      setSize: 32,
      description: '8 planes × 4 slots (dense inter-plane)',
      satIds: generateWalkerIds(shell, 8, 4),
    },

    // Arbitrary IDs Suite (Deterministic Hash Path)
    {
      name: 'Arbitrary N=4',
      category: 'arbitrary',
      setSize: 4,
      description: 'sat-0 .. sat-3 (FNV-1a hash path)',
      satIds: generateArbitraryIds(4),
    },
    {
      name: 'Arbitrary N=8',
      category: 'arbitrary',
      setSize: 8,
      description: 'sat-0 .. sat-7 (FNV-1a hash path)',
      satIds: generateArbitraryIds(8),
    },
    {
      name: 'Arbitrary N=16',
      category: 'arbitrary',
      setSize: 16,
      description: 'sat-0 .. sat-15 (FNV-1a hash path)',
      satIds: generateArbitraryIds(16),
    },
    {
      name: 'Arbitrary N=32',
      category: 'arbitrary',
      setSize: 32,
      description: 'sat-0 .. sat-31 (FNV-1a hash path)',
      satIds: generateArbitraryIds(32),
    },
    {
      name: 'Arbitrary N=64',
      category: 'arbitrary',
      setSize: 64,
      description: 'sat-0 .. sat-63 (FNV-1a hash path)',
      satIds: generateArbitraryIds(64),
    },
  ];
}

/** Check Allocator B determinism and statefulness behavior. */
function checkAllocatorBStatefulness(): void {
  const probeSet = ['shell-pro-53-P0-S0', 'shell-pro-53-P0-S1', 'shell-pro-53-P1-S0', 'shell-pro-53-P1-S1'];
  const run1 = allocateHandoverVisualIdentities({ episodeId: 'state-probe-1', satelliteIds: probeSet });
  const run2 = allocateHandoverVisualIdentities({ episodeId: 'state-probe-2', satelliteIds: probeSet });
  const run1SameId = allocateHandoverVisualIdentities({ episodeId: 'state-probe-1', satelliteIds: probeSet });
  const shuffledProbeSet = [probeSet[3]!, probeSet[0]!, probeSet[2]!, probeSet[1]!];
  const runShuffled = allocateHandoverVisualIdentities({ episodeId: 'state-probe-3', satelliteIds: shuffledProbeSet });

  const c1 = run1.identities.map(i => i.color).join(',');
  const c2 = run2.identities.map(i => i.color).join(',');
  const c1Same = run1SameId.identities.map(i => i.color).join(',');
  const cShuffled = probeSet.map(id => runShuffled.identitiesBySatelliteId[id]?.color).join(',');

  const freshEpisodeMatches = c1 === c2;
  const sameEpisodeMatches = c1 === c1Same;
  const shuffledMatches = c1 === cShuffled;

  console.log('--- ALLOCATOR B STATEFULNESS & DETERMINISM CHECK ---');
  console.log(`  Fresh episodeId invariance: ${freshEpisodeMatches ? 'IDENTICAL (deterministic per call)' : 'DIFFERENT'}`);
  console.log(`  Same episodeId (no prior) invariance: ${sameEpisodeMatches ? 'IDENTICAL' : 'DIFFERENT'}`);
  console.log(`  Input order invariance (lexical sort): ${shuffledMatches ? 'IDENTICAL (internally sorted)' : 'ORDER-DEPENDENT'}`);
  console.log('  Protocol: Every evaluation below uses a guaranteed FRESH episodeId per run.\n');
}

function formatSideBySideReport(evaluation: SuiteEvaluation): void {
  const { name, description, setSize, allocatorA: A, allocatorB: B } = evaluation;
  console.log('================================================================================');
  console.log(`${name.toUpperCase()}  [${description}]`);
  console.log(`Co-resident satellites: N = ${setSize}  |  Total unordered pairs: ${A.totalPairs}`);
  console.log('--------------------------------------------------------------------------------');
  console.log(
    'Metric'.padEnd(38) +
    'Allocator A (servingColour)'.padEnd(32) +
    'Allocator B (handoverVisual)',
  );
  console.log('--------------------------------------------------------------------------------');

  const distinctA = `${A.distinctColors} / ${setSize} (${((A.distinctColors / setSize) * 100).toFixed(1)}%)`;
  const distinctB = `${B.distinctColors} / ${setSize} (${((B.distinctColors / setSize) * 100).toFixed(1)}%)`;
  console.log('1. Distinct colours:'.padEnd(38) + distinctA.padEnd(32) + distinctB);

  const collSatA = `${A.collidingSatellites} / ${setSize} (${((A.collidingSatellites / setSize) * 100).toFixed(1)}%)`;
  const collSatB = `${B.collidingSatellites} / ${setSize} (${((B.collidingSatellites / setSize) * 100).toFixed(1)}%)`;
  console.log('2. Satellites in exact collision:'.padEnd(38) + collSatA.padEnd(32) + collSatB);

  const worstA = `${A.worstGroupSize} sats`;
  const worstB = `${B.worstGroupSize} sats`;
  console.log('   - Worst collision group size:'.padEnd(38) + worstA.padEnd(32) + worstB);

  const groupsA = `${A.collisionGroupsCount} colors`;
  const groupsB = `${B.collisionGroupsCount} colors`;
  console.log('   - Colliding color groups:'.padEnd(38) + groupsA.padEnd(32) + groupsB);

  const near15A = A.totalPairs > 0 ? `${A.nearCollisions15} pairs (${((A.nearCollisions15 / A.totalPairs) * 100).toFixed(1)}%)` : '0';
  const near15B = B.totalPairs > 0 ? `${B.nearCollisions15} pairs (${((B.nearCollisions15 / B.totalPairs) * 100).toFixed(1)}%)` : '0';
  console.log('3. Near collisions (hue dist < 15°):'.padEnd(38) + near15A.padEnd(32) + near15B);

  const near30A = A.totalPairs > 0 ? `${A.nearCollisions30} pairs (${((A.nearCollisions30 / A.totalPairs) * 100).toFixed(1)}%)` : '0';
  const near30B = B.totalPairs > 0 ? `${B.nearCollisions30} pairs (${((B.nearCollisions30 / B.totalPairs) * 100).toFixed(1)}%)` : '0';
  console.log('   Near collisions (hue dist < 30°):'.padEnd(38) + near30A.padEnd(32) + near30B);

  const minGapA = `${A.minPairwiseHueGap}°`;
  const minGapB = `${B.minPairwiseHueGap}°`;
  console.log('4. Minimum pairwise hue distance:'.padEnd(38) + minGapA.padEnd(32) + minGapB);

  if (A.collidingSatellites > 0 || B.collidingSatellites > 0) {
    console.log('\n  Collision breakdown:');
    if (A.collidingSatellites > 0) {
      console.log(`    Allocator A: ${A.collisionGroupsCount} group(s), worst size ${A.worstGroupSize}:`);
      for (const g of A.groupBreakdown.slice(0, 3)) {
        console.log(`      • ${g.hexColor} (${g.hueDegrees}°): ${g.count} sats -> [${g.satelliteIds.slice(0, 4).join(', ')}${g.count > 4 ? '...' : ''}]`);
      }
      if (A.groupBreakdown.length > 3) console.log(`      ... and ${A.groupBreakdown.length - 3} more group(s)`);
    } else {
      console.log('    Allocator A: No collisions.');
    }
    if (B.collidingSatellites > 0) {
      console.log(`    Allocator B: ${B.collisionGroupsCount} group(s), worst size ${B.worstGroupSize}:`);
      for (const g of B.groupBreakdown.slice(0, 3)) {
        console.log(`      • ${g.hexColor} (${g.hueDegrees}°): ${g.count} sats -> [${g.satelliteIds.slice(0, 4).join(', ')}${g.count > 4 ? '...' : ''}]`);
      }
    } else {
      console.log('    Allocator B: No collisions.');
    }
  }
  console.log('');
}

function formatCompactVerdictTable(evaluations: readonly SuiteEvaluation[]): void {
  console.log('========================================================================================================================');
  console.log('COMPACT VERDICT TABLE: ALLOCATOR A vs ALLOCATOR B ACROSS CO-RESIDENT SET SIZES');
  console.log('Format per cell: [distinct / coll / min-gap]');
  console.log('  - distinct: distinct colours out of N');
  console.log('  - coll: satellites sharing a colour with at least one other (worst group size in parens)');
  console.log('  - min-gap: minimum pairwise circular hue distance across the set');
  console.log('========================================================================================================================');
  console.log(
    'Suite / Scenario'.padEnd(28) +
    'N'.padEnd(5) +
    'Allocator A (servingColour)'.padEnd(38) +
    'Allocator B (handoverVisual)'.padEnd(38) +
    'Comparison',
  );
  console.log('------------------------------------------------------------------------------------------------------------------------');

  for (const item of evaluations) {
    const { name, setSize, allocatorA: A, allocatorB: B } = item;
    const aSummary = `${A.distinctColors}/${setSize} dist | ${A.collidingSatellites} coll (w=${A.worstGroupSize}) | ${A.minPairwiseHueGap}°`;
    const bSummary = `${B.distinctColors}/${setSize} dist | ${B.collidingSatellites} coll (w=${B.worstGroupSize}) | ${B.minPairwiseHueGap}°`;

    let comparison = '';
    if (A.collidingSatellites > B.collidingSatellites) {
      comparison = `A collides more (+${A.collidingSatellites - B.collidingSatellites} sats)`;
    } else if (B.collidingSatellites > A.collidingSatellites) {
      comparison = `B collides more (+${B.collidingSatellites - A.collidingSatellites} sats, overflow)`;
    } else {
      if (B.minPairwiseHueGap > A.minPairwiseHueGap) {
        comparison = `Equal coll (${A.collidingSatellites}), B spreads +${B.minPairwiseHueGap - A.minPairwiseHueGap}°`;
      } else if (A.minPairwiseHueGap > B.minPairwiseHueGap) {
        comparison = `Equal coll (${A.collidingSatellites}), A spreads +${A.minPairwiseHueGap - B.minPairwiseHueGap}°`;
      } else {
        comparison = `Equal coll (${A.collidingSatellites}), equal min-gap (${A.minPairwiseHueGap}°)`;
      }
    }

    console.log(
      name.padEnd(28) +
      String(setSize).padEnd(5) +
      aSummary.padEnd(38) +
      bSummary.padEnd(38) +
      comparison,
    );
  }
  console.log('========================================================================================================================\n');
}

export function main(): void {
  process.stdout.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EPIPE') process.exit(0);
  });

  console.log('### PALETTE COLLISION ANALYSIS: ALLOCATOR A vs ALLOCATOR B ###\n');
  checkAllocatorBStatefulness();

  const configs = buildTestConfigurations();
  const evaluations: SuiteEvaluation[] = [];

  for (let idx = 0; idx < configs.length; idx += 1) {
    const config = configs[idx]!;
    const episodeId = `palette-audit-ep-${config.name.replace(/[^a-zA-Z0-9]/g, '-')}-${Date.now()}-${idx}`;
    const metricsA = evaluateAllocatorA(config.satIds);
    const metricsB = evaluateAllocatorB(config.satIds, episodeId);

    const evaluation: SuiteEvaluation = {
      name: config.name,
      category: config.category,
      setSize: config.setSize,
      description: config.description,
      satelliteIds: config.satIds,
      allocatorA: metricsA,
      allocatorB: metricsB,
    };
    evaluations.push(evaluation);
    formatSideBySideReport(evaluation);
  }

  formatCompactVerdictTable(evaluations);
}

if (process.argv[1] !== undefined && import.meta.url.endsWith(path.basename(process.argv[1]))) {
  main();
}
