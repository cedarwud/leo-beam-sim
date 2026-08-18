"use strict";

const fs = require("node:fs");
const path = require("node:path");
const pptxgen = require("pptxgenjs");
const MASTER = fs.existsSync("/home/u24/pptx-wrap/assets/templates/educate.master.cjs")
  ? "/home/u24/pptx-wrap/assets/templates/educate.master.cjs"
  : "/home/sat/pptx-wrap/assets/templates/educate.master.cjs";
const { registerEducateTemplate } = require(MASTER);

const LOCAL_ALT_ROOT = "/home/u24/demo/leo-beam-sim/courseware/c120-lora-leo-deck/alt-skill-deck";
const SERVER_ALT_ROOT = "/home/sat/leo-beam-sim/courseware/c120-lora-leo-deck/alt-skill-deck";
const ALT_ROOT = fs.existsSync(LOCAL_ALT_ROOT) ? LOCAL_ALT_ROOT : SERVER_ALT_ROOT;
const OWNED = path.join(ALT_ROOT, "part-c-v2-p081-p097");
const FILENAME = "LoRaEnergySim-LEO-ALT-PART-C-V2-P081-P097-REVIEW.pptx";
const STAGE_ROOT = process.env.C120_STAGE_ROOT
  ? path.resolve(process.env.C120_STAGE_ROOT)
  : path.join(ALT_ROOT, "latest");
const OUTPUT = process.env.C120_OUTPUT
  ? path.resolve(process.env.C120_OUTPUT)
  : path.join(STAGE_ROOT, FILENAME);
const EVIDENCE = path.join(ALT_ROOT, "current-evidence/course-20260811/.playwright-cli");
const METRICS = path.join(EVIDENCE, "element-2026-08-11T03-06-45-152Z.png");
const REPLAY = path.join(EVIDENCE, "element-2026-08-11T03-06-47-569Z.png");
const LEDGER = path.join(EVIDENCE, "element-2026-08-11T03-06-50-920Z.png");

const CJK = "標楷體";
const LATIN = "Times New Roman";
const NAVY = "25356B";
const INK = "25324A";
const MUTED = "65758B";
const BLUE = "4967C2";
const BLUE_PALE = "ECF1FE";
const TEAL = "007374";
const TEAL_PALE = "E8F7F4";
const PURPLE = "660066";
const PURPLE_PALE = "F4EDF7";
const GOLD = "846826";
const GOLD_PALE = "FDF9E2";
const RED = "992A2A";
const RED_PALE = "FDEFEF";
const LINE = "D7DEEA";
const WHITE = "FFFFFF";

