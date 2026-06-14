import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  MODQN_BEAM_COUNT_CLAIM_LABELS,
  getModqnBeamCountBridgeClaim,
} from '../src/modqn/replay-bundle/index.ts';

type ScanStatus = 'PASS' | 'FAIL';

interface ScanResult {
  status: ScanStatus;
  leaks: string[];
  scannedFiles: string[];
}

interface RuntimeNonAdoptionScanResult {
  status: ScanStatus;
  leaks: string[];
  scannedPaths: readonly string[];
}

interface GuardCheck {
  name: string;
  status: ScanStatus;
  details: string[];
}

const ROOT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..');
const VALIDATOR_SCRIPT = 'node --import tsx/esm scripts/validate-modqn-phase6r-runtime-frame-step-boundary.ts';
const SUMMARY_SCHEMA_VERSION = 'phase6r-runtime-frame-step-boundary-summary-v1';
const MODQN_PHASE_DOC_PREFIX = 'docs/modqn-baseline-';
const RUNTIME_HELPER_PATH = 'src/scene/runtimeFrameStep.ts';
const USE_SIMULATION_PATH = 'src/scene/useSimulation.ts';
const PHASE6P_VALIDATOR_PATH = 'scripts/validate-modqn-phase6p-hobs-sinr-kpi-baseline.ts';
const PHASE6R_DOC_PATH = 'docs/modqn-baseline-phase6r-runtime-frame-step-boundary.md';

const RUNTIME_NON_ADOPTION_SCAN_PATHS = [
  'src/engine/signal',
  'src/engine/handover',
  'src/scene',
  'src/profiles',
  'src/ui',
  'src/modqn',
  'src/App.tsx',
  'src/signalTuning.ts',
  'src/handoverPolicyTuning.ts',
] as const;

function readRepoFile(relativePath: string): string {
  return readFileSync(join(ROOT_DIR, relativePath), 'utf8');
}

function listRepoFiles(relativePath: string): string[] {
  const fullPath = join(ROOT_DIR, relativePath);
  if (!existsSync(fullPath)) return [];
  const stat = statSync(fullPath);
  if (stat.isFile()) return [relativePath];
  return readdirSync(fullPath)
    .flatMap(entry => listRepoFiles(join(relativePath, entry)))
    .sort((a, b) => a.localeCompare(b));
}

function gitOutput(args: string[]): string | null {
  try {
    return execFileSync('git', args, {
      cwd: ROOT_DIR,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return null;
  }
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values)];
}

function importSpecifiers(source: string): string[] {
  const specifiers: string[] = [];
  const pattern = /^\s*import[\s\S]*?\bfrom\s+['"]([^'"]+)['"];?/gm;
  for (const match of source.matchAll(pattern)) {
    specifiers.push(match[1]);
  }
  return specifiers;
}

