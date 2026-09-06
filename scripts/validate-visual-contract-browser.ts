import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { once } from 'node:events';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { spawn, type ChildProcess } from 'node:child_process';
import { createServer } from 'node:net';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { chromium, type Browser, type Page } from '@playwright/test';

import {
  clipRect,
  measureVisualContractGeometry,
  rectArea,
  rectangleUnionArea,
  type AxisAlignedRect,
} from '../src/visualAcceptance/rectangleUnion';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUTPUT_ROOT = join(REPO_ROOT, 'output/playwright/visual-contract');
const VALID_SCREENSHOT = join(OUTPUT_ROOT, 'valid.png');
const BAD_SCREENSHOT = join(OUTPUT_ROOT, 'bad-overlap.png');
const BAD_UNMARKED_SCREENSHOT = join(OUTPUT_ROOT, 'bad-unmarked.png');
const BAD_ANCESTOR_HIDDEN_SCREENSHOT = join(OUTPUT_ROOT, 'bad-ancestor-hidden.png');
const BAD_ALLOWED_DECORATION_OVERSIZE_SCREENSHOT = join(OUTPUT_ROOT, 'bad-allowed-decoration-oversize.png');
const BAD_ALLOWED_DECORATION_SHADOW_SCREENSHOT = join(OUTPUT_ROOT, 'bad-allowed-decoration-shadow.png');
const CONTACT_SHEET = join(OUTPUT_ROOT, 'contact-sheet.png');
const ROUTE_SMOKE_SCREENSHOT = join(OUTPUT_ROOT, 'current-simulator-quarantine.png');
const MACHINE_REPORT = join(OUTPUT_ROOT, 'machine-report.json');
const VIEWPORT = { width: 1920, height: 1080 } as const;
const RESPONSIVE_VIEWPORT = { width: 320, height: 720 } as const;

const THRESHOLDS = Object.freeze({
  stageCoverage: 0.85,
  unoccludedStage: 0.70,
  subjectSafeLeft: 0.16,
  subjectSafeRight: 0.84,
  subjectSafeTop: 0.14,
  subjectSafeBottom: 0.78,
  subjectOverlayIntersection: 0.05,
  subtitleLineBoxesMax: 2,
  readableFontPx: 16,
  contrastRatio: 4.5,
});

type RectPayload = AxisAlignedRect & { readonly width: number; readonly height: number };
type CensusSurface = {
  readonly tagName: string;
  readonly rect: RectPayload;
  readonly reason: 'large-positioned-surface' | 'painted-surface';
};
type DecorationGeometryIssue = {
  readonly tagName: string;
  readonly decoration: string;
  readonly owner: string | null;
  readonly rect: RectPayload;
  readonly ratios: { readonly width: number; readonly height: number; readonly area: number; readonly left: number; readonly top: number; readonly right: number; readonly bottom: number };
  readonly violations: readonly string[];
};
type DecorationPaintExtentIssue = {
  readonly tagName: string;
  readonly decoration: string;
  readonly owner: string | null;
  readonly effects: readonly string[];
};
type Finding = {
  readonly id: string;
  readonly passed: boolean;
  readonly details: Record<string, unknown>;
};
type BrowserSnapshot = {
  readonly viewport: RectPayload;
  readonly stage: RectPayload | null;
  readonly subjects: readonly RectPayload[];
  readonly opaqueSurfaces: readonly RectPayload[];
  readonly primary: { readonly mounted: number; readonly visible: number };
  readonly subtitle: {
    readonly mounted: number;
    readonly visible: boolean;
    readonly lineBoxes: readonly RectPayload[];
    readonly fontSize: number;
    readonly color: string;
    readonly backgroundColor: string;
  };
  readonly inactiveCues: readonly string[];
  readonly forbiddenChrome: readonly string[];
  readonly telemetry: Record<string, string | null> | null;
  readonly overflow: { readonly horizontal: boolean; readonly vertical: boolean; readonly scrollWidth: number; readonly scrollHeight: number };
  readonly nonColorEncoding: readonly string[];
  readonly accessibility: { readonly subjectLabels: number; readonly cueLabels: number; readonly beatControl: boolean };
  readonly responsiveTargets: readonly RectPayload[];
  readonly visibility: {
    readonly stage: boolean;
    readonly subjects: readonly boolean[];
    readonly primary: boolean;
    readonly subtitle: boolean;
  };
  readonly contractCensus: {
    readonly expectedRoles: readonly string[];
    readonly roleCounts: Readonly<Record<string, number>>;
    readonly missingRoles: readonly string[];
    readonly duplicateRoles: readonly string[];
    readonly invalidSurfaceRegistrations: readonly string[];
    readonly invalidDecorativeRegistrations: readonly string[];
    readonly invalidDecorationGeometry: readonly DecorationGeometryIssue[];
    readonly invalidDecorationPaintExtents: readonly DecorationPaintExtentIssue[];
    readonly unregisteredPaintedSurfaces: readonly CensusSurface[];
    readonly hiddenMountedNodes: readonly string[];
  };
};

type RouteSmokeEvidence = {
  readonly url: string;
  readonly canvasCount: number;
  readonly consoleErrors: readonly string[];
  readonly pageErrors: readonly string[];
  readonly scenePlanAvailability: string | null;
  readonly scenePlanReason: string | null;
  readonly globalFrameId: string | null;
  readonly localFrameId: string | null;
  readonly legacyCompositor: {
    readonly oldThreeColumnEvidence: boolean;
    readonly selectors: Readonly<Record<string, number>>;
    readonly rects: Readonly<Record<string, RectPayload | null>>;
  };
  readonly productDisposition: 'PRODUCT_REJECTED_QUARANTINED';
};

