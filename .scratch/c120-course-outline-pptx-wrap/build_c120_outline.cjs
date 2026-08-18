"use strict";

const path = require("node:path");
const fs = require("node:fs/promises");
const pptxgen = require("pptxgenjs");

const managedModuleRoot = process.env.PPTX_WRAP_MANAGED_MODULE_ROOT;
if (!managedModuleRoot || !path.isAbsolute(managedModuleRoot)) {
  throw new Error("build must run through the pptx-wrap managed runner");
}
const JSZip = require(path.join(managedModuleRoot, "jszip"));

const [masterPathArg, masterExportArg, outputPathArg] = process.argv.slice(2);
if (!masterPathArg || !masterExportArg || !outputPathArg) {
  throw new Error(
    "usage: build_c120_outline.cjs MASTER.cjs EXPORT_NAME OUTPUT.pptx",
  );
}

const masterPath = path.resolve(masterPathArg);
const outputPath = path.resolve(outputPathArg);
const masterModule = require(masterPath);
const registerTemplate = masterModule[masterExportArg];
if (typeof registerTemplate !== "function") {
  throw new TypeError(`missing template export: ${masterExportArg}`);
}

const {
  assertFontSize,
  assertWithin,
  FONTS,
  TYPOGRAPHY,
} = masterModule;

// Owner authorization, 2026-08-10: 「可以不用遵守字體大小的下限」.
// The edu master, safe bounds, protected zones, logo, divider, footer, and fonts
// remain binding; only the author-text size floor is released.
const ALLOW_TEXT_BELOW_MINIMUM = true;

const COLORS = Object.freeze({
  ink: "35377F",
  navy: "14213D",
  body: "1E2430",
  muted: "647187",
  rule: "D5DDE4",
  quiet: "F7F8FA",
  sky: "28AFC0",
  skySoft: "EAF7F8",
  mint: "4EA978",
  mintSoft: "ECF7F1",
  violet: "8A70BF",
  violetSoft: "F2EEFA",
  coral: "C96F67",
  coralSoft: "FAEFED",
  blueGray: "57788E",
  blueSoft: "EEF4F7",
  gold: "C9A74F",
  sand: "FAF7F0",
  fact: "2D7A70",
  inference: "7257A1",
  unknown: "98514F",
  ceilingFill: "FAEFED",
  ceilingLine: "C58A84",
  white: "FFFFFF",
});

// Three-slide owner-review calibration palette. It borrows the first Phase-0
// deck's visual mass and contrast, but keeps the edu master background unset.
// The former bright amber is intentionally not reused.
const CALIBRATION = Object.freeze({
  ink: "17223B",
  navy: "14213D",
  sky: "28B8C7",
  skySoft: "E5F5F6",
  coral: "EA6A5A",
  coralSoft: "FBE9E5",
  green: "4EA978",
  greenSoft: "E7F3EB",
  violet: "9272C7",
  violetSoft: "F0EAF8",
  blueGray: "607E91",
  blueSoft: "ECF2F5",
  cream: "F5F1E8",
  paper: "FFFDF7",
  muted: "60708A",
  line: "C9D2D8",
  white: "FFFFFF",
});

const STAGES = Object.freeze([
  {
    kind: "claims",
    title: "00–10 — 能源主張判讀｜任務條件先鎖定",
    short: "主張判讀",
    accent: "2D8C8A",
    pale: "EAF7F6",
    question: "W 低、完成快、bit/J 高：何者省？",
    decision: "vote → lock",
    operationShort: "投票→揭露→改判",
    evidenceShort: "任務契約＋判決",
    meaningShort: "服務邊界先固定",
    recoveryShort: "單位／邊界提示",
    fact: "W、J、bit/s、bit/J 分開",
    inference: "設計估計：3–4 頁＋1 活動",
    unknown: "cards／story stakes／novice timing 未驗證",
  },
  {
    kind: "tle",
    title: "10–18 — TLE 到 NTPU｜資料來源錨點",
    short: "TLE→NTPU",
    accent: "577F96",
    pale: "EEF5F8",
    question: "來源、模型、課程假設，怎麼分？",
    decision: "三段排序",
    operationShort: "排序三段 lineage",
    evidenceShort: "scenario_id＋合法窗口",
    meaningShort: "window 限制行動",
    recoveryShort: "resume／fallback",
    fact: "TLE 不含 power／traffic／energy",
    inference: "設計估計：3–4 頁＋1 操作",
    unknown: "scenario seam／fallback 未驗證",
  },
  {
    kind: "labA",
    title: "18–41 — Lab A｜同一任務，不同節奏",
    short: "Lab A｜同工異速",
    accent: "8064AE",
    pale: "F3EFFA",
    question: "低 W 或最快，哪個更少 J？",
    decision: "pace／balanced／burst",
    operationShort: "選策略→未見條件 replay",
    evidenceShort: "同一 clock ledger",
    meaningShort: "同邊界；不預設 winner",
    recoveryShort: "提示／反例",
    fact: "W、J、bit/s、bit/J 分欄",
    inference: "設計估計：5–6 頁＋1 lab",
    unknown: "state change／counterexample 未驗證",
  },
  {
    kind: "labB",
    title: "41–64 — Lab B｜現在行動，還是等待",
    short: "Lab B｜先行或等",
    accent: "C46F67",
    pale: "FAF0EE",
    question: "何時 switch 才守住服務並省 J？",
    decision: "Trace A → freeze",
    operationShort: "rewind→freeze→Trace B",
    evidenceShort: "state／service／J",
    meaningShort: "switch 不直接計能耗",
    recoveryShort: "rewind／known-good",
    fact: "switch count 非能耗項",
    inference: "設計估計：5–6 頁＋1 lab",
    unknown: "rule branch／withheld fairness 待驗",
  },
  {
    kind: "recovery",
    title: "64–69 — 回復與重整｜保住證據連續",
    short: "Recovery",
    accent: "60748F",
    pale: "F1F4F8",
    question: "能閉卷重建一條因果鏈嗎？",
    decision: "A／B 補一句",
    operationShort: "保存→閉卷重建",
    evidenceShort: "狀態＋因果句",
    meaningShort: "證據不中斷",
    recoveryShort: "提示／延伸反例",
    fact: "同一 workbook 可重開",
    inference: "設計估計：1–2 頁＋1 checkpoint",
    unknown: "20-seat resume 未驗證",
  },
  {
    kind: "labC",
    title: "69–92 — Lab C｜如何分配焦耳",
    short: "Lab C｜分配焦耳",
    accent: "3F9870",
    pale: "EDF8F2",
    question: "有限 J 與短窗口，資料怎麼排？",
    decision: "baseline → revise",
    operationShort: "排程→執行→修正→凍結",
    evidenceShort: "ledger：service／fresh／J",
    meaningShort: "urgent miss ≠ winner",
    recoveryShort: "非法時槽／自動補齊",
    fact: "service 與 freshness 分開",
    inference: "設計估計：6–7 頁＋1 lab；時序待核",
    unknown: "schedule state／withheld 未驗證",
  },
  {
    kind: "clinic",
    title: "92–106 — 證據檢核｜預測不等於節能",
    short: "Evidence clinic",
    accent: "8468B5",
    pale: "F3EFFA",
    question: "99% accuracy 能證明節能嗎？",
    decision: "leakage → freeze",
    operationShort: "時間戳→行動→replay",
    evidenceShort: "score ∥ service／J",
    meaningShort: "prediction ≠ saving",
    recoveryShort: "提示／誠實 fallback",
    fact: "模型分數非能耗公式項",
    inference: "設計估計：4–5 頁＋1 coherent case",
    unknown: "timestamp／held-out action 未驗證",
  },
  {
    kind: "transfer",
    title: "106–120 — 競賽轉移與離場｜讓主張可被推翻",
    short: "轉移／離場",
    accent: "328E98",
    pale: "ECF7F7",
    question: "換到新場景，主張如何被推翻？",
    decision: "domain → falsifier",
    operationShort: "映射→修正→匯出",
    evidenceShort: "hypothesis＋falsifier",
    meaningShort: "prediction→control→J",
    recoveryShort: "hint／system what-if",
    fact: "分析／預測後形成節能控制",
    inference: "設計估計：4–5 頁＋1 transfer",
    unknown: "causal transfer／novice timing 未驗證",
  },
]);

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

function bodyBox(template, box, label) {
  return assertWithin(template.bounds.body, box, label);
}

function addBodyText(slide, template, text, box, options = {}, label = "body text") {
  const fontSize = options.fontSize ?? TYPOGRAPHY.bodyPt;
  assertFontSize("body", fontSize, { allowBelowMinimum: ALLOW_TEXT_BELOW_MINIMUM });
  slide.addText(mixedRuns(text), {
    ...bodyBox(template, box, label),
    fontSize,
    color: options.color ?? COLORS.body,
    bold: options.bold ?? false,
    align: options.align ?? "left",
    valign: options.valign ?? "mid",
    margin: options.margin ?? 0,
    breakLine: false,
    paraSpaceAfterPt: 0,
  });
}

function addTitle(slide, template, text) {
  assertFontSize("title", TYPOGRAPHY.titlePt);
  slide.addText(mixedRuns(text), {
    ...assertWithin(template.bounds.title, template.bounds.title, "title"),
    fontSize: TYPOGRAPHY.titlePt,
    color: COLORS.ink,
    bold: true,
    align: "left",
    valign: "bottom",
    margin: 0,
    breakLine: false,
  });
}

function addStageTitle(pptx, slide, template, title) {
  const splitAt = title.indexOf(" — ");
  if (splitAt < 0) {
    addTitle(slide, template, title);
    return;
  }
  const time = title.slice(0, splitAt);
  const name = title.slice(splitAt + 3);
  assertFontSize("title", TYPOGRAPHY.titlePt);
  slide.addText(mixedRuns(time), {
    ...assertWithin(
      template.bounds.title,
      { x: 0.718057, y: 0.204514, w: 2.38, h: 0.525 },
      "stage time title",
    ),
    fontSize: TYPOGRAPHY.titlePt,
    color: COLORS.ink,
    bold: true,
    align: "left",
    valign: "bottom",
    margin: 0,
  });
  slide.addShape(pptx.ShapeType.line, {
    ...assertWithin(
      template.bounds.title,
      { x: 3.19, y: 0.29, w: 0, h: 0.34 },
      "stage title separator",
    ),
    line: { color: COLORS.ink, width: 1.5 },
  });
  slide.addText(mixedRuns(name), {
    ...assertWithin(
      template.bounds.title,
      { x: 3.43, y: 0.204514, w: 7.636667, h: 0.525 },
      "stage name title",
    ),
    fontSize: TYPOGRAPHY.titlePt,
    color: COLORS.ink,
    bold: true,
    align: "left",
    valign: "bottom",
    margin: 0,
  });
}

function addBodyShape(slide, template, shapeType, box, options, label = "shape") {
  slide.addShape(shapeType, {
    ...bodyBox(template, box, label),
    ...options,
  });
}

function addPanel(slide, template, pptx, box, fillColor, lineColor = COLORS.rule, width = 1.1, label = "panel") {
  addBodyShape(
    slide,
    template,
    pptx.ShapeType.roundRect,
    box,
    { fill: { color: fillColor }, line: { color: lineColor, width } },
    label,
  );
}

function addFlowLine(slide, template, pptx, x, y, w, h, color = COLORS.rule, width = 1.7, label = "flow line") {
  addBodyShape(
    slide,
    template,
    pptx.ShapeType.line,
    { x, y, w, h },
    { line: { color, width } },
    label,
  );
}

function addNumberCircle(slide, template, pptx, number, x, y, accent, label = "number marker") {
  addBodyShape(
    slide,
    template,
    pptx.ShapeType.ellipse,
    { x, y, w: 0.46, h: 0.46 },
    { fill: { color: accent }, line: { color: accent, width: 1 } },
    label,
  );
  addBodyText(
    slide,
    template,
    String(number),
    { x, y, w: 0.46, h: 0.46 },
    { color: COLORS.white, bold: true, align: "center", valign: "mid" },
    `${label} text`,
  );
}

function addQuestionDecisionBar(slide, template, pptx, stage) {
  const box = { x: 0.86, y: 1.05, w: 11.98, h: 0.69 };
  const questionLabel = stage.kind === "claims" ? "問題" : "驅動問題";
  addPanel(slide, template, pptx, box, stage.pale, stage.accent, 1.1, "question and decision bar");
  addBodyText(
    slide,
    template,
    `${questionLabel}｜${stage.question}`,
    { x: 1.04, y: 1.13, w: 6.72, h: 0.5 },
    { color: stage.accent, bold: true, valign: "mid" },
    "driving question",
  );
  addFlowLine(slide, template, pptx, 8.03, 1.14, 0, 0.48, COLORS.rule, 1.15, "question divider");
  addBodyText(
    slide,
    template,
    `預測／決策｜${stage.decision}`,
    { x: 8.27, y: 1.13, w: 4.3, h: 0.5 },
    { color: COLORS.body, bold: true, valign: "mid" },
    "learner decision",
  );
}

function addTimingStrip(slide, template, pptx, stage, entries) {
  const box = { x: 0.86, y: 1.82, w: 11.98, h: 0.42 };
  addPanel(slide, template, pptx, box, COLORS.quiet, COLORS.rule, 0.9, "timing estimate strip");
  const cellW = box.w / entries.length;
  entries.forEach((entry, index) => {
    const x = box.x + index * cellW;
    if (index > 0) {
      addFlowLine(slide, template, pptx, x, box.y + 0.05, 0, 0.32, COLORS.rule, 0.9, "timing divider");
    }
    addBodyText(
      slide,
      template,
      entry,
      { x: x + 0.06, y: box.y + 0.045, w: cellW - 0.12, h: 0.32 },
      { color: stage.accent, bold: true, align: "center", valign: "mid" },
      `timing entry ${index + 1}`,
    );
  });
}

function addFourCallouts(slide, template, pptx, stage) {
  const rail = { x: 0.78, y: 4.78, w: 12.16, h: 0.62 };
  addPanel(slide, template, pptx, rail, COLORS.white, COLORS.rule, 0.9, "learning contract rail");
  addFlowLine(slide, template, pptx, 6.86, 4.82, 0, 0.54, COLORS.rule, 0.9, "learning rail vertical divider");
  addFlowLine(slide, template, pptx, 0.9, 5.09, 11.92, 0, COLORS.rule, 0.9, "learning rail horizontal divider");
  const items = [
    { x: 0.98, y: 4.79, label: "操作", value: stage.operationShort },
    { x: 7.06, y: 4.79, label: "證據", value: stage.evidenceShort },
    { x: 0.98, y: 5.1, label: "意義", value: stage.meaningShort },
    { x: 7.06, y: 5.1, label: "回復", value: stage.recoveryShort },
  ];
  items.forEach((item) => {
    addBodyText(
      slide,
      template,
      `${item.label}｜${item.value}`,
      { x: item.x, y: item.y, w: 5.58, h: 0.29 },
      { color: stage.accent, bold: true, valign: "mid" },
      `${item.label} contract`,
    );
  });
}

function addClaimBand(pptx, slide, template, fact, inference, unknown, pale) {
  const band = { x: 0.78, y: 5.48, w: 12.16, h: 1.1 };
  addPanel(slide, template, pptx, band, pale, COLORS.rule, 0.9, "claim boundary band");
  for (const y of [5.84, 6.2]) {
    addFlowLine(slide, template, pptx, 0.9, y, 11.92, 0, COLORS.rule, 0.9, "claim row separator");
  }
  const rows = [
    { y: 5.51, label: "FACT", color: COLORS.fact, value: fact },
    { y: 5.87, label: "DESIGN INFERENCE", color: COLORS.inference, value: inference },
    { y: 6.23, label: "UNKNOWN", color: COLORS.unknown, value: unknown },
  ];
  for (const row of rows) {
    addBodyText(
      slide,
      template,
      `${row.label}｜${row.value}`,
      { x: 0.98, y: row.y, w: 11.64, h: 0.3 },
      { color: row.color, bold: true, valign: "mid" },
      `${row.label} claim row`,
    );
  }
}

function addCompactClaimFooter(pptx, slide, template, fact, inference, unknown, pale) {
  const items = [
    { x: 0.82, w: 3.65, label: "FACT", value: fact, color: COLORS.fact, fill: "F3F8F6" },
    { x: 4.6, w: 4.25, label: "DESIGN INFERENCE", value: inference, color: COLORS.inference, fill: pale },
    { x: 8.98, w: 3.84, label: "UNKNOWN", value: unknown, color: COLORS.unknown, fill: "FAF3F4" },
  ];
  items.forEach((item, index) => {
    assertFontSize("body", 13.8, { allowBelowMinimum: ALLOW_TEXT_BELOW_MINIMUM });
    const labelRuns = mixedRuns(`\u00A0\u00A0${item.label}`, {
      fontSize: 11.8,
      color: item.color,
      bold: true,
    });
    labelRuns[labelRuns.length - 1].options.breakLine = true;
    const valueRuns = mixedRuns(`\u00A0\u00A0${item.value}`, {
      fontSize: 13.8,
      color: item.color,
      bold: true,
    });
    slide.addText([...labelRuns, ...valueRuns], {
      ...bodyBox(template, { x: item.x, y: 5.86, w: item.w, h: 0.66 }, `compact claim ${index + 1}`),
      fontSize: 13.8,
      color: item.color,
      bold: true,
      fill: { color: item.fill },
      line: { color: item.color, width: 0.8 },
      margin: [0.06, 0.14, 0.04, 0.14],
      valign: "mid",
      align: "left",
      paraSpaceAfterPt: 0,
    });
  });
}

function addClaimsSlide(pptx, template, stage) {
  const slide = pptx.addSlide({ masterName: template.masters.content });
  addStageTitle(pptx, slide, template, stage.title);

  addBodyText(slide, template, "問題｜低 W、快完成、高 bit/J：固定服務條件後，哪個主張才可判？", { x: 0.82, y: 1.06, w: 12.0, h: 0.42 }, { fontSize: 20.5, color: stage.accent, bold: true }, "claim adjudication question");

  addBodyShape(slide, template, pptx.ShapeType.rect, { x: 0.82, y: 1.66, w: 3.28, h: 3.92 }, { fill: { color: stage.accent }, line: { color: stage.accent, width: 1.1 } }, "mission contract panel");
  addBodyText(slide, template, "任務契約", { x: 1.08, y: 1.9, w: 2.76, h: 0.42 }, { fontSize: 23, color: COLORS.white, bold: true, align: "center" }, "mission contract title");
  addBodyText(slide, template, "MISSION CONTRACT", { x: 1.08, y: 2.33, w: 2.76, h: 0.23 }, { fontSize: 14, color: "D6ECE9", bold: true, align: "center" }, "mission contract subtitle");
  const contractFields = ["payload（工作量）", "deadline（期限）", "閒置／喚醒邊界", "單位／時間窗"];
  contractFields.forEach((field, index) => {
    const y = 2.78 + index * 0.48;
    if (index > 0) {
      addFlowLine(slide, template, pptx, 1.17, y - 0.07, 2.58, 0, "78A6A3", 0.8, `mission contract divider ${index}`);
    }
    addBodyText(slide, template, field, { x: 1.1, y, w: 2.72, h: 0.32 }, { fontSize: 16.5, color: COLORS.white, bold: true, align: "center" }, `mission contract field ${index + 1}`);
  });
  addBodyShape(slide, template, pptx.ShapeType.rect, { x: 1.1, y: 4.72, w: 2.72, h: 0.52 }, { fill: { color: COLORS.white }, line: { color: COLORS.white, width: 0.8 } }, "comparable gate");
  addBodyText(slide, template, "COMPARABLE?", { x: 1.22, y: 4.82, w: 2.48, h: 0.26 }, { fontSize: 17.5, color: stage.accent, bold: true, align: "center" }, "comparable gate text");
  addBodyText(slide, template, "條件不同 → INCOMPARABLE", { x: 1.02, y: 5.31, w: 2.88, h: 0.22 }, { fontSize: 13.8, color: COLORS.white, bold: true, align: "center" }, "mission comparability warning");

  const columns = [
    { x: 4.34, w: 2.72, label: "待判主張" },
    { x: 7.06, w: 2.66, label: "揭露後看" },
    { x: 9.72, w: 3.1, label: "圈 A／Q／R，再標信心" },
  ];
  columns.forEach((column, index) => {
    addBodyShape(slide, template, pptx.ShapeType.rect, { x: column.x, y: 1.66, w: column.w, h: 0.48 }, { fill: { color: index === 2 ? COLORS.ink : stage.accent }, line: { color: COLORS.white, width: 0.6 } }, `claim board header ${index + 1}`);
    addBodyText(slide, template, column.label, { x: column.x + 0.12, y: 1.75, w: column.w - 0.24, h: 0.28 }, { fontSize: index === 2 ? 14.2 : 16.2, color: COLORS.white, bold: true, align: "center" }, `claim board header ${index + 1} text`);
  });

  const claimRows = [
    { y: 2.14, fill: "F2F8F7", claim: "A｜平均 W 較低", evidence: "service_pass\n期限內且符合條件", color: COLORS.fact },
    { y: 3.08, fill: "F7F4F9", claim: "B｜較快完成", evidence: "active time＋完成時間", color: COLORS.inference },
    { y: 4.02, fill: "FAF3F4", claim: "C｜bit/J 高但漏 deadline", evidence: "送達位元數\n逾期＝服務不合格", color: COLORS.unknown },
  ];
  claimRows.forEach((row, index) => {
    addBodyShape(slide, template, pptx.ShapeType.rect, { x: 4.34, y: row.y, w: 8.48, h: 0.86 }, { fill: { color: row.fill }, line: { color: COLORS.rule, width: 0.8 } }, `claim row ${index + 1}`);
    addFlowLine(slide, template, pptx, 7.06, row.y, 0, 0.86, COLORS.rule, 0.8, `claim evidence divider ${index + 1}`);
    addFlowLine(slide, template, pptx, 9.72, row.y, 0, 0.86, COLORS.rule, 0.8, `claim verdict divider ${index + 1}`);
    addBodyText(slide, template, row.claim, { x: 4.56, y: row.y + 0.2, w: 2.28, h: 0.46 }, { fontSize: 18, color: COLORS.body, bold: true, valign: "mid" }, `claim row ${index + 1} claim`);
    addBodyText(slide, template, row.evidence, { x: 7.23, y: row.y + 0.2, w: 2.32, h: 0.46 }, { fontSize: 15.5, color: row.color, bold: true, align: "center", valign: "mid" }, `claim row ${index + 1} evidence`);
    addBodyText(slide, template, "○ A      ○ Q      ○ R", { x: 9.91, y: row.y + 0.14, w: 2.72, h: 0.28 }, { fontSize: 16.2, color: row.color, bold: true, align: "center" }, `claim row ${index + 1} verdict`);
    addBodyText(slide, template, "信心：低／中／高", { x: 9.91, y: row.y + 0.5, w: 2.72, h: 0.2 }, { fontSize: 13.8, color: COLORS.muted, bold: true, align: "center" }, `claim row ${index + 1} confidence`);
  });

  addBodyShape(slide, template, pptx.ShapeType.rect, { x: 4.34, y: 5.04, w: 8.48, h: 0.48 }, { fill: { color: stage.pale }, line: { color: stage.accent, width: 0.9 } }, "claim decision loop");
  addBodyText(slide, template, "初判 → 鎖定條件 → 揭露 J／時間／服務 → 只改判 1 次", { x: 4.55, y: 5.13, w: 8.06, h: 0.28 }, { fontSize: 16.2, color: stage.accent, bold: true, align: "center" }, "claim decision loop text");
  addBodyText(slide, template, "回復：單位提示／邊界重設", { x: 4.34, y: 5.57, w: 8.48, h: 0.2 }, { fontSize: 14.2, color: COLORS.muted, bold: true, align: "right" }, "claim recovery");
  addCompactClaimFooter(
    pptx,
    slide,
    template,
    "W≠J；bit/J 不取代 service_pass",
    "設計估計：3–4 頁＋1 活動",
    "卡片敘事／新手時間未驗證",
    stage.pale,
  );
  return slide;
}

