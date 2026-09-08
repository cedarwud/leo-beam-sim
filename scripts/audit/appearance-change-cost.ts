/**
 * Measures THE acceptance criterion for the rendering-convergence work:
 *
 *   "改一件渲染決策要動幾個檔案" — to change ONE rendering decision, how many
 *   files must the owner open?
 *
 * Not lines of code. Not module count. Those metrics are cheap and always say
 * yes (see docs/sdd/NEXT-SESSION-RENDERING-CONVERGENCE.md, "上一個 session 的教訓" #1).
 * This one gets worse when logic is scattered and better only when a decision
 * genuinely acquires a single owner.
 *
 * ## What counts as a site
 *
 * For a decision D with authority symbols A, a SITE is any location under src/
 * that DEFINES, CALLS, or REFERENCES a member of A — or writes one of D's
 * marker string literals. The reasoning: to change D you must at minimum read
 * every such location, because each call site may pass a different fallback,
 * wrap the result in a different modifier, or branch around it. That is exactly
 * the failure the owner reports ("改了三個地方還是壞").
 *
 * The headline number is DISTINCT NON-TEST FILES. Test files are counted
 * separately: they are real edit cost but they are the good kind — a test that
 * must change is a decision that was actually pinned.
 *
 * ## Why AST and not grep
 *
 * `count-source-pins.ts` documents three ways regex misread this codebase.
 * Two more apply here: a symbol appearing inside an import clause is not a
 * decision site (grep counts it), and a same-named local shadow is not the
 * authority (grep counts it too). Import specifiers and shadowed declarations
 * are excluded below.
 *
 * ## The failure this script refuses to have
 *
 * The documented worst measurement bug in this repo is "a query that quietly
 * returns the empty set, and the empty set is then read as a fact"
 * (NEXT-SESSION-RENDERING-CONVERGENCE.md, 教訓 #5). So: any authority symbol
 * that resolves to ZERO sites is reported as UNRESOLVED and forces a non-zero
 * exit. A probe that finds nothing is a broken probe until proven otherwise,
 * never evidence that the decision is already converged.
 *
 * Usage:
 *   node --import tsx/esm scripts/audit/appearance-change-cost.ts
 *   node --import tsx/esm scripts/audit/appearance-change-cost.ts --json > baseline.json
 *   node --import tsx/esm scripts/audit/appearance-change-cost.ts --compare baseline.json
 *   node --import tsx/esm scripts/audit/appearance-change-cost.ts --decision intra-handover-shade
 */
import ts from 'typescript';
import * as fs from 'node:fs';
import * as path from 'node:path';

export type ProbeKind = 'symbol' | 'strlit';

export interface Probe {
  readonly kind: ProbeKind;
  /** Exported/declared identifier name, or the exact string-literal value. */
  readonly name: string;
  /** Why this symbol is an authority for the decision. Documentation, not logic. */
  readonly because: string;
}

export interface Decision {
  readonly id: string;
  /** The owner's own words — the prompt they would type. */
  readonly prompt: string;
  readonly probes: readonly Probe[];
}

/**
 * The decision manifest.
 *
 * Each entry is a change the owner has actually asked for, or an obvious
 * neighbour of one. The probes are the symbols that stand between the prompt
 * and the pixels. Adding a decision is cheap; the manifest is the spec of what
 * "one prompt, one change" has to mean.
 */
