# 交接：教學動畫（統一殼＋自動運鏡）— 2026-08-22

**給下一個開發 session。** 本文件是唯一起點：先讀完這份，再讀
`docs/frontend-change-contract.md`（強制），然後從「第一片」開工。
不要重讀六幕提案舊文與歷史對話——那裡有已被推翻的多路由做法。

---

## 0. 一句話的最終架構裁定（使用者拍板，推翻先前做法）

**一個首頁模擬器殼、全是開關、原地無縫切換，不換頁。**

- 側邊欄顯示什麼＝可切（工程面板 ⇄ 教學面板）
- 場景中央地板＝可切：抽象黑盤（legacy-3d 風格）⇄ NTPU 實景；**相機、衛星、燈光不動**
- 教學疊層（θ 弧、能量粒子、字幕條、候選標籤、換手 cinema）＝獨立開關
- 「幕」＝開關組合的 **preset**，不是 route
- 邊界規則：**同一個心智模型不換頁；換媒介才換頁。** TLE 之旅（讀文件）與全球星座（不同相機域）暫留獨立頁。

品質標竿是 `/prototype/scientific-explain-legacy-3d`（使用者明確喜歡）：
滿版 3D 舞台、左輸入右輸出、底部 θ→G^T→p→R→EE 即時因果鏈、能量粒子、場景內 Html 標籤。

## 1. 要做的東西：換手教學動畫（球賽慢動作重播＋戰術解說）

核心體驗：按播放，系統在做決定的那一刻自己慢下來、鏡頭自己推近，
把「看到什麼、比較了什麼、為什麼選這顆」逐句講出來。
**每句字幕都由引擎當下的真值驅動（狀態機），不是錄好的旁白稿。**

### 八拍分鏡（含自動運鏡）

| 拍 | 速度 | 鏡頭（駕既有 cinema） | 畫面 | 字幕條要旨 |
|---|---|---|---|---|
| ① 服務中 | ×1 | 廣角建立，緩慢環繞 | 服務衛星波束照 UE；衛星旁標籤：仰角/SINR（活值） | 連線正常，但它正在西沉 |
| ② 品質下滑 | ×1 | 緩推向服務衛星，UE 保持入鏡 | 因果鏈逐環點亮：仰角↓→距離↑→損耗↑→SINR↓；底部 SINR 曲線帶開始畫 | 衛星沒壞，是幾何在變 |
| ③ 候選出現 | ×1 | 拉高拉遠，露出天空候選群 | 所有候選亮標籤：SINR/仰角/剩餘可見秒 | 有 N 顆可接手，系統怎麼選 |
| ④ 淘汰賽 | **×0.25** | 服務＋最佳候選雙星同框 | 逐顆判定：「+1.2 dB＜3 dB」翻紅變暗；「只剩 40 s 可見」翻黃（觀察，非規則）；「+3.4 dB ✓」翻綠 | 規則一：好過門檻 3 dB，防乒乓 |
| ⑤ TTT 倒數 | ×0.25 | 特寫候選＋倒數環 | 30 s 環按 `handoverTriggerProgressSec` 實值填滿；曲線帶畫 3 dB 陰影帶 | 規則二：優勢要撐滿 30 秒 |
| ⑥ 執行 | 極慢→定格一拍 | 既有換手 cinema 鏡位 | 舊波束熄成虛線、新波束點燃、跳線閃光 | 換手執行，中斷 X ms，不是免費的 |
| ⑦ 收據 | ×0.25→×1 | 平移到 UE／事件軌 | 收據浮出：ΔSINR、中斷、本場第幾次；記上 HandoverEventRail | 代價換到什麼 |
| ⑧ 新常態 | ×1 | restore 交還使用者 OrbitControls | 數字回穩 | 新衛星也在西沉，這件事每幾分鐘重演 |

同框架換素材＝另外兩課：**intra**（波束地毯掃過 UE，同星換 beam）、
**被迫接替**（⑤的環永遠填不滿、服務衛星先落地——對應 43,943 這個數）。

### 誠實規則（不可違反）

- 字幕狀態機只讀引擎值；引擎沒有的因果不得寫成因果。
- 「剩餘可見時間」**不在**引擎換手規則內（規則只有 SINR argmax＋offset＋TTT＋guard）
  → 只能標成觀察；正確教法是之後的「你來選」互動。
- 常數要帶出處徽章（`taughtConstants.ts` 已建）：−5 dB 是 ENGINE-OPERATING 不是論文值；
  3 dB/30 s 是 STUDY-POLICY；1.65 W 是 PAPER。
- 禁用已刪符號（γ_req、v_max、V_b、k_cap、\widetilde）——`deletedSymbols.test.ts` 會擋。
- **畫面用字＝學術語域**（使用者明確要求，尚未全面完成）：不用「押注/猜猜看/爛衛星」
  這類口語；問答式互動（開場猜數量、押注三選一）已刪，不要加回來。

## 2. 引擎既有資產（本 session 逐一驗證過，直接用，不要重造）

