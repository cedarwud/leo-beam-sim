"use strict";

const path = require("node:path");
const pptxgen = require("pptxgenjs");

const managedModuleRoot = process.env.PPTX_WRAP_MANAGED_MODULE_ROOT;
if (!managedModuleRoot || !path.isAbsolute(managedModuleRoot)) {
  throw new Error("build must run through the pptx-wrap managed runner");
}
const [masterPathArg, masterExportArg, outputPathArg] = process.argv.slice(2);
if (!masterPathArg || !masterExportArg || !outputPathArg) {
  throw new Error(
    "usage: build_donor_transplant_2slides.cjs MASTER.cjs EXPORT_NAME OUTPUT.pptx",
  );
}

const masterPath = path.resolve(masterPathArg);
const outputPath = path.resolve(outputPathArg);
const masterModule = require(masterPath);
const registerTemplate = masterModule[masterExportArg];
if (typeof registerTemplate !== "function") {
  throw new TypeError(`missing template export: ${masterExportArg}`);
}

const { assertFontSize, assertWithin, FONTS, TYPOGRAPHY } = masterModule;

// Owner explicitly released the author-text floor on 2026-08-10. The two-slide
// transplant still keeps the dominant learner-facing text at 16.5–32 pt; only
// compact chips and provenance/status text fall below the edu body floor.
const ALLOW_TEXT_BELOW_MINIMUM = true;

// Directly derived from the archived first Phase-0 deck. Large surfaces stay
// white; saturated color is reserved for small tags, strokes, and arrows.
const C = Object.freeze({
  navy: "0B132B",
  navy2: "14213D",
  ink: "17223B",
  sky: "28B8C7",
  steel: "536F87",
  green: "4EA978",
  violet: "9B79D0",
  tagFill: "E7E3F1",
  tagText: "4D4268",
  sourceFill: "DCEBF0",
  sourceText: "315F70",
  stageFill: "DDEAE2",
  stageText: "35604D",
  muted: "60708A",
  line: "C9D2D8",
  white: "FFFFFF",
  paleLine: "DCE3E8",
});

const EDU_CONTENT_NO_PLACEHOLDERS = "PPTX_WRAP_EDUCATE_CONTENT_NO_PLACEHOLDERS";

function masterImage(pathValue, x, y, w, h, altText) {
  return { image: { path: pathValue, x, y, w, h, altText } };
}

function masterLine(x, y, w, h, color, width) {
  return { line: { x, y, w, h, line: { color, width } } };
}

function registerNoPlaceholderContentMaster(pptx, template) {
  pptx.defineSlideMaster({
    title: EDU_CONTENT_NO_PLACEHOLDERS,
    objects: [
      masterImage(template.assets.field, 0, 0, 13.3333, 7.5, "White template field and decorative motif"),
      masterLine(0.465279, 0.276042, 0, 0.756944, template.colors.templateInk, 1.5),
      masterLine(0.229168, 0.857639, 12.875, 0, template.colors.templateInk, 1.5),
      masterLine(0.229168, 6.824653, 12.875, 0, template.colors.templateInk, 1.5),
      masterImage(template.assets.logo, 11.1667, 0, 2.1667, 0.3095, "Template programme logo"),
      masterImage(template.assets.divider, 0, 6.6858, 13.3333, 0.2364, "Template footer divider"),
    ],
  });
  return EDU_CONTENT_NO_PLACEHOLDERS;
}

function isCjk(char) {
  return /[\u3400-\u9FFF\uF900-\uFAFF\u3000-\u303F\uFF00-\uFFEF]/u.test(char);
}

function mixedRuns(text, options = {}) {
  const runs = [];
  let buffer = "";
  let lastFont = null;
  for (const char of String(text)) {
    const fontFace = isCjk(char) ? FONTS.cjk : FONTS.latin;
    if (lastFont !== null && fontFace !== lastFont) {
      runs.push({ text: buffer, options: { ...options, fontFace: lastFont } });
      buffer = "";
    }
    buffer += char;
    lastFont = fontFace;
  }
  if (buffer) {
    runs.push({ text: buffer, options: { ...options, fontFace: lastFont } });
  }
  return runs;
}

