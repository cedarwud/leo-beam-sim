# 教學課程重置交接 — 2026-08-24

> **Status: CONTROLLER-RECOMMENDED; OWNER ACCEPTANCE PENDING**
>
> 本文件是 fresh controller session 的接手入口與決策提案，不是 Accepted ADR，
> 也不表示任何舊 agent／worker 可以原地續跑。未取得下列 owner gates 前，不得把
> controller 建議寫成產品定案。

## 0. Fresh session 先讀什麼、先驗什麼

目前 source order 固定為：

1. `docs/decisions/ADR-005-tle-and-canonical-ee-simulator-contract.md`
2. `docs/sdd/TLE-CANONICAL-EE-SIMULATOR-SDD.md`
3. `docs/handoff/TEACHING-CURRICULUM-RESET-HANDOFF-2026-08-24.md`（本文件）

ADR-005 明定一個 canonical angle-aware EE state graph、同一個 actual power 與
immutable frame；節能政策、savings KPI、Phase-1 platform 欄位與上傳仍未決
（ADR-005:18-30, 89-163, 178-191）。SDD 同樣明載「不定義節能政策或平台上傳」，
且頁面只能投影共享 frame、不得自有科學公式
（`TLE-CANONICAL-EE-SIMULATOR-SDD.md`:9-18, 40-105）。

Fresh controller 不得採信「前一個 session 已完成／已接受」；先重跑：

```bash
pwd
git branch --show-current
git status --short --branch
git diff --stat
git diff --check
ss -ltnp
ps -ef | rg 'codex exec|vite|node_modules/.bin/vite'
git diff --numstat HEAD -- src/prototype/scientific-explain
git diff --unified=3 HEAD -- src/main.tsx
```

## 1. Owner 明確修正與 controller 職責

- **Visual-first**：場景、事件與可見後果是主體；文字只在需要時短暫支援，不得退化成
  dashboard、card wall 或長篇閱讀頁。
- **目前文字太小**：通過 16 px accessibility floor 不等於適合教室投影／教學錄影。
- **必須有語意學習**：漂亮運鏡、DOM、字幕與 transport 都不是 lesson；學生必須
  預測、操作、看到後果、說明因果，並完成 transfer check。
- **legacy locator 不得被覆寫**：`/prototype/scientific-explain-legacy-3d` 是 owner 指定的
  視覺 reference；新學生課程必須走另一條 path／preset。
- **Port 邊界**：只使用 root 已控制的 `http://127.0.0.1:3000`；不得開第二個 Vite、
  preview 或任意替代 port。`8071` 是 protected service，永不停止、重啟或佔用。
- **Controller role**：controller 持有 route topology、產品取捨、writer ownership、
  owner acceptance、commit/push scope；worker 只做互斥的 bounded lane，不自行擴 scope。

## 2. Current-checkout 課程裁決

「authored duration」是 director clock；mandatory learner pause 只會拉長 wall time，
不能拿來替既有 12–35 分鐘宣稱補數。現況沒有任何 `ACCEPT LESSON`。

| Current route | Honest authored duration | Registry claim | Current verdict | 缺口摘要 |
|---|---:|---:|---|---|
| `/prototype/global-constellation` | 78 s + reveal gate | 12–15 min | `ACCEPT MICRO-CLIP ONLY` | 一次 reveal，無真 prediction／transfer |
| `/course/tle-journey` | 40 s | 20–25 min | `ACCEPT MICRO-CLIP ONLY` | pause 後 controls 有價值，但主線無 prediction／transfer |
| Golden `?act=3` | 36 s + guided gate | 15–20 min | `ACCEPT MICRO-CLIP ONLY` | drag 有後果，但 pointer-down 即算 prediction |
| Golden `?act=4` | 48 s | 22–25 min | `ACCEPT MICRO-CLIP ONLY` | source-backed 因果片段，沒有 learner action |
| bare `/prototype/visual-first-golden-flow` | 84 s | none | `REJECT` as lesson | 混合 counterfactual off-axis 與 source-backed handover |
| `/prototype/scientific-explain-legacy-3d`（current） | 75 s + steering gate | none | `REJECT` | legacy 原址被換版、10–16 px 關鍵字、route-local formula |
| `/prototype/intra-handover-teaching` | 78 s | none | `ACCEPT MICRO-CLIP ONLY` | 有選擇但 autoplay 不 gate；transfer 只是直接寫答案 |
| `/course/energy-lab` | 84 s + prediction/checkpoint pause | 30–35 min | `ACCEPT MICRO-CLIP ONLY` | 最接近 learning loop，但操作是選 fixture sample，無 transfer |

