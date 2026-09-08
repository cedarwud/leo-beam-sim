# 問題總帳 — 2026-09-08

單一事實來源。此前發現散在對話、10+ 個 worker log、sat 稽核輸出裡,沒有一處匯總 —— 那本身就是問題之一。

**分級**
- `VERIFIED` = 我在本機樹上親自複驗過(重跑指令 / 讀到 file:line)
- `REPORTED` = worker 給了 file:line 與輸出,我尚未親自複驗
- `PENDING` = 稽核仍在跑

**唯一驗收標準**:改一件渲染決策要動幾個檔案 + 改完能不能**算出來**是否正確(不靠看畫面)。

---

## A. 驗證能力本身壞掉(最高優先 — 這是所有其他問題查不出來的原因)

| # | 問題 | 級別 | 證據 |
|---|---|---|---|
| A1 | 測試偵測率僅 **31–35%**:抽樣中約 2/3 的測試,即使它宣稱測的東西壞了仍是綠 | VERIFIED | 跨家族互證:Gemini 5/16 = 31%;codex 8/23 = 35%。兩邊擾動點不同、方法獨立 |
| A2 | `test:appearance`(15 檔 / 56 測試)**沒有任何 CI 或腳本會執行它** | VERIFIED | `package.json:74` 有定義;全 repo 搜尋引用 → 空 |
| A3 | **32 個孤兒測試檔**(19 在 `src/scene`、13 在 `src/app`)不被任何入口觸及 | REPORTED | `npm run validate:test-orphans` 輸出 |
| A4 | 有測試是**讀原始碼字串跑正則**,無法觀察行為 | VERIFIED | `src/viz/SatelliteMarker.test.ts:8` `readFile(...'.tsx')` + `assert.match(source, /showLabel = true/)`。插入 `showLabel = false;` 後仍通過 |
| A5 | drill 記分板把「錨點失配、量不到」誤報為「意外通過 → 已收斂」 | **已修並提交** | `e9e4419`。新增 `invalid` 桶。修完:12 收斂 / 2 frontier / 0 mismatch |
| A6 | `validate:frame-plan` 閘門對 intra 著色門檻**全盲** | VERIFIED | 自行擾動 `MIN_SHADEABLE_SATURATION` 0.40→0.99(關掉全部 intra 著色),grep 確認落地,sha256 **一 bit 未變**,閘門 PASS |

> A1 是根因。補再多測試,只要偵測率不變,就只是增加假綠。**A2 必須先修**,否則新測試寫了也不會被跑。

---

## B. 顯示與決策分岔(教學模擬器的核心誠信問題)

| # | 問題 | 級別 | 證據 |
|---|---|---|---|
| B1 | **畫面顯示的 EE 不是決定換手的 EE**。顯示端是 seeded 動畫,鎖在 [80k,180k],所有非服務候選被硬夾到 `serving − 4000`「regardless of physics」 | VERIFIED | `beamMetrics.ts:163` `const sourceEe = homepageDemoEe ?? rawSourceEe;`;契約說明在 `decisionEe.ts:1-27` |
| B2 | 此分岔**從來不是設計決定** —— 由訊息叫 `tmp` 的 commit 引入 | VERIFIED | `git log -S` → `6b9474e`(2026-09-04,62 檔 +5344 行,已知造成 8 個回歸)。之前 `beamMetrics.ts:150` 直接讀 `energyEfficiencyBitsPerJoule` |
| B3 | 後續修復 `df0ce68` **只補了決策端**,顯示端留在分岔狀態 | VERIFIED | `decisionEe.ts` 建立;`resolveDecisionEeBitsPerJoule` 於 `sinrLiveCellModel.ts:3730` 生效;決策端無繞道 |
| B4 | 首頁 Intra-HO / Inter-HO 按鈕播**手寫腳本**,不是決策產生的事件 | VERIFIED | `App.tsx:2252` 註解:「scripted teaching story, not an index seek」 |
| B5 | 手動換手示範為 display-only,不動 serving state | VERIFIED | `manualHandoverDemo.ts:26-30` 自述 |
| B6 | 其餘量(SINR / throughput / power / 換手事件本身)是否同樣分岔;顯示值是否會**洩回決策** | PENDING | worker `divergence` |