function addTleSlide(pptx, template, stage) {
  const slide = pptx.addSlide({ masterName: template.masters.content });
  addStageTitle(pptx, slide, template, stage.title);
  addBodyText(slide, template, "問題｜來源、模型產物與課程假設，怎麼分？", { x: 0.82, y: 1.06, w: 7.5, h: 0.42 }, { fontSize: 20.5, color: stage.accent, bold: true }, "TLE question");
  addBodyText(slide, template, "先判斷｜三段 lineage 排序", { x: 8.45, y: 1.08, w: 4.37, h: 0.34 }, { fontSize: 15.5, color: stage.accent, bold: true, align: "right" }, "TLE learner decision");

  const river = [
    { x: 0.82, w: 3.58, label: "SOURCE", title: "pinned TLE", body: "epoch／identity", color: stage.accent, fill: "F3F7F9" },
    { x: 4.64, w: 3.58, label: "MODEL", title: "NTPU service window", body: "可服務的時間區間", color: COLORS.fact, fill: "F0F7F5" },
    { x: 8.46, w: 4.36, label: "COURSE", title: "traffic／power", body: "freshness／deadline", color: COLORS.inference, fill: "F4F1F8" },
  ];
  river.forEach((item, index) => {
    addPanel(slide, template, pptx, { x: item.x, y: 1.66, w: item.w, h: 1.42 }, item.fill, item.color, 1.15, `TLE river ${index + 1}`);
    addBodyText(slide, template, item.label, { x: item.x + 0.18, y: 1.82, w: item.w - 0.36, h: 0.24 }, { fontSize: 14.5, color: item.color, bold: true, align: "center" }, `TLE river ${index + 1} label`);
    addBodyText(slide, template, item.title, { x: item.x + 0.18, y: 2.13, w: item.w - 0.36, h: 0.35 }, { fontSize: 19, color: COLORS.body, bold: true, align: "center" }, `TLE river ${index + 1} title`);
    addBodyText(slide, template, item.body, { x: item.x + 0.18, y: 2.58, w: item.w - 0.36, h: 0.28 }, { fontSize: 15.5, color: item.color, bold: true, align: "center" }, `TLE river ${index + 1} body`);
    if (index < river.length - 1) {
      addFlowLine(slide, template, pptx, item.x + item.w, 2.37, 0.24, 0, COLORS.ink, 2.1, `TLE river connector ${index + 1}`);
    }
  });

  addBodyText(slide, template, "同一 scenario_id 貫穿後續實驗", { x: 0.96, y: 3.26, w: 11.72, h: 0.32 }, { fontSize: 17, color: stage.accent, bold: true, align: "center" }, "TLE scenario spine");
  addBodyShape(slide, template, pptx.ShapeType.rect, { x: 0.82, y: 3.72, w: 2.65, h: 0.72 }, { fill: { color: "F0F2F5" }, line: { color: "7B8492", width: 0.9 } }, "TLE outside left");
  addBodyShape(slide, template, pptx.ShapeType.rect, { x: 3.47, y: 3.72, w: 5.52, h: 0.72 }, { fill: { color: "DDEFEA" }, line: { color: COLORS.fact, width: 1.2 } }, "TLE legal interval");
  addBodyShape(slide, template, pptx.ShapeType.rect, { x: 8.99, y: 3.72, w: 3.83, h: 0.72 }, { fill: { color: "F0F2F5" }, line: { color: "7B8492", width: 0.9 } }, "TLE outside right");
  addBodyText(slide, template, "OUTSIDE", { x: 0.96, y: 3.94, w: 2.37, h: 0.28 }, { fontSize: 16, color: COLORS.muted, bold: true, align: "center" }, "TLE outside left label");
  addBodyText(slide, template, "LEGAL WINDOW｜send／wait", { x: 3.7, y: 3.94, w: 5.06, h: 0.28 }, { fontSize: 18, color: COLORS.fact, bold: true, align: "center" }, "TLE legal interval label");
  addBodyText(slide, template, "OUTSIDE", { x: 9.2, y: 3.94, w: 3.4, h: 0.28 }, { fontSize: 16, color: COLORS.muted, bold: true, align: "center" }, "TLE outside right label");

  addPanel(slide, template, pptx, { x: 0.82, y: 4.68, w: 7.18, h: 0.78 }, COLORS.white, stage.accent, 1.0, "TLE operation panel");
  addBodyText(slide, template, "操作｜排序 source／model／assumption；檢查合法區間", { x: 1.05, y: 4.83, w: 6.72, h: 0.28 }, { fontSize: 16.5, color: stage.accent, bold: true, align: "center" }, "TLE operation");
  addBodyText(slide, template, "意義｜window 先限制可採取的行動", { x: 1.05, y: 5.13, w: 6.72, h: 0.22 }, { fontSize: 14.5, color: COLORS.muted, bold: true, align: "center" }, "TLE meaning");
  addPanel(slide, template, pptx, { x: 8.22, y: 4.68, w: 4.6, h: 0.78 }, stage.pale, stage.accent, 1.0, "TLE evidence panel");
  addBodyText(slide, template, "證據｜scenario_id＋合法窗口", { x: 8.44, y: 4.83, w: 4.16, h: 0.28 }, { fontSize: 16.5, color: stage.accent, bold: true, align: "center" }, "TLE evidence");
  addBodyText(slide, template, "回復｜resume／fallback", { x: 8.44, y: 5.13, w: 4.16, h: 0.22 }, { fontSize: 14.5, color: COLORS.muted, bold: true, align: "center" }, "TLE recovery");

  addCompactClaimFooter(pptx, slide, template, "TLE 不含 power／traffic／energy", "設計估計：3–4 頁＋1 操作", "scenario seam／fallback 未驗證", stage.pale);
  return slide;
}

function addLabASlide(pptx, template, stage) {
  const slide = pptx.addSlide({ masterName: template.masters.content });
  addStageTitle(pptx, slide, template, stage.title);

  addBodyText(slide, template, "問題｜同工、同期限：哪種節奏耗 J 較少？", { x: 0.82, y: 1.06, w: 7.65, h: 0.42 }, { fontSize: 20.5, color: stage.accent, bold: true }, "Lab A question");
  addBodyText(slide, template, "先預測｜慢速／平衡／高速後休眠", { x: 8.62, y: 1.08, w: 4.2, h: 0.36 }, { fontSize: 15.5, color: stage.accent, bold: true, align: "right" }, "Lab A prediction");

  addBodyShape(slide, template, pptx.ShapeType.rect, { x: 0.82, y: 1.58, w: 12.0, h: 0.43 }, { fill: { color: COLORS.ink }, line: { color: COLORS.ink, width: 0.8 } }, "Lab A locked comparison");
  addBodyText(slide, template, "固定比較｜資料量・期限・系統邊界相同", { x: 1.04, y: 1.66, w: 6.35, h: 0.27 }, { fontSize: 15.2, color: COLORS.white, bold: true }, "Lab A locked comparison text");
  addBodyText(slide, template, "設計估計｜5 示範／11 操作／5 解釋／2 轉場", { x: 7.4, y: 1.66, w: 5.2, h: 0.27 }, { fontSize: 14.3, color: "E7D9E8", bold: true, align: "right" }, "Lab A timing estimate");

  addFlowLine(slide, template, pptx, 3.05, 2.35, 6.35, 0, COLORS.ink, 1.1, "Lab A shared time axis");
  addBodyText(slide, template, "共同時間軸｜示意、非量測", { x: 4.47, y: 2.12, w: 2.85, h: 0.24 }, { fontSize: 14, color: COLORS.muted, bold: true, align: "center" }, "Lab A axis note");
  addFlowLine(slide, template, pptx, 9.4, 2.2, 0, 2.42, COLORS.unknown, 1.3, "Lab A deadline");
  addBodyText(slide, template, "deadline", { x: 8.18, y: 2.12, w: 1.05, h: 0.22 }, { fontSize: 14, color: COLORS.unknown, bold: true, align: "right" }, "Lab A deadline label");

  const lanes = [
    { label: "慢速\n低 W／時間長", yBase: 2.98, activeW: 5.58, barH: 0.2, color: "3F7772" },
    { label: "平衡\n中 W／時間中", yBase: 3.72, activeW: 4.38, barH: 0.34, color: "4E6380" },
    { label: "高速後休眠\n高 W／時間短", yBase: 4.46, activeW: 3.02, barH: 0.5, color: COLORS.inference },
  ];
  lanes.forEach((lane, index) => {
    addBodyText(slide, template, lane.label, { x: 0.84, y: lane.yBase - 0.5, w: 1.92, h: 0.46 }, { fontSize: 15.3, color: lane.color, bold: true, align: "right", valign: "mid" }, `Lab A lane ${index + 1} label`);
    addFlowLine(slide, template, pptx, 3.05, lane.yBase, 6.35, 0, COLORS.rule, 1.0, `Lab A lane ${index + 1} baseline`);
    addBodyShape(slide, template, pptx.ShapeType.rect, { x: 3.05, y: lane.yBase - lane.barH, w: lane.activeW, h: lane.barH }, { fill: { color: lane.color, transparency: 10 }, line: { color: lane.color, width: 0.8 } }, `Lab A lane ${index + 1} active footprint`);
    addBodyShape(slide, template, pptx.ShapeType.rect, { x: 3.05 + lane.activeW, y: lane.yBase - 0.09, w: 6.35 - lane.activeW, h: 0.09 }, { fill: { color: "BFDCD2" }, line: { color: COLORS.fact, width: 0.4 } }, `Lab A lane ${index + 1} sleep interval`);
    addBodyShape(slide, template, pptx.ShapeType.ellipse, { x: 3.05 + lane.activeW - 0.1, y: lane.yBase - 0.1, w: 0.2, h: 0.2 }, { fill: { color: COLORS.white }, line: { color: lane.color, width: 1.1 } }, `Lab A lane ${index + 1} completion marker`);
  });

  addBodyShape(slide, template, pptx.ShapeType.rect, { x: 9.72, y: 2.2, w: 3.1, h: 2.42 }, { fill: { color: stage.pale }, line: { color: stage.accent, width: 1.0 } }, "Lab A evidence panel");
  addBodyText(slide, template, "回放後自動填入", { x: 9.96, y: 2.43, w: 2.62, h: 0.34 }, { fontSize: 18, color: stage.accent, bold: true, align: "center" }, "Lab A evidence panel title");
  addBodyText(slide, template, "service_pass\nconsumed J\nbit/J\n完成時刻", { x: 10.08, y: 2.96, w: 2.38, h: 1.3 }, { fontSize: 16.2, color: COLORS.body, bold: true, align: "center", valign: "mid" }, "Lab A evidence fields");
  addBodyText(slide, template, "同一時間帳本", { x: 10.08, y: 4.28, w: 2.38, h: 0.22 }, { fontSize: 14, color: COLORS.muted, bold: true, align: "center" }, "Lab A evidence ledger note");

  addBodyShape(slide, template, pptx.ShapeType.rect, { x: 0.82, y: 4.86, w: 4.04, h: 0.56 }, { fill: { color: COLORS.unknown }, line: { color: COLORS.unknown, width: 0.8 } }, "Lab A hidden condition");
  addBodyText(slide, template, "待驗證條件｜固定／閒置／喚醒成本", { x: 1.02, y: 4.97, w: 3.64, h: 0.32 }, { fontSize: 15.5, color: COLORS.white, bold: true, align: "center" }, "Lab A hidden condition text");
  addPanel(slide, template, pptx, { x: 5.08, y: 4.86, w: 3.18, h: 0.56 }, stage.pale, stage.accent, 1.0, "Lab A replay operation");
  addBodyText(slide, template, "鎖定策略 → 回放", { x: 5.28, y: 4.97, w: 2.78, h: 0.32 }, { fontSize: 16, color: stage.accent, bold: true, align: "center" }, "Lab A replay operation text");
  addPanel(slide, template, pptx, { x: 8.48, y: 4.86, w: 4.34, h: 0.56 }, "F4F1F8", COLORS.inference, 1.0, "Lab A ranking inference");
  addBodyText(slide, template, "設計推論｜排序可能翻轉", { x: 8.68, y: 4.97, w: 3.94, h: 0.32 }, { fontSize: 15.5, color: COLORS.inference, bold: true, align: "center" }, "Lab A ranking inference text");
  addBodyText(slide, template, "意義｜低 W 與最快完成都沒有永遠的贏家　　回復｜同一 scenario 反例重設", { x: 0.84, y: 5.54, w: 11.96, h: 0.24 }, { fontSize: 14.2, color: COLORS.muted, bold: true, align: "center" }, "Lab A meaning and recovery");
  addCompactClaimFooter(
    pptx,
    slide,
    template,
    "同工／同期限／同邊界",
    "設計估計：5–6 頁＋1 lab",
    "回放／翻轉尚未驗證",
    stage.pale,
  );
  return slide;
}

function addLabBSlide(pptx, template, stage) {
  const slide = pptx.addSlide({ masterName: template.masters.content });
  addStageTitle(pptx, slide, template, stage.title);
  addBodyText(slide, template, "問題｜何時切換，才能守住服務並減少 J？", { x: 0.82, y: 1.06, w: 7.55, h: 0.42 }, { fontSize: 20.5, color: stage.accent, bold: true }, "Lab B question");
  addBodyText(slide, template, "先決定｜switch now／wait／remain", { x: 8.38, y: 1.08, w: 4.44, h: 0.34 }, { fontSize: 15.5, color: stage.accent, bold: true, align: "right" }, "Lab B learner decision");

  addBodyShape(slide, template, pptx.ShapeType.rect, { x: 0.82, y: 1.58, w: 12.0, h: 0.44 }, { fill: { color: COLORS.ink }, line: { color: COLORS.ink, width: 0.8 } }, "Lab B timing bar");
  addBodyText(slide, template, "設計估計｜5 示範 · 11 操作 · 5 解釋 · 2 轉場", { x: 1.04, y: 1.66, w: 5.82, h: 0.27 }, { fontSize: 14.5, color: COLORS.white, bold: true }, "Lab B timing estimate");
  addBodyText(slide, template, "同一規則、兩段未知未來", { x: 7.08, y: 1.66, w: 5.52, h: 0.27 }, { fontSize: 15.2, color: "DCEAF1", bold: true, align: "right" }, "Lab B trace premise");

  addPanel(slide, template, pptx, { x: 0.82, y: 2.22, w: 12.0, h: 2.18 }, COLORS.white, stage.accent, 1.15, "Lab B two-lane replay");
  addBodyText(slide, template, "共同時間軸｜先在 Trace A 鎖定規則，再回放 Trace B", { x: 3.0, y: 2.36, w: 9.5, h: 0.28 }, { fontSize: 15, color: COLORS.muted, bold: true, align: "center" }, "Lab B shared axis note");
  addBodyText(slide, template, "TRACE A", { x: 1.06, y: 2.73, w: 1.46, h: 0.28 }, { fontSize: 18, color: stage.accent, bold: true }, "Lab B Trace A label");
  addBodyText(slide, template, "做決策並鎖定", { x: 1.06, y: 3.03, w: 1.62, h: 0.23 }, { fontSize: 13.8, color: stage.accent, bold: true }, "Lab B Trace A action");
  addFlowLine(slide, template, pptx, 3.0, 3.04, 9.34, 0, COLORS.rule, 1.5, "Lab B Trace A axis");
  [3.62, 5.05, 6.44, 8.18, 10.7].forEach((x, index) => {
    const y = index % 2 === 0 ? 2.92 : 3.0;
    addBodyShape(slide, template, pptx.ShapeType.ellipse, { x, y, w: 0.22, h: 0.22 }, { fill: { color: stage.accent }, line: { color: stage.accent, width: 0.6 } }, `Lab B Trace A point ${index + 1}`);
  });
  addBodyShape(slide, template, pptx.ShapeType.line, { x: 6.53, y: 2.7, w: 0, h: 0.68 }, { line: { color: COLORS.ink, width: 1.6, dashType: "dash" } }, "Lab B decision lock marker");
  addBodyText(slide, template, "LOCK", { x: 6.11, y: 2.68, w: 0.84, h: 0.22 }, { fontSize: 13.5, color: COLORS.ink, bold: true, align: "center" }, "Lab B decision lock label");

  addBodyText(slide, template, "TRACE B", { x: 1.06, y: 3.52, w: 1.46, h: 0.28 }, { fontSize: 18, color: COLORS.inference, bold: true }, "Lab B Trace B label");
  addBodyText(slide, template, "不重調規則", { x: 1.06, y: 3.82, w: 1.62, h: 0.23 }, { fontSize: 13.8, color: COLORS.inference, bold: true }, "Lab B Trace B action");
  addFlowLine(slide, template, pptx, 3.0, 3.83, 9.34, 0, COLORS.rule, 1.5, "Lab B Trace B axis");
  const traceBPoints = [
    { x: 3.55, y: 3.72 }, { x: 4.92, y: 3.55 }, { x: 6.2, y: 3.78 }, { x: 7.62, y: 3.48 }, { x: 9.35, y: 3.69 }, { x: 11.52, y: 3.5 },
  ];
  traceBPoints.forEach((point, index) => {
    addBodyShape(slide, template, pptx.ShapeType.ellipse, { x: point.x, y: point.y, w: 0.22, h: 0.22 }, { fill: { color: COLORS.inference }, line: { color: COLORS.inference, width: 0.6 } }, `Lab B Trace B point ${index + 1}`);
  });

  addPanel(slide, template, pptx, { x: 0.82, y: 4.64, w: 7.22, h: 0.82 }, stage.pale, stage.accent, 1.05, "Lab B frozen rule path");
  addBodyText(slide, template, "操作｜rewind → freeze rule → Trace B（NO RETUNE）", { x: 1.05, y: 4.78, w: 6.76, h: 0.3 }, { fontSize: 16.2, color: stage.accent, bold: true, align: "center" }, "Lab B operation");
  addBodyText(slide, template, "意義｜link choice → active time／service → J", { x: 1.05, y: 5.1, w: 6.76, h: 0.24 }, { fontSize: 14.5, color: COLORS.muted, bold: true, align: "center" }, "Lab B meaning");
  addPanel(slide, template, pptx, { x: 8.26, y: 4.64, w: 4.56, h: 0.82 }, COLORS.white, stage.accent, 1.05, "Lab B evidence and recovery");
  addBodyText(slide, template, "證據｜state＋service＋J", { x: 8.49, y: 4.78, w: 4.1, h: 0.3 }, { fontSize: 16.2, color: stage.accent, bold: true, align: "center" }, "Lab B evidence");
  addBodyText(slide, template, "回復｜rewind／known-good", { x: 8.49, y: 5.1, w: 4.1, h: 0.24 }, { fontSize: 14.5, color: COLORS.muted, bold: true, align: "center" }, "Lab B recovery");

  addCompactClaimFooter(pptx, slide, template, "switch count 非能耗項", "設計估計：5–6 頁＋1 lab", "rule branch／withheld fairness 待驗", stage.pale);
  return slide;
}

function addRecoverySlide(pptx, template, stage) {
  const slide = pptx.addSlide({ masterName: template.masters.content });
  addStageTitle(pptx, slide, template, stage.title);
  addBodyText(slide, template, "問題｜能否閉卷重建一條完整因果鏈？", { x: 0.82, y: 1.06, w: 7.4, h: 0.42 }, { fontSize: 20.5, color: stage.accent, bold: true }, "recovery question");
  addBodyText(slide, template, "決定｜補一個缺口，再重建", { x: 8.3, y: 1.08, w: 4.52, h: 0.34 }, { fontSize: 15.5, color: stage.accent, bold: true, align: "right" }, "recovery learner decision");

  const chain = [
    { x: 0.82, w: 2.12, title: "SAVE", body: "保存 Workbook", fill: stage.pale, color: stage.accent },
    { x: 3.24, w: 3.06, title: "STATE＋ACTION", body: "當時狀態＋採取動作", fill: COLORS.white, color: stage.accent },
    { x: 6.6, w: 2.28, title: "PATH", body: "系統路徑", fill: COLORS.white, color: stage.accent },
    { x: 9.18, w: 3.64, title: "SERVICE／J", body: "服務結果＋累積能量", fill: "F4F1F8", color: COLORS.inference },
  ];
  chain.forEach((item, index) => {
    addPanel(slide, template, pptx, { x: item.x, y: 1.76, w: item.w, h: 1.38 }, item.fill, item.color, 1.35, `recovery causal node ${index + 1}`);
    addBodyText(slide, template, item.title, { x: item.x + 0.16, y: 2.03, w: item.w - 0.32, h: 0.38 }, { fontSize: 20, color: item.color, bold: true, align: "center" }, `recovery causal node ${index + 1} title`);
    addBodyText(slide, template, item.body, { x: item.x + 0.16, y: 2.5, w: item.w - 0.32, h: 0.3 }, { fontSize: 14.8, color: COLORS.body, bold: true, align: "center" }, `recovery causal node ${index + 1} body`);
    if (index < chain.length - 1) {
      addFlowLine(slide, template, pptx, item.x + item.w, 2.45, 0.3, 0, COLORS.ink, 2.2, `recovery causal connector ${index + 1}`);
    }
  });

  addPanel(slide, template, pptx, { x: 0.82, y: 3.5, w: 12.0, h: 1.0 }, COLORS.quiet, COLORS.rule, 1.0, "recovery choice strip");
  addFlowLine(slide, template, pptx, 6.82, 3.62, 0, 0.76, COLORS.rule, 1.0, "recovery choice divider");
  addBodyText(slide, template, "需要協助", { x: 1.08, y: 3.68, w: 5.46, h: 0.28 }, { fontSize: 17.5, color: stage.accent, bold: true, align: "center" }, "recovery support title");
  addBodyText(slide, template, "hint → reset → resume", { x: 1.08, y: 4.03, w: 5.46, h: 0.28 }, { fontSize: 15.2, color: COLORS.body, bold: true, align: "center" }, "recovery support path");
  addBodyText(slide, template, "已能重建", { x: 7.08, y: 3.68, w: 5.46, h: 0.28 }, { fontSize: 17.5, color: COLORS.inference, bold: true, align: "center" }, "recovery stretch title");
  addBodyText(slide, template, "可選｜做 boundary 反例", { x: 7.08, y: 4.03, w: 5.46, h: 0.28 }, { fontSize: 15.2, color: COLORS.body, bold: true, align: "center" }, "recovery stretch path");

  addPanel(slide, template, pptx, { x: 0.82, y: 4.76, w: 12.0, h: 0.72 }, stage.pale, stage.accent, 1.05, "recovery operation evidence rail");
  addFlowLine(slide, template, pptx, 6.82, 4.85, 0, 0.54, COLORS.rule, 1.0, "recovery operation evidence divider");
  addBodyText(slide, template, "操作｜保存 → 閉卷重建", { x: 1.05, y: 4.93, w: 5.54, h: 0.28 }, { fontSize: 16.5, color: stage.accent, bold: true, align: "center" }, "recovery operation");
  addBodyText(slide, template, "證據｜狀態＋因果句；證據不中斷", { x: 7.05, y: 4.93, w: 5.54, h: 0.28 }, { fontSize: 16.5, color: stage.accent, bold: true, align: "center" }, "recovery evidence");

  addCompactClaimFooter(pptx, slide, template, "同一 workbook 可重開", "設計估計：1–2 頁＋1 checkpoint", "20-seat resume 未驗證", stage.pale);
  return slide;
}

function addLabCSlide(pptx, template, stage) {
  const slide = pptx.addSlide({ masterName: template.masters.content });
  addStageTitle(pptx, slide, template, stage.title);
  addBodyText(slide, template, "問題｜有限 J 與短窗口下，哪些資料先送？", { x: 0.82, y: 1.06, w: 7.52, h: 0.42 }, { fontSize: 20.5, color: stage.accent, bold: true }, "Lab C question");
  addBodyText(slide, template, "先排｜baseline → revise", { x: 8.45, y: 1.08, w: 4.37, h: 0.34 }, { fontSize: 15.5, color: stage.accent, bold: true, align: "right" }, "Lab C learner prediction");

  addBodyShape(slide, template, pptx.ShapeType.rect, { x: 0.82, y: 1.58, w: 12.0, h: 0.44 }, { fill: { color: COLORS.ink }, line: { color: COLORS.ink, width: 0.8 } }, "Lab C timing bar");
  addBodyText(slide, template, "設計估計｜6 baseline · 10 排程 · 5 修正／withheld · 2 解釋", { x: 1.04, y: 1.66, w: 11.56, h: 0.27 }, { fontSize: 14.5, color: COLORS.white, bold: true, align: "center" }, "Lab C timing estimate");

  addPanel(slide, template, pptx, { x: 0.82, y: 2.22, w: 2.34, h: 2.18 }, "F3F7F5", stage.accent, 1.15, "Lab C baseline");
  addBodyText(slide, template, "BASELINE", { x: 1.02, y: 2.55, w: 1.94, h: 0.35 }, { fontSize: 19, color: stage.accent, bold: true, align: "center" }, "Lab C baseline title");
  addBodyText(slide, template, "立即傳送", { x: 1.02, y: 3.07, w: 1.94, h: 0.35 }, { fontSize: 17, color: COLORS.body, bold: true, align: "center" }, "Lab C baseline action");
  addBodyText(slide, template, "記錄 service／J", { x: 1.02, y: 3.6, w: 1.94, h: 0.32 }, { fontSize: 14.5, color: COLORS.muted, bold: true, align: "center" }, "Lab C baseline evidence");

  addPanel(slide, template, pptx, { x: 3.46, y: 2.22, w: 5.54, h: 2.18 }, stage.pale, stage.accent, 1.25, "Lab C schedule board");
  addBodyText(slide, template, "SCHEDULE｜1–2 fixed · 3–6 action", { x: 3.7, y: 2.44, w: 5.06, h: 0.34 }, { fontSize: 18, color: stage.accent, bold: true, align: "center" }, "Lab C schedule title");
  [1, 2, 3, 4, 5, 6].forEach((slotNumber, index) => {
    const x = 3.78 + index * 0.8;
    const fixed = index < 2;
    const fill = fixed ? "EDE9F4" : "DDEFEA";
    const color = fixed ? COLORS.inference : COLORS.fact;
    addBodyShape(slide, template, pptx.ShapeType.rect, { x, y: 3.0, w: 0.64, h: 0.64 }, { fill: { color: fill }, line: { color, width: 1.1 } }, `Lab C slot ${index + 1}`);
    addBodyText(slide, template, String(slotNumber), { x, y: 3.13, w: 0.64, h: 0.32 }, { fontSize: 17, color, bold: true, align: "center" }, `Lab C slot ${index + 1} text`);
  });
  addBodyText(slide, template, "send · batch · wait · sleep", { x: 3.72, y: 3.88, w: 5.02, h: 0.28 }, { fontSize: 16, color: COLORS.body, bold: true, align: "center" }, "Lab C schedule actions");

  addPanel(slide, template, pptx, { x: 9.3, y: 2.22, w: 3.52, h: 2.18 }, "F4F1F8", COLORS.inference, 1.15, "Lab C withheld replay");
  addBodyText(slide, template, "WITHHELD", { x: 9.52, y: 2.55, w: 3.08, h: 0.35 }, { fontSize: 19, color: COLORS.inference, bold: true, align: "center" }, "Lab C withheld title");
  addBodyText(slide, template, "freeze → 回放", { x: 9.52, y: 3.06, w: 3.08, h: 0.34 }, { fontSize: 17, color: COLORS.inference, bold: true, align: "center" }, "Lab C withheld freeze");
  addBodyText(slide, template, "shorter window＋urgent", { x: 9.52, y: 3.58, w: 3.08, h: 0.36 }, { fontSize: 14.8, color: COLORS.body, bold: true, align: "center" }, "Lab C withheld event");

  addPanel(slide, template, pptx, { x: 0.82, y: 4.64, w: 12.0, h: 0.52 }, COLORS.white, stage.accent, 1.0, "Lab C ledger");
  addBodyText(slide, template, "LEDGER｜baseline ↔ learner ↔ withheld｜service · freshness · J", { x: 1.05, y: 4.74, w: 11.54, h: 0.3 }, { fontSize: 16.5, color: stage.accent, bold: true, align: "center" }, "Lab C ledger text");
  addBodyText(slide, template, "操作｜排程 → 執行 → 修正 → 凍結", { x: 0.98, y: 5.34, w: 4.0, h: 0.25 }, { fontSize: 14.5, color: stage.accent, bold: true, align: "center" }, "Lab C operation");
  addBodyText(slide, template, "意義｜urgent miss ≠ winner", { x: 4.98, y: 5.34, w: 3.5, h: 0.25 }, { fontSize: 14.5, color: COLORS.muted, bold: true, align: "center" }, "Lab C meaning");
  addBodyText(slide, template, "回復｜非法時槽／自動補齊", { x: 8.48, y: 5.34, w: 4.16, h: 0.25 }, { fontSize: 14.5, color: COLORS.muted, bold: true, align: "center" }, "Lab C recovery");

  addCompactClaimFooter(pptx, slide, template, "service 與 freshness 分開", "設計估計：6–7 頁＋1 lab", "schedule state／withheld 未驗證", stage.pale);
  return slide;
}