| 需求 | 已存在的實作 |
|---|---|
| 地板無縫切換 | `src/scene/BaseSceneLayout.tsx` 的 **`campusVisible`** prop：presentation-only mount gate，相機/控制/燈光保持活著。抽象教學地板以 children 掛入 |
| 自動運鏡 | `src/app/useHandoverCinema.ts`（focus/restore 生命週期）、`src/scene/directorFocusPose.ts`、`cinematicEffects.ts`（spotlight/fog）、`camera.directorPhase`、`CinematicSeekFadeOverlay`；reduced-motion：`readPrefersReducedMotion` |
| 慢動作 | 首頁 auto-slow（HO Slow 檔位、`playback.autoSlowEnabled/Active/Applied`） |
| 決策真值 | `SimFrame`：`pendingTargetSatId/pendingTargetSinrDb/handoverTriggerProgressSec/lastHoEvent{from,to,delta}`；`handover-manager.ts`：候選排序、`sinrThresholdDb=-5`、re-attach 放寬 3 dB、`MIN_HANDOVER_INTERVAL_MS=6000`；attach 的結構判準＝`fromSatId===null` |
| 事件軌/分類 | `HandoverEventRail.tsx`、`liveWalkerHandoverEventIndex`（intra/inter 已分類） |
| 字幕狀態機的輸入面 | **`src/course/sixActs/liveReplayBridge.ts`**：`SixActsFrameFacts` 已含 pendingTarget/triggerProgress/lastCommittedHandover；`adaptSixActsFrameFacts` 已做 SimFrame＋EE frame → facts 的映射 |
| 六 Phase 導演模型 | `src/course/sixActs/directorScript.ts`（六 phase、auto-pause、對映三拍 vocabulary、drift 護欄）＋ `windowVisibility.ts`（SGP4 仰角護欄，三種門檻 0°/10°/15° 已分清） |
| 釘定教學窗 | `src/course/sixActs/teachingWindow.ts`：ONEWEB-0325→0618、2026-08-10T16:54:30Z、3dB/30s，載入即重驗（TTT span/offset/checksum/epoch） |
| 上課模式外殼 | `src/course/sixActs/teachingMode.ts`：`/?teaching=1` 旗標＋persisted 狀態命名空間隔離（防止課堂旋鈕污染研究工作流） |
| 字幕條/標籤元件 | `src/course/nav/SixActsAnnotation.tsx`：`SixActsSubtitleBar`（底部字幕帶）＋小標籤；**字幕在底部、不浮在場景中央**（使用者抓過這個錯） |
| 字級底線 | `src/course/nav/sixActsType.scss`（base 19px、floor 15px；投影距離可讀） |
| 平台面板素材 | `src/course/energy-lab/PlatformDrawer.tsx`（之後改掛成殼內 panel） |

## 3. 施工切片（每片一個 commit，過 gate 才前進）

1. **地板開關**：`campusVisible=false`＋掛抽象教學地板（黑盤＋六角 cell，
   對齊 legacy-3d 美術），側欄一顆開關原地切換。→ 結構性，跑 `validate:ready`。
2. **教學面板 dock**：側欄內容可切（工程 ⇄ 教學：INPUTS/因果鏈/政策旋鈕/平台）。
   用一套 panel 機制，**不要散 boolean**（治理文件的 accretion 警告）。
3. **字幕狀態機**：讀 `SixActsFrameFacts` → 八拍字幕；先不動鏡頭。
4. **自動運鏡**：替八拍配 pose，駕 `useHandoverCinema`/`directorFocusPose`；
   講師拖動 OrbitControls 即讓出（既有 idle-gating 模式）；尊重 reduced-motion。
5. **候選淘汰賽疊層＋TTT 環＋SINR 曲線帶（3 dB 陰影帶）＋收據**。
6. **preset**：`?teaching=1&preset=handover` 一鍵進入整條動畫；
   nav 的 Act 3/4 連結改指 preset，然後**刪除** `src/course/angle-lab/`
   與 `src/course/handover-theatre/`（repo 規則 DELETE not park；
   同 commit 更新 `sixActsRoutes.ts`＋nav 測試，不留死連結）。
7. 語域統一 pass：全部畫面文案改學術語（目前僅部分完成）。

之後（非本輪）：intra／被迫接替兩課、Act 5 實驗掛回真 replay、
TLE 之旅站④天球化、全球頁 GEO/LEO 開場。

## 4. 現況座標

- repo：`~/demo/leo-beam-sim`，分支 `feat/six-acts-p0-vertical-slice`（9 commits，未推）
- 模型層 160 個 `node:test` 全綠：`npm run test:six-acts`
- `docs/SYMBOL-SOURCE-OF-TRUTH.md` 有一筆**別的 session** 的未提交修改——不要動、不要包進 commit
- vite `npm run dev` → :3000；截圖：`scripts/shot.ts`（素）、`scripts/shot-flow.ts`（可先點擊再截）
- 治理：首頁是受治理面。lane/mount 變更→`validate:ready` 並貼結果；
  DOM/文案/色值→fast path `validate:visual`。螢幕前後截圖，永不盲改。
- Act 5 數值：ξ=0.35、P^f 公式已依 ADR-006 釘定；κ=2 與通道基準仍是
  COURSE-ASSUMPTION，待 controller 裁決（`docs/PROMPT-CONTROLLER-SIX-ACTS-FREEZE-2026-08-22.md`）。

## 5. 驗收定義（每片都適用）

畫面截圖給使用者看時，用他的標準自問：
**「這像不像一部自己會演、有字幕的教學影片？」**——不是「有沒有 render」。
字太小、擋住場景、要使用者自己撥才會動、像儀表板＝不合格。