const SNAPSHOT_EXPRESSION = String.raw`(() => {
  const rectOf = (element) => {
    if (element === null) return null;
    const value = element.getBoundingClientRect();
    return { left: value.left, top: value.top, right: value.right, bottom: value.bottom, width: value.width, height: value.height };
  };
  const visibilityMethod = (element) => {
    if (typeof element?.checkVisibility !== 'function') return true;
    try {
      return element.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true });
    } catch (_error) {
      return element.checkVisibility();
    }
  };
  const visible = (element) => {
    if (element === null || !visibilityMethod(element)) return false;
    let current = element;
    while (current !== null) {
      const style = getComputedStyle(current);
      if (style.display === 'none' || style.visibility === 'hidden' || Number.parseFloat(style.opacity) <= 0) return false;
      current = current.parentElement;
    }
    const value = rectOf(element);
    return value !== null && value.width > 0 && value.height > 0;
  };
  const lineBoxes = (element) => {
    if (element === null || !visible(element)) return [];
    return [...element.querySelectorAll('[data-subtitle-line]')].flatMap(line => {
      const range = document.createRange();
      range.selectNodeContents(line);
      return [...range.getClientRects()].map(value => ({ left: value.left, top: value.top, right: value.right, bottom: value.bottom, width: value.width, height: value.height })).filter(value => value.width > 0 && value.height > 0);
    });
  };
  const alpha = (value) => {
    if (value === 'transparent') return 0;
    const match = value.match(/rgba?\(([^)]+)\)/);
    if (match === null) return value === 'none' ? 0 : 1;
    const parts = match[1].split(',').map(item => Number.parseFloat(item.trim()));
    return parts.length >= 4 && Number.isFinite(parts[3]) ? parts[3] : 1;
  };
  const hasPaint = (style) => {
    const borderWidth = ['borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth']
      .map(key => Number.parseFloat(style[key]) || 0)
      .some(value => value > 0);
    return alpha(style.backgroundColor) > .02 || borderWidth || style.boxShadow !== 'none' || style.backgroundImage !== 'none';
  };
  const stylePaintEffects = (style, prefix) => {
    const effects = [];
    if (style.boxShadow !== 'none') effects.push(prefix + ':box-shadow');
    if (style.textShadow !== 'none') effects.push(prefix + ':text-shadow');
    if (style.filter !== 'none') effects.push(prefix + ':filter');
    if (typeof style.backdropFilter === 'string' && style.backdropFilter !== 'none' && style.backdropFilter !== '') effects.push(prefix + ':backdrop-filter');
    if (typeof style.webkitBackdropFilter === 'string' && style.webkitBackdropFilter !== 'none' && style.webkitBackdropFilter !== '') effects.push(prefix + ':backdrop-filter');
    const outlineWidth = Number.parseFloat(style.outlineWidth) || 0;
    const outlineOffset = Number.parseFloat(style.outlineOffset) || 0;
    if (style.outlineStyle !== 'none' && outlineWidth > 0) effects.push(prefix + ':outline');
    if (outlineOffset !== 0) effects.push(prefix + ':outline-offset');
    return effects;
  };
  const pseudoPaintEffects = (style, pseudo) => {
    const content = style.content;
    const generatedContent = content !== 'none' && content !== 'normal' && content !== '""' && content !== "''";
    const borderWidth = ['borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth']
      .map(key => Number.parseFloat(style[key]) || 0)
      .some(value => value > 0);
    const paintedContent = generatedContent
      || alpha(style.backgroundColor) > .02
      || borderWidth
      || style.backgroundImage !== 'none';
    const effects = stylePaintEffects(style, pseudo);
    if (paintedContent) effects.push(pseudo + ':painted-content');
    return effects;
  };
  const decorationPaintEffects = (element) => [
    ...stylePaintEffects(getComputedStyle(element), 'element'),
    ...pseudoPaintEffects(getComputedStyle(element, '::before'), '::before'),
    ...pseudoPaintEffects(getComputedStyle(element, '::after'), '::after'),
  ];
  const stage = rectOf(document.querySelector('[data-stage]'));
  const viewport = { left: 0, top: 0, right: innerWidth, bottom: innerHeight, width: innerWidth, height: innerHeight };
  const requiredRoles = ['scene-context', 'subject', 'primary-cue', 'beat-control', 'subtitle', 'telemetry'];
  const allowedDecorations = {
    'scene-context': ['scene-star', 'scene-orbit'],
    subject: ['subject-ring', 'subject-dot'],
    'primary-cue': ['primary-cue-line'],
    'beat-control': ['beat-control-button'],
    subtitle: ['subtitle-line'],
    telemetry: [],
  };
  const decorationEnvelopes = {
    'scene-star': { maxWidth: .12, maxHeight: .12, maxArea: .03, maxOpaqueArea: .03, maxRight: 1.02, maxBottom: 1.02 },
    'scene-orbit': { maxWidth: .96, maxHeight: .65, maxArea: .55, maxOpaqueArea: 0, maxRight: 1.02, maxBottom: 1.02 },
    'subject-ring': { maxWidth: .80, maxHeight: .25, maxArea: .20, maxOpaqueArea: 0, maxRight: 1.02, maxBottom: 1.02 },
    'subject-dot': { maxWidth: .20, maxHeight: .20, maxArea: .03, maxOpaqueArea: 0, maxRight: 1.02, maxBottom: 1.02 },
    'primary-cue-line': { maxWidth: .12, maxHeight: .08, maxArea: .02, maxOpaqueArea: .02, maxRight: 1.02, maxBottom: 1.02 },
    'beat-control-button': { maxWidth: .75, maxHeight: .20, maxArea: .18, maxOpaqueArea: .18, maxRight: 1.02, maxBottom: 1.02 },
    'subtitle-line': { maxWidth: .96, maxHeight: .20, maxArea: .20, maxOpaqueArea: 0, maxRight: 1.02, maxBottom: 1.02 },
  };
  const roleElements = [...document.querySelectorAll('[data-contract-role]')];
  const roleCounts = Object.fromEntries(requiredRoles.map(role => [role, roleElements.filter(element => element.getAttribute('data-contract-role') === role).length]));
  const missingRoles = requiredRoles.filter(role => roleCounts[role] === 0);
  const duplicateRoles = requiredRoles.filter(role => roleCounts[role] > 1);
  const stageElement = document.querySelector('[data-stage]');
  const stageArea = stage === null ? 0 : stage.width * stage.height;
  const roleOwner = (element) => {
    let current = element.parentElement;
    while (current !== null) {
      const role = current.getAttribute('data-contract-role');
      if (role !== null) return role;
      current = current.parentElement;
    }
    return null;
  };
  const surfaceRegistrations = [...document.querySelectorAll('[data-contract-surface]')];
  const invalidSurfaceRegistrations = surfaceRegistrations.flatMap(element => {
    const role = element.getAttribute('data-contract-role');
    const surface = element.getAttribute('data-contract-surface');
    return requiredRoles.includes(surface) && role === surface ? [] : [element.tagName.toLowerCase() + ':' + String(surface)];
  });
  const decorativeRegistrations = [...document.querySelectorAll('[data-contract-decorative]')];
  const invalidDecorativeRegistrations = decorativeRegistrations.flatMap(element => {
    const owner = roleOwner(element);
    const decoration = element.getAttribute('data-contract-decorative');
    return owner !== null && allowedDecorations[owner]?.includes(decoration) ? [] : [element.tagName.toLowerCase() + ':' + String(decoration)];
  });
  const invalidDecorationGeometry = decorativeRegistrations.flatMap(element => {
    const decoration = element.getAttribute('data-contract-decorative');
    const envelope = decoration === null ? null : decorationEnvelopes[decoration];
    const value = rectOf(element);
    if (envelope === null || envelope === undefined || value === null || stage === null || stage.width <= 0 || stage.height <= 0) return [];
    const ratios = {
      width: value.width / stage.width,
      height: value.height / stage.height,
      area: value.width * value.height / (stage.width * stage.height),
      left: (value.left - stage.left) / stage.width,
      top: (value.top - stage.top) / stage.height,
      right: (value.right - stage.left) / stage.width,
      bottom: (value.bottom - stage.top) / stage.height,
    };
    const style = getComputedStyle(element);
    const backgroundAlpha = alpha(style.backgroundColor);
    const opaqueArea = backgroundAlpha > .02 || style.backgroundImage !== 'none' ? ratios.area : 0;
    const violations = [];
    if (ratios.width > envelope.maxWidth) violations.push('width');
    if (ratios.height > envelope.maxHeight) violations.push('height');
    if (ratios.area > envelope.maxArea) violations.push('area');
    if (opaqueArea > envelope.maxOpaqueArea) violations.push('opaque-paint');
    if (style.position === 'fixed' || style.position === 'sticky') violations.push('fixed-or-sticky');
    if (ratios.left < -.02 || ratios.top < -.02 || ratios.right > envelope.maxRight || ratios.bottom > envelope.maxBottom) violations.push('position');
    return violations.length === 0 ? [] : [{
      tagName: element.tagName.toLowerCase(),
      decoration: String(decoration),
      owner: roleOwner(element),
      rect: value,
      ratios,
      violations,
    }];
  });
  const invalidDecorationPaintExtents = decorativeRegistrations.flatMap(element => {
    const effects = decorationPaintEffects(element);
    if (effects.length === 0) return [];
    return [{
      tagName: element.tagName.toLowerCase(),
      decoration: String(element.getAttribute('data-contract-decorative')),
      owner: roleOwner(element),
      effects,
    }];
  });
  const registeredForCensus = (element) => {
    const role = element.getAttribute('data-contract-role');
    const surface = element.getAttribute('data-contract-surface');
    if (role !== null) return requiredRoles.includes(role) && role === surface;
    const decoration = element.getAttribute('data-contract-decorative');
    const owner = roleOwner(element);
    return owner !== null && allowedDecorations[owner]?.includes(decoration) === true;
  };
  const unregisteredPaintedSurfaces = stageElement === null ? [] : [...stageElement.querySelectorAll('*')].flatMap(element => {
    const value = rectOf(element);
    if (value === null || value.width <= 0 || value.height <= 0 || !visible(element) || registeredForCensus(element)) return [];
    const style = getComputedStyle(element);
    const area = value.width * value.height;
    const positioned = ['absolute', 'fixed', 'sticky'].includes(style.position);
    const largePositioned = positioned && area >= Math.max(256, stageArea * .2);
    const painted = hasPaint(style);
    if (!largePositioned && !painted) return [];
    return [{ tagName: element.tagName.toLowerCase(), rect: value, reason: largePositioned ? 'large-positioned-surface' : 'painted-surface' }];
  });
  const hiddenMountedNodes = stageElement === null ? [] : [...stageElement.querySelectorAll('*')].flatMap(element => {
    return !visible(element)
      ? [element.tagName.toLowerCase() + (element.className ? '.' + String(element.className).split(/\s+/).join('.') : '')]
      : [];
  });
  const forbiddenSelectors = ['nav', 'aside', '[data-persistent-sidebar]', '[data-sidebar]', '[data-top-control-bar]', '[data-timeline]', '[data-course-outline]', '[data-engineering-rail]', '[data-rail]'];
  const forbiddenChrome = [...new Set(forbiddenSelectors.flatMap(selector => [...document.querySelectorAll(selector)].map(element => selector + ':' + element.tagName.toLowerCase())))];
  const telemetryElement = document.querySelector('[data-telemetry]');
  const telemetryKeys = ['data-camera-pose', 'data-camera-target', 'data-camera-focus', 'data-camera-speed', 'data-visibility', 'data-chrome', 'data-primary-cue-id', 'data-subject-bounds', 'data-truth-source'];
  const telemetry = telemetryElement === null ? null : Object.fromEntries(telemetryKeys.map(key => [key, telemetryElement.getAttribute(key)]));
  const root = document.documentElement;
  const body = document.body;
  const stageElementForVisibility = document.querySelector('[data-stage]');
  const subjectElements = [...document.querySelectorAll('[data-subject]')];
  const primaryElement = document.querySelector('[data-primary-cue]');
  const subtitleElement = document.querySelector('[data-subtitle-bar]');
  const targetElements = [document.querySelector('[data-stage]'), ...[...document.querySelectorAll('[data-subject], [data-primary-cue], [data-beat-control], [data-subtitle-bar]')]];
  return {
    viewport,
    stage,
    subjects: [...document.querySelectorAll('[data-subject]')].map(element => rectOf(element)).filter(value => value !== null),
    opaqueSurfaces: [...document.querySelectorAll('[data-opaque-surface]')].filter(visible).map(element => rectOf(element)).filter(value => value !== null),
    primary: { mounted: document.querySelectorAll('[data-primary-cue]').length, visible: [...document.querySelectorAll('[data-primary-cue]')].filter(visible).length },
    subtitle: {
      mounted: document.querySelectorAll('[data-subtitle-bar]').length,
      visible: visible(document.querySelector('[data-subtitle-bar]')),
      lineBoxes: lineBoxes(document.querySelector('[data-subtitle-bar]')),
      fontSize: Number.parseFloat(getComputedStyle(document.querySelector('[data-subtitle-bar]') || document.body).fontSize),
      color: getComputedStyle(document.querySelector('[data-subtitle-bar]') || document.body).color,
      backgroundColor: getComputedStyle(document.querySelector('[data-subtitle-bar]') || document.body).backgroundColor,
    },
    inactiveCues: [...document.querySelectorAll('[data-inactive-cue], [data-cue="candidate"], [data-cue="ttt"], [data-cue="trace"], [data-cue="commit"], [data-cue="receipt"]')].map(element => element.getAttribute('data-cue') || 'inactive'),
    forbiddenChrome,
    telemetry,
    overflow: { horizontal: Math.max(root.scrollWidth, body.scrollWidth) > innerWidth, vertical: Math.max(root.scrollHeight, body.scrollHeight) > innerHeight, scrollWidth: Math.max(root.scrollWidth, body.scrollWidth), scrollHeight: Math.max(root.scrollHeight, body.scrollHeight) },
    nonColorEncoding: [...document.querySelectorAll('[data-non-color-encoding]')].map(element => element.getAttribute('data-non-color-encoding') || ''),
    accessibility: {
      subjectLabels: [...document.querySelectorAll('[data-subject]')].filter(element => element.getAttribute('aria-label') !== null).length,
      cueLabels: [...document.querySelectorAll('[data-primary-cue]')].filter(element => (element.textContent || '').trim() !== '').length,
      beatControl: document.querySelector('[data-beat-control]') !== null,
    },
    responsiveTargets: targetElements.map(element => rectOf(element)).filter(value => value !== null),
    visibility: {
      stage: visible(stageElementForVisibility),
      subjects: subjectElements.map(visible),
      primary: visible(primaryElement),
      subtitle: visible(subtitleElement),
    },
    contractCensus: { expectedRoles: requiredRoles, roleCounts, missingRoles, duplicateRoles, invalidSurfaceRegistrations, invalidDecorativeRegistrations, invalidDecorationGeometry, invalidDecorationPaintExtents, unregisteredPaintedSurfaces, hiddenMountedNodes },
  };
})()`;