function addClinicSlide(pptx, template, stage) {
  const slide = pptx.addSlide({ masterName: template.masters.content });
  addStageTitle(pptx, slide, template, stage.title);
  addBodyText(slide, template, "問題｜99% accuracy 能直接證明節能嗎？", { x: 0.82, y: 1.06, w: 7.35, h: 0.42 }, { fontSize: 20.5, color: stage.accent, bold: true }, "clinic question");
  addBodyText(slide, template, "先判斷｜哪些特徵當下可用？", { x: 8.25, y: 1.08, w: 4.57, h: 0.34 }, { fontSize: 15.5, color: stage.accent, bold: true, align: "right" }, "clinic learner decision");

  addPanel(slide, template, pptx, { x: 0.82, y: 1.68, w: 12.0, h: 1.74 }, COLORS.white, stage.accent, 1.15, "clinic coherent case");
  addBodyText(slide, template, "ONE COHERENT CASE｜沿時間戳判斷可用性", { x: 1.06, y: 1.83, w: 11.52, h: 0.3 }, { fontSize: 17.5, color: stage.accent, bold: true, align: "center" }, "clinic coherent case title");
  const phases = [
    { x: 1.05, w: 3.35, title: "AVAILABLE", body: "load(t−2) · quality(t−1)", color: COLORS.fact, fill: "F0F7F5" },
    { x: 4.64, w: 3.38, title: "CHECK｜t0", body: "查看 timestamp 再決定", color: COLORS.inference, fill: "F4F1F8" },
    { x: 8.26, w: 4.32, title: "LEAKAGE｜t+1", body: "行動後的服務結果不可偷看", color: COLORS.unknown, fill: "F8F1F2" },
  ];
  phases.forEach((item, index) => {
    addBodyShape(slide, template, pptx.ShapeType.rect, { x: item.x, y: 2.28, w: item.w, h: 0.86 }, { fill: { color: item.fill }, line: { color: item.color, width: 0.9 } }, `clinic phase ${index + 1}`);
    addBodyText(slide, template, item.title, { x: item.x + 0.15, y: 2.39, w: item.w - 0.3, h: 0.27 }, { fontSize: 16.5, color: item.color, bold: true, align: "center" }, `clinic phase ${index + 1} title`);
    addBodyText(slide, template, item.body, { x: item.x + 0.15, y: 2.73, w: item.w - 0.3, h: 0.25 }, { fontSize: 14.5, color: COLORS.body, bold: true, align: "center" }, `clinic phase ${index + 1} body`);
    if (index < phases.length - 1) {
      addFlowLine(slide, template, pptx, item.x + item.w, 2.71, 0.24, 0, COLORS.ink, 1.8, `clinic phase connector ${index + 1}`);
    }
  });

  const actions = [
    { x: 0.82, w: 2.6, text: "wait／send", fill: "F0F7F5", color: COLORS.fact },
    { x: 3.68, w: 2.36, text: "freeze 1", fill: stage.pale, color: stage.accent },
    { x: 6.3, w: 2.8, text: "held-out replay", fill: "F4F1F8", color: COLORS.inference },
    { x: 9.36, w: 3.46, text: "score ∥ service／J", fill: "F0F7F5", color: COLORS.fact },
  ];
  actions.forEach((item, index) => {
    addPanel(slide, template, pptx, { x: item.x, y: 3.72, w: item.w, h: 0.72 }, item.fill, item.color, 1.0, `clinic action ${index + 1}`);
    addBodyText(slide, template, item.text, { x: item.x + 0.12, y: 3.9, w: item.w - 0.24, h: 0.3 }, { fontSize: 16.5, color: item.color, bold: true, align: "center" }, `clinic action ${index + 1} text`);
    if (index < actions.length - 1) {
      addFlowLine(slide, template, pptx, item.x + item.w, 4.08, 0.26, 0, COLORS.ink, 1.8, `clinic action connector ${index + 1}`);
    }
  });

  addPanel(slide, template, pptx, { x: 0.82, y: 4.72, w: 12.0, h: 0.76 }, stage.pale, stage.accent, 1.0, "clinic meaning rail");
  addBodyText(slide, template, "操作｜timestamp → freeze → replay", { x: 1.02, y: 4.85, w: 3.7, h: 0.28 }, { fontSize: 15.5, color: stage.accent, bold: true, align: "center" }, "clinic operation");
  addBodyText(slide, template, "意義｜prediction ≠ saving", { x: 4.72, y: 4.85, w: 3.55, h: 0.28 }, { fontSize: 15.5, color: COLORS.inference, bold: true, align: "center" }, "clinic meaning");
  addBodyText(slide, template, "回復｜提示／誠實 fallback", { x: 8.27, y: 4.85, w: 4.35, h: 0.28 }, { fontSize: 15.5, color: COLORS.muted, bold: true, align: "center" }, "clinic recovery");
  addBodyText(slide, template, "可觀察證據｜模型分數與 service／J 並列，不互相取代", { x: 1.02, y: 5.18, w: 11.6, h: 0.22 }, { fontSize: 14.2, color: COLORS.body, bold: true, align: "center" }, "clinic observable evidence");

  addCompactClaimFooter(pptx, slide, template, "模型分數非能耗公式項", "設計估計：4–5 頁＋1 case", "timestamp／held-out 未驗證", stage.pale);
  return slide;
}

function addTransferSlide(pptx, template, stage) {
  const slide = pptx.addSlide({ masterName: template.masters.content });
  addStageTitle(pptx, slide, template, stage.title);
  addBodyText(slide, template, "問題｜換到陌生場景，原主張如何被推翻？", { x: 0.82, y: 1.06, w: 7.62, h: 0.42 }, { fontSize: 20.5, color: stage.accent, bold: true }, "transfer question");
  addBodyText(slide, template, "決定｜domain → falsifier", { x: 8.55, y: 1.08, w: 4.27, h: 0.34 }, { fontSize: 15.5, color: stage.accent, bold: true, align: "right" }, "transfer learner decision");

  addPanel(slide, template, pptx, { x: 0.82, y: 1.62, w: 12.0, h: 0.54 }, stage.pale, stage.accent, 1.0, "transfer evidence token rail");
  addBodyText(slide, template, "TOKENS｜A pace · B policy · C schedule · clinic claim", { x: 1.04, y: 1.73, w: 11.56, h: 0.3 }, { fontSize: 16.5, color: stage.accent, bold: true, align: "center" }, "transfer evidence tokens");

  addPanel(slide, template, pptx, { x: 0.82, y: 2.42, w: 2.5, h: 1.96 }, "F3F7F8", stage.accent, 1.2, "transfer unseen domain");
  addBodyText(slide, template, "UNSEEN DOMAIN", { x: 1.02, y: 2.71, w: 2.1, h: 0.28 }, { fontSize: 15, color: stage.accent, bold: true, align: "center" }, "transfer unseen domain label");
  addBodyText(slide, template, "SMART FARM", { x: 1.02, y: 3.12, w: 2.1, h: 0.36 }, { fontSize: 19, color: stage.accent, bold: true, align: "center" }, "transfer unseen domain title");
  addBodyText(slide, template, "moisture → irrigation", { x: 1.02, y: 3.68, w: 2.1, h: 0.34 }, { fontSize: 15, color: COLORS.body, bold: true, align: "center" }, "transfer unseen domain detail");

  const chain = [
    { x: 3.7, y: 2.42, text: "1  data／time", color: stage.accent, fill: COLORS.white },
    { x: 6.62, y: 2.42, text: "2  control", color: stage.accent, fill: COLORS.white },
    { x: 9.54, y: 2.42, text: "3  service", color: stage.accent, fill: COLORS.white },
    { x: 9.54, y: 3.6, text: "4  P×time", color: COLORS.fact, fill: "F0F7F5" },
    { x: 6.62, y: 3.6, text: "5  J", color: COLORS.fact, fill: "F0F7F5" },
    { x: 3.7, y: 3.6, text: "6  量測／反證", color: COLORS.inference, fill: "F4F1F8" },
  ];
  chain.forEach((item, index) => {
    addPanel(slide, template, pptx, { x: item.x, y: item.y, w: 2.56, h: 0.78 }, item.fill, item.color, 1.0, `transfer causal node ${index + 1}`);
    addBodyText(slide, template, item.text, { x: item.x + 0.12, y: item.y + 0.2, w: 2.32, h: 0.3 }, { fontSize: 16.2, color: item.color, bold: true, align: "center" }, `transfer causal node ${index + 1} text`);
  });
  addBodyText(slide, template, "→", { x: 6.28, y: 2.63, w: 0.3, h: 0.3 }, { fontSize: 18, color: COLORS.ink, bold: true, align: "center" }, "transfer arrow 1");
  addBodyText(slide, template, "→", { x: 9.2, y: 2.63, w: 0.3, h: 0.3 }, { fontSize: 18, color: COLORS.ink, bold: true, align: "center" }, "transfer arrow 2");
  addBodyText(slide, template, "↓", { x: 10.66, y: 3.23, w: 0.3, h: 0.3 }, { fontSize: 18, color: COLORS.ink, bold: true, align: "center" }, "transfer arrow 3");
  addBodyText(slide, template, "←", { x: 9.2, y: 3.81, w: 0.3, h: 0.3 }, { fontSize: 18, color: COLORS.ink, bold: true, align: "center" }, "transfer arrow 4");
  addBodyText(slide, template, "←", { x: 6.28, y: 3.81, w: 0.3, h: 0.3 }, { fontSize: 18, color: COLORS.ink, bold: true, align: "center" }, "transfer arrow 5");

  addPanel(slide, template, pptx, { x: 0.82, y: 4.66, w: 12.0, h: 0.84 }, stage.pale, stage.accent, 1.05, "transfer output rail");
  addBodyText(slide, template, "OUTPUT｜hypothesis＋falsifier → what-if → revise → export", { x: 1.05, y: 4.8, w: 11.54, h: 0.3 }, { fontSize: 17, color: stage.accent, bold: true, align: "center" }, "transfer output path");
  addBodyText(slide, template, "操作／證據｜映射後提出可被量測推翻的主張　　回復｜hint／system what-if", { x: 1.05, y: 5.14, w: 11.54, h: 0.23 }, { fontSize: 14.2, color: COLORS.muted, bold: true, align: "center" }, "transfer operation evidence recovery");

  addCompactClaimFooter(pptx, slide, template, "分析／預測後形成節能控制", "設計估計：4–5 頁＋1 transfer", "causal transfer／novice timing 未驗證", stage.pale);
  return slide;
}

function addChipV3(pptx, slide, template, text, box, fill, options = {}) {
  addBodyShape(
    slide,
    template,
    pptx.ShapeType.roundRect,
    box,
    {
      fill: { color: fill },
      line: { color: options.lineColor || fill, width: options.lineWidth || 0.8 },
    },
    options.label || "v3 chip",
  );
  addBodyText(
    slide,
    template,
    text,
    { x: box.x + 0.06, y: box.y + 0.02, w: box.w - 0.12, h: box.h - 0.04 },
    {
      fontSize: options.fontSize || 13.2,
      color: options.color || COLORS.white,
      bold: options.bold !== false,
      align: options.align || "center",
      valign: "mid",
    },
    (options.label || "v3 chip") + " text",
  );
}

function addArrowV3(pptx, slide, template, x, y, w, h, color, options = {}) {
  addBodyShape(
    slide,
    template,
    pptx.ShapeType.line,
    { x, y, w, h },
    {
      line: {
        color,
        width: options.width || 1.8,
        dashType: options.dashed ? "dash" : "solid",
        beginArrowType: "none",
        endArrowType: options.noHead ? "none" : "triangle",
      },
    },
    options.label || "v3 arrow",
  );
}

function addStageQuestionV3(pptx, slide, template, stage, prediction) {
  addChipV3(
    pptx,
    slide,
    template,
    "核心問題",
    { x: 0.82, y: 1.06, w: 1.06, h: 0.33 },
    stage.accent,
    { fontSize: 12.2, label: "question chip" },
  );
  addBodyText(
    slide,
    template,
    stage.question,
    { x: 2.06, y: 1.05, w: 7.18, h: 0.4 },
    { fontSize: 20, color: COLORS.body, bold: true, valign: "mid" },
    "v3 driving question",
  );
  addBodyText(
    slide,
    template,
    prediction,
    { x: 9.35, y: 1.055, w: 3.47, h: 0.35 },
    { fontSize: 13.8, color: stage.accent, bold: true, align: "right", valign: "mid" },
    "v3 learner prediction",
  );
  addFlowLine(
    slide,
    template,
    pptx,
    0.82,
    1.48,
    12.0,
    0,
    stage.accent,
    1.05,
    "v3 question rule",
  );
}

function addFourPartRailV3(pptx, slide, template, stage, items, y = 4.92) {
  const x = 0.82;
  const w = 12.0;
  const h = 0.7;
  addPanel(slide, template, pptx, { x, y, w, h }, stage.pale, stage.accent, 0.95, "v3 learning rail");
  const cellW = w / items.length;
  items.forEach((item, index) => {
    const cellX = x + index * cellW;
    if (index > 0) {
      addFlowLine(slide, template, pptx, cellX, y + 0.1, 0, h - 0.2, COLORS.rule, 0.8, "v3 learning divider");
    }
    addBodyText(
      slide,
      template,
      item.label,
      { x: cellX + 0.13, y: y + 0.1, w: cellW - 0.26, h: 0.17 },
      { fontSize: 10.8, color: stage.accent, bold: true, align: "center", valign: "mid" },
      "v3 learning label",
    );
    addBodyText(
      slide,
      template,
      item.value,
      { x: cellX + 0.13, y: y + 0.31, w: cellW - 0.26, h: 0.27 },
      { fontSize: item.fontSize || 13.0, color: COLORS.body, bold: true, align: "center", valign: "mid" },
      "v3 learning value",
    );
  });
}

function addClaimRailV3(pptx, slide, template, fact, inference, unknown) {
  addFlowLine(slide, template, pptx, 0.82, 5.85, 12.0, 0, COLORS.rule, 1.0, "v3 claim rail top");
  const items = [
    { x: 0.82, w: 3.2, label: "FACT", value: fact, color: COLORS.fact },
    { x: 4.2, w: 4.35, label: "DESIGN INFERENCE", value: inference, color: COLORS.inference },
    { x: 8.75, w: 4.07, label: "UNKNOWN", value: unknown, color: COLORS.unknown },
  ];
  [4.1, 8.65].forEach((x) => {
    addFlowLine(slide, template, pptx, x, 5.95, 0, 0.5, COLORS.rule, 0.8, "v3 claim divider");
  });
  items.forEach((item, index) => {
    addBodyShape(
      slide,
      template,
      pptx.ShapeType.ellipse,
      { x: item.x, y: 5.97, w: 0.11, h: 0.11 },
      { fill: { color: item.color }, line: { color: item.color, width: 0.4 } },
      "v3 claim dot " + (index + 1),
    );
    addBodyText(
      slide,
      template,
      item.label + "｜" + item.value,
      { x: item.x + 0.17, y: 5.98, w: item.w - 0.17, h: 0.43 },
      { fontSize: 10.6, color: item.color, bold: true, valign: "mid" },
      "v3 one-paragraph claim text " + (index + 1),
    );
  });
}

function addCourseOutlineSlideV3(pptx, template) {
  const slide = pptx.addSlide({ masterName: template.masters.content });
  addTitle(slide, template, "C-120 LEO 能源決策課程｜Phase 0 完整課程大綱");

  addBodyText(
    slide,
    template,
    "10 + 8 + 23 + 23 + 5 + 23 + 14 + 14 = 120",
    { x: 0.82, y: 1.05, w: 12.0, h: 0.41 },
    { fontSize: 30, bold: true, color: COLORS.ink, align: "center" },
    "v3 cadence equation",
  );
  addBodyText(
    slide,
    template,
    "energy-first  →  LEO-as-index  →  同一份 Energy Decision Workbook",
    { x: 0.92, y: 1.48, w: 11.8, h: 0.34 },
    { fontSize: 19.5, bold: true, color: COLORS.fact, align: "center" },
    "v3 course mainline",
  );

  const routeLabels = [
    "主張判讀",
    "TLE 資料錨點",
    "Lab A｜同工異速",
    "Lab B｜先行或等",
    "回復與重整",
    "Lab C｜分配焦耳",
    "證據檢核",
    "競賽轉移／離場",
  ];
  const minutes = [10, 8, 23, 23, 5, 23, 14, 14];
  const routeXs = [0.82, 3.86, 6.9, 9.94];
  const routeYs = [1.98, 2.74];

  for (let col = 0; col < 3; col += 1) {
    addArrowV3(pptx, slide, template, routeXs[col] + 2.76, routeYs[0] + 0.33, 0.28, 0, COLORS.sky, { width: 1.55, label: "v3 route arrow top" });
  }
  addArrowV3(pptx, slide, template, 12.72, 2.34, 0, 0.26, COLORS.violet, { width: 1.5, label: "v3 route turn" });
  for (let col = 3; col > 0; col -= 1) {
    addArrowV3(pptx, slide, template, routeXs[col], routeYs[1] + 0.33, -0.28, 0, COLORS.sky, { width: 1.55, label: "v3 route arrow bottom" });
  }

  STAGES.forEach((stage, index) => {
    const row = index < 4 ? 0 : 1;
    const col = row === 0 ? index % 4 : 3 - (index % 4);
    const x = routeXs[col];
    const y = routeYs[row];
    addPanel(slide, template, pptx, { x, y, w: 2.76, h: 0.58 }, COLORS.white, stage.accent, 1.15, "v3 route card");
    addChipV3(
      pptx,
      slide,
      template,
      String(minutes[index]),
      { x: x + 0.1, y: y + 0.1, w: 0.54, h: 0.36 },
      stage.accent,
      { fontSize: 15.5, label: "v3 minute chip" },
    );
    addBodyText(
      slide,
      template,
      routeLabels[index],
      { x: x + 0.74, y: y + 0.08, w: 1.9, h: 0.4 },
      { fontSize: 14.2, color: stage.accent, bold: true, align: "center", valign: "mid" },
      "v3 route label",
    );
  });

  addPanel(slide, template, pptx, { x: 0.82, y: 3.54, w: 12.0, h: 0.73 }, COLORS.sand, COLORS.rule, 0.9, "v3 energy chain");
  addBodyText(slide, template, "共同判讀骨架", { x: 1.02, y: 3.68, w: 1.45, h: 0.23 }, { fontSize: 13.2, color: COLORS.gold, bold: true }, "v3 energy chain label");
  const chain = [
    ["W", "當下功率", COLORS.sky],
    ["時間", "累積多久", COLORS.blueGray],
    ["J", "總能源", COLORS.violet],
    ["服務", "是否合格", COLORS.mint],
    ["bit/J", "合格邊界內效率", COLORS.fact],
  ];
  let chainX = 2.65;
  chain.forEach((item, index) => {
    addBodyShape(slide, template, pptx.ShapeType.ellipse, { x: chainX, y: 3.65, w: 0.46, h: 0.46 }, { fill: { color: item[2] }, line: { color: item[2], width: 0.7 } }, "v3 energy node");
    addBodyText(slide, template, item[0], { x: chainX - 0.18, y: 3.68, w: 0.82, h: 0.22 }, { fontSize: 15.5, color: COLORS.white, bold: true, align: "center" }, "v3 energy node title");
    addBodyText(slide, template, item[1], { x: chainX - 0.35, y: 4.03, w: 1.16, h: 0.17 }, { fontSize: 10.8, color: COLORS.muted, bold: true, align: "center" }, "v3 energy node note");
    if (index < chain.length - 1) {
      addArrowV3(pptx, slide, template, chainX + 0.62, 3.88, 0.76, 0, COLORS.sky, { width: 1.6, label: "v3 energy chain arrow" });
    }
    chainX += 1.85;
  });

  addPanel(slide, template, pptx, { x: 0.82, y: 4.48, w: 5.76, h: 0.72 }, COLORS.mintSoft, COLORS.mint, 1.0, "v3 mission contract");
  addChipV3(pptx, slide, template, "MISSION CONTRACT", { x: 1.02, y: 4.66, w: 1.63, h: 0.32 }, COLORS.mint, { fontSize: 11.6, label: "v3 mission contract chip" });
  addBodyText(slide, template, "service pass · freshness · deadline · energy budget · window", { x: 2.84, y: 4.61, w: 3.52, h: 0.42 }, { fontSize: 13.2, color: COLORS.fact, bold: true, align: "center" }, "v3 mission contract fields");

  addPanel(slide, template, pptx, { x: 6.78, y: 4.48, w: 6.04, h: 0.72 }, COLORS.violetSoft, COLORS.violet, 1.0, "v3 measurement distinctions");
  addChipV3(pptx, slide, template, "不可互換", { x: 6.98, y: 4.66, w: 1.04, h: 0.32 }, COLORS.violet, { fontSize: 11.7, label: "v3 distinction chip" });
  addBodyText(slide, template, "W ≠ J　｜　bit/s ≠ bit/J　｜　active time", { x: 8.18, y: 4.61, w: 4.42, h: 0.42 }, { fontSize: 15.2, color: COLORS.inference, bold: true, align: "center" }, "v3 measurement distinctions values");

  addBodyText(
    slide,
    template,
    "模擬教學資料、非即時、非量測、尚未通過 canonical parity 驗證。",
    { x: 0.88, y: 5.35, w: 11.88, h: 0.26 },
    { fontSize: 14.2, color: COLORS.unknown, bold: true, align: "center" },
    "v3 claim ceiling",
  );
  addClaimRailV3(
    pptx,
    slide,
    template,
    "EE＝delivered bits／consumed J",
    "設計估計：9 頁；120 分鐘待實證",
    "browser pixels／classroom／parity 未驗證",
  );
  return slide;
}

