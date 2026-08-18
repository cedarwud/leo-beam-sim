import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  loadTleSnapshotSelection,
  loadTleWebArchiveCatalog,
} from '../src/simulator/archive';
import {
  buildTleAnalysisRun,
} from '../src/simulator/tleAnalysisRun';
import { buildTleRunBundle } from '../src/tle/run';
import {
  ACCEPTED_SCIENTIFIC_FIXTURE_MANIFEST,
  buildScientificExplanationArtifact,
  parseScientificExplanationArtifact,
  resolveScientificStoryEvidence,
} from '../src/explain/model';
import {
  loadScientificExplanationRun,
  type ScientificExplanationPipeline,
} from '../src/explain/route/scientificExplanationLoader';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const artifactPath = join(repoRoot, 'public/explain/accepted-scientific-demo-v1.json');

const fetchFromPublic = async (input: RequestInfo | URL): Promise<Response> => {
  const relativePath = String(input).replace(/^\/+/, '');
  return new Response(await readFile(join(repoRoot, 'public', relativePath)), { status: 200 });
};

const pipeline: ScientificExplanationPipeline = {
  loadCatalog: url => loadTleWebArchiveCatalog(url, fetchFromPublic),
  loadSelection: (catalog, requestedInstantUtc) => (
    loadTleSnapshotSelection(catalog, requestedInstantUtc, fetchFromPublic)
  ),
  buildGeometryRun: buildTleRunBundle,
  buildAnalysisRun: buildTleAnalysisRun,
  resolveEvidence: resolveScientificStoryEvidence,
};

const manifest = ACCEPTED_SCIENTIFIC_FIXTURE_MANIFEST;
const loaded = await loadScientificExplanationRun({ manifest, pipeline });
const artifact = buildScientificExplanationArtifact(loaded.evidence, manifest);
parseScientificExplanationArtifact(artifact, manifest);
const serialized = `${JSON.stringify(artifact, null, 2)}\n`;

if (process.argv.includes('--check')) {
  const current = await readFile(artifactPath, 'utf8');
  if (current !== serialized) throw new Error(`${artifactPath} is stale; regenerate it before publishing /explain`);
  console.log(`scientific explanation artifact is current (${Buffer.byteLength(serialized)} bytes)`);
} else {
  await mkdir(dirname(artifactPath), { recursive: true });
  await writeFile(artifactPath, serialized, 'utf8');
  console.log(`wrote ${artifactPath} (${Buffer.byteLength(serialized)} bytes)`);
}
