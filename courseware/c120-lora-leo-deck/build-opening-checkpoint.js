#!/usr/bin/env node

'use strict';

import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PptxGenJS = require('/home/u24/.codex/skills/presentation-skill/node_modules/pptxgenjs');

const ROOT = __dirname;
const OUTLINE_PATH = path.join(ROOT, 'outline.zh-TW.json');
const OUTPUT_PATH = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.join(ROOT, 'build', 'c120-lora-leo-opening-checkpoint-zh-TW.pptx');
const TEMPLATE_ASSET_DIR = path.join(ROOT, 'assets', 'educate-template');
const TEMPLATE_SWIRL = path.join(TEMPLATE_ASSET_DIR, 'image1.png');
const TEMPLATE_FOOTER = path.join(TEMPLATE_ASSET_DIR, 'image2.png');
const TEMPLATE_LOGO = path.join(TEMPLATE_ASSET_DIR, 'image3.png');

for (const requiredPath of [OUTLINE_PATH, TEMPLATE_SWIRL, TEMPLATE_FOOTER, TEMPLATE_LOGO]) {
  if (!fs.existsSync(requiredPath)) {
    throw new Error(`Missing required source: ${requiredPath}`);
  }
}

fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });

const outline = JSON.parse(fs.readFileSync(OUTLINE_PATH, 'utf8'));
if (!Array.isArray(outline.slides) || outline.slides.length !== 9) {
  throw new Error(`Expected exactly 9 slides, found ${outline.slides?.length ?? 0}`);
}

const pptx = new PptxGenJS();
pptx.layout = 'LAYOUT_WIDE';
pptx.author = 'C-120 presentation controller';
pptx.company = 'C-120 courseware';
pptx.subject = 'LoRaEnergySim × Leo opening checkpoint for owner review';
pptx.title = outline.title;
pptx.lang = 'zh-TW';
pptx.theme = {
  headFontFace: 'Noto Sans',
  bodyFontFace: 'Noto Sans',
  lang: 'zh-TW',
};
pptx.defineLayout({ name: 'C120_WIDE', width: 13.333333, height: 7.5 });
pptx.layout = 'C120_WIDE';

const W = 13.333333;
const H = 7.5;
const FONT = 'Noto Sans';

const C = {
  bg: '07111F',
  bgDeep: '030914',
  surface: '101E32',
  surface2: '142943',
  surface3: '0B1728',
  line: '29435E',
  text: 'F4F7FB',
  muted: '9DB0C4',
  cyan: '32D6D0',
  cyanSoft: '7DE7E2',
  blue: '5B8CFF',
  amber: 'FFB84D',
  red: 'FF6B73',
  green: '70D59A',
  violet: 'A38BFF',
  white: 'FFFFFF',
  black: '000000',
};

function addText(slide, text, x, y, w, h, opts = {}) {
  slide.addText(text, {
    x, y, w, h,
    fontFace: FONT,
    fontSize: opts.fontSize ?? 20,
    color: opts.color ?? C.text,
    bold: Boolean(opts.bold),
    italic: Boolean(opts.italic),
    align: opts.align ?? 'left',
    valign: opts.valign ?? 'mid',
    margin: opts.margin ?? 0,
    breakLine: false,
    fit: opts.fit ?? 'shrink',
    paraSpaceAfterPt: opts.paraSpaceAfterPt ?? 0,
    isTextBox: true,
    transparency: opts.transparency,
  });
}

function addRect(slide, x, y, w, h, opts = {}) {
  slide.addShape(opts.shape ?? pptx.ShapeType.roundRect, {
    x, y, w, h,
    rectRadius: opts.rectRadius,
    fill: {
      color: opts.fill ?? C.surface,
      transparency: opts.transparency ?? 0,
    },
    line: {
      color: opts.line ?? C.line,
      transparency: opts.lineTransparency ?? 0,
      width: opts.lineWidth ?? 1,
    },
    shadow: opts.shadow
      ? { type: 'outer', color: C.black, opacity: 0.24, blur: 1.5, angle: 45, distance: 1 }
      : undefined,
  });
}

function addLine(slide, x, y, w, h, opts = {}) {
  slide.addShape(pptx.ShapeType.line, {
    x, y, w, h,
    line: {
      color: opts.color ?? C.line,
      width: opts.width ?? 1.5,
      transparency: opts.transparency ?? 0,
      dash: opts.dash,
      beginArrowType: opts.beginArrowType,
      endArrowType: opts.endArrowType,
    },
  });
}