function addClaimsSlideV3(pptx, template, stage) {
  const slide = pptx.addSlide({ masterName: template.masters.content });
  addStageTitle(pptx, slide, template, stage.title);
  addStageQuestionV3(pptx, slide, template, stage, "先投票｜A／Q／R＋信心");

  addPanel(slide, template, pptx, { x: 0.82, y: 1.67, w: 3.05, h: 3.05 }, COLORS.skySoft, stage.accent, 1.15, "v3 mission gate");
  addChipV3(pptx, slide, template, "MISSION CONTRACT", { x: 1.08, y: 1.86, w: 1.74, h: 0.34 }, stage.accent, { fontSize: 12.1, label: "v3 mission gate chip" });
  addBodyText(slide, template, "任務契約", { x: 1.08, y: 2.27, w: 2.52, h: 0.34 }, { fontSize: 21, color: COLORS.body, bold: true, align: "center" }, "v3 mission gate title");
  const contractFields = ["payload／工作量", "deadline／期限", "idle／wakeup 邊界", "單位／時間窗"];
  contractFields.forEach((field, index) => {
    const y = 2.72 + index * 0.36;
    if (index > 0) {
      addFlowLine(slide, template, pptx, 1.15, y - 0.04, 2.4, 0, "B9DEDF", 0.75, "v3 mission field divider");
    }
    addBodyText(slide, template, field, { x: 1.1, y, w: 2.5, h: 0.25 }, { fontSize: 14.2, color: stage.accent, bold: true, align: "center" }, "v3 mission field");
  });
  addChipV3(pptx, slide, template, "COMPARABLE?", { x: 1.18, y: 4.17, w: 1.72, h: 0.31 }, COLORS.navy, { fontSize: 12.4, label: "v3 comparable gate" });
  addBodyText(slide, template, "條件不同＝INCOMPARABLE", { x: 1.08, y: 4.53, w: 2.54, h: 0.15 }, { fontSize: 10.3, color: COLORS.unknown, bold: true, align: "center" }, "v3 incomparable warning");

  addBodyText(slide, template, "REVEAL → VERDICT", { x: 4.18, y: 1.69, w: 8.64, h: 0.28 }, { fontSize: 13.2, color: stage.accent, bold: true, align: "center" }, "v3 claim board title");
  const rows = [
    { y: 2.06, fill: COLORS.mintSoft, color: COLORS.fact, id: "A", claim: "平均 W 較低", reveal: "service_pass＋期限", note: "先確認可比較" },
    { y: 2.89, fill: COLORS.violetSoft, color: COLORS.inference, id: "B", claim: "較快完成", reveal: "active time＋完成時刻", note: "不直接等於低 J" },
    { y: 3.72, fill: COLORS.coralSoft, color: COLORS.unknown, id: "C", claim: "bit/J 高但漏 deadline", reveal: "逾期＝服務不合格", note: "效率不覆蓋服務" },
  ];
  rows.forEach((row, index) => {
    addPanel(slide, template, pptx, { x: 4.18, y: row.y, w: 8.64, h: 0.7 }, row.fill, row.color, 0.95, "v3 claim row");
    addBodyShape(slide, template, pptx.ShapeType.ellipse, { x: 4.38, y: row.y + 0.13, w: 0.44, h: 0.44 }, { fill: { color: row.color }, line: { color: row.color, width: 0.6 } }, "v3 claim marker");
    addBodyText(slide, template, row.id, { x: 4.38, y: row.y + 0.18, w: 0.44, h: 0.22 }, { fontSize: 15, color: COLORS.white, bold: true, align: "center" }, "v3 claim marker text");
    addBodyText(slide, template, row.claim, { x: 5.02, y: row.y + 0.12, w: 2.42, h: 0.23 }, { fontSize: 16.0, color: COLORS.body, bold: true }, "v3 claim text");
    addBodyText(slide, template, row.reveal, { x: 5.02, y: row.y + 0.38, w: 2.42, h: 0.17 }, { fontSize: 11.8, color: row.color, bold: true }, "v3 claim reveal");
    addFlowLine(slide, template, pptx, 7.62, row.y + 0.1, 0, 0.5, COLORS.rule, 0.75, "v3 claim verdict divider");
    addBodyText(slide, template, "○ A　○ Q　○ R", { x: 7.86, y: row.y + 0.11, w: 2.18, h: 0.23 }, { fontSize: 15.3, color: row.color, bold: true, align: "center" }, "v3 claim verdict");
    addBodyText(slide, template, "信心：低／中／高", { x: 7.86, y: row.y + 0.39, w: 2.18, h: 0.17 }, { fontSize: 11.6, color: COLORS.muted, bold: true, align: "center" }, "v3 claim confidence");
    addBodyText(slide, template, row.note, { x: 10.19, y: row.y + 0.18, w: 2.39, h: 0.3 }, { fontSize: 13.2, color: row.color, bold: true, align: "center" }, "v3 claim note");
  });
  addPanel(slide, template, pptx, { x: 4.18, y: 4.55, w: 8.64, h: 0.34 }, COLORS.white, stage.accent, 0.9, "v3 rejudgment rail");
  addBodyText(slide, template, "初判 → 鎖定條件 → 揭露 J／時間／服務 → 只改判 1 次", { x: 4.36, y: 4.61, w: 8.28, h: 0.2 }, { fontSize: 13.8, color: stage.accent, bold: true, align: "center" }, "v3 rejudgment rail text");

  addFourPartRailV3(pptx, slide, template, stage, [
    { label: "操作", value: "vote → reveal → revise" },
    { label: "證據", value: "任務契約＋判決" },
    { label: "意義", value: "先固定服務邊界" },
    { label: "回復", value: "單位／邊界提示" },
  ], 5.03);
  addClaimRailV3(pptx, slide, template, stage.fact, stage.inference, stage.unknown);
  return slide;
}

function addTleSlideV3(pptx, template, stage) {
  const slide = pptx.addSlide({ masterName: template.masters.content });
  addStageTitle(pptx, slide, template, stage.title);
  addStageQuestionV3(pptx, slide, template, stage, "先分類｜source／model／assumption");

  const nodes = [
    { x: 0.82, w: 3.42, chip: "SOURCE", title: "pinned TLE", body: "epoch／identity", fill: COLORS.skySoft, color: COLORS.sky },
    { x: 4.96, w: 3.42, chip: "MODEL-DERIVED", title: "NTPU service window", body: "可服務的時間區間", fill: COLORS.mintSoft, color: COLORS.mint },
    { x: 9.1, w: 3.72, chip: "COURSE ASSUMPTION", title: "traffic／power", body: "freshness／deadline", fill: COLORS.violetSoft, color: COLORS.violet },
  ];
  nodes.forEach((node, index) => {
    if (index < nodes.length - 1) {
      addArrowV3(pptx, slide, template, node.x + node.w, 2.35, 0.72, 0, COLORS.sky, { label: "v3 lineage arrow" });
    }
    addPanel(slide, template, pptx, { x: node.x, y: 1.72, w: node.w, h: 1.35 }, COLORS.white, node.color, 1.15, "v3 lineage node");
    addChipV3(pptx, slide, template, node.chip, { x: node.x + 0.22, y: 1.9, w: Math.min(node.w - 0.44, 1.78), h: 0.32 }, node.color, { fontSize: 11.4, label: "v3 lineage chip" });
    addBodyText(slide, template, node.title, { x: node.x + 0.24, y: 2.32, w: node.w - 0.48, h: 0.31 }, { fontSize: 18, color: COLORS.body, bold: true, align: "center" }, "v3 lineage title");
    addBodyText(slide, template, node.body, { x: node.x + 0.24, y: 2.7, w: node.w - 0.48, h: 0.2 }, { fontSize: 13.5, color: node.color, bold: true, align: "center" }, "v3 lineage body");
  });

  addBodyText(slide, template, "same versioned scenario_id", { x: 2.05, y: 3.2, w: 9.2, h: 0.25 }, { fontSize: 14.2, color: stage.accent, bold: true, align: "center" }, "v3 scenario identity");
  addArrowV3(pptx, slide, template, 6.67, 3.08, 0, 0.43, COLORS.mint, { width: 1.5, label: "v3 window drop" });

  addBodyShape(slide, template, pptx.ShapeType.rect, { x: 0.82, y: 3.58, w: 2.52, h: 0.66 }, { fill: { color: COLORS.quiet }, line: { color: COLORS.blueGray, width: 0.85 } }, "v3 outside left");
  addBodyShape(slide, template, pptx.ShapeType.rect, { x: 3.34, y: 3.58, w: 5.58, h: 0.66 }, { fill: { color: COLORS.mintSoft }, line: { color: COLORS.mint, width: 1.15 } }, "v3 legal window");
  addBodyShape(slide, template, pptx.ShapeType.rect, { x: 8.92, y: 3.58, w: 3.9, h: 0.66 }, { fill: { color: COLORS.quiet }, line: { color: COLORS.blueGray, width: 0.85 } }, "v3 outside right");
  addBodyText(slide, template, "OUTSIDE", { x: 1.0, y: 3.79, w: 2.16, h: 0.24 }, { fontSize: 15, color: COLORS.muted, bold: true, align: "center" }, "v3 outside left label");
  addBodyText(slide, template, "LEGAL WINDOW｜send／wait", { x: 3.58, y: 3.76, w: 5.1, h: 0.28 }, { fontSize: 17.2, color: COLORS.fact, bold: true, align: "center" }, "v3 legal window label");
  addBodyText(slide, template, "OUTSIDE", { x: 9.12, y: 3.79, w: 3.5, h: 0.24 }, { fontSize: 15, color: COLORS.muted, bold: true, align: "center" }, "v3 outside right label");

  addFourPartRailV3(pptx, slide, template, stage, [
    { label: "操作", value: "排序 lineage＋檢查區間" },
    { label: "證據", value: "scenario_id＋合法窗口" },
    { label: "意義", value: "window 限制行動" },
    { label: "回復", value: "resume／fallback" },
  ], 4.68);
  addBodyText(slide, template, "後續只沿同一 identity 進入 Lab A／B／C、clinic 與 Workbook", { x: 0.96, y: 5.47, w: 11.72, h: 0.2 }, { fontSize: 12.3, color: COLORS.muted, bold: true, align: "center" }, "v3 identity continuation");
  addClaimRailV3(pptx, slide, template, stage.fact, stage.inference, stage.unknown);
  return slide;
}

function addLabASlideV3(pptx, template, stage) {
  const slide = pptx.addSlide({ masterName: template.masters.content });
  addStageTitle(pptx, slide, template, stage.title);
  addStageQuestionV3(pptx, slide, template, stage, "先預測｜pace／balanced／burst");

  addPanel(slide, template, pptx, { x: 0.82, y: 1.64, w: 12.0, h: 0.4 }, COLORS.violetSoft, COLORS.violet, 0.85, "v3 Lab A timing strip");
  addBodyText(slide, template, "固定比較｜同工作量・同 deadline・同系統邊界", { x: 1.02, y: 1.73, w: 6.0, h: 0.2 }, { fontSize: 13.5, color: COLORS.inference, bold: true }, "v3 Lab A locked comparison");
  addBodyText(slide, template, "設計估計｜5 reference → 11 operation → 5 debrief → 2 transition", { x: 6.98, y: 1.72, w: 5.62, h: 0.21 }, { fontSize: 12.3, color: COLORS.inference, bold: true, align: "right" }, "v3 Lab A timing");

  addFlowLine(slide, template, pptx, 3.12, 2.34, 6.15, 0, COLORS.blueGray, 1.1, "v3 Lab A axis");
  addBodyText(slide, template, "共同時間軸｜示意、非量測", { x: 4.45, y: 2.1, w: 3.08, h: 0.2 }, { fontSize: 12.4, color: COLORS.muted, bold: true, align: "center" }, "v3 Lab A axis note");
  addFlowLine(slide, template, pptx, 9.27, 2.18, 0, 2.35, COLORS.unknown, 1.25, "v3 Lab A deadline");
  addChipV3(pptx, slide, template, "deadline", { x: 8.45, y: 2.08, w: 0.75, h: 0.28 }, COLORS.coralSoft, { fontSize: 11.0, color: COLORS.unknown, lineColor: COLORS.unknown, label: "v3 Lab A deadline chip" });

  const lanes = [
    { y: 2.92, label: "慢速", note: "低 W／時間長", w: 5.55, h: 0.2, color: COLORS.mint },
    { y: 3.58, label: "平衡", note: "中 W／時間中", w: 4.34, h: 0.34, color: COLORS.blueGray },
    { y: 4.24, label: "高速後休眠", note: "高 W／時間短", w: 2.96, h: 0.48, color: COLORS.violet },
  ];
  lanes.forEach((lane, index) => {
    addChipV3(pptx, slide, template, lane.label, { x: 0.88, y: lane.y - 0.36, w: 1.12, h: 0.32 }, lane.color, { fontSize: 12.0, label: "v3 Lab A lane chip" });
    addBodyText(slide, template, lane.note, { x: 2.08, y: lane.y - 0.34, w: 0.9, h: 0.28 }, { fontSize: 12.3, color: lane.color, bold: true, align: "right" }, "v3 Lab A lane note");
    addFlowLine(slide, template, pptx, 3.12, lane.y, 6.15, 0, COLORS.rule, 0.9, "v3 Lab A lane baseline");
    addBodyShape(slide, template, pptx.ShapeType.rect, { x: 3.12, y: lane.y - lane.h, w: lane.w, h: lane.h }, { fill: { color: lane.color, transparency: 5 }, line: { color: lane.color, width: 0.7 } }, "v3 Lab A active footprint");
    addBodyShape(slide, template, pptx.ShapeType.rect, { x: 3.12 + lane.w, y: lane.y - 0.075, w: 6.15 - lane.w, h: 0.075 }, { fill: { color: COLORS.mintSoft }, line: { color: COLORS.mint, width: 0.35 } }, "v3 Lab A sleep footprint");
    addBodyShape(slide, template, pptx.ShapeType.ellipse, { x: 3.12 + lane.w - 0.09, y: lane.y - 0.09, w: 0.18, h: 0.18 }, { fill: { color: COLORS.white }, line: { color: lane.color, width: 1.0 } }, "v3 Lab A completion");
  });

  addPanel(slide, template, pptx, { x: 9.58, y: 2.18, w: 3.24, h: 2.35 }, COLORS.navy, COLORS.navy, 1.0, "v3 Lab A evidence hub");
  addChipV3(pptx, slide, template, "AUTO-LEDGER", { x: 10.24, y: 2.4, w: 1.92, h: 0.32 }, COLORS.sky, { fontSize: 11.7, color: COLORS.navy, label: "v3 Lab A ledger chip" });
  addBodyText(slide, template, "回放後自動填入", { x: 9.88, y: 2.84, w: 2.64, h: 0.27 }, { fontSize: 16.0, color: COLORS.white, bold: true, align: "center" }, "v3 Lab A ledger title");
  const metrics = [
    ["SERVICE", "service_pass", COLORS.mint],
    ["J", "consumed J", COLORS.violet],
    ["EE", "bit/J", COLORS.sky],
    ["TIME", "完成時刻", COLORS.blueGray],
  ];
  metrics.forEach((metric, index) => {
    const y = 3.24 + index * 0.29;
    addChipV3(pptx, slide, template, metric[0], { x: 9.9, y, w: 0.8, h: 0.24 }, metric[2], { fontSize: 9.3, label: "v3 Lab A metric chip" });
    addBodyText(slide, template, metric[1], { x: 10.84, y, w: 1.53, h: 0.24 }, { fontSize: 12.0, color: COLORS.white, bold: true }, "v3 Lab A metric");
  });
  addBodyText(slide, template, "同一 clock ledger", { x: 9.96, y: 4.39, w: 2.48, h: 0.11 }, { fontSize: 9.7, color: "B8CBDC", bold: true, align: "center" }, "v3 Lab A ledger note");

  addFourPartRailV3(pptx, slide, template, stage, [
    { label: "操作", value: "鎖定策略 → hidden replay" },
    { label: "證據", value: "service／J／bit/J／time" },
    { label: "意義", value: "排序可能翻轉" },
    { label: "回復", value: "同 scenario 反例重設" },
  ], 4.82);
  addClaimRailV3(pptx, slide, template, stage.fact, stage.inference, stage.unknown);
  return slide;
}

function addMiniSatelliteV3(pptx, slide, template, x, y, scale, accent, label) {
  addBodyShape(slide, template, pptx.ShapeType.rect, { x: x + 0.33 * scale, y: y + 0.12 * scale, w: 0.34 * scale, h: 0.22 * scale }, { fill: { color: COLORS.navy }, line: { color: COLORS.navy, width: 0.7 } }, label + " body");
  addBodyShape(slide, template, pptx.ShapeType.rect, { x, y: y + 0.1 * scale, w: 0.28 * scale, h: 0.26 * scale }, { fill: { color: accent }, line: { color: COLORS.navy, width: 0.8 } }, label + " panel left");
  addBodyShape(slide, template, pptx.ShapeType.rect, { x: x + 0.72 * scale, y: y + 0.1 * scale, w: 0.28 * scale, h: 0.26 * scale }, { fill: { color: accent }, line: { color: COLORS.navy, width: 0.8 } }, label + " panel right");
  addFlowLine(slide, template, pptx, x + 0.28 * scale, y + 0.23 * scale, 0.44 * scale, 0, COLORS.navy, 1.0, label + " boom");
}

function addLabBSlideV3(pptx, template, stage) {
  const slide = pptx.addSlide({ masterName: template.masters.content });
  addStageTitle(pptx, slide, template, stage.title);
  addStageQuestionV3(pptx, slide, template, stage, "先決定｜switch now／wait／remain");

  addBodyText(slide, template, "決策點", { x: 1.55, y: 1.7, w: 1.2, h: 0.24 }, { fontSize: 13.2, color: COLORS.muted, bold: true, align: "center" }, "v3 Lab B decision label");
  addMiniSatelliteV3(pptx, slide, template, 0.98, 1.98, 0.72, COLORS.sky, "v3 Lab B satellite A");
  addMiniSatelliteV3(pptx, slide, template, 2.18, 1.87, 0.72, COLORS.coral, "v3 Lab B satellite B");
  addBodyShape(slide, template, pptx.ShapeType.triangle, { x: 0.95, y: 2.28, w: 1.55, h: 1.3 }, { rotate: 180, fill: { color: COLORS.sky, transparency: 72 }, line: { color: COLORS.sky, transparency: 100 } }, "v3 Lab B beam A");
  addBodyShape(slide, template, pptx.ShapeType.triangle, { x: 1.82, y: 2.22, w: 1.55, h: 1.36 }, { rotate: 180, fill: { color: COLORS.coral, transparency: 76 }, line: { color: COLORS.coral, transparency: 100 } }, "v3 Lab B beam B");
  addBodyShape(slide, template, pptx.ShapeType.ellipse, { x: 1.82, y: 3.14, w: 0.48, h: 0.48 }, { fill: { color: COLORS.gold }, line: { color: COLORS.gold, width: 0.8 } }, "v3 Lab B decision point");
  addBodyText(slide, template, "現在狀態", { x: 1.25, y: 3.7, w: 1.65, h: 0.23 }, { fontSize: 13.5, color: COLORS.body, bold: true, align: "center" }, "v3 Lab B current state");

  const choices = [
    { y: 1.82, text: "現在切換", color: COLORS.coral, fill: COLORS.coralSoft },
    { y: 2.65, text: "等待穩定", color: COLORS.gold, fill: COLORS.sand },
    { y: 3.48, text: "維持目前", color: COLORS.sky, fill: COLORS.skySoft },
  ];
  choices.forEach((choice, index) => {
    addPanel(slide, template, pptx, { x: 3.35, y: choice.y, w: 2.52, h: 0.62 }, COLORS.white, choice.color, 1.1, "v3 Lab B choice");
    addBodyShape(slide, template, pptx.ShapeType.ellipse, { x: 3.58, y: choice.y + 0.16, w: 0.28, h: 0.28 }, { fill: { color: choice.color }, line: { color: choice.color, width: 0.5 } }, "v3 Lab B choice dot");
    addBodyText(slide, template, choice.text, { x: 3.98, y: choice.y + 0.14, w: 1.62, h: 0.32 }, { fontSize: 16.0, color: choice.color, bold: true, align: "center" }, "v3 Lab B choice text");
  });
  addArrowV3(pptx, slide, template, 2.48, 3.38, 0.66, -0.38, COLORS.coral, { label: "v3 Lab B choice arrow" });
  addChipV3(pptx, slide, template, "LOCK RULE", { x: 3.88, y: 4.28, w: 1.45, h: 0.32 }, COLORS.navy, { fontSize: 11.8, label: "v3 Lab B lock chip" });
  addBodyText(slide, template, "只鎖一次，再面對未知未來", { x: 3.22, y: 4.62, w: 2.8, h: 0.18 }, { fontSize: 11.5, color: COLORS.muted, bold: true, align: "center" }, "v3 Lab B lock note");

  addPanel(slide, template, pptx, { x: 6.34, y: 1.72, w: 6.48, h: 3.03 }, COLORS.violetSoft, COLORS.violet, 1.15, "v3 Lab B replay panel");
  addChipV3(pptx, slide, template, "REPLAY", { x: 6.62, y: 1.93, w: 1.05, h: 0.32 }, COLORS.violet, { fontSize: 11.8, label: "v3 Lab B replay chip" });
  addBodyText(slide, template, "Trace A 鎖定規則 → Trace B 不重調", { x: 7.88, y: 1.91, w: 4.62, h: 0.34 }, { fontSize: 15.0, color: COLORS.inference, bold: true, align: "right" }, "v3 Lab B replay title");

  addBodyText(slide, template, "TRACE A", { x: 6.66, y: 2.54, w: 1.08, h: 0.24 }, { fontSize: 14.2, color: COLORS.sky, bold: true }, "v3 Lab B trace A label");
  addFlowLine(slide, template, pptx, 7.96, 2.7, 4.42, 0, COLORS.rule, 1.3, "v3 Lab B trace A axis");
  [8.32, 9.38, 10.42, 11.75].forEach((x, index) => {
    addBodyShape(slide, template, pptx.ShapeType.ellipse, { x, y: 2.6 - (index % 2) * 0.08, w: 0.18, h: 0.18 }, { fill: { color: COLORS.sky }, line: { color: COLORS.sky, width: 0.5 } }, "v3 Lab B trace A point");
  });
  addFlowLine(slide, template, pptx, 9.75, 2.38, 0, 0.68, COLORS.navy, 1.3, "v3 Lab B lock line");
  addChipV3(pptx, slide, template, "LOCK", { x: 9.36, y: 2.31, w: 0.78, h: 0.26 }, COLORS.navy, { fontSize: 10.2, label: "v3 Lab B trace lock" });

  addBodyText(slide, template, "TRACE B", { x: 6.66, y: 3.28, w: 1.08, h: 0.24 }, { fontSize: 14.2, color: COLORS.violet, bold: true }, "v3 Lab B trace B label");
  addFlowLine(slide, template, pptx, 7.96, 3.44, 4.42, 0, COLORS.rule, 1.3, "v3 Lab B trace B axis");
  [
    [8.2, 3.34], [8.95, 3.18], [9.72, 3.38], [10.54, 3.12], [11.38, 3.32], [12.0, 3.2],
  ].forEach((point) => {
    addBodyShape(slide, template, pptx.ShapeType.ellipse, { x: point[0], y: point[1], w: 0.18, h: 0.18 }, { fill: { color: COLORS.violet }, line: { color: COLORS.violet, width: 0.5 } }, "v3 Lab B trace B point");
  });
  addChipV3(pptx, slide, template, "NO RETUNE", { x: 10.4, y: 3.8, w: 1.5, h: 0.3 }, COLORS.coral, { fontSize: 10.8, label: "v3 Lab B no retune" });
  addBodyText(slide, template, "EVIDENCE｜state · service · J", { x: 6.66, y: 4.28, w: 5.78, h: 0.25 }, { fontSize: 13.8, color: COLORS.inference, bold: true, align: "center" }, "v3 Lab B evidence");

  addFourPartRailV3(pptx, slide, template, stage, [
    { label: "操作", value: "rewind → freeze → Trace B" },
    { label: "證據", value: "state／service／J" },
    { label: "意義", value: "choice → active time／service → J", fontSize: 12.2 },
    { label: "回復", value: "rewind／known-good" },
  ], 4.92);
  addClaimRailV3(pptx, slide, template, stage.fact, stage.inference, stage.unknown);
  return slide;
}