export const DECISIONS: readonly Decision[] = [
  {
    id: 'intra-handover-shade',
    prompt: '把 intra 換手時 source/target 的顏色變化改成別的',
    probes: [
      { kind: 'symbol', name: 'emphasizeIntraHandoverColor', because: 'the source-darken / target-lighten modifier itself' },
    ],
  },
  {
    id: 'source-vs-target-role',
    prompt: '改「哪一支錐體算 handover source、哪一支算 target」的判定',
    probes: [
      { kind: 'strlit', name: 'handoverSource', because: 'role literal that selects the source treatment' },
      { kind: 'strlit', name: 'handoverTarget', because: 'role literal that selects the target treatment' },
      { kind: 'strlit', name: '-trig-to', because: 'renderKey suffix used as a stand-in for the target role' },
      { kind: 'strlit', name: '-from', because: 'renderKey suffix used as a stand-in for the source role' },
    ],
  },
  {
    id: 'satellite-identity-hue',
    prompt: '換掉衛星身分色的調色盤 / hue family',
    probes: [
      { kind: 'symbol', name: 'SERVING_IDENTITY_PALETTE', because: 'the 16-slot hue table' },
      { kind: 'symbol', name: 'servingIdentityPaletteIndex', because: 'satId -> slot' },
      { kind: 'symbol', name: 'servingIdentityPaletteColorAt', because: 'slot -> hex' },
      { kind: 'symbol', name: 'colorForServingSatellite', because: 'per-satellite identity colour' },
      { kind: 'symbol', name: 'homepageSatelliteBaseColor', because: 'the homepage projection of the same identity' },
      { kind: 'symbol', name: 'homepageSatellitePaletteIndex', because: 'the second, independent slot allocator' },
    ],
  },
  {
    id: 'beam-shade-ladder',
    prompt: '改同一顆衛星裡不同 beam 的深淺階梯',
    probes: [
      { kind: 'symbol', name: 'SERVING_IDENTITY_BEAM_LIGHTNESS_LEVELS', because: 'the shade ladder defining lightness steps across beams' },
      { kind: 'symbol', name: 'SERVING_IDENTITY_BLUE_BEAM_LIGHTNESS_LEVELS', because: 'the blue/violet variant lightness ladder' },
    ],
  },
  {
    id: 'beam-shade-mapping',
    prompt: '改 beam id 怎麼對應到深淺階',
    probes: [
      { kind: 'symbol', name: 'colorForServingBeam', because: '(satId, beamId) -> shade; maps a beam to a lightness rung' },
      { kind: 'symbol', name: 'homepageSatelliteColorForBeam', because: 'the homepage shade projection mapping beam index to a lightness rung' },
    ],
  },
  {
    id: 'final-beam-colour-authority',
    prompt: '改一支波束最終顏色是誰說了算',
    probes: [
      { kind: 'symbol', name: 'resolveSceneAcceptedBeamColor', because: 'the MainScene branch between homepage and accepted snapshot' },
      { kind: 'symbol', name: 'resolveAcceptedBeamIdentityColor', because: 'accepted-snapshot lookup' },
      { kind: 'symbol', name: 'resolveBaseIdentityColor', because: 'the single precedence ladder that owns the deterministic rung (and all others) after resolveServingIdentityColor was retired' },
      { kind: 'symbol', name: 'HANDOVER_VISUAL_IDENTITY_NEUTRAL_FALLBACK_COLOR', because: 'the last-resort literal' },
    ],
  },
  {
    id: 'handover-cone-opacity',
    prompt: '改換手錐體的透明度包絡',
    probes: [
      // Renamed when the constants moved beside the handover colour table; the
      // old `MULTI_CANDIDATE_TRANSITION_*` shim in `beamConeIdentityColors.ts`
      // was deleted once its last consumer moved. Following a symbol that
      // genuinely moved is not re-pinning — the DECISION is unchanged, and the
      // tool flagged the stale probe rather than silently scoring zero.
      { kind: 'symbol', name: 'HANDOVER_TRANSITION_SOURCE_OPACITY_FACTOR', because: 'source-side alpha factor' },
      { kind: 'symbol', name: 'HANDOVER_TRANSITION_TARGET_OPACITY_FACTOR', because: 'target-side alpha factor' },
      // The pre-rename names are kept so a baseline captured before the move
      // still resolves and stays comparable. Exactly one pair resolves in any
      // given tree; see the partial-resolution rule below for why that is fine.
      { kind: 'symbol', name: 'MULTI_CANDIDATE_TRANSITION_SOURCE_OPACITY_FACTOR', because: 'source-side alpha factor (pre-rename)' },
      { kind: 'symbol', name: 'MULTI_CANDIDATE_TRANSITION_TARGET_OPACITY_FACTOR', because: 'target-side alpha factor (pre-rename)' },
      { kind: 'symbol', name: 'triggeredIntraPeakOpacity', because: 'the settled-phase peak' },
    ],
  },
  {
    id: 'beam-visibility',
    prompt: '改哪些波束/錐體要顯示在畫面上（波束可見性判定）',
    probes: [
      { kind: 'symbol', name: 'resolveHomepageBeamVisibility', because: 'the allow-list resolver determining which (satellite, cell, beam) tuples are permitted to draw cones' },
      { kind: 'symbol', name: 'filterHomepageBeamItems', because: 'the filter predicate that drops non-story beam items before geometry generation' },
      { kind: 'symbol', name: 'filterHomepageBeamItemsBySatellite', because: 'local import alias of filterHomepageBeamItems at call sites in MainScene and servingConeItems' },
      { kind: 'symbol', name: 'resolveHomepageSceneBeamVisibility', because: 'the scene-level adapter mapping handover events and hero records into visibility inputs' },
      { kind: 'symbol', name: 'restrictHomepageBeamItems', because: 'scene callback gating and filtering candidate/fan/non-serving cone items' },
      { kind: 'symbol', name: 'showNonServingCones', because: 'display spec toggle controlling whether secondary non-serving cones are rendered' },
    ],
  },
  {
    id: 'cone-geometry',
    prompt: '改波束錐體的寬度、長度與底面橢圓/地面投影幾何',
    probes: [
      { kind: 'symbol', name: 'resolveServingConeGeometry', because: 'primary serving cone geometry resolver assembling drawable beam items' },
      { kind: 'symbol', name: 'buildObliqueBeamConePositions', because: 'generates 3D vertex positions for the oblique cone mesh from apex to base ellipse' },
      { kind: 'symbol', name: 'computeSinrLiveBeamFootprintEllipse', because: 'computes the ground intersection ellipse long/short axes and tilt' },
      { kind: 'symbol', name: 'resolveBeamBaseCenter', because: 'places the cone base center at ground coordinates' },
      { kind: 'symbol', name: 'coneWidthScale', because: 'display spec width multiplier scaling rendered base radius' },
      { kind: 'symbol', name: 'MULTI_CANDIDATE_BEAM_WIDTH_MULTIPLIER', because: 'multi-candidate scene display policy multiplier on cone width scale' },
      { kind: 'symbol', name: 'SINR_LIVE_FOOTPRINT_RING_Y_LIFT', because: 'ground elevation lift constant preventing terrain z-fighting' },
    ],
  },
  {
    id: 'handover-timing-envelope',
    prompt: '改換手動畫/提示的持續時間、各階段長度與淡出衰減（timing/envelope）',
    probes: [
      { kind: 'symbol', name: 'HANDOVER_CONE_PHASE_END', because: 'phase boundary fractions (serving/measuring/holding/releasing) governing handover duration' },
      { kind: 'symbol', name: 'INTER_HANDOVER_CINEMA_PHASE_END', because: 'phase boundary fractions for inter-satellite cinema handover presentation' },
      { kind: 'symbol', name: 'resolveHandoverConeEnvelope', because: 'computes smoothstep opacity envelopes for from/to cones across handover progress' },
      { kind: 'symbol', name: 'resolveHandoverPresentationPhase', because: 'maps normalized progress to the active handover presentation phase' },
      { kind: 'symbol', name: 'sinrLiveHandoverPulseOpacity', because: 'decay curve calculating pulse cone opacity over its retention window' },
      { kind: 'symbol', name: 'SINR_LIVE_TRIGGERED_INTRA_SUSTAIN_MS', because: 'wall-clock duration of the triggered intra-handover display flash' },
      { kind: 'symbol', name: 'HOMEPAGE_INTRA_HANDOVER_DISPLAY_MS', because: 'homepage intra-handover presentation window duration constant' },
      { kind: 'symbol', name: 'MANUAL_HANDOVER_DISPLAY_MS', because: 'manual demo handover presentation window duration constant' },
    ],
  },
  {
    id: 'satellite-markers-and-ground-effects',
    prompt: '改衛星標記尺寸/標籤與地面波紋/衝擊波效果（markers & ground effects）',
    probes: [
      { kind: 'symbol', name: 'resolveRenderedLiveSatelliteMarkers', because: 'selects and positions visible satellite markers in the scene' },
      { kind: 'symbol', name: 'SatelliteMarker', because: 'renders 3D satellite model, label, scale, and halo' },
      { kind: 'symbol', name: 'resolveSatelliteTintedColor', because: 'satellite model body tint blend calculation' },
      { kind: 'symbol', name: 'ServingGroundRipple', because: 'renders expanding ground ripple ring effects around active beam footprints' },
      { kind: 'symbol', name: 'groundRippleSpec', because: 'configuration specification (cycles, radii, opacity) for serving/pending ripples' },
      { kind: 'symbol', name: 'resolveGroundRippleEnvelope', because: 'expansion and opacity decay envelope for ground ripples' },
      { kind: 'symbol', name: 'IntraGroundShockwave', because: 'renders shockwave ring animations for intra-handover events' },
      { kind: 'symbol', name: 'targetOpacityFor', because: 'bell-curve opacity envelope generator for intra-handover ground shockwave' },
      { kind: 'symbol', name: 'sourceScaleFor', because: 'contraction scale resolver for intra-handover ground shockwave source ring' },
      { kind: 'symbol', name: 'targetScaleFor', because: 'expansion scale resolver for intra-handover ground shockwave target ring' },
    ],
  },
  {
    id: 'candidate-rail-presentation',
    prompt: '改右側候選軌（candidate rail）的波束列表與候選卡片呈現',
    probes: [
      { kind: 'symbol', name: 'projectHomepageRail', because: 'assembles the rail projection data model from the accepted snapshot' },
      { kind: 'symbol', name: 'projectHomepageHandoverStory', because: 'projects the handover story narrative, winner criteria, and candidate counts for the rail' },
      { kind: 'symbol', name: 'HomepageBeamRail', because: 'the root UI container rendering the right rail cards, metrics, and candidate list' },
      { kind: 'symbol', name: 'formatHomepageBeamCellLabel', because: 'formats public B1..Bn beam identity labels rendered on the candidate rail cards' },
    ],
  },
];