> B1 是「為什麼每次都要用看的」的直接答案:**畫面在結構上不可能解釋它正在播的那次換手**。

---

## C. 重複權威(同一個決策,多處各自決定)

| # | 問題 | 級別 | 實測歧異 |
|---|---|---|---|
| C1 | 同一顆衛星的身分色**三條道各算各的** | VERIFIED(部分) | `sat-a`:live marker `#e2c550` / orbit trail `#f2d7a0` / artifact replay `#54e147`。我確認 `satelliteTint` 仍在生產路徑 `MainScene.tsx:923` |
| C2 | 首頁波束色**畫兩次**,mount 覆蓋上游 | REPORTED | `#69e95d`(paintConeItems) vs `#8ad183`(mount,勝)。`SinrLiveCellBeamCones.tsx:1381-1416` |
| C3 | 換手脈衝錐**畫兩次** | REPORTED | `#8ad183` → `#e5cb61`(additive 勝)。`additiveHandoverConeColoring.ts:54-100` |

> drill 板說 12/14 收斂,但那是在我建的 ladder 上量的。**C1–C3 這三條道繞過 ladder**,且 characterization 快照也沒覆蓋它們 —— 量測工具與被量測物共享盲點。

---

## D. 模型正確性

| # | 問題 | 級別 | 證據 |
|---|---|---|---|
| D1 | **功率連續性**:`canContinue` 只要 `previous === undefined` 就重設回 `SEGMENT_START_POWER_W`;連續性全靠呼叫端。時間倒退(時間軸拖曳)亦觸發重設 | 部分 VERIFIED / 診斷 PENDING | `angle-aware-ee.ts:75,100-108,134-139`;合約名 `single-sinr-previous-step-power-v2` 顯示**設計意圖是連續** |
| D2 | 左欄 **Power 沒有任何可調控制項**(`visibleInputDefinitions = []`),且有測試把「零控制項」釘住 | REPORTED | `VisualLabProgressiveControlDock.tsx:307-317`;`visualLabControlTaxonomy.test.tsx:136-151` |
| D3 | owner 提案的「SINR 可調 + Power 可調」與模型矛盾 —— SINR 是由功率/通道增益/干擾/雜訊算出來的 | REPORTED | 正確切法應為「**因輸入可調;量測 SINR、實際功率、throughput、EE 皆為導出值**」 |
| D4 | intra handover **是真的**(同衛星同 cell 換更好波束),替代 boresight 指向服務區原點而非 UE(程式明確擋掉 UE-following cheat) | VERIFIED | `sinrLiveCellModel.ts:667` |
| D5 | 真 TLE 下 intra 59→31(−47%),inter 75→99(+32%)。**不會歸零**。真 TLE 在該地點比 Walker 密 2.9 倍(145 vs 51 顆),零空窗 | REPORTED(腳本可重跑) | `/tmp/ho-census-scripts/` |
| D6 | 那 6 根 variant 波束是**發明的天線佈局**(stride 420、偏移 0.2×cellRadius、每根轉 60°),非真實天線陣列 —— 模型選擇,非 bug,但決定了 intra 次數 | VERIFIED | `sinrLiveCellModel.ts:171-173` |

---

## E. 尚未回報(6 個 worker 仍在跑)

| worker | 問的問題 |
|---|---|
| `provenance` | 畫面上每個數字是 REAL / WALKER / FIXTURE / AUTHORED,以及 UI 有沒有告訴觀眾 |
| `wiring` | 左欄每個控制項是否真的影響主畫面與右欄(INERT / ORPHAN-WRITE 普查) |
| `divergence` | B6:顯示與決策分岔的全面普查 |
| `powerstate` | D1:功率是否真的每段重設(診斷 only,不修) |
| `fpcov` | A6:frame-plan 閘門對 13 個渲染決策的真實偵測率 + 補洞 |
| `garbage` | MODQN 移除後的殘留孤兒 |

---

## 凍結中(等 owner 或另一 session 定案,不得動手)

- **D1 功率連續性** —— owner 明示先不處理
- **B1/B2/B3 顯示 EE 對齊** —— 還原會讓畫面變不好看,是 owner 的決定;但要知道:這是**還原一個意外**,不是放棄一個設計
