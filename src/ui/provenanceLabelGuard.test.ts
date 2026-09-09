import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const repoRoot = resolve(new URL('../..', import.meta.url).pathname);

interface SurfaceContract {
  readonly name: string;
  readonly unitFiles: readonly string[];
  readonly unitPattern: RegExp;
  readonly sourceFiles: readonly string[];
  readonly sourcePattern: RegExp;
  readonly labelFiles: readonly string[];
  readonly labelPattern: RegExp;
}

function readRepoFile(relativePath: string): string {
  return readFileSync(resolve(repoRoot, relativePath), 'utf8');
}

function combined(relativePaths: readonly string[]): string {
  return relativePaths.map(readRepoFile).join('\n');
}

/**
 * Static guard for the known physical-value surfaces. This is intentionally
 * explicit: a broad grep that matches zero files can look green while missing
 * the UI entirely. Each contract requires physical-unit text, a Walker source
 * marker, and a concrete provenance badge in the surface's source.
 */
const contracts: readonly SurfaceContract[] = [
  {
    name: 'homepage beam rail',
    unitFiles: ['src/ui/homepage/HomepageBeamRail.tsx'],
    unitPattern: /bit\/s|Kbit\/J|SINR|Power|Throughput/,
    sourceFiles: ['src/ui/homepage/HomepageBeamRail.tsx'],
    sourcePattern: /sourceProvenance\s*=\s*'synthetic-walker'/,
    labelFiles: ['src/ui/homepage/HomepageBeamRail.tsx'],
    labelPattern: /<ProvenanceBadge\s+source=\{sourceProvenance\}\s+testId="homepage-beam-rail-source-badge"/,
  },
  {
    name: 'homepage mixed teaching rail',
    unitFiles: ['src/ui/homepage/HandoverTeachingRail.tsx'],
    unitPattern: /Kbit\/J|elev|仰角|EE/,
    sourceFiles: ['src/ui/homepage/HandoverTeachingRail.tsx'],
    sourcePattern: /synthetic-walker-conditional/,
    labelFiles: ['src/ui/homepage/HandoverTeachingRail.tsx'],
    labelPattern: /<ProvenanceBadge\s+source="authored-teaching"[\s\S]*<ProvenanceBadge\s+source="synthetic-walker-conditional"/,
  },
  {
    name: 'candidate comparison board',
    unitFiles: ['src/ui/handover-evaluation/CandidateSetPanel.tsx'],
    unitPattern: /bit\/J|dB|Elevation|仰角|Range|距離/,
    sourceFiles: ['src/ui/handover-evaluation/CandidateSetPanel.tsx'],
    sourcePattern: /walker-cell-surrogate/,
    labelFiles: ['src/ui/handover-evaluation/CandidateSetPanel.tsx'],
    labelPattern: /<ProvenanceBadge[\s\S]*testId="handover-candidate-source-badge"/,
  },
  {
    name: 'handover evaluation panel',
    unitFiles: ['src/ui/handover-evaluation/HandoverEvaluationPanel.tsx'],
    unitPattern: /dB|SINR|波束|beam/,
    sourceFiles: ['src/ui/handover-evaluation/HandoverEvaluationPanel.tsx'],
    sourcePattern: /walker-cell-surrogate/,
    labelFiles: ['src/ui/handover-evaluation/HandoverEvaluationPanel.tsx'],
    labelPattern: /<ProvenanceBadge[\s\S]*testId="handover-evaluation-source-badge"/,
  },
  {
    name: 'Walker results rail',
    unitFiles: ['src/ui/signal-tuning/WalkerResultsRail.tsx'],
    unitPattern: /dB|W|bit\/J|Mbit\/s/,
    sourceFiles: ['src/ui/signal-tuning/WalkerResultsRail.tsx'],
    sourcePattern: /data-right-rail-source="walker-live-scene-frame"/,
    labelFiles: ['src/ui/signal-tuning/WalkerResultsRail.tsx'],
    labelPattern: /<ProvenanceBadge\s+source="synthetic-walker"\s+testId="walker-results-source-badge"/,
  },
  {
    name: 'Walker InfoPanel formula group',
    unitFiles: [
      'src/ui/info-panel/DuelSignalColumn.tsx',
      'src/ui/info-panel/FormulaTermsReadout.tsx',
      'src/ui/signal-tuning/AngleAwareValueRows.tsx',
    ],
    unitPattern: /dB|km|distance|elevation|range/i,
    sourceFiles: ['src/ui/InfoPanel.tsx'],
    sourcePattern: /sourceProvenance\s*=\s*'synthetic-walker'/,
    labelFiles: ['src/ui/InfoPanel.tsx'],
    labelPattern: /<ProvenanceBadge\s+source=\{sourceProvenance\}\s+testId="info-panel-source-badge"/,
  },
  {
    name: 'Walker signal-tuning formula surface',
    unitFiles: [
      'src/ui/SignalTuningPanel.tsx',
      'src/ui/signal-tuning/WalkerEeTab.tsx',
      'src/ui/signal-tuning/WalkerPowerTab.tsx',
      'src/ui/signal-tuning/WalkerThroughputTab.tsx',
    ],
    unitPattern: /dB|W|MHz|bit\/J|SINR/i,
    sourceFiles: ['src/ui/SignalTuningPanel.tsx'],
    sourcePattern: /data-provenance-source="synthetic-walker"/,
    labelFiles: ['src/ui/SignalTuningPanel.tsx'],
    labelPattern: /<ProvenanceBadge\s+source="synthetic-walker"\s+testId="signal-tuning-source-badge"/,
  },
  {
    name: 'scene beam callouts',
    unitFiles: ['src/viz/SinrLiveCellBeamCallouts.tsx'],
    unitPattern: /dB|bit\/J|Kbit\/J|data-sinr-db|data-ee-bits-per-joule/,
    sourceFiles: ['src/viz/SinrLiveCellBeamCallouts.tsx'],
    sourcePattern: /sourceProvenance\s*=\s*'synthetic-walker'/,
    labelFiles: ['src/viz/SinrLiveCellBeamCallouts.tsx'],
    labelPattern: /<ProvenanceBadge\s+source=\{sourceProvenance\}\s+testId="beam-callout-source-badge"/,
  },
];

for (const contract of contracts) {
  const unitSource = combined(contract.unitFiles);
  const sourceSource = combined(contract.sourceFiles);
  const labelSource = combined(contract.labelFiles);
  assert.match(
    unitSource,
    contract.unitPattern,
    `PROVENANCE GUARD FAILED: ${contract.name} no longer renders a known physical unit`,
  );
  assert.match(
    sourceSource,
    contract.sourcePattern,
    `PROVENANCE GUARD FAILED: ${contract.name} has no synthetic Walker source marker`,
  );
  assert.match(
    labelSource,
    contract.labelPattern,
    `PROVENANCE GUARD FAILED: ${contract.name} renders physical Walker values without a provenance label`,
  );
  console.log(`PROVENANCE GUARD PASS: ${contract.name}`);
}

console.log(`PROVENANCE GUARD PASSED: ${contracts.length} synthetic-Walker physical surfaces checked`);