function addCircle(slide, x, y, d, opts = {}) {
  slide.addShape(pptx.ShapeType.ellipse, {
    x, y, w: d, h: d,
    fill: { color: opts.fill ?? C.surface2, transparency: opts.transparency ?? 0 },
    line: { color: opts.line ?? C.cyan, width: opts.lineWidth ?? 1.4 },
  });
}

function addBrandFrame(slide, index, { hero = false } = {}) {
  slide.background = { color: C.bg };
  if (hero) {
    slide.addImage({ path: TEMPLATE_SWIRL, x: 0, y: 0, w: W, h: H, transparency: 8 });
    slide.addShape(pptx.ShapeType.rect, {
      x: 0, y: 0, w: W, h: H,
      fill: { color: C.bgDeep, transparency: 20 },
      line: { color: C.bgDeep, transparency: 100 },
    });
  }

  // Exact opaque assets and their original safe-bound positions from educate.pptx.
  slide.addImage({ path: TEMPLATE_LOGO, x: 10.7996, y: 0, w: 2.4775, h: 0.3539 });
  slide.addImage({ path: TEMPLATE_FOOTER, x: 0, y: 6.6888, w: 13.3333, h: 0.2364 });

  addText(slide, 'C-120 · OPENING CHECKPOINT · OWNER REVIEW', 0.62, 0.09, 5.7, 0.20, {
    fontSize: 8.5,
    color: C.cyanSoft,
    bold: true,
    valign: 'mid',
  });
  addLine(slide, 0.62, 0.40, 9.65, 0, { color: C.line, width: 0.8 });
  addText(slide, String(index).padStart(2, '0'), 12.36, 7.07, 0.40, 0.18, {
    fontSize: 8.5,
    color: C.muted,
    align: 'right',
  });
}

function addTitle(slide, title, opts = {}) {
  addText(slide, title, 0.66, 0.58, opts.w ?? 11.95, opts.h ?? 0.72, {
    fontSize: opts.fontSize ?? 27,
    color: opts.color ?? C.text,
    bold: true,
    valign: 'mid',
    fit: 'shrink',
  });
  addRect(slide, 0.66, 1.31, opts.accentW ?? 0.72, 0.055, {
    shape: pptx.ShapeType.rect,
    fill: opts.accent ?? C.cyan,
    line: opts.accent ?? C.cyan,
    lineWidth: 0,
  });
}

function addSources(slide, sources = []) {
  if (!sources.length) return;
  addText(slide, `Authority: ${sources.join(' · ')}`, 0.66, 6.42, 11.95, 0.17, {
    fontSize: 7.2,
    color: C.muted,
    italic: true,
    valign: 'mid',
  });
}

function finishSlide(slide, spec) {
  addSources(slide, spec.sources || []);
  if (spec.notes) slide.addNotes(spec.notes);
}

function addTag(slide, text, x, y, w, color = C.cyan) {
  addRect(slide, x, y, w, 0.32, {
    fill: color,
    transparency: 84,
    line: color,
    lineWidth: 0.9,
  });
  addText(slide, text, x + 0.10, y, w - 0.20, 0.32, {
    fontSize: 10,
    color,
    bold: true,
    align: 'center',
  });
}