function addRecoverySlideV3(pptx, template, stage) {
  const slide = pptx.addSlide({ masterName: template.masters.content });
  addStageTitle(pptx, slide, template, stage.title);
  addStageQuestionV3(pptx, slide, template, stage, "閉卷決定｜缺哪一節就補哪一節");

  const nodes = [
    { x: 0.82, w: 2.18, title: "SAVE", body: "Workbook", color: COLORS.blueGray, fill: COLORS.blueSoft },
    { x: 3.46, w: 2.88, title: "STATE＋ACTION", body: "當時狀態＋採取動作", color: COLORS.sky, fill: COLORS.skySoft },
    { x: 6.8, w: 2.18, title: "PATH", body: "系統路徑", color: COLORS.mint, fill: COLORS.mintSoft },
    { x: 9.44, w: 3.38, title: "SERVICE／J", body: "服務結果＋累積能量", color: COLORS.violet, fill: COLORS.violetSoft },
  ];
  nodes.forEach((node, index) => {
    if (index < nodes.length - 1) {
      addArrowV3(pptx, slide, template, node.x + node.w, 2.38, 0.46, 0, COLORS.sky, { width: 1.6, label: "v3 recovery chain arrow" });
    }
    addPanel(slide, template, pptx, { x: node.x, y: 1.78, w: node.w, h: 1.18 }, COLORS.white, node.color, 1.1, "v3 recovery node");
    addChipV3(pptx, slide, template, node.title, { x: node.x + 0.22, y: 1.99, w: Math.min(node.w - 0.44, 1.72), h: 0.32 }, node.color, { fontSize: 11.7, label: "v3 recovery node chip" });
    addBodyText(slide, template, node.body, { x: node.x + 0.22, y: 2.45, w: node.w - 0.44, h: 0.27 }, { fontSize: 14.3, color: COLORS.body, bold: true, align: "center" }, "v3 recovery node body");
  });

  addBodyShape(slide, template, pptx.ShapeType.ellipse, { x: 6.25, y: 3.2, w: 0.72, h: 0.72 }, { fill: { color: COLORS.gold }, line: { color: COLORS.gold, width: 0.8 } }, "v3 recovery checkpoint");
  addBodyText(slide, template, "CHECK", { x: 6.25, y: 3.43, w: 0.72, h: 0.18 }, { fontSize: 10.5, color: COLORS.navy, bold: true, align: "center" }, "v3 recovery checkpoint text");
  addArrowV3(pptx, slide, template, 6.61, 2.97, 0, 0.2, COLORS.gold, { width: 1.5, label: "v3 recovery checkpoint down" });
  addArrowV3(pptx, slide, template, 6.3, 3.82, -2.7, 0.42, COLORS.blueGray, { width: 1.45, label: "v3 recovery help branch" });
  addArrowV3(pptx, slide, template, 6.92, 3.82, 2.72, 0.42, COLORS.mint, { width: 1.45, label: "v3 recovery ready branch" });

  addPanel(slide, template, pptx, { x: 0.82, y: 3.83, w: 5.2, h: 0.85 }, COLORS.blueSoft, COLORS.blueGray, 1.0, "v3 recovery help");
  addChipV3(pptx, slide, template, "需要協助", { x: 1.08, y: 4.06, w: 1.12, h: 0.31 }, COLORS.blueGray, { fontSize: 11.5, label: "v3 recovery help chip" });
  addBodyText(slide, template, "hint → reset → resume", { x: 2.42, y: 4.0, w: 3.32, h: 0.37 }, { fontSize: 16.0, color: COLORS.blueGray, bold: true, align: "center" }, "v3 recovery help path");
  addPanel(slide, template, pptx, { x: 7.2, y: 3.83, w: 5.62, h: 0.85 }, COLORS.mintSoft, COLORS.mint, 1.0, "v3 recovery ready");
  addChipV3(pptx, slide, template, "已能重建", { x: 7.46, y: 4.06, w: 1.12, h: 0.31 }, COLORS.mint, { fontSize: 11.5, label: "v3 recovery ready chip" });
  addBodyText(slide, template, "用 boundary 反例測試自己的因果句", { x: 8.78, y: 3.99, w: 3.74, h: 0.38 }, { fontSize: 14.5, color: COLORS.fact, bold: true, align: "center" }, "v3 recovery ready path");

  addFourPartRailV3(pptx, slide, template, stage, [
    { label: "操作", value: "保存 → 閉卷重建" },
    { label: "證據", value: "狀態＋因果句" },
    { label: "意義", value: "證據不中斷" },
    { label: "回復", value: "提示／延伸反例" },
  ], 4.92);
  addClaimRailV3(pptx, slide, template, stage.fact, stage.inference, stage.unknown);
  return slide;
}

function addLabCSlideV3(pptx, template, stage) {
  const slide = pptx.addSlide({ masterName: template.masters.content });
  addStageTitle(pptx, slide, template, stage.title);
  addStageQuestionV3(pptx, slide, template, stage, "先排｜baseline → revise → freeze");

  addBodyText(slide, template, "設計估計｜6 baseline → 10 schedule → 5 revise／withheld → 2 debrief", { x: 0.82, y: 1.58, w: 12.0, h: 0.23 }, { fontSize: 12.7, color: stage.accent, bold: true, align: "center" }, "v3 Lab C timing");

  addBodyText(slide, template, "三張任務卡", { x: 0.86, y: 1.9, w: 4.5, h: 0.26 }, { fontSize: 15.5, color: COLORS.muted, bold: true }, "v3 Lab C task heading");
  const tasks = [
    { x: 0.82, title: "緊急警報", note: "短 deadline", color: COLORS.coral, fill: COLORS.coralSoft },
    { x: 2.36, title: "環境資料", note: "保持 fresh", color: COLORS.mint, fill: COLORS.mintSoft },
    { x: 3.9, title: "大量資料", note: "可延後", color: COLORS.sky, fill: COLORS.skySoft },
  ];
  tasks.forEach((task) => {
    addPanel(slide, template, pptx, { x: task.x, y: 2.2, w: 1.4, h: 1.05 }, COLORS.white, task.color, 1.0, "v3 Lab C task card");
    addBodyShape(slide, template, pptx.ShapeType.ellipse, { x: task.x + 0.14, y: 2.34, w: 0.28, h: 0.28 }, { fill: { color: task.color }, line: { color: task.color, width: 0.4 } }, "v3 Lab C task dot");
    addBodyText(slide, template, task.title, { x: task.x + 0.48, y: 2.3, w: 0.78, h: 0.28 }, { fontSize: 13.3, color: COLORS.body, bold: true, align: "center" }, "v3 Lab C task title");
    addBodyText(slide, template, task.note, { x: task.x + 0.18, y: 2.76, w: 1.04, h: 0.2 }, { fontSize: 11.5, color: task.color, bold: true, align: "center" }, "v3 Lab C task note");
  });
  addChipV3(pptx, slide, template, "BASELINE｜立即傳送", { x: 1.18, y: 3.5, w: 3.8, h: 0.34 }, COLORS.blueGray, { fontSize: 12.2, label: "v3 Lab C baseline chip" });
  addBodyText(slide, template, "先預測，再把任務排進合法窗口", { x: 1.0, y: 3.96, w: 4.16, h: 0.3 }, { fontSize: 14.0, color: COLORS.body, bold: true, align: "center" }, "v3 Lab C baseline note");
  addArrowV3(pptx, slide, template, 5.32, 3.15, 0.42, 0, COLORS.mint, { label: "v3 Lab C to schedule" });

  addPanel(slide, template, pptx, { x: 5.76, y: 1.98, w: 3.92, h: 2.62 }, COLORS.navy, COLORS.navy, 1.0, "v3 Lab C schedule board");
  addChipV3(pptx, slide, template, "RULE TASK BOARD", { x: 6.68, y: 2.2, w: 2.08, h: 0.32 }, COLORS.sky, { fontSize: 11.5, color: COLORS.navy, label: "v3 Lab C board chip" });
  addBodyText(slide, template, "六格 schedule", { x: 6.18, y: 2.64, w: 3.08, h: 0.3 }, { fontSize: 17.0, color: COLORS.white, bold: true, align: "center" }, "v3 Lab C board title");
  for (let i = 0; i < 6; i += 1) {
    const x = 6.08 + i * 0.55;
    const fixed = i < 2;
    addBodyShape(slide, template, pptx.ShapeType.rect, { x, y: 3.12, w: 0.42, h: 0.55 }, { fill: { color: fixed ? COLORS.violet : COLORS.mint }, line: { color: COLORS.white, width: 0.6 } }, "v3 Lab C schedule slot");
    addBodyText(slide, template, String(i + 1), { x, y: 3.27, w: 0.42, h: 0.18 }, { fontSize: 12.5, color: COLORS.white, bold: true, align: "center" }, "v3 Lab C schedule slot text");
  }
  addBodyText(slide, template, "1–2 fixed　｜　3–6 learner action", { x: 6.06, y: 3.82, w: 3.32, h: 0.2 }, { fontSize: 11.5, color: "B8CBDC", bold: true, align: "center" }, "v3 Lab C schedule slot note");
  addBodyText(slide, template, "send · batch · wait · sleep", { x: 6.08, y: 4.15, w: 3.28, h: 0.23 }, { fontSize: 13.4, color: COLORS.white, bold: true, align: "center" }, "v3 Lab C actions");
  addArrowV3(pptx, slide, template, 9.7, 3.15, 0.4, 0, COLORS.mint, { label: "v3 Lab C to withheld" });

  addPanel(slide, template, pptx, { x: 10.12, y: 1.98, w: 2.7, h: 2.62 }, COLORS.white, COLORS.violet, 1.1, "v3 Lab C withheld panel");
  addChipV3(pptx, slide, template, "WITHHELD", { x: 10.74, y: 2.2, w: 1.46, h: 0.32 }, COLORS.violet, { fontSize: 11.6, label: "v3 Lab C withheld chip" });
  addBodyText(slide, template, "freeze → replay", { x: 10.4, y: 2.7, w: 2.14, h: 0.28 }, { fontSize: 15.2, color: COLORS.inference, bold: true, align: "center" }, "v3 Lab C withheld replay");
  addBodyText(slide, template, "shorter window＋urgent", { x: 10.36, y: 3.08, w: 2.22, h: 0.24 }, { fontSize: 12.2, color: COLORS.body, bold: true, align: "center" }, "v3 Lab C withheld event");
  [
    ["SERVICE", COLORS.mint],
    ["FRESH", COLORS.sky],
    ["J", COLORS.violet],
  ].forEach((item, index) => {
    addChipV3(pptx, slide, template, item[0], { x: 10.56, y: 3.5 + index * 0.3, w: 1.74, h: 0.24 }, item[1], { fontSize: 10.2, label: "v3 Lab C result chip" });
  });

  addFourPartRailV3(pptx, slide, template, stage, [
    { label: "操作", value: "排程 → 執行 → 修正 → freeze" },
    { label: "證據", value: "baseline ↔ learner ↔ withheld" },
    { label: "意義", value: "service／freshness／J 分欄" },
    { label: "回復", value: "非法時槽／自動補齊" },
  ], 4.88);
  addClaimRailV3(pptx, slide, template, stage.fact, stage.inference, stage.unknown);
  return slide;
}

function addClinicSlideV3(pptx, template, stage) {
  const slide = pptx.addSlide({ masterName: template.masters.content });
  addStageTitle(pptx, slide, template, stage.title);
  addStageQuestionV3(pptx, slide, template, stage, "先判斷｜當下可用的特徵");

  addBodyText(slide, template, "ONE COHERENT CASE｜沿 timestamp 判斷可用性", { x: 0.82, y: 1.68, w: 12.0, h: 0.28 }, { fontSize: 15.0, color: COLORS.inference, bold: true, align: "center" }, "v3 clinic case title");
  const phases = [
    { x: 0.82, w: 3.38, chip: "AVAILABLE", title: "load(t−2) · quality(t−1)", color: COLORS.mint, fill: COLORS.mintSoft },
    { x: 4.86, w: 3.34, chip: "CHECK", title: "查看 timestamp 再決定", color: COLORS.violet, fill: COLORS.violetSoft },
    { x: 8.86, w: 3.96, chip: "LEAKAGE｜t+1", title: "行動後結果不可偷看", color: COLORS.coral, fill: COLORS.coralSoft },
  ];
  phases.forEach((phase, index) => {
    if (index < phases.length - 1) {
      addArrowV3(pptx, slide, template, phase.x + phase.w, 2.63, 0.66, 0, COLORS.violet, { width: 1.6, label: "v3 clinic phase arrow" });
    }
    addPanel(slide, template, pptx, { x: phase.x, y: 2.04, w: phase.w, h: 1.22 }, COLORS.white, phase.color, 1.05, "v3 clinic phase");
    addChipV3(pptx, slide, template, phase.chip, { x: phase.x + 0.24, y: 2.24, w: Math.min(phase.w - 0.48, 1.55), h: 0.32 }, phase.color, { fontSize: 11.3, label: "v3 clinic phase chip" });
    addBodyText(slide, template, phase.title, { x: phase.x + 0.24, y: 2.7, w: phase.w - 0.48, h: 0.27 }, { fontSize: 14.2, color: COLORS.body, bold: true, align: "center" }, "v3 clinic phase title");
  });
  addBodyShape(slide, template, pptx.ShapeType.ellipse, { x: 7.34, y: 2.13, w: 0.5, h: 0.5 }, { fill: { color: COLORS.white }, line: { color: COLORS.violet, width: 1.4 } }, "v3 clinic clock");
  addBodyText(slide, template, "t0", { x: 7.34, y: 2.29, w: 0.5, h: 0.16 }, { fontSize: 11.5, color: COLORS.violet, bold: true, align: "center" }, "v3 clinic clock text");

  const actions = [
    { x: 0.82, w: 2.56, text: "wait／send", color: COLORS.mint, fill: COLORS.mintSoft },
    { x: 3.72, w: 2.42, text: "freeze 1", color: COLORS.violet, fill: COLORS.violetSoft },
    { x: 6.48, w: 2.72, text: "held-out replay", color: COLORS.violet, fill: COLORS.violetSoft },
    { x: 9.54, w: 3.28, text: "score ∥ service／J", color: COLORS.fact, fill: COLORS.mintSoft },
  ];
  actions.forEach((action, index) => {
    if (index < actions.length - 1) {
      addArrowV3(pptx, slide, template, action.x + action.w, 3.87, 0.34, 0, COLORS.sky, { width: 1.5, label: "v3 clinic action arrow" });
    }
    addPanel(slide, template, pptx, { x: action.x, y: 3.54, w: action.w, h: 0.64 }, COLORS.white, action.color, 1.0, "v3 clinic action");
    addBodyText(slide, template, action.text, { x: action.x + 0.14, y: 3.72, w: action.w - 0.28, h: 0.28 }, { fontSize: 15.2, color: action.color, bold: true, align: "center" }, "v3 clinic action text");
  });
  addChipV3(pptx, slide, template, "CLAIM", { x: 5.89, y: 4.42, w: 1.08, h: 0.3 }, COLORS.navy, { fontSize: 11.3, label: "v3 clinic claim gate" });
  addBodyText(slide, template, "prediction ≠ saving", { x: 7.14, y: 4.42, w: 2.34, h: 0.3 }, { fontSize: 15.0, color: COLORS.inference, bold: true }, "v3 clinic meaning");

  addFourPartRailV3(pptx, slide, template, stage, [
    { label: "操作", value: "timestamp → freeze → replay" },
    { label: "證據", value: "score 與 service／J 並列" },
    { label: "意義", value: "prediction ≠ saving" },
    { label: "回復", value: "提示／誠實 fallback" },
  ], 4.9);
  addClaimRailV3(pptx, slide, template, stage.fact, stage.inference, stage.unknown);
  return slide;
}

function addTransferSlideV3(pptx, template, stage) {
  const slide = pptx.addSlide({ masterName: template.masters.content });
  addStageTitle(pptx, slide, template, stage.title);
  addStageQuestionV3(pptx, slide, template, stage, "決定｜new domain → falsifier");

  const tokens = [
    { x: 0.82, text: "A pace", color: COLORS.violet },
    { x: 2.34, text: "B policy", color: COLORS.coral },
    { x: 3.86, text: "C schedule", color: COLORS.mint },
    { x: 5.54, text: "clinic claim", color: COLORS.sky },
  ];
  addBodyText(slide, template, "TOKEN BANK", { x: 0.82, y: 1.64, w: 1.3, h: 0.24 }, { fontSize: 11.8, color: COLORS.muted, bold: true }, "v3 transfer token bank");
  tokens.forEach((token) => {
    addChipV3(pptx, slide, template, token.text, { x: token.x, y: 1.94, w: token.text === "clinic claim" ? 1.5 : 1.3, h: 0.32 }, token.color, { fontSize: 11.3, label: "v3 transfer token" });
  });
  addArrowV3(pptx, slide, template, 7.24, 2.1, 0.58, 0, COLORS.sky, { label: "v3 transfer token arrow" });
  addChipV3(pptx, slide, template, "TRANSFER", { x: 7.86, y: 1.94, w: 1.25, h: 0.32 }, COLORS.navy, { fontSize: 11.2, label: "v3 transfer hub" });
  addBodyText(slide, template, "把機制與取捨帶走，不搬衛星數值", { x: 9.34, y: 1.9, w: 3.48, h: 0.4 }, { fontSize: 13.2, color: COLORS.body, bold: true, align: "right" }, "v3 transfer token meaning");

  addPanel(slide, template, pptx, { x: 0.82, y: 2.48, w: 2.62, h: 2.15 }, COLORS.skySoft, stage.accent, 1.1, "v3 transfer unseen domain");
  addChipV3(pptx, slide, template, "UNSEEN DOMAIN", { x: 1.2, y: 2.72, w: 1.86, h: 0.32 }, stage.accent, { fontSize: 11.3, label: "v3 unseen domain chip" });
  addBodyText(slide, template, "SMART FARM", { x: 1.04, y: 3.22, w: 2.18, h: 0.33 }, { fontSize: 18.0, color: COLORS.body, bold: true, align: "center" }, "v3 unseen domain title");
  addBodyShape(slide, template, pptx.ShapeType.ellipse, { x: 1.34, y: 3.77, w: 0.36, h: 0.36 }, { fill: { color: COLORS.sky }, line: { color: COLORS.sky, width: 0.5 } }, "v3 transfer moisture");
  addBodyShape(slide, template, pptx.ShapeType.line, { x: 2.27, y: 3.68, w: 0, h: 0.5 }, { line: { color: COLORS.mint, width: 1.6 } }, "v3 transfer plant stem");
  addBodyShape(slide, template, pptx.ShapeType.arc, { x: 2.02, y: 3.62, w: 0.34, h: 0.28 }, { adjustPoint: 0.3, fill: { color: COLORS.white, transparency: 100 }, line: { color: COLORS.mint, width: 1.4 } }, "v3 transfer plant leaf");
  addBodyText(slide, template, "moisture → irrigation", { x: 1.0, y: 4.28, w: 2.26, h: 0.22 }, { fontSize: 12.4, color: stage.accent, bold: true, align: "center" }, "v3 unseen domain detail");

  const nodes = [
    { x: 3.82, y: 2.52, text: "1  data／time", color: COLORS.sky, fill: COLORS.skySoft },
    { x: 6.55, y: 2.52, text: "2  control", color: COLORS.navy, fill: COLORS.navy },
    { x: 9.28, y: 2.52, text: "3  service", color: COLORS.mint, fill: COLORS.mintSoft },
    { x: 9.28, y: 3.67, text: "4  P×time", color: COLORS.violet, fill: COLORS.violetSoft },
    { x: 6.55, y: 3.67, text: "5  J", color: COLORS.fact, fill: COLORS.mintSoft },
    { x: 3.82, y: 3.67, text: "6  量測／反證", color: COLORS.coral, fill: COLORS.coralSoft },
  ];
  nodes.forEach((node, index) => {
    const dark = node.fill === COLORS.navy;
    addPanel(slide, template, pptx, { x: node.x, y: node.y, w: 2.3, h: 0.72 }, node.fill, node.color, 1.0, "v3 transfer causal node");
    addBodyText(slide, template, node.text, { x: node.x + 0.14, y: node.y + 0.2, w: 2.02, h: 0.3 }, { fontSize: 14.5, color: dark ? COLORS.white : node.color, bold: true, align: "center" }, "v3 transfer causal node text");
  });
  addArrowV3(pptx, slide, template, 6.16, 2.88, 0.32, 0, COLORS.sky, { width: 1.45, label: "v3 transfer arrow 1" });
  addArrowV3(pptx, slide, template, 8.89, 2.88, 0.32, 0, COLORS.sky, { width: 1.45, label: "v3 transfer arrow 2" });
  addArrowV3(pptx, slide, template, 10.43, 3.26, 0, 0.34, COLORS.violet, { width: 1.45, label: "v3 transfer arrow 3" });
  addArrowV3(pptx, slide, template, 9.23, 4.03, -0.32, 0, COLORS.violet, { width: 1.45, label: "v3 transfer arrow 4" });
  addArrowV3(pptx, slide, template, 6.5, 4.03, -0.32, 0, COLORS.violet, { width: 1.45, label: "v3 transfer arrow 5" });

  addPanel(slide, template, pptx, { x: 3.82, y: 4.6, w: 8.86, h: 0.78 }, COLORS.sand, stage.accent, 0.95, "v3 transfer output");
  addChipV3(pptx, slide, template, "OUTPUT", { x: 4.05, y: 4.82, w: 0.92, h: 0.3 }, stage.accent, { fontSize: 10.9, label: "v3 transfer output chip" });
  addBodyText(slide, template, "hypothesis＋falsifier → what-if → revise → export", { x: 5.16, y: 4.74, w: 5.42, h: 0.28 }, { fontSize: 15.0, color: stage.accent, bold: true, align: "center" }, "v3 transfer output path");
  addBodyText(slide, template, "操作／證據｜映射後提出可被量測推翻的主張　　回復｜hint／system what-if", { x: 4.1, y: 5.08, w: 8.32, h: 0.19 }, { fontSize: 11.6, color: COLORS.muted, bold: true, align: "center" }, "v3 transfer output detail");

  addClaimRailV3(pptx, slide, template, stage.fact, stage.inference, stage.unknown);
  return slide;
}

function addCalibrationQuestionV4(pptx, slide, template, stage, prediction) {
  addChipV3(
    pptx,
    slide,
    template,
    "核心問題",
    { x: 0.82, y: 1.06, w: 1.08, h: 0.36 },
    stage.accent,
    { fontSize: 12.2, label: "v4 question chip" },
  );
  addBodyText(
    slide,
    template,
    stage.question,
    { x: 2.06, y: 1.05, w: 7.36, h: 0.44 },
    { fontSize: 22, color: CALIBRATION.ink, bold: true, valign: "mid" },
    "v4 driving question",
  );
  addBodyText(
    slide,
    template,
    prediction,
    { x: 9.55, y: 1.07, w: 3.27, h: 0.34 },
    { fontSize: 14.5, color: stage.accent, bold: true, align: "right", valign: "mid" },
    "v4 learner prediction",
  );
  addFlowLine(slide, template, pptx, 0.82, 1.49, 12.0, 0, stage.accent, 1.15, "v4 question rule");
}

function addClaimDockV4(pptx, slide, template, claims) {
  const band = { x: 0.82, y: 5.82, w: 12.0, h: 0.67 };
  addPanel(slide, template, pptx, band, CALIBRATION.paper, CALIBRATION.line, 0.95, "v4 claim dock");
  const items = [
    { x: 0.82, w: 3.32, label: "FACT", chipW: 0.72, color: CALIBRATION.green, value: claims.fact },
    { x: 4.14, w: 4.38, label: "DESIGN INFERENCE", chipW: 1.55, color: CALIBRATION.violet, value: claims.inference },
    { x: 8.52, w: 4.3, label: "UNKNOWN", chipW: 1.04, color: CALIBRATION.coral, value: claims.unknown },
  ];
  [4.14, 8.52].forEach((x) => {
    addFlowLine(slide, template, pptx, x, 5.92, 0, 0.47, CALIBRATION.line, 0.85, "v4 claim dock divider");
  });
  items.forEach((item, index) => {
    addChipV3(
      pptx,
      slide,
      template,
      item.label,
      { x: item.x + 0.12, y: 5.99, w: item.chipW, h: 0.32 },
      item.color,
      { fontSize: 11.5, label: "v4 claim label " + (index + 1) },
    );
    addBodyText(
      slide,
      template,
      item.value,
      { x: item.x + item.chipW + 0.24, y: 5.94, w: item.w - item.chipW - 0.34, h: 0.43 },
      { fontSize: 14.0, color: CALIBRATION.ink, bold: true, valign: "mid" },
      "v4 claim value " + (index + 1),
    );
  });
}