function stripComments(source: string): string {
  // Remove block comments (/* ... */) and line comments (// ...) so that prose
  // describing the post-6Q delegation (e.g. a comment noting that
  // `hoManager.update()` now fires *inside* stepRuntimeFrame) is not mistaken
  // for a pre-6Q inlined-loop call. The duplicate-loop token scan must assert
  // against real code, not documentation.
  return source
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

function matchingLines(relativePath: string, pattern: RegExp): string[] {
  const source = readRepoFile(relativePath);
  const matches: string[] = [];
  for (const [lineIndex, line] of source.split(/\r?\n/).entries()) {
    if (pattern.test(line)) {
      matches.push(`${relativePath}:${lineIndex + 1}: ${line.trim()}`);
    }
  }
  return matches;
}

function isCoreChannelImport(specifier: string): boolean {
  return specifier === '@/core/channel'
    || specifier.startsWith('@/core/channel/')
    || specifier === 'src/core/channel'
    || specifier.startsWith('src/core/channel/')
    || specifier === 'core/channel'
    || specifier.startsWith('core/channel/')
    || specifier.includes('/core/channel/');
}

function forbiddenRuntimeImportReason(specifier: string): string | null {
  if (
    specifier === 'react'
    || specifier.startsWith('react/')
    || specifier === 'react-dom'
    || specifier.startsWith('react-dom/')
  ) {
    return 'React import';
  }
  if (specifier === '@react-three/fiber' || specifier.startsWith('@react-three/')) {
    return 'R3F import';
  }
  if (specifier === 'three' || specifier.startsWith('three/')) {
    return 'Three.js import';
  }
  if (
    specifier.includes('/ui/')
    || specifier.endsWith('/ui')
    || specifier === '@/ui'
    || specifier.startsWith('@/ui/')
  ) {
    return 'UI import';
  }
  if (
    specifier === '../App'
    || specifier === './App'
    || specifier.endsWith('/App')
    || specifier.includes('/App.')
    || specifier.endsWith('/main')
    || specifier.includes('/main.')
  ) {
    return 'app-shell import';
  }
  if (specifier.endsWith('.tsx')) {
    return 'TSX import';
  }
  return null;
}

function guardCheck(name: string, failures: string[], details: string[] = []): GuardCheck {
  return {
    name,
    status: failures.length === 0 ? 'PASS' : 'FAIL',
    details: failures.length === 0 ? details : failures,
  };
}

function validateRuntimeFrameStepBoundary(): GuardCheck {
  const source = readRepoFile(RUNTIME_HELPER_PATH);
  const imports = importSpecifiers(source);
  const failures: string[] = [];

  for (const specifier of imports) {
    const forbiddenReason = forbiddenRuntimeImportReason(specifier);
    if (forbiddenReason) {
      failures.push(`${RUNTIME_HELPER_PATH}: forbidden ${forbiddenReason}: ${specifier}`);
    }
    if (isCoreChannelImport(specifier)) {
      failures.push(`${RUNTIME_HELPER_PATH}: imports vendored core channel path: ${specifier}`);
    }
  }

  const forbiddenBrowserTokens = /\b(React|JSX|useFrame|window|document|navigator|localStorage|sessionStorage|requestAnimationFrame|cancelAnimationFrame|HTMLElement|HTMLCanvasElement|CanvasRenderingContext2D|WebGLRenderingContext|WebGL2RenderingContext|MouseEvent|PointerEvent|KeyboardEvent|TouchEvent)\b/;
  failures.push(...matchingLines(RUNTIME_HELPER_PATH, forbiddenBrowserTokens)
    .map(line => `forbidden browser/React token: ${line}`));

  if (!RUNTIME_HELPER_PATH.endsWith('.ts')) {
    failures.push(`${RUNTIME_HELPER_PATH} must remain a .ts helper`);
  }
  if (/<[A-Z][A-Za-z0-9]*(?:\s|>|\/)/.test(source)) {
    failures.push(`${RUNTIME_HELPER_PATH} appears to contain JSX syntax`);
  }
  if (!imports.includes('../engine/signal/link-budget')) {
    failures.push(`${RUNTIME_HELPER_PATH} no longer imports the existing engine link-budget path`);
  }
  if (!imports.includes('../engine/handover/handover-manager')) {
    failures.push(`${RUNTIME_HELPER_PATH} no longer imports the existing engine handover manager`);
  }
  if (!/\bcomputeLinkBudget\(/.test(source)) {
    failures.push(`${RUNTIME_HELPER_PATH} no longer calls computeLinkBudget()`);
  }
  if (!/\bhoManager\.update\(/.test(source)) {
    failures.push(`${RUNTIME_HELPER_PATH} no longer calls HandoverManager.update()`);
  }
  if (/\b(computeSinr|LeoChannelCoreAdapter)\b/.test(source)) {
    failures.push(`${RUNTIME_HELPER_PATH} contains source-backed channel adapter tokens`);
  }

  return guardCheck('runtimeFrameStep helper dependency boundary', failures, [
    `${RUNTIME_HELPER_PATH} imports only repo-local runtime engine/helper modules`,
    'existing HOBS/SINR path remains ../engine/signal/link-budget plus HandoverManager',
    'no vendored src/core/channel or browser/UI dependency was found',
  ]);
}

function validateUseSimulationBoundary(): GuardCheck {
  const source = readRepoFile(USE_SIMULATION_PATH);
  const failures: string[] = [];

  if (!/import\s*{[\s\S]*\bstepRuntimeFrame\b[\s\S]*}\s*from\s+['"]\.\/runtimeFrameStep['"]/.test(source)) {
    failures.push(`${USE_SIMULATION_PATH} must import stepRuntimeFrame from ./runtimeFrameStep`);
  }
  if (!/\bstepRuntimeFrame\(\s*{/.test(source)) {
    failures.push(`${USE_SIMULATION_PATH} must call stepRuntimeFrame()`);
  }

  const duplicateLoopTokens: Array<[string, RegExp]> = [
    ['computeLinkBudget', /\bcomputeLinkBudget\b/],
    ['scheduleBeamCells', /\bscheduleBeamCells\b/],
    ['generateWalkerConstellation', /\bgenerateWalkerConstellation\b/],
    ['propagateOrbitElement', /\bpropagateOrbitElement\b/],
    ['computeTopocentricPoint', /\bcomputeTopocentricPoint\b/],
    ['computeTr38811SlantRangeKm', /\bcomputeTr38811SlantRangeKm\b/],
    ['buildBeamPowerOverrideDbmByKey', /\bbuildBeamPowerOverrideDbmByKey\b/],
    ['updateBeamPowerControlStates', /\bupdateBeamPowerControlStates\b/],
    ['resolveLatticeSteering', /\bresolveLatticeSteering\b/],
    ['interpolateVisibleSats', /\binterpolateVisibleSats\b/],
    ['buildLinkContext', /\bbuildLinkContext\b/],
    ['hoManager.update', /\bhoManager\.update\(/],
  ];
  // The duplicate-loop token scan asserts the pre-6Q inlined frame-step loop no
  // longer lives in useSimulation (it now delegates to stepRuntimeFrame). Run it
  // against code-only text so a comment documenting the post-6Q delegation does
  // not register as a re-inlined call — the intent is "no real pre-6Q loop call",
  // not "no mention of the helper's internals in prose".
  const useSimulationCode = stripComments(source);
  for (const [label, pattern] of duplicateLoopTokens) {
    if (pattern.test(useSimulationCode)) {
      failures.push(`${USE_SIMULATION_PATH} still contains pre-6Q frame-step token ${label}`);
    }
  }

  return guardCheck('useSimulation shared-helper consumer boundary', failures, [
    `${USE_SIMULATION_PATH} imports and calls stepRuntimeFrame()`,
    'pre-6Q orbit/link-budget/beam-scheduler/handover loop tokens are absent from useSimulation',
  ]);
}

function validatePhase6PSharedHelperUse(): GuardCheck {
  const source = readRepoFile(PHASE6P_VALIDATOR_PATH);
  const failures: string[] = [];

  if (!/import\s*{[\s\S]*\bstepRuntimeFrame\b[\s\S]*}\s*from\s+['"]\.\.\/src\/scene\/runtimeFrameStep\.ts['"]/.test(source)) {
    failures.push(`${PHASE6P_VALIDATOR_PATH} must import stepRuntimeFrame from src/scene/runtimeFrameStep.ts`);
  }
  if (!/\bstepRuntimeFrame\(\s*{/.test(source)) {
    failures.push(`${PHASE6P_VALIDATOR_PATH} must call stepRuntimeFrame()`);
  }

  const duplicatedRuntimeTokens: Array<[string, RegExp]> = [
    ['local stepRuntimeFrame implementation', /\bfunction\s+stepRuntimeFrame\b/],
    ['local buildLinkContext implementation', /\bfunction\s+buildLinkContext\b/],
    ['local interpolateVisibleSats implementation', /\bfunction\s+interpolateVisibleSats\b/],
    ['computeLinkBudget', /\bcomputeLinkBudget\b/],
    ['scheduleBeamCells', /\bscheduleBeamCells\b/],
    ['generateWalkerConstellation', /\bgenerateWalkerConstellation\b/],
    ['propagateOrbitElement', /\bpropagateOrbitElement\b/],
    ['computeTr38811SlantRangeKm', /\bcomputeTr38811SlantRangeKm\b/],
    ['updateBeamPowerControlStates', /\bupdateBeamPowerControlStates\b/],
    ['buildBeamPowerOverrideDbmByKey', /\bbuildBeamPowerOverrideDbmByKey\b/],
  ];
  for (const [label, pattern] of duplicatedRuntimeTokens) {
    if (pattern.test(source)) {
      failures.push(`${PHASE6P_VALIDATOR_PATH} contains duplicated frame-step logic token ${label}`);
    }
  }

  return guardCheck('Phase 6P validator shared-helper boundary', failures, [
    `${PHASE6P_VALIDATOR_PATH} imports and calls the shared runtime frame-step helper`,
    'script-local runtime loop reconstruction tokens are absent',
  ]);
}

function validatePackageScript(): GuardCheck {
  const packageJson = JSON.parse(readRepoFile('package.json')) as {
    scripts?: Record<string, string>;
  };
  const actual = packageJson.scripts?.['validate:modqn:phase6r-runtime-frame-step-boundary'];
  const failures = actual === VALIDATOR_SCRIPT
    ? []
    : [`package.json command drift: expected "${VALIDATOR_SCRIPT}", got "${actual ?? '<missing>'}"`];

  return guardCheck('package script boundary', failures, [
    'package.json exposes exactly the Phase 6R validator command expected by this guard',
  ]);
}

function validatePhase6RDoc(): GuardCheck {
  const source = readRepoFile(PHASE6R_DOC_PATH);
  const failures: string[] = [];
  const requiredPatterns: Array<[string, RegExp]> = [
    ['read-only guard scope', /read-only guard/i],
    ['runtime non-adoption', /runtime adoption status:\s+\*\*not adopted\*\*/i],
    ['7-beam baseline boundary', /`7`\s+beams remains? the accepted regenerated baseline MODQN evidence path/i],
    ['19/37 sensitivity boundary', /`19`\s+and\s+`37`\s+remain sensitivity\/demo only/i],
    ['HOBS/SINR replay boundary', /HOBS\/SINR live output is not MODQN replay evidence/i],
    ['Phase 6S recommendation', /Recommended Phase 6S Scope/i],
  ];

  for (const [label, pattern] of requiredPatterns) {
    if (!pattern.test(source)) {
      failures.push(`${PHASE6R_DOC_PATH} missing ${label}`);
    }
  }

  return guardCheck('Phase 6R documentation boundary', failures, [
    `${PHASE6R_DOC_PATH} records read-only scope, non-adoption, claim limits, and Phase 6S scope`,
  ]);
}

function scanRuntimeNonAdoption(): RuntimeNonAdoptionScanResult {
  const leaks: string[] = [];
  const importFromCoreChannel = /^\s*import\b.*\bfrom\s+['"][^'"]*(?:@\/core\/channel|src\/core\/channel|core\/channel)[^'"]*['"]/;
  const phase6RTokens = /\b(phase6r|runtime-frame-step-boundary|validate-modqn-phase6r-runtime-frame-step-boundary)\b/i;
  const files = RUNTIME_NON_ADOPTION_SCAN_PATHS
    .flatMap(scanPath => listRepoFiles(scanPath))
    .filter(file => ['.ts', '.tsx', '.json'].includes(extname(file)));

  for (const file of files) {
    const text = readRepoFile(file);
    for (const [lineIndex, line] of text.split(/\r?\n/).entries()) {
      if (importFromCoreChannel.test(line) || phase6RTokens.test(line)) {
        leaks.push(`${file}:${lineIndex + 1}: ${line.trim()}`);
      }
    }
  }

  return {
    status: leaks.length === 0 ? 'PASS' : 'FAIL',
    leaks,
    scannedPaths: RUNTIME_NON_ADOPTION_SCAN_PATHS,
  };
}

function phaseDocsAndChangedFiles(): string[] {
  const changedTracked = gitOutput(['diff', '--name-only', '--diff-filter=ACMRTUXB', 'HEAD']);
  const changedUntracked = gitOutput(['ls-files', '--others', '--exclude-standard']);
  const changed = [
    ...(changedTracked ? changedTracked.split(/\r?\n/).filter(Boolean) : []),
    ...(changedUntracked ? changedUntracked.split(/\r?\n/).filter(Boolean) : []),
  ];
  const phaseDocs = listRepoFiles('docs')
    .filter(file => file.startsWith(MODQN_PHASE_DOC_PREFIX) && file.endsWith('.md'));

  return unique([...changed, ...phaseDocs])
    .filter(file => ['.ts', '.tsx', '.mjs', '.md', '.json'].includes(extname(file)))
    .filter(file => existsSync(join(ROOT_DIR, file)));
}

function assertClaimBoundaryHelpers(leaks: string[]): void {
  if (!/baseline/i.test(MODQN_BEAM_COUNT_CLAIM_LABELS[7])) {
    leaks.push('7-beam claim label lost baseline boundary');
  }
  for (const beamCount of [19, 37] as const) {
    const claim = getModqnBeamCountBridgeClaim(beamCount);
    if (claim.kind !== 'live-sensitivity-demo-only') {
      leaks.push(`${beamCount} claim kind drifted to ${claim.kind}`);
    }
    if (claim.supportsProducerReplayEvidence !== false) {
      leaks.push(`${beamCount} leaked producer replay evidence support`);
    }
    if (claim.mayDeriveProducerBeamIdentity !== false) {
      leaks.push(`${beamCount} leaked producer identity derivation`);
    }
    if (/baseline/i.test(claim.label)) {
      leaks.push(`${beamCount} label leaked baseline wording`);
    }
  }
}

function scanUnsupported1937Claims(): ScanResult {
  const scannedFiles = phaseDocsAndChangedFiles();
  const leaks: string[] = [];

  assertClaimBoundaryHelpers(leaks);

  for (const file of scannedFiles) {
    const text = readRepoFile(file);
    for (const [lineIndex, line] of text.split(/\r?\n/).entries()) {
      const normalized = line.replace(/\s+/g, ' ');
      const referencesExtendedCounts = /(19\s*\/\s*37|19[- ]?beam|37[- ]?beam|19\s+or\s+37|19\s+and\s+37)/i.test(normalized);
      const referencesEvidence = /trained[- ]baseline MODQN evidence|trained baseline MODQN evidence/i.test(normalized);
      const isNegatedBoundary = /\b(not|no|must not|does not|do not|without|unless|forbidden|reject|remain|remains|sensitivity\/demo|extension only|false|claim boundary|unsupported|stop|scope|non-scope|only)\b/i.test(normalized);
      if (referencesExtendedCounts && referencesEvidence && !isNegatedBoundary) {
        leaks.push(`${file}:${lineIndex + 1}: ${normalized.trim()}`);
      }
    }
  }

  return {
    status: leaks.length === 0 ? 'PASS' : 'FAIL',
    leaks,
    scannedFiles,
  };
}

function scanModqnReplayEvidenceClaims(): ScanResult {
  const scannedFiles = phaseDocsAndChangedFiles();
  const leaks: string[] = [];

  for (const file of scannedFiles) {
    const text = readRepoFile(file);
    for (const [lineIndex, line] of text.split(/\r?\n/).entries()) {
      const normalized = line.replace(/\s+/g, ' ');
      const referencesHobsSinr = /\b(HOBS|SINR live|live SINR|HOBS\/SINR live output|HOBS\/SINR live)\b/i.test(normalized);
      const referencesReplayEvidence = /MODQN replay evidence/i.test(normalized);
      const isNegatedBoundary = /\b(not|no|must not|does not|do not|without|unless|forbidden|reject|remain|remains|false|claim boundary|non-scope|separate|distinct|distinguish|risk|stop|labeled|labelled)\b/i.test(normalized);
      if (referencesHobsSinr && referencesReplayEvidence && !isNegatedBoundary) {
        leaks.push(`${file}:${lineIndex + 1}: ${normalized.trim()}`);
      }
    }
  }

  return {
    status: leaks.length === 0 ? 'PASS' : 'FAIL',
    leaks,
    scannedFiles,
  };
}

function run(): void {
  const guardChecks = [
    validateRuntimeFrameStepBoundary(),
    validateUseSimulationBoundary(),
    validatePhase6PSharedHelperUse(),
    validatePackageScript(),
    validatePhase6RDoc(),
  ];
  const runtimeScan = scanRuntimeNonAdoption();
  const unsupportedClaimScan = scanUnsupported1937Claims();
  const replayEvidenceClaimScan = scanModqnReplayEvidenceClaims();
  const failures = [
    ...guardChecks.flatMap(check => check.status === 'PASS' ? [] : check.details),
    ...runtimeScan.leaks.map(leak => `runtime adoption leak: ${leak}`),
    ...unsupportedClaimScan.leaks.map(leak => `unsupported 19/37 claim: ${leak}`),
    ...replayEvidenceClaimScan.leaks.map(leak => `MODQN replay evidence claim leak: ${leak}`),
  ];

  const summary = {
    schemaVersion: SUMMARY_SCHEMA_VERSION,
    phase: '6R',
    generatedAt: new Date().toISOString(),
    repo: 'leo-beam-sim',
    validator: VALIDATOR_SCRIPT,
    overallStatus: failures.length === 0 ? 'PASS' : 'FAIL',
    runtimeBehaviorChangedByPhase6R: false,
    browserSmokeRun: false,
    phase6RAllowedSurfaces: [
      'scripts/validate-modqn-phase6r-runtime-frame-step-boundary.ts',
      'docs/modqn-baseline-phase6r-runtime-frame-step-boundary.md',
      'package.json script validate:modqn:phase6r-runtime-frame-step-boundary',
    ],
    guardChecks,
    runtimeNonAdoptionScan: runtimeScan,
    unsupported1937TrainedBaselineClaimScan: unsupportedClaimScan.status,
    modqnReplayEvidenceClaimScan: replayEvidenceClaimScan.status,
    unsupported1937ScannedFileCount: unsupportedClaimScan.scannedFiles.length,
    replayEvidenceScannedFileCount: replayEvidenceClaimScan.scannedFiles.length,
    claimBoundary: {
      acceptedModqnEvidenceBeamCount: 7,
      sensitivityDemoOnlyBeamCounts: [19, 37],
      hobsSinrLiveOutputIsModqnReplayEvidence: false,
    },
    recommendedPhase6S:
      'Keep Phase 6S read-only unless an explicit runtime adoption gate is opened; if opened, require before/after HOBS/SINR KPI drift gates, source-backed channel-adoption evidence, and UI/replay claim labels.',
    failures,
  };

  console.log(JSON.stringify(summary, null, 2));
  if (summary.overallStatus !== 'PASS') {
    process.exitCode = 1;
  }
}

run();