function titleBox(template, box, label) {
  return assertWithin(template.bounds.title, box, label);
}

function bodyBox(template, box, label) {
  return assertWithin(template.bounds.body, box, label);
}

function addText(slide, template, text, box, options = {}, label = "body text") {
  const role = options.role ?? "body";
  const fontSize = options.fontSize ?? TYPOGRAPHY.bodyPt;
  assertFontSize(role, fontSize, {
    allowBelowMinimum: role === "body" && ALLOW_TEXT_BELOW_MINIMUM,
  });
  const bounded = role === "title"
    ? titleBox(template, box, label)
    : bodyBox(template, box, label);
  slide.addText(mixedRuns(text), {
    ...bounded,
    fontSize,
    color: options.color ?? C.ink,
    bold: options.bold ?? false,
    align: options.align ?? "left",
    valign: options.valign ?? "mid",
    margin: options.margin ?? 0,
    breakLine: false,
    paraSpaceAfterPt: 0,
    isTextBox: true,
  });
}

function addPageNumber(slide, template, number) {
  slide.addText(String(number), {
    ...template.regions.slideNumber,
    fontFace: FONTS.latin,
    fontSize: 16,
    color: template.colors.templateInk,
    align: "right",
    valign: "mid",
    margin: 0,
    isTextBox: true,
  });
}

function addShape(slide, template, type, box, options, label = "body shape") {
  slide.addShape(type, {
    ...bodyBox(template, box, label),
    ...options,
  });
}

function addCard(slide, template, pptx, box, lineColor = C.line, lineWidth = 1.2, label = "card") {
  addShape(
    slide,
    template,
    pptx.ShapeType.roundRect,
    box,
    {
      fill: { color: C.white, transparency: 0 },
      line: { color: lineColor, width: lineWidth },
      radius: 0.08,
    },
    label,
  );
}

function addChip(slide, template, pptx, text, box, fill, color = C.white, options = {}, label = "chip") {
  addShape(
    slide,
    template,
    pptx.ShapeType.roundRect,
    box,
    {
      fill: { color: fill },
      line: { color: fill, transparency: 100 },
      radius: 0.06,
    },
    label,
  );
  addText(
    slide,
    template,
    text,
    { x: box.x + 0.08, y: box.y + 0.02, w: box.w - 0.16, h: box.h - 0.04 },
    {
      fontSize: options.fontSize ?? 16,
      color,
      bold: options.bold ?? true,
      align: options.align ?? "center",
      valign: "mid",
    },
    `${label} text`,
  );
}

function addArrow(slide, template, pptx, box, color = C.sky, width = 2, dashed = false, label = "arrow") {
  addShape(
    slide,
    template,
    pptx.ShapeType.line,
    box,
    {
      line: {
        color,
        width,
        dashType: dashed ? "dash" : "solid",
        beginArrowType: "none",
        endArrowType: "triangle",
      },
    },
    label,
  );
}

function addSatellite(slide, template, pptx, x, y, scale = 1) {
  const S = pptx.ShapeType;
  addShape(slide, template, S.rect, { x: x + 0.34 * scale, y: y + 0.14 * scale, w: 0.34 * scale, h: 0.24 * scale },
    { fill: { color: C.white }, line: { color: C.navy2, width: 1.5 } }, "satellite body");
  addShape(slide, template, S.rect, { x, y: y + 0.12 * scale, w: 0.3 * scale, h: 0.28 * scale },
    { fill: { color: C.steel }, line: { color: C.navy2, width: 1 } }, "satellite left panel");
  addShape(slide, template, S.rect, { x: x + 0.72 * scale, y: y + 0.12 * scale, w: 0.3 * scale, h: 0.28 * scale },
    { fill: { color: C.steel }, line: { color: C.navy2, width: 1 } }, "satellite right panel");
  addShape(slide, template, S.line, { x: x + 0.3 * scale, y: y + 0.26 * scale, w: 0.42 * scale, h: 0 },
    { line: { color: C.navy2, width: 1.4 } }, "satellite spar");
  addShape(slide, template, S.triangle, { x: x + 0.42 * scale, y: y + 0.42 * scale, w: 0.18 * scale, h: 0.18 * scale },
    { rotate: 180, fill: { color: C.steel, transparency: 12 }, line: { color: C.steel, transparency: 100 } }, "satellite sensor");
}