function addCourseOutlineSlideV4(pptx, template) {
  const slide = pptx.addSlide({ masterName: template.masters.content });
  addTitle(slide, template, "C-120 LEO 能源決策課程｜Phase 0 完整課程大綱");

  addBodyText(
    slide,
    template,
    "10 + 8 + 23 + 23 + 5 + 23 + 14 + 14 = 120",
    { x: 0.82, y: 1.05, w: 12.0, h: 0.4 },
    { fontSize: 30, bold: true, color: CALIBRATION.navy, align: "center" },
    "v4 cadence equation",
  );
  addBodyText(
    slide,
    template,
    "energy-first  →  LEO-as-index  →  同一份 Energy Decision Workbook",
    { x: 0.92, y: 1.47, w: 11.8, h: 0.33 },
    { fontSize: 19.5, bold: true, color: CALIBRATION.green, align: "center" },
    "v4 course mainline",
  );

  const routeLabels = [
    "主張判讀",
    "TLE 資料錨點",
    "Lab A｜同工異速",
    "Lab B｜先行或等",
    "回復與重整",
    "Lab C｜分配焦耳",
    "證據檢核",
    "競賽轉移／離場",
  ];
  const minutes = [10, 8, 23, 23, 5, 23, 14, 14];
  const accents = [
    CALIBRATION.sky,
    CALIBRATION.blueGray,
    CALIBRATION.violet,
    CALIBRATION.coral,
    CALIBRATION.blueGray,
    CALIBRATION.green,
    CALIBRATION.violet,
    CALIBRATION.sky,
  ];
  const routeXs = [0.82, 3.84, 6.86, 9.88];
  const routeYs = [1.94, 2.61];

  for (let col = 0; col < 3; col += 1) {
    addArrowV3(pptx, slide, template, routeXs[col] + 2.73, routeYs[0] + 0.29, 0.26, 0, CALIBRATION.sky, { width: 1.8, label: "v4 route arrow top" });
  }
  addArrowV3(pptx, slide, template, 12.68, 2.29, 0, 0.23, CALIBRATION.violet, { width: 1.7, label: "v4 route turn" });
  for (let col = 3; col > 0; col -= 1) {
    addArrowV3(pptx, slide, template, routeXs[col], routeYs[1] + 0.29, -0.26, 0, CALIBRATION.sky, { width: 1.8, label: "v4 route arrow bottom" });
  }

  routeLabels.forEach((label, index) => {
    const row = index < 4 ? 0 : 1;
    const col = row === 0 ? index : 7 - index;
    const x = routeXs[col];
    const y = routeYs[row];
    addPanel(slide, template, pptx, { x, y, w: 2.73, h: 0.56 }, CALIBRATION.paper, CALIBRATION.navy, 0.95, "v4 route card");
    addChipV3(
      pptx,
      slide,
      template,
      String(minutes[index]),
      { x: x + 0.1, y: y + 0.1, w: 0.54, h: 0.36 },
      accents[index],
      { fontSize: 17, label: "v4 route minutes" },
    );
    addBodyText(
      slide,
      template,
      label,
      { x: x + 0.76, y: y + 0.08, w: 1.83, h: 0.4 },
      { fontSize: 14.4, color: CALIBRATION.ink, bold: true, align: "center", valign: "mid" },
      "v4 route label",
    );
  });

  addPanel(slide, template, pptx, { x: 0.82, y: 3.38, w: 12.0, h: 0.96 }, CALIBRATION.navy, CALIBRATION.navy, 1.0, "v4 reading backbone");
  addChipV3(pptx, slide, template, "共同判讀骨架", { x: 1.0, y: 3.56, w: 1.48, h: 0.34 }, CALIBRATION.sky, { fontSize: 12.3, color: CALIBRATION.navy, label: "v4 backbone label" });
  const backbone = [
    { x: 2.82, term: "W", note: "當下功率" },
    { x: 4.66, term: "時間", note: "累積多久" },
    { x: 6.58, term: "J", note: "總能源" },
    { x: 8.49, term: "服務", note: "是否合格" },
    { x: 10.53, term: "bit/J", note: "邊界內效率" },
  ];
  backbone.forEach((item, index) => {
    addBodyText(slide, template, item.term, { x: item.x, y: 3.48, w: 1.15, h: 0.36 }, { fontSize: 19, color: CALIBRATION.white, bold: true, align: "center" }, "v4 backbone term");
    addBodyText(slide, template, item.note, { x: item.x - 0.08, y: 3.88, w: 1.31, h: 0.22 }, { fontSize: 11.8, color: "BFD4E0", bold: true, align: "center" }, "v4 backbone note");
    if (index < backbone.length - 1) {
      addArrowV3(pptx, slide, template, item.x + 1.18, 3.68, 0.47, 0, CALIBRATION.sky, { width: 1.7, label: "v4 backbone arrow" });
    }
  });

  addPanel(slide, template, pptx, { x: 0.82, y: 4.51, w: 5.9, h: 0.61 }, CALIBRATION.greenSoft, CALIBRATION.green, 1.0, "v4 mission contract band");
  addChipV3(pptx, slide, template, "MISSION CONTRACT", { x: 1.02, y: 4.66, w: 1.42, h: 0.32 }, CALIBRATION.green, { fontSize: 11.5, label: "v4 mission contract chip" });
  addBodyText(slide, template, "service pass · freshness · deadline", { x: 2.62, y: 4.56, w: 3.82, h: 0.25 }, { fontSize: 14.2, color: CALIBRATION.ink, bold: true, align: "center" }, "v4 mission contract row one");
  addBodyText(slide, template, "energy budget · window", { x: 2.62, y: 4.83, w: 3.82, h: 0.23 }, { fontSize: 14.2, color: CALIBRATION.ink, bold: true, align: "center" }, "v4 mission contract row two");

  addPanel(slide, template, pptx, { x: 6.92, y: 4.51, w: 5.9, h: 0.61 }, CALIBRATION.violetSoft, CALIBRATION.violet, 1.0, "v4 distinctions band");
  addChipV3(pptx, slide, template, "不互換", { x: 7.13, y: 4.66, w: 0.9, h: 0.32 }, CALIBRATION.violet, { fontSize: 11.5, label: "v4 distinctions chip" });
  addBodyText(slide, template, "W ≠ J｜bit/s ≠ bit/J｜active time", { x: 8.13, y: 4.6, w: 4.48, h: 0.38 }, { fontSize: 16, color: CALIBRATION.ink, bold: true, align: "center" }, "v4 distinctions text");

  addBodyText(
    slide,
    template,
    "模擬教學資料、非即時、非量測、尚未通過 canonical parity 驗證。",
    { x: 0.92, y: 5.28, w: 11.8, h: 0.28 },
    { fontSize: 14.0, color: CALIBRATION.coral, bold: true, align: "center" },
    "v4 claim ceiling",
  );
  addClaimDockV4(pptx, slide, template, {
    fact: "EE＝delivered bits／consumed J",
    inference: "9頁｜120分待實證",
    unknown: "browser／classroom／parity",
  });
  return slide;
}

function addClaimsSlideV4(pptx, template, stage) {
  const slide = pptx.addSlide({ masterName: template.masters.content });
  addStageTitle(pptx, slide, template, stage.title);
  addCalibrationQuestionV4(pptx, slide, template, stage, "先判｜A／Q／R＋信心");

  const claims = [
    { letter: "A", title: "平均 W 較低", note: "service_pass＋期限", color: CALIBRATION.sky },
    { letter: "B", title: "較快完成", note: "active time＋完成時刻", color: CALIBRATION.green },
    { letter: "C", title: "bit/J 高但漏 deadline", note: "逾期＝服務不合格", color: CALIBRATION.coral },
  ];
  claims.forEach((item, index) => {
    const y = 1.73 + index * 0.88;
    addPanel(slide, template, pptx, { x: 0.82, y, w: 3.28, h: 0.74 }, CALIBRATION.paper, item.color, 1.05, "v4 claim card");
    addBodyShape(slide, template, pptx.ShapeType.ellipse, { x: 1.03, y: y + 0.13, w: 0.48, h: 0.48 }, { fill: { color: item.color }, line: { color: item.color, width: 0.6 } }, "v4 claim letter");
    addBodyText(slide, template, item.letter, { x: 1.03, y: y + 0.13, w: 0.48, h: 0.48 }, { fontSize: 17, color: CALIBRATION.white, bold: true, align: "center" }, "v4 claim letter text");
    addBodyText(slide, template, item.title, { x: 1.7, y: y + 0.1, w: 2.18, h: 0.29 }, { fontSize: 16.5, color: CALIBRATION.ink, bold: true }, "v4 claim title");
    addBodyText(slide, template, item.note, { x: 1.7, y: y + 0.42, w: 2.18, h: 0.2 }, { fontSize: 12.5, color: CALIBRATION.muted, bold: true }, "v4 claim note");
  });

  addArrowV3(pptx, slide, template, 4.13, 3.0, 0.22, 0, CALIBRATION.sky, { width: 1.9, label: "v4 claim to contract" });
  addPanel(slide, template, pptx, { x: 4.36, y: 1.73, w: 3.5, h: 2.85 }, CALIBRATION.navy, CALIBRATION.navy, 1.1, "v4 mission contract hub");
  addChipV3(pptx, slide, template, "MISSION CONTRACT", { x: 5.01, y: 1.96, w: 2.2, h: 0.34 }, CALIBRATION.sky, { fontSize: 12.2, color: CALIBRATION.navy, label: "v4 mission contract hub chip" });
  addBodyText(slide, template, "先固定可比邊界", { x: 4.72, y: 2.39, w: 2.78, h: 0.34 }, { fontSize: 19, color: CALIBRATION.white, bold: true, align: "center" }, "v4 mission contract hub title");
  [
    "工作量／payload",
    "deadline／service_pass",
    "idle／wakeup",
    "單位／時間窗",
  ].forEach((text, index) => {
    addBodyText(slide, template, text, { x: 4.78, y: 2.83 + index * 0.29, w: 2.65, h: 0.24 }, { fontSize: 14.3, color: "D7E8EF", bold: true, align: "center" }, "v4 mission contract condition");
  });
  addChipV3(pptx, slide, template, "COMPARABLE?", { x: 5.12, y: 4.02, w: 1.98, h: 0.32 }, CALIBRATION.paper, { fontSize: 13.2, color: CALIBRATION.navy, label: "v4 comparable gate" });
  addBodyText(slide, template, "條件不同＝INCOMPARABLE", { x: 4.68, y: 4.35, w: 2.86, h: 0.18 }, { fontSize: 12.5, color: CALIBRATION.coralSoft, bold: true, align: "center" }, "v4 incomparable warning");

  addArrowV3(pptx, slide, template, 7.89, 3.0, 0.23, 0, CALIBRATION.sky, { width: 1.9, label: "v4 contract to verdict" });
  addPanel(slide, template, pptx, { x: 8.13, y: 1.73, w: 4.69, h: 2.85 }, CALIBRATION.paper, stage.accent, 1.05, "v4 verdict board");
  addChipV3(pptx, slide, template, "REVEAL → VERDICT", { x: 8.74, y: 1.96, w: 3.47, h: 0.36 }, stage.accent, { fontSize: 14, label: "v4 verdict heading" });
  addBodyText(slide, template, "○ A　○ Q　○ R", { x: 8.74, y: 2.54, w: 3.47, h: 0.36 }, { fontSize: 22, color: stage.accent, bold: true, align: "center" }, "v4 verdict choices");
  addBodyText(slide, template, "信心：低／中／高", { x: 8.74, y: 2.93, w: 3.47, h: 0.3 }, { fontSize: 16, color: CALIBRATION.muted, bold: true, align: "center" }, "v4 verdict confidence");
  addFlowLine(slide, template, pptx, 8.58, 3.36, 3.79, 0, CALIBRATION.line, 0.9, "v4 verdict divider");
  addBodyText(slide, template, "揭露：J／時間／service", { x: 8.54, y: 3.51, w: 3.87, h: 0.34 }, { fontSize: 16.5, color: CALIBRATION.ink, bold: true, align: "center" }, "v4 verdict reveal");
  addBodyText(slide, template, "只允許改判 1 次", { x: 8.54, y: 4.02, w: 3.87, h: 0.34 }, { fontSize: 18, color: CALIBRATION.coral, bold: true, align: "center" }, "v4 verdict revision limit");

  addPanel(slide, template, pptx, { x: 0.82, y: 4.79, w: 12.0, h: 0.7 }, CALIBRATION.cream, CALIBRATION.line, 0.95, "v4 claim summary");
  addFlowLine(slide, template, pptx, 7.15, 4.9, 0, 0.48, CALIBRATION.line, 0.85, "v4 claim summary divider");
  addChipV3(pptx, slide, template, "操作／證據", { x: 1.02, y: 4.98, w: 1.18, h: 0.32 }, stage.accent, { fontSize: 11.5, label: "v4 claim operation chip" });
  addBodyText(slide, template, "初判 → 鎖定 → 揭露 → 改判一次", { x: 2.42, y: 4.91, w: 4.45, h: 0.39 }, { fontSize: 16, color: CALIBRATION.ink, bold: true, align: "center" }, "v4 claim operation summary");
  addChipV3(pptx, slide, template, "意義／回復", { x: 7.37, y: 4.98, w: 1.18, h: 0.32 }, CALIBRATION.navy, { fontSize: 11.5, label: "v4 claim recovery chip" });
  addBodyText(slide, template, "先固定服務邊界｜單位提示", { x: 8.78, y: 4.91, w: 3.78, h: 0.39 }, { fontSize: 15, color: CALIBRATION.ink, bold: true, align: "center" }, "v4 claim meaning recovery");

  addClaimDockV4(pptx, slide, template, {
    fact: "W≠J｜bit/s≠bit/J",
    inference: "3–4頁＋1活動（設計估計）",
    unknown: "cards／stakes／novice timing",
  });
  return slide;
}

function addLabASlideV4(pptx, template, stage) {
  const slide = pptx.addSlide({ masterName: template.masters.content });
  addStageTitle(pptx, slide, template, stage.title);
  addCalibrationQuestionV4(pptx, slide, template, stage, "先選｜slow／balanced／fast");

  addBodyText(slide, template, "固定比較｜同工作量・同 deadline・同系統邊界", { x: 0.82, y: 1.62, w: 6.5, h: 0.27 }, { fontSize: 14.5, color: CALIBRATION.muted, bold: true }, "v4 Lab A fixed comparison");
  addBodyText(slide, template, "設計估計｜5 reference → 11 operation → 5 debrief → 2 transition", { x: 6.96, y: 1.63, w: 5.86, h: 0.24 }, { fontSize: 11.8, color: CALIBRATION.violet, bold: true, align: "right" }, "v4 Lab A timing estimate");
  addFlowLine(slide, template, pptx, 0.82, 1.97, 12.0, 0, CALIBRATION.line, 0.9, "v4 Lab A metadata rule");

  const strategies = [
    { label: "慢速", detail: "低 W\n時間長", color: CALIBRATION.green },
    { label: "平衡", detail: "中 W\n時間中", color: CALIBRATION.blueGray },
    { label: "高速後休眠", detail: "高 W\n時間短", color: CALIBRATION.violet },
  ];
  strategies.forEach((item, index) => {
    const y = 2.11 + index * 0.87;
    addPanel(slide, template, pptx, { x: 0.82, y, w: 3.22, h: 0.72 }, CALIBRATION.paper, item.color, 1.05, "v4 Lab A strategy card");
    addChipV3(pptx, slide, template, item.label, { x: 1.02, y: y + 0.19, w: 1.12, h: 0.34 }, item.color, { fontSize: 13.3, label: "v4 Lab A strategy label" });
    addBodyText(slide, template, item.detail, { x: 2.34, y: y + 0.05, w: 1.47, h: 0.6 }, { fontSize: 16.2, color: CALIBRATION.ink, bold: true, align: "center", valign: "mid" }, "v4 Lab A strategy detail");
  });

  addArrowV3(pptx, slide, template, 4.07, 3.24, 0.25, 0, CALIBRATION.sky, { width: 1.9, label: "v4 Lab A strategy arrow" });
  addPanel(slide, template, pptx, { x: 4.35, y: 2.11, w: 4.08, h: 2.55 }, CALIBRATION.navy, CALIBRATION.navy, 1.1, "v4 Lab A causal hub");
  addChipV3(pptx, slide, template, "SAME JOB", { x: 5.62, y: 2.32, w: 1.55, h: 0.34 }, CALIBRATION.sky, { fontSize: 12.2, color: CALIBRATION.navy, label: "v4 Lab A same job chip" });
  addBodyText(slide, template, "同工作量・同 deadline", { x: 4.7, y: 2.78, w: 3.38, h: 0.28 }, { fontSize: 16.5, color: CALIBRATION.white, bold: true, align: "center" }, "v4 Lab A fixed mission");
  addBodyText(slide, template, "同一系統邊界", { x: 4.7, y: 3.05, w: 3.38, h: 0.25 }, { fontSize: 15, color: "BDD3DF", bold: true, align: "center" }, "v4 Lab A fixed boundary");
  addBodyText(slide, template, "W × active time", { x: 4.74, y: 3.34, w: 3.3, h: 0.36 }, { fontSize: 23, color: CALIBRATION.white, bold: true, align: "center" }, "v4 Lab A power time");
  addBodyText(slide, template, "→ consumed J", { x: 4.74, y: 3.72, w: 3.3, h: 0.32 }, { fontSize: 20, color: CALIBRATION.sky, bold: true, align: "center" }, "v4 Lab A consumed energy");
  addChipV3(pptx, slide, template, "SERVICE PASS", { x: 5.49, y: 4.08, w: 1.82, h: 0.32 }, CALIBRATION.green, { fontSize: 12.3, label: "v4 Lab A service gate" });
  addBodyText(slide, template, "鎖定策略 → hidden replay", { x: 4.68, y: 4.39, w: 3.42, h: 0.21 }, { fontSize: 14.5, color: "D7E8EF", bold: true, align: "center" }, "v4 Lab A hidden replay");

  addArrowV3(pptx, slide, template, 8.46, 3.24, 0.23, 0, CALIBRATION.sky, { width: 1.9, label: "v4 Lab A ledger arrow" });
  addPanel(slide, template, pptx, { x: 8.72, y: 2.11, w: 4.1, h: 2.55 }, CALIBRATION.paper, CALIBRATION.line, 1.05, "v4 Lab A ledger");
  addChipV3(pptx, slide, template, "AUTO-LEDGER", { x: 9.32, y: 2.32, w: 2.9, h: 0.36 }, CALIBRATION.sky, { fontSize: 13.5, color: CALIBRATION.navy, label: "v4 Lab A ledger heading" });
  addBodyText(slide, template, "回放後自動填入", { x: 9.08, y: 2.77, w: 3.38, h: 0.28 }, { fontSize: 16, color: CALIBRATION.ink, bold: true, align: "center" }, "v4 Lab A ledger description");
  const ledger = [
    { label: "SERVICE", value: "service_pass", color: CALIBRATION.green },
    { label: "J", value: "consumed J", color: CALIBRATION.violet },
    { label: "EE", value: "bit/J", color: CALIBRATION.sky },
    { label: "TIME", value: "完成時刻", color: CALIBRATION.blueGray },
  ];
  ledger.forEach((item, index) => {
    const y = 3.17 + index * 0.34;
    addChipV3(pptx, slide, template, item.label, { x: 9.04, y, w: 0.86, h: 0.27 }, item.color, { fontSize: 11.5, label: "v4 Lab A ledger label" });
    addBodyText(slide, template, item.value, { x: 10.11, y: y - 0.01, w: 2.26, h: 0.29 }, { fontSize: 14.5, color: CALIBRATION.ink, bold: true }, "v4 Lab A ledger value");
  });

  addPanel(slide, template, pptx, { x: 0.82, y: 4.91, w: 12.0, h: 0.62 }, CALIBRATION.cream, CALIBRATION.line, 0.95, "v4 Lab A summary");
  addFlowLine(slide, template, pptx, 6.83, 5.01, 0, 0.42, CALIBRATION.line, 0.85, "v4 Lab A summary divider");
  addChipV3(pptx, slide, template, "操作／證據", { x: 1.02, y: 5.06, w: 1.18, h: 0.32 }, CALIBRATION.violet, { fontSize: 11.5, label: "v4 Lab A operation chip" });
  addBodyText(slide, template, "選策略 → hidden replay → ledger", { x: 2.42, y: 4.99, w: 4.12, h: 0.39 }, { fontSize: 15.5, color: CALIBRATION.ink, bold: true, align: "center" }, "v4 Lab A operation summary");
  addChipV3(pptx, slide, template, "意義／回復", { x: 7.04, y: 5.06, w: 1.18, h: 0.32 }, CALIBRATION.navy, { fontSize: 11.5, label: "v4 Lab A recovery chip" });
  addBodyText(slide, template, "排序可翻轉｜同 scenario 反例重設", { x: 8.44, y: 4.99, w: 4.12, h: 0.39 }, { fontSize: 15, color: CALIBRATION.ink, bold: true, align: "center" }, "v4 Lab A meaning recovery");

  addClaimDockV4(pptx, slide, template, {
    fact: "W≠J｜bit/s≠bit/J",
    inference: "5–6頁＋1 lab（設計估計）",
    unknown: "state change／反例未驗證",
  });
  return slide;
}

// V5 readability calibration follows the first Phase-0 donor's information
// hierarchy: one large question, a small number of large visual groups, and two
// large learning-outcome cards.  Small type is reserved for claim-boundary
// metadata.  All authored panels use white or pale fills; dark colors remain
// text, rules, and outlines only.
function addLightLabelV5(pptx, slide, template, text, box, pale, accent, options = {}) {
  addPanel(slide, template, pptx, box, pale, accent, options.lineWidth || 1.0, options.label || "v5 light label");
  addBodyText(
    slide,
    template,
    text,
    { x: box.x + 0.08, y: box.y + 0.03, w: box.w - 0.16, h: box.h - 0.06 },
    {
      fontSize: options.fontSize || 14.5,
      color: accent,
      bold: options.bold !== false,
      align: options.align || "center",
      valign: "mid",
    },
    (options.label || "v5 light label") + " text",
  );
}

function addQuestionV5(pptx, slide, template, stage, prediction) {
  addLightLabelV5(
    pptx,
    slide,
    template,
    "核心問題",
    { x: 0.82, y: 1.06, w: 1.25, h: 0.38 },
    stage.pale,
    stage.accent,
    { fontSize: 14.5, label: "v5 question label" },
  );
  addBodyText(
    slide,
    template,
    stage.question,
    { x: 2.25, y: 1.05, w: 7.0, h: 0.44 },
    { fontSize: 22, color: COLORS.body, bold: true, valign: "mid" },
    "v5 driving question",
  );
  addBodyText(
    slide,
    template,
    prediction,
    { x: 9.42, y: 1.07, w: 3.4, h: 0.36 },
    { fontSize: 15.5, color: stage.accent, bold: true, align: "right", valign: "mid" },
    "v5 learner prediction",
  );
  addFlowLine(slide, template, pptx, 0.82, 1.51, 12.0, 0, stage.accent, 1.15, "v5 question rule");
}

function addOutcomeBandV5(pptx, slide, template, stage, left, right, y = 4.87) {
  const cards = [
    { x: 0.82, w: 5.9, label: "操作／證據", value: left, fill: stage.pale },
    { x: 6.92, w: 5.9, label: "意義／回復", value: right, fill: COLORS.sand },
  ];
  cards.forEach((card, index) => {
    addPanel(slide, template, pptx, { x: card.x, y, w: card.w, h: 0.72 }, card.fill, stage.accent, 1.0, "v5 outcome card");
    addBodyText(slide, template, card.label, { x: card.x + 0.18, y: y + 0.1, w: 1.25, h: 0.22 }, { fontSize: 14.2, color: stage.accent, bold: true, align: "center" }, "v5 outcome label " + (index + 1));
    addBodyText(slide, template, card.value, { x: card.x + 1.58, y: y + 0.08, w: card.w - 1.78, h: 0.52 }, { fontSize: 16, color: COLORS.body, bold: true, align: "center", valign: "mid" }, "v5 outcome value " + (index + 1));
  });
}

function addClaimDockV5(pptx, slide, template, claims) {
  const y = 5.77;
  const items = [
    { x: 0.82, w: 3.62, label: "FACT", value: claims.fact, color: COLORS.fact, fill: COLORS.mintSoft },
    { x: 4.57, w: 4.28, label: "DESIGN INFERENCE", value: claims.inference, color: COLORS.inference, fill: COLORS.violetSoft },
    { x: 8.98, w: 3.84, label: "UNKNOWN", value: claims.unknown, color: COLORS.unknown, fill: COLORS.coralSoft },
  ];
  items.forEach((item, index) => {
    addPanel(slide, template, pptx, { x: item.x, y, w: item.w, h: 0.72 }, item.fill, item.color, 0.85, "v5 claim card");
    addBodyText(slide, template, item.label, { x: item.x + 0.15, y: y + 0.06, w: item.w - 0.3, h: 0.2 }, { fontSize: 13.5, color: item.color, bold: true }, "v5 claim label " + (index + 1));
    addBodyText(slide, template, item.value, { x: item.x + 0.15, y: y + 0.29, w: item.w - 0.3, h: 0.35 }, { fontSize: 14.2, color: item.color, bold: true, valign: "mid" }, "v5 claim value " + (index + 1));
  });
}

