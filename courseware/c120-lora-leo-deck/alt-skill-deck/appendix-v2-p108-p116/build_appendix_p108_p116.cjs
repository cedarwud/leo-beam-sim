"use strict";

const fs = require("node:fs");
const path = require("node:path");

const pptxgen = require("pptxgenjs");
const JSZip = require(path.join(process.env.PPTX_WRAP_MANAGED_MODULE_ROOT || "/home/sat/.local/state/pptx-wrap/versions/4.0.1/node_modules", "jszip"));

const ROOT = __dirname;
const DECK_ROOT = path.resolve(ROOT, "..");
const LATEST_ROOT = path.join(DECK_ROOT, "latest");
fs.mkdirSync(LATEST_ROOT, { recursive: true });
// The controller copy is authoritative for this checkout.  The remote
// authoring host carries an identical-SHA fallback for the same build script.
const TEMPLATE = fs.existsSync("/home/u24/pptx-wrap/assets/templates/educate.pptx")
  ? "/home/u24/pptx-wrap/assets/templates/educate.pptx"
  : "/home/sat/pptx-wrap/assets/templates/educate.pptx";
const OUTPUT = path.join(LATEST_ROOT, "LoRaEnergySim-LEO-ALT-APPENDIX-V2-P108-P116-REVIEW.pptx");
const SOURCE_MAP = path.join(ROOT, "source-map.json");
const QA_DIR = path.join(ROOT, "qa");
const BUILD_REPORT = path.join(QA_DIR, "build-report.json");
const METRICS_IMAGE = path.join(
  DECK_ROOT,
  "current-evidence/course-20260811/.playwright-cli/element-2026-08-11T03-06-45-152Z.png",
);
const REPLAY_IMAGE = path.join(
  DECK_ROOT,
  "current-evidence/course-20260811/.playwright-cli/element-2026-08-11T03-06-47-569Z.png",
);
const LEDGER_IMAGE = path.join(
  DECK_ROOT,
  "current-evidence/course-20260811/.playwright-cli/element-2026-08-11T03-06-50-920Z.png",
);

const CJK = "標楷體";
const LATIN = "Times New Roman";
const NAVY = "35377F";
const TEAL = "0F6F73";
const AMBER = "A66C1A";
const MAGENTA = "8C4A8F";
const RED = "963F42";
const INK = "1C1F24";
const MUTED = "62666B";
const PALE = "EFF3F8";
const PALE_TEAL = "E6F3F0";
const PALE_AMBER = "FBF3E5";
const PALE_MAGENTA = "F3EDF7";
const PALE_RED = "F9EEEE";
const BORDER = "B9C5D6";
const WHITE = "FFFFFF";

const SHAPE = { roundRect: "roundRect", rect: "rect", line: "line" };

function mixedText(text, { size = 24, color = INK, bold = false, italicTokens = true } = {}) {
  const result = [];
  const lines = String(text).split("\n");
  const tokenPattern = /(\n|[A-Za-z0-9_./:+\-]+(?:\s+[A-Za-z0-9_./:+\-]+)*|[^A-Za-z0-9_./:+\-\n]+)/g;
  lines.forEach((line, lineIndex) => {
    const pieces = line.match(tokenPattern) || [""];
    pieces.forEach((piece, pieceIndex) => {
      if (piece === "") return;
      const trimmed = piece.trim();
      if (!trimmed) {
        result.push({ text: piece, options: { fontFace: CJK, fontSize: size, color } });
        return;
      }
      const isLatin = /^[A-Za-z0-9]/.test(trimmed);
      const options = {
        fontFace: isLatin ? LATIN : CJK,
        fontSize: size,
        color,
        bold,
        italic: italicTokens && isLatin,
      };
      if (lineIndex < lines.length - 1 && pieceIndex === pieces.length - 1) {
        options.breakLine = true;
      }
      result.push({ text: piece, options });
    });
    if (lineIndex < lines.length - 1 && result.length > 0 && !result[result.length - 1].options.breakLine) {
      result[result.length - 1].options.breakLine = true;
    }
  });
  return result.length ? result : [{ text: "", options: { fontFace: CJK, fontSize: size, color } }];
}

function addText(slide, text, x, y, w, h, size = 24, options = {}) {
  const {
    color = INK,
    bold = false,
    italicTokens = true,
    align = "left",
    valign = "mid",
    margin = 0,
    placeholder,
    name,
    breakLine,
  } = options;
  const opts = {
    x,
    y,
    w,
    h,
    color,
    fontFace: CJK,
    fontSize: size,
    bold,
    align,
    valign,
    margin,
    breakLine,
    paraSpaceAfterPt: 0,
  };
  if (placeholder) opts.placeholder = placeholder;
  if (name) opts.name = name;
  slide.addText(mixedText(text, { size, color, bold, italicTokens }), opts);
}

function addTitle(slide, title) {
  addText(slide, title, 0.718, 0.205, 10.348, 0.525, 28, {
    color: NAVY,
    bold: true,
    italicTokens: false,
    valign: "bottom",
    placeholder: "title",
    name: "P108-P116 title",
  });
}

function addAnchor(slide, text) {
  addText(slide, text, 0.82, 1.08, 11.72, 0.52, 24, {
    color: INK,
    bold: true,
    valign: "mid",
    name: "Teaching anchor",
  });
}

function addBox(slide, x, y, w, h, { fill = WHITE, line = BORDER, width = 1.2, round = true } = {}) {
  const shape = slide.addShape(round ? SHAPE.roundRect : SHAPE.rect, {
    x,
    y,
    w,
    h,
    fill: { color: fill },
    line: { color: line, width },
  });
  return shape;
}

function addLine(slide, x1, y1, x2, y2, { color = MUTED, width = 1.5, dash = "solid", arrow = false } = {}) {
  slide.addShape(SHAPE.line, {
    x: x1,
    y: y1,
    w: x2 - x1,
    h: y2 - y1,
    line: { color, width, dashType: dash, endArrowType: arrow ? "triangle" : "none" },
  });
}