分鐘宣稱見 `src/course/nav/sixActsRoutes.ts:31-80`；實際 clocks 見
`globalConstellationDirector.ts:172-246`、`tleJourneyClock.ts:3-18`、
`goldenFlowDirector.ts:366-724`、`scientificExplain3DDirector.ts:94-229`、
`intraHandoverTeachingDirector.ts:1-93`、`energyLabDirector.ts:10-16,78-86`。

## 3. VERIFIED：legacy 3D 是原址覆寫

2026-08-24 current checkout 的可重驗證據：

- `git diff --numstat HEAD -- src/prototype/scientific-explain`：
  `ScientificExplain3DPrototype.tsx` 為 **466 additions / 440 deletions**；SCSS 為
  **795 / 432**。
- HEAD TSX blob 是 `fffed201663242e848d93db2b54fbd986aee1e5a`；current worktree
  blob 是 `620e210e0d6b74c860b4a53569092253323b4455`。
- `ScientificExplain3DScene.tsx`、Inspector、director、test 是新增 untracked files。
- `src/main.tsx:44,178-185` 仍把原 locator import 到同一
  `ScientificExplain3DPrototype`；route 沒搬家，因此是 in-place overwrite。

HEAD 的滿版舞台、左 INPUT／右 OUTPUT、底部因果鏈、能量粒子與場景內標籤應恢復為
**frozen developer visual reference**；但 HEAD 的舊 `gamma_req`／需求功率反推／demo cap
也不是現行科學權威，不能原封不動升格成教學真值。

Current route-local `exp(-0.18 * theta^2)` 位於
`scientificExplain3DDirector.ts:336-350`，且 UI 在
`ScientificExplain3DPrototype.tsx:206-218` 把它呈現成公式。它不得作為 teaching truth；
學生版必須讀 canonical producer 的 `G_T(theta)` 與同一 immutable frame。

## 4. Controller 收到的 Opus Max 共識與 reconciliation

下列是 controller 供應的 advisory Opus Max consensus，不是 ADR／owner acceptance：

- off-axis 與 handover 必須拆成兩課，共用 renderer 可以，共用因果故事不可以；
- bare Golden 只留 developer/regression 用途；
- active time 必須包含 prediction、learner action、causal explanation、transfer，不能用
  被動片長或講師自行補話估算；
- 以 **75 分鐘**作為候選 learning spine；
- 第一條真正垂直切片是 **8–10 分鐘 off-axis lesson**。

Controller reconciliation：採 owner／Sol 較嚴格的教室字級 floor，不採 Opus 較小的
mobile 數字；Global 與 TLE 因媒介不同保留獨立 route，但 current versions 仍只是
micro-clips。其餘學生課在同一 simulator 心智模型內以清楚分離的 path／preset 呈現。

## 5. 建議 75-minute learning spine

| Order | Lesson | Target active time | 必須留下的學習證據 |
|---:|---|---:|---|
| 1 | Global | 8 min | 預測 local visibility；區分數量、高度、當下可見 |
| 2 | TLE | 10 min | 改壞 checksum、調時間、解釋 TLE→SGP4→pass |
| 3 | Off-axis | 10 min | 先答再 steer；區分 camera、elevation、beam axis |
| 4 | Intra | 8 min | 預測 beam choice；說出 satellite ID 不變、beam ID 改變 |
| 5 | Inter | 15 min | 讀 candidate／offset／TTT／commit；解釋為何此時換給此 target |
| 6 | Energy | 18 min | 預測、操控、觀察 service collapse、以 ratio-of-sums defend 結論 |
| 7 | Evidence／Platform | 6 min | 選欄位與 sampling cadence，核對 provenance／receipt |
|  | **Total** | **75 min** | 不是 current authored clips 的加總 |

順序固定為：

`Global -> TLE -> Off-axis -> Intra -> Inter -> Energy -> Evidence/Platform`

Formal platform upload 仍由 ADR-005／SDD 明列未決；owner 接受新 ADR 前，只能做明確標示的
`OFFLINE MOCK`、local export 或 provenance receipt，不得宣稱 upload、persistence、live
platform result 或 energy saving。

## 6. 第一條 8–10 分鐘 off-axis vertical slice

核心問題：**「只移動波束中軸，仰角會變嗎？」**