function addCourseOutlineSlideV5(pptx, template) {
  const slide = pptx.addSlide({ masterName: template.masters.content });
  addTitle(slide, template, "C-120 LEO 能源決策課程｜Phase 0 完整課程大綱");

  addBodyText(slide, template, "10 + 8 + 23 + 23 + 5 + 23 + 14 + 14 = 120", { x: 0.82, y: 1.05, w: 12.0, h: 0.42 }, { fontSize: 30, color: COLORS.ink, bold: true, align: "center" }, "v5 cadence equation");
  addBodyText(slide, template, "energy-first → LEO-as-index → 同一份 Energy Decision Workbook", { x: 0.92, y: 1.48, w: 11.8, h: 0.34 }, { fontSize: 20, color: COLORS.fact, bold: true, align: "center" }, "v5 course mainline");

  const labels = ["主張判讀", "TLE 資料錨點", "Lab A｜同工異速", "Lab B｜先行或等", "回復與重整", "Lab C｜分配焦耳", "證據檢核", "競賽轉移／離場"];
  const minutes = [10, 8, 23, 23, 5, 23, 14, 14];
  const xs = [0.82, 3.84, 6.86, 9.88];
  const ys = [1.94, 2.63];
  STAGES.forEach((stage, index) => {
    const row = index < 4 ? 0 : 1;
    const col = row === 0 ? index : 7 - index;
    const x = xs[col];
    const y = ys[row];
    addPanel(slide, template, pptx, { x, y, w: 2.73, h: 0.58 }, stage.pale, stage.accent, 1.0, "v5 route card");
    addBodyText(slide, template, String(minutes[index]), { x: x + 0.12, y: y + 0.1, w: 0.55, h: 0.34 }, { fontSize: 18, color: stage.accent, bold: true, align: "center" }, "v5 route minutes");
    addBodyText(slide, template, labels[index], { x: x + 0.75, y: y + 0.08, w: 1.82, h: 0.4 }, { fontSize: 15.5, color: COLORS.body, bold: true, align: "center", valign: "mid" }, "v5 route label");
  });
  for (let col = 0; col < 3; col += 1) {
    addArrowV3(pptx, slide, template, xs[col] + 2.75, ys[0] + 0.29, 0.24, 0, COLORS.sky, { width: 1.6, label: "v5 route arrow top" });
    addArrowV3(pptx, slide, template, xs[col + 1], ys[1] + 0.29, -0.24, 0, COLORS.sky, { width: 1.6, label: "v5 route arrow bottom" });
  }
  addArrowV3(pptx, slide, template, 12.68, 2.31, 0, 0.23, COLORS.violet, { width: 1.6, label: "v5 route turn" });

  addPanel(slide, template, pptx, { x: 0.82, y: 3.39, w: 12.0, h: 0.84 }, COLORS.blueSoft, COLORS.blueGray, 1.0, "v5 reading backbone");
  addBodyText(slide, template, "共同判讀骨架", { x: 1.02, y: 3.54, w: 1.5, h: 0.28 }, { fontSize: 15, color: COLORS.blueGray, bold: true, align: "center" }, "v5 backbone heading");
  const backbone = [
    { x: 2.85, term: "W", note: "當下功率" },
    { x: 4.62, term: "active time", note: "累積多久" },
    { x: 6.67, term: "J", note: "總能源" },
    { x: 8.47, term: "service", note: "是否合格" },
    { x: 10.48, term: "bit/J", note: "邊界內效率" },
  ];
  backbone.forEach((item, index) => {
    addBodyText(slide, template, item.term, { x: item.x, y: 3.47, w: 1.24, h: 0.32 }, { fontSize: 19, color: COLORS.ink, bold: true, align: "center" }, "v5 backbone term");
    addBodyText(slide, template, item.note, { x: item.x - 0.05, y: 3.83, w: 1.34, h: 0.24 }, { fontSize: 14.5, color: COLORS.blueGray, bold: true, align: "center" }, "v5 backbone note");
    if (index < backbone.length - 1) {
      addArrowV3(pptx, slide, template, item.x + 1.27, 3.67, 0.37, 0, COLORS.sky, { width: 1.6, label: "v5 backbone arrow" });
    }
  });

  addPanel(slide, template, pptx, { x: 0.82, y: 4.43, w: 5.9, h: 0.68 }, COLORS.mintSoft, COLORS.fact, 1.0, "v5 mission contract");
  addBodyText(slide, template, "MISSION CONTRACT", { x: 1.04, y: 4.53, w: 1.65, h: 0.22 }, { fontSize: 14.5, color: COLORS.fact, bold: true, align: "center" }, "v5 mission label");
  addBodyText(slide, template, "service pass · freshness · deadline\nenergy budget · window", { x: 2.88, y: 4.47, w: 3.56, h: 0.52 }, { fontSize: 15.5, color: COLORS.body, bold: true, align: "center", valign: "mid" }, "v5 mission values");
  addPanel(slide, template, pptx, { x: 6.92, y: 4.43, w: 5.9, h: 0.68 }, COLORS.violetSoft, COLORS.inference, 1.0, "v5 distinctions");
  addBodyText(slide, template, "不能互換", { x: 7.15, y: 4.57, w: 1.16, h: 0.22 }, { fontSize: 14.5, color: COLORS.inference, bold: true, align: "center" }, "v5 distinctions label");
  addBodyText(slide, template, "W ≠ J｜bit/s ≠ bit/J｜active time", { x: 8.48, y: 4.52, w: 4.08, h: 0.32 }, { fontSize: 16.5, color: COLORS.body, bold: true, align: "center" }, "v5 distinctions values");
  addBodyText(slide, template, "模擬教學資料、非即時、非量測、尚未通過 canonical parity 驗證。", { x: 0.92, y: 5.27, w: 11.8, h: 0.28 }, { fontSize: 14.5, color: COLORS.unknown, bold: true, align: "center" }, "v5 claim ceiling");
  addClaimDockV5(pptx, slide, template, {
    fact: "EE＝delivered bits／consumed J",
    inference: "9頁；120分鐘為設計估計",
    unknown: "browser／classroom／parity 未驗證",
  });
  return slide;
}

function addClaimsSlideV5(pptx, template, stage) {
  const slide = pptx.addSlide({ masterName: template.masters.content });
  addStageTitle(pptx, slide, template, stage.title);
  addQuestionV5(pptx, slide, template, stage, "先判｜A／Q／R＋信心");

  const claims = [
    { y: 1.76, letter: "A", title: "平均 W 較低", note: "service_pass＋deadline", fill: COLORS.skySoft, color: COLORS.sky },
    { y: 2.64, letter: "B", title: "較快完成", note: "active time＋完成時刻", fill: COLORS.mintSoft, color: COLORS.mint },
    { y: 3.52, letter: "C", title: "bit/J 高但漏 deadline", note: "逾期＝服務不合格", fill: COLORS.coralSoft, color: COLORS.coral },
  ];
  claims.forEach((item) => {
    addPanel(slide, template, pptx, { x: 0.82, y: item.y, w: 3.42, h: 0.76 }, item.fill, item.color, 1.0, "v5 claim option");
    addBodyShape(slide, template, pptx.ShapeType.ellipse, { x: 1.05, y: item.y + 0.15, w: 0.45, h: 0.45 }, { fill: { color: item.fill }, line: { color: item.color, width: 1.2 } }, "v5 claim letter");
    addBodyText(slide, template, item.letter, { x: 1.05, y: item.y + 0.15, w: 0.45, h: 0.45 }, { fontSize: 17, color: item.color, bold: true, align: "center" }, "v5 claim letter text");
    addBodyText(slide, template, item.title, { x: 1.62, y: item.y + 0.08, w: 2.42, h: 0.3 }, { fontSize: 17, color: COLORS.body, bold: true }, "v5 claim title");
    addBodyText(slide, template, item.note, { x: 1.62, y: item.y + 0.41, w: 2.42, h: 0.25 }, { fontSize: 14.2, color: item.color, bold: true }, "v5 claim condition");
  });

  addArrowV3(pptx, slide, template, 4.27, 3.03, 0.24, 0, COLORS.sky, { width: 1.8, label: "v5 claim contract arrow" });
  addPanel(slide, template, pptx, { x: 4.54, y: 1.76, w: 3.48, h: 2.52 }, COLORS.blueSoft, COLORS.blueGray, 1.1, "v5 mission contract hub");
  addBodyText(slide, template, "先固定可比邊界", { x: 4.84, y: 1.99, w: 2.88, h: 0.34 }, { fontSize: 20, color: COLORS.ink, bold: true, align: "center" }, "v5 contract title");
  ["工作量／payload", "deadline／service_pass", "idle／wakeup", "單位／時間窗"].forEach((text, index) => {
    addBodyText(slide, template, text, { x: 4.88, y: 2.48 + index * 0.34, w: 2.8, h: 0.27 }, { fontSize: 15.5, color: COLORS.blueGray, bold: true, align: "center" }, "v5 contract condition");
  });
  addLightLabelV5(pptx, slide, template, "條件相同？", { x: 5.32, y: 3.89, w: 1.92, h: 0.34 }, COLORS.mintSoft, COLORS.fact, { fontSize: 16, label: "v5 comparable gate" });

  addArrowV3(pptx, slide, template, 8.05, 3.03, 0.24, 0, COLORS.sky, { width: 1.8, label: "v5 verdict arrow" });
  addPanel(slide, template, pptx, { x: 8.32, y: 1.76, w: 4.5, h: 2.52 }, COLORS.coralSoft, COLORS.coral, 1.1, "v5 verdict board");
  addBodyText(slide, template, "揭露 → 判決", { x: 8.68, y: 1.99, w: 3.78, h: 0.34 }, { fontSize: 19, color: COLORS.coral, bold: true, align: "center" }, "v5 verdict title");
  addBodyText(slide, template, "○ A　○ Q　○ R", { x: 8.68, y: 2.51, w: 3.78, h: 0.4 }, { fontSize: 23, color: COLORS.ink, bold: true, align: "center" }, "v5 verdict choices");
  addBodyText(slide, template, "信心：低／中／高", { x: 8.68, y: 2.96, w: 3.78, h: 0.3 }, { fontSize: 16.5, color: COLORS.muted, bold: true, align: "center" }, "v5 verdict confidence");
  addFlowLine(slide, template, pptx, 8.75, 3.38, 3.64, 0, COLORS.ceilingLine, 0.9, "v5 verdict divider");
  addBodyText(slide, template, "揭露：J／時間／service", { x: 8.68, y: 3.5, w: 3.78, h: 0.3 }, { fontSize: 17, color: COLORS.body, bold: true, align: "center" }, "v5 verdict reveal");
  addBodyText(slide, template, "只允許改判 1 次", { x: 8.68, y: 3.88, w: 3.78, h: 0.3 }, { fontSize: 18, color: COLORS.coral, bold: true, align: "center" }, "v5 verdict revision");

  addOutcomeBandV5(pptx, slide, template, stage, "初判 → 鎖定條件 → 揭露 → 改判一次", "先固定服務邊界｜卡住時給單位／邊界提示", 4.78);
  addClaimDockV5(pptx, slide, template, {
    fact: "W≠J；bit/s≠bit/J",
    inference: "3–4頁＋1活動（設計估計）",
    unknown: "cards／stakes／novice timing 未驗證",
  });
  return slide;
}

function addTleSlideV5(pptx, template, stage) {
  const slide = pptx.addSlide({ masterName: template.masters.content });
  addStageTitle(pptx, slide, template, stage.title);
  addQuestionV5(pptx, slide, template, stage, "先分類｜來源／模型／假設");
  const nodes = [
    { x: 0.82, w: 3.56, tag: "SOURCE", title: "pinned TLE", body: "epoch／identity", fill: COLORS.skySoft, color: COLORS.sky },
    { x: 4.86, w: 3.56, tag: "MODEL-DERIVED", title: "NTPU service window", body: "可服務的時間區間", fill: COLORS.mintSoft, color: COLORS.mint },
    { x: 8.9, w: 3.92, tag: "COURSE ASSUMPTION", title: "traffic／power", body: "freshness／deadline", fill: COLORS.violetSoft, color: COLORS.violet },
  ];
  nodes.forEach((node, index) => {
    addPanel(slide, template, pptx, { x: node.x, y: 1.76, w: node.w, h: 1.28 }, node.fill, node.color, 1.05, "v5 lineage node");
    addBodyText(slide, template, node.tag, { x: node.x + 0.2, y: 1.9, w: node.w - 0.4, h: 0.22 }, { fontSize: 14.2, color: node.color, bold: true, align: "center" }, "v5 lineage tag");
    addBodyText(slide, template, node.title, { x: node.x + 0.2, y: 2.24, w: node.w - 0.4, h: 0.32 }, { fontSize: 19, color: COLORS.body, bold: true, align: "center" }, "v5 lineage title");
    addBodyText(slide, template, node.body, { x: node.x + 0.2, y: 2.66, w: node.w - 0.4, h: 0.25 }, { fontSize: 15.5, color: node.color, bold: true, align: "center" }, "v5 lineage body");
    if (index < nodes.length - 1) {
      addArrowV3(pptx, slide, template, node.x + node.w + 0.04, 2.4, 0.36, 0, COLORS.sky, { width: 1.7, label: "v5 lineage arrow" });
    }
  });
  addBodyText(slide, template, "same versioned scenario_id｜本頁只建立資料身分與行動合法性，不比較能源策略", { x: 0.9, y: 3.15, w: 11.84, h: 0.3 }, { fontSize: 16, color: stage.accent, bold: true, align: "center" }, "v5 TLE distinction");
  addBodyShape(slide, template, pptx.ShapeType.rect, { x: 0.82, y: 3.58, w: 2.48, h: 0.68 }, { fill: { color: COLORS.quiet }, line: { color: COLORS.blueGray, width: 0.9 } }, "v5 outside left");
  addBodyShape(slide, template, pptx.ShapeType.rect, { x: 3.3, y: 3.58, w: 5.62, h: 0.68 }, { fill: { color: COLORS.mintSoft }, line: { color: COLORS.mint, width: 1.2 } }, "v5 legal window");
  addBodyShape(slide, template, pptx.ShapeType.rect, { x: 8.92, y: 3.58, w: 3.9, h: 0.68 }, { fill: { color: COLORS.quiet }, line: { color: COLORS.blueGray, width: 0.9 } }, "v5 outside right");
  addBodyText(slide, template, "OUTSIDE", { x: 1.02, y: 3.78, w: 2.08, h: 0.26 }, { fontSize: 16, color: COLORS.muted, bold: true, align: "center" }, "v5 outside label left");
  addBodyText(slide, template, "LEGAL WINDOW｜send／wait", { x: 3.55, y: 3.75, w: 5.12, h: 0.3 }, { fontSize: 18, color: COLORS.fact, bold: true, align: "center" }, "v5 legal window label");
  addBodyText(slide, template, "OUTSIDE", { x: 9.14, y: 3.78, w: 3.46, h: 0.26 }, { fontSize: 16, color: COLORS.muted, bold: true, align: "center" }, "v5 outside label right");
  addOutcomeBandV5(pptx, slide, template, stage, "排序 lineage → 確認 scenario_id＋合法窗口", "window 限制下一步行動｜resume／fallback", 4.69);
  addClaimDockV5(pptx, slide, template, {
    fact: "TLE 不含 power／traffic／energy",
    inference: "3–4頁＋1資料排序（設計估計）",
    unknown: "scenario seam／fallback 未驗證",
  });
  return slide;
}

function addLabASlideV5(pptx, template, stage) {
  const slide = pptx.addSlide({ masterName: template.masters.content });
  addStageTitle(pptx, slide, template, stage.title);
  addQuestionV5(pptx, slide, template, stage, "先選｜slow／balanced／fast");
  addBodyText(slide, template, "固定比較｜同工作量・同 deadline・同系統邊界　　設計估計｜5 reference → 11 operation → 5 debrief → 2 transition", { x: 0.82, y: 1.62, w: 12.0, h: 0.3 }, { fontSize: 14.2, color: stage.accent, bold: true, align: "center" }, "v5 Lab A metadata");

  addPanel(slide, template, pptx, { x: 0.82, y: 2.02, w: 3.3, h: 2.57 }, COLORS.violetSoft, COLORS.violet, 1.05, "v5 Lab A strategies");
  addBodyText(slide, template, "選一種節奏", { x: 1.08, y: 2.2, w: 2.78, h: 0.3 }, { fontSize: 19, color: COLORS.violet, bold: true, align: "center" }, "v5 Lab A strategy heading");
  const strategies = [
    { y: 2.67, title: "慢速", detail: "低 W・長", fill: COLORS.mintSoft, color: COLORS.mint },
    { y: 3.28, title: "平衡", detail: "中 W・中", fill: COLORS.blueSoft, color: COLORS.blueGray },
    { y: 3.89, title: "高速後休眠", detail: "高 W・短", fill: COLORS.violetSoft, color: COLORS.violet },
  ];
  strategies.forEach((item) => {
    addPanel(slide, template, pptx, { x: 1.08, y: item.y, w: 2.78, h: 0.48 }, item.fill, item.color, 0.9, "v5 Lab A strategy");
    addBodyText(slide, template, item.title, { x: 1.19, y: item.y + 0.09, w: 1.24, h: 0.26 }, { fontSize: 16.5, color: item.color, bold: true, align: "center" }, "v5 Lab A strategy title");
    addBodyText(slide, template, item.detail, { x: 2.47, y: item.y + 0.08, w: 1.24, h: 0.28 }, { fontSize: 16, color: COLORS.body, bold: true, align: "center" }, "v5 Lab A strategy detail");
  });

  addArrowV3(pptx, slide, template, 4.15, 3.29, 0.24, 0, COLORS.violet, { width: 1.8, label: "v5 Lab A causal arrow" });
  addPanel(slide, template, pptx, { x: 4.42, y: 2.02, w: 4.04, h: 2.57 }, COLORS.blueSoft, COLORS.blueGray, 1.05, "v5 Lab A causal hub");
  addBodyText(slide, template, "同一份工作", { x: 4.75, y: 2.23, w: 3.38, h: 0.32 }, { fontSize: 19, color: COLORS.blueGray, bold: true, align: "center" }, "v5 Lab A fixed job");
  addBodyText(slide, template, "同工作量・同 deadline\n同一系統邊界", { x: 4.75, y: 2.66, w: 3.38, h: 0.65 }, { fontSize: 16, color: COLORS.body, bold: true, align: "center", valign: "mid" }, "v5 Lab A fixed boundary");
  addBodyText(slide, template, "W × active time", { x: 4.76, y: 3.42, w: 3.36, h: 0.38 }, { fontSize: 23, color: COLORS.ink, bold: true, align: "center" }, "v5 Lab A power time");
  addBodyText(slide, template, "→ consumed J", { x: 4.76, y: 3.85, w: 3.36, h: 0.34 }, { fontSize: 20, color: COLORS.violet, bold: true, align: "center" }, "v5 Lab A consumed energy");
  addLightLabelV5(pptx, slide, template, "SERVICE PASS", { x: 5.47, y: 4.25, w: 1.95, h: 0.34 }, COLORS.mintSoft, COLORS.fact, { fontSize: 15, label: "v5 Lab A service gate" });

  addArrowV3(pptx, slide, template, 8.49, 3.29, 0.24, 0, COLORS.violet, { width: 1.8, label: "v5 Lab A ledger arrow" });
  addPanel(slide, template, pptx, { x: 8.76, y: 2.02, w: 4.06, h: 2.57 }, COLORS.sand, COLORS.gold, 1.05, "v5 Lab A ledger");
  addBodyText(slide, template, "hidden replay → 自動 ledger", { x: 9.02, y: 2.23, w: 3.54, h: 0.34 }, { fontSize: 18, color: COLORS.body, bold: true, align: "center" }, "v5 Lab A ledger title");
  const ledger = [["SERVICE", "service_pass"], ["J", "consumed J"], ["EE", "bit/J"], ["TIME", "完成時刻"]];
  ledger.forEach((item, index) => {
    const y = 2.77 + index * 0.4;
    addBodyText(slide, template, item[0], { x: 9.08, y, w: 1.02, h: 0.28 }, { fontSize: 14.5, color: COLORS.gold, bold: true, align: "center" }, "v5 Lab A ledger label");
    addBodyText(slide, template, item[1], { x: 10.27, y, w: 2.15, h: 0.28 }, { fontSize: 16, color: COLORS.body, bold: true }, "v5 Lab A ledger value");
  });
  addOutcomeBandV5(pptx, slide, template, stage, "選策略 → hidden replay → 比較同一 ledger", "排序可能翻轉｜同 scenario 反例重設", 4.82);
  addClaimDockV5(pptx, slide, template, {
    fact: "W、J、bit/s、bit/J 分欄",
    inference: "5–6頁＋1 lab（設計估計）",
    unknown: "state change／反例未驗證",
  });
  return slide;
}

function addLabBSlideV5(pptx, template, stage) {
  const slide = pptx.addSlide({ masterName: template.masters.content });
  addStageTitle(pptx, slide, template, stage.title);
  addQuestionV5(pptx, slide, template, stage, "先決定｜現在切換／等待／維持");
  const panels = [
    { x: 0.82, w: 3.34, fill: COLORS.skySoft, color: COLORS.sky, title: "1｜看目前狀態" },
    { x: 4.5, w: 3.34, fill: COLORS.violetSoft, color: COLORS.violet, title: "2｜鎖定規則" },
    { x: 8.18, w: 4.64, fill: COLORS.coralSoft, color: COLORS.coral, title: "3｜面對未知未來" },
  ];
  panels.forEach((item) => {
    addPanel(slide, template, pptx, { x: item.x, y: 1.78, w: item.w, h: 2.82 }, item.fill, item.color, 1.05, "v5 Lab B panel");
    addBodyText(slide, template, item.title, { x: item.x + 0.24, y: 2.02, w: item.w - 0.48, h: 0.34 }, { fontSize: 19, color: item.color, bold: true, align: "center" }, "v5 Lab B panel title");
  });
  ["現在切換", "等待穩定", "維持目前"].forEach((text, index) => {
    addPanel(slide, template, pptx, { x: 1.12, y: 2.58 + index * 0.57, w: 2.74, h: 0.43 }, COLORS.white, COLORS.sky, 0.85, "v5 Lab B choice");
    addBodyText(slide, template, text, { x: 1.28, y: 2.66 + index * 0.57, w: 2.42, h: 0.25 }, { fontSize: 16.5, color: COLORS.body, bold: true, align: "center" }, "v5 Lab B choice text");
  });
  addBodyText(slide, template, "Trace A", { x: 4.78, y: 2.6, w: 2.78, h: 0.32 }, { fontSize: 19, color: COLORS.body, bold: true, align: "center" }, "v5 Lab B Trace A");
  addBodyText(slide, template, "選一次 → freeze", { x: 4.78, y: 3.06, w: 2.78, h: 0.34 }, { fontSize: 18, color: COLORS.violet, bold: true, align: "center" }, "v5 Lab B freeze");
  addLightLabelV5(pptx, slide, template, "NO RETUNE", { x: 5.29, y: 3.63, w: 1.76, h: 0.4 }, COLORS.coralSoft, COLORS.coral, { fontSize: 16, label: "v5 Lab B no retune" });
  addBodyText(slide, template, "同一規則，不因結果不好重調", { x: 4.78, y: 4.15, w: 2.78, h: 0.3 }, { fontSize: 15, color: COLORS.muted, bold: true, align: "center" }, "v5 Lab B no retune note");
  addBodyText(slide, template, "Trace B｜withheld", { x: 8.53, y: 2.59, w: 3.94, h: 0.34 }, { fontSize: 20, color: COLORS.body, bold: true, align: "center" }, "v5 Lab B Trace B");
  addBodyText(slide, template, "看見未公開的變化後\n仍用剛才的 rule replay", { x: 8.62, y: 3.03, w: 3.76, h: 0.75 }, { fontSize: 17, color: COLORS.coral, bold: true, align: "center", valign: "mid" }, "v5 Lab B replay");
  addLightLabelV5(pptx, slide, template, "EVIDENCE｜state · service · J", { x: 8.85, y: 3.98, w: 3.3, h: 0.42 }, COLORS.mintSoft, COLORS.fact, { fontSize: 16, label: "v5 Lab B evidence" });
  addArrowV3(pptx, slide, template, 4.18, 3.17, 0.28, 0, COLORS.sky, { width: 1.8, label: "v5 Lab B arrow 1" });
  addArrowV3(pptx, slide, template, 7.86, 3.17, 0.28, 0, COLORS.violet, { width: 1.8, label: "v5 Lab B arrow 2" });
  addOutcomeBandV5(pptx, slide, template, stage, "看狀態 → 選規則 → freeze → Trace B replay", "choice 改變 active time／service／J｜rewind", 4.84);
  addClaimDockV5(pptx, slide, template, {
    fact: "switch count 不是能耗項",
    inference: "5–6頁＋1 lab（設計估計）",
    unknown: "rule branch／withheld fairness 未驗證",
  });
  return slide;
}

function addRecoverySlideV5(pptx, template, stage) {
  const slide = pptx.addSlide({ masterName: template.masters.content });
  addStageTitle(pptx, slide, template, stage.title);
  addQuestionV5(pptx, slide, template, stage, "閉卷決定｜缺哪一節就補哪一節");
  const nodes = [
    { x: 0.82, w: 2.25, title: "SAVE", body: "Workbook", fill: COLORS.blueSoft, color: COLORS.blueGray },
    { x: 3.45, w: 2.78, title: "STATE＋ACTION", body: "當時狀態＋動作", fill: COLORS.skySoft, color: COLORS.sky },
    { x: 6.61, w: 2.25, title: "PATH", body: "系統路徑", fill: COLORS.mintSoft, color: COLORS.mint },
    { x: 9.24, w: 3.58, title: "SERVICE／J", body: "服務結果＋累積能量", fill: COLORS.violetSoft, color: COLORS.violet },
  ];
  nodes.forEach((node, index) => {
    addPanel(slide, template, pptx, { x: node.x, y: 1.78, w: node.w, h: 1.18 }, node.fill, node.color, 1.0, "v5 recovery node");
    addBodyText(slide, template, node.title, { x: node.x + 0.18, y: 2.0, w: node.w - 0.36, h: 0.3 }, { fontSize: 17.5, color: node.color, bold: true, align: "center" }, "v5 recovery node title");
    addBodyText(slide, template, node.body, { x: node.x + 0.18, y: 2.43, w: node.w - 0.36, h: 0.28 }, { fontSize: 15.5, color: COLORS.body, bold: true, align: "center" }, "v5 recovery node body");
    if (index < nodes.length - 1) {
      addArrowV3(pptx, slide, template, node.x + node.w + 0.04, 2.37, 0.3, 0, COLORS.sky, { width: 1.6, label: "v5 recovery arrow" });
    }
  });
  addBodyText(slide, template, "CHECK｜閉卷重建一條『狀態 → 動作 → 路徑 → service／J』因果句", { x: 0.9, y: 3.18, w: 11.84, h: 0.34 }, { fontSize: 18, color: COLORS.ink, bold: true, align: "center" }, "v5 recovery checkpoint");
  addPanel(slide, template, pptx, { x: 0.82, y: 3.62, w: 5.68, h: 0.98 }, COLORS.blueSoft, COLORS.blueGray, 1.0, "v5 recovery help");
  addBodyText(slide, template, "需要協助", { x: 1.12, y: 3.81, w: 1.42, h: 0.3 }, { fontSize: 18, color: COLORS.blueGray, bold: true, align: "center" }, "v5 recovery help title");
  addBodyText(slide, template, "hint → reset → resume", { x: 2.78, y: 3.78, w: 3.35, h: 0.34 }, { fontSize: 18, color: COLORS.body, bold: true, align: "center" }, "v5 recovery help path");
  addPanel(slide, template, pptx, { x: 6.84, y: 3.62, w: 5.98, h: 0.98 }, COLORS.mintSoft, COLORS.mint, 1.0, "v5 recovery ready");
  addBodyText(slide, template, "已能重建", { x: 7.14, y: 3.81, w: 1.42, h: 0.3 }, { fontSize: 18, color: COLORS.mint, bold: true, align: "center" }, "v5 recovery ready title");
  addBodyText(slide, template, "用 boundary 反例測試因果句", { x: 8.79, y: 3.76, w: 3.65, h: 0.4 }, { fontSize: 17, color: COLORS.body, bold: true, align: "center" }, "v5 recovery ready path");
  addOutcomeBandV5(pptx, slide, template, stage, "保存 → 閉卷重建｜留下狀態＋因果句", "證據不中斷｜提示或延伸反例", 4.84);
  addClaimDockV5(pptx, slide, template, {
    fact: "同一 Workbook 可重開",
    inference: "1–2頁＋1 checkpoint（設計估計）",
    unknown: "20-seat resume 未驗證",
  });
  return slide;
}