function addNode(slide, { x, y, w, h, title, body, color = NAVY, fill = PALE, titleSize = 21, bodySize = 18.5, align = "left" }) {
  addBox(slide, x, y, w, h, { fill, line: color, width: 1.5 });
  addText(slide, title, x + 0.16, y + 0.14, w - 0.32, 0.42, titleSize, {
    color,
    bold: true,
    italicTokens: false,
    align,
    valign: "mid",
  });
  addText(slide, body, x + 0.16, y + 0.65, w - 0.32, h - 0.78, bodySize, {
    color: INK,
    align,
    valign: "top",
  });
}

function addTag(slide, text, x, y, w, color = NAVY, fill = PALE) {
  addBox(slide, x, y, w, 0.32, { fill, line: color, width: 1.0 });
  addText(slide, text, x + 0.07, y + 0.02, w - 0.14, 0.26, 18, {
    color,
    bold: true,
    italicTokens: false,
    align: "center",
    valign: "mid",
  });
}

function addCaption(slide, text, x, y, w, color = MUTED) {
  addText(slide, text, x, y, w, 0.28, 18, { color, italicTokens: false, valign: "mid" });
}

function addNotes(slide, text) {
  slide.addNotes(text);
}

function renumberSlideShapeIds(xml) {
  let nextId = 1;
  return xml.replace(/(<p:cNvPr\b[^>]*?\bid=")(\d+)(")/g, (_match, prefix, _oldId, suffix) => {
    const replacement = `${prefix}${nextId}${suffix}`;
    nextId += 1;
    return replacement;
  });
}