const PAGES = [
  { page: "P081", title: "Transfer：智慧農場的 gate-first 讀法", kind: "farm", notes: "智慧農場把 LEO 的 changing-service-window trace 映射成閘道可用時段。queue age 來自排隊事件，單位是 elapsed time；它用來判讀批次等待與資料新鮮度。urgent margin 來自 policy constant，單位是秒；它決定告警何時取得優先送出機會。service gate 讀取 required delivery 與 freshness，endpoint J 只描述宣告的端點邊界。農場現場 KPI 待補，這裡保存的是可檢驗的 transfer hypothesis。" },
  { page: "P082", title: "Transfer：HVAC 的 deadline 與批次", kind: "hvac", notes: "HVAC 的低負載或可連線時段可作為 changing-service-window trace。normal telemetry 進入 queue 後可以等待 batch flush；urgent alarm 以 deadline 與 freshness 取得較早的 SEND_URGENT 機會。endpoint ledger 分解 awake idle、wake、process、TX、RX 與 sleep，單位是 J；service gate 先描述告警完成與 freshness，再描述能量取捨。HVAC 現場資料待補，畫面只保留機制映射。" },
  { page: "P083", title: "Transfer：edge inference 的 freshness gate", kind: "edge", notes: "edge device 的 observation 讀取 queue、deadline、quality 與可用窗口，來源是 endpoint trace。policy action 是 enum，作用是選擇 WAIT、SLEEP、SEND_URGENT 或 FLUSH_BATCH。event ledger 以 state、packet 與 service event 連接 action 與 endpoint J；J 的單位是焦耳，只屬於宣告的 endpoint scope。轉移假說必須保留一個 held-out condition，例如窗口縮短或 traffic 增加，作為可推翻條件。" },
  { page: "P084", title: "Transfer exit：把因果句帶回 workbook", kind: "exit", notes: "離開 Lab C 時保存的是可重跑、可回放、可比較的 policy hypothesis。workbook record 連結 condition、policy branch、event evidence、service gate、endpoint scope 與 claim boundary；每個欄位的來源與 identity 都要保留。transfer 的現場能量與服務 KPI 待補，不能把模擬結果外推成 live measurement。若需要 fresh run，先保存目前 lineage，再依核准流程建立新的 record。" },
  { page: "P085", title: "/course：來源與匯入 gate", kind: "source", notes: "current browser session 的 identifier-free metrics crop 可用來讀取 endpoint summary；source header crop 目前待補，因此來源身份以文字 record 明示。actual upload 與 same-scenario fallback 分開保存，case、role、service 與 source 是比較前的 identity 欄位。匯入 gate 讀取 schema、scenario identity、units、policy lineage 與 provenance；通過後才更新 replay 與 workbook。fallback 只作同情境教學資料，不能改寫本機 runner receipt。" },
  { page: "P086", title: "/course：service-first summary", kind: "summary", notes: "這張 identifier-free metrics crop 目前顯示 service FAIL、endpoint energy 6.92 J、delivered data 4800 bit 與 endpoint bit/J 693.641618。服務欄位來自 accepted endpoint teaching record，FAIL 是 gate verdict；delivered data 的單位是 bit，描述資料完成量；endpoint energy 的單位是 J，描述端點邊界累積能量；bit/J 是 efficiency ratio。閱讀順序是 service、delivery、endpoint J、bit/J，因此較高的效率數字不能改寫服務失敗。" },
  { page: "P087", title: "/course：frame selector 與八欄 replay", kind: "fields", notes: "identifier-free replay-frame crop 顯示 endpoint frame selector 與八個欄位。Radio 來自 endpoint state ledger，值是 state enum；Action 來自 policy API，值是 action enum；queue count 來自 frame queue，單位是 packet count；累積 endpoint energy 來自 endpoint ledger，單位是 J。Elapsed 來自 endpoint trace，單位是時間；Contact ID 是 contact trace 的字串識別碼；Contact 是 contact event 的開啟或關閉狀態；Quality 來自 runner quality trace，是 ordinal quality_band 分類，不換算成 dB。" },
  { page: "P088", title: "/course：queue 與 packet event", kind: "queue", notes: "queue item 來自目前 endpoint frame，描述仍待處理的工作；packet event 來自 event ledger，描述該 frame 的事件類型與 identity。current clean crop 沒有包含 queue/event 區塊，因此該 panel 標示待補，事件讀法以可編輯 trace 呈現。沿生成、入列、attempt、retry、delivered 或 expired 的順序回到 service 與 deadline。queue 變空只是狀態變化，delivery 必須由 delivered event 或相應 service record 支持。" },
  { page: "P089", title: "/course：timeline 對回 policy branch", kind: "timeline", notes: "radio/contact timeline 的來源是 endpoint frame sequence；它用 elapsed、contact、quality、radio state 與 action 排列 transition。timeline 的格子描述事件順序，不描述連續功率。每個 transition 對回 student_policy.py 的 contact、urgent、pacing、batch 或 wait branch；Action 顯示當前 policy decision，Radio 顯示 state interval。current timeline crop 待補，畫面以可編輯 transition strip 與 branch map 保存判讀方法。" },
  { page: "P090", title: "/course：ledger 與 strategy gate", kind: "ledger", notes: "identifier-free ledger crop 顯示 experiment/case、display、role、service、endpoint energy J 與 source 六欄。experiment/case 來自 workbook record，role 是 baseline、candidate、revision 或 withheld 的分類；display 只表示目前選取狀態。service 是 gate verdict，endpoint energy 的單位是 J，source 區分 browser record 與 same-scenario fallback。公平比較要核對這些欄位與 run identity，best strategy 由 matched source 與 service gate 定義。" },
  { page: "P091", title: "/course：provider／endpoint 證據邊界", kind: "provider", notes: "provider layer 的來源是 LEO scenario context，欄位包括 TLE source、provider time、contact status、cell、frequency 與 dB；它說明 service opportunity。endpoint layer 的來源是 imported result.json 與 endpoint-replay.json，欄位包括 source、run identity、summary、replay、ledger 與 endpoint scope。兩層各自保留 frame identity 與 provenance；provider context 不會重新計算 endpoint result，endpoint J 也不升格為 system 或 canonical energy。" },
  { page: "P092", title: "/course：Workbook controls 的保存與重開", kind: "controls", notes: "workbook controls 的作用是保存與重開 evidence chain。建立 checkpoint 讀取 prediction、result/replay lineage、source 與 role，寫入可恢復狀態；restore 讀取已保存 checkpoint，成功後更新目前 record。reset/undo 讀寫 browser-local progress；export/reopen 讀寫 workbook lineage 與檔案狀態。驗證失敗時原 workbook 與 progress 維持；0/10 是完成段落計數，不是 service、J 或 bit/J。" },
  { page: "P093", title: "/course：rejection 與 recovery", kind: "recovery", notes: "rejection gate 依序處理 format/schema、identity/lineage 與 immutable duplicate。每個 gate 的來源是 import validator，失敗時原 session、workbook 與既有 record 保持。recovery 只回 matching artifact、release backup 或明示 same-scenario fallback，並保存 recovery note 與新的 result_path。current rejection screenshot 待補；畫面使用可編輯 fork 表達狀態邊界，不手改 JSON、不替換 case identity。" },
  { page: "P094", title: "Prepare：READY 與 terminal receipt", kind: "ready", notes: "READY control 讀取 terminal 的 machine-readable receipt，寫入 browser-local setup status；成功後顯示已就緒，失敗時原 status 保持。記錄備用環境讀取 fallback choice，寫入 browser-local source。terminal runner 負責 setup、verify、run 與 result artifact；browser route 負責記錄狀態與匯入。current Prepare crop 待補，這裡以 editable state split 說明控制項的 read/write boundary。" },
  { page: "P095", title: "導覽與 fallback loader", kind: "nav", notes: "導覽控制讀取 navigation state，寫入 focus、language 或 route。直接前往操作區與返回首頁只改 focus；繁中/EN 只改畫面語言；準備、實驗 A/B/C、證據與學習單只切換工作台。fallback loader 讀取 experiment order，寫入 selected fallback；成功後更新 selected source，identity 不符時原 result 保持。current navigation crop 待補，畫面用 editable navigation map 說明責任邊界。" },
  { page: "P096", title: "Task lock 與證據按鈕", kind: "tasks", notes: "task controls 讀取目前段落 evidence，寫入 completion 與 lock。Task 1–10 的勾選表示保存完成；檢查證據並繼續檢查該段要求，成功後保存並解鎖下一段；證據已鎖定顯示保存狀態。條件不足時原 task、原 evidence 與原 workbook 保持。current task-control crop 待補，editable staircase 保留可見的段落狀態與控制語義。" },
  { page: "P097", title: "Provider replay：兩層 frame 識別", kind: "providerControls", notes: "provider replay controls 讀取 provider frame sequence，寫入 playback cursor；播放、暫停、slider、上一畫面與下一個畫面只改 provider cursor。endpoint selector 讀取 endpoint frame sequence，寫入 selected frame，成功後更新八個欄位、queue 與 event。兩層 frame identity 各自保存；provider frame 移動不會自動改寫 endpoint Action。current provider control crop 待補，identifier-free endpoint frame crop 用來示範獨立 selector。" },
];

const FIELD_RE = /(`[^`]+`|[A-Za-z][A-Za-z0-9_.\/-]*|\d+(?:\.\d+)?)/g;
const ITALIC_FIELDS = /^(?:SLEEP|WAIT|SEND_URGENT|FLUSH_BATCH|SEND_ONE|REST_DURING_GAP|BATCH_SIZE|URGENT_MARGIN_S|PACE_GAP_STEPS|student_policy\.py|result\.json|endpoint-replay\.json|result_path|Radio|Action|Quality|Contact|ContactID|Contact|J|bit\/J|READY|replay|queue|service|deadline|freshness|endpoint|provider|workbook|scenario|case|role|source|identity|frame|ordinal)$/i;

function rich(value, opts = {}) {
  if (typeof value !== "string") return value;
  const out = [];
  let cursor = 0;
  for (const match of value.matchAll(FIELD_RE)) {
    const start = match.index;
    if (start > cursor) out.push({ text: value.slice(cursor, start), options: { fontFace: CJK, bold: opts.bold || false } });
    const raw = match[0];
    const marked = raw.startsWith("`");
    const clean = marked ? raw.slice(1, -1) : raw;
    const latin = /^[A-Za-z0-9]/.test(clean);
    out.push({ text: clean, options: { fontFace: latin ? LATIN : CJK, bold: opts.bold || false, italic: marked || ITALIC_FIELDS.test(clean) } });
    cursor = start + raw.length;
  }
  if (cursor < value.length) out.push({ text: value.slice(cursor), options: { fontFace: CJK, bold: opts.bold || false } });
  return out.length ? out : [{ text: value, options: { fontFace: CJK, bold: opts.bold || false } }];
}

