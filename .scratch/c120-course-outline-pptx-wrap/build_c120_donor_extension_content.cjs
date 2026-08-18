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
    "usage: build_c120_donor_extension_content.cjs MASTER.cjs EXPORT_NAME OUTPUT.pptx",
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

// Owner authorization in this review chain: 「可以不用遵守字體大小的下限」.
// This extension nevertheless keeps every authored text run at 16 pt or above.
const ALLOW_TEXT_BELOW_MINIMUM = true;

// The accepted two-slide donor palette is the visual anchor. White remains the
// page background, while a few large pale semantic fields establish hierarchy.
// Saturated colors are reserved for compact headers, active bars, and arrows.
const C = Object.freeze({
  navy: "0B132B",
  navy2: "14213D",
  ink: "17223B",
  cyan: "28B8C7",
  cyanDark: "315F70",
  steel: "536F87",
  green: "4EA978",
  greenDark: "35604D",
  violet: "9B79D0",
  violetDark: "4D4268",
  danger: "B34B5E",
  paleCyan: "DCEBF0",
  paleSteel: "EDF2F5",
  paleGreen: "DDEAE2",
  paleViolet: "E7E3F1",
  paleDanger: "F5E4E7",
  muted: "60708A",
  line: "C9D2D8",
  paleLine: "DCE3E8",
  white: "FFFFFF",
});

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
    allowBelowMinimum: ALLOW_TEXT_BELOW_MINIMUM,
  });
  if (fontSize < 16) {
    throw new Error(`${label}: extension text below 16 pt is forbidden`);
  }
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

function addShape(slide, template, type, box, options, label = "shape") {
  slide.addShape(type, {
    ...bodyBox(template, box, label),
    ...options,
  });
}

function addOutlineBox(slide, template, pptx, box, accent, width = 1.3, label = "outline box") {
  addShape(slide, template, pptx.ShapeType.roundRect, box, {
    fill: { color: C.white },
    line: { color: accent, width },
  }, label);
}