function delay(milliseconds: number): Promise<void> {
  return new Promise(resolveDelay => setTimeout(resolveDelay, milliseconds));
}

async function unusedPort(): Promise<number> {
  const server = createServer();
  await new Promise<void>((resolveListen, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolveListen());
  });
  const address = server.address();
  assert(address !== null && typeof address !== 'string');
  const port = address.port;
  await new Promise<void>((resolveClose, reject) => server.close(error => error ? reject(error) : resolveClose()));
  return port;
}

async function startVite(): Promise<{ readonly process: ChildProcess; readonly baseUrl: string }> {
  const port = await unusedPort();
  const viteBin = join(REPO_ROOT, 'node_modules/.bin/vite');
  const child = spawn(viteBin, ['--host', '127.0.0.1', '--port', String(port)], {
    cwd: REPO_ROOT,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const baseUrl = `http://127.0.0.1:${port}`;
  const startedAt = Date.now();
  let lastError = 'server did not respond';
  while (Date.now() - startedAt < 15_000) {
    if (child.exitCode !== null) {
      throw new Error(`Vite exited before readiness: ${lastError}`);
    }
    try {
      const response = await fetch(`${baseUrl}/visual-contract-fixture.html?case=valid`);
      if (response.ok) return { process: child, baseUrl };
      lastError = `HTTP ${response.status}`;
    } catch (error) {
      lastError = String(error);
    }
    await delay(100);
  }
  child.kill('SIGTERM');
  throw new Error(`Timed out waiting for Vite: ${lastError}`);
}

async function stopVite(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null) return;
  child.kill('SIGTERM');
  await Promise.race([once(child, 'exit'), delay(2_000)]);
  if (child.exitCode === null) child.kill('SIGKILL');
}

function asRect(value: RectPayload): AxisAlignedRect {
  return { left: value.left, top: value.top, right: value.right, bottom: value.bottom };
}

function finding(id: string, passed: boolean, details: Record<string, unknown> = {}): Finding {
  return { id, passed, details };
}

function parseRgb(value: string): { readonly r: number; readonly g: number; readonly b: number; readonly a: number } | null {
  const match = value.match(/rgba?\(([^)]+)\)/);
  if (match === null) return null;
  const parts = match[1].split(',').map(item => Number.parseFloat(item.trim()));
  if (parts.length < 3 || parts.some(item => !Number.isFinite(item))) return null;
  return { r: parts[0], g: parts[1], b: parts[2], a: parts[3] ?? 1 };
}