function slide01(spec, index) {
  const slide = pptx.addSlide();
  addBrandFrame(slide, index, { hero: true });

  addTag(slide, '智慧節能與物聯網應用', 0.72, 0.82, 2.55, C.cyan);
  addText(slide, '每一次', 0.72, 1.42, 3.0, 0.56, { fontSize: 25, color: C.muted, bold: true });
  addText(slide, 'SEND、WAIT、SLEEP', 0.72, 1.95, 9.55, 0.86, {
    fontSize: 39,
    color: C.text,
    bold: true,
  });
  addText(slide, '都是能源決策', 0.72, 2.80, 6.9, 0.76, {
    fontSize: 36,
    color: C.cyanSoft,
    bold: true,
  });
  addText(slide, 'LoRaEnergySim 讓 endpoint 後果可被檢查；LEO 只提供 changing-service-window。', 0.75, 3.68, 10.75, 0.55, {
    fontSize: 17.5,
    color: C.muted,
  });

  const states = [
    { label: 'SEND', color: C.amber, width: 2.05 },
    { label: 'WAIT', color: C.blue, width: 2.05 },
    { label: 'SLEEP', color: C.green, width: 2.05 },
  ];
  let x = 0.78;
  for (const state of states) {
    addRect(slide, x, 4.60, state.width, 0.88, {
      fill: state.color,
      transparency: 82,
      line: state.color,
      lineWidth: 1.8,
      shadow: true,
    });
    addText(slide, state.label, x, 4.61, state.width, 0.86, {
      fontSize: 21,
      color: state.color,
      bold: true,
      align: 'center',
    });
    x += state.width + 0.25;
  }
  addLine(slide, 7.72, 5.04, 1.1, 0, { color: C.cyan, width: 2.2, endArrowType: 'triangle' });
  addRect(slide, 8.92, 4.42, 3.64, 1.23, {
    fill: C.cyan,
    transparency: 88,
    line: C.cyan,
    lineWidth: 1.8,
  });
  addText(slide, 'SERVICE WINDOW', 9.12, 4.55, 3.23, 0.34, {
    fontSize: 15,
    color: C.cyanSoft,
    bold: true,
    align: 'center',
  });
  addText(slide, 'packet/service — P × t — energy', 9.08, 4.99, 3.31, 0.34, {
    fontSize: 12.5,
    color: C.text,
    align: 'center',
  });

  addText(slide, spec.footer, 0.72, 6.02, 11.7, 0.24, {
    fontSize: 9.5,
    color: C.red,
    bold: true,
  });
  finishSlide(slide, spec);
}

function slide02(spec, index) {
  const slide = pptx.addSlide();
  addBrandFrame(slide, index);
  addTitle(slide, spec.title);

  const nodes = [
    ['01', 'STATE / DATA', '裝置與情境'],
    ['02', 'POLICY', '送、等、睡'],
    ['03', 'PACKET / SERVICE', '嘗試與結果'],
    ['04', 'POWER × TIME', '狀態累積'],
    ['05', 'ENERGY', 'endpoint J'],
    ['06', 'EVIDENCE', '支持或推翻'],
  ];
  const x0 = 0.68;
  const boxW = 1.76;
  const gap = 0.27;
  const y = 2.14;
  nodes.forEach((node, i) => {
    const x = x0 + i * (boxW + gap);
    const color = i < 2 ? C.blue : i < 4 ? C.cyan : i === 4 ? C.amber : C.green;
    addRect(slide, x, y, boxW, 1.52, {
      fill: C.surface,
      line: color,
      lineWidth: 1.6,
      shadow: true,
    });
    addText(slide, node[0], x + 0.12, y + 0.13, 0.42, 0.28, {
      fontSize: 11,
      color,
      bold: true,
    });
    const isLongNode = node[1].length > 14;
    if (isLongNode) {
      addText(slide, `${node[1]}\n${node[2]}`, x + 0.12, y + 0.42, boxW - 0.24, 0.94, {
        fontSize: 12,
        color: C.text,
        bold: true,
        align: 'center',
      });
    } else {
      addText(slide, node[1], x + 0.12, y + 0.52, boxW - 0.24, 0.42, {
        fontSize: 15.5,
        color: C.text,
        bold: true,
        align: 'center',
      });
      addText(slide, node[2], x + 0.12, y + 1.02, boxW - 0.24, 0.28, {
        fontSize: 11.5,
        color: C.muted,
        align: 'center',
      });
    }
    if (i < nodes.length - 1) {
      addLine(slide, x + boxW + 0.03, y + 0.76, gap - 0.06, 0, {
        color: C.cyan,
        width: 2.0,
        endArrowType: 'triangle',
      });
    }
  });

  addRect(slide, 1.31, 4.42, 10.72, 1.10, {
    fill: C.surface3,
    line: C.line,
    lineWidth: 1.2,
  });
  addText(slide, '可檢驗的節能主張', 1.57, 4.61, 2.40, 0.30, {
    fontSize: 15,
    color: C.cyanSoft,
    bold: true,
  });
  addText(slide, '每一段都有 receipt；動畫只能顯示，不能代替 evidence。', 4.06, 4.52, 7.58, 0.50, {
    fontSize: 20,
    color: C.text,
    bold: true,
  });
  addText(slide, 'TRANSFER → smart farm · HVAC · edge · logistics', 4.08, 5.07, 7.40, 0.24, {
    fontSize: 11,
    color: C.muted,
  });
  finishSlide(slide, spec);
}

