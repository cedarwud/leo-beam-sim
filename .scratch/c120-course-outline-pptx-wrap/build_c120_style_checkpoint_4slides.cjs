"use strict";

const path = require("node:path");
const fs = require("node:fs/promises");
const pptxgen = require("pptxgenjs");

const managedModuleRoot = process.env.PPTX_WRAP_MANAGED_MODULE_ROOT;
if (!managedModuleRoot || !path.isAbsolute(managedModuleRoot)) {
  throw new Error("build must run through the pptx-wrap managed runner");
}
const [masterPathArg, masterExportArg, outputPathArg] = process.argv.slice(2);
if (!masterPathArg || !masterExportArg || !outputPathArg) {
  throw new Error(
    "usage: build_c120_style_checkpoint_4slides.cjs MASTER.cjs EXPORT_NAME OUTPUT.pptx",
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

// Owner explicitly released the author-text floor on 2026-08-10. The four-slide
// checkpoint still keeps the dominant learner-facing text at 16–32 pt; only
// compact chips and provenance/status text fall below the edu body floor.
const ALLOW_TEXT_BELOW_MINIMUM = true;

// Palette selected through ui-ux-pro-max's Language Learning App result, then
// adapted to the accepted donor geometry. White remains the dominant surface;
// indigo carries the decision flow, periwinkle marks conditional/secondary
// structure, green is reserved for service/evidence, and red only marks an
// invalid or unavailable state. No bright orange or dark presentation panels.
const C = Object.freeze({
  navy: "312E81",
  navy2: "312E81",
  ink: "0F172A",
  sky: "4F46E5",
  steel: "64748B",
  green: "16A34A",
  violet: "818CF8",
  violetStrong: "6557C8",
  coral: "DC2626",
  tagFill: "EBEEF8",
  tagText: "312E81",
  sourceFill: "EBEEF8",
  sourceText: "312E81",
  stageFill: "EBEEF8",
  stageText: "312E81",
  roseFill: "FFFFFF",
  roseText: "DC2626",
  grayFill: "EBEEF8",
  grayText: "64748B",
  muted: "64748B",
  line: "C7D2FE",
  white: "FFFFFF",
  paleLine: "C7D2FE",
});

const EDU_CONTENT_NO_PLACEHOLDERS = "PPTX_WRAP_EDUCATE_CONTENT_NO_PLACEHOLDERS";

async function normalizePresentationElementOrder(filePath) {
  // PptxGenJS 4.0.1 serializes notesMasterIdLst after sldIdLst. The ECMA
  // presentation schema requires notesMasterIdLst first; PowerPoint may show a
  // repair prompt for the out-of-order package even though LibreOffice renders
  // it. Keep the managed authoring runtime, then make this one deterministic
  // OOXML ordering repair before delivery.
  const JSZip = require(path.join(managedModuleRoot, "jszip"));
  const archive = await JSZip.loadAsync(await fs.readFile(filePath));
  const entry = archive.file("ppt/presentation.xml");
  if (!entry) throw new Error("missing ppt/presentation.xml");
  const xml = await entry.async("string");
  const slideListMatch = xml.match(/<p:sldIdLst>[\s\S]*?<\/p:sldIdLst>/);
  const notesListMatch = xml.match(/<p:notesMasterIdLst>[\s\S]*?<\/p:notesMasterIdLst>/);
  if (!slideListMatch || !notesListMatch) {
    throw new Error("cannot locate slide/notes master lists for OOXML normalization");
  }
  const slideList = slideListMatch[0];
  const notesList = notesListMatch[0];
  const slideIndex = xml.indexOf(slideList);
  const notesIndex = xml.indexOf(notesList);
  let normalizedXml = xml;
  if (slideIndex < notesIndex) {
    normalizedXml = xml.replace(`${slideList}${notesList}`, `${notesList}${slideList}`);
    if (normalizedXml === xml) {
      throw new Error("slide/notes master lists were not adjacent as expected");
    }
  }
  archive.file("ppt/presentation.xml", normalizedXml);
  const normalizedPackage = await archive.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });
  await fs.writeFile(filePath, normalizedPackage);
}

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