function luminance(value: { readonly r: number; readonly g: number; readonly b: number }): number {
  const channel = (input: number): number => {
    const normalized = input / 255;
    return normalized <= .03928 ? normalized / 12.92 : ((normalized + .055) / 1.055) ** 2.4;
  };
  return .2126 * channel(value.r) + .7152 * channel(value.g) + .0722 * channel(value.b);
}

function contrastRatio(foreground: string, background: string): number {
  const fg = parseRgb(foreground);
  const bg = parseRgb(background);
  if (fg === null || bg === null) return 0;
  const backdrop = { r: 7, g: 20, b: 29 };
  const composite = bg.a >= 1 ? bg : {
    r: bg.r * bg.a + backdrop.r * (1 - bg.a),
    g: bg.g * bg.a + backdrop.g * (1 - bg.a),
    b: bg.b * bg.a + backdrop.b * (1 - bg.a),
  };
  const foregroundColor = fg.a >= 1 ? fg : {
    r: fg.r * fg.a + composite.r * (1 - fg.a),
    g: fg.g * fg.a + composite.g * (1 - fg.a),
    b: fg.b * fg.a + composite.b * (1 - fg.a),
  };
  const lighter = Math.max(luminance(foregroundColor), luminance(composite));
  const darker = Math.min(luminance(foregroundColor), luminance(composite));
  return (lighter + .05) / (darker + .05);
}

async function collectSnapshot(page: Page): Promise<BrowserSnapshot> {
  return await page.evaluate(SNAPSHOT_EXPRESSION) as BrowserSnapshot;
}

function insideViewport(value: RectPayload, viewport: { readonly width: number; readonly height: number }): boolean {
  return value.left >= 0 && value.top >= 0 && value.right <= viewport.width && value.bottom <= viewport.height;
}

function subjectSafe(subjects: readonly RectPayload[], stage: RectPayload | null): boolean {
  if (stage === null || subjects.length === 0 || stage.width <= 0 || stage.height <= 0) return false;
  const left = stage.left + stage.width * THRESHOLDS.subjectSafeLeft;
  const right = stage.left + stage.width * THRESHOLDS.subjectSafeRight;
  const top = stage.top + stage.height * THRESHOLDS.subjectSafeTop;
  const bottom = stage.top + stage.height * THRESHOLDS.subjectSafeBottom;
  return subjects.every(subject => subject.left >= left && subject.right <= right && subject.top >= top && subject.bottom <= bottom);
}

function checkTelemetry(telemetry: BrowserSnapshot['telemetry']): boolean {
  const required = [
    'data-camera-pose',
    'data-camera-target',
    'data-camera-focus',
    'data-camera-speed',
    'data-visibility',
    'data-chrome',
    'data-primary-cue-id',
    'data-subject-bounds',
    'data-truth-source',
  ];
  return telemetry !== null && required.every(key => {
    const value = telemetry[key];
    return typeof value === 'string' && value.trim().length > 0;
  });
}

