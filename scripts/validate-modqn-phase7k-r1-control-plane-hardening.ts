import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..');

const APP_PATH = 'src/App.tsx';
const PLAYBACK_SHELL_PATH = 'src/ui/ModqnReplayPlaybackShell.tsx';
const CONTROL_PLANE_DOC_PATH = 'docs/modqn-baseline-phase7k-frontend-integration-control-plane.md';

const LIVE_CONTROL_TOKENS = [
  'setSimState',
  'setSignalTuning',
  'setHandoverPolicyState',
  'signalResetKey',
  'handoverResetKey',
  'setSignalResetKey',
  'setHandoverResetKey',
] as const;

const PLAYBACK_SHELL_REPLAY_TOKENS = [
  'setSlotOffset',
  'setPlaying',
  'setLoopEnabled',
  'onDisplayStateChange',
] as const;

const REPLAY_CUE_OVERLAY_SCENE_FILES = [
  'src/ui/ModqnReplaySceneCues.tsx',
  'src/ui/ModqnReplaySceneOverlay.tsx',
  'src/scene/ModqnReplaySceneLayer.tsx',
  'src/scene/modqnReplaySceneVisuals.ts',
] as const;

const VISIBLE_COPY_SCAN_FILES = [
  APP_PATH,
  'src/ui/ModeEvidenceStrip.tsx',
  PLAYBACK_SHELL_PATH,
  'src/ui/ModqnReplaySceneCues.tsx',
  'src/ui/ModqnReplaySceneOverlay.tsx',
  'src/ui/ModqnBaselineIntegrationPanel.tsx',
  'src/scene/ModqnReplaySceneLayer.tsx',
  'src/scene/modqnReplaySceneVisuals.ts',
] as const;

const APP_DISPLAY_STATE_ALLOWED_FIELDS = new Set([
  'slotOffset',
  'playing',
  'loopEnabled',
  'currentSlot',
]);

const ALLOWED_NEGATIVE_OR_BOUNDARY_COPY =
  /\b(no|not|does not|do not|must not|forbidden|separate|separated|display-only|deferred|not adopted|sensitivity\/demo|extension only|zero|none|without)\b|(?:^|[^\d])0(?:[^\d]|$)/i;

interface VisibleClaimRule {
  readonly name: string;
  readonly patterns: readonly RegExp[];
}

interface VisibleClaimViolation {
  readonly path: string;
  readonly lineNumber: number;
  readonly ruleName: string;
  readonly text: string;
}

const VISIBLE_CLAIM_RULES: readonly VisibleClaimRule[] = [
  {
    name: 'HOBS/SINR as MODQN replay evidence',
    patterns: [
      /\bHOBS\/SINR\b.{0,120}\bMODQN\b.{0,80}\b(?:replay\s+)?evidence\b/i,
      /\bMODQN\b.{0,80}\b(?:replay\s+)?evidence\b.{0,120}\bHOBS\/SINR\b/i,
    ],
  },
  {
    name: 'source-channel live adopted/enabled/active/runtime adoption',
    patterns: [
      /\bsource-channel\b.{0,100}\blive\b.{0,100}\b(?:adopted|enabled|active|runtime adoption|adoption)\b/i,
      /\blive\b.{0,100}\bsource-channel\b.{0,100}\b(?:adopted|enabled|active|runtime adoption|adoption)\b/i,
    ],
  },
  {
    name: 'scene cue as producer/live geometry truth',
    patterns: [
      /\bscene[-\s]?cues?\b.{0,120}\b(?:producer|live)\b.{0,120}\bgeometry\s+(?:truth|evidence)\b/i,
      /\bgeometry\s+(?:truth|evidence)\b.{0,120}\bscene[-\s]?cues?\b/i,
      /\bscene[-\s]?cues?\b.{0,120}\b(?:maps|mapping|mapped)\b.{0,120}\b(?:producer|live)\b/i,
    ],
  },
  {
    name: '19/37 trained baseline evidence',
    patterns: [
      /\b(?:19|37|19\/37|19-beam|37-beam)\b.{0,120}\b(?:trained baseline|baseline MODQN evidence|MODQN replay evidence|replay evidence)\b/i,
      /\b(?:trained baseline|baseline MODQN evidence|MODQN replay evidence|replay evidence)\b.{0,120}\b(?:19|37|19\/37|19-beam|37-beam)\b/i,
    ],
  },
  {
    name: 'observed inter-satellite handover evidence',
    patterns: [
      /\bobserved\b.{0,100}\binter[-\s]satellite(?:[-\s]handover)?\b.{0,100}\bevidence\b/i,
      /\binter[-\s]satellite[-\s]handover\b.{0,100}\b(?:observed|evidence)\b/i,
      /\binter[-\s]satellite\b.{0,80}\bhandover\b.{0,100}\b(?:observed|evidence)\b/i,
    ],
  },
  {
    name: 'EE/HEA/Catfish scope/effectiveness/integration',
    patterns: [
      /\b(?:EE-MODQN|HEA-MODQN|Catfish|Multi-Catfish|Catfish-over-HEA)\b.{0,120}\b(?:scope|effectiveness|effective|integration|integrated|supports|adopted|enabled)\b/i,
      /\b(?:scope|effectiveness|effective|integration|integrated|supports|adopted|enabled)\b.{0,120}\b(?:EE-MODQN|HEA-MODQN|Catfish|Multi-Catfish|Catfish-over-HEA)\b/i,
    ],
  },
];

function readRepoFile(relativePath: string): string {
  return readFileSync(join(ROOT_DIR, relativePath), 'utf8');
}