function addText(slide, value, x, y, w, h, options = {}) {
  const requestedFontSize = options.fontSize || 24;
  // Keep the donor's 24 pt reading rhythm for leads and roomy body copy,
  // while making compact field strips legible instead of relying on an
  // unbounded auto-shrink. The shared contract permits 16 pt for field/code
  // labels; titles and leads opt out below.
  let fontSize = requestedFontSize;
  if (!options.noCompact && requestedFontSize <= 24) {
    if (h <= 0.30) fontSize = Math.min(requestedFontSize, 16);
    else if (h <= 0.36) fontSize = Math.min(requestedFontSize, 18);
    else if (h <= 0.46) fontSize = Math.min(requestedFontSize, 20);
  }
  const textOptions = {
    x, y, w, h,
    fontFace: CJK,
    fontSize,
    color: options.color || INK,
    bold: options.bold || false,
    italic: options.italic || false,
    align: options.align || "left",
    valign: options.valign || "mid",
    margin: options.margin === undefined ? 0.05 : options.margin,
    breakLine: false,
    fit: options.fit || "shrink",
    paraSpaceAfterPt: 0,
    lineSpacingMultiple: options.lineSpacingMultiple || 1.0,
  };
  slide.addText(rich(value, options), textOptions);
}

function box(slide, x, y, w, h, fill, line = LINE, options = {}) {
  const shapeType = options.round === false ? pptxShape("rect") : pptxShape("roundRect");
  const opts = {
    x, y, w, h,
    fill: { color: fill, transparency: options.transparency || 0 },
    line: line ? { color: line, width: options.lineWidth || 1.2 } : { color: fill, transparency: 100 },
    radius: options.radius,
  };
  const shape = options.slide.addShape(shapeType, opts);
  if (options.name) shape.name = options.name;
  return shape;
}

let pptxRef;
function pptxShape(name) {
  return pptxRef.ShapeType[name];
}

function panel(slide, x, y, w, h, fill, line, heading, body, options = {}) {
  box(slide, x, y, w, h, fill, line, { slide, name: options.name || "Editable panel", round: options.round !== false });
  if (heading) addText(slide, heading, x + 0.16, y + 0.12, w - 0.32, options.headingH || 0.36, { color: line || NAVY, bold: true, align: options.align || "left", fontSize: 24 });
  if (body) addText(slide, body, x + 0.16, y + (options.bodyY || 0.60), w - 0.32, h - (options.bodyY || 0.60) - 0.12, { color: options.bodyColor || INK, align: options.align || "left", fontSize: options.bodySize || 24, valign: options.valign || "top" });
}

function line(slide, x, y, w, h, color = NAVY, width = 1.6) {
  const shape = slide.addShape(pptxShape("line"), { x, y, w, h, line: { color, width } });
  shape.name = "Editable mechanism connector";
  return shape;
}

function dot(slide, x, y, d, fill) {
  const shape = slide.addShape(pptxShape("ellipse"), { x, y, w: d, h: d, fill: { color: fill }, line: { color: fill } });
  shape.name = "Editable event marker";
  return shape;
}

function chevron(slide, x, y, color = BLUE) {
  const shape = slide.addShape(pptxShape("chevron"), { x, y, w: 0.42, h: 0.48, fill: { color }, line: { color, transparency: 100 } });
  shape.name = "Editable causal arrow";
  return shape;
}

function title(slide, page, value) {
  addText(slide, `${page}｜${value}`, 0.718057, 0.204514, 10.34861, 0.525, { fontSize: 28, color: "35377F", bold: true, margin: 0, valign: "mid", fit: "shrink", noCompact: true });
}

function lead(slide, value, color = NAVY) {
  addText(slide, value, 0.90, 1.02, 11.55, 0.48, { fontSize: 24, color, bold: true, align: "center", valign: "mid", noCompact: true });
}

function caption(slide, value, x, y, w, color = MUTED) {
  addText(slide, value, x, y, w, 0.42, { fontSize: 24, color, align: "center", valign: "mid" });
}

function image(slide, file, x, y, w, h, label) {
  slide.addImage({ path: file, x, y, w, h, altText: label });
  const edge = slide.addShape(pptxShape("rect"), { x, y, w, h, fill: { color: WHITE, transparency: 100 }, line: { color: LINE, width: 1.0 } });
  edge.name = `Identifier-free evidence crop: ${label}`;
}

function sourceTag(slide, value, x, y, w, color = TEAL, fill = TEAL_PALE) {
  box(slide, x, y, w, 0.46, fill, color, { slide, round: true, name: "Evidence source label" });
  addText(slide, value, x + 0.08, y + 0.04, w - 0.16, 0.34, { fontSize: 24, color, bold: true, align: "center", valign: "mid" });
}

function placeholder(slide, value, x, y, w, h, color = MUTED) {
  box(slide, x, y, w, h, "F7F8FC", LINE, { slide, round: false, name: "Current evidence placeholder" });
  addText(slide, value, x + 0.16, y + 0.12, w - 0.32, h - 0.24, { fontSize: 24, color, bold: true, align: "center", valign: "mid" });
}

function fieldRow(slide, x, y, w, label, body, color = BLUE, fill = BLUE_PALE) {
  box(slide, x, y, w, 0.78, fill, color, { slide, name: `Field ${label}` });
  addText(slide, label, x + 0.14, y + 0.10, w * 0.35, 0.52, { fontSize: 24, color, bold: true, valign: "mid" });
  addText(slide, body, x + w * 0.36, y + 0.10, w * 0.60, 0.52, { fontSize: 24, color: INK, valign: "mid" });
}

function lane(slide, x, y, w, h, head, body, color, fill) {
  box(slide, x, y, w, h, fill, color, { slide, name: `Causal lane ${head}` });
  addText(slide, `${head}：${body}`, x + 0.14, y + 0.12, w - 0.28, h - 0.24, { fontSize: 24, color: INK, bold: true, align: "center", valign: "mid" });
}

function addFarm(slide) {
  lead(slide, "changing-service-window trace → 閘道可用時段；service gate 先讀，endpoint J 後讀");
  const items = [
    ["資料等待 queue age", "來源：queue event；單位：時間；作用：判讀批次等待", BLUE, BLUE_PALE],
    ["批次大小 BATCH_SIZE", "來源：policy constant；單位：packet count；作用：決定 flush", GOLD, GOLD_PALE],
    ["告警門檻 urgent margin", "來源：policy；單位：秒；作用：決定優先送出時機", PURPLE, PURPLE_PALE],
    ["服務閘門 service gate", "來源：result；單位：verdict；作用：核對 delivery + freshness", TEAL, TEAL_PALE],
  ];
  items.forEach(([h, b, c, f], i) => lane(slide, 0.90, 1.72 + i * 0.84, 3.70, 0.68, h, b, c, f));
  box(slide, 5.18, 1.62, 7.25, 2.34, "F7F8FC", LINE, { slide, name: "Farm gateway availability trace", round: false });
  addText(slide, "閘道可用時段的 transfer map", 5.46, 1.80, 6.68, 0.38, { fontSize: 24, color: NAVY, bold: true, align: "center" });
  const segs = [
    ["資料排隊", 1.34, BLUE], ["閘道關閉", 1.16, "CBD5E1"], ["告警可用", 1.24, PURPLE], ["批次上傳", 1.36, TEAL],
  ];
  let cursor = 5.48;
  segs.forEach(([label, width, color], i) => {
    box(slide, cursor, 2.48, width, 0.62, color, color, { slide, round: false, name: `Farm window segment ${i + 1}` });
    addText(slide, label, cursor + 0.03, 2.57, width - 0.06, 0.34, { fontSize: 24, color: color === "CBD5E1" ? INK : WHITE, bold: true, align: "center" });
    if (i < segs.length - 1) chevron(slide, cursor + width + 0.08, 2.55, NAVY);
    cursor += width + 0.58;
  });
  addText(slide, "灌溉告警：期限接近 → SEND_URGENT；一般資料：queue → batch → flush", 5.48, 3.28, 6.62, 0.40, { fontSize: 24, color: INK, align: "center" });
  panel(slide, 5.18, 4.30, 7.25, 1.18, RED_PALE, RED, "可推翻條件 Falsifier", "告警 freshness 過期時，service gate 失敗；較低 endpoint J 不足以保留成功判定。", { name: "Farm transfer falsifier", bodyY: 0.55, align: "left" });
  sourceTag(slide, "Transfer hypothesis｜farm field KPI 待補", 2.42, 5.88, 8.48, PURPLE, PURPLE_PALE);
}