function addLabCSlideV5(pptx, template, stage) {
  const slide = pptx.addSlide({ masterName: template.masters.content });
  addStageTitle(pptx, slide, template, stage.title);
  addQuestionV5(pptx, slide, template, stage, "先排｜baseline → revise → freeze");
  const columns = [
    { x: 0.82, w: 3.35, fill: COLORS.coralSoft, color: COLORS.coral, title: "1｜三張任務卡" },
    { x: 4.48, w: 4.45, fill: COLORS.blueSoft, color: COLORS.blueGray, title: "2｜六格 schedule" },
    { x: 9.24, w: 3.58, fill: COLORS.violetSoft, color: COLORS.violet, title: "3｜withheld replay" },
  ];
  columns.forEach((col) => {
    addPanel(slide, template, pptx, { x: col.x, y: 1.78, w: col.w, h: 2.82 }, col.fill, col.color, 1.05, "v5 Lab C column");
    addBodyText(slide, template, col.title, { x: col.x + 0.22, y: 2.01, w: col.w - 0.44, h: 0.34 }, { fontSize: 19, color: col.color, bold: true, align: "center" }, "v5 Lab C column title");
  });
  const tasks = [["緊急警報", "短 deadline", COLORS.coral], ["環境資料", "保持 fresh", COLORS.mint], ["大量資料", "可延後", COLORS.sky]];
  tasks.forEach((task, index) => {
    const y = 2.58 + index * 0.58;
    addPanel(slide, template, pptx, { x: 1.1, y, w: 2.8, h: 0.45 }, COLORS.white, task[2], 0.85, "v5 Lab C task");
    addBodyText(slide, template, task[0], { x: 1.24, y: y + 0.08, w: 1.28, h: 0.27 }, { fontSize: 16, color: COLORS.body, bold: true, align: "center" }, "v5 Lab C task title");
    addBodyText(slide, template, task[1], { x: 2.58, y: y + 0.08, w: 1.15, h: 0.27 }, { fontSize: 14.5, color: task[2], bold: true, align: "center" }, "v5 Lab C task constraint");
  });
  addBodyText(slide, template, "baseline → 選先送任務", { x: 1.08, y: 4.31, w: 2.84, h: 0.28 }, { fontSize: 15, color: COLORS.coral, bold: true, align: "center" }, "v5 Lab C baseline note");
  addBodyText(slide, template, "1–2 fixed｜3–6 learner action", { x: 4.81, y: 2.53, w: 3.79, h: 0.28 }, { fontSize: 15.5, color: COLORS.blueGray, bold: true, align: "center" }, "v5 Lab C slot rule");
  for (let i = 0; i < 6; i += 1) {
    const x = 4.84 + i * 0.6;
    const fill = i < 2 ? COLORS.violetSoft : COLORS.mintSoft;
    const color = i < 2 ? COLORS.violet : COLORS.mint;
    addBodyShape(slide, template, pptx.ShapeType.rect, { x, y: 3.03, w: 0.46, h: 0.62 }, { fill: { color: fill }, line: { color, width: 1.0 } }, "v5 Lab C slot");
    addBodyText(slide, template, String(i + 1), { x, y: 3.2, w: 0.46, h: 0.25 }, { fontSize: 16, color, bold: true, align: "center" }, "v5 Lab C slot number");
  }
  addBodyText(slide, template, "send · batch · wait · sleep", { x: 4.82, y: 3.84, w: 3.77, h: 0.3 }, { fontSize: 17, color: COLORS.body, bold: true, align: "center" }, "v5 Lab C actions");
  addLightLabelV5(pptx, slide, template, "revise → freeze", { x: 5.65, y: 4.22, w: 2.12, h: 0.34 }, COLORS.mintSoft, COLORS.fact, { fontSize: 16, label: "v5 Lab C freeze" });
  addBodyText(slide, template, "shorter window＋urgent", { x: 9.55, y: 2.59, w: 2.96, h: 0.32 }, { fontSize: 17, color: COLORS.body, bold: true, align: "center" }, "v5 Lab C withheld event");
  addBodyText(slide, template, "freeze 後 replay\n不重排剛才的策略", { x: 9.55, y: 3.03, w: 2.96, h: 0.67 }, { fontSize: 17, color: COLORS.violet, bold: true, align: "center", valign: "mid" }, "v5 Lab C withheld action");
  addLightLabelV5(pptx, slide, template, "SERVICE · FRESH · J", { x: 9.67, y: 3.94, w: 2.72, h: 0.43 }, COLORS.mintSoft, COLORS.fact, { fontSize: 15.5, label: "v5 Lab C evidence" });
  addArrowV3(pptx, slide, template, 4.2, 3.18, 0.24, 0, COLORS.mint, { width: 1.8, label: "v5 Lab C arrow 1" });
  addArrowV3(pptx, slide, template, 8.96, 3.18, 0.24, 0, COLORS.mint, { width: 1.8, label: "v5 Lab C arrow 2" });
  addOutcomeBandV5(pptx, slide, template, stage, "排程 → 執行 → 修正 → freeze｜比較三次 ledger", "service／freshness／J 分欄｜非法時槽自動補齊", 4.84);
  addClaimDockV5(pptx, slide, template, {
    fact: "service 與 freshness 分開",
    inference: "6–7頁＋1 lab（設計估計）",
    unknown: "schedule state／withheld 未驗證",
  });
  return slide;
}

function addClinicSlideV5(pptx, template, stage) {
  const slide = pptx.addSlide({ masterName: template.masters.content });
  addStageTitle(pptx, slide, template, stage.title);
  addQuestionV5(pptx, slide, template, stage, "先判斷｜當下真正可用的特徵");
  const phases = [
    { x: 0.82, w: 3.56, title: "AVAILABLE", body: "load(t−2) · quality(t−1)", fill: COLORS.mintSoft, color: COLORS.mint },
    { x: 4.86, w: 3.56, title: "CHECK", body: "看 timestamp 再決定", fill: COLORS.violetSoft, color: COLORS.violet },
    { x: 8.9, w: 3.92, title: "LEAKAGE｜t+1", body: "行動後結果不可偷看", fill: COLORS.coralSoft, color: COLORS.coral },
  ];
  phases.forEach((phase, index) => {
    addPanel(slide, template, pptx, { x: phase.x, y: 1.76, w: phase.w, h: 1.25 }, phase.fill, phase.color, 1.05, "v5 clinic phase");
    addBodyText(slide, template, phase.title, { x: phase.x + 0.22, y: 1.99, w: phase.w - 0.44, h: 0.3 }, { fontSize: 18, color: phase.color, bold: true, align: "center" }, "v5 clinic phase title");
    addBodyText(slide, template, phase.body, { x: phase.x + 0.22, y: 2.48, w: phase.w - 0.44, h: 0.3 }, { fontSize: 16.5, color: COLORS.body, bold: true, align: "center" }, "v5 clinic phase body");
    if (index < phases.length - 1) {
      addArrowV3(pptx, slide, template, phase.x + phase.w + 0.04, 2.38, 0.36, 0, COLORS.violet, { width: 1.7, label: "v5 clinic phase arrow" });
    }
  });
  const actions = [
    { x: 0.82, w: 2.6, text: "wait／send", fill: COLORS.mintSoft, color: COLORS.mint },
    { x: 3.65, w: 2.6, text: "freeze once", fill: COLORS.violetSoft, color: COLORS.violet },
    { x: 6.48, w: 2.8, text: "held-out replay", fill: COLORS.violetSoft, color: COLORS.violet },
    { x: 9.51, w: 3.31, text: "score ∥ service／J", fill: COLORS.mintSoft, color: COLORS.fact },
  ];
  actions.forEach((action, index) => {
    addPanel(slide, template, pptx, { x: action.x, y: 3.38, w: action.w, h: 0.66 }, action.fill, action.color, 0.95, "v5 clinic action");
    addBodyText(slide, template, action.text, { x: action.x + 0.15, y: 3.56, w: action.w - 0.3, h: 0.28 }, { fontSize: 16.5, color: action.color, bold: true, align: "center" }, "v5 clinic action text");
    if (index < actions.length - 1) {
      addArrowV3(pptx, slide, template, action.x + action.w + 0.04, 3.71, 0.16, 0, COLORS.sky, { width: 1.5, label: "v5 clinic action arrow" });
    }
  });
  addPanel(slide, template, pptx, { x: 3.65, y: 4.27, w: 5.63, h: 0.42 }, COLORS.sand, COLORS.gold, 1.0, "v5 clinic conclusion");
  addBodyText(slide, template, "prediction ≠ saving", { x: 3.9, y: 4.34, w: 5.13, h: 0.28 }, { fontSize: 21, color: COLORS.ink, bold: true, align: "center" }, "v5 clinic conclusion text");
  addOutcomeBandV5(pptx, slide, template, stage, "timestamp → freeze → replay｜score 與 service／J 並列", "預測不等於節能｜提示／誠實 fallback", 4.83);
  addClaimDockV5(pptx, slide, template, {
    fact: "模型分數不是能耗公式項",
    inference: "4–5頁＋1 coherent case（設計估計）",
    unknown: "timestamp／held-out action 未驗證",
  });
  return slide;
}

function addTransferSlideV5(pptx, template, stage) {
  const slide = pptx.addSlide({ masterName: template.masters.content });
  addStageTitle(pptx, slide, template, stage.title);
  addQuestionV5(pptx, slide, template, stage, "決定｜new domain → falsifier");
  addPanel(slide, template, pptx, { x: 0.82, y: 1.78, w: 3.2, h: 2.86 }, COLORS.violetSoft, COLORS.violet, 1.05, "v5 transfer mechanisms");
  addBodyText(slide, template, "帶走的機制", { x: 1.08, y: 2.02, w: 2.68, h: 0.34 }, { fontSize: 20, color: COLORS.violet, bold: true, align: "center" }, "v5 transfer mechanism title");
  ["Lab A｜pace", "Lab B｜policy", "Lab C｜schedule", "clinic｜claim"].forEach((text, index) => {
    addPanel(slide, template, pptx, { x: 1.14, y: 2.55 + index * 0.47, w: 2.56, h: 0.36 }, COLORS.white, COLORS.violet, 0.8, "v5 transfer token");
    addBodyText(slide, template, text, { x: 1.25, y: 2.62 + index * 0.47, w: 2.34, h: 0.22 }, { fontSize: 15.5, color: COLORS.body, bold: true, align: "center" }, "v5 transfer token text");
  });
  addArrowV3(pptx, slide, template, 4.05, 3.2, 0.3, 0, COLORS.sky, { width: 1.8, label: "v5 transfer arrow 1" });
  addPanel(slide, template, pptx, { x: 4.38, y: 1.78, w: 3.0, h: 2.86 }, COLORS.skySoft, COLORS.sky, 1.05, "v5 unseen domain");
  addBodyText(slide, template, "UNSEEN DOMAIN", { x: 4.65, y: 2.04, w: 2.46, h: 0.28 }, { fontSize: 15, color: COLORS.sky, bold: true, align: "center" }, "v5 unseen domain label");
  addBodyText(slide, template, "SMART FARM", { x: 4.64, y: 2.54, w: 2.48, h: 0.38 }, { fontSize: 22, color: COLORS.body, bold: true, align: "center" }, "v5 unseen domain title");
  addBodyText(slide, template, "moisture → irrigation", { x: 4.64, y: 3.15, w: 2.48, h: 0.32 }, { fontSize: 17, color: COLORS.sky, bold: true, align: "center" }, "v5 unseen domain mapping");
  addBodyText(slide, template, "不搬衛星數值\n只搬因果與取捨", { x: 4.68, y: 3.65, w: 2.4, h: 0.62 }, { fontSize: 17, color: COLORS.body, bold: true, align: "center", valign: "mid" }, "v5 transfer boundary");
  addArrowV3(pptx, slide, template, 7.41, 3.2, 0.3, 0, COLORS.sky, { width: 1.8, label: "v5 transfer arrow 2" });
  addPanel(slide, template, pptx, { x: 7.74, y: 1.78, w: 5.08, h: 2.86 }, COLORS.mintSoft, COLORS.mint, 1.05, "v5 transfer causal chain");
  addBodyText(slide, template, "可被推翻的控制鏈", { x: 8.04, y: 2.02, w: 4.48, h: 0.34 }, { fontSize: 20, color: COLORS.mint, bold: true, align: "center" }, "v5 transfer chain title");
  const chain = ["data／time → control", "service → P×time → J", "measurement → falsifier"];
  chain.forEach((text, index) => {
    const y = 2.58 + index * 0.6;
    addPanel(slide, template, pptx, { x: 8.16, y, w: 4.24, h: 0.46 }, COLORS.white, index === 2 ? COLORS.coral : COLORS.mint, 0.85, "v5 transfer chain step");
    addBodyText(slide, template, text, { x: 8.32, y: y + 0.09, w: 3.92, h: 0.28 }, { fontSize: 17, color: index === 2 ? COLORS.coral : COLORS.body, bold: true, align: "center" }, "v5 transfer chain text");
  });
  addOutcomeBandV5(pptx, slide, template, stage, "映射 → hypothesis＋falsifier → what-if → export", "prediction → control → J｜hint／system what-if", 4.84);
  addClaimDockV5(pptx, slide, template, {
    fact: "分析／預測後才形成節能控制",
    inference: "4–5頁＋1 transfer（設計估計）",
    unknown: "causal transfer／novice timing 未驗證",
  });
  return slide;
}

function addOverviewSlide(pptx, template, stage) {
  const builders = {
    claims: addClaimsSlideV5,
    tle: addTleSlideV5,
    labA: addLabASlideV5,
    labB: addLabBSlideV5,
    recovery: addRecoverySlideV5,
    labC: addLabCSlideV5,
    clinic: addClinicSlideV5,
    transfer: addTransferSlideV5,
  };
  const builder = builders[stage.kind];
  if (!builder) {
    throw new Error(`unknown C-120 stage kind: ${stage.kind}`);
  }
  return builder(pptx, template, stage);
}

function addCourseOutlineSlide(pptx, template) {
  const slide = pptx.addSlide({ masterName: template.masters.content });
  addTitle(slide, template, "C-120 LEO 能源決策課程｜Phase 0 完整課程大綱");

  addBodyText(slide, template, "10 + 8 + 23 + 23 + 5 + 23 + 14 + 14 = 120", { x: 0.86, y: 1.06, w: 11.98, h: 0.48 }, { fontSize: 32, bold: true, color: COLORS.ink, align: "center" }, "cadence equation");
  addBodyText(slide, template, "energy-first → LEO-as-index → 同一份 Energy Decision Workbook", { x: 0.98, y: 1.57, w: 11.74, h: 0.38 }, { fontSize: 22, bold: true, color: COLORS.fact, align: "center" }, "course mainline");

  const routeXs = [0.82, 3.86, 6.9, 9.94];
  const routeYs = [2.12, 2.98];
  const routeLabels = ["主張判讀", "TLE 資料錨點", "Lab A｜同工異速", "Lab B｜先行或等", "回復與重整", "Lab C｜分配焦耳", "證據檢核", "競賽轉移／離場"];
  STAGES.forEach((stage, index) => {
    const row = index < 4 ? 0 : 1;
    const col = index % 4;
    const x = routeXs[col];
    const y = routeYs[row];
    const minutes = [10, 8, 23, 23, 5, 23, 14, 14][index];
    addPanel(slide, template, pptx, { x, y, w: 2.76, h: 0.68 }, stage.pale, stage.accent, 1.0, `outline route ${index + 1}`);
    addBodyText(slide, template, `${minutes} min`, { x: x + 0.12, y: y + 0.08, w: 0.8, h: 0.25 }, { fontSize: 16, color: stage.accent, bold: true, align: "center" }, `outline route minutes ${index + 1}`);
    addBodyText(slide, template, routeLabels[index], { x: x + 0.92, y: y + 0.08, w: 1.72, h: 0.46 }, { fontSize: 15.2, color: stage.accent, bold: true, align: "center" }, `outline route label ${index + 1}`);
  });

  addPanel(slide, template, pptx, { x: 0.82, y: 3.88, w: 5.8, h: 0.9 }, "F0F7F5", COLORS.fact, 1.0, "outline mission contract");
  addBodyText(slide, template, "MISSION CONTRACT", { x: 1.04, y: 4.0, w: 5.36, h: 0.23 }, { fontSize: 14, color: COLORS.fact, bold: true, align: "center" }, "outline mission contract label");
  addBodyText(slide, template, "service pass · freshness · deadline · energy budget · window", { x: 1.04, y: 4.3, w: 5.36, h: 0.3 }, { fontSize: 15.2, color: COLORS.fact, bold: true, align: "center" }, "outline mission contract values");
  addPanel(slide, template, pptx, { x: 6.84, y: 3.88, w: 5.98, h: 0.9 }, "F4F1F8", COLORS.inference, 1.0, "outline measurement distinctions");
  addBodyText(slide, template, "不同量，不能互相代換", { x: 7.06, y: 4.0, w: 5.54, h: 0.23 }, { fontSize: 14, color: COLORS.inference, bold: true, align: "center" }, "outline measurement distinctions label");
  addBodyText(slide, template, "W ≠ J　｜　bit/s ≠ bit/J　｜　active time", { x: 7.06, y: 4.3, w: 5.54, h: 0.3 }, { fontSize: 16.5, color: COLORS.inference, bold: true, align: "center" }, "outline measurement distinctions values");
  addBodyText(slide, template, "模擬教學資料、非即時、非量測、尚未通過 canonical parity 驗證。", { x: 0.98, y: 5.02, w: 11.68, h: 0.32 }, { fontSize: 16, color: COLORS.unknown, bold: true, align: "center" }, "outline claim ceiling");
  addBodyText(slide, template, "Phase 0｜9 頁 checkpoint；各階段頁數與 120 分鐘節奏皆為設計估計", { x: 0.98, y: 5.42, w: 11.68, h: 0.24 }, { fontSize: 14.2, color: COLORS.muted, bold: true, align: "center" }, "outline checkpoint status");
  addCompactClaimFooter(pptx, slide, template, "EE＝delivered bits／consumed J", "設計估計：9 頁；120 分鐘未經課堂驗證", "browser pixels／classroom／parity 未驗證", "F4ECEE");
  return slide;
}

async function repairPresentationElementOrder(filePath) {
  const archive = await JSZip.loadAsync(await fs.readFile(filePath));

  const layoutPaths = Object.keys(archive.files).filter((name) =>
    /^ppt\/slideLayouts\/slideLayout\d+\.xml$/.test(name),
  );
  let removedEditablePlaceholders = 0;
  let slideNumberPlaceholdersBefore = 0;
  let slideNumberPlaceholdersAfter = 0;
  for (const layoutPath of layoutPaths) {
    const layoutEntry = archive.file(layoutPath);
    if (!layoutEntry) {
      throw new Error(`generated PPTX is missing ${layoutPath}`);
    }
    const layoutXml = await layoutEntry.async("string");
    slideNumberPlaceholdersBefore += (
      layoutXml.match(/<p:ph\b[^>]*\btype="sldNum"[^>]*\/>/g) ?? []
    ).length;
    const withoutEditablePlaceholders = layoutXml.replace(
      /<p:sp>[\s\S]*?<\/p:sp>/g,
      (shapeXml) => {
        if (!/<p:ph\b[^>]*\btype="(?:title|body)"[^>]*\/>/.test(shapeXml)) {
          return shapeXml;
        }
        removedEditablePlaceholders += 1;
        return "";
      },
    );
    if (/<p:ph\b[^>]*\btype="(?:title|body)"[^>]*\/>/.test(withoutEditablePlaceholders)) {
      throw new Error(`editable title/body placeholder survived in ${layoutPath}`);
    }
    slideNumberPlaceholdersAfter += (
      withoutEditablePlaceholders.match(/<p:ph\b[^>]*\btype="sldNum"[^>]*\/>/g) ?? []
    ).length;
    archive.file(layoutPath, withoutEditablePlaceholders);
  }
  if (removedEditablePlaceholders !== 4) {
    throw new Error(
      `expected to remove 4 title/body layout placeholders, removed ${removedEditablePlaceholders}`,
    );
  }
  if (
    slideNumberPlaceholdersBefore < 1 ||
    slideNumberPlaceholdersAfter !== slideNumberPlaceholdersBefore
  ) {
    throw new Error("slide-number placeholders were not preserved while cleaning layouts");
  }

  const slidePaths = Object.keys(archive.files).filter((name) =>
    /^ppt\/slides\/slide\d+\.xml$/.test(name),
  );
  let removedSlideEditablePlaceholders = 0;
  let slideOwnedNumbersBefore = 0;
  let slideOwnedNumbersAfter = 0;
  for (const slidePath of slidePaths) {
    const slideEntry = archive.file(slidePath);
    if (!slideEntry) {
      throw new Error(`generated PPTX is missing ${slidePath}`);
    }
    const slideXml = await slideEntry.async("string");
    slideOwnedNumbersBefore += (
      slideXml.match(/<p:ph\b[^>]*\btype="sldNum"[^>]*\/>/g) ?? []
    ).length;
    const withoutEditablePlaceholders = slideXml.replace(
      /<p:sp>[\s\S]*?<\/p:sp>/g,
      (shapeXml) => {
        if (!/<p:ph\b[^>]*\btype="(?:title|body)"[^>]*\/>/.test(shapeXml)) {
          return shapeXml;
        }
        removedSlideEditablePlaceholders += 1;
        return "";
      },
    );
    if (/<p:ph\b[^>]*\btype="(?:title|body)"[^>]*\/>/.test(withoutEditablePlaceholders)) {
      throw new Error(`editable title/body placeholder survived in ${slidePath}`);
    }
    slideOwnedNumbersAfter += (
      withoutEditablePlaceholders.match(/<p:ph\b[^>]*\btype="sldNum"[^>]*\/>/g) ?? []
    ).length;
    archive.file(slidePath, withoutEditablePlaceholders);
  }
  if (removedSlideEditablePlaceholders !== 18) {
    throw new Error(
      `expected to remove 18 slide-owned title/body placeholders, removed ${removedSlideEditablePlaceholders}`,
    );
  }
  if (
    slideOwnedNumbersBefore !== 9 ||
    slideOwnedNumbersAfter !== slideOwnedNumbersBefore
  ) {
    throw new Error("slide-owned page-number fields were not preserved");
  }

  const entry = archive.file("ppt/presentation.xml");
  if (!entry) {
    throw new Error("generated PPTX is missing ppt/presentation.xml");
  }
  const original = await entry.async("string");
  const notesMatch = original.match(
    /<p:notesMasterIdLst>[\s\S]*?<\/p:notesMasterIdLst>/,
  );
  if (!notesMatch) {
    throw new Error("generated PPTX is missing notesMasterIdLst");
  }
  const notesBlock = notesMatch[0];
  const withoutNotes = original.replace(notesBlock, "");
  const anchor = "</p:sldMasterIdLst>";
  if (!withoutNotes.includes(anchor)) {
    throw new Error("generated PPTX is missing sldMasterIdLst");
  }
  const repaired = withoutNotes.replace(anchor, `${anchor}${notesBlock}`);
  archive.file("ppt/presentation.xml", repaired);
  const buffer = await archive.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });
  await fs.writeFile(filePath, buffer);
}

async function main() {
  const pptx = new pptxgen();
  pptx.author = "C-120 Phase 0 owner-review checkpoint";
  pptx.company = "C-120 course planning";
  pptx.subject = "Exact-120 energy-first LEO-as-index course outline";
  pptx.title = "C-120 LEO 能源決策課程 Phase 0 outline";
  pptx.lang = "zh-TW";
  pptx.theme = {
    headFontFace: FONTS.cjk,
    bodyFontFace: FONTS.cjk,
    lang: "zh-TW",
  };
  pptx.layout = "LAYOUT_WIDE";

  const template = registerTemplate(pptx);
  if (!template || !template.masters || !template.bounds) {
    throw new Error("template did not return the required authoring contract exports");
  }
  if (template.typography.minimumTitlePt !== 28 || template.typography.minimumBodyPt !== 24) {
    throw new Error("unexpected edu typography floor");
  }

  addCourseOutlineSlideV5(pptx, template);
  for (const stage of STAGES) {
    addOverviewSlide(pptx, template, stage);
  }
  if (pptx.slides.length !== 9) {
    throw new Error(`expected 9 slides, got ${pptx.slides.length}`);
  }

  await pptx.writeFile({ fileName: outputPath });
  await repairPresentationElementOrder(outputPath);
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : String(error));
  process.exitCode = 1;
});