function assertContains(source: string, needle: string, label: string): void {
  assert.ok(source.includes(needle), `${label} missing ${needle}`);
}

function assertNotContains(source: string, needle: string, label: string): void {
  assert.ok(!source.includes(needle), `${label} unexpectedly contains ${needle}`);
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

function extractBracedBlock(source: string, startNeedle: string, label: string): string {
  const start = source.indexOf(startNeedle);
  assert.notEqual(start, -1, `${label} missing ${startNeedle}`);

  const bodyStart = source.indexOf('{', start);
  assert.notEqual(bodyStart, -1, `${label} missing callback body`);

  let depth = 0;
  for (let index = bodyStart; index < source.length; index += 1) {
    const char = source[index];
    if (char === '{') depth += 1;
    if (char === '}') {
      depth -= 1;
      if (depth === 0) {
        return source.slice(bodyStart, index + 1);
      }
    }
  }

  assert.fail(`${label} callback body was not closed`);
}

function assertNoLiveControlTokens(source: string, relativePath: string): void {
  for (const token of LIVE_CONTROL_TOKENS) {
    assertNotContains(source, token, relativePath);
  }
}

function assertPlaybackShellControlPath(): void {
  const source = readRepoFile(PLAYBACK_SHELL_PATH);
  for (const token of PLAYBACK_SHELL_REPLAY_TOKENS) {
    assertContains(source, token, `${PLAYBACK_SHELL_PATH} replay playback control path`);
  }
  assertNoLiveControlTokens(source, PLAYBACK_SHELL_PATH);
}

function assertAppReplayDisplayCallback(): void {
  const appSource = readRepoFile(APP_PATH);
  const block = extractBracedBlock(
    appSource,
    'const handleModqnReplayDisplayStateChange = useCallback(',
    'App replay display-state callback',
  );

  assertContains(block, 'setModqnReplayDisplayState', 'App replay display-state callback');
  for (const token of LIVE_CONTROL_TOKENS) {
    assertNotContains(block, token, 'App replay display-state callback');
  }

  const setterTokens = unique(block.match(/\bset[A-Z][A-Za-z0-9_]*/g) ?? []);
  assert.deepEqual(
    setterTokens,
    ['setModqnReplayDisplayState'],
    'App replay display-state callback must not call non-replay setters',
  );

  const fieldTokens = unique(
    [...block.matchAll(/\b(?:current|next)\.([A-Za-z_$][A-Za-z0-9_$]*)/g)]
      .map(match => match[1] ?? ''),
  );
  const unexpectedFields = fieldTokens.filter(field => !APP_DISPLAY_STATE_ALLOWED_FIELDS.has(field));
  assert.deepEqual(
    unexpectedFields,
    [],
    `App replay display-state callback may only compare replay display fields: ${fieldTokens.join(', ')}`,
  );
}

function assertReplayCueOverlaySceneSeparation(): void {
  for (const relativePath of REPLAY_CUE_OVERLAY_SCENE_FILES) {
    assertNoLiveControlTokens(readRepoFile(relativePath), relativePath);
  }
}

function hasAllowedBoundaryCopy(text: string): boolean {
  return ALLOWED_NEGATIVE_OR_BOUNDARY_COPY.test(text);
}

function findVisibleClaimViolations(): VisibleClaimViolation[] {
  const violations: VisibleClaimViolation[] = [];

  for (const relativePath of VISIBLE_COPY_SCAN_FILES) {
    const lines = readRepoFile(relativePath).split(/\r?\n/);
    for (const [lineIndex, line] of lines.entries()) {
      const context = line;

      for (const rule of VISIBLE_CLAIM_RULES) {
        if (
          rule.patterns.some(pattern => pattern.test(context))
          && !hasAllowedBoundaryCopy(context)
        ) {
          violations.push({
            path: relativePath,
            lineNumber: lineIndex + 1,
            ruleName: rule.name,
            text: line.trim(),
          });
        }
      }
    }
  }

  return violations;
}

function assertVisibleClaimBoundary(): void {
  const violations = findVisibleClaimViolations();
  assert.deepEqual(
    violations,
    [],
    [
      'Forbidden positive visible claim(s) found:',
      ...violations.map(violation => (
        `${violation.path}:${violation.lineNumber}: ${violation.ruleName}: ${violation.text}`
      )),
    ].join('\n'),
  );
}

function assertControlPlaneDocBoundary(): void {
  const docSource = readRepoFile(CONTROL_PLANE_DOC_PATH);
  const normalizedDocSource = docSource.replace(/\s+/g, ' ');
  assertContains(
    docSource,
    'validate:modqn:phase7k-r1-control-plane-hardening',
    'Phase 7K control-plane doc validation direction',
  );
  assertContains(
    docSource,
    'static control-plane hardening',
    'Phase 7K-R1 doc boundary wording',
  );
  assertContains(
    docSource,
    'not runtime implementation',
    'Phase 7K-R1 doc boundary wording',
  );
  assertContains(
    normalizedDocSource,
    'source-channel live remains deferred / not adopted',
    'Phase 7K-R1 source-channel non-adoption boundary',
  );
  assertContains(
    docSource,
    '`19` and `37` remain sensitivity/demo only',
    'Phase 7K-R1 19/37 sensitivity boundary',
  );
}

assertPlaybackShellControlPath();
assertAppReplayDisplayCallback();
assertReplayCueOverlaySceneSeparation();
assertVisibleClaimBoundary();
assertControlPlaneDocBoundary();

console.log('MODQN Phase 7K-R1 control-plane hardening validation passed.');