function addHvac(slide) {
  lead(slide, "HVAC 的低負載時段可批次；設備告警的 deadline 需要更早取得 action 機會");
  box(slide, 0.90, 1.62, 11.54, 1.16, "F7F8FC", LINE, { slide, name: "HVAC cycle trace", round: false });
  addText(slide, "HVAC cycle：低負載／可連線窗口", 1.16, 1.80, 3.38, 0.36, { fontSize: 24, color: NAVY, bold: true });
  const segments = [["高負載", 1.40, "CBD5E1"], ["低負載", 1.42, TEAL], ["品質穩定 quality stable", 1.78, BLUE], ["告警窗口", 1.48, PURPLE]];
  let x = 4.64;
  segments.forEach(([label, width, color], i) => {
    box(slide, x, 1.88, width, 0.52, color, color, { slide, round: false, name: `HVAC trace segment ${i + 1}` });
    addText(slide, label, x + 0.03, 1.94, width - 0.06, 0.30, { fontSize: 24, color: color === "CBD5E1" ? INK : WHITE, bold: true, align: "center" });
    x += width + 0.08;
  });
  lane(slide, 0.90, 3.16, 5.44, 1.60, "一般遙測 normal telemetry", "queue → batch → flush\n作用：減少啟用次數；判讀：queue age 與 freshness", BLUE, BLUE_PALE);
  lane(slide, 6.70, 3.16, 5.74, 1.60, "急件告警 urgent alarm", "deadline 接近 → SEND_URGENT\n作用：保住告警服務；判讀：delivery 與 deadline", PURPLE, PURPLE_PALE);
  panel(slide, 0.90, 5.02, 11.54, 0.98, TEAL_PALE, TEAL, "端點能量帳本 endpoint ledger", "來源：endpoint model；單位：J；欄位：awake idle、wake、process、TX、RX、sleep。", { name: "HVAC endpoint ledger", bodyY: 0.53, align: "center" });
  sourceTag(slide, "Transfer mechanism only｜HVAC measured KPI 待補", 2.32, 6.10, 8.70, TEAL, TEAL_PALE);
}

function addEdge(slide) {
  lead(slide, "可移植因果句：observation → policy action → event ledger → service gate → endpoint J");
  const nodes = [
    ["觀測 Observation", "來源：endpoint trace；欄位：queue、deadline、quality、window", BLUE, BLUE_PALE],
    ["策略動作 Policy action", "來源：policy API；值：enum；作用：選擇 action", GOLD, GOLD_PALE],
    ["事件帳本 Event ledger", "來源：replay；欄位：state、packet、retry、delivery", PURPLE, PURPLE_PALE],
    ["服務閘門 Service gate", "來源：result；值：verdict；作用：核對 freshness", TEAL, TEAL_PALE],
    ["端點能量 Endpoint J", "來源：endpoint model；單位：J；作用：累積 scope 能量", RED, RED_PALE],
  ];
  let x = 0.78;
  nodes.forEach(([h, b, c, f], i) => {
    panel(slide, x, 1.84, 2.18, 1.42, f, c, h, b, { name: `Edge causal node ${i + 1}`, bodyY: 0.62, align: "center" });
    if (i < nodes.length - 1) chevron(slide, x + 2.26, 2.32, c);
    x += 2.49;
  });
  panel(slide, 0.90, 3.72, 5.42, 1.50, BLUE_PALE, BLUE, "可轉移場景", "邊緣影像摘要：一般摘要可 batch；安全告警走 urgent。\n物流追蹤：位置卡可等待連線窗口。", { name: "Edge transfer examples", bodyY: 0.58, align: "left" });
  panel(slide, 6.70, 3.72, 5.74, 1.50, GOLD_PALE, GOLD, "可推翻條件", "窗口縮短、traffic 增加或 deadline 提前時，重新檢驗較大 urgent margin 的 service gate。", { name: "Edge transfer falsifier", bodyY: 0.58, align: "left" });
  caption(slide, "transfer 數值待補；保留 condition、action、event 與 gate 的可檢驗關係", 1.05, 5.76, 11.22, PURPLE);
}

function addExit(slide) {
  lead(slide, "離場保存：假說、lineage、falsifier；現場 KPI 仍以 evidence gate 定義");
  const cards = [
    [0.90, "可移植假說 hypothesis", "urgent margin 會改變 service／endpoint energy trade-off。", BLUE, BLUE_PALE],
    [4.42, "工作簿 lineage", "baseline／candidate\nrevision／surprise\n保留 result／replay identity。", TEAL, TEAL_PALE],
    [7.94, "可推翻條件 falsifier", "窗口、traffic 或 deadline 改變時，service gate 重新裁決。", PURPLE, PURPLE_PALE],
  ];
  cards.forEach(([x, h, b, c, f]) => panel(slide, x, 1.80, 3.10, 1.72, f, c, h, b, { name: `Exit ${h}`, bodyY: 0.64, bodySize: 20, align: "center" }));
  line(slide, 2.40, 4.22, 7.84, 0, NAVY, 2.4);
  [2.40, 6.28, 10.16].forEach((x, i) => { dot(slide, x, 4.12, 0.20, [BLUE, TEAL, PURPLE][i]); });
  addText(slide, "prediction", 1.82, 4.42, 1.42, 0.34, { fontSize: 24, color: BLUE, bold: true, align: "center" });
  addText(slide, "result／replay", 5.34, 4.42, 1.90, 0.34, { fontSize: 24, color: TEAL, bold: true, align: "center" });
  addText(slide, "interpretation", 9.36, 4.42, 1.82, 0.34, { fontSize: 24, color: PURPLE, bold: true, align: "center" });
  panel(slide, 1.10, 5.08, 11.08, 0.94, RED_PALE, RED, "主張邊界 claim boundary", "coherent simulated result；live field measurement 與 canonical/system energy 待補。", { name: "Exit claim boundary", bodyY: 0.53, align: "center" });
}