function evaluateVariant(snapshot: BrowserSnapshot): { readonly findings: readonly Finding[]; readonly geometry: ReturnType<typeof measureVisualContractGeometry>; readonly naiveSubjectOverlayArea: number; readonly exactSubjectOverlayArea: number; readonly passed: boolean } {
  const viewport = asRect(snapshot.viewport);
  const stage = snapshot.stage === null ? null : asRect(snapshot.stage);
  const subjects = snapshot.subjects.map(asRect);
  const opaque = snapshot.opaqueSurfaces.map(asRect);
  const geometry = measureVisualContractGeometry({
    viewport,
    stage: stage ?? { left: 0, top: 0, right: 0, bottom: 0 },
    subjects,
    opaqueOverlays: opaque,
  });
  const safeStage = stage === null ? null : clipRect(stage, viewport);
  const naiveSubjectOverlayArea = opaque.reduce((total, overlay) => total + subjects.reduce((subtotal, subject) => {
    const intersection = clipRect(overlay, subject);
    return subtotal + (intersection === null ? 0 : rectArea(intersection));
  }, 0), 0);
  const exactSubjectOverlayArea = subjects.length === 0 ? 0 : geometry.subjectOverlayIntersection * rectangleUnionArea(subjects);
  const findings = [
    finding('stage-coverage', snapshot.stage !== null && geometry.stageCoverage >= THRESHOLDS.stageCoverage, { actual: geometry.stageCoverage, threshold: THRESHOLDS.stageCoverage }),
    finding('unoccluded-stage', safeStage !== null && geometry.unoccludedStage >= THRESHOLDS.unoccludedStage, { actual: geometry.unoccludedStage, threshold: THRESHOLDS.unoccludedStage }),
    finding('subject-safe-area', subjectSafe(snapshot.subjects, snapshot.stage), { subjects: snapshot.subjects, safe: `${THRESHOLDS.subjectSafeLeft}-${THRESHOLDS.subjectSafeRight}/${THRESHOLDS.subjectSafeTop}-${THRESHOLDS.subjectSafeBottom}` }),
    finding('subject-overlay', geometry.subjectOverlayIntersection <= THRESHOLDS.subjectOverlayIntersection, { actual: geometry.subjectOverlayIntersection, threshold: THRESHOLDS.subjectOverlayIntersection, naiveSubjectOverlayArea, exactSubjectOverlayArea }),
    finding('primary-cue', snapshot.primary.mounted === 1 && snapshot.primary.visible === 1, snapshot.primary),
    finding('subtitle-bar', snapshot.subtitle.mounted === 1 && snapshot.subtitle.visible && snapshot.subtitle.lineBoxes.length <= THRESHOLDS.subtitleLineBoxesMax && snapshot.subtitle.lineBoxes.length > 0 && snapshot.subtitle.fontSize >= THRESHOLDS.readableFontPx, { mounted: snapshot.subtitle.mounted, visible: snapshot.subtitle.visible, lineBoxes: snapshot.subtitle.lineBoxes.length, fontSize: snapshot.subtitle.fontSize }),
    finding('effective-visibility', snapshot.visibility.stage && snapshot.visibility.primary && snapshot.visibility.subtitle && snapshot.visibility.subjects.length === snapshot.subjects.length && snapshot.visibility.subjects.every(Boolean), snapshot.visibility),
    finding('inactive-cues', snapshot.inactiveCues.length === 0, { cues: snapshot.inactiveCues }),
    finding('mounted-surface-census', snapshot.contractCensus.missingRoles.length === 0 && snapshot.contractCensus.duplicateRoles.length === 0 && snapshot.contractCensus.invalidSurfaceRegistrations.length === 0 && snapshot.contractCensus.invalidDecorativeRegistrations.length === 0, snapshot.contractCensus),
    finding('decoration-geometry', snapshot.contractCensus.invalidDecorationGeometry.length === 0, { issues: snapshot.contractCensus.invalidDecorationGeometry }),
    finding('decoration-paint-extent', snapshot.contractCensus.invalidDecorationPaintExtents.length === 0, { issues: snapshot.contractCensus.invalidDecorationPaintExtents }),
    finding('unregistered-painted-surfaces', snapshot.contractCensus.unregisteredPaintedSurfaces.length === 0, { surfaces: snapshot.contractCensus.unregisteredPaintedSurfaces }),
    finding('hidden-mounted-nodes', snapshot.contractCensus.hiddenMountedNodes.length === 0, { nodes: snapshot.contractCensus.hiddenMountedNodes }),
    finding('forbidden-chrome', snapshot.forbiddenChrome.length === 0, { matches: snapshot.forbiddenChrome }),
    finding('telemetry', checkTelemetry(snapshot.telemetry), { telemetry: snapshot.telemetry }),
    finding('overflow', !snapshot.overflow.horizontal && !snapshot.overflow.vertical, snapshot.overflow),
    finding('non-color-encoding', snapshot.nonColorEncoding.length >= 2 && snapshot.nonColorEncoding.every(value => value.trim().length > 0), { values: snapshot.nonColorEncoding }),
    finding('accessible-scene', snapshot.accessibility.subjectLabels === snapshot.subjects.length && snapshot.accessibility.cueLabels === 1 && snapshot.accessibility.beatControl, snapshot.accessibility),
  ];
  return {
    findings,
    geometry,
    naiveSubjectOverlayArea,
    exactSubjectOverlayArea,
    passed: findings.every(item => item.passed),
  };
}

async function verifyKeyboardAndReducedMotion(page: Page): Promise<readonly Finding[]> {
  await page.mouse.click(1750, 700);
  await page.keyboard.press('Tab');
  const keyboard = await page.evaluate(() => document.activeElement?.matches('[data-beat-control]') === true);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.reload({ waitUntil: 'networkidle' });
  // `page.evaluate` given a STRING cannot infer a return type, so these three
  // call sites produced `unknown` and 15 type errors -- introduced by 33fa5ba
  // ("chore: checkpoint current project WIP"), which is why the comment in
  // governance.yml still says this tsconfig is error-free. `typecheck:scripts`
  // is step 1 of the static-gates job, so every later step -- check:baseline
  // included -- has been unreachable in CI ever since. Naming the shape is the
  // whole fix.
  const motion = await page.evaluate<{
    readonly media: boolean;
    readonly effectivelyDisabled: boolean;
    readonly maxDurationMs: number;
  }>(String.raw`(() => {
    const durations = [...document.querySelectorAll('*')].flatMap(element => {
      const style = getComputedStyle(element);
      const values = [style.animationDuration, style.transitionDuration];
      return values.flatMap(value => value.split(',').map(item => item.trim().endsWith('ms') ? Number.parseFloat(item) : Number.parseFloat(item) * 1_000));
    });
    return {
      media: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
      effectivelyDisabled: durations.every(value => !Number.isFinite(value) || value <= .1),
      maxDurationMs: Math.max(0, ...durations.filter(Number.isFinite)),
    };
  })()`);
  return [
    finding('keyboard-focus', keyboard, { activeElement: keyboard ? 'data-beat-control' : 'other' }),
    finding('reduced-motion', motion.media && motion.effectivelyDisabled, motion),
  ];
}

async function verifyReadableText(page: Page): Promise<Finding> {
  const snapshot = await page.evaluate(() => {
    const subtitle = document.querySelector<HTMLElement>('[data-subtitle-bar]');
    const control = document.querySelector<HTMLElement>('[data-beat-control]');
    if (subtitle === null || control === null) return null;
    const subtitleStyle = getComputedStyle(subtitle);
    const controlStyle = getComputedStyle(control);
    return {
      subtitleFontSize: Number.parseFloat(subtitleStyle.fontSize),
      controlFontSize: Number.parseFloat(controlStyle.fontSize),
      subtitleColor: subtitleStyle.color,
      subtitleBackground: subtitleStyle.backgroundColor,
      controlColor: controlStyle.color,
      controlBackground: controlStyle.backgroundColor,
    };
  });
  if (snapshot === null) return finding('readable-text', false, { reason: 'subtitle/control missing' });
  const subtitleContrast = contrastRatio(snapshot.subtitleColor, snapshot.subtitleBackground);
  const controlContrast = contrastRatio(snapshot.controlColor, snapshot.controlBackground);
  return finding('readable-text', snapshot.subtitleFontSize >= THRESHOLDS.readableFontPx
    && snapshot.controlFontSize >= THRESHOLDS.readableFontPx
    && subtitleContrast >= THRESHOLDS.contrastRatio
    && controlContrast >= THRESHOLDS.contrastRatio, {
    ...snapshot,
    subtitleContrast,
    controlContrast,
    threshold: { fontPx: THRESHOLDS.readableFontPx, contrastRatio: THRESHOLDS.contrastRatio },
  });
}