function addComparisonHeader(slide, x, y, w, title, color) {
  addRect(slide, x, y, w, 0.60, {
    fill: color,
    transparency: 84,
    line: color,
    lineWidth: 1.25,
  });
  addText(slide, title, x + 0.18, y, w - 0.36, 0.60, {
    fontSize: 21,
    color,
    bold: true,
  });
}

function slide03(spec, index) {
  const slide = pptx.addSlide();
  addBrandFrame(slide, index);
  addTitle(slide, spec.title);

  const leftX = 0.68;
  const rightX = 6.86;
  const colW = 5.80;
  addRect(slide, leftX, 1.66, colW, 4.36, { fill: C.surface3, line: C.cyan, lineWidth: 1.4 });
  addRect(slide, rightX, 1.66, colW, 4.36, { fill: C.surface3, line: C.red, lineWidth: 1.4 });
  addComparisonHeader(slide, leftX + 0.16, 1.84, colW - 0.32, 'LoRaEnergySim 可觀察', C.cyan);
  addComparisonHeader(slide, rightX + 0.16, 1.84, colW - 0.32, '不能因此宣稱', C.red);

  const stateBars = [
    ['SLEEP', 0.42, C.green],
    ['IDLE / WAKE', 0.63, C.blue],
    ['PROCESS', 0.51, C.violet],
    ['TX / RX', 0.82, C.amber],
  ];
  stateBars.forEach((item, i) => {
    const y = 2.73 + i * 0.55;
    addText(slide, item[0], leftX + 0.32, y, 1.28, 0.28, { fontSize: 11.5, color: C.muted, bold: true });
    addRect(slide, leftX + 1.72, y + 0.02, 3.45, 0.22, {
      shape: pptx.ShapeType.rect,
      fill: C.surface2,
      line: C.surface2,
      lineWidth: 0,
    });
    addRect(slide, leftX + 1.72, y + 0.02, 3.45 * item[1], 0.22, {
      shape: pptx.ShapeType.rect,
      fill: item[2],
      line: item[2],
      lineWidth: 0,
    });
  });
  addText(slide, 'packet attempt · retry · delivered · expired', leftX + 0.34, 5.08, 5.10, 0.30, {
    fontSize: 13.5,
    color: C.text,
    bold: true,
    align: 'center',
  });
  addText(slide, 'queue · service · endpoint energy', leftX + 0.34, 5.45, 5.10, 0.25, {
    fontSize: 11.5,
    color: C.cyanSoft,
    align: 'center',
  });

  const prohibitions = [
    ['NOT LIVE / MEASURED', '課程輸出是 simulated teaching data'],
    ['NOT SYSTEM ENERGY', 'endpoint J ≠ canonical system consumed J'],
    ['ASSUMPTIONS SEPARATE', 'wrapper-added state 需另標示'],
  ];
  prohibitions.forEach((item, i) => {
    const y = 2.67 + i * 0.91;
    addCircle(slide, rightX + 0.36, y + 0.08, 0.34, { fill: C.red, transparency: 75, line: C.red });
    addText(slide, '×', rightX + 0.36, y + 0.06, 0.34, 0.34, { fontSize: 16, color: C.red, bold: true, align: 'center' });
    addText(slide, item[0], rightX + 0.86, y, 4.45, 0.33, { fontSize: 15, color: C.text, bold: true });
    addText(slide, item[1], rightX + 0.86, y + 0.35, 4.45, 0.27, { fontSize: 11.5, color: C.muted });
  });
  addRect(slide, rightX + 0.30, 5.27, colW - 0.60, 0.48, { fill: C.red, transparency: 86, line: C.red });
  addText(slide, '價值 = causal evidence；不是 claim escalation', rightX + 0.48, 5.27, colW - 0.96, 0.48, {
    fontSize: 13.2,
    color: C.red,
    bold: true,
    align: 'center',
  });
  finishSlide(slide, spec);
}

function drawSatellite(slide, x, y, scale = 1) {
  addRect(slide, x + 0.40 * scale, y + 0.22 * scale, 0.50 * scale, 0.34 * scale, {
    fill: C.amber,
    line: C.amber,
    lineWidth: 1,
  });
  addRect(slide, x, y + 0.12 * scale, 0.34 * scale, 0.52 * scale, {
    shape: pptx.ShapeType.rect,
    fill: C.blue,
    line: C.cyanSoft,
    lineWidth: 1,
  });
  addRect(slide, x + 0.96 * scale, y + 0.12 * scale, 0.34 * scale, 0.52 * scale, {
    shape: pptx.ShapeType.rect,
    fill: C.blue,
    line: C.cyanSoft,
    lineWidth: 1,
  });
  addLine(slide, x + 0.34 * scale, y + 0.38 * scale, 0.62 * scale, 0, { color: C.muted, width: 1.1 });
}