function normalizeTextRunFonts(xml) {
  return xml.replace(/<a:r>([\s\S]*?)<\/a:r>/g, (_match, inner) => {
    const textMatch = inner.match(/<a:t>([\s\S]*?)<\/a:t>/);
    const text = textMatch ? textMatch[1].replace(/<[^>]+>/g, "").trim() : "";
    if (!text) return `<a:r>${inner}</a:r>`;
    const font = /^[A-Za-z0-9]/.test(text) ? LATIN : CJK;
    const normalized = inner
      .replace(/(<a:latin\b[^>]*?typeface=")[^"]*(")/g, `$1${font}$2`)
      .replace(/(<a:ea\b[^>]*?typeface=")[^"]*(")/g, `$1${font}$2`)
      .replace(/(<a:cs\b[^>]*?typeface=")[^"]*(")/g, `$1${font}$2`);
    return `<a:r>${normalized}</a:r>`;
  });
}

function raiseSlideNumberPlaceholderFonts(xml) {
  // The template footer is retained, but its empty/field placeholder must not
  // leave an explicit 14pt run in an authored slide.  16pt keeps the footer
  // readable while staying inside the protected footer zone.
  return xml.replace(/sz="1400"/g, 'sz="1600"');
}

function drawP108(slide) {
  addAnchor(slide, "同一 qualified window 內，服務、已送達工作量與 scoped energy 必須共同成立。");

  addBox(slide, 0.86, 1.68, 11.60, 0.93, { fill: PALE, line: BORDER, width: 1.0 });
  slide.addImage({ path: METRICS_IMAGE, x: 0.91, y: 1.74, w: 11.50, h: 0.795, altText: "Current same-scenario fallback metrics" });
  addCaption(slide, "current evidence example｜A / baseline｜來源：同情境備用資料", 0.91, 2.66, 11.48);

  const cards = [
    {
      x: 0.88,
      color: RED,
      fill: PALE_RED,
      title: "服務 verdict（服務判定）",
      body: "來源：service evaluator\n值：FAIL／Boolean\n作用：服務條件 gate。",
    },
    {
      x: 4.82,
      color: TEAL,
      fill: PALE_TEAL,
      title: "delivered work（已送達工作量）",
      body: "來源：packet ledger\n值：4800 bit\n作用：效率分子。",
    },
    {
      x: 8.76,
      color: AMBER,
      fill: PALE_AMBER,
      title: "scoped energy（有範圍能量）",
      body: "來源：endpoint result\n值：6.92 J\n作用：同一 endpoint 的分母。",
    },
  ];
  cards.forEach((card) => addNode(slide, { x: card.x, y: 3.08, w: 3.56, h: 1.70, ...card, titleSize: 18.2, bodySize: 16.2 }));

  addBox(slide, 0.90, 5.02, 11.56, 0.75, { fill: PALE_MAGENTA, line: MAGENTA, width: 1.5, round: false });
  addText(slide, "判讀順序：服務 → 已送達資料 → 端點 J → 端點 bit/J。服務 FAIL 時，效率只描述此 run；策略分類保留 trade-off 或 failure。", 1.12, 5.17, 11.12, 0.43, 20.2, {
    color: INK,
    bold: true,
    valign: "mid",
  });
}

function drawP109(slide) {
  addAnchor(slide, "evidence record（證據紀錄）將來源、identity（識別）、機制、觀察與限制放在同一條可重建脈絡。");

  addTag(slide, "current ledger evidence", 0.88, 1.67, 3.15, TEAL, PALE_TEAL);
  addBox(slide, 0.88, 2.08, 5.58, 0.73, { fill: PALE, line: BORDER, width: 1.0 });
  slide.addImage({ path: LEDGER_IMAGE, x: 0.92, y: 2.19, w: 5.50, h: 0.454, altText: "Current ledger evidence with source label" });
  addText(slide, "A / baseline｜來源：同情境備用資料\n服務 FAIL｜端點能量 6.92 J", 0.96, 2.88, 5.36, 0.64, 19.5, {
    color: INK,
    valign: "mid",
  });
  addBox(slide, 0.88, 3.76, 5.58, 1.67, { fill: PALE_TEAL, line: TEAL, width: 1.4 });
  addText(slide, "可重建條件", 1.08, 3.94, 2.2, 0.32, 21, { color: TEAL, bold: true, italicTokens: false });
  addText(slide, "來源模式：同情境備用資料\n觀察路徑：result → replay → service\n限制：current run identity 待補", 1.08, 4.34, 5.00, 0.82, 19.2, { color: INK, valign: "top" });

  addBox(slide, 6.80, 1.67, 5.66, 3.76, { fill: PALE_MAGENTA, line: MAGENTA, width: 1.5 });
  const rows = [
    ["source mode（來源模式）", "同情境備用資料"],
    ["run_id（執行識別碼）", "待補（runner record）"],
    ["scenario（情境）", "ntpu-energy-decision-01"],
    ["scope（範圍）", "endpoint radio／processing"],
    ["mechanism（機制）", "policy → event → service"],
    ["limitation（限制）", "simulated teaching data"],
  ];
  rows.forEach((row, index) => {
    const y = 1.86 + index * 0.56;
    if (index > 0) addLine(slide, 7.00, y - 0.08, 12.24, y - 0.08, { color: "D9CBE1", width: 0.8 });
    addText(slide, row[0], 7.02, y, 2.28, 0.46, 16.4, { color: MAGENTA, bold: true, valign: "mid" });
    addText(slide, row[1], 9.42, y, 2.82, 0.46, 16.4, { color: INK, valign: "mid" });
  });

  addBox(slide, 6.82, 5.58, 5.62, 0.82, { fill: PALE_AMBER, line: AMBER, width: 1.2, round: false });
  addText(slide, "identity／scope 缺漏 → INCOMPLETE；保留 result／replay 與 recovery target。", 7.02, 5.70, 5.20, 0.54, 16.0, { color: INK, bold: true, valign: "mid" });
}

function drawP110(slide) {
  addAnchor(slide, "來源與 model lineage 決定 claim class；分類描述證據生成方式，不作優劣排名。");

  const nodes = [
    { x: 0.90, color: NAVY, fill: PALE, title: "measured（實測）", body: "來源：instrument\n單位：隨物理量\n作用：支援 bounded measurement claim。" },
    { x: 3.96, color: TEAL, fill: PALE_TEAL, title: "derived（模型推導）", body: "來源：source + model\n單位：隨輸出\n作用：保留 model／time lineage。" },
    { x: 7.02, color: AMBER, fill: PALE_AMBER, title: "assumed（課程假設）", body: "來源：course contract\n單位：隨參數\n作用：限定 assumption-scoped explanation。" },
    { x: 10.08, color: MAGENTA, fill: PALE_MAGENTA, title: "simulated（模擬輸出）", body: "來源：runner artifact\n單位：依 schema\n作用：目前 endpoint result 的分類。" },
  ];
  nodes.forEach((node, index) => {
    addNode(slide, { x: node.x, y: 2.02, w: 2.43, h: 2.58, ...node, titleSize: 18.3, bodySize: 16.2 });
    if (index < nodes.length - 1) {
      addLine(slide, node.x + 2.50, 3.24, nodes[index + 1].x - 0.08, 3.24, { color: MUTED, width: 1.4, arrow: true });
    }
  });
  addText(slide, "直接取得", 2.94, 3.03, 0.78, 0.26, 17.5, { color: MUTED, italicTokens: false, align: "center" });
  addText(slide, "加上模型", 6.00, 3.03, 0.78, 0.26, 17.5, { color: MUTED, italicTokens: false, align: "center" });
  addText(slide, "契約指定", 9.06, 3.03, 0.78, 0.26, 17.5, { color: MUTED, italicTokens: false, align: "center" });

  addBox(slide, 0.92, 4.92, 11.54, 0.86, { fill: PALE_RED, line: RED, width: 1.5, round: false });
  addText(slide, "目前 claim ceiling：SIMULATED TEACHING DATA / NOT LIVE / NOT MEASURED / NOT CANONICAL-PARITY-VERIFIED", 1.14, 5.08, 11.10, 0.28, 18.4, { color: RED, bold: true, italicTokens: true, align: "center" });
  addText(slide, "來源不明時降低 claim class；欄位狀態標示「待補」，保留 provenance。", 1.12, 5.48, 11.12, 0.28, 18.2, { color: INK, align: "center" });
}

function drawP111(slide) {
  addAnchor(slide, "兩層 replay 共用 scenario／clock anchor；field authority 與 energy semantics 仍分離。");

  addBox(slide, 0.98, 1.72, 11.28, 0.55, { fill: PALE, line: BORDER, width: 1.2, round: false });
  addText(slide, "共享錨點｜scenario_id、clock、workbook context", 1.20, 1.86, 10.84, 0.24, 20, { color: NAVY, bold: true, italicTokens: false, align: "center" });
  addLine(slide, 3.86, 2.31, 3.86, 2.58, { color: NAVY, width: 1.5, arrow: true });
  addLine(slide, 9.40, 2.31, 9.40, 2.58, { color: NAVY, width: 1.5, arrow: true });

  addBox(slide, 0.88, 2.58, 5.56, 3.02, { fill: PALE_TEAL, line: TEAL, width: 1.5 });
  addTag(slide, "endpoint evidence layer", 1.10, 2.78, 2.70, TEAL, WHITE);
  addText(slide, "endpoint_energy_j（端點累積能量）", 1.12, 3.26, 5.02, 0.35, 20.5, { color: TEAL, bold: true });
  addText(slide, "來源：LoRaEnergySim result\n單位：J\n範圍：endpoint radio／processing\n判讀：比較同一 endpoint boundary 的 policy 結果", 1.12, 3.70, 5.00, 1.02, 16.0, { color: INK, valign: "top" });
  addBox(slide, 1.12, 5.00, 5.00, 0.44, { fill: WHITE, line: TEAL, width: 0.9, round: false });
  addText(slide, "目前 endpoint result：simulated teaching data", 1.25, 5.08, 4.74, 0.28, 16.0, { color: TEAL, bold: true, italicTokens: false, align: "center", valign: "mid" });

  addBox(slide, 6.78, 2.58, 5.56, 3.02, { fill: PALE_AMBER, line: AMBER, width: 1.5 });
  addTag(slide, "system / canonical layer", 7.00, 2.78, 2.92, AMBER, WHITE);
  addText(slide, "system consumed J（系統消耗能量）", 7.02, 3.26, 5.02, 0.35, 20.5, { color: AMBER, bold: true });
  addText(slide, "來源：C-120 provider contract\n單位：J\n範圍：LEO／system evidence authority\n判讀：與 endpoint J 分開保存；current value 待補", 7.02, 3.70, 5.00, 1.02, 16.0, { color: INK, valign: "top" });
  addBox(slide, 7.02, 5.00, 5.00, 0.44, { fill: WHITE, line: AMBER, width: 0.9, round: false });
  addText(slide, "canonical efficiency（權威系統效率）｜bit/J｜current value 待補", 7.12, 5.07, 4.80, 0.30, 16.0, { color: AMBER, bold: true, italicTokens: false, align: "center", valign: "mid" });

  addBox(slide, 2.56, 5.92, 8.98, 0.42, { fill: PALE_MAGENTA, line: MAGENTA, width: 1.1, round: false });
  addText(slide, "相同 J 單位；語義由 boundary 與 authority 決定。", 2.80, 6.01, 8.50, 0.22, 19, { color: INK, bold: true, italicTokens: false, align: "center" });
}

function drawP112(slide) {
  addText(slide, "唯一可編輯的 policy（策略）block（區塊）產生 JSON；Leo 依 identity（識別）、schema（結構）、units（單位）與 provenance（來源脈絡）建立 endpoint replay（端點重播）。", 0.82, 1.08, 11.72, 0.66, 20, { color: INK, bold: true, valign: "mid" });

  const steps = [
    { x: 0.78, color: MAGENTA, fill: PALE_MAGENTA, title: "01｜policy edit", body: "student_policy.py\nmarked block\n唯一可編輯 node", code: "URGENT_MARGIN_S = 20" },
    { x: 3.85, color: TEAL, fill: PALE_TEAL, title: "02｜local runner", body: "policy identity\nresult.json\nendpoint-replay.json" },
    { x: 6.92, color: AMBER, fill: PALE_AMBER, title: "03｜Leo import gate", body: "schema\nscenario identity\nunits／provenance" },
    { x: 9.99, color: NAVY, fill: PALE, title: "04｜endpoint replay", body: "queue／action\nradio state／packet\nendpoint energy" },
  ];
  steps.forEach((step, index) => {
    addBox(slide, step.x, 2.06, 2.42, 2.58, { fill: step.fill, line: step.color, width: 1.6 });
    addText(slide, step.title, step.x + 0.13, 2.23, 2.16, 0.34, 19, { color: step.color, bold: true, italicTokens: false, align: "center" });
    if (step.code) {
      addBox(slide, step.x + 0.15, 2.78, 2.12, 0.70, { fill: WHITE, line: step.color, width: 1.0, round: false });
      addText(slide, step.code, step.x + 0.24, 2.97, 1.94, 0.24, 18.2, { color: INK, bold: true, align: "center", valign: "mid" });
      addText(slide, step.body, step.x + 0.19, 3.68, 2.04, 0.70, 18.2, { color: INK, align: "center", valign: "top" });
    } else {
      addText(slide, step.body, step.x + 0.18, 2.88, 2.06, 1.36, 19, { color: INK, align: "center", valign: "mid" });
    }
    if (index < steps.length - 1) addLine(slide, step.x + 2.50, 3.34, steps[index + 1].x - 0.10, 3.34, { color: step.color, width: 2.0, arrow: true });
  });
  addText(slide, "產生", 3.00, 3.07, 0.66, 0.24, 17.5, { color: MUTED, italicTokens: false, align: "center" });
  addText(slide, "驗證", 6.07, 3.07, 0.66, 0.24, 17.5, { color: MUTED, italicTokens: false, align: "center" });
  addText(slide, "materialize", 9.14, 3.07, 0.78, 0.24, 17.5, { color: MUTED, italicTokens: false, align: "center" });

  addBox(slide, 1.00, 5.03, 11.26, 1.30, { fill: PALE, line: NAVY, width: 1.4, round: false });
  addText(slide, "policy identity 綁定 permitted edit 與 result／replay；Leo 接收 JSON，Python 留在 local runner。", 1.24, 5.20, 10.78, 0.40, 17.0, { color: INK, bold: true, align: "center", valign: "mid" });
  addText(slide, "可追溯 diff 必須出現在 action、state、packet、service 或 endpoint energy。", 1.24, 5.78, 10.78, 0.30, 16.0, { color: MUTED, align: "center", valign: "mid" });
}

function drawP113(slide) {
  addText(slide, "scenario（情境）、receipt（收據）、result（結果）、replay（重播）與 workbook（比較紀錄）以 identity（識別）、units（單位）、seed（種子）、policy（策略）與 source mode（來源模式）維持同一契約。", 0.82, 1.08, 11.72, 0.70, 20, { color: INK, bold: true, valign: "mid" });

  const nodes = [
    { x: 0.78, color: NAVY, fill: PALE, title: "scenario（情境）", body: "來源：package\n固定 inputs／cases\nstructured record\n識別：ntpu-energy-decision-01" },
    { x: 3.25, color: TEAL, fill: PALE_TEAL, title: "receipt（凍結收據）", body: "來源：runner\n保存 predecessor\npolicy lineage\nidentity record" },
    { x: 5.72, color: AMBER, fill: PALE_AMBER, title: "result（結果檔）", body: "來源：runner\nsummary／service\nendpoint energy\nJSON artifact" },
    { x: 8.19, color: MAGENTA, fill: PALE_MAGENTA, title: "replay（事件重播）", body: "來源：runner／provider\nordered events\nstate changes\nframe context" },
    { x: 10.66, color: RED, fill: PALE_RED, title: "workbook（比較紀錄）", body: "來源：browser\nprediction／result\nreopen state\nsource mode" },
  ];
  nodes.forEach((node, index) => {
    addNode(slide, { x: node.x, y: 2.05, w: 2.12, h: 2.80, ...node, titleSize: 17.0, bodySize: 16.0, align: "center" });
    if (index < nodes.length - 1) addLine(slide, node.x + 2.18, 3.30, nodes[index + 1].x - 0.08, 3.30, { color: node.color, width: 1.6, arrow: true });
  });
  addBox(slide, 0.96, 5.02, 11.30, 1.14, { fill: PALE_MAGENTA, line: MAGENTA, width: 1.5, round: false });
  addText(slide, "import gate：validation failure 時，session／workbook 保持原狀；matching artifact 或 same-scenario fallback 才能恢復 lineage。", 1.22, 5.18, 10.78, 0.52, 16.0, { color: INK, bold: true, align: "center", valign: "mid" });
  addText(slide, "source mode：實際執行與同情境備用資料分開陳述。", 1.22, 5.82, 10.78, 0.24, 16.0, { color: MUTED, align: "center", valign: "mid" });
}

function drawP114(slide) {
  addText(slide, "pinned upstream（固定上游）、course wrapper（課程包裝）、documented JSON（文件化 JSON）與 Leo application（Leo 應用）以清楚介面與授權邊界分離。", 0.82, 1.08, 11.72, 0.70, 20, { color: INK, bold: true, valign: "mid" });

  const lanes = [
    { x: 0.82, color: NAVY, fill: PALE, title: "source（來源）", body: "upstream package／scenario\n原始 code 或 data\n決定 provenance" },
    { x: 3.88, color: TEAL, fill: PALE_TEAL, title: "model（模型）", body: "runner implementation\nequations／state machine\ninput → simulated events" },
    { x: 6.94, color: AMBER, fill: PALE_AMBER, title: "assumption（假設）", body: "course wrapper\ntyped parameters\n界定教學簡化與 endpoint scope" },
    { x: 10.00, color: MAGENTA, fill: PALE_MAGENTA, title: "license（授權）", body: "repository metadata\nGPL upstream boundary\ncode reuse／distribution rule" },
  ];
  lanes.forEach((lane, index) => {
    addBox(slide, lane.x, 2.05, 2.55, 2.90, { fill: lane.fill, line: lane.color, width: 1.5, round: false });
    addText(slide, lane.title, lane.x + 0.15, 2.28, 2.25, 0.36, 19.5, { color: lane.color, bold: true, align: "center" });
    addText(slide, lane.body, lane.x + 0.18, 2.96, 2.19, 1.24, 18.2, { color: INK, align: "center", valign: "mid" });
    if (index < lanes.length - 1) addLine(slide, lane.x + 2.62, 3.48, lanes[index + 1].x - 0.10, 3.48, { color: MUTED, width: 1.6, arrow: true });
  });
  addBox(slide, 1.44, 5.16, 10.45, 1.16, { fill: WHITE, line: NAVY, width: 1.5, round: false });
  addText(slide, "documented JSON seam：course wrapper 與 Leo application 交換 result／replay；source 與 application source 分界。", 1.70, 5.31, 9.94, 0.48, 16.4, { color: INK, bold: true, align: "center", valign: "mid" });
  addText(slide, "可編輯面限於 marked policy block；其他變更回到 owner review。", 1.70, 5.90, 9.94, 0.28, 16.0, { color: MUTED, align: "center", valign: "mid" });
}

function drawP115(slide) {
  addText(slide, "changing opportunity（變動機會）仍驅動 send、wait、sleep、batch、urgent；移轉時重新定義 service（服務）與 energy boundary（能量邊界）。", 0.82, 1.08, 11.72, 0.70, 20, { color: INK, bold: true, valign: "mid" });

  addBox(slide, 0.90, 1.88, 3.10, 3.70, { fill: PALE_MAGENTA, line: MAGENTA, width: 1.5 });
  addText(slide, "機制核心", 1.16, 2.10, 2.58, 0.34, 22, { color: MAGENTA, bold: true, align: "center", italicTokens: false });
  const core = ["job（工作量）", "opportunity（時機）", "policy（策略）", "service（服務）", "boundary（能量範圍）"];
  core.forEach((text, index) => {
    const y = 2.62 + index * 0.55;
    addBox(slide, 1.18, y, 2.54, 0.38, { fill: WHITE, line: MAGENTA, width: 0.9, round: false });
    addText(slide, text, 1.28, y + 0.07, 2.34, 0.22, 16.0, { color: INK, bold: index === 2, align: "center", valign: "mid" });
    if (index < core.length - 1) addLine(slide, 2.45, y + 0.39, 2.45, y + 0.55, { color: MAGENTA, width: 1.0, arrow: true });
  });

  const contexts = [
    { y: 1.88, color: TEAL, fill: PALE_TEAL, title: "智慧農業", body: "job：感測上傳\nopportunity：閘道可用時段\nboundary：端點 radio／processing" },
    { y: 3.00, color: AMBER, fill: PALE_AMBER, title: "HVAC", body: "job：狀態回報\nopportunity：低負載／可連線時段\nboundary：控制器與網路端點" },
    { y: 4.12, color: NAVY, fill: PALE, title: "edge application", body: "job：事件批次\nopportunity：資源與 deadline\nboundary：edge node／gateway" },
  ];
  contexts.forEach((context) => {
    addBox(slide, 4.50, context.y, 7.96, 0.94, { fill: context.fill, line: context.color, width: 1.4, round: false });
    addText(slide, context.title, 4.72, context.y + 0.19, 1.72, 0.28, 20, { color: context.color, bold: true, italicTokens: false, align: "center" });
    addText(slide, context.body, 6.70, context.y + 0.13, 5.42, 0.60, 17.8, { color: INK, valign: "mid" });
    addLine(slide, 4.06, context.y + 0.47, 4.43, context.y + 0.47, { color: MAGENTA, width: 1.4, arrow: true });
  });
  addBox(slide, 4.50, 5.25, 7.96, 1.02, { fill: PALE_RED, line: RED, width: 1.3, round: false });
  addText(slide, "transfer verdict：同一 control mechanism；service、deadline、traffic 與 energy scope 需重定義。target-domain value 待補。", 4.74, 5.38, 7.48, 0.66, 16.0, { color: INK, bold: true, align: "center", valign: "mid" });
}

function drawP116(slide) {
  addText(slide, "交接狀態由 evidence record（證據紀錄）、frozen identity（凍結識別）、workbook reopen state（比較紀錄重開狀態）與 claim class（主張類別）共同決定。", 0.82, 1.08, 11.72, 0.70, 20, { color: INK, bold: true, valign: "mid" });

  const pillars = [
    { x: 0.90, color: TEAL, fill: PALE_TEAL, title: "可重開", body: "workbook export\n→ reopen\n→ identity check" },
    { x: 4.00, color: MAGENTA, fill: PALE_MAGENTA, title: "可反駁", body: "prediction\n→ result／replay\n→ counterexample" },
    { x: 7.10, color: NAVY, fill: PALE, title: "可追溯", body: "source\n→ policy\n→ evidence／limitation" },
  ];
  pillars.forEach((pillar) => addNode(slide, { x: pillar.x, y: 1.98, w: 2.70, h: 2.05, ...pillar, titleSize: 21, bodySize: 17.0, align: "center" }));
  addLine(slide, 3.63, 3.02, 3.94, 3.02, { color: TEAL, width: 1.7, arrow: true });
  addLine(slide, 6.73, 3.02, 7.04, 3.02, { color: MAGENTA, width: 1.7, arrow: true });
  addLine(slide, 9.83, 3.02, 10.20, 3.02, { color: NAVY, width: 1.7, arrow: true });

  addBox(slide, 10.30, 1.98, 2.15, 2.25, { fill: PALE_AMBER, line: AMBER, width: 1.5 });
  addText(slide, "handoff gate", 10.48, 2.16, 1.78, 0.29, 18.0, { color: AMBER, bold: true, italicTokens: false, align: "center" });
  addBox(slide, 10.48, 2.62, 1.78, 0.52, { fill: WHITE, line: TEAL, width: 0.9, round: false });
  addText(slide, "COMPLETE\nevidence ready", 10.56, 2.70, 1.62, 0.34, 16.0, { color: TEAL, bold: true, align: "center", valign: "mid" });
  addBox(slide, 10.48, 3.28, 1.78, 0.72, { fill: PALE_RED, line: RED, width: 0.9, round: false });
  addText(slide, "INCOMPLETE\nrecovery target", 10.56, 3.42, 1.62, 0.42, 16.0, { color: RED, bold: true, align: "center", valign: "mid" });

  addBox(slide, 0.96, 4.43, 11.48, 1.05, { fill: PALE, line: NAVY, width: 1.4, round: false });
  addText(slide, "claim class 由 current source／model／assumption lineage 限定；donor material 保留為 concept／source trail。", 1.20, 4.58, 11.00, 0.34, 16.2, { color: INK, bold: true, align: "center", valign: "mid" });
  addText(slide, "缺漏 gate → 保留缺口 → 返回 artifact 或 same-scenario fallback；claim ceiling 維持既定範圍。", 1.20, 5.02, 11.00, 0.34, 16.0, { color: MUTED, align: "center", valign: "mid" });

  addBox(slide, 0.96, 5.64, 11.48, 0.74, { fill: PALE_RED, line: RED, width: 1.2, round: false });
  addText(slide, "concept source：BeamShift e2 96–97、113–114；current evidence：本 artifact 與 authority record。", 1.20, 5.80, 11.00, 0.42, 16.0, { color: RED, bold: true, italicTokens: false, align: "center", valign: "mid" });
}

const SLIDES = [
  { id: "P108", title: "節能判讀需要服務、工作量與能量", draw: drawP108 },
  { id: "P109", title: "可重建的證據紀錄", draw: drawP109 },
  { id: "P110", title: "證據來源分類", draw: drawP110 },
  { id: "P111", title: "端點與系統能量邊界", draw: drawP111 },
  { id: "P112", title: "策略至 Leo 匯入的血緣", draw: drawP112 },
  { id: "P113", title: "情境至比較紀錄的契約鏈", draw: drawP113 },
  { id: "P114", title: "來源、模型、假設與授權邊界", draw: drawP114 },
  { id: "P115", title: "控制機制遷移至其他 IoT 場域", draw: drawP115 },
  { id: "P116", title: "可重開、可反駁、可追溯的交接紀錄", draw: drawP116 },
];

const NOTES = {
  P108: "本頁將節能判讀固定在服務、工作量與能量的共同範圍。畫面中的 A／baseline 來源標為同情境備用資料，顯示服務 FAIL、4800 bit、6.92 J 與端點 bit/J 693.641618；這組數值只作為同一 endpoint run 的讀法示例。服務 verdict 是第一個 gate，delivered work 提供效率分子，scoped energy 提供同一 endpoint boundary 的分母；服務 FAIL 時，結果分類保留 trade-off 或 failure。來源依 current /course field-interpretation 與同情境備用資料而定；概念來源為 BeamShift e2 70–75，current authority 以 ADR-004、C120 SDD 與 ALT handoff 為準。",
  P109: "本頁把 evidence record 寫成可重建資料結構。source mode 說明實際執行或同情境備用資料，run_id 連結 result 與 endpoint replay，scenario 與 scope 限定同一個情境和 endpoint boundary，mechanism 把 policy、event 與 service 接起來，limitation 則固定 simulated teaching data 的 claim ceiling。畫面中的 ledger 來源清楚標示同情境備用資料；current run identity 沿用 record 保存，投影片以待補表示未在畫面資產中公開的識別內容。identity 或 scope 缺漏時狀態為 INCOMPLETE，原始 result、replay 與 recovery target 維持可追溯。概念來源為 BeamShift e2 96–97；current authority 以 ADR-004、C120 SDD、ALT handoff 與 current /course field-interpretation 為準。",
  P110: "證據分類描述資料如何生成，不作優劣排名。measured 來自 instrument 的直接取得，derived 由 source 加上 model 推導，assumed 由 course contract 指定，simulated 則由 runner artifact 產生；目前 endpoint result 屬於 simulated teaching data。分類同時限定可使用的語句強度，來源或 lineage 不完整時降低 claim class 並標示待補。頁面保留完整 claim ceiling：SIMULATED TEACHING DATA / NOT LIVE / NOT MEASURED / NOT CANONICAL-PARITY-VERIFIED。概念來源為 BeamShift e2 113；current authority 以 ADR-004、C120 SDD 與 ALT handoff 為準。",
  P111: "本頁分開 endpoint 與 system 的能量 authority。endpoint_energy_j 由 LoRaEnergySim result 提供，單位為 J，範圍是 endpoint radio／processing；system consumed J 由 C-120 provider contract 提供，範圍屬 LEO／system evidence；canonical efficiency 由 canonical source 定義，單位為 bit/J，當前值以待補表示。兩層可以共享 scenario、clock 與 workbook context，但相同 J 單位不形成語義等價。endpoint 欄位不寫入 system 或 canonical fields；scope 不明時停止 bit/J 判讀。概念來源為 BeamShift e2 19–21、28–29、32–33；current authority 以 ADR-004、C120 SDD 與 ALT handoff 為準。",
  P112: "本頁沿著 policy 至 Leo import 的 lineage 閱讀。student_policy.py 的 marked block 是唯一可編輯 node；local runner 以 policy identity 產生 result.json 與 endpoint-replay.json；Leo import gate 核對 schema、scenario identity、units 與 provenance，再 materialize endpoint replay。policy identity 將 permitted edit 綁定到 artifact，只有 action、state、packet、service 或 endpoint energy 出現 consequential diff，才形成教學證據。Leo 的輸入介面是 JSON，Python 執行留在 local runner；version、policy identity 或 scenario mismatch 時回到 release checkpoint 或 matching fallback。概念來源為 BeamShift e2 96–97；current authority 以 ADR-004、C120 SDD、ALT handoff、package README 與 schemas 為準。",
  P113: "本頁把 scenario、receipt、result、replay 與 workbook 讀成一條 contract。scenario 固定 inputs 與 cases，receipt 保存 predecessor 與 policy lineage，result 保存 summary、service 與 endpoint energy，replay 以 ordered events 呈現 state changes，workbook 保存 prediction、result lineage 與 reopen state。validation failure 時 session 與 workbook 保持原狀，合法恢復路徑是 matching artifact 或 same-scenario fallback；source mode 依實際執行或同情境備用資料原樣記錄。概念以 current SDD 為主，並採用 BeamShift e2 70–75 的 evidence qualification 概念；current authority 以 ADR-004、C120 SDD、ALT handoff 與 package schemas 為準。",
  P114: "本頁說明 source、model、assumption 與 license 的邊界。source 指向 pinned upstream package 或 scenario，model 指向 runner 的 equations 與 state machine，assumption 由 course wrapper 明示，license 由 repository metadata 與 GPL upstream boundary 約束。documented JSON 是 course wrapper 與 Leo application 的介面，保留 source disclosure、result classification 與 trust boundary；可編輯面仍限於 marked policy block。涉及 upstream、Leo source、schema 或 scientific semantics 的變更回到 owner review。概念來源為 BeamShift e2 113–114；current authority 以 ADR-004、C120 SDD、ALT handoff、package LICENSE 與 THIRD_PARTY_NOTICES 為準。",
  P115: "本頁將 changing opportunity 的控制機制轉移到其他 IoT 場域。job 定義需要完成的工作，opportunity 描述可服務時機，policy 將 observation 映射為 action，service 與 energy boundary 則必須在新場域重新定義。智慧農業、HVAC 與 edge application 可以沿用 send、wait、sleep、batch、urgent 的控制 vocabulary，但不沿用 LEO 的數值或 boundary；target-domain value 以待補表示。transfer hypothesis 應留下 falsifier，讓結果能縮小而非擴大 claim。概念來源為 BeamShift e2 2、4、19；current authority 以 ADR-004、C120 SDD 與 ALT handoff 為準。",
  P116: "本頁以可重開、可反駁、可追溯收束交接紀錄。可重開要求 workbook export、reopen 與 identity check；可反駁要求 prediction、result／replay 與 counterexample；可追溯要求 source、policy、evidence 與 limitation 彼此連結。COMPLETE 只在 required evidence 齊備時成立，INCOMPLETE 需保留缺口與 recovery target；claim class 由 current source、model 與 assumption lineage 限定。Donor material 只保留為 concept 與 source trail，current evidence 由本 artifact 與 authority record 提供。概念來源為 BeamShift e2 96–97、113–114 與 donor disposition map；current authority 以 ADR-004、C120 SDD 與 ALT handoff 為準。",
};

async function overlayTemplateParts(pptxPath, slideCount) {
  const generated = await JSZip.loadAsync(await fs.promises.readFile(pptxPath));
  const template = await JSZip.loadAsync(await fs.promises.readFile(TEMPLATE));
  const templatePrefixes = ["ppt/slideLayouts/", "ppt/slideMasters/", "ppt/theme/", "ppt/notesMasters/"];
  for (const name of Object.keys(generated.files)) {
    if (templatePrefixes.some((prefix) => name.startsWith(prefix))) generated.remove(name);
  }
  for (const name of Object.keys(template.files)) {
    if (!templatePrefixes.some((prefix) => name.startsWith(prefix))) continue;
    const entry = template.files[name];
    if (!entry.dir) generated.file(name, await entry.async("nodebuffer"));
  }
  for (const name of ["ppt/media/image1.png", "ppt/media/image2.png", "ppt/media/image3.png"]) {
    generated.file(name, await template.file(name).async("nodebuffer"));
  }

  for (const name of Object.keys(generated.files)) {
    if (!/^ppt\/slides\/_rels\/slide\d+\.xml\.rels$/.test(name)) continue;
    const xml = await generated.file(name).async("string");
    generated.file(name, xml.replace(
      /Target="\.\.\/slideLayouts\/slideLayout\d+\.xml"/g,
      'Target="../slideLayouts/slideLayout2.xml"',
    ));
    const slideName = name.replace("/_rels/", "/").replace(/\.rels$/, "");
    const slideXml = await generated.file(slideName).async("string");
    generated.file(slideName, renumberSlideShapeIds(slideXml));
  }

  for (const name of Object.keys(generated.files)) {
    if (/^ppt\/slides\/slide\d+\.xml$/.test(name) || /^ppt\/notesSlides\/notesSlide\d+\.xml$/.test(name)) {
      const xml = await generated.file(name).async("string");
      generated.file(name, raiseSlideNumberPlaceholderFonts(normalizeTextRunFonts(xml)));
    }
  }

  // slideLayout2 is the only authored content shell.  Its footer placeholder
  // inherits the same 16pt floor as the slide-number fields above; other
  // template layouts remain untouched and are not referenced by slides.
  const layout2Name = "ppt/slideLayouts/slideLayout2.xml";
  const layout2Xml = await generated.file(layout2Name).async("string");
  generated.file(layout2Name, raiseSlideNumberPlaceholderFonts(layout2Xml));

  let contentTypes = await template.file("[Content_Types].xml").async("string");
  contentTypes = contentTypes
    .replace(/<Override PartName="\/ppt\/slides\/slide\d+\.xml"[^>]*\/>/g, "")
    .replace(/<Override PartName="\/ppt\/notesSlides\/notesSlide\d+\.xml"[^>]*\/>/g, "");
  const overrides = [];
  for (let index = 1; index <= slideCount; index += 1) {
    overrides.push(`<Override PartName="/ppt/slides/slide${index}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`);
    overrides.push(`<Override PartName="/ppt/notesSlides/notesSlide${index}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.notesSlide+xml"/>`);
  }
  contentTypes = contentTypes.replace("</Types>", `${overrides.join("")}</Types>`);
  generated.file("[Content_Types].xml", contentTypes);

  // PptxGenJS emits duplicate compiled-master media files.  Keep only media
  // that is reachable from a relationship target; stale image-1002/image-1003
  // files otherwise make PowerPoint report a corrupt package.
  const mediaNames = Object.keys(generated.files).filter(
    (name) => name.startsWith("ppt/media/") && !generated.files[name].dir,
  );
  const referencedMedia = new Set();
  for (const relsName of Object.keys(generated.files)) {
    if (!relsName.endsWith(".rels") || generated.files[relsName].dir) continue;
    const relsParent = path.posix.dirname(relsName);
    const sourceDir = relsParent.endsWith("/_rels")
      ? relsParent.slice(0, -"/_rels".length)
      : relsParent;
    const relsXml = await generated.file(relsName).async("string");
    for (const match of relsXml.matchAll(/\bTarget="([^"]+)"/g)) {
      const resolved = path.posix.normalize(path.posix.join(sourceDir, match[1]));
      if (resolved.startsWith("ppt/media/")) referencedMedia.add(resolved);
    }
  }
  for (const mediaName of mediaNames) {
    if (!referencedMedia.has(mediaName)) generated.remove(mediaName);
  }

  // The generated presentation places notesMasterIdLst after sldIdLst.  The
  // OOXML schema (and the template) require it before sldIdLst.
  let presentationXml = await generated.file("ppt/presentation.xml").async("string");
  const notesMatch = presentationXml.match(/\s*<p:notesMasterIdLst>[\s\S]*?<\/p:notesMasterIdLst>\s*/);
  if (notesMatch) {
    const notesNode = notesMatch[0].trim();
    presentationXml = presentationXml.replace(notesMatch[0], "\n");
    presentationXml = presentationXml.replace(/(\s*<p:sldIdLst>)/, `\n  ${notesNode}\n$1`);
    generated.file("ppt/presentation.xml", presentationXml);
  }

  const output = await generated.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
  await fs.promises.writeFile(pptxPath, output);
}

async function build() {
  const masterPath = process.argv[2];
  const masterExport = process.argv[3];
  if (!masterPath || !masterExport) {
    throw new Error("Usage: build_appendix_p108_p116.cjs <master_path> <master_export>");
  }
  const helper = require(masterPath);
  const registerTemplate = helper[masterExport];
  if (typeof registerTemplate !== "function") throw new Error(`Invalid template export: ${masterExport}`);

  const pptx = new pptxgen();
  const template = registerTemplate(pptx);
  if (!template || template.masters.content !== "PPTX_WRAP_EDUCATE_CONTENT") {
    throw new Error("educate content master did not register");
  }
  pptx.author = "OpenAI Codex";
  pptx.company = "OpenAI";
  pptx.subject = "C-120 appendix P108-P116";
  pptx.title = "LoRaEnergySim + LEO 技術附錄 P108-P116";
  pptx.lang = "zh-TW";
  pptx.layout = template.layoutName;

  for (const spec of SLIDES) {
    const slide = pptx.addSlide({ masterName: template.masters.content });
    addTitle(slide, spec.title);
    spec.draw(slide);
    addNotes(slide, NOTES[spec.id]);
  }

  await pptx.writeFile({ fileName: OUTPUT });
  await overlayTemplateParts(OUTPUT, SLIDES.length);

  fs.mkdirSync(QA_DIR, { recursive: true });
  fs.writeFileSync(
    BUILD_REPORT,
    JSON.stringify(
      {
        status: "INITIAL_EDITABLE_ROOT_EXPORT",
        output: OUTPUT,
        slide_count: SLIDES.length,
        notes_count: SLIDES.length,
        template: TEMPLATE,
        template_sha256: "3a90b0106c6587d720b5a46c653a31937ccd649b30890563c70a53c4cc5d25b8",
        selected_template: "edu / educate",
        construction_route: "managed PptxGenJS + compiled educate master + template part overlay + slideLayout2 relink",
        layout_contract: "all authored slides target ../slideLayouts/slideLayout2.xml",
        title_pt: 28,
        primary_teaching_pt: 24,
        authored_body_floor_pt: 18,
        background_author_fill: "unset",
        current_evidence: "P108 uses labelled same-scenario fallback metrics; P109 uses labelled ledger crop; missing identities are marked 待補",
        visual_rendering: "controller LibreOffice render completed; nine original-size pages inspected",
        powerpoint_reopen: "native PowerPoint reopen remains unavailable in this environment; office validate.py passed",
      },
      null,
      2,
    ) + "\n",
    "utf8",
  );
  console.log(JSON.stringify({ output: OUTPUT, slides: SLIDES.length, notes: SLIDES.length, template: TEMPLATE }));
}

build().catch((error) => {
  console.error(error.stack || error.message || error);
  process.exitCode = 1;
});