| Beat | Expected active time | Learner／scene contract |
|---|---:|---|
| 1. Establish | 0:45 | 同框顯示 satellite、UE、beam axis、ground tangent；不先講答案 |
| 2. Observe vertices | 1:00 | 學生指出 elevation 與 off-axis 的不同頂點／射線 |
| 3. Prediction gate | 1:00–1:30 | 選「只變 theta／只變 elevation／兩者／皆不變」；未答永不前進 |
| 4. One controlled action | 1:15 | 凍結 time、satellite、UE、elevation，只允許一次 beam-axis steer |
| 5. Visible consequence | 1:00 | before/after 同框：elevation 不變，theta 與 canonical link result 改變 |
| 6. Causal explanation | 1:30 | 沿共享 frame 顯示 `theta -> G_T(theta) -> ...`；頁面不重算公式 |
| 7. Transfer gate | 1:00–1:30 | 新視角問「camera rotate 與 beam steer，哪一個改變 theta？」；必須作答 |
| 8. Restore receipt／bridge | 0:45 | 證明 teaching counterfactual 未寫入 replay／handover，再銜接 intra |

目標 active time 約 **8:15–9:15**；prediction／transfer 永遠是 mandatory gate，若學生需要
更久，wall time 可以超過 10 分鐘，但 UI 要分開標示 authored clock 與 facilitated time。

## 7. Exact acceptance gates

### Learning／science

- O→P→A→C→E→T 六段皆有可見、可重建的 learner evidence；缺任何一段即非 lesson。
- Prediction 必須儲存具體答案，不得以 pointer-down、seek 或播放按鍵代替。
- Controlled action 期間只有 beam axis 可變；time、satellite、UE、elevation 與 source
  replay identity 必須固定，restore equality fail-closed。
- 所有科學值來自 canonical producer 的同一 frame；route-local formula、獨立 actual power、
  inferred savings 或 platform claims 一律阻擋。
- Transfer 使用未看過的視角／情境並要求學生作答；顯示正解不算 transfer check。

### Typography／composition

- 1920×1080：主問題／字幕 **>=32 px**；作答必要公式與數值 **>=26 px**；
  action／identity labels **>=22 px**；provenance **>=18 px**。
- 390×844 與 320×720：主問題 **>=28 px**；字幕 **>=22 px**；
  action／數值 **>=20 px**；metadata **>=16 px**。
- Primary learner actions 至少 48×48 CSS px；shared transport 不得低於其既有 44×44 contract。
- Caption 最多兩行、每行最多 32 個全形字；5% title-safe；不得與 transport 重疊。
- 每拍最多一個 primary cue、一個字幕帶與 transport；中央因果物件至少占畫面寬 60%、
  高 55%，overlay 不得遮蔽核心物件超過 5%。
- 正文 contrast >=4.5:1；大字 >=3:1；caption dwell 至少
  `max(4 s, 0.20 s * CJK 字數)`；後果穩定至少 6 s。
- Controller 必須檢查 1920×1080、390×844、320×720 pixels、keyboard、reduced motion、
  no overflow／no clipping；綠測試不取代 owner visual acceptance。

## 8. Route decision proposal（待 owner gate）

1. 恢復 `/prototype/scientific-explain-legacy-3d` 為 frozen developer visual reference；
   保留其構圖，不把舊 demo math 當 authority。
2. 新增獨立學生 off-axis path（建議 `/course/off-axis-lab`），接 canonical producer；
   current route-local exponential formula 不得進學生真值。
3. 保留 bare `/prototype/visual-first-golden-flow` 作 dev/regression compositor，從學生 nav 移除。
4. 學生 Act 3／Act 4 必須是分開的 route／preset；共用 scene/renderer/director primitives，
   但中間必須有 transfer 與 restore receipt，不能暗示 off-axis drag 造成 handover。
5. Global／TLE 仍是不同媒介的獨立 routes；current micro-clips 可作 renderer/director donor，
   不得沿用虛高分鐘宣稱。

## 9. Current worktree／writer／port state

2026-08-24 本 handoff 落檔前重驗：

- branch：`feat/six-acts-p0-vertical-slice`；large dirty WIP，含多個 modified／untracked
  course、scene、review、validator paths。全部視為 owner/controller WIP。
- root-controlled Vite 監聽 `0.0.0.0:3000`，當時 PID `594437`；PID 會漂移，fresh session
  必須用 `ss`／`ps` 重驗，不得據此 kill 或另開 server。
- `8071` 由 protected docker proxy 持有；不得觸碰。
- Luna transport-speed worker：controller session `89809`，當時 process PID `614635`；
  唯一 ownership 是 `src/course/transport/*` 下列五個可能檔案：
  `teachingAnimationTransportModel.ts`、`TeachingAnimationTransport.tsx`、
  `TeachingAnimationTransport.scss`、`teachingAnimationTransport.test.ts`、必要時 `index.ts`。
  它正加入 `0.5x/1x/1.5x/2x/3x/4x/8x`，且不得啟動 server。
- 未觀察到其他 `codex exec` writer；controller 回報其餘 external writers 已停止。這是
  當時快照，不是 fresh session 可直接採信的 ownership lock。