function slide04(spec, index) {
  const slide = pptx.addSlide();
  addBrandFrame(slide, index);
  addTitle(slide, spec.title, { accent: C.amber });

  addRect(slide, 0.72, 1.68, 11.90, 3.32, { fill: C.surface3, line: C.line, lineWidth: 1.1 });
  addLine(slide, 1.14, 3.32, 10.90, -0.55, { color: C.blue, width: 2.3, transparency: 12, endArrowType: 'triangle' });
  addLine(slide, 1.14, 3.48, 10.90, -0.55, { color: C.line, width: 1.0, dash: 'dash' });
  addRect(slide, 5.15, 1.98, 2.78, 2.51, {
    fill: C.cyan,
    transparency: 83,
    line: C.cyan,
    lineWidth: 1.7,
  });
  addText(slide, 'CHANGING\nSERVICE WINDOW', 5.47, 2.17, 2.16, 0.80, {
    fontSize: 17,
    color: C.cyanSoft,
    bold: true,
    align: 'center',
  });
  addText(slide, 'open → quality shifts → closes', 5.38, 3.71, 2.33, 0.33, {
    fontSize: 11.5,
    color: C.text,
    align: 'center',
  });
  addLine(slide, 5.15, 4.20, 0, 0.28, { color: C.cyan, width: 1.4 });
  addLine(slide, 7.93, 4.20, 0, 0.28, { color: C.cyan, width: 1.4 });
  addText(slide, 'OPEN', 4.62, 4.19, 0.48, 0.24, { fontSize: 8.5, color: C.cyanSoft, bold: true, align: 'right' });
  addText(slide, 'CLOSE', 7.98, 4.19, 0.56, 0.24, { fontSize: 8.5, color: C.cyanSoft, bold: true });
  drawSatellite(slide, 6.01, 3.03, 0.94);

  const choices = [
    ['現在送', 1.25, C.amber],
    ['等待', 3.05, C.blue],
    ['批次', 8.35, C.violet],
    ['休眠', 10.30, C.green],
  ];
  choices.forEach((choice) => {
    addCircle(slide, choice[1], 3.07, 0.62, { fill: choice[2], transparency: 74, line: choice[2] });
    addText(slide, choice[0], choice[1] - 0.20, 3.82, 1.02, 0.30, {
      fontSize: 11.5,
      color: choice[2],
      bold: true,
      align: 'center',
    });
  });
  addText(slide, 'LEO 只讓取捨更容易看見；它不是學習目標本身。', 1.18, 4.50, 10.90, 0.31, {
    fontSize: 17,
    color: C.text,
    bold: true,
    align: 'center',
  });

  const domains = ['SMART FARM', 'HVAC', 'EDGE', 'LOGISTICS'];
  domains.forEach((label, i) => {
    const x = 0.98 + i * 3.02;
    addRect(slide, x, 5.35, 2.46, 0.58, {
      fill: C.surface2,
      line: i === 0 ? C.green : i === 1 ? C.cyan : i === 2 ? C.violet : C.amber,
      lineWidth: 1.1,
    });
    addText(slide, label, x, 5.35, 2.46, 0.58, { fontSize: 13.5, color: C.text, bold: true, align: 'center' });
  });
  finishSlide(slide, spec);
}