function addSource(slide) {
  lead(slide, "source、case、identity、import state：匯入前後分開保存");
  sourceTag(slide, "current metrics crop｜source 待補", 0.96, 1.48, 5.54, TEAL, TEAL_PALE);
  image(slide, METRICS, 0.96, 2.02, 5.54, 0.38, "identifier-free A metrics crop");
  panel(slide, 0.96, 2.82, 5.54, 1.30, BLUE_PALE, BLUE, "browser record", "可讀取 summary；source header 的 current identifier-free crop 待補。", { name: "Current browser record", bodyY: 0.56, align: "center" });
  sourceTag(slide, "fallback source｜明示備用", 6.86, 1.48, 5.42, PURPLE, PURPLE_PALE);
  panel(slide, 6.86, 2.02, 5.42, 2.10, PURPLE_PALE, PURPLE, "同情境備用資料 fallback record", "Lab C／surprise\n來源：same-scenario fallback\n用途：練習 replay 與 claim boundary", { name: "Same scenario fallback", bodyY: 0.62, align: "center" });
  box(slide, 3.82, 4.46, 5.70, 0.72, GOLD_PALE, GOLD, { slide, name: "Import identity gate" });
  addText(slide, "來源 source＋案例 case＋角色 role＋服務 service → 匯入狀態 import state", 4.00, 4.62, 5.34, 0.36, { fontSize: 24, color: GOLD, bold: true, align: "center" });
  line(slide, 3.72, 4.12, 1.40, 0.30, BLUE, 1.8);
  line(slide, 8.16, 4.12, 1.40, 0.30, PURPLE, 1.8);
  caption(slide, "匯入通過後才更新 replay 與 workbook；來源缺件保持待補", 1.16, 5.72, 11.00, NAVY);
}

function addSummary(slide) {
  lead(slide, "service → delivered data → endpoint J → endpoint bit/J");
  image(slide, METRICS, 0.90, 1.52, 6.10, 0.42, "identifier-free A metrics crop");
  sourceTag(slide, "current metrics crop", 1.82, 2.30, 4.26, TEAL, TEAL_PALE);
  const steps = [
    ["服務 gate", "FAIL", RED, RED_PALE],
    ["已送達資料", "4800 bit", BLUE, BLUE_PALE],
    ["端點能量", "6.92 J", TEAL, TEAL_PALE],
    ["端點 bit/J", "693.641618", GOLD, GOLD_PALE],
  ];
  steps.forEach(([h, b, c, f], i) => {
    const y = 1.48 + i * 0.98;
    box(slide, 7.54, y, 4.70, 0.78, f, c, { slide, name: `Service-first step ${i + 1}` });
    addText(slide, h, 7.76, y + 0.12, 2.24, 0.48, { fontSize: 24, color: c, bold: true });
    addText(slide, b, 10.12, y + 0.12, 1.82, 0.48, { fontSize: 24, color: INK, bold: true, align: "right" });
    if (i < steps.length - 1) chevron(slide, 9.62, y + 0.84, c);
  });
  panel(slide, 0.90, 3.22, 6.10, 1.66, RED_PALE, RED, "第一判讀", "FAIL 先界定服務邊界；4800 bit 描述完成量。\nJ 與 bit/J 的意義在 gate 之後說明。", { name: "Summary gate explanation", bodyY: 0.60, align: "left" });
  panel(slide, 0.90, 5.04, 11.34, 1.00, GOLD_PALE, GOLD, "欄位契約 field contract", "來源：accepted endpoint teaching record｜單位：bit、J、bit/J｜解釋：效率數字描述 run，不改寫 FAIL。", { name: "Summary field contract", bodyY: 0.54, align: "center" });
}

function addFields(slide) {
  lead(slide, "同一個 endpoint frame：八個欄位共同定義事件脈絡");
  image(slide, REPLAY, 0.90, 1.48, 8.02, 1.76, "identifier-free replay frame crop");
  sourceTag(slide, "current replay crop", 9.28, 1.50, 3.02, TEAL, TEAL_PALE);
  panel(slide, 9.28, 2.12, 3.02, 1.12, GOLD_PALE, GOLD, "Frame selector 選擇器", "1 / 56 · 0s\n成功切 frame；欄位同步更新。", { name: "Frame selector", bodyY: 0.54, align: "center" });
  const fields = [
    ["Radio 無線電", "state enum｜endpoint ledger", BLUE, BLUE_PALE],
    ["Action 動作", "enum｜policy API", GOLD, GOLD_PALE],
    ["queue count 佇列數", "packet count｜frame queue", PURPLE, PURPLE_PALE],
    ["累積 endpoint J", "J｜endpoint ledger", TEAL, TEAL_PALE],
    ["Elapsed 經過時間", "時間｜endpoint trace", BLUE, BLUE_PALE],
    ["Contact ID 接觸識別碼", "identifier｜contact trace", GOLD, GOLD_PALE],
    ["Contact 接觸狀態", "開啟／關閉｜contact event", PURPLE, PURPLE_PALE],
    ["Quality 連線品質", "ordinal band｜runner trace", TEAL, TEAL_PALE],
  ];
  fields.forEach(([h, b, c, f], i) => {
    const col = i % 4;
    const row = Math.floor(i / 4);
    const x = 0.90 + col * 3.03;
    const y = 3.62 + row * 1.15;
    box(slide, x, y, 2.82, 0.92, f, c, { slide, name: `Replay field ${i + 1}` });
    addText(slide, h, x + 0.10, y + 0.10, 2.62, 0.32, { fontSize: 24, color: c, bold: true, align: "center" });
    addText(slide, b, x + 0.10, y + 0.47, 2.62, 0.28, { fontSize: 24, color: INK, align: "center" });
  });
}

function addQueue(slide) {
  lead(slide, "queue 告訴當下仍有什麼工作；packet event 才確認結果如何形成");
  image(slide, REPLAY, 0.90, 1.48, 5.46, 1.18, "identifier-free replay frame crop");
  sourceTag(slide, "current frame crop｜queue/event panel 待補", 1.18, 2.78, 4.90, TEAL, TEAL_PALE);
  panel(slide, 6.80, 1.48, 2.46, 1.18, BLUE_PALE, BLUE, "目前佇列", "normal-1\nqueue item；packet count", { name: "Queue anchor", bodyY: 0.56, align: "center" });
  panel(slide, 9.58, 1.48, 2.46, 1.18, PURPLE_PALE, PURPLE, "目前事件", "evt-0000\nevent identity；frame anchor", { name: "Packet event anchor", bodyY: 0.56, align: "center" });
  const steps = ["生成／入列", "嘗試 attempt", "重試／碰撞 retry／collision", "已送達 delivered", "過期／服務 expired／service"];
  let x = 0.90;
  steps.forEach((s, i) => {
    const color = [BLUE, GOLD, PURPLE, TEAL, RED][i];
    const fill = [BLUE_PALE, GOLD_PALE, PURPLE_PALE, TEAL_PALE, RED_PALE][i];
    box(slide, x, 3.72, 2.12, 0.78, fill, color, { slide, name: `Packet event step ${i + 1}` });
    addText(slide, s, x + 0.08, 3.94, 1.96, 0.32, { fontSize: 24, color, bold: true, align: "center" });
    if (i < steps.length - 1) chevron(slide, x + 2.18, 3.88, color);
    x += 2.43;
  });
  panel(slide, 1.08, 5.04, 11.08, 1.00, GOLD_PALE, GOLD, "判讀", "queue 變空是狀態變化；delivered 或 expired event 才能支持 service／deadline 結果。", { name: "Queue interpretation", bodyY: 0.54, align: "center" });
}