async function verifyResponsive(baseUrl: string): Promise<Finding> {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: RESPONSIVE_VIEWPORT, deviceScaleFactor: 1 });
  try {
    await page.goto(`${baseUrl}/visual-contract-fixture.html?case=valid`, { waitUntil: 'networkidle' });
    const snapshot = await collectSnapshot(page);
    const targetsInside = snapshot.responsiveTargets.every(target => insideViewport(target, RESPONSIVE_VIEWPORT));
    const subtitleContrast = contrastRatio(snapshot.subtitle.color, snapshot.subtitle.backgroundColor);
    const lineBoxesInside = snapshot.subtitle.lineBoxes.every(line => insideViewport(line, RESPONSIVE_VIEWPORT));
    const subtitleReadable = snapshot.subtitle.visible
      && snapshot.subtitle.lineBoxes.length > 0
      && snapshot.subtitle.lineBoxes.length <= THRESHOLDS.subtitleLineBoxesMax
      && snapshot.subtitle.fontSize >= THRESHOLDS.readableFontPx
      && subtitleContrast >= THRESHOLDS.contrastRatio
      && lineBoxesInside;
    return finding('responsive-320', !snapshot.overflow.horizontal && !snapshot.overflow.vertical && targetsInside && subtitleReadable, {
      viewport: RESPONSIVE_VIEWPORT,
      overflow: snapshot.overflow,
      targetsInside,
      subtitle: {
        visible: snapshot.subtitle.visible,
        lineBoxes: snapshot.subtitle.lineBoxes.length,
        fontSize: snapshot.subtitle.fontSize,
        contrast: subtitleContrast,
        lineBoxesInside,
        threshold: { lineBoxesMax: THRESHOLDS.subtitleLineBoxesMax, fontPx: THRESHOLDS.readableFontPx, contrastRatio: THRESHOLDS.contrastRatio },
      },
    });
  } finally {
    await page.close();
    await browser.close();
  }
}

async function captureRouteSmoke(baseUrl: string, browser: Browser): Promise<RouteSmokeEvidence> {
  const page = await browser.newPage({ viewport: VIEWPORT, deviceScaleFactor: 1 });
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  page.on('console', message => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', error => pageErrors.push(String(error)));
  try {
    const url = `${baseUrl}/simulator`;
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    // Let the existing route settle far enough to publish its accepted frame;
    // this is smoke evidence only, never an acceptance wait for the product
    // compositor.
    await page.waitForTimeout(10_000);
    await page.screenshot({ path: ROUTE_SMOKE_SCREENSHOT, fullPage: false });
    const snapshot = await page.evaluate<{
      readonly canvasCount: number;
      readonly scenePlanAvailability: string | null;
      readonly scenePlanReason: string | null;
      readonly globalFrameId: string | null;
      readonly localFrameId: string | null;
      readonly selectors: Record<string, number>;
      readonly rects: Readonly<Record<string, RectPayload | null>>;
    }>(String.raw`(() => {
      const rect = selector => {
        const element = document.querySelector(selector);
        if (element === null) return null;
        const value = element.getBoundingClientRect();
        return { left: value.left, top: value.top, right: value.right, bottom: value.bottom, width: value.width, height: value.height };
      };
      const selectors = {
        leftControlStack: '.vlab-left-control-stack',
        centerColumn: '.vlab-center-column',
        resultDock: '.vlab-progressive-result-dock',
        timelineShell: '.vlab-timeline-shell',
        sidebarModules: '.vlab-sidebar-modules',
      };
      const counts = Object.fromEntries(Object.entries(selectors).map(([key, selector]) => [key, document.querySelectorAll(selector).length]));
      const rects = Object.fromEntries(Object.entries(selectors).map(([key, selector]) => [key, rect(selector)]));
      const scene = document.querySelector('[data-scene-plan-availability]');
      return {
        canvasCount: document.querySelectorAll('canvas').length,
        scenePlanAvailability: scene?.dataset.scenePlanAvailability ?? null,
        scenePlanReason: scene?.dataset.scenePlanReason ?? null,
        globalFrameId: scene?.dataset.globalFrameId ?? null,
        localFrameId: scene?.dataset.localFrameId ?? null,
        selectors: counts,
        rects,
      };
    })()`);
    const oldThreeColumnEvidence = snapshot.selectors.leftControlStack > 0
      && snapshot.selectors.centerColumn > 0
      && snapshot.selectors.resultDock > 0
      && snapshot.selectors.timelineShell > 0;
    return {
      url,
      canvasCount: snapshot.canvasCount,
      consoleErrors,
      pageErrors,
      scenePlanAvailability: snapshot.scenePlanAvailability,
      scenePlanReason: snapshot.scenePlanReason,
      globalFrameId: snapshot.globalFrameId,
      localFrameId: snapshot.localFrameId,
      legacyCompositor: {
        oldThreeColumnEvidence,
        selectors: snapshot.selectors,
        rects: snapshot.rects,
      },
      productDisposition: 'PRODUCT_REJECTED_QUARANTINED',
    };
  } finally {
    await page.close();
  }
}

async function captureContactSheet(validPath: string, badPath: string, badUnmarkedPath: string, badAncestorHiddenPath: string, badAllowedDecorationOversizePath: string, badAllowedDecorationShadowPath: string): Promise<void> {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1920, height: 540 }, deviceScaleFactor: 1 });
  try {
    const validData = `data:image/png;base64,${(await readFile(validPath)).toString('base64')}`;
    const badData = `data:image/png;base64,${(await readFile(badPath)).toString('base64')}`;
    const badUnmarkedData = `data:image/png;base64,${(await readFile(badUnmarkedPath)).toString('base64')}`;
    const badAncestorHiddenData = `data:image/png;base64,${(await readFile(badAncestorHiddenPath)).toString('base64')}`;
    const badAllowedDecorationOversizeData = `data:image/png;base64,${(await readFile(badAllowedDecorationOversizePath)).toString('base64')}`;
    const badAllowedDecorationShadowData = `data:image/png;base64,${(await readFile(badAllowedDecorationShadowPath)).toString('base64')}`;
    await page.setContent('<canvas id="contact" width="1920" height="540"></canvas>');
    const imageData = await page.evaluate<string>(String.raw`(async () => {
      const valid = ${JSON.stringify(validData)};
      const bad = ${JSON.stringify(badData)};
      const badUnmarked = ${JSON.stringify(badUnmarkedData)};
      const badAncestorHidden = ${JSON.stringify(badAncestorHiddenData)};
      const badAllowedDecorationOversize = ${JSON.stringify(badAllowedDecorationOversizeData)};
      const badAllowedDecorationShadow = ${JSON.stringify(badAllowedDecorationShadowData)};
      const canvas = document.querySelector('#contact');
      if (canvas === null) throw new Error('contact canvas missing');
      const context = canvas.getContext('2d');
      if (context === null) throw new Error('contact canvas context missing');
      const load = (src) => new Promise((resolveImage, rejectImage) => {
        const image = new Image();
        image.onload = () => resolveImage(image);
        image.onerror = () => rejectImage(new Error('failed to load contact image'));
        image.src = src;
      });
      const [validImage, badImage, badUnmarkedImage, badAncestorHiddenImage, badAllowedDecorationOversizeImage, badAllowedDecorationShadowImage] = await Promise.all([load(valid), load(bad), load(badUnmarked), load(badAncestorHidden), load(badAllowedDecorationOversize), load(badAllowedDecorationShadow)]);
      context.fillStyle = '#07141d';
      context.fillRect(0, 0, canvas.width, canvas.height);
      const panelWidth = canvas.width / 6;
      context.drawImage(validImage, panelWidth * 0, 0, panelWidth, 540);
      context.drawImage(badImage, panelWidth * 1, 0, panelWidth, 540);
      context.drawImage(badUnmarkedImage, panelWidth * 2, 0, panelWidth, 540);
      context.drawImage(badAncestorHiddenImage, panelWidth * 3, 0, panelWidth, 540);
      context.drawImage(badAllowedDecorationOversizeImage, panelWidth * 4, 0, panelWidth, 540);
      context.drawImage(badAllowedDecorationShadowImage, panelWidth * 5, 0, panelWidth, 540);
      return canvas.toDataURL('image/png');
    })()`);
    await writeFile(CONTACT_SHEET, Buffer.from(imageData.split(',')[1], 'base64'));
  } finally {
    await page.close();
    await browser.close();
  }
}