function slide05(spec, index) {
  const slide = pptx.addSlide();
  addBrandFrame(slide, index);
  addTitle(slide, spec.title);

  addRect(slide, 1.15, 1.60, 11.02, 0.62, { fill: C.blue, transparency: 83, line: C.blue, lineWidth: 1.3 });
  addText(slide, 'SHARED ANCHOR · SAME SCENARIO · SAME TLE SOURCE · SAME CLOCK', 1.33, 1.60, 10.66, 0.62, {
    fontSize: 16,
    color: C.cyanSoft,
    bold: true,
    align: 'center',
  });

  const panels = [
    {
      x: 0.78, color: C.blue, eyebrow: 'SYSTEM LAYER', title: 'C120AuthoritativeReplay',
      fields: ['system power', 'consumed J', 'canonical bit/J'],
      scope: '沿用既有 C-120 authority',
    },
    {
      x: 7.13, color: C.cyan, eyebrow: 'ENDPOINT LAYER', title: 'C120LoraEndpointReplay',
      fields: ['policy · queue · packet', 'radio state', 'endpoint service + energy'],
      scope: '新增、範圍受限的 evidence',
    },
  ];
  panels.forEach((p) => {
    addLine(slide, 6.66, 2.23, p.x < 3 ? -3.0 : 3.0, 0.55, { color: p.color, width: 1.4, endArrowType: 'triangle' });
    addRect(slide, p.x, 2.65, 5.42, 2.87, { fill: C.surface3, line: p.color, lineWidth: 1.6, shadow: true });
    addText(slide, p.eyebrow, p.x + 0.26, 2.89, 2.0, 0.26, { fontSize: 10.5, color: p.color, bold: true });
    addText(slide, p.title, p.x + 0.26, 3.24, 4.87, 0.40, { fontSize: 19, color: C.text, bold: true });
    p.fields.forEach((field, i) => {
      addCircle(slide, p.x + 0.30, 3.82 + i * 0.43, 0.18, { fill: p.color, line: p.color });
      addText(slide, field, p.x + 0.65, 3.75 + i * 0.43, 4.42, 0.30, { fontSize: 14, color: C.muted });
    });
    addRect(slide, p.x + 0.26, 5.02, 4.87, 0.32, { fill: p.color, transparency: 87, line: p.color, lineWidth: 0.8 });
    addText(slide, p.scope, p.x + 0.38, 5.02, 4.63, 0.32, { fontSize: 11, color: p.color, bold: true, align: 'center' });
  });

  addRect(slide, 6.27, 3.14, 0.80, 1.58, { fill: C.red, transparency: 86, line: C.red, lineWidth: 1.3 });
  addText(slide, 'NO\nALIAS', 6.34, 3.31, 0.66, 0.62, { fontSize: 12.5, color: C.red, bold: true, align: 'center' });
  addText(slide, 'Jend\n≠\nJsys', 6.35, 4.02, 0.64, 0.53, { fontSize: 8.2, color: C.text, bold: true, align: 'center' });
  addText(slide, '共享時間軸；evidence scope 保持分離。', 2.10, 5.78, 9.12, 0.34, {
    fontSize: 18,
    color: C.cyanSoft,
    bold: true,
    align: 'center',
  });
  finishSlide(slide, spec);
}

function slide06(spec, index) {
  const slide = pptx.addSlide();
  addBrandFrame(slide, index);
  addTitle(slide, spec.title);

  const steps = [
    ['01', 'PREDICT', 'queue / service / state / J', C.blue],
    ['02', 'EDIT', 'marked region only', C.violet],
    ['03', 'RUN', 'deterministic JSON', C.amber],
    ['04', 'IMPORT', 'strict schema + identity', C.cyan],
    ['05', 'REPLAY', 'same scenario / same clock', C.green],
    ['06', 'WITHHELD + WORKBOOK', 'freeze policy · preserve receipts', C.red],
  ];
  const positions = [
    [0.78, 1.72], [4.75, 1.72], [8.72, 1.72],
    [8.72, 4.12], [4.75, 4.12], [0.78, 4.12],
  ];
  steps.forEach((step, i) => {
    const [x, y] = positions[i];
    addRect(slide, x, y, 3.24, 1.42, { fill: C.surface3, line: step[3], lineWidth: 1.5, shadow: true });
    addText(slide, step[0], x + 0.18, y + 0.17, 0.42, 0.27, { fontSize: 10.5, color: step[3], bold: true });
    addText(slide, step[1], x + 0.20, y + 0.53, 2.84, 0.38, { fontSize: 18, color: C.text, bold: true, align: 'center' });
    addText(slide, step[2], x + 0.20, y + 1.01, 2.84, 0.24, { fontSize: 10.5, color: C.muted, align: 'center' });
  });
  const connectors = [
    [4.09, 2.43, 0.55, 0], [8.06, 2.43, 0.55, 0], [10.34, 3.24, 0, 0.72],
    [8.64, 4.83, -0.55, 0], [4.67, 4.83, -0.55, 0], [2.40, 4.04, 0, -0.72],
  ];
  connectors.forEach((c) => addLine(slide, c[0], c[1], c[2], c[3], { color: C.cyanSoft, width: 2.0, endArrowType: 'triangle' }));

  addRect(slide, 4.16, 3.37, 5.02, 0.50, { fill: C.red, transparency: 87, line: C.red, lineWidth: 1.0 });
  addText(slide, 'BOUNDARY · student_policy.py marked region only', 4.39, 3.37, 4.56, 0.50, {
    fontSize: 13.2,
    color: C.red,
    bold: true,
    align: 'center',
  });
  finishSlide(slide, spec);
}

