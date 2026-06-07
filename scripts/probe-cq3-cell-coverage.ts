/**
 * CQ3 cell-coverage probe (throwaway). Builds leo's own earth-fixed cell layout
 * with the producer's realistic-cells params and tests whether 37 cells actually
 * tile the 200x90 km user area, and how 100 uniform UEs map to cells (off-axis).
 */
import { buildCellLayout, type CellLayout } from '../src/engine/cells/cellLayout';
import { computeOffAxisDeg } from '../src/engine/signal/beam-gain';

const DEG2RAD = Math.PI / 180;

function span(layout: CellLayout) {
  const xs = layout.centers.map(c => c.localXKm);
  const ys = layout.centers.map(c => c.localYKm);
  return {
    xMin: Math.min(...xs), xMax: Math.max(...xs),
    yMin: Math.min(...ys), yMax: Math.max(...ys),
  };
}

// deterministic uniform UEs in 200x90 (centered), mulberry32 seed 7
function uniformUEs(n: number, seed: number) {
  let s = seed >>> 0;
  const rnd = () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const ues: { x: number; y: number }[] = [];
  for (let i = 0; i < n; i += 1) {
    ues.push({ x: (rnd() - 0.5) * 200, y: (rnd() - 0.5) * 90 });
  }
  return ues;
}

function report(label: string, beamwidthDeg: number, cellCount: number, altKm: number) {
  const layout = buildCellLayout({
    centerLatDeg: 40, centerLonDeg: 116,
    altitudeKm: altKm,
    beamwidth3dBRad: beamwidthDeg * DEG2RAD,
    cellCount,
  });
  const sp = span(layout);
  console.log(`\n=== ${label}: ${cellCount} cells, beamwidth=${beamwidthDeg}deg, alt=${altKm}km ===`);
  console.log(`  cellRadius=${layout.cellRadiusKm.toFixed(2)}km`);
  console.log(`  cell-center span: X[${sp.xMin.toFixed(1)},${sp.xMax.toFixed(1)}] (=${(sp.xMax - sp.xMin).toFixed(0)}km)  Y[${sp.yMin.toFixed(1)},${sp.yMax.toFixed(1)}] (=${(sp.yMax - sp.yMin).toFixed(0)}km)`);
  console.log(`  service area: 200 x 90 km`);

  const ues = uniformUEs(100, 7);
  const nearestDists: number[] = [];
  const offAxis: number[] = [];
  let inCell = 0; // within cellRadius of nearest center
  let inCircum = 0; // within circumradius (tiled hex)
  const circum = layout.cellRadiusKm; // axial 'size' == circumradius here
  const inscribed = layout.cellRadiusKm * Math.sqrt(3) / 2;
  for (const ue of ues) {
    let best = Infinity;
    for (const c of layout.centers) {
      const d = Math.hypot(ue.x - c.localXKm, ue.y - c.localYKm);
      if (d < best) best = d;
    }
    nearestDists.push(best);
    offAxis.push(computeOffAxisDeg(best, altKm));
    if (best <= inscribed) inCell += 1;
    if (best <= circum) inCircum += 1;
  }
  nearestDists.sort((a, b) => a - b);
  offAxis.sort((a, b) => a - b);
  const mean = nearestDists.reduce((s, d) => s + d, 0) / nearestDists.length;
  console.log(`  inscribed-r=${inscribed.toFixed(1)}km circum-r=${circum.toFixed(1)}km`);
  console.log(`  UE->nearest-cell dist: mean=${mean.toFixed(1)}km p50=${nearestDists[50].toFixed(1)} p95=${nearestDists[95].toFixed(1)} max=${nearestDists[99].toFixed(1)}km`);
  console.log(`  UEs within inscribed radius (cleanly in a beam): ${inCell}/100`);
  console.log(`  UEs within circumradius (tiled hex covered): ${inCircum}/100`);
  console.log(`  off-axis to nearest cell: p50=${offAxis[50].toFixed(2)}deg p95=${offAxis[95].toFixed(2)}deg max=${offAxis[99].toFixed(2)}deg (3dB half=${(beamwidthDeg / 2).toFixed(2)}deg)`);
}

report('producer realistic-cells', 2.0, 37, 780);
report('wider beam variant', 3.32, 37, 780);
report('more cells variant', 2.0, 61, 780);
report('leo-candidate-rich-ish', 3.32, 37, 550);