function addTimeline(slide) {
  lead(slide, "timeline 描述 transition；policy branch 說明 action 為何出現");
  placeholder(slide, "待補：current radio／contact timeline crop", 0.90, 1.46, 4.54, 1.18);
  box(slide, 5.78, 1.46, 6.66, 1.18, "F7F8FC", LINE, { slide, name: "Editable current timeline", round: false });
  addText(slide, "可編輯 transition strip", 6.02, 1.62, 2.52, 0.32, { fontSize: 24, color: NAVY, bold: true });
  const segs = [["關閉", 0.72, "CBD5E1"], ["開啟", 0.72, TEAL], ["品質穩定 quality stable", 0.86, BLUE], ["喚醒 AWAKE", 0.92, GOLD]];
  let x = 8.74;
  segs.forEach(([label, width, color]) => { box(slide, x, 1.82, width, 0.48, color, color, { slide, round: false, name: `Timeline segment ${label}` }); addText(slide, label, x + 0.02, 1.90, width - 0.04, 0.28, { fontSize: 24, color: color === "CBD5E1" ? INK : WHITE, bold: true, align: "center" }); x += width + 0.05; });
  sourceTag(slide, "來源：endpoint frame + policy｜單位：bool、秒、packet count", 3.76, 2.72, 6.98, NAVY, "F7F8FC");
  const rows = [
    ["窗口關閉 contact_open", "休眠 SLEEP", "窗口布林為 false → 安全 state", BLUE, BLUE_PALE],
    ["急件待送 urgent pending + due", "緊急送出 SEND_URGENT", "due 是剩餘秒數；期限條件優先", PURPLE, PURPLE_PALE],
    ["節奏間隔 pacing gap", "間隔休息 REST_DURING_GAP", "steps_since_send 仍在 gap", GOLD, GOLD_PALE],
    ["品質就緒 + queue", "批次送出 FLUSH_BATCH", "queue count 達到 batch size", TEAL, TEAL_PALE],
    ["其他觀測 observation", "等待 WAIT／單筆送出 SEND_ONE", "queue count 決定一般 action", RED, RED_PALE],
  ];
  rows.forEach(([cond, act, body, c, f], i) => {
    const y = 3.24 + i * 0.60;
    box(slide, 0.90, y, 3.44, 0.50, f, c, { slide, name: `Policy condition ${i + 1}` });
    addText(slide, cond, 1.02, y + 0.10, 3.20, 0.28, { fontSize: 24, color: c, bold: true, align: "center" });
    chevron(slide, 4.52, y + 0.02, c);
    box(slide, 5.12, y, 2.54, 0.50, f, c, { slide, name: `Policy action ${i + 1}` });
    addText(slide, act, 5.24, y + 0.10, 2.30, 0.28, { fontSize: 24, color: c, bold: true, align: "center" });
    addText(slide, body, 7.96, y + 0.10, 4.30, 0.28, { fontSize: 24, color: INK });
  });
  caption(slide, "current timeline crop 待補；transition strip 只表達事件順序，不表達連續功率", 1.04, 6.18, 11.18, MUTED);
}

function addLedger(slide) {
  lead(slide, "execution ledger：目前選取是 display state；strategy verdict 由 gate 與 matched source 定義");
  image(slide, LEDGER, 0.90, 1.48, 8.08, 0.66, "identifier-free execution ledger crop");
  sourceTag(slide, "current ledger crop", 9.28, 1.56, 2.98, TEAL, TEAL_PALE);
  const cols = [
    ["實驗／案例 experiment／case", "A / baseline", BLUE, BLUE_PALE],
    ["目前顯示 display", "目前", GOLD, GOLD_PALE],
    ["角色 role", "基準", PURPLE, PURPLE_PALE],
    ["服務 service", "FAIL gate", RED, RED_PALE],
    ["端點能量 endpoint J", "6.92 J", TEAL, TEAL_PALE],
    ["來源 source", "同情境備用 same-scenario fallback", NAVY, "F2F3F8"],
  ];
  cols.forEach(([h, b, c, f], i) => {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const x = 0.90 + col * 3.82;
    const y = 2.62 + row * 1.02;
    box(slide, x, y, 3.54, 0.82, f, c, { slide, name: `Ledger interpretation ${i + 1}` });
    addText(slide, h, x + 0.12, y + 0.10, 3.30, 0.28, { fontSize: 24, color: c, bold: true, align: "center" });
    addText(slide, b, x + 0.12, y + 0.46, 3.30, 0.24, { fontSize: 24, color: INK, align: "center" });
  });
  panel(slide, 0.90, 4.92, 11.34, 1.12, GOLD_PALE, GOLD, "公平比較", "核對 experiment、case、role、service、source 與 run identity；目前列的 selected 狀態不直接定義最佳策略。", { name: "Ledger fairness rule", bodyY: 0.54, align: "center" });
}

function addProvider(slide) {
  lead(slide, "provider 說明 opportunity；endpoint result 說明 imported artifact；兩層 evidence 各自保留 identity");
  placeholder(slide, "待補：current provider context crop\nLEO scenario／TLE／contact／cell／frequency／dB", 0.90, 1.52, 5.42, 2.24);
  panel(slide, 0.90, 4.02, 5.42, 1.26, BLUE_PALE, BLUE, "provider 層", "來源：LEO scenario context\n作用：描述 service opportunity", { name: "Provider evidence layer", bodyY: 0.58, align: "center" });
  image(slide, REPLAY, 6.70, 1.52, 5.54, 1.22, "identifier-free endpoint replay crop");
  sourceTag(slide, "current endpoint crop", 8.10, 2.88, 2.72, TEAL, TEAL_PALE);
  panel(slide, 6.70, 3.58, 5.54, 1.70, TEAL_PALE, TEAL, "endpoint 層", "來源：result.json + endpoint-replay.json\n作用：summary、replay、ledger、endpoint scope", { name: "Endpoint evidence layer", bodyY: 0.60, align: "center" });
  panel(slide, 1.24, 5.38, 10.58, 0.92, RED_PALE, RED, "證據邊界 boundary", "provider frame 與 endpoint frame 各自核對；system／canonical energy claim 待補。", { name: "Provider endpoint boundary", bodyY: 0.50, align: "center" });
}