## 10. Fresh-session takeover checklist

- [ ] 依 §0 讀 authority，確認本文件仍是最新 handoff。
- [ ] `git status --short --branch`、`git diff --stat`、exact-path diffs；不要只看 HEAD。
- [ ] `ss -ltnp` 重驗 3000／8071；不得開新 port。
- [ ] `ps -ef` 與 controller session 狀態重驗所有 writers。
- [ ] Luna `89809` 若仍 active，先 wait 或由 root/controller 正常停止；重疊
  `src/course/transport/*` 前必須取得 idle/completed 證據。
- [ ] 不得 `reset`、`stash`、`clean`、restore unrelated paths 或覆蓋 dirty WIP。
- [ ] 不得 broad `git add`／commit；只在 owner 明確授權後 stage exact paths。
- [ ] 不得把舊 review、green gate、tmux／worker 啟動當成 current result。

## 11. Earliest safe implementation order與 owner gates

1. **先收 Luna transport lane**：wait、讀其 exact diff、focused tests、`git diff --check`；
   controller 不得順手改 route/director。
2. **OWNER GATE A — curriculum／route topology**：owner 接受或修改 75-minute spine、
   legacy restore、新 student off-axis path、Golden dev-only／student split。未接受即停止。
3. **Legacy-reference slice**：只恢復 frozen visual reference，不接舊 math；exact-path review。
4. **Off-axis P0 vertical slice**：新 path、canonical producer、§6 beats、§7 gates；不得碰
   handover／Energy／Platform。
5. **CONTROLLER SCIENCE GATE**：同 frame、formula ownership、restore equality、truth labels、
   focused tests 全部通過。
6. **OWNER GATE B — browser pixels／teaching**：owner 在 desktop＋mobile 看完整 8–10 分鐘
   lesson，確認 visual-first、字級與學習 loop；未接受不得擴下一課。
7. 依序做 Intra → Inter → Energy；每課各自通過 semantic＋pixel gate。
8. **OWNER GATE C — Platform ADR**：formal upload、欄位、auth、persistence、回讀與 savings
   claims 必須另有 accepted ADR；之前只做 labelled offline mock/provenance。
9. **OWNER GATE D — commit/push scope**：controller 提 exact file list；無明示不得 commit/push。

## 12. Paste-ready fresh controller prompt

```text
你是 /home/u24/demo/leo-beam-sim 的 fresh root controller。不要聲稱恢復任何舊 agent
或 session。先依序完整讀：
1) docs/decisions/ADR-005-tle-and-canonical-ee-simulator-contract.md
2) docs/sdd/TLE-CANONICAL-EE-SIMULATOR-SDD.md
3) docs/handoff/TEACHING-CURRICULUM-RESET-HANDOFF-2026-08-24.md

先做唯讀 preflight：pwd、branch、git status/diff、git diff --check、ss listeners、ps writers、
legacy scientific HEAD/current diff。保留整個 large dirty WIP；不得 reset/stash/clean、不得
restore unrelated paths、不得 broad stage/commit/push。只使用 root 已存在的 port 3000；不得
啟動 Vite/preview/第二個 port；8071 protected，絕不觸碰。

重驗 Luna transport worker session 89809。若仍 active，wait 或由 root 正常停止；在它完成
前不得重疊 src/course/transport/*。不要假設 PID、worker 或舊 gate 仍有效。

本 handoff 狀態是 CONTROLLER-RECOMMENDED; OWNER ACCEPTANCE PENDING，不是 Accepted ADR。
先向 owner 提一個短 decision packet，要求明確選擇：
A) 是否接受 75-minute spine 與 Global -> TLE -> Off-axis -> Intra -> Inter -> Energy ->
   Evidence/Platform；
B) 是否接受恢復 legacy path 為 frozen developer reference、另建 canonical student off-axis
   path、bare Golden dev-only、student Act 3/4 分開；
C) 是否接受第一條 8–10 minute off-axis slice 與嚴格 typography/composition gates。

沒有 owner 的 A/B/C 明確接受，停在 decision packet，不實作。若 owner 已明確接受，才依
handoff §11 的順序 dispatch 一個 bounded non-heavy worker；第一個 implementation scope 只准
legacy-reference slice 或 off-axis P0 其中一個，先做 ownership preflight，禁止碰 handover、
Energy、Platform。formal platform upload 仍卡 ADR-005/SDD owner gate，只能 labelled offline
mock/provenance。每個 worker 結果由 controller 重新讀 diff、跑 focused gates、看 browser
pixels，再交 owner visual acceptance；tests green 不能代替 lesson acceptance。
```