function addGround(slide, template, pptx, x, y, w) {
  const S = pptx.ShapeType;
  addShape(slide, template, S.line, { x, y, w, h: 0 }, { line: { color: C.navy2, width: 2.2 } }, "ground line");
  const bx = [0.06, 0.24, 0.46, 0.7, 0.83];
  const bw = [0.13, 0.16, 0.18, 0.10, 0.11];
  const bh = [0.18, 0.30, 0.22, 0.36, 0.26];
  for (let index = 0; index < bx.length; index += 1) {
    addShape(slide, template, S.rect,
      { x: x + bx[index] * w, y: y - bh[index], w: bw[index] * w, h: bh[index] },
      { fill: { color: C.navy2 }, line: { color: C.navy2, transparency: 100 } },
      `ground building ${index + 1}`);
  }
  addShape(slide, template, S.ellipse, { x: x + 0.63 * w, y: y - 0.5, w: 0.16, h: 0.16 },
    { fill: { color: C.steel }, line: { color: C.steel, transparency: 100 } }, "ground antenna");
  addShape(slide, template, S.line, { x: x + 0.71 * w, y: y - 0.42, w: 0, h: 0.42 },
    { line: { color: C.steel, width: 1.5 } }, "ground antenna mast");
  addText(slide, template, "NTPU", { x: x + 0.02, y: y + 0.04, w: 0.8, h: 0.2 },
    { fontSize: 16, color: C.navy2, bold: true }, "ground label");
}

function addStageRoute(slide, template, pptx, items, xStart, y, gap, labelPrefix) {
  let x = xStart;
  items.forEach((item, index) => {
    const minuteColor = item.minuteColor ?? (item.dashed ? C.violet : C.steel);
    const labelFontSize = item.fontSize ?? 16;
    addCard(slide, template, pptx, { x, y, w: item.w, h: 0.58 }, item.accent, item.dashed ? 2 : 1.25, `${labelPrefix} card ${index + 1}`);
    assertFontSize("body", 18, { allowBelowMinimum: ALLOW_TEXT_BELOW_MINIMUM });
    assertFontSize("body", labelFontSize, { allowBelowMinimum: ALLOW_TEXT_BELOW_MINIMUM });
    slide.addText([
      ...mixedRuns(item.minutes, { fontSize: 18, color: minuteColor, bold: true }),
      ...mixedRuns(` ${item.label}`, { fontSize: labelFontSize, color: C.ink, bold: true }),
    ], {
      ...bodyBox(template, { x: x + 0.06, y: y + 0.08, w: item.w - 0.12, h: 0.31 }, `${labelPrefix} centered content ${index + 1}`),
      align: "center",
      valign: "mid",
      margin: 0,
      breakLine: false,
      paraSpaceAfterPt: 0,
      isTextBox: true,
    });
    if (index < items.length - 1) {
      addArrow(slide, template, pptx, { x: x + item.w + 0.05, y: y + 0.29, w: gap - 0.10, h: 0 }, item.dashed ? C.violet : C.sky, 1.8, false, `${labelPrefix} arrow ${index + 1}`);
    }
    x += item.w + gap;
  });
}

