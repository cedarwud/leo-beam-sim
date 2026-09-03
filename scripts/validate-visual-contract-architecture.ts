import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUTPUT_DIR = join(REPO_ROOT, 'output/playwright/visual-contract');
const REPORT_PATH = join(OUTPUT_DIR, 'architecture-report.json');

type Check = {
  readonly id: string;
  readonly passed: boolean;
  readonly evidence: Record<string, unknown>;
};

async function source(relativePath: string): Promise<string> {
  return readFile(join(REPO_ROOT, relativePath), 'utf8');
}

function check(id: string, passed: boolean, evidence: Record<string, unknown>): Check {
  return { id, passed, evidence };
}

function count(pattern: RegExp, value: string): number {
  return value.match(pattern)?.length ?? 0;
}

async function main(): Promise<void> {
  const paths = {
    session: 'src/visualLab/session/visualLabSession.ts',
    sessionIndex: 'src/visualLab/session/index.ts',
    compiler: 'src/visualLab/session/scenePlanCompiler.ts',
    compilerTest: 'src/visualLab/session/scenePlanCompiler.test.ts',
    unified: 'src/prototype/visual-lab-g0/UnifiedVisualLabPrototype.tsx',
    scene: 'src/prototype/visual-lab-g0/VisualLabScene.tsx',
    fixture: 'src/visualAcceptance/fixtureApp.tsx',
    fixtureHtml: 'visual-contract-fixture.html',
    browserValidator: 'scripts/validate-visual-contract-browser.ts',
  } as const;
  const [session, sessionIndex, compiler, compilerTest, unified, scene, fixture, fixtureHtml, browserValidator] = await Promise.all(
    Object.values(paths).map(path => source(path)),
  );
  const checks: Check[] = [];

  checks.push(check('session-public-surface', /export interface VisualLabSession\s*\{[\s\S]*?snapshot\(\): LabSnapshot;[\s\S]*?subscribe\(listener: \(snapshot: LabSnapshot\) => void\): \(\) => void;[\s\S]*?dispatch\(command: LabCommand\): Promise<DispatchResult>;/.test(session)
    && /publicSession = Object\.freeze\(\{[\s\S]*?snapshot:[\s\S]*?subscribe:[\s\S]*?dispatch:/.test(session), {
    requiredMethods: ['snapshot', 'subscribe', 'dispatch'],
    evidence: 'VisualLabSession interface and publicSession facade are source-reachable.',
  }));

  checks.push(check('private-compiler-boundary', !sessionIndex.includes('scenePlanCompiler')
    && !/export\s+\*\s+from\s+['"][^'"]*scenePlanCompiler/.test(sessionIndex)
    && /compileScenePlan\(/.test(session)
    && !/export\s+(?:function|const|class)\s+compileScenePlan/.test(session), {
    sessionIndexExportsCompiler: false,
    compilerCallSites: count(/compileScenePlan\(/g, session),
    compilerModuleIsolated: true,
  }));

  checks.push(check('unified-uses-scene-plan', /<VisualLabScene[\s\S]*?scenePlan=\{lab\.scenePlan\}/.test(unified), {
    evidence: 'UnifiedVisualLabPrototype passes the current snapshot ScenePlan at the scene boundary.',
  }));

  const rendererBody = scene.match(/function ScenePlanRenderer\([\s\S]*?\n\}\n\nfunction useVisualLabWebGlAvailability/)?.[0] ?? '';
  checks.push(check('private-exhaustive-scene-renderer', rendererBody.length > 0
    && /function ScenePlanRenderer\(/.test(rendererBody)
    && !/export\s+function ScenePlanRenderer/.test(rendererBody)
    && /function assertNeverSceneView\(value: never\): never/.test(scene)
    && /switch \(scenePlan\.view\)/.test(rendererBody)
    && !/default\s*:/.test(rendererBody), {
    rendererPrivate: !/export\s+function ScenePlanRenderer/.test(rendererBody),
    hasNeverGuard: /function assertNeverSceneView\(value: never\): never/.test(scene),
    switchIsExhaustive: !/default\s*:/.test(rendererBody),
  }));

  const canvasCount = count(/<Canvas\b/g, scene);
  checks.push(check('single-canvas-renderer', canvasCount === 1, { canvasCount }));

  const bannedPatterns = [
    'SixActsNav',
    'ShellChromeControls',
    'SixActsTeachingOverlay',
    'manual-hide',
    'manualHide',
    'chrome rail',
    'chrome-rail',
  ];
  const inspectedSources = { unified, scene, session, compiler, fixture, fixtureHtml };
  const bannedHits = Object.entries(inspectedSources).flatMap(([name, text]) => bannedPatterns
    .filter(pattern => text.toLowerCase().includes(pattern.toLowerCase()))
    .map(pattern => `${name}:${pattern}`));
  checks.push(check('legacy-import-quarantine', bannedHits.length === 0, {
    bannedPatterns,
    hits: bannedHits,
    note: 'Static dependency evidence only; generic timeline/sidebar code outside the fixture remains quarantined for later compositor work.',
  }));

  const publicLayerOrPluginExports = Object.entries(inspectedSources).flatMap(([name, text]) => {
    const matches = text.match(/export\s+(?:interface|type|class|function|const)\s+\w*(?:Layer|Plugin)\b/g) ?? [];
    return matches.map(match => `${name}:${match}`);
  });
  checks.push(check('no-public-layer-plugin-framework', publicLayerOrPluginExports.length === 0, {
    exports: publicLayerOrPluginExports,
    note: 'ScenePlanRenderer is a private exhaustive seam, not a public layer/plugin registry.',
  }));

  checks.push(check('view-aware-plan-contract', /presentation\.view\s*===\s*'earth'/.test(compiler)
    && /accepted\.local\s*!==\s*null/.test(compiler)
    && /serviceOnly/.test(compilerTest)
    && /globalOnly/.test(compilerTest)
    && /noProjection/.test(compilerTest), {
    evidence: 'ScenePlan availability is tested against the projection required by earth/sky/service view rather than requiring both projections.',
  }));

  checks.push(check('adversarial-unmarked-census', /bad-unmarked/.test(fixture)
    && /unmarked-fullscreen/.test(fixture)
    && /unmarked-sidebar/.test(fixture)
    && /unmarked-hidden-cue/.test(fixture)
    && /nested-unmarked-fullscreen/.test(fixture)
    && /nested-unmarked-sidebar/.test(fixture)
    && /nested-unmarked-hidden-cue/.test(fixture)
    && /contractCensus/.test(browserValidator)
    && /unregisteredPaintedSurfaces/.test(browserValidator)
    && /hiddenMountedNodes/.test(browserValidator), {
    evidence: 'The browser census inspects computed geometry/paint/hidden mounted nodes, including unmarked descendants nested inside a registered scene role.',
  }));

  checks.push(check('explicit-surface-registration-boundary', /data-contract-surface/.test(fixture)
    && /data-contract-decorative/.test(fixture)
    && /allowedDecorations/.test(browserValidator)
    && /registeredForCensus/.test(browserValidator)
    && !/element\.closest\('\[data-contract-role\]'\) !== null\) return \[\]/.test(browserValidator), {
    evidence: 'Only exact role-root surface registrations and owner-scoped decorative registrations are exempted; role ancestry alone is not an allowlist.',
  }));

  checks.push(check('ancestor-effective-visibility', /bad-ancestor-hidden/.test(fixture)
    && /ancestor-hidden-stage/.test(fixture)
    && /visibilityMethod/.test(browserValidator)
    && /effective-visibility/.test(browserValidator)
    && /!visible\(element\)/.test(browserValidator), {
    evidence: 'Visibility traverses the ancestor chain and the opacity-hidden negative fixture must fail cue, subtitle, effective-visibility, and mounted-node findings.',
  }));

  checks.push(check('allowed-decoration-geometry-envelope', /bad-allowed-decoration-oversize/.test(fixture)
    && /expanded-allowed-star/.test(fixture)
    && /decorationEnvelopes/.test(browserValidator)
    && /invalidDecorationGeometry/.test(browserValidator)
    && /fixed-or-sticky/.test(browserValidator)
    && /decoration-geometry/.test(browserValidator), {
    evidence: 'Allowed decorative registration is not a geometry waiver: stage-relative width/height/area/opaque-paint/position envelopes reject fixed/sticky or oversized painted panels while a low-paint orbit receives a distinct large-outline envelope.',
  }));

  checks.push(check('allowed-decoration-paint-extent', /bad-allowed-decoration-shadow/.test(fixture)
    && /shadow-allowed-star/.test(fixture)
    && /invalidDecorationPaintExtents/.test(browserValidator)
    && /decoration-paint-extent/.test(browserValidator)
    && /stylePaintEffects/.test(browserValidator)
    && /box-shadow/.test(browserValidator)
    && /text-shadow/.test(browserValidator)
    && /backdrop-filter/.test(browserValidator)
    && /outline-offset/.test(browserValidator)
    && /::before/.test(browserValidator)
    && /::after/.test(browserValidator), {
    evidence: 'Registered decorations fail closed on uncontrolled box/text shadows, filters, backdrop filters, outlines, and painted pseudo-elements; the tiny-box giant-shadow fixture must expose decoration-paint-extent.',
  }));

  checks.push(check('subtitle-visibility-responsive-contract', /subtitle\.visible/.test(browserValidator)
    && /subtitleReadable/.test(browserValidator)
    && /responsive-320/.test(browserValidator), {
    evidence: 'Subtitle visibility is computed, and the 320x720 check repeats line-count, font-size, contrast, and line-box bounds.',
  }));

  checks.push(check('route-smoke-quarantine-evidence', /\/simulator/.test(browserValidator)
    && /PRODUCT_REJECTED_QUARANTINED/.test(browserValidator)
    && /current-simulator-quarantine\.png/.test(browserValidator), {
    evidence: 'The current route is smoke-tested separately and recorded as quarantined product evidence, not WI-02 pixel acceptance.',
  }));

  const report = {
    schemaVersion: 'visual-contract-architecture-report-v1',
    status: 'CANDIDATE_STATIC_EVIDENCE',
    checks,
    sourceFiles: paths,
    quarantineMap: {
      legacySixActsShell: 'not imported by the inspected unified scene/session/fixture sources',
      oldStudentDashboard: 'not an acceptance base; no pixel claim is made by this report',
      currentVisualLabTimelineSidebar: 'outside the standalone fixture; later compositor work remains gated by controller review',
    },
    note: 'This report proves source reachability and boundaries only. It does not substitute for browser pixels or owner visual acceptance.',
  };
  await mkdir(OUTPUT_DIR, { recursive: true });
  await writeFile(REPORT_PATH, JSON.stringify(report, null, 2));
  const reportBytes = await readFile(REPORT_PATH);
  const reportHash = createHash('sha256').update(reportBytes).digest('hex');
  assert.equal(checks.every(item => item.passed), true, `architecture checks failed: ${checks.filter(item => !item.passed).map(item => item.id).join(', ')}`);
  console.log(JSON.stringify({ status: 'PASS', checks: checks.length, report: 'output/playwright/visual-contract/architecture-report.json', sha256: reportHash }, null, 2));
}

await main();