function addSoftChip(
  slide,
  template,
  pptx,
  text,
  box,
  fill,
  color,
  options = {},
  label = "soft chip",
) {
  addShape(slide, template, pptx.ShapeType.roundRect, box, {
    fill: { color: fill },
    line: { color: fill, transparency: 100 },
  }, label);
  addText(
    slide,
    template,
    text,
    { x: box.x + 0.07, y: box.y + 0.02, w: box.w - 0.14, h: box.h - 0.04 },
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

function addArrow(slide, template, pptx, box, color = C.cyan, width = 2, label = "arrow") {
  addShape(slide, template, pptx.ShapeType.line, box, {
    line: {
      color,
      width,
      beginArrowType: "none",
      endArrowType: "triangle",
    },
  }, label);
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

function addFooterRail(slide, template, leftText, rightText) {
  addText(slide, template, leftText, { x: 0.82, y: 6.32, w: 4.40, h: 0.24 }, {
    fontSize: 16,
    color: C.steel,
    bold: true,
  }, "design-estimate rail");
  addText(slide, template, rightText, { x: 5.32, y: 6.32, w: 7.34, h: 0.24 }, {
    fontSize: 16,
    color: C.muted,
    bold: true,
    align: "right",
  }, "claim-boundary rail");
}

function addLabAExtensionSlide(pptx, template) {
  const slide = pptx.addSlide({ masterName: template.masters.content });
  const S = pptx.ShapeType;

  addText(
    slide,
    template,
    "Lab A｜同一份任務，快做還是慢做？",
    template.bounds.title,
    { role: "title", fontSize: 28, color: C.navy, bold: true, valign: "bottom" },
    "slide-three title",
  );

  addSoftChip(slide, template, pptx, "LAB A · 18–41", { x: 0.78, y: 1.05, w: 1.82, h: 0.40 },
    C.paleGreen, C.greenDark, { fontSize: 16.5 }, "lab-a stage chip");
  addText(slide, template, "主問題", { x: 2.78, y: 1.10, w: 0.86, h: 0.25 }, {
    fontSize: 16.5,
    color: C.steel,
    bold: true,
  }, "lab-a question label");
  addText(
    slide,
    template,
    "同一 payload、同一 deadline：低 W 一定比較省 J 嗎？",
    { x: 3.67, y: 1.05, w: 8.96, h: 0.40 },
    { fontSize: 22.5, color: C.navy, bold: true },
    "lab-a question",
  );

  addText(slide, template, "先預測三條 power–time 路徑", { x: 0.82, y: 1.68, w: 4.72, h: 0.30 }, {
    fontSize: 18.5,
    color: C.steel,
    bold: true,
  }, "lab-a prediction instruction");
  addText(slide, template, "同一 payload", { x: 6.13, y: 1.70, w: 1.38, h: 0.25 }, {
    fontSize: 16,
    color: C.muted,
    bold: true,
    align: "center",
  }, "same-payload label");
  addText(slide, template, "deadline", { x: 7.92, y: 1.70, w: 1.26, h: 0.25 }, {
    fontSize: 16,
    color: C.violet,
    bold: true,
    align: "center",
  }, "deadline label");
  addShape(slide, template, S.line, { x: 8.55, y: 2.00, w: 0, h: 2.74 }, {
    line: { color: C.violet, width: 2, dashType: "dash" },
  }, "deadline line");

  const lanes = [
    {
      y: 2.12,
      key: "PACE",
      accent: C.cyan,
      chipFill: C.paleCyan,
      activeW: 5.30,
      activeText: "較低 W｜active 久",
      sleepText: "幾乎無 sleep",
    },
    {
      y: 3.02,
      key: "BALANCED",
      accent: C.steel,
      chipFill: C.white,
      activeW: 3.95,
      activeText: "中間 W｜中間 active time",
      sleepText: "留一些 idle／sleep",
    },
    {
      y: 3.92,
      key: "BURST → SLEEP",
      accent: C.green,
      chipFill: C.paleGreen,
      activeW: 2.52,
      activeText: "較高 W｜快速完成",
      sleepText: "提早 sleep",
    },
  ];

  for (const [index, lane] of lanes.entries()) {
    addShape(slide, template, S.roundRect, { x: 0.82, y: lane.y, w: 1.65, h: 0.62 }, {
      fill: { color: lane.chipFill },
      line: { color: lane.accent, width: 1.4 },
    }, `lab-a policy label ${index + 1}`);
    addText(slide, template, lane.key, { x: 0.90, y: lane.y + 0.08, w: 1.49, h: 0.42 }, {
      fontSize: lane.key.length > 7 ? 16 : 17.5,
      color: lane.accent === C.cyan
        ? C.cyanDark
        : lane.accent === C.green
          ? C.greenDark
          : C.navy,
      bold: true,
      align: "center",
    }, `lab-a policy text ${index + 1}`);

    addShape(slide, template, S.roundRect, { x: 2.68, y: lane.y, w: lane.activeW, h: 0.62 }, {
      fill: { color: C.white },
      line: { color: lane.accent, width: 1.8 },
    }, `lab-a active span ${index + 1}`);
    addShape(slide, template, S.rect, { x: 2.68, y: lane.y, w: 0.10, h: 0.62 }, {
      fill: { color: lane.accent },
      line: { color: lane.accent, transparency: 100 },
    }, `lab-a active accent ${index + 1}`);
    addText(slide, template, lane.activeText, {
      x: 2.93,
      y: lane.y + 0.10,
      w: lane.activeW - 0.36,
      h: 0.40,
    }, {
      fontSize: 17,
      color: C.navy,
      bold: true,
      align: "center",
    }, `lab-a active text ${index + 1}`);

    const sleepX = 2.68 + lane.activeW + 0.12;
    const sleepW = Math.max(0.38, 8.42 - sleepX);
    addShape(slide, template, S.line, { x: sleepX, y: lane.y + 0.31, w: sleepW, h: 0 }, {
      line: { color: C.line, width: 1.5, dashType: "dash" },
    }, `lab-a sleep line ${index + 1}`);
    if (sleepW > 1.10) {
      addText(slide, template, lane.sleepText, {
        x: sleepX + 0.06,
        y: lane.y + 0.07,
        w: sleepW - 0.12,
        h: 0.46,
      }, {
        fontSize: 16,
        color: C.muted,
        bold: true,
        align: "center",
      }, `lab-a sleep text ${index + 1}`);
    }
  }

  addArrow(slide, template, pptx, { x: 8.82, y: 3.26, w: 0.36, h: 0 }, C.cyan, 2.1,
    "lab-a timeline-to-operation arrow");

  addText(slide, template, "學生操作", { x: 9.28, y: 1.72, w: 1.20, h: 0.30 }, {
    fontSize: 18.5,
    color: C.steel,
    bold: true,
  }, "lab-a operation heading");

  const steps = [
    { n: "1", text: "active time · J\nservice · bit/J", y: 2.16, accent: C.cyan, fontSize: 16.5 },
    { n: "2", text: "選 candidate → RUN", y: 3.03, accent: C.green },
    { n: "3", text: "揭開 fixed／idle／wakeup cost", y: 3.90, accent: C.violet },
  ];
  for (const [index, step] of steps.entries()) {
    addShape(slide, template, S.ellipse, { x: 9.30, y: step.y, w: 0.50, h: 0.50 }, {
      fill: { color: C.white },
      line: { color: step.accent, width: 1.8 },
    }, `lab-a operation number ${index + 1}`);
    addText(slide, template, step.n, { x: 9.30, y: step.y + 0.05, w: 0.50, h: 0.38 }, {
      fontSize: 19,
      color: step.accent,
      bold: true,
      align: "center",
    }, `lab-a operation number text ${index + 1}`);
    addText(slide, template, step.text, { x: 9.98, y: step.y - 0.02, w: 2.77, h: 0.56 }, {
      fontSize: step.fontSize ?? 17,
      color: C.navy,
      bold: true,
    }, `lab-a operation text ${index + 1}`);
    if (index < steps.length - 1) {
      addShape(slide, template, S.line, { x: 9.55, y: step.y + 0.53, w: 0, h: 0.31 }, {
        line: { color: C.line, width: 1.4, endArrowType: "triangle" },
      }, `lab-a operation connector ${index + 1}`);
    }
  }

  addSoftChip(slide, template, pptx, "RESET｜同一情境｜未驗證", { x: 9.28, y: 4.62, w: 3.44, h: 0.40 },
    C.paleGreen, C.greenDark, { fontSize: 16.2 }, "lab-a reset chip");

  addOutlineBox(slide, template, pptx, { x: 0.78, y: 5.20, w: 8.75, h: 0.93 }, C.line, 1.15,
    "lab-a evidence ledger");
  addText(slide, template, "同一時間軸", { x: 1.00, y: 5.48, w: 1.34, h: 0.30 }, {
    fontSize: 18,
    color: C.steel,
    bold: true,
    align: "center",
  }, "lab-a evidence heading");
  addText(slide, template, "W", { x: 2.62, y: 5.37, w: 0.50, h: 0.36 }, {
    fontSize: 22,
    color: C.navy,
    bold: true,
    align: "center",
  }, "lab-a W evidence");
  addArrow(slide, template, pptx, { x: 3.16, y: 5.62, w: 0.54, h: 0 }, C.cyan, 1.8,
    "lab-a evidence arrow one");
  addText(slide, template, "active time", { x: 3.78, y: 5.39, w: 1.34, h: 0.34 }, {
    fontSize: 18,
    color: C.navy,
    bold: true,
    align: "center",
  }, "lab-a time evidence");
  addArrow(slide, template, pptx, { x: 5.16, y: 5.62, w: 0.52, h: 0 }, C.cyan, 1.8,
    "lab-a evidence arrow two");
  addText(slide, template, "J", { x: 5.75, y: 5.37, w: 0.42, h: 0.36 }, {
    fontSize: 22,
    color: C.navy,
    bold: true,
    align: "center",
  }, "lab-a joule evidence");
  addArrow(slide, template, pptx, { x: 6.22, y: 5.62, w: 0.54, h: 0 }, C.cyan, 1.8,
    "lab-a evidence arrow three");
  addText(slide, template, "service", { x: 6.84, y: 5.38, w: 1.02, h: 0.34 }, {
    fontSize: 18,
    color: C.green,
    bold: true,
    align: "center",
  }, "lab-a service evidence");
  addArrow(slide, template, pptx, { x: 7.90, y: 5.62, w: 0.54, h: 0 }, C.cyan, 1.8,
    "lab-a evidence arrow four");
  addText(slide, template, "bit/J", { x: 8.48, y: 5.37, w: 0.76, h: 0.36 }, {
    fontSize: 22,
    color: C.navy,
    bold: true,
    align: "center",
  }, "lab-a efficiency evidence");

  addOutlineBox(slide, template, pptx, { x: 9.72, y: 5.20, w: 3.10, h: 0.93 }, C.green, 1.5,
    "lab-a verdict box");
  addText(slide, template, "省 W ≠ 省 J", { x: 9.94, y: 5.30, w: 2.66, h: 0.38 }, {
    fontSize: 23,
    color: C.navy,
    bold: true,
    align: "center",
  }, "lab-a verdict headline");
  addText(slide, template, "先過 service／deadline", { x: 9.94, y: 5.71, w: 2.66, h: 0.26 }, {
    fontSize: 16.5,
    color: C.green,
    bold: true,
    align: "center",
  }, "lab-a verdict condition");

  addFooterRail(
    slide,
    template,
    "設計估計｜23 分鐘，尚未 novice-timed",
    "模擬教學資料｜非即時｜非量測｜canonical parity 未驗證",
  );
  return slide;
}

function addEvidenceClinicExtensionSlide(pptx, template) {
  const slide = pptx.addSlide({ masterName: template.masters.content });
  const S = pptx.ShapeType;

  addText(
    slide,
    template,
    "Evidence clinic｜Prediction is not saving",
    template.bounds.title,
    { role: "title", fontSize: 28, color: C.navy, bold: true, valign: "bottom" },
    "slide-four title",
  );

  addSoftChip(slide, template, pptx, "CLINIC · 92–106", { x: 0.78, y: 1.05, w: 2.02, h: 0.40 },
    C.paleViolet, C.violetDark, { fontSize: 16.5 }, "clinic stage chip");
  addText(slide, template, "主問題", { x: 2.98, y: 1.10, w: 0.86, h: 0.25 }, {
    fontSize: 16.5,
    color: C.steel,
    bold: true,
  }, "clinic question label");
  addText(slide, template, "99% 比 78% 更能證明節能嗎？", { x: 3.87, y: 1.05, w: 8.72, h: 0.40 }, {
    fontSize: 23,
    color: C.navy,
    bold: true,
  }, "clinic question");

  addText(slide, template, "示例 prediction score", { x: 0.82, y: 1.70, w: 3.02, h: 0.28 }, {
    fontSize: 18.5,
    color: C.steel,
    bold: true,
    align: "center",
  }, "clinic score heading");
  addShape(slide, template, S.ellipse, { x: 0.94, y: 2.11, w: 1.32, h: 1.32 }, {
    fill: { color: C.white },
    line: { color: C.violet, width: 2.2 },
  }, "clinic score 99 circle");
  addText(slide, template, "99%", { x: 1.01, y: 2.39, w: 1.18, h: 0.54 }, {
    fontSize: 31,
    color: C.navy,
    bold: true,
    align: "center",
  }, "clinic score 99");
  addText(slide, template, ">", { x: 2.32, y: 2.50, w: 0.38, h: 0.36 }, {
    fontSize: 28,
    color: C.steel,
    bold: true,
    align: "center",
  }, "clinic score comparison");
  addShape(slide, template, S.ellipse, { x: 2.76, y: 2.11, w: 1.32, h: 1.32 }, {
    fill: { color: C.white },
    line: { color: C.steel, width: 2.2 },
  }, "clinic score 78 circle");
  addText(slide, template, "78%", { x: 2.83, y: 2.39, w: 1.18, h: 0.54 }, {
    fontSize: 31,
    color: C.navy,
    bold: true,
    align: "center",
  }, "clinic score 78");
  addText(slide, template, "只回答：模型預測得多準", { x: 0.96, y: 3.60, w: 3.10, h: 0.34 }, {
    fontSize: 18,
    color: C.navy,
    bold: true,
    align: "center",
  }, "clinic score meaning");
  addText(slide, template, "尚未回答：是否真的省 J", { x: 0.96, y: 4.05, w: 3.10, h: 0.34 }, {
    fontSize: 18,
    color: C.danger,
    bold: true,
    align: "center",
  }, "clinic score limit");

  addArrow(slide, template, pptx, { x: 4.17, y: 3.05, w: 0.48, h: 0 }, C.cyan, 2.2,
    "clinic score-to-gate arrow");

  addText(slide, template, "先過 evidence gate", { x: 4.72, y: 1.70, w: 3.00, h: 0.28 }, {
    fontSize: 18.5,
    color: C.steel,
    bold: true,
    align: "center",
  }, "clinic gate heading");
  addOutlineBox(slide, template, pptx, { x: 4.76, y: 2.10, w: 2.92, h: 0.62 }, C.green, 1.6,
    "clinic available feature box");
  addText(slide, template, "queue age｜現在可得 ✓", { x: 4.94, y: 2.22, w: 2.56, h: 0.34 }, {
    fontSize: 17.5,
    color: C.green,
    bold: true,
    align: "center",
  }, "clinic available feature");
  addOutlineBox(slide, template, pptx, { x: 4.76, y: 2.90, w: 2.92, h: 0.74 }, C.danger, 1.6,
    "clinic leakage feature box");
  addText(slide, template, "final service｜事後才有 ×", { x: 4.94, y: 3.06, w: 2.56, h: 0.40 }, {
    fontSize: 17,
    color: C.danger,
    bold: true,
    align: "center",
  }, "clinic leakage feature");
  addArrow(slide, template, pptx, { x: 6.22, y: 3.72, w: 0, h: 0.38 }, C.cyan, 1.9,
    "clinic gate-to-freeze arrow");
  addOutlineBox(slide, template, pptx, { x: 4.76, y: 4.18, w: 2.92, h: 0.74 }, C.cyan, 1.8,
    "clinic freeze action box");
  addText(slide, template, "FREEZE ONE ACTION", { x: 4.94, y: 4.32, w: 2.56, h: 0.40 }, {
    fontSize: 18,
    color: C.navy,
    bold: true,
    align: "center",
  }, "clinic freeze action");

  addArrow(slide, template, pptx, { x: 7.78, y: 3.05, w: 0.48, h: 0 }, C.cyan, 2.2,
    "clinic gate-to-replay arrow");

  addText(slide, template, "held-out replay 才能檢驗能源紀錄", { x: 8.32, y: 1.70, w: 4.42, h: 0.28 }, {
    fontSize: 18.5,
    color: C.steel,
    bold: true,
    align: "center",
  }, "clinic replay heading");
  addText(slide, template, "ACTION", { x: 8.44, y: 2.20, w: 1.36, h: 0.34 }, {
    fontSize: 17,
    color: C.cyan,
    bold: true,
    align: "center",
  }, "clinic action node");
  addArrow(slide, template, pptx, { x: 9.84, y: 2.39, w: 0.42, h: 0 }, C.cyan, 1.9,
    "clinic action-service arrow");
  addText(slide, template, "SERVICE", { x: 10.30, y: 2.20, w: 1.46, h: 0.34 }, {
    fontSize: 17,
    color: C.green,
    bold: true,
    align: "center",
  }, "clinic service node");
  addArrow(slide, template, pptx, { x: 11.80, y: 2.39, w: 0.40, h: 0 }, C.cyan, 1.9,
    "clinic service-joule arrow");
  addText(slide, template, "J", { x: 12.24, y: 2.18, w: 0.34, h: 0.38 }, {
    fontSize: 24,
    color: C.navy,
    bold: true,
    align: "center",
  }, "clinic joule node");

  addOutlineBox(slide, template, pptx, { x: 8.38, y: 2.86, w: 4.34, h: 1.58 }, C.green, 1.8,
    "clinic evidence ledger");
  addSoftChip(slide, template, pptx, "FROZEN RECORD｜待驗證", { x: 8.70, y: 3.04, w: 3.70, h: 0.42 },
    C.paleGreen, C.greenDark, { fontSize: 16.5 }, "clinic evidence chip");
  addText(slide, template, "service_pass · deadline · freshness", { x: 8.62, y: 3.56, w: 3.86, h: 0.32 }, {
    fontSize: 16.5,
    color: C.navy,
    bold: true,
    align: "center",
  }, "clinic service evidence");
  addText(slide, template, "consumed J · delivered bits · bit/J", { x: 8.62, y: 3.96, w: 3.86, h: 0.32 }, {
    fontSize: 16.5,
    color: C.navy,
    bold: true,
    align: "center",
  }, "clinic energy evidence");
  addSoftChip(slide, template, pptx, "RECOVERY｜fallback → same trace",
    { x: 8.38, y: 4.63, w: 4.34, h: 0.40 }, C.paleCyan, C.steel, { fontSize: 16.5 },
    "clinic recovery chip");

  addOutlineBox(slide, template, pptx, { x: 0.78, y: 5.22, w: 12.04, h: 0.93 }, C.violet, 1.5,
    "clinic verdict band");
  addText(slide, template, "Prediction ≠ saving｜還要看 service 與 J", {
    x: 1.04,
    y: 5.31,
    w: 7.16,
    h: 0.42,
  }, {
    fontSize: 23,
    color: C.navy,
    bold: true,
  }, "clinic verdict headline");
  addText(slide, template, "prediction → action → service\n→ J → bounded claim", {
    x: 7.96,
    y: 5.27,
    w: 4.56,
    h: 0.54,
  }, {
    fontSize: 16.5,
    color: C.steel,
    bold: true,
    align: "right",
  }, "clinic bounded claim chain");
  addText(slide, template, "狀態：流程與數值皆未驗證", { x: 8.58, y: 5.85, w: 3.94, h: 0.22 }, {
    fontSize: 16,
    color: C.muted,
    bold: true,
    align: "right",
  }, "clinic current status");

  addFooterRail(
    slide,
    template,
    "設計估計｜14 分鐘，尚未 novice-timed",
    "模擬教學資料｜非即時｜非量測｜canonical parity 未驗證",
  );
  return slide;
}

// V2 deliberately uses a small number of large filled semantic fields. The
// accepted donor uses white as the page canvas, not as the fill for every
// component. These slides therefore avoid the rejected wireframe/dashboard
// effect while keeping the same light palette and editable native objects.
function addLabAExtensionSlideV2(pptx, template) {
  const slide = pptx.addSlide({ masterName: template.masters.content });
  const S = pptx.ShapeType;

  addText(slide, template, "Lab A｜同一份任務，快做還是慢做？", template.bounds.title, {
    role: "title", fontSize: 28, color: C.navy, bold: true, valign: "bottom",
  }, "slide-three-v2 title");
  addSoftChip(slide, template, pptx, "LAB A · 18–41", { x: 0.78, y: 1.05, w: 1.82, h: 0.40 },
    C.paleGreen, C.greenDark, { fontSize: 16.5 }, "lab-a-v2 stage chip");
  addText(slide, template, "主問題", { x: 2.78, y: 1.10, w: 0.86, h: 0.25 }, {
    fontSize: 16.5, color: C.steel, bold: true,
  }, "lab-a-v2 question label");
  addText(slide, template, "同一 payload、同一 deadline：低 W 一定比較省 J 嗎？",
    { x: 3.67, y: 1.05, w: 8.96, h: 0.40 }, {
      fontSize: 22.5, color: C.navy, bold: true,
    }, "lab-a-v2 question");

  addShape(slide, template, S.roundRect, { x: 0.78, y: 1.62, w: 8.28, h: 3.39 }, {
    fill: { color: C.paleCyan },
    line: { color: C.paleCyan, transparency: 100 },
  }, "lab-a-v2 timeline field");
  addText(slide, template, "先預測三條 power–time 路徑", { x: 1.00, y: 1.76, w: 4.40, h: 0.30 }, {
    fontSize: 18.5, color: C.cyanDark, bold: true,
  }, "lab-a-v2 prediction instruction");
  addText(slide, template, "同一 payload · 同一 deadline", { x: 5.13, y: 1.78, w: 3.46, h: 0.26 }, {
    fontSize: 16, color: C.steel, bold: true, align: "right",
  }, "lab-a-v2 same-boundary label");
  addText(slide, template, "deadline", { x: 7.78, y: 2.06, w: 0.96, h: 0.25 }, {
    fontSize: 16, color: C.violetDark, bold: true, align: "center",
  }, "lab-a-v2 deadline label");
  addShape(slide, template, S.line, { x: 8.26, y: 2.32, w: 0, h: 2.36 }, {
    line: { color: C.violet, width: 2, dashType: "dash" },
  }, "lab-a-v2 deadline line");

  const lanes = [
    { y: 2.34, key: "PACE", accent: C.cyan, activeW: 5.40, activeText: "較低 W｜active 久", sleepText: "幾乎無 sleep" },
    { y: 3.15, key: "BALANCED", accent: C.steel, activeW: 4.05, activeText: "中間 W｜中間 active time", sleepText: "留一些 idle／sleep" },
    { y: 3.96, key: "BURST → SLEEP", accent: C.green, activeW: 2.65, activeText: "較高 W｜快速完成", sleepText: "提早 sleep" },
  ];
  for (const [index, lane] of lanes.entries()) {
    addText(slide, template, lane.key, { x: 1.00, y: lane.y + 0.08, w: 1.34, h: 0.38 }, {
      fontSize: lane.key.length > 7 ? 16 : 17.5,
      color: lane.accent === C.cyan ? C.cyanDark : lane.accent === C.green ? C.greenDark : C.navy,
      bold: true,
    }, `lab-a-v2 policy ${index + 1}`);
    addShape(slide, template, S.roundRect, { x: 2.40, y: lane.y, w: lane.activeW, h: 0.58 }, {
      fill: { color: lane.accent },
      line: { color: lane.accent, transparency: 100 },
    }, `lab-a-v2 active bar ${index + 1}`);
    addText(slide, template, lane.activeText, {
      x: 2.58, y: lane.y + 0.08, w: lane.activeW - 0.36, h: 0.38,
    }, {
      fontSize: 17, color: C.white, bold: true, align: "center",
    }, `lab-a-v2 active text ${index + 1}`);
    const sleepX = 2.40 + lane.activeW + 0.12;
    const sleepW = Math.max(0.38, 8.18 - sleepX);
    addShape(slide, template, S.line, { x: sleepX, y: lane.y + 0.29, w: sleepW, h: 0 }, {
      line: { color: C.white, width: 1.5, dashType: "dash" },
    }, `lab-a-v2 sleep line ${index + 1}`);
    if (sleepW > 1.08) {
      addText(slide, template, lane.sleepText, {
        x: sleepX + 0.05, y: lane.y + 0.07, w: sleepW - 0.10, h: 0.42,
      }, {
        fontSize: 16, color: C.steel, bold: true, align: "center",
      }, `lab-a-v2 sleep text ${index + 1}`);
    }
  }

  addShape(slide, template, S.roundRect, { x: 9.28, y: 1.62, w: 3.54, h: 3.39 }, {
    fill: { color: C.paleGreen },
    line: { color: C.paleGreen, transparency: 100 },
  }, "lab-a-v2 operation field");
  addText(slide, template, "學生操作", { x: 9.54, y: 1.78, w: 1.52, h: 0.30 }, {
    fontSize: 18.5, color: C.greenDark, bold: true,
  }, "lab-a-v2 operation heading");
  const steps = [
    { n: "1", text: "先預測\nactive time · J · service · bit/J", y: 2.20, accent: C.cyan, fontSize: 16 },
    { n: "2", text: "選 candidate → RUN", y: 3.02, accent: C.green, fontSize: 17 },
    { n: "3", text: "揭開 fixed／idle／wakeup cost", y: 3.82, accent: C.violet, fontSize: 16.5 },
  ];
  for (const [index, step] of steps.entries()) {
    addShape(slide, template, S.ellipse, { x: 9.54, y: step.y, w: 0.46, h: 0.46 }, {
      fill: { color: step.accent },
      line: { color: step.accent, transparency: 100 },
    }, `lab-a-v2 step marker ${index + 1}`);
    addText(slide, template, step.n, { x: 9.54, y: step.y + 0.04, w: 0.46, h: 0.36 }, {
      fontSize: 18, color: C.white, bold: true, align: "center",
    }, `lab-a-v2 step number ${index + 1}`);
    addText(slide, template, step.text, { x: 10.20, y: step.y - 0.03, w: 2.35, h: 0.60 }, {
      fontSize: step.fontSize, color: C.navy, bold: true,
    }, `lab-a-v2 step text ${index + 1}`);
    if (index < steps.length - 1) {
      addShape(slide, template, S.line, { x: 9.54, y: step.y + 0.64, w: 3.02, h: 0 }, {
        line: { color: C.white, width: 1.2 },
      }, `lab-a-v2 step separator ${index + 1}`);
    }
  }
  addSoftChip(slide, template, pptx, "RESET｜同一情境｜未驗證", { x: 9.54, y: 4.55, w: 3.02, h: 0.32 },
    C.paleCyan, C.greenDark, { fontSize: 16 }, "lab-a-v2 reset chip");

  addShape(slide, template, S.roundRect, { x: 0.78, y: 5.20, w: 12.04, h: 0.93 }, {
    fill: { color: C.paleViolet },
    line: { color: C.paleViolet, transparency: 100 },
  }, "lab-a-v2 evidence field");
  addText(slide, template, "同一時間軸", { x: 1.00, y: 5.48, w: 1.34, h: 0.30 }, {
    fontSize: 18, color: C.violetDark, bold: true, align: "center",
  }, "lab-a-v2 evidence label");
  addText(slide, template, "W  →  active time  →  J  →  service  →  bit/J",
    { x: 2.42, y: 5.35, w: 6.88, h: 0.42 }, {
      fontSize: 19, color: C.navy, bold: true, align: "center",
    }, "lab-a-v2 evidence chain");
  addShape(slide, template, S.line, { x: 9.56, y: 5.34, w: 0, h: 0.64 }, {
    line: { color: C.violet, width: 1.2 },
  }, "lab-a-v2 verdict separator");
  addText(slide, template, "省 W ≠ 省 J", { x: 9.82, y: 5.30, w: 2.72, h: 0.38 }, {
    fontSize: 23, color: C.navy, bold: true, align: "center",
  }, "lab-a-v2 verdict");
  addText(slide, template, "先過 service／deadline", { x: 9.82, y: 5.71, w: 2.72, h: 0.26 }, {
    fontSize: 16.5, color: C.green, bold: true, align: "center",
  }, "lab-a-v2 verdict condition");

  addFooterRail(slide, template, "設計估計｜23 分鐘，尚未 novice-timed",
    "模擬教學資料｜非即時｜非量測｜canonical parity 未驗證");
  addPageNumber(slide, template, 3);
  return slide;
}

function addEvidenceClinicExtensionSlideV2(pptx, template) {
  const slide = pptx.addSlide({ masterName: template.masters.content });
  const S = pptx.ShapeType;

  addText(slide, template, "Evidence clinic｜Prediction is not saving", template.bounds.title, {
    role: "title", fontSize: 28, color: C.navy, bold: true, valign: "bottom",
  }, "slide-four-v2 title");
  addSoftChip(slide, template, pptx, "CLINIC · 92–106", { x: 0.78, y: 1.05, w: 2.02, h: 0.40 },
    C.paleViolet, C.violetDark, { fontSize: 16.5 }, "clinic-v2 stage chip");
  addText(slide, template, "主問題", { x: 2.98, y: 1.10, w: 0.86, h: 0.25 }, {
    fontSize: 16.5, color: C.steel, bold: true,
  }, "clinic-v2 question label");
  addText(slide, template, "99% 比 78% 更能證明節能嗎？", { x: 3.87, y: 1.05, w: 8.72, h: 0.40 }, {
    fontSize: 23, color: C.navy, bold: true,
  }, "clinic-v2 question");

  const zones = [
    { x: 0.78, w: 3.45, fill: C.paleViolet, label: "clinic-v2 score field" },
    { x: 4.39, w: 3.40, fill: C.paleCyan, label: "clinic-v2 gate field" },
    { x: 7.95, w: 4.87, fill: C.paleGreen, label: "clinic-v2 replay field" },
  ];
  for (const zone of zones) {
    addShape(slide, template, S.roundRect, { x: zone.x, y: 1.62, w: zone.w, h: 3.43 }, {
      fill: { color: zone.fill },
      line: { color: zone.fill, transparency: 100 },
    }, zone.label);
  }

  addText(slide, template, "示例 prediction score", { x: 1.02, y: 1.80, w: 2.97, h: 0.28 }, {
    fontSize: 18.5, color: C.violetDark, bold: true, align: "center",
  }, "clinic-v2 score heading");
  addText(slide, template, "99%", { x: 1.00, y: 2.35, w: 1.20, h: 0.56 }, {
    fontSize: 34, color: C.navy, bold: true, align: "center",
  }, "clinic-v2 score 99");
  addText(slide, template, ">", { x: 2.29, y: 2.45, w: 0.40, h: 0.40 }, {
    fontSize: 28, color: C.violet, bold: true, align: "center",
  }, "clinic-v2 score comparison");
  addText(slide, template, "78%", { x: 2.78, y: 2.35, w: 1.20, h: 0.56 }, {
    fontSize: 34, color: C.navy, bold: true, align: "center",
  }, "clinic-v2 score 78");
  addShape(slide, template, S.line, { x: 1.05, y: 3.22, w: 2.90, h: 0 }, {
    line: { color: C.white, width: 1.3 },
  }, "clinic-v2 score separator");
  addText(slide, template, "只回答：模型預測得多準", { x: 1.03, y: 3.48, w: 2.92, h: 0.34 }, {
    fontSize: 17.5, color: C.navy, bold: true, align: "center",
  }, "clinic-v2 score meaning");
  addText(slide, template, "尚未回答：是否真的省 J", { x: 1.03, y: 4.08, w: 2.92, h: 0.34 }, {
    fontSize: 17.5, color: C.danger, bold: true, align: "center",
  }, "clinic-v2 score limit");

  addArrow(slide, template, pptx, { x: 4.14, y: 3.12, w: 0.38, h: 0 }, C.cyan, 2.1,
    "clinic-v2 score-to-gate arrow");
  addText(slide, template, "先過 evidence gate", { x: 4.63, y: 1.80, w: 2.92, h: 0.28 }, {
    fontSize: 18.5, color: C.cyanDark, bold: true, align: "center",
  }, "clinic-v2 gate heading");
  addSoftChip(slide, template, pptx, "✓ queue age｜現在可得", { x: 4.70, y: 2.28, w: 2.78, h: 0.54 },
    C.paleGreen, C.greenDark, { fontSize: 17 }, "clinic-v2 available feature");
  addSoftChip(slide, template, pptx, "× final service｜事後才有", { x: 4.70, y: 3.02, w: 2.78, h: 0.62 },
    C.paleDanger, C.danger, { fontSize: 16.5 }, "clinic-v2 leakage feature");
  addText(slide, template, "timestamp 決定能否使用", { x: 4.70, y: 3.78, w: 2.78, h: 0.28 }, {
    fontSize: 16, color: C.steel, bold: true, align: "center",
  }, "clinic-v2 timestamp rule");
  addShape(slide, template, S.roundRect, { x: 4.70, y: 4.28, w: 2.78, h: 0.52 }, {
    fill: { color: C.cyan },
    line: { color: C.cyan, transparency: 100 },
  }, "clinic-v2 freeze action bar");
  addText(slide, template, "FREEZE ONE ACTION", { x: 4.88, y: 4.37, w: 2.42, h: 0.32 }, {
    fontSize: 17.5, color: C.white, bold: true, align: "center",
  }, "clinic-v2 freeze action");

  addArrow(slide, template, pptx, { x: 7.70, y: 3.12, w: 0.38, h: 0 }, C.cyan, 2.1,
    "clinic-v2 gate-to-replay arrow");
  addText(slide, template, "held-out replay｜能源紀錄", { x: 8.22, y: 1.80, w: 4.33, h: 0.28 }, {
    fontSize: 18.5, color: C.greenDark, bold: true, align: "center",
  }, "clinic-v2 replay heading");
  addText(slide, template, "ACTION  →  SERVICE  →  J", { x: 8.30, y: 2.30, w: 4.18, h: 0.36 }, {
    fontSize: 19, color: C.navy, bold: true, align: "center",
  }, "clinic-v2 causal nodes");
  addSoftChip(slide, template, pptx, "FROZEN RECORD｜待驗證", { x: 8.34, y: 2.92, w: 4.10, h: 0.46 },
    C.white, C.greenDark, { fontSize: 17 }, "clinic-v2 evidence chip");
  addText(slide, template, "service_pass · deadline · freshness", { x: 8.34, y: 3.55, w: 4.10, h: 0.32 }, {
    fontSize: 16.5, color: C.navy, bold: true, align: "center",
  }, "clinic-v2 service evidence");
  addText(slide, template, "consumed J · delivered bits · bit/J", { x: 8.34, y: 3.98, w: 4.10, h: 0.32 }, {
    fontSize: 16.5, color: C.navy, bold: true, align: "center",
  }, "clinic-v2 energy evidence");
  addSoftChip(slide, template, pptx, "RECOVERY｜fallback → same trace", { x: 8.34, y: 4.48, w: 4.10, h: 0.34 },
    C.paleCyan, C.steel, { fontSize: 16 }, "clinic-v2 recovery chip");

  addShape(slide, template, S.roundRect, { x: 0.78, y: 5.22, w: 12.04, h: 0.93 }, {
    fill: { color: C.paleViolet },
    line: { color: C.paleViolet, transparency: 100 },
  }, "clinic-v2 verdict field");
  addText(slide, template, "Prediction ≠ saving｜還要看 service 與 J",
    { x: 1.04, y: 5.31, w: 7.16, h: 0.42 }, {
      fontSize: 23, color: C.navy, bold: true,
    }, "clinic-v2 verdict");
  addText(slide, template, "prediction → action → service → J → bounded claim",
    { x: 7.96, y: 5.31, w: 4.56, h: 0.34 }, {
      fontSize: 16.5, color: C.steel, bold: true, align: "right",
    }, "clinic-v2 claim chain");
  addText(slide, template, "狀態：流程與數值皆未驗證", { x: 8.58, y: 5.77, w: 3.94, h: 0.22 }, {
    fontSize: 16, color: C.muted, bold: true, align: "right",
  }, "clinic-v2 status");

  addFooterRail(slide, template, "設計估計｜14 分鐘，尚未 novice-timed",
    "模擬教學資料｜非即時｜非量測｜canonical parity 未驗證");
  addPageNumber(slide, template, 4);
  return slide;
}

async function main() {
  const pptx = new pptxgen();
  pptx.layout = "LAYOUT_WIDE";
  pptx.author = "C-120 donor-style four-slide test";
  pptx.company = "C-120 course planning";
  pptx.subject = "Editable content slides for Lab A and the evidence clinic";
  pptx.title = "C-120 donor-style extension content";
  pptx.lang = "zh-TW";
  pptx.theme = {
    headFontFace: FONTS.cjk,
    bodyFontFace: FONTS.cjk,
    lang: "zh-TW",
  };

  const template = registerTemplate(pptx);
  if (!template || !template.masters || !template.bounds) {
    throw new Error("template did not return the required authoring contract exports");
  }
  if (template.typography.minimumTitlePt !== 28 || template.typography.minimumBodyPt !== 24) {
    throw new Error("unexpected edu typography contract");
  }

  addLabAExtensionSlideV2(pptx, template);
  addEvidenceClinicExtensionSlideV2(pptx, template);
  if (pptx.slides.length !== 2) {
    throw new Error(`expected 2 extension slides, got ${pptx.slides.length}`);
  }
  await pptx.writeFile({ fileName: outputPath });
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : String(error));
  process.exitCode = 1;
});