interface Site {
  readonly file: string;
  readonly line: number;
  readonly probe: string;
  readonly role: 'declaration' | 'call' | 'reference' | 'string';
  /**
   * Whether this site DECIDES the outcome or merely DELEGATES to whoever does.
   *
   * The first version of this tool counted every mention, and that made the
   * convergence look like a regression: moving a decision into one owning module
   * ADDS files that mention the symbol (the owner and its tests) while removing
   * only the scattered branches. The count went up while the thing the owner
   * cares about got better, which means the metric was measuring the wrong noun.
   *
   * The owner's question is "how many files must I EDIT to change this". A file
   * that calls an authority and hands the answer straight on is not one of them —
   * changing the decision does not require touching it. A file that DECLARES the
   * authority, or that wraps the call in a `?:` / `??` / `||` and thereby picks
   * between outcomes itself, is.
   */
  readonly kind: 'decision' | 'delegation';
  readonly text: string;
}

const REPO_ROOT = process.cwd();
const SRC_ROOT = path.join(REPO_ROOT, 'src');

const isTestFile = (file: string): boolean => /\.test\.tsx?$/.test(file);

function collectSourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules') continue;
      collectSourceFiles(full, out);
    } else if (/\.tsx?$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

/**
 * An identifier inside an `import { x } from '...'` clause is plumbing, not a
 * decision: deleting the import is forced by the real site elsewhere in the
 * file, never a change in its own right. Same for the `export { x }` re-export.
 */
function isImportOrExportSpecifier(node: ts.Node): boolean {
  const parent = node.parent;
  if (parent === undefined) return false;
  return ts.isImportSpecifier(parent)
    || ts.isExportSpecifier(parent)
    || ts.isImportClause(parent)
    || ts.isNamespaceImport(parent);
}

/**
 * A site DECIDES if it defines the authority, or if it sits inside an
 * expression that chooses between alternatives — a ternary, a `??` chain, a
 * `||` chain. Those are precisely the shapes that let a call site substitute
 * its own answer, which is the defect this whole convergence removes.
 *
 * Everything else is DELEGATION: the file asks the authority and passes the
 * answer on. Changing the decision does not require opening it.
 */
function kindOf(node: ts.Node, role: Site['role']): Site['kind'] {
  if (role === 'declaration') return 'decision';
  let current: ts.Node | undefined = node;
  // Walk out of the call/argument wrappers to find the governing expression.
  for (let depth = 0; depth < 6 && current !== undefined; depth += 1) {
    const parent: ts.Node | undefined = current.parent;
    if (parent === undefined) break;
    if (ts.isConditionalExpression(parent)) return 'decision';
    if (ts.isBinaryExpression(parent)) {
      const op = parent.operatorToken.kind;
      if (op === ts.SyntaxKind.QuestionQuestionToken
          || op === ts.SyntaxKind.BarBarToken) {
        return 'decision';
      }
    }
    current = parent;
  }
  return 'delegation';
}

function roleOf(node: ts.Identifier): Site['role'] {
  const parent = node.parent;
  if (parent !== undefined) {
    if ((ts.isFunctionDeclaration(parent) || ts.isVariableDeclaration(parent)) && parent.name === node) {
      return 'declaration';
    }
    if (ts.isCallExpression(parent) && parent.expression === node) return 'call';
    if (ts.isPropertyAccessExpression(parent) && ts.isCallExpression(parent.parent)
        && parent.parent.expression === parent && parent.name === node) {
      return 'call';
    }
  }
  return 'reference';
}

export function scan(decisions: readonly Decision[]): Map<string, Site[]> {
  const symbolProbes = new Map<string, string[]>();
  const stringProbes = new Map<string, string[]>();
  for (const decision of decisions) {
    for (const probe of decision.probes) {
      const table = probe.kind === 'symbol' ? symbolProbes : stringProbes;
      const existing = table.get(probe.name);
      if (existing === undefined) table.set(probe.name, [decision.id]);
      else existing.push(decision.id);
    }
  }

  const sitesByDecision = new Map<string, Site[]>();
  for (const decision of decisions) sitesByDecision.set(decision.id, []);

  for (const file of collectSourceFiles(SRC_ROOT)) {
    const text = fs.readFileSync(file, 'utf8');
    // Cheap pre-filter: a file that contains none of the probe names verbatim
    // cannot contain a site. This is an optimisation only — every surviving
    // file is still parsed and matched on the AST, never on the raw text.
    const relevant = [...symbolProbes.keys(), ...stringProbes.keys()].some(name => text.includes(name));
    if (!relevant) continue;

    const sourceFile = ts.createSourceFile(
      file,
      text,
      ts.ScriptTarget.Latest,
      true,
      file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
    );
    const relative = path.relative(REPO_ROOT, file);
    const lineOf = (node: ts.Node): number =>
      sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;

    const visit = (node: ts.Node): void => {
      if (ts.isIdentifier(node)) {
        const owners = symbolProbes.get(node.text);
        if (owners !== undefined && !isImportOrExportSpecifier(node)) {
          const role = roleOf(node);
          for (const decisionId of owners) {
            sitesByDecision.get(decisionId)!.push({
              file: relative,
              line: lineOf(node),
              probe: node.text,
              role,
              kind: kindOf(node, role),
              text: node.parent?.getText(sourceFile).split('\n')[0]?.trim().slice(0, 110) ?? node.text,
            });
          }
        }
      }
      // A render key is usually built as `${eventKey}-trig-to`, so the literal
      // lives in a TemplateSpan's trailing text, not in a StringLiteral. Missing
      // that made the `-trig-to` probe report UNRESOLVED while the string was
      // plainly in the source — a query quietly matching nothing and being read
      // as "the thing is gone", which is the exact measurement failure this
      // repo keeps repeating.
      if (ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node)) {
        for (const [probeText, owners] of stringProbes) {
          if (!node.text.includes(probeText)) continue;
          for (const decisionId of owners) {
            sitesByDecision.get(decisionId)!.push({
              file: relative,
              line: lineOf(node),
              probe: probeText,
              role: 'string',
              kind: kindOf(node, 'string'),
              text: node.parent?.getText(sourceFile).split('\n')[0]?.trim().slice(0, 110) ?? probeText,
            });
          }
        }
      }
      if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
        const owners = stringProbes.get(node.text);
        if (owners !== undefined) {
          for (const decisionId of owners) {
            sitesByDecision.get(decisionId)!.push({
              file: relative,
              line: lineOf(node),
              probe: node.text,
              role: 'string',
              kind: kindOf(node, 'string'),
              text: node.parent?.getText(sourceFile).split('\n')[0]?.trim().slice(0, 110) ?? node.text,
            });
          }
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(sourceFile);
  }

  return sitesByDecision;
}

export interface DecisionScore {
  readonly id: string;
  readonly prompt: string;
  /**
   * THE metric: distinct non-test files containing a DECISION site — the files
   * you must actually open and edit to change this rendering decision.
   */
  readonly editFiles: number;
  /** Files that only consume the decision. Blast radius to re-verify, not to edit. */
  readonly consumerFiles: number;
  /** Kept for comparability with baselines taken before the split existed. */
  readonly sourceFiles: number;
  readonly testFiles: number;
  readonly sites: number;
  readonly sourceFileList: readonly string[];
  readonly decisionFileList: readonly string[];
  /** Probes that matched nothing — a broken probe, never a converged decision. */
  readonly unresolvedProbes: readonly string[];
}

export function score(decisions: readonly Decision[]): DecisionScore[] {
  const sitesByDecision = scan(decisions);
  return decisions.map(decision => {
    const sites = sitesByDecision.get(decision.id) ?? [];
    const matched = new Set(sites.map(site => site.probe));
    const nonTest = sites.filter(site => !isTestFile(site.file));
    const sourceFileList = [...new Set(nonTest.map(site => site.file))].sort();
    const decisionFiles = new Set(
      nonTest.filter(site => site.kind === 'decision').map(site => site.file),
    );
    const consumerOnly = new Set(
      [...new Set(nonTest.map(site => site.file))].filter(file => !decisionFiles.has(file)),
    );
    const testFileList = new Set(sites.filter(site => isTestFile(site.file)).map(site => site.file));
    return {
      id: decision.id,
      prompt: decision.prompt,
      editFiles: decisionFiles.size,
      consumerFiles: consumerOnly.size,
      sourceFiles: sourceFileList.length,
      testFiles: testFileList.size,
      sites: sites.length,
      sourceFileList,
      decisionFileList: [...decisionFiles].sort(),
      unresolvedProbes: decision.probes.map(probe => probe.name).filter(name => !matched.has(name)),
    };
  });
}

function main(): void {
  const args = process.argv.slice(2);
  const wantJson = args.includes('--json');
  const compareIndex = args.indexOf('--compare');
  const decisionIndex = args.indexOf('--decision');
  const only = decisionIndex >= 0 ? args[decisionIndex + 1] : undefined;

  const selected = only === undefined
    ? DECISIONS
    : DECISIONS.filter(decision => decision.id === only);
  if (selected.length === 0) {
    console.error(`no decision named ${only}; known: ${DECISIONS.map(d => d.id).join(', ')}`);
    process.exit(2);
  }

  const scores = score(selected);
  const sitesByDecision = scan(selected);

  if (wantJson) {
    console.log(JSON.stringify({ generatedFrom: 'appearance-change-cost.ts', scores }, null, 2));
    return;
  }

  // A probe matching nothing is a broken probe — but only when it is the ONLY
  // way that decision is being observed. A deliberately renamed symbol leaves
  // its old name unresolved while the new one resolves, and failing on that
  // would punish the rename rather than catch a blind spot. So: unresolved
  // probes are reported for every decision, and only a decision with NOTHING
  // resolved is treated as an actual broken measurement.
  const fullyUnobserved = scores.filter(s => s.sites === 0).map(s => s.id);
  const unresolved = scores.flatMap(s => s.unresolvedProbes.map(p => `${s.id}: ${p}`));

  console.log('APPEARANCE CHANGE COST — distinct files to open per rendering decision\n');
  for (const s of scores) {
    console.log(`${s.id}`);
    console.log(`  prompt: ${s.prompt}`);
    console.log(`  FILES TO EDIT: ${s.editFiles}   (consumers that need no edit: ${s.consumerFiles}, tests: ${s.testFiles}, total sites: ${s.sites})`);
    for (const file of s.decisionFileList) console.log(`    EDIT     ${file}`);
    for (const file of s.sourceFileList) {
      if (s.decisionFileList.includes(file)) continue;
      const lines = (sitesByDecision.get(s.id) ?? [])
        .filter(site => site.file === file)
        .map(site => site.line);
      console.log(`    consumes ${file}:${lines.join(',')}`);
    }
    if (s.unresolvedProbes.length > 0) {
      console.log(`  !! UNRESOLVED PROBES: ${s.unresolvedProbes.join(', ')}`);
    }
    console.log('');
  }

  const total = scores.reduce((sum, s) => sum + s.editFiles, 0);
  console.log(`TOTAL FILES TO EDIT across ${scores.length} decisions: ${total}`);
  console.log(`WORST decision: ${[...scores].sort((a, b) => b.editFiles - a.editFiles)[0]?.id}`);

  if (compareIndex >= 0) {
    const baselinePath = args[compareIndex + 1]!;
    const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8')) as { scores: DecisionScore[] };
    console.log('\nCOMPARED TO BASELINE');
    let regressed = false;
    for (const s of scores) {
      const before = baseline.scores.find(b => b.id === s.id);
      if (before === undefined) { console.log(`  ${s.id}: NEW`); continue; }
      const beforeCount = before.editFiles ?? before.sourceFiles;
      const delta = s.editFiles - beforeCount;
      const arrow = delta === 0 ? '=' : delta < 0 ? '↓' : '↑ REGRESSED';
      console.log(`  ${s.id}: ${beforeCount} -> ${s.editFiles}  ${arrow}`);
      if (delta > 0) regressed = true;
    }
    if (regressed) process.exitCode = 1;
  }

  if (unresolved.length > 0) {
    console.error(`\nunresolved probes (informational — a renamed symbol leaves its old name unresolved):`);
    for (const item of unresolved) console.error(`  ${item}`);
  }
  if (fullyUnobserved.length > 0) {
    console.error(`\nBROKEN MEASUREMENT — these decisions matched NOTHING at all, so their score is not evidence:`);
    for (const id of fullyUnobserved) console.error(`  ${id}`);
    process.exitCode = 1;
  }
}

if (process.argv[1] !== undefined && import.meta.url.endsWith(path.basename(process.argv[1]))) {
  main();
}