function addTransplantSlide1(pptx, template, masterName) {
  const slide = pptx.addSlide({ masterName });
  const S = pptx.ShapeType;

  // No slide.background assignment: the edu white field remains authoritative.
  addText(slide, template, "C-120 LEO 能源決策課程｜Phase 0", template.bounds.title,
    { role: "title", fontSize: TYPOGRAPHY.titlePt, color: C.navy, bold: true, valign: "bottom" }, "slide-one title");
  addChip(slide, template, pptx, "WORKING TITLE · OWNER REVIEW", { x: 0.78, y: 1.05, w: 4.30, h: 0.38 }, C.tagFill, C.tagText, { fontSize: 16 }, "working-title chip");
  addText(slide, template, "軌跡會變，\n節能判斷也要會變", { x: 0.78, y: 1.45, w: 7.58, h: 0.96 },
    { fontSize: 33, color: C.navy, bold: true, valign: "top" }, "donor headline");
  addText(slide, template, "NTPU 低軌衛星情境 × 功率與時間 × 換手 × IoT × 競賽轉移", { x: 0.81, y: 2.51, w: 8.7, h: 0.24 },
    { fontSize: 18.5, color: C.muted, bold: true }, "donor subtitle");

  addShape(slide, template, S.arc, { x: 9.63, y: 1.12, w: 2.93, h: 1.52 },
    { adjustPoint: 0.28, rotate: 8, fill: { color: C.white, transparency: 100 }, line: { color: C.sky, width: 1.8 } }, "orbit arc");
  addSatellite(slide, template, pptx, 11.36, 1.19, 1.05);
  addGround(slide, template, pptx, 10.13, 2.17, 2.23);
  addCard(slide, template, pptx, { x: 9.66, y: 2.40, w: 3.07, h: 0.38 }, C.navy2, 1.2, "course identity badge");
  addText(slide, template, "能源決策實驗室｜非專家課", { x: 9.80, y: 2.45, w: 2.78, h: 0.24 },
    { fontSize: 16, color: C.navy, bold: true, align: "center" }, "course identity badge text");

  addText(slide, template, "90 分鐘核心", { x: 0.80, y: 2.98, w: 1.34, h: 0.27 },
    { fontSize: 16.8, color: C.navy, bold: true }, "90-minute route title");
  addText(slide, template, "E3 整段移除", { x: 0.80, y: 3.27, w: 1.48, h: 0.24 },
    { fontSize: 16, color: C.tagText, bold: true }, "90-minute route note");
  const core = [
    { minutes: "10", label: "TLE→NTPU", w: 1.78, accent: C.sky, fontSize: 16 },
    { minutes: "22", label: "E1", w: 1.34, accent: C.sky },
    { minutes: "22", label: "E2", w: 1.34, accent: C.sky },
    { minutes: "18", label: "IoT 挑戰", w: 1.56, accent: C.navy2 },
    { minutes: "12", label: "競賽轉移", w: 1.56, accent: C.navy2 },
    { minutes: "6", label: "提取／緩衝", w: 1.65, accent: C.navy2, fontSize: 16 },
  ];
  addStageRoute(slide, template, pptx, core, 2.24, 2.93, 0.27, "90-minute route");
  addText(slide, template, "10 + 22 + 22 + 18 + 12 + 6 = 90", { x: 2.24, y: 3.55, w: 9.9, h: 0.25 },
    { fontSize: 17.5, color: C.steel, bold: true, align: "center" }, "90-minute equation");

  addText(slide, template, "120 分鐘路線", { x: 0.80, y: 4.01, w: 1.48, h: 0.27 },
    { fontSize: 16, color: C.navy, bold: true }, "120-minute route title");
  addText(slide, template, "可拔除保留段", { x: 0.80, y: 4.30, w: 1.42, h: 0.24 },
    { fontSize: 16, color: C.tagText, bold: true }, "120-minute route note");
  const extended = [
    { minutes: "10", label: "TLE", w: 1.05, accent: C.sky },
    { minutes: "22", label: "E1", w: 1.05, accent: C.sky },
    { minutes: "22", label: "E2", w: 1.05, accent: C.sky },
    { minutes: "30", label: "E3｜條件式", w: 1.80, accent: C.violet, minuteColor: C.tagText, dashed: true, fontSize: 16 },
    { minutes: "18", label: "IoT", w: 1.07, accent: C.green },
    { minutes: "12", label: "轉移", w: 1.12, accent: C.green },
    { minutes: "6", label: "收束", w: 1.09, accent: C.green },
  ];
  addStageRoute(slide, template, pptx, extended, 2.34, 3.96, 0.24, "120-minute route");
  addText(slide, template, "10 + 22 + 22 + 30 + 18 + 12 + 6 = 120", { x: 2.34, y: 4.59, w: 9.8, h: 0.25 },
    { fontSize: 17.5, color: C.tagText, bold: true, align: "center" }, "120-minute equation");

  addCard(slide, template, pptx, { x: 0.80, y: 5.10, w: 11.93, h: 1.17 }, C.navy2, 1.35, "shared-reading backbone");
  addText(slide, template, "共同判讀骨架", { x: 0.98, y: 5.31, w: 1.64, h: 0.27 },
    { fontSize: 17.5, color: C.steel, bold: true }, "shared-reading backbone label");
  const labels = [
    ["W", "當下功率", C.ink],
    ["時間", "累積多久", C.ink],
    ["J", "總能源", C.ink],
    ["服務", "是否合格", C.green],
    ["bit/J", "合格邊界\n內的效率", C.ink],
  ];
  let lx = 2.72;
  labels.forEach(([term, note, color], index) => {
    addText(slide, template, term, { x: lx, y: 5.27, w: 0.92, h: 0.3 },
      { fontSize: 22, color, bold: true, align: "center" }, `backbone term ${index + 1}`);
    const noteIsTwoLines = note.includes("\n");
    addText(slide, template, note, {
      x: lx - 0.18,
      y: noteIsTwoLines ? 5.62 : 5.72,
      w: 1.28,
      h: noteIsTwoLines ? 0.44 : 0.24,
    },
    { fontSize: 16, color: C.muted, bold: true, align: "center" }, `backbone note ${index + 1}`);
    if (index < labels.length - 1) {
      addArrow(slide, template, pptx, { x: lx + 1.08, y: 5.53, w: 0.44, h: 0 }, C.sky, 1.8, false, `backbone arrow ${index + 1}`);
    }
    lx += 2.02;
  });
  addText(slide, template, "STYLE STUDY｜DONOR", { x: 0.82, y: 6.31, w: 3.8, h: 0.26 },
    { fontSize: 16, color: C.muted, bold: true }, "slide-one style-only marker");
  addText(slide, template, "模擬教學｜非即時｜非量測｜未驗證 parity", { x: 8.02, y: 6.31, w: 4.64, h: 0.26 },
    { fontSize: 16, color: C.muted, bold: true, align: "right" }, "slide-one claim marker");
  addPageNumber(slide, template, 1);

  return slide;
}