function addFilledBox(slide, template, pptx, box, fill, lineColor = fill, lineWidth = 1, label = "filled box") {
  addShape(
    slide,
    template,
    pptx.ShapeType.roundRect,
    box,
    {
      fill: { color: fill },
      line: { color: lineColor, width: lineWidth },
      radius: 0.06,
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

function addOutlineChip(slide, template, pptx, text, box, accent, options = {}, label = "outline chip") {
  addShape(
    slide,
    template,
    pptx.ShapeType.roundRect,
    box,
    {
      fill: { color: C.white },
      line: { color: accent, width: options.lineWidth ?? 1.4, dashType: options.dashed ? "dash" : "solid" },
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
      color: options.color ?? C.navy,
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
    const routeBox = { x, y, w: item.w, h: 0.58 };
    addCard(slide, template, pptx, routeBox, item.accent, item.dashed ? 2 : 1.25,
      `${labelPrefix} card ${index + 1}`);
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
    { key: "SOURCE", title: "固定 TLE", note: "讀來源與 epoch", accent: C.steel, chipFill: C.sourceFill, chipText: C.sourceText, chipW: 1.45 },
    { key: "MODEL-DERIVED", title: "位置／相對幾何", note: "友善輸出＋單位", accent: C.sky, chipW: 2.30, chipOutline: true },
    { key: "COURSE ASSUMPTION", title: "波束／流量／任務", note: "後續才加入", accent: C.violet, chipW: 2.36, chipY: 1.96, chipH: 0.58, titleY: 2.61, noteY: 3.00, chipOutline: true },
    { key: "NTPU SCENE", title: "同一 scenario", note: "版本化場景起點", accent: C.green, chipW: 1.88, chipOutline: true },
  ];
  const xs = [0.78, 3.90, 7.02, 10.14];
  nodes.forEach((node, index) => {
    const x = xs[index];
    const chipY = node.chipY ?? 2.03;
    const chipH = node.chipH ?? 0.42;
    addCard(slide, template, pptx, { x, y: 1.88, w: 2.72, h: 1.40 }, node.accent, 1.35, `lineage node ${index + 1}`);
    const nodeChipBox = { x: x + (2.72 - node.chipW) / 2, y: chipY, w: node.chipW, h: chipH };
    if (node.chipOutline) {
      addOutlineChip(slide, template, pptx, node.key, nodeChipBox, node.accent,
        { fontSize: 16, color: index === 3 ? C.green : C.navy, lineWidth: 1.35 }, `lineage node chip ${index + 1}`);
    } else {
      addChip(slide, template, pptx, node.key, nodeChipBox, node.chipFill ?? node.accent,
        node.chipText ?? C.white, { fontSize: 16 }, `lineage node chip ${index + 1}`);
    }
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
  addChip(slide, template, pptx, "可觀察結果", { x: 0.98, y: 4.14, w: 1.66, h: 0.38 }, C.tagFill, C.tagText,
    { fontSize: 16 }, "observable-result chip");
  addText(slide, template, "每站呈現 input、output 與單位；\n最終使用同一 scenario。",
    { x: 2.82, y: 4.08, w: 3.69, h: 0.62 },
    { fontSize: 16.5, color: C.navy, bold: true }, "observable result");

  addCard(slide, template, pptx, { x: 6.91, y: 3.97, w: 5.91, h: 0.91 }, C.line, 1.15, "architecture-boundary card");
  addOutlineChip(slide, template, pptx, "架構界線", { x: 7.11, y: 4.14, w: 1.45, h: 0.38 }, C.sky,
    { fontSize: 16, color: C.navy, lineWidth: 1.25 }, "architecture-boundary chip");
  addText(slide, template, "TLE 不含波束、流量、功率或能源；這一段建立可信起點，不算節能證據。",
    { x: 8.72, y: 4.08, w: 3.85, h: 0.62 },
    { fontSize: 16.7, color: C.navy, bold: true }, "architecture boundary");

  addCard(slide, template, pptx, { x: 0.78, y: 5.08, w: 7.48, h: 1.13 }, C.line, 1.15, "meaning card");
  addChip(slide, template, pptx, "能源／競賽意義", { x: 0.98, y: 5.26, w: 2.04, h: 0.38 }, C.stageFill, C.stageText,
    { fontSize: 16 }, "meaning chip");
  addText(slide, template, "先分清資料來源與課程假設，後續能源判斷\n才不會對著無來源動畫猜答案。",
    { x: 3.20, y: 5.22, w: 4.77, h: 0.62 },
    { fontSize: 16.8, color: C.navy, bold: true }, "energy and competition meaning");

  addCard(slide, template, pptx, { x: 8.43, y: 5.08, w: 4.39, h: 1.13 }, C.line, 1.15, "recovery card");
  addChip(slide, template, pptx, "復原／狀態", { x: 8.63, y: 5.26, w: 1.62, h: 0.38 }, C.stageFill, C.stageText,
    { fontSize: 16 }, "recovery chip");
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

function addLabCStyleStressSlide(pptx, template, masterName) {
  const slide = pptx.addSlide({ masterName });
  const S = pptx.ShapeType;

  addText(slide, template, "Lab C｜把焦耳花在值得的服務上", template.bounds.title,
    { role: "title", fontSize: TYPOGRAPHY.titlePt, color: C.navy, bold: true, valign: "bottom" }, "slide-three title");

  addChip(slide, template, pptx, "LAB C · 69–92", { x: 0.78, y: 1.05, w: 1.63, h: 0.38 }, C.stageFill, C.stageText,
    { fontSize: 16 }, "slide-three stage chip");
  addText(slide, template, "主問題", { x: 2.60, y: 1.07, w: 0.86, h: 0.27 },
    { fontSize: 16.5, color: C.tagText, bold: true }, "slide-three question label");
  addText(slide, template, "有限 J budget 與短窗口下，資料何時送、batch、wait 或 sleep？",
    { x: 3.48, y: 1.05, w: 9.24, h: 0.40 },
    { fontSize: 20.5, color: C.navy, bold: true }, "slide-three question");

  addCard(slide, template, pptx, { x: 0.78, y: 1.66, w: 8.20, h: 2.62 }, C.sky, 1.45, "mission board card");
  addChip(slide, template, pptx, "六格任務板", { x: 0.98, y: 1.83, w: 2.10, h: 0.38 }, C.tagFill, C.tagText,
    { fontSize: 16 }, "mission board chip");
  addText(slide, template, "模擬教學資料｜非即時｜非量測｜parity 未驗證", { x: 3.26, y: 1.88, w: 5.42, h: 0.22 },
    { fontSize: 16, color: C.muted, bold: true, align: "right" }, "mission board status");

  const missionTickets = [
    { text: "URGENT｜deadline", x: 1.08, w: 2.05, accent: C.coral },
    { text: "PERIODIC｜freshness", x: 3.38, w: 2.22, accent: C.green },
    { text: "BULK｜大量", x: 5.86, w: 1.82, accent: C.violet },
  ];
  missionTickets.forEach((ticket, index) => {
    addShape(slide, template, S.ellipse, { x: ticket.x, y: 2.43, w: 0.18, h: 0.18 },
      { fill: { color: ticket.accent }, line: { color: ticket.accent, transparency: 100 } }, `mission ticket signal ${index + 1}`);
    addText(slide, template, ticket.text, { x: ticket.x + 0.28, y: 2.34, w: ticket.w, h: 0.34 },
      { fontSize: 16.5, color: C.navy, bold: true }, `mission ticket text ${index + 1}`);
  });

  const schedule = ["固定\n窗口", "SEND", "BATCH", "WAIT", "SLEEP", "固定\n窗口"];
  const slotStart = 1.02;
  const slotWidth = 1.12;
  const slotGap = 0.18;
  schedule.forEach((labelText, index) => {
    const x = slotStart + index * (slotWidth + slotGap);
    const fixed = index === 0 || index === schedule.length - 1;
    addFilledBox(slide, template, pptx, { x, y: 3.13, w: slotWidth, h: 0.66 },
      fixed ? C.grayFill : C.white, fixed ? C.line : C.sky, fixed ? 1 : 1.45, `mission slot ${index + 1}`);
    addText(slide, template, labelText, { x: x + 0.05, y: 3.23, w: slotWidth - 0.10, h: 0.42 },
      { fontSize: 16.5, color: fixed ? C.grayText : C.navy, bold: true, align: "center" }, `mission slot label ${index + 1}`);
    if (index < schedule.length - 1) {
      addArrow(slide, template, pptx, { x: x + slotWidth + 0.03, y: 3.46, w: slotGap - 0.06, h: 0 },
        C.sky, 1.4, false, `mission slot arrow ${index + 1}`);
    }
  });
  addText(slide, template, "學生只改中間四格；這條排程直接成為 actual timeline input", { x: 1.04, y: 3.91, w: 7.64, h: 0.25 },
    { fontSize: 17, color: C.navy, bold: true, align: "center" }, "schedule action meaning");

  addCard(slide, template, pptx, { x: 9.18, y: 1.66, w: 3.64, h: 2.62 }, C.sky, 1.45, "lab decision loop card");
  addChip(slide, template, pptx, "一次修訂，之後凍結", { x: 9.39, y: 1.83, w: 3.22, h: 0.38 }, C.tagFill, C.tagText,
    { fontSize: 16 }, "lab decision loop chip");
  const loopSteps = [
    { n: "1", text: "預測 baseline", y: 2.34 },
    { n: "2", text: "安排＋RUN", y: 2.82 },
    { n: "3", text: "只修一次", y: 3.30 },
  ];
  loopSteps.forEach((step, index) => {
    addText(slide, template, step.n, { x: 9.55, y: step.y, w: 0.34, h: 0.32 },
      { fontSize: 18, color: C.sky, bold: true, align: "center" }, `lab decision number ${index + 1}`);
    addText(slide, template, step.text, { x: 9.98, y: step.y, w: 2.20, h: 0.32 },
      { fontSize: 17.2, color: C.navy, bold: true }, `lab decision step ${index + 1}`);
    if (index < loopSteps.length - 1) {
      addShape(slide, template, S.line, { x: 9.56, y: step.y + 0.39, w: 2.62, h: 0 },
        { line: { color: C.line, width: 1 } }, `lab decision divider ${index + 1}`);
    }
  });
  addOutlineChip(slide, template, pptx, "4｜FREEZE → withheld", { x: 9.52, y: 3.75, w: 2.76, h: 0.43 }, C.coral,
    { fontSize: 16.5, color: C.coral, lineWidth: 1.45 }, "lab decision freeze gate");

  addCard(slide, template, pptx, { x: 0.78, y: 4.46, w: 12.04, h: 0.91 }, C.line, 1.15, "lab evidence ledger");
  addShape(slide, template, S.line, { x: 4.88, y: 4.58, w: 0, h: 0.67 },
    { line: { color: C.line, width: 1 } }, "lab evidence divider one");
  addShape(slide, template, S.line, { x: 8.48, y: 4.58, w: 0, h: 0.67 },
    { line: { color: C.line, width: 1 } }, "lab evidence divider two");
  const evidenceCards = [
    { x: 0.98, label: "服務", labelW: 0.74, accent: C.green, textX: 1.86, textW: 2.82,
      text: "service_pass · deadline\nfreshness · received time" },
    { x: 5.08, label: "能源", labelW: 0.74, accent: C.sky, textX: 5.96, textW: 2.31,
      text: "W → cumulative J\nbudget remaining" },
    { x: 8.68, label: "效率", labelW: 0.74, accent: C.violetStrong, textX: 9.56, textW: 3.02,
      text: "delivered bits · canonical bit/J\n不另造 ratio" },
  ];
  evidenceCards.forEach((item, index) => {
    addText(slide, template, item.label, { x: item.x, y: 4.65, w: item.labelW, h: 0.30 },
      { fontSize: 17.5, color: item.accent, bold: true, align: "center" }, `lab evidence label ${index + 1}`);
    addText(slide, template, item.text, { x: item.textX, y: 4.54, w: item.textW, h: 0.64 },
      { fontSize: 16.5, color: C.navy, bold: true }, `lab evidence text ${index + 1}`);
  });

  addCard(slide, template, pptx, { x: 0.78, y: 5.49, w: 7.42, h: 0.77 }, C.coral, 1.35, "lab meaning card");
  addText(slide, template, "判讀", { x: 0.98, y: 5.65, w: 1.05, h: 0.30 },
    { fontSize: 17.5, color: C.coral, bold: true, align: "center" }, "lab meaning label");
  addText(slide, template, "urgent miss 即使 bit/J 上升，\n仍不能宣稱 mission winner。",
    { x: 2.25, y: 5.55, w: 5.67, h: 0.54 },
    { fontSize: 18, color: C.navy, bold: true }, "lab meaning text");

  addCard(slide, template, pptx, { x: 8.39, y: 5.49, w: 4.43, h: 0.77 }, C.green, 1.35, "lab recovery card");
  addText(slide, template, "復原", { x: 8.59, y: 5.64, w: 1.10, h: 0.30 },
    { fontSize: 17.5, color: C.green, bold: true, align: "center" }, "lab recovery label");
  addText(slide, template, "合法 reset → surprise alert", { x: 9.74, y: 5.64, w: 2.84, h: 0.24 },
    { fontSize: 16.5, color: C.navy, bold: true, align: "center" }, "lab recovery text");

  addText(slide, template, "FACT｜canonical bit/J", { x: 0.82, y: 6.34, w: 3.05, h: 0.22 },
    { fontSize: 16, color: C.sky, bold: true }, "lab fact rail");
  addText(slide, template, "DESIGN｜六格＋一次修訂", { x: 4.02, y: 6.34, w: 4.08, h: 0.22 },
    { fontSize: 16, color: C.steel, bold: true, align: "center" }, "lab design rail");
  addText(slide, template, "UNKNOWN｜timing · state · parity", { x: 8.40, y: 6.34, w: 4.25, h: 0.22 },
    { fontSize: 16, color: C.muted, bold: true, align: "right" }, "lab unknown rail");
  addPageNumber(slide, template, 3);

  return slide;
}

function addEvidenceClinicStyleStressSlide(pptx, template, masterName) {
  const slide = pptx.addSlide({ masterName });

  addText(slide, template, "Evidence clinic｜Prediction is not saving", template.bounds.title,
    { role: "title", fontSize: TYPOGRAPHY.titlePt, color: C.navy, bold: true, valign: "bottom" }, "slide-four title");

  addChip(slide, template, pptx, "CLINIC · 92–106", { x: 0.78, y: 1.05, w: 1.95, h: 0.38 }, C.tagFill, C.tagText,
    { fontSize: 16 }, "slide-four stage chip");
  addText(slide, template, "主問題", { x: 2.93, y: 1.07, w: 0.86, h: 0.27 },
    { fontSize: 16.5, color: C.sky, bold: true }, "slide-four question label");
  addText(slide, template, "99% prediction score，真的比 78% 更能證明節能？",
    { x: 3.81, y: 1.05, w: 8.91, h: 0.40 },
    { fontSize: 21.5, color: C.navy, bold: true }, "slide-four question");

  addCard(slide, template, pptx, { x: 0.78, y: 1.66, w: 3.85, h: 3.17 }, C.line, 1.25, "feature availability region");
  addCard(slide, template, pptx, { x: 4.85, y: 1.66, w: 3.45, h: 3.17 }, C.line, 1.25, "legal action region");
  addCard(slide, template, pptx, { x: 8.52, y: 1.66, w: 4.30, h: 3.17 }, C.line, 1.25, "chronological trace region");

  addChip(slide, template, pptx, "FEATURE AVAILABILITY", { x: 0.98, y: 1.83, w: 3.45, h: 0.38 }, C.tagFill, C.tagText,
    { fontSize: 16 }, "feature availability chip");
  const featureGroups = [
    { label: "現在可得", text: "queue age · contact 剩餘", y: 2.34, h: 0.67, accent: C.sky },
    { label: "需判讀", text: "timestamp", y: 3.10, h: 0.55, accent: C.steel },
    { label: "事後才有", text: "final service · received time", y: 3.75, h: 0.67, accent: C.coral },
  ];
  featureGroups.forEach((item, index) => {
    addShape(slide, template, pptx.ShapeType.rect, { x: 1.04, y: item.y + 0.04, w: 0.06, h: item.h - 0.08 },
      { fill: { color: item.accent }, line: { color: item.accent, transparency: 100 } }, `feature group accent ${index + 1}`);
    addText(slide, template, item.label, { x: 1.22, y: item.y, w: 0.98, h: item.h },
      { fontSize: 16.5, color: item.accent, bold: true }, `feature group label ${index + 1}`);
    addText(slide, template, item.text, { x: 2.22, y: item.y, w: 2.08, h: item.h },
      { fontSize: 17, color: item.accent === C.coral ? C.coral : C.navy, bold: true }, `feature group text ${index + 1}`);
    if (index < featureGroups.length - 1) {
      addShape(slide, template, pptx.ShapeType.line, { x: 1.04, y: item.y + item.h + 0.04, w: 3.20, h: 0 },
        { line: { color: C.line, width: 1 } }, `feature group divider ${index + 1}`);
    }
  });
  addText(slide, template, "borderline：必須看 timestamp", { x: 1.04, y: 4.52, w: 3.36, h: 0.22 },
    { fontSize: 16.5, color: C.steel, bold: true, align: "center" }, "borderline note");

  addChip(slide, template, pptx, "FREEZE A LEGAL ACTION", { x: 5.05, y: 1.83, w: 3.05, h: 0.38 }, C.tagFill, C.tagText,
    { fontSize: 16 }, "legal action chip");
  addOutlineChip(slide, template, pptx, "AVAILABLE NOW ✓", { x: 5.10, y: 2.34, w: 2.95, h: 0.38 }, C.green,
    { fontSize: 16.5, color: C.green, lineWidth: 1.3 }, "available gate");
  addOutlineChip(slide, template, pptx, "LEAKAGE REJECTED ×", { x: 5.10, y: 2.83, w: 2.95, h: 0.44 }, C.coral,
    { fontSize: 16.5, color: C.coral, lineWidth: 1.3 }, "leakage gate");
  addOutlineChip(slide, template, pptx, "A｜現在送", { x: 5.10, y: 3.45, w: 1.40, h: 0.62 }, C.sky,
    { fontSize: 17, color: C.navy, lineWidth: 1.55 }, "legal action A");
  addOutlineChip(slide, template, pptx, "B｜等／batch", { x: 6.62, y: 3.45, w: 1.43, h: 0.62 }, C.sky,
    { fontSize: 16.5, color: C.navy, lineWidth: 1.55 }, "legal action B");
  addOutlineChip(slide, template, pptx, "FREEZE ONE ACTION", { x: 5.10, y: 4.24, w: 2.95, h: 0.40 }, C.sky,
    { fontSize: 16.5, color: C.navy, lineWidth: 1.45 }, "freeze action chip");

  addArrow(slide, template, pptx, { x: 4.63, y: 3.27, w: 0.22, h: 0 }, C.sky, 1.8, false, "feature to action arrow");
  addArrow(slide, template, pptx, { x: 8.30, y: 3.27, w: 0.22, h: 0 }, C.sky, 1.8, false, "action to replay arrow");

  addChip(slide, template, pptx, "CHRONOLOGICAL TRACE B", { x: 8.72, y: 1.83, w: 3.90, h: 0.38 }, C.tagFill, C.tagText,
    { fontSize: 16 }, "trace B chip");
  addText(slide, template, "PREDICTION SCORE", { x: 8.86, y: 2.43, w: 3.62, h: 0.30 },
    { fontSize: 18, color: C.violetStrong, bold: true, align: "center" }, "prediction score label");
  addText(slide, template, "模型輸出｜不進 energy formula", { x: 8.86, y: 2.83, w: 3.62, h: 0.24 },
    { fontSize: 16.5, color: C.navy, bold: true, align: "center" }, "prediction score meaning");
  addArrow(slide, template, pptx, { x: 10.67, y: 3.09, w: 0, h: 0.24 }, C.sky, 1.7, false, "prediction to evidence arrow");
  addCard(slide, template, pptx, { x: 8.84, y: 3.43, w: 3.66, h: 1.17 }, C.green, 1.4, "frozen action evidence card");
  addText(slide, template, "FROZEN-ACTION EVIDENCE", { x: 9.02, y: 3.58, w: 3.30, h: 0.31 },
    { fontSize: 17, color: C.green, bold: true, align: "center" }, "frozen action evidence label");
  addText(slide, template, "service_pass · freshness · deadline\nconsumed J · delivered bits · bit/J",
    { x: 9.02, y: 4.02, w: 3.30, h: 0.43 },
    { fontSize: 16.3, color: C.navy, bold: true, align: "center" }, "frozen action evidence text");

  addCard(slide, template, pptx, { x: 0.78, y: 5.03, w: 7.55, h: 1.14 }, C.sky, 1.4, "clinic meaning card");
  addText(slide, template, "判讀", { x: 0.98, y: 5.24, w: 0.88, h: 0.31 },
    { fontSize: 17.5, color: C.sky, bold: true, align: "center" }, "clinic meaning label");
  addText(slide, template, "Score ≠ saving", { x: 2.04, y: 5.13, w: 2.65, h: 0.38 },
    { fontSize: 25, color: C.navy, bold: true }, "clinic meaning headline");
  addText(slide, template, "prediction → action → service → J → bounded claim",
    { x: 2.04, y: 5.64, w: 5.86, h: 0.27 },
    { fontSize: 17, color: C.muted, bold: true }, "clinic meaning chain");

  addCard(slide, template, pptx, { x: 8.55, y: 5.03, w: 4.27, h: 1.14 }, C.green, 1.4, "clinic recovery card");
  addText(slide, template, "復原", { x: 8.75, y: 5.24, w: 0.92, h: 0.31 },
    { fontSize: 17.5, color: C.green, bold: true, align: "center" }, "clinic recovery label");
  addText(slide, template, "tooltip → fallback → shift", { x: 9.84, y: 5.24, w: 2.74, h: 0.25 },
    { fontSize: 17, color: C.navy, bold: true, align: "center" }, "clinic recovery text");
  addText(slide, template, "模擬｜非即時｜非量測", { x: 8.80, y: 5.72, w: 3.78, h: 0.24 },
    { fontSize: 16.5, color: C.muted, bold: true, align: "center" }, "clinic status text");

  addText(slide, template, "FACT｜score ≠ energy", { x: 0.82, y: 6.34, w: 3.08, h: 0.22 },
    { fontSize: 16, color: C.sky, bold: true }, "clinic fact rail");
  addText(slide, template, "DESIGN｜borderline＋2 actions", { x: 3.92, y: 6.34, w: 4.43, h: 0.22 },
    { fontSize: 16, color: C.steel, bold: true, align: "center" }, "clinic design rail");
  addText(slide, template, "UNKNOWN｜timing · browser · parity", { x: 8.38, y: 6.34, w: 4.27, h: 0.22 },
    { fontSize: 16, color: C.muted, bold: true, align: "right" }, "clinic unknown rail");
  addPageNumber(slide, template, 4);

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
  pptx.author = "C-120 four-slide style checkpoint";
  pptx.company = "C-120 course planning";
  pptx.subject = "Approved two-slide donor style plus current C-120 Lab C and evidence-clinic stress tests";
  pptx.title = "LEO energy course — four-slide style checkpoint";
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
  addLabCStyleStressSlide(pptx, template, authorMasterName);
  addEvidenceClinicStyleStressSlide(pptx, template, authorMasterName);
  if (pptx.slides.length !== 4) {
    throw new Error(`expected 4 slides, got ${pptx.slides.length}`);
  }

  await pptx.writeFile({ fileName: outputPath });
  await normalizePresentationElementOrder(outputPath);
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : String(error));
  process.exitCode = 1;
});