function slide07(spec, index) {
  const slide = pptx.addSlide();
  addBrandFrame(slide, index);
  addTitle(slide, spec.title, { accent: C.amber });

  const cards = [
    ['DO', '實際動作', '安裝／執行／改哪一行', C.blue],
    ['WHY', '必要理由', '它解開哪個學習 gate', C.violet],
    ['MECHANISM', '作用機制', '環境／policy／packet／state／energy', C.cyan],
    ['EXPECT', '事前預期', '哪一個 receipt 或 evidence 會變', C.amber],
    ['INTERPRET', '結果解讀', '符合、意外、失敗與最小 recovery', C.green],
  ];
  const cardW = 2.16;
  const gap = 0.32;
  cards.forEach((card, i) => {
    const x = 0.62 + i * (cardW + gap);
    addRect(slide, x, 1.68, cardW, 3.72, { fill: C.surface3, line: card[3], lineWidth: 1.5, shadow: true });
    addText(slide, String(i + 1).padStart(2, '0'), x + 0.18, 1.89, 0.42, 0.28, { fontSize: 10, color: card[3], bold: true });
    addText(slide, card[0], x + 0.18, 2.28, cardW - 0.36, 0.52, { fontSize: card[0].length > 7 ? 19 : 24, color: card[3], bold: true, align: 'center' });
    addLine(slide, x + 0.36, 2.97, cardW - 0.72, 0, { color: card[3], width: 1.0, transparency: 30 });
    addText(slide, card[1], x + 0.18, 3.22, cardW - 0.36, 0.34, { fontSize: 15, color: C.text, bold: true, align: 'center' });
    addText(slide, card[2], x + 0.24, 3.83, cardW - 0.48, 0.70, { fontSize: 12.3, color: C.muted, align: 'center', valign: 'mid' });
  });

  addRect(slide, 0.94, 5.72, 11.45, 0.48, { fill: C.amber, transparency: 84, line: C.amber, lineWidth: 1.2 });
  addText(slide, 'CURRENT EVIDENCE GAP — RELEASE URL / COMMAND / CASE / LINE NUMBERS NOT YET FROZEN', 1.14, 5.72, 11.05, 0.48, {
    fontSize: 12.2,
    color: C.amber,
    bold: true,
    align: 'center',
  });
  finishSlide(slide, spec);
}