function addTransplantSlide2(pptx, template, masterName) {
  const slide = pptx.addSlide({ masterName });

  addText(slide, template, "TLE-to-NTPU｜先知道場景從哪裡來", template.bounds.title,
    { role: "title", fontSize: TYPOGRAPHY.titlePt, color: C.navy, bold: true, valign: "bottom" }, "slide-two title");

  addChip(slide, template, pptx, "STAGE 1", { x: 0.78, y: 1.05, w: 1.28, h: 0.38 }, C.stageFill, C.stageText, { fontSize: 16 }, "stage-one chip");
  addText(slide, template, "核心問題", { x: 2.18, y: 1.07, w: 1.08, h: 0.27 },
    { fontSize: 16.5, color: C.tagText, bold: true }, "core-question label");
  addText(slide, template, "一筆精簡軌道資料，如何成為眼前可用的 NTPU 衛星場景？", { x: 3.16, y: 1.05, w: 8.38, h: 0.38 },
    { fontSize: 22.5, color: C.navy, bold: true }, "core question");
  addCard(slide, template, pptx, { x: 11.77, y: 1.06, w: 1.11, h: 0.34 }, C.paleLine, 1, "time chip");
  addText(slide, template, "00–10", { x: 11.85, y: 1.11, w: 0.95, h: 0.20 },
    { fontSize: 16, color: C.navy, bold: true, align: "center" }, "time chip text");
  addText(slide, template, "QUESTION  →  ACTION  →  EVIDENCE  →  MEANING  →  RECOVERY / STATUS",
    { x: 0.82, y: 1.48, w: 10.24, h: 0.22 },
    { fontSize: 16, color: C.muted, bold: true }, "decision chain");
  addShape(slide, template, pptx.ShapeType.line, { x: 0.82, y: 1.72, w: 12.00, h: 0 },
    { line: { color: C.paleLine, width: 1.1 } }, "decision-chain divider");

  const nodes = [
    { key: "SOURCE", title: "固定 TLE", note: "讀來源與 epoch", accent: C.sky, chipFill: C.sourceFill, chipText: C.sourceText, chipW: 1.45 },
    { key: "MODEL-DERIVED", title: "位置／相對幾何", note: "友善輸出＋單位", accent: C.steel, chipW: 2.30 },
    { key: "COURSE ASSUMPTION", title: "波束／流量／任務", note: "後續才加入", accent: C.violet, chipW: 2.36, chipY: 1.96, chipH: 0.58, titleY: 2.61, noteY: 3.00 },
    { key: "NTPU SCENE", title: "同一 scenario", note: "版本化場景起點", accent: C.green, chipW: 1.88 },
  ];
  const xs = [0.78, 3.90, 7.02, 10.14];
  nodes.forEach((node, index) => {
    const x = xs[index];
    const chipY = node.chipY ?? 2.03;
    const chipH = node.chipH ?? 0.42;
    addCard(slide, template, pptx, { x, y: 1.88, w: 2.72, h: 1.40 }, node.accent, 1.35, `lineage node ${index + 1}`);
    addChip(slide, template, pptx, node.key, { x: x + (2.72 - node.chipW) / 2, y: chipY, w: node.chipW, h: chipH }, node.chipFill ?? node.accent, node.chipText ?? C.white,
      { fontSize: 16 }, `lineage node chip ${index + 1}`);
    addText(slide, template, node.title, { x: x + 0.14, y: node.titleY ?? 2.54, w: 2.44, h: 0.32 },
      { fontSize: 21, color: C.navy, bold: true, align: "center" }, `lineage node title ${index + 1}`);
    addText(slide, template, node.note, { x: x + 0.14, y: node.noteY ?? 2.93, w: 2.44, h: 0.25 },
      { fontSize: 16.2, color: C.muted, bold: true, align: "center" }, `lineage node note ${index + 1}`);
    if (index < nodes.length - 1) {
      addArrow(slide, template, pptx, { x: x + 2.77, y: 2.58, w: 0.28, h: 0 }, C.sky, 2, false, `lineage arrow ${index + 1}`);
    }
  });

  addText(slide, template, "學員動作", { x: 0.82, y: 3.49, w: 1.08, h: 0.27 },
    { fontSize: 16.5, color: C.tagText, bold: true }, "learner-action label");
  addText(slide, template, "匯入 → 分類來源／推導／假設 → 指定 UTC → 逐站查看 → 生成同一個 NTPU scenario",
    { x: 1.96, y: 3.43, w: 10.65, h: 0.39 },
    { fontSize: 18.5, color: C.navy, bold: true }, "learner action");

  addCard(slide, template, pptx, { x: 0.78, y: 3.97, w: 5.98, h: 0.91 }, C.line, 1.15, "observable-result card");
  addChip(slide, template, pptx, "可觀察結果", { x: 0.98, y: 4.14, w: 1.66, h: 0.38 }, C.tagFill, C.tagText, { fontSize: 16 }, "observable-result chip");
  addText(slide, template, "每站呈現 input、output 與單位；\n最終使用同一 scenario。",
    { x: 2.82, y: 4.08, w: 3.69, h: 0.62 },
    { fontSize: 16.5, color: C.navy, bold: true }, "observable result");

  addCard(slide, template, pptx, { x: 6.91, y: 3.97, w: 5.91, h: 0.91 }, C.line, 1.15, "architecture-boundary card");
  addChip(slide, template, pptx, "架構界線", { x: 7.11, y: 4.14, w: 1.45, h: 0.38 }, C.steel, C.white, { fontSize: 16 }, "architecture-boundary chip");
  addText(slide, template, "TLE 不含波束、流量、功率或能源；這一段建立可信起點，不算節能證據。",
    { x: 8.72, y: 4.08, w: 3.85, h: 0.62 },
    { fontSize: 16.7, color: C.navy, bold: true }, "architecture boundary");

  addCard(slide, template, pptx, { x: 0.78, y: 5.08, w: 7.48, h: 1.13 }, C.line, 1.15, "meaning card");
  addChip(slide, template, pptx, "能源／競賽意義", { x: 0.98, y: 5.26, w: 2.04, h: 0.38 }, C.stageFill, C.stageText, { fontSize: 16 }, "meaning chip");
  addText(slide, template, "先分清資料來源與課程假設，後續能源判斷\n才不會對著無來源動畫猜答案。",
    { x: 3.20, y: 5.22, w: 4.77, h: 0.62 },
    { fontSize: 16.8, color: C.navy, bold: true }, "energy and competition meaning");

  addCard(slide, template, pptx, { x: 8.43, y: 5.08, w: 4.39, h: 1.13 }, C.line, 1.15, "recovery card");
  addChip(slide, template, pptx, "復原／狀態", { x: 8.63, y: 5.26, w: 1.62, h: 0.38 }, C.stageFill, C.stageText, { fontSize: 16 }, "recovery chip");
  addText(slide, template, "續接末站／\n載入 fallback",
    { x: 10.42, y: 5.18, w: 2.16, h: 0.48 },
    { fontSize: 16, color: C.navy, bold: true }, "recovery text");
  addText(slide, template, "狀態：未驗證",
    { x: 10.42, y: 5.74, w: 2.16, h: 0.25 },
    { fontSize: 16, color: C.muted, bold: true }, "recovery status");

  addText(slide, template, "STYLE STUDY｜DONOR", { x: 0.82, y: 6.31, w: 3.8, h: 0.26 },
    { fontSize: 16, color: C.muted, bold: true }, "slide-two style-only marker");
  addText(slide, template, "模擬教學｜非即時｜非量測｜未驗證 parity", { x: 8.02, y: 6.31, w: 4.64, h: 0.26 },
    { fontSize: 16, color: C.muted, bold: true, align: "right" }, "slide-two claim marker");
  addPageNumber(slide, template, 2);

  return slide;
}