function addControls(slide) {
  lead(slide, "Workbook controls：保存 prediction、result／replay lineage、source 與恢復狀態");
  placeholder(slide, "待補：current Workbook controls crop", 0.90, 1.48, 4.36, 2.16);
  const controls = [
    ["建立 checkpoint", "讀 prediction／lineage\n寫可恢復狀態", BLUE, BLUE_PALE],
    ["恢復 restore", "讀 checkpoint\n更新目前 record", TEAL, TEAL_PALE],
    ["重設／復原 reset／undo", "讀 local progress\n寫 reset state", PURPLE, PURPLE_PALE],
    ["匯出／重開 export／reopen", "讀 workbook lineage\n更新檔案狀態", GOLD, GOLD_PALE],
  ];
  controls.forEach(([h, b, c, f], i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    panel(slide, 5.64 + col * 3.42, 1.48 + row * 1.20, 3.10, 0.98, f, c, h, b, { name: `Workbook control ${h}`, bodyY: 0.52, align: "center" });
  });
  panel(slide, 5.64, 3.98, 6.52, 1.10, RED_PALE, RED, "驗證失敗", "原 workbook 與 local progress 保持；0/10 是完成段落計數。", { name: "Workbook failure state", bodyY: 0.54, align: "center" });
  line(slide, 3.72, 4.94, 1.38, 0, NAVY, 2.0);
  panel(slide, 0.90, 4.74, 4.36, 1.14, GOLD_PALE, GOLD, "完成度 gate", "service、result、replay、interpretation 齊全後，才可記錄 COMPLETE。", { name: "Workbook completion gate", bodyY: 0.54, align: "center" });
}

function addRecovery(slide) {
  lead(slide, "fail closed：既有 session 不被改寫；recovery 回到 matching evidence");
  const rejects = [
    ["格式 format／schema", "檔案結構或欄位不合約", BLUE, BLUE_PALE],
    ["身份 identity／lineage", "scenario、case 或 policy 不匹配", PURPLE, PURPLE_PALE],
    ["不可變重複 immutable duplicate", "同一 session 重複匯入", RED, RED_PALE],
  ];
  rejects.forEach(([h, b, c, f], i) => panel(slide, 0.90 + i * 2.64, 1.56, 2.34, 1.18, f, c, h, b, { name: `Rejection ${h}`, bodyY: 0.56, align: "center" }));
  line(slide, 1.98, 2.86, 4.84, 0.52, NAVY, 1.8);
  box(slide, 5.10, 3.22, 3.02, 0.78, RED_PALE, RED, { slide, name: "Fail closed gate" });
  addText(slide, "原 session／workbook 保持", 5.28, 3.44, 2.66, 0.30, { fontSize: 24, color: RED, bold: true, align: "center" });
  line(slide, 6.60, 4.02, 0, 0.46, NAVY, 1.8);
  const recoveries = [
    ["匹配產物 matching artifact", "保留原始 error + path", BLUE, BLUE_PALE],
    ["發行備份 release backup", "回到最後已知正確 block", TEAL, TEAL_PALE],
    ["同情境備用 same-scenario fallback", "明示 source；保存 recovery note", PURPLE, PURPLE_PALE],
  ];
  recoveries.forEach(([h, b, c, f], i) => panel(slide, 0.90 + i * 4.00, 4.72, 3.60, 1.10, f, c, h, b, { name: `Recovery ${h}`, bodyY: 0.54, align: "center" }));
  sourceTag(slide, "current rejection crop 待補", 4.58, 2.68, 4.18, GOLD, GOLD_PALE);
}

function addReady(slide) {
  lead(slide, "READY 是 terminal receipt 的 browser-local record；runner artifact 另由 import gate 定義");
  placeholder(slide, "待補：current Prepare crop\nmachine-readable READY receipt", 0.90, 1.50, 4.38, 2.12);
  panel(slide, 5.70, 1.50, 3.04, 1.66, TEAL_PALE, TEAL, "記錄 READY", "讀 terminal receipt\n寫 browser-local status\n成功：顯示已就緒", { name: "READY control", bodyY: 0.56, align: "center" });
  panel(slide, 9.28, 1.50, 3.04, 1.66, GOLD_PALE, GOLD, "記錄備用環境", "讀 fallback choice\n寫 browser-local source\n成功：顯示備用路徑", { name: "Fallback control", bodyY: 0.56, align: "center" });
  box(slide, 0.90, 4.08, 11.42, 1.06, BLUE_PALE, BLUE, { slide, name: "Terminal browser boundary", round: false });
  addText(slide, "terminal runner：setup／verify／run／result artifact", 1.22, 4.28, 4.90, 0.32, { fontSize: 24, color: BLUE, bold: true, align: "center" });
  chevron(slide, 6.38, 4.20, BLUE);
  addText(slide, "browser route：READY／source record／import", 6.94, 4.28, 4.92, 0.32, { fontSize: 24, color: TEAL, bold: true, align: "center" });
  panel(slide, 2.06, 5.30, 9.14, 0.96, RED_PALE, RED, "證據邊界 boundary", "READY 記錄狀態；runner receipt 定義 setup、run 與 artifact。", { name: "READY boundary", bodyY: 0.48, align: "center" });
}

function addNav(slide) {
  lead(slide, "導覽、語言、工作台與 fallback loader：按鈕改變 focus 或 source selection");
  const groups = [
    ["焦點 focus", "直接前往操作區\n返回 Leo 首頁", BLUE, BLUE_PALE],
    ["語言 language", "繁中／EN\n只切換畫面語言", GOLD, GOLD_PALE],
    ["工作台 route", "準備／實驗 A／B／C\n證據／學習單", TEAL, TEAL_PALE],
    ["紀錄 record", "證據／學習單\n保留 workbook focus", PURPLE, PURPLE_PALE],
  ];
  groups.forEach(([h, b, c, f], i) => panel(slide, 0.90 + i * 3.00, 1.52, 2.62, 1.28, f, c, h, b, { name: `Navigation group ${h}`, bodyY: 0.56, align: "center" }));
  line(slide, 1.44, 3.34, 9.62, 0, NAVY, 2.0);
  dot(slide, 1.34, 3.24, 0.20, BLUE); dot(slide, 10.96, 3.24, 0.20, PURPLE);
  panel(slide, 0.90, 3.76, 5.12, 1.46, PURPLE_PALE, PURPLE, "fallback loader", "讀 experiment order\n寫 selected fallback\n成功：更新 source；identity 不符：原 result 保持", { name: "Fallback loader", bodyY: 0.56, align: "center" });
  panel(slide, 6.56, 3.76, 5.68, 1.46, BLUE_PALE, BLUE, "責任邊界", "切頁或切語言只改畫面 state；identity、service、upload 仍依各自 gate 讀取。", { name: "Navigation boundary", bodyY: 0.56, align: "center" });
  sourceTag(slide, "current navigation crop 待補｜editable navigation map", 2.72, 5.76, 7.86, MUTED, "F7F8FC");
}