function sha256(path: string, bytes: Uint8Array): { readonly path: string; readonly sha256: string; readonly bytes: number } {
  return { path, sha256: createHash('sha256').update(bytes).digest('hex'), bytes: bytes.byteLength };
}

async function main(): Promise<void> {
  await mkdir(OUTPUT_ROOT, { recursive: true });
  const vite = await startVite();
  let browser: Browser | null = null;
  try {
    browser = await chromium.launch();
    const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 1 });
    const page = await context.newPage();
    await page.goto(`${vite.baseUrl}/visual-contract-fixture.html?case=valid`, { waitUntil: 'networkidle' });
    const validSnapshot = await collectSnapshot(page);
    const validEvaluation = evaluateVariant(validSnapshot);
    const validInteractionFindings = [
      ...(await verifyKeyboardAndReducedMotion(page)),
      await verifyReadableText(page),
    ];
    const validResponsive = await verifyResponsive(vite.baseUrl);
    const validFindings = [...validEvaluation.findings, ...validInteractionFindings, validResponsive];
    await page.setViewportSize(VIEWPORT);
    await page.goto(`${vite.baseUrl}/visual-contract-fixture.html?case=valid`, { waitUntil: 'networkidle' });
    await page.screenshot({ path: VALID_SCREENSHOT, fullPage: false });

    const badPage = await context.newPage();
    await badPage.goto(`${vite.baseUrl}/visual-contract-fixture.html?case=bad-overlap`, { waitUntil: 'networkidle' });
    const badSnapshot = await collectSnapshot(badPage);
    const badEvaluation = evaluateVariant(badSnapshot);
    await badPage.screenshot({ path: BAD_SCREENSHOT, fullPage: false });
    await badPage.close();
    const badUnmarkedPage = await context.newPage();
    await badUnmarkedPage.goto(`${vite.baseUrl}/visual-contract-fixture.html?case=bad-unmarked`, { waitUntil: 'networkidle' });
    const badUnmarkedSnapshot = await collectSnapshot(badUnmarkedPage);
    const badUnmarkedEvaluation = evaluateVariant(badUnmarkedSnapshot);
    await badUnmarkedPage.screenshot({ path: BAD_UNMARKED_SCREENSHOT, fullPage: false });
    await badUnmarkedPage.close();
    const badAncestorHiddenPage = await context.newPage();
    await badAncestorHiddenPage.goto(`${vite.baseUrl}/visual-contract-fixture.html?case=bad-ancestor-hidden`, { waitUntil: 'networkidle' });
    const badAncestorHiddenSnapshot = await collectSnapshot(badAncestorHiddenPage);
    const badAncestorHiddenEvaluation = evaluateVariant(badAncestorHiddenSnapshot);
    await badAncestorHiddenPage.screenshot({ path: BAD_ANCESTOR_HIDDEN_SCREENSHOT, fullPage: false });
    await badAncestorHiddenPage.close();
    const badAllowedDecorationOversizePage = await context.newPage();
    await badAllowedDecorationOversizePage.goto(`${vite.baseUrl}/visual-contract-fixture.html?case=bad-allowed-decoration-oversize`, { waitUntil: 'networkidle' });
    const badAllowedDecorationOversizeSnapshot = await collectSnapshot(badAllowedDecorationOversizePage);
    const badAllowedDecorationOversizeEvaluation = evaluateVariant(badAllowedDecorationOversizeSnapshot);
    await badAllowedDecorationOversizePage.screenshot({ path: BAD_ALLOWED_DECORATION_OVERSIZE_SCREENSHOT, fullPage: false });
    await badAllowedDecorationOversizePage.close();
    const badAllowedDecorationShadowPage = await context.newPage();
    await badAllowedDecorationShadowPage.goto(`${vite.baseUrl}/visual-contract-fixture.html?case=bad-allowed-decoration-shadow`, { waitUntil: 'networkidle' });
    const badAllowedDecorationShadowSnapshot = await collectSnapshot(badAllowedDecorationShadowPage);
    const badAllowedDecorationShadowEvaluation = evaluateVariant(badAllowedDecorationShadowSnapshot);
    await badAllowedDecorationShadowPage.screenshot({ path: BAD_ALLOWED_DECORATION_SHADOW_SCREENSHOT, fullPage: false });
    await badAllowedDecorationShadowPage.close();
    await page.close();
    await context.close();

    const routeSmoke = await captureRouteSmoke(vite.baseUrl, browser);

    const validPassed = validFindings.every(item => item.passed);
    const badExpectedFailureIds = ['subject-overlay', 'inactive-cues', 'unregistered-painted-surfaces', 'hidden-mounted-nodes'];
    const badExpectedFailuresObserved = badExpectedFailureIds.every(id => {
      const item = badEvaluation.findings.find(findingItem => findingItem.id === id);
      return item !== undefined && !item.passed;
    });
    const badUnmarkedExpectedFailureIds = ['unregistered-painted-surfaces', 'hidden-mounted-nodes'];
    const badUnmarkedExpectedFailuresObserved = badUnmarkedExpectedFailureIds.every(id => {
      const item = badUnmarkedEvaluation.findings.find(findingItem => findingItem.id === id);
      return item !== undefined && !item.passed;
    });
    const badAncestorHiddenExpectedFailureIds = ['effective-visibility', 'primary-cue', 'subtitle-bar', 'hidden-mounted-nodes'];
    const badAncestorHiddenExpectedFailuresObserved = badAncestorHiddenExpectedFailureIds.every(id => {
      const item = badAncestorHiddenEvaluation.findings.find(findingItem => findingItem.id === id);
      return item !== undefined && !item.passed;
    });
    const badAllowedDecorationOversizeExpectedFailureIds = ['decoration-geometry'];
    const badAllowedDecorationOversizeExpectedFailuresObserved = badAllowedDecorationOversizeExpectedFailureIds.every(id => {
      const item = badAllowedDecorationOversizeEvaluation.findings.find(findingItem => findingItem.id === id);
      return item !== undefined && !item.passed;
    });
    const badAllowedDecorationShadowExpectedFailureIds = ['decoration-paint-extent'];
    const badAllowedDecorationShadowExpectedFailuresObserved = badAllowedDecorationShadowExpectedFailureIds.every(id => {
      const item = badAllowedDecorationShadowEvaluation.findings.find(findingItem => findingItem.id === id);
      return item !== undefined && !item.passed;
    });
    const badUnionProof = badEvaluation.naiveSubjectOverlayArea > badEvaluation.exactSubjectOverlayArea;
    assert.equal(validPassed, true, `valid fixture failed: ${validFindings.filter(item => !item.passed).map(item => item.id).join(', ')}`);
    assert.equal(badEvaluation.passed, false, 'bad fixture unexpectedly passed');
    assert.equal(badExpectedFailuresObserved, true, 'bad fixture did not expose required red findings');
    assert.equal(badUnmarkedEvaluation.passed, false, 'unmarked adversarial fixture unexpectedly passed');
    assert.equal(badUnmarkedExpectedFailuresObserved, true, 'unmarked adversarial fixture did not expose census findings');
    assert.equal(badAncestorHiddenEvaluation.passed, false, 'ancestor-hidden adversarial fixture unexpectedly passed');
    assert.equal(badAncestorHiddenExpectedFailuresObserved, true, 'ancestor-hidden adversarial fixture did not expose effective-visibility findings');
    assert.equal(badAllowedDecorationOversizeEvaluation.passed, false, 'oversized allowed decoration fixture unexpectedly passed');
    assert.equal(badAllowedDecorationOversizeExpectedFailuresObserved, true, 'oversized allowed decoration fixture did not expose decoration geometry findings');
    assert.equal(badAllowedDecorationShadowEvaluation.passed, false, 'shadowed allowed decoration fixture unexpectedly passed');
    assert.equal(badAllowedDecorationShadowExpectedFailuresObserved, true, 'shadowed allowed decoration fixture did not expose paint extent findings');
    assert.equal(badUnionProof, true, 'bad fixture did not prove union area is less than naive summed area');
    assert.equal(routeSmoke.canvasCount, 1, `route smoke expected one Canvas, observed ${routeSmoke.canvasCount}`);
    assert.equal(routeSmoke.consoleErrors.length, 0, `route smoke console errors: ${routeSmoke.consoleErrors.join(' | ')}`);
    assert.equal(routeSmoke.pageErrors.length, 0, `route smoke page errors: ${routeSmoke.pageErrors.join(' | ')}`);

    await captureContactSheet(VALID_SCREENSHOT, BAD_SCREENSHOT, BAD_UNMARKED_SCREENSHOT, BAD_ANCESTOR_HIDDEN_SCREENSHOT, BAD_ALLOWED_DECORATION_OVERSIZE_SCREENSHOT, BAD_ALLOWED_DECORATION_SHADOW_SCREENSHOT);
    const artifacts = await Promise.all([VALID_SCREENSHOT, BAD_SCREENSHOT, BAD_UNMARKED_SCREENSHOT, BAD_ANCESTOR_HIDDEN_SCREENSHOT, BAD_ALLOWED_DECORATION_OVERSIZE_SCREENSHOT, BAD_ALLOWED_DECORATION_SHADOW_SCREENSHOT, CONTACT_SHEET, ROUTE_SMOKE_SCREENSHOT].map(async artifactPath => {
      const bytes = await readFile(artifactPath);
      return sha256(artifactPath.replace(`${REPO_ROOT}/`, ''), bytes);
    }));
    const report = {
      schemaVersion: 'visual-contract-browser-report-v1',
      status: 'CANDIDATE_EVIDENCE',
      viewport: VIEWPORT,
      deviceScaleFactor: 1,
      thresholds: THRESHOLDS,
      valid: {
        passed: validPassed,
        findings: validFindings,
        geometry: validEvaluation.geometry,
        snapshot: validSnapshot,
      },
      badOverlap: {
        passed: badEvaluation.passed,
        expectedFailureIds: badExpectedFailureIds,
        expectedFailuresObserved: badExpectedFailuresObserved,
        unionProof: { naiveSubjectOverlayArea: badEvaluation.naiveSubjectOverlayArea, exactSubjectOverlayArea: badEvaluation.exactSubjectOverlayArea, exactLessThanNaive: badUnionProof },
        findings: badEvaluation.findings,
        geometry: badEvaluation.geometry,
        snapshot: badSnapshot,
      },
      badUnmarked: {
        passed: badUnmarkedEvaluation.passed,
        expectedFailureIds: badUnmarkedExpectedFailureIds,
        expectedFailuresObserved: badUnmarkedExpectedFailuresObserved,
        findings: badUnmarkedEvaluation.findings,
        geometry: badUnmarkedEvaluation.geometry,
        snapshot: badUnmarkedSnapshot,
      },
      badAncestorHidden: {
        passed: badAncestorHiddenEvaluation.passed,
        expectedFailureIds: badAncestorHiddenExpectedFailureIds,
        expectedFailuresObserved: badAncestorHiddenExpectedFailuresObserved,
        findings: badAncestorHiddenEvaluation.findings,
        geometry: badAncestorHiddenEvaluation.geometry,
        snapshot: badAncestorHiddenSnapshot,
      },
      badAllowedDecorationOversize: {
        passed: badAllowedDecorationOversizeEvaluation.passed,
        expectedFailureIds: badAllowedDecorationOversizeExpectedFailureIds,
        expectedFailuresObserved: badAllowedDecorationOversizeExpectedFailuresObserved,
        findings: badAllowedDecorationOversizeEvaluation.findings,
        geometry: badAllowedDecorationOversizeEvaluation.geometry,
        snapshot: badAllowedDecorationOversizeSnapshot,
      },
      badAllowedDecorationShadow: {
        passed: badAllowedDecorationShadowEvaluation.passed,
        expectedFailureIds: badAllowedDecorationShadowExpectedFailureIds,
        expectedFailuresObserved: badAllowedDecorationShadowExpectedFailuresObserved,
        findings: badAllowedDecorationShadowEvaluation.findings,
        geometry: badAllowedDecorationShadowEvaluation.geometry,
        snapshot: badAllowedDecorationShadowSnapshot,
      },
      routeSmoke,
      artifacts,
      note: 'Pixels are fixture/harness evidence only; the /simulator smoke records the current three-column compositor as PRODUCT_REJECTED_QUARANTINED and never promotes it to WI-02 acceptance. No owner visual acceptance or lesson/science PASS is claimed.',
    };
    await writeFile(MACHINE_REPORT, JSON.stringify(report, null, 2));
    const machineReportHash = sha256(
      MACHINE_REPORT.replace(`${REPO_ROOT}/`, ''),
      await readFile(MACHINE_REPORT),
    );
    console.log(JSON.stringify({ status: 'PASS', valid: validPassed, badExpectedFailuresObserved, badUnmarkedExpectedFailuresObserved, badAncestorHiddenExpectedFailuresObserved, badAllowedDecorationOversizeExpectedFailuresObserved, badAllowedDecorationShadowExpectedFailuresObserved, artifacts, machineReport: machineReportHash }, null, 2));
  } finally {
    if (browser !== null) await browser.close();
    await stopVite(vite.process);
  }
}

await main();