function slide08(spec, index) {
  const slide = pptx.addSlide();
  addBrandFrame(slide, index);
  addTitle(slide, spec.title, { accent: C.green });

  const segments = [
    ['WHY', 5, C.blue],
    ['SETUP', 8, C.violet],
    ['MODEL', 8, C.cyan],
    ['ANCHOR', 8, C.blue],
    ['LAB A', 21, C.green],
    ['LAB B', 21, C.amber],
    ['REC', 5, C.red],
    ['LAB C', 23, C.cyan],
    ['CLINIC', 10, C.violet],
    ['TRANSFER', 11, C.green],
  ];
  const timelineX = 0.67;
  const timelineY = 2.04;
  const bandGap = 0.24;
  const pxPerMinute = (12.0 - bandGap * (segments.length - 1)) / 120;
  let cursor = timelineX;
  segments.forEach((seg, i) => {
    const width = seg[1] * pxPerMinute;
    addRect(slide, cursor, timelineY, width, 1.08, {
      shape: pptx.ShapeType.rect,
      fill: seg[2],
      transparency: 24,
      line: C.bg,
      lineWidth: 1.0,
    });
    const labelInset = width < 0.75 ? 0.04 : 0.10;
    addText(slide, `${seg[0]}\n${seg[1]}`, cursor + labelInset, timelineY + 0.08, width - labelInset * 2, 0.86, {
      fontSize: width < 0.75 ? 7.2 : width < 1.1 ? 10.2 : 13.5,
      color: C.white,
      bold: true,
      align: 'center',
    });
    cursor += width + (i < segments.length - 1 ? bandGap : 0);
  });
  addText(slide, '000', timelineX, 3.22, 0.48, 0.22, { fontSize: 8.7, color: C.muted });
  addText(slide, '120', timelineX + 11.52, 3.22, 0.48, 0.22, { fontSize: 8.7, color: C.muted, align: 'right' });

  const legend = [
    ['00', 'Why it matters', '5'], ['01', 'setup', '8'], ['02', 'model', '8'], ['03', 'anchor', '8'], ['04', 'Lab A', '21'],
    ['05', 'Lab B', '21'], ['06', 'recovery', '5'], ['07', 'Lab C', '23'], ['08', 'clinic', '10'], ['09', 'transfer', '11'],
  ];
  legend.forEach((item, i) => {
    const row = i < 5 ? 0 : 1;
    const col = i % 5;
    const x = 0.72 + col * 2.46;
    const y = 3.82 + row * 0.74;
    addText(slide, item[0], x, y, 0.34, 0.29, { fontSize: 9.5, color: C.cyanSoft, bold: true });
    addText(slide, item[1], x + 0.42, y, 1.43, 0.29, { fontSize: 11.5, color: C.text, bold: true });
    addText(slide, `${item[2]}m`, x + 1.87, y, 0.42, 0.29, { fontSize: 10.5, color: C.muted, align: 'right' });
  });

  addRect(slide, 1.47, 5.53, 10.39, 0.55, { fill: C.green, transparency: 87, line: C.green, lineWidth: 1.0 });
  addText(slide, 'setup 有 fallback；三個 causal labs 的 protected clock 不可被吃掉', 1.72, 5.53, 9.89, 0.55, {
    fontSize: 16.5,
    color: C.green,
    bold: true,
    align: 'center',
  });
  addText(slide, 'PROPOSED IN DRAFT SDD / OWNER REVIEW REQUIRED', 3.52, 6.12, 6.30, 0.23, {
    fontSize: 9.5,
    color: C.red,
    bold: true,
    align: 'center',
  });
  finishSlide(slide, spec);
}

function slide09(spec, index) {
  const slide = pptx.addSlide();
  addBrandFrame(slide, index, { hero: true });
  addTitle(slide, spec.title, { accent: C.red });

  const decisions = [
    ['01', '敘事', 'IoT endpoint first\nLEO = changing-window example', C.cyan],
    ['02', '視覺', 'dark evidence-lab\n大字 · 一頁一個主視覺', C.blue],
    ['03', '證據邊界', 'endpoint evidence\n≠ system / canonical evidence', C.amber],
    ['04', '模板路徑', '原生白底 fill？\n或 exact-brand dark adaptation？', C.violet],
  ];
  decisions.forEach((d, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = 0.84 + col * 6.00;
    const y = 1.72 + row * 1.78;
    addRect(slide, x, y, 5.55, 1.42, { fill: C.surface3, line: d[3], lineWidth: 1.5, shadow: true });
    addText(slide, d[0], x + 0.22, y + 0.18, 0.50, 0.28, { fontSize: 10.5, color: d[3], bold: true });
    addText(slide, d[1], x + 0.84, y + 0.17, 1.40, 0.38, { fontSize: 19, color: d[3], bold: true });
    addText(slide, d[2], x + 0.84, y + 0.62, 4.31, 0.58, { fontSize: 14.2, color: C.text, bold: true });
  });

  addRect(slide, 0.84, 5.52, 11.55, 0.65, { fill: C.red, transparency: 82, line: C.red, lineWidth: 1.4 });
  addText(slide, 'STOP AFTER CHECKPOINT', 1.15, 5.52, 3.26, 0.65, { fontSize: 20, color: C.red, bold: true, align: 'center' });
  addText(slide, 'OWNER: ______  ·  APPROVE / REVISE  ·  DATE: ______', 4.45, 5.57, 7.55, 0.28, {
    fontSize: 13.2,
    color: C.text,
    bold: true,
    align: 'center',
  });
  addText(slide, 'no final teaching pages · no commit · no push', 4.45, 5.88, 7.55, 0.20, {
    fontSize: 10.2,
    color: C.muted,
    bold: true,
    align: 'center',
  });
  finishSlide(slide, spec);
}

const builders = [slide01, slide02, slide03, slide04, slide05, slide06, slide07, slide08, slide09];
builders.forEach((builder, i) => builder(outline.slides[i], i + 1));

async function main() {
  await pptx.writeFile({ fileName: OUTPUT_PATH });
  console.log(`Wrote ${OUTPUT_PATH}`);
}

main().catch((error) => {
  console.error(error.stack || error.message || String(error));
  process.exit(1);
});