function addTasks(slide) {
  lead(slide, "task lock 只保存課程段落；runner、replay 與 service gate 各自維持責任");
  const steps = [["Task 1–3", BLUE, BLUE_PALE], ["Task 4–6", TEAL, TEAL_PALE], ["Task 7–10", PURPLE, PURPLE_PALE]];
  steps.forEach(([h, c, f], i) => {
    const x = 0.96 + i * 1.62;
    const y = 4.08 - i * 0.72;
    box(slide, x, y, 1.46, 0.72, f, c, { slide, name: `Task staircase ${h}` });
    addText(slide, h, x + 0.08, y + 0.20, 1.30, 0.28, { fontSize: 24, color: c, bold: true, align: "center" });
  });
  panel(slide, 6.02, 1.54, 2.94, 1.42, BLUE_PALE, BLUE, "檢查證據並繼續", "讀目前段落 evidence\n成功：保存並解鎖下一段", { name: "Continue evidence control", bodyY: 0.58, align: "center" });
  panel(slide, 9.40, 1.54, 2.94, 1.42, GOLD_PALE, GOLD, "證據已鎖定", "讀完成 record\n成功：顯示保存狀態", { name: "Evidence locked control", bodyY: 0.58, align: "center" });
  panel(slide, 4.02, 3.34, 8.32, 1.14, TEAL_PALE, TEAL, "Task 1–10", "✓ 表示 completion record；service、deadline、result、replay 與 interpretation 仍依 evidence chain 判讀。", { name: "Task status rule", bodyY: 0.54, align: "center" });
  panel(slide, 0.90, 5.08, 11.44, 1.02, RED_PALE, RED, "current task-control crop 待補", "editable staircase 只保留段落狀態與控制語義。", { name: "Task crop placeholder", bodyY: 0.50, align: "center" });
}

function addProviderControls(slide) {
  lead(slide, "provider replay 與 endpoint replay 各自移動，各自保留 frame identity");
  placeholder(slide, "待補：current provider control crop", 0.90, 1.48, 4.28, 1.10);
  const controls = [
    ["播放結果", "provider cursor\n播放 frame sequence", TEAL, TEAL_PALE],
    ["暫停重播", "provider cursor\n停留目前 frame", PURPLE, PURPLE_PALE],
    ["滑桿 slider", "選 provider frame\n寫 playback cursor", BLUE, BLUE_PALE],
    ["←／下一個畫面 →", "移動一個 provider frame", GOLD, GOLD_PALE],
  ];
  controls.forEach(([h, b, c, f], i) => panel(slide, 5.52 + (i % 2) * 3.42, 1.48 + Math.floor(i / 2) * 1.04, 3.08, 0.90, f, c, h, b, { name: `Provider control ${h}`, bodyY: 0.50, align: "center" }));
  image(slide, REPLAY, 0.90, 3.56, 6.18, 1.34, "identifier-free endpoint replay crop");
  sourceTag(slide, "endpoint selector 端點選擇器｜current crop", 1.68, 5.02, 4.62, TEAL, TEAL_PALE);
  box(slide, 7.54, 3.56, 4.70, 1.34, GOLD_PALE, GOLD, { slide, name: "Two replay timelines", round: false });
  addText(slide, "provider timeline", 7.82, 3.80, 4.14, 0.30, { fontSize: 24, color: GOLD, bold: true, align: "center" });
  line(slide, 8.02, 4.24, 3.60, 0, GOLD, 2.2);
  addText(slide, "endpoint timeline：獨立 frame identity", 7.80, 4.56, 4.16, 0.30, { fontSize: 24, color: TEAL, bold: true, align: "center" });
  panel(slide, 7.54, 5.10, 4.70, 1.02, RED_PALE, RED, "判讀", "provider frame 移動不自動改寫 endpoint Action。", { name: "Replay identity rule", bodyY: 0.50, align: "center" });
}

function buildPage(slide, page) {
  title(slide, page.page, page.title);
  switch (page.kind) {
    case "farm": addFarm(slide); break;
    case "hvac": addHvac(slide); break;
    case "edge": addEdge(slide); break;
    case "exit": addExit(slide); break;
    case "source": addSource(slide); break;
    case "summary": addSummary(slide); break;
    case "fields": addFields(slide); break;
    case "queue": addQueue(slide); break;
    case "timeline": addTimeline(slide); break;
    case "ledger": addLedger(slide); break;
    case "provider": addProvider(slide); break;
    case "controls": addControls(slide); break;
    case "recovery": addRecovery(slide); break;
    case "ready": addReady(slide); break;
    case "nav": addNav(slide); break;
    case "tasks": addTasks(slide); break;
    case "providerControls": addProviderControls(slide); break;
    default: throw new Error(`unknown page kind ${page.kind}`);
  }
  slide.addNotes(page.notes);
}

function writeSources() {
  fs.mkdirSync(OWNED, { recursive: true });
  fs.writeFileSync(path.join(OWNED, "slides.json"), JSON.stringify({
    schema: "c120-part-c-v2-p081-p097",
    template: "/home/sat/pptx-wrap/assets/templates/educate.pptx",
    template_shell: "source slide 2 / slideLayout2.xml only",
    font_contract: { cjk: CJK, latin: LATIN, title_pt: 28, preferred_body_pt: 24, compact_field_minimum_pt: 16 },
    evidence: {
      clean_crops: [METRICS, REPLAY, LEDGER],
      missing_panels_marked: ["source header", "queue/event", "timeline", "provider", "workbook", "rejection", "Prepare", "navigation", "task", "provider controls"],
    },
    slides: PAGES.map((p, index) => ({ order: index + 1, source_page: p.page, title: p.title, kind: p.kind, notes: p.notes, layout: "slideLayout2.xml" })),
  }, null, 2) + "\n", "utf8");
  fs.writeFileSync(path.join(OWNED, "speaker-notes.md"), PAGES.map((p) => `## ${p.page}｜${p.title}\n\n${p.notes}`).join("\n\n") + "\n", "utf8");
}

async function main() {
  const pptx = new pptxgen();
  pptxRef = pptx;
  registerEducateTemplate(pptx);
  pptx.author = "C-120 Part C V2 writer";
  pptx.company = "C-120 courseware";
  pptx.subject = "LoRaEnergySim + LEO Part C P081-P097";
  pptx.title = "LoRaEnergySim-LEO-ALT-PART-C-V2-P081-P097-REVIEW";
  pptx.lang = "zh-TW";
  pptx.theme = { headFontFace: CJK, bodyFontFace: CJK, lang: "zh-TW" };
  for (const page of PAGES) {
    const slide = pptx.addSlide({ masterName: "PPTX_WRAP_EDUCATE_CONTENT" });
    buildPage(slide, page);
  }
  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  await pptx.writeFile({ fileName: OUTPUT });
  writeSources();
  console.log(JSON.stringify({ output: OUTPUT, slides: PAGES.length, stage: "full-editable-export", sources: OWNED }, null, 2));
}

main().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