async function main() {
  // Resolve the selected edu contract in an isolated instance. The output
  // presentation then carries only the one no-placeholder master it uses,
  // instead of serializing the unused title/content layouts as well.
  const contractPptx = new pptxgen();
  contractPptx.layout = "LAYOUT_WIDE";
  const template = registerTemplate(contractPptx);
  if (!template || !template.masters || !template.bounds) {
    throw new Error("template did not return the required authoring contract exports");
  }
  if (template.typography.minimumTitlePt !== 28 || template.typography.minimumBodyPt !== 24) {
    throw new Error("unexpected edu typography floor");
  }

  const pptx = new pptxgen();
  pptx.author = "C-120 two-slide donor transplant checkpoint";
  pptx.company = "C-120 course planning";
  pptx.subject = "Archived Phase-0 visual donor transplanted into the edu frame";
  pptx.title = "LEO energy course donor transplant — two-slide style study";
  pptx.lang = "zh-TW";
  pptx.theme = {
    headFontFace: FONTS.cjk,
    bodyFontFace: FONTS.cjk,
    lang: "zh-TW",
  };
  pptx.layout = "LAYOUT_WIDE";

  const authorMasterName = registerNoPlaceholderContentMaster(pptx, template);
  addTransplantSlide1(pptx, template, authorMasterName);
  addTransplantSlide2(pptx, template, authorMasterName);
  if (pptx.slides.length !== 2) {
    throw new Error(`expected 2 slides, got ${pptx.slides.length}`);
  }

  await pptx.writeFile({ fileName: outputPath });
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : String(error));
  process.exitCode = 1;
});
