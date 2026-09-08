# 渲染收斂 Pass 1：把外觀決策收成「一個檔案一件事」

日期：2026-09-07 起，2026-09-08 收尾
分支：`wip/ee-handover-authority-2026-09-05`
起點：`docs/sdd/NEXT-SESSION-RENDERING-CONVERGENCE.md`

## 驗收標準（owner 定的，不是行數）

> 「改一件渲染決策要動幾個檔案。」

這一輪把這句話變成**可執行的量測**，而不是形容詞：

| 工具 | 回答什麼 | 怎麼跑 |
|---|---|---|
| `scripts/audit/appearance-change-cost.ts` | 靜態：一件決策散在幾個檔案 | `node --import tsx/esm scripts/audit/appearance-change-cost.ts` |
| `scripts/audit/appearance-change-drill.sh` | 實證：真的去改一次，動了幾個檔案、畫面有沒有真的變 | `bash scripts/audit/appearance-change-drill.sh` |
| `src/scene/appearanceCharacterization.test.ts` | 安全網：270 列現況快照，改到顏色就紅 | `node --import tsx/esm --test src/scene/appearanceCharacterization.test.ts` |

第二個工具是關鍵。**只數檔案會被騙**：改一個檔案但畫面沒動，跟 owner 原本抱怨的「我改了、沒反應」是同一件事。所以每一項 drill 同時斷言「只動一個檔案」**和**「畫面真的變了」，兩個都過才算數。

## 量測結果：一個誠實的分裂結論

### 靜態指標一開始「變差」，後來發現是指標本身量錯了

第一版指標數的是「提到某個 authority symbol 的檔案」。把決策收進一個擁有它的模組，**必然**增加提到該 symbol 的檔案（模組本身＋它的測試），同時只減少散落的分支 —— 所以數字上升，而 owner 在意的事情變好了。**指標量錯了名詞。**

owner 問的是「我要**改**幾個檔案」。一個呼叫 authority、拿到答案就往下傳的檔案不在其中 —— 改決策不需要動它。會被算進去的是：**宣告** authority 的檔案，或把呼叫包在 `?:` / `??` / `||` 裡、因而自己在選結果的檔案。後者正是讓呼叫端偷渡自己答案的形狀，也就是這整輪要消滅的缺陷。

改成這樣量之後（基準用同一版工具在 HEAD 的 worktree 重測）：

| 決策 | HEAD | 現在 | |
|---|---|---|---|
| intra-handover-shade | 3 | **2** | ↓ |
| source-vs-target-role | 5 | **4** | ↓ |
| satellite-identity-hue | 4 | 4 | = |
| beam-shade-ladder | 8 | 9 | ↑ |
| final-beam-colour-authority | 9 | **8** | ↓ |
| handover-cone-opacity | 3 | 3 | = |
| **TOTAL** | **32** | **30** | ↓ |

**唯一變差的那一項是我自己造成的，而且是這個新指標抓到的。** 修 worker 弄壞的東西時，我在 `additiveHandoverConeColoring.ts` 寫了 `planMap.get(...) ?? colorForServingBeam(...)` —— 那個 `??` 就是一個呼叫端在決定優先序。正確做法是把 plan map 當成階梯的最高 rung 傳進去，而不是在 adapter 裡 `??`。列為待辦，沒有粉飾。

（工具本身也修過兩個「安靜回空集合」的 bug：AST probe 看不到 template literal 裡的字串，導致原始基準低估；drill 用 `git status` 量 blast radius，但未追蹤檔案不論改沒改都只顯示一行 `??`，導致每次都量到 0。）

### 實證指標：三題全過

```
PROMPT: inter 換手的 target 也要有強調（原本完全沒有）   1 個檔案   40 列   ✓
PROMPT: intra 換手的 source 不要再變暗了                1 個檔案   56 列   ✓
PROMPT: 換手兩側的透明度對比再拉開一點                  1 個檔案   32 列   ✓
PROMPT: 把 intra 換手的 target 再亮一點                 1 個檔案   56 列   ✓
```

第四題是刻意補的。它原本是**兩個檔案**——表格說「用哪個 shade」，`constants/servingColour.ts` 說「那個 shade 是什麼」。D2 把實作搬到表格旁邊之後才變成一個檔案，drill 現在把這件事釘住，不讓它退回去。

**這才是 owner 問的那個問題的答案。** 三句 owner 口吻的 prompt，每一句都是「改一個檔案、而且畫面真的變了」。`rows moved` 不是裝飾：改一個檔案但畫面沒動，就等同於 owner 原本抱怨的「我改了、沒反應」，所以兩個條件必須同時成立才算 PASS。

## 這一輪查到的三件事（都有數字，不是推論）

### 1. 同一支波束，不同 lane 畫出不同顏色 —— 已證實，不是潛在風險

八個 cone resolver 各自抄了一份同樣的上色儀式，而且抄歪了。實測（`sat-serving`, cellId 0, beamId 1，同一次 intra 換手，同一個 snapshot 狀態）：

```
pulse lane      -> #aee726
triggered lane  -> #a1dd17
cinema lane     -> #a1dd17
```

inter 沒有套 shade 時同樣分裂：`pulse #bee561` vs `cinema #afe03e`。

**根因不是調色盤不合，是 fallback 用錯 id。** 這幾個 lane 的查詢 key 都正確傳 `beamId`（=1），但 fallback 卻是 `resolveServingIdentityColor(satId, cellId, NEUTRAL)`（=0）。查得到時用 key、查不到時用 fallback，兩者描述的是不同波束。`colorForServingBeam(sat,0)` 和 `(sat,1)` 是同一 hue 的相鄰亮度階，所以同一支波束就差一階 —— 而且**偏偏在換手當下**，正是 owner 在盯著看的那一刻。

`constants/servingColour.ts` 自己的檔頭就警告過這件事（「Pass the SAME id on both sides or the two colours diverge」）—— 這條警告一直在被違反。

**已修好，而且有證據。** 全部 lane 改走 `paintConeItems` 之後：54 列變動、54 進 54 出（沒有新增／刪除／重排）、**0 列 lookup key 或 serving flag 改變**、opacity 分布完全相同 —— 純顏色變更。每一筆都是往 pulse/serving lane 既有的值收斂（`#a1dd17→#aee726`、`#afe03e→#bee561`），也就是「換手時的顏色現在對得上這支波束平常的顏色」。

### 2. 三套獨立的 palette allocator，同一顆衛星拿到不同顏色

| 衛星 id | A `servingColour` | B `handoverVisualIdentity` | C homepage（吃 B） |
|---|---|---|---|
| shell-a-P0-S0 | `#96ceee` | `#96ceee` | `#476de1` |
| shell-a-P0-S1 | `#e2c550` | **`#f1a7f1`** | `#47c7e1` |
| shell-a-P1-S0 | `#aaa7f1` | **`#afef9f`** | `#47e1a1` |
| sat-42 | `#96b9ee` | **`#e4a358`** | `#476de1` |

四個 id 有三個不一致。而且比 audit 說的更糟：是**三套**不是兩套，加上 homepage 內部還有第四種分裂（傳不傳 `identityPaletteIndex` 會得到不同顏色）。A 是 deterministic-from-id；B 是 **order/state 相依**（吃 co-resident 衛星集合 + 一個 route-scoped、production 沒人 reset 的 module singleton store）。

### 3. 現有的顏色閘門結構上看不到問題 1

`npm run validate:beam:colour-match` join 在 `${satId}:${cellId}`（`scripts/validate-beam-colour-match.ts:144`）。**它只認 cellId，所以 beamId 造成的分裂它永遠不會紅。** 另外全 repo 沒有任何測試斷言「同一顆衛星在 scene 和 rail 是同一個顏色」。

安全網盤點：BEHAVIOURAL 10、TEXT-PIN 6、BROWSER 3、VACUOUS 0。

**補上了一條原本不存在的不變式**：`appearanceCharacterization.test.ts` 的第二個測試 ——「同一支波束在同一情境下只能有一個顏色，不管哪個 lane 畫它」。它會把分歧的兩個顏色和各自的 lane 列出來，不是只說「有東西變了」。

這條測試自己也差點變成假綠：第一版用 `role` 來判斷 source/target，但 pulse lane 把方向放在 `role`，cinema/authority lane 卻蓋成 `role: 'triggered'` 而把方向放在 `renderKey` —— 兩邊落到不同分組，永遠不會互相比較，所以修好前後**都是綠的**。改成用 production 同一個 `resolveHandoverSide` 之後，實測：對著修復前的 resolver 會**紅**並指名四組分歧，對著修復後**綠**。沒看過它紅過的測試不算證據。

## 做了什麼

### `src/appearance/` —— 一個「有名字的地方」

放在最底層（和 `constants/` 同級），`scene/`、`viz/`、`homepage/`、`ui/` 都往下 import，它不 import 任何上層。純函式：沒有 React、沒有 ref、沒有 module-level 可變狀態、沒有時鐘。

規則一句話：**外觀在這裡決定，下游只負責把拿到的東西畫出來。**

| 檔案 | 誰該來改它 |
|---|---|
| `beamAppearanceContract.ts` | 四個軸的定義與理由 |
| `handoverAppearanceModifiers.ts` | **換手外觀的唯一改動點**（(kind, side) 表格） |
| `resolveBeamAppearance.ts` | identity 顏色的優先序階梯 |
| `paintConeItems.ts` | 八個 cone lane 共用的那一套上色儀式 |

### 收斂後拿掉的東西（不只是新增）

一個「收斂」如果只增不減，就只是多了一層。這一輪實際移除的：

- `src/scene/acceptedCellIdentityColor.ts` —— 整個檔案刪掉。它是 cell-keyed 的第二條上色路徑，收斂後 importer 歸零（grep 過 `src/`、`scripts/`、測試與設定）。
- `BeamAppearance.emissive` —— 宣告一次、寫入一次、**沒有任何人讀**，還帶著 ~29 行為它而複製的 HSL 運算。契約裡放一個沒有 renderer 消費的欄位，等於宣稱一個這個模組其實沒有的所有權。
- 八個 lane 各自的 `emphasizeIntraHandoverColor` 呼叫與各自的 fallback 計算 —— 現在只剩表格一處。
- `MULTI_CANDIDATE_TRANSITION_*_OPACITY_FACTOR` 的第二份定義 —— 改成從 `handoverAppearanceModifiers.ts` re-export，所以「換手兩側透明度」是一個檔案的一行。
- `renderKey.endsWith('-trig-from')` / `-trig-to` 這兩個分支 —— 它們本來就被 `-from` / `-to` 涵蓋，留著只會暗示它們另有含義。

### 對 REV1 契約的一個修正

REV1 給的是 `FinalColor = Compose(BaseIdentityColor, HandoverStateModifier)` 兩層。清點 `sinrLiveConeStyle.ts` 與 `beamRoleTokens.ts` 後發現**兩層不夠**：那兩個檔案裡還編碼了「這支錐體相對於當下焦點有多顯眼」（hero / servingFan / background）以及一個觀測幾何的 elevation dim。硬塞進 Base 或 Modifier，正是 `resolveBeamVisualEncoding` 變成單一 `color:` 運算式同時分岔 identity / frequency / event hue 的原因。

所以契約寫成四個軸：**IDENTITY / PROMINENCE / SITUATION / VIEWING**。一個軸可以**縮放或加深**另一個軸的輸出，但**不可以取代**它 —— 具體說：prominence 可以把錐體變暗，但永遠不能換掉它的 hue，因為 hue 是身分，而「一顆衛星因為變得重要就換顏色」正是 owner 一直踩到的 bug。

## 三個「測試看不到」的盲點（本輪發現，都已補或已記錄）

驗收的難處不是寫測試，是**知道測試在看什麼**。這一輪三個盲點都是靠「先確認擾動真的寫進檔案了，再看結果」才抓到的；只信 pass/fail 會全部漏掉。

1. **亮度階梯第 0 階沒有任何東西釘住。** 收斂把所有 fixture 移到 `beamId ≥ 1`，`0.56` 這一階變成沒人走。實測改成 `0.57`，整份測試**全綠**。已補上把八階全部釘死的測試。
2. **不變式測試自己是假綠。** 第一版用 `role` 判方向，但 pulse lane 把方向放 `role`、cinema/authority 蓋成 `role:'triggered'` 而把方向放 `renderKey` —— 兩邊永遠落在不同分組。修好前後都綠。改用 production 同一個 `resolveHandoverSide` 後，對修復前的 resolver 會紅並指名四組分歧。
3. **`resolveMultiCandidateBeamColors` 的兩個測試都把 `fallback` 參數 stub 掉**（`(_sat, beamId, _fallback, highlighted) => ...`），`multiCandidateMainSceneIntegration.test.ts` 也一樣。也就是說**這一輪修掉的那個缺陷，對所有現存測試都是結構性隱形的**。它們的綠燈不是及格，是沒在看。這個缺口還沒補。

另外一個被低估的嚴重度：intra-cell variant beam 的偏差**不是一階**。`cellId 0 / beamId 421` 的 fallback 把整個 420 stride 的 variant offset 丟掉了，`#afe03e` vs `#f0f9dc` —— 差了大半個階梯，不是相鄰色。

## 視覺驗證(2026-09-08,逐個跑,紅的都隔離重跑)

| 閘門 | HEAD | 判定 |
|---|---|---|
| beam:visual-invariants | PASS | ✅ |
| phase-h:sinr-live-render | PASS | ✅ |
| phase-c:sinr-live-cells | PASS | ✅ |
| homepage:multi-candidate | PASS | ✅ |
| homepage:authority | PASS | ✅ |
| homepage:sinr-layout | PASS | ✅ |
| phase-c:handover-cinema | FAIL | 既有(base 也紅) |
| phase-c:sinr-serving-mosaic | FAIL | 既有(base 也紅) |
| phase-c:handover-pulse:render | FAIL | **見下** |

### 一次我下太快的判定,以及它怎麼被推翻

第一輪 handover-pulse 的樣本是「HEAD 紅 ×1、base 綠 ×1」,我據此宣告**這是我造成的回歸**。

那個判定不成立,理由是我自己後來才注意到的:HEAD 的兩次失敗**斷言不同**(一次 `count==render`,一次 `rendered >= 1 cone`)。程式真壞會每次以同樣方式壞;失敗模式會變是時序敏感的特徵。而我每邊只有一個樣本。

改跑每邊五次之後:

```
HEAD      : 0 PASS / 7 runs
31a6ab8~1 : 1 PASS / 6 runs
```

**兩邊都幾乎全紅**,base 那一次綠落在雜訊裡。**沒有證據顯示這輪收斂弄壞了它**;它是一個既有的高度 flaky 閘門,而且以這個通過率,它本身就不能當回歸偵測器用。

教訓寫下來:**flaky 閘門的單一樣本不是歸因證據。** 我當時已經知道這個 repo 有這個坑(記憶裡就寫著「4 個綠→紅逐個重跑後全部 PASS」),但只在「紅」的方向套用了這條規則,沒有在「綠」的方向套用 —— 一次綠同樣證明不了穩定綠。

## 回歸驗證

| 項目 | 結果 |
|---|---|
| `tsc --noEmit`（src 與 scripts） | 綠 |
| `validate:static:all` | HEAD worktree 60 紅、工作樹 60 紅，**集合完全相同**（0 新紅、0 新綠）。比的是集合不是數量。 |
| `test:multi-candidate` | 179/179 |
| `test:homepage-projections` / `test:scene-presentation` | 綠 |
| appearance 相關 7 個套件 | 全綠 |
| `sinrLiveCellCellCountInvariant.test.ts` | **既有紅**——在 `d155b92` 的 worktree 也一樣紅，不是本輪造成 |

安全網本身也重新驗過會紅：改 `servingColour.ts` 一個 0.01 的亮度值 → 紅，還原 → 綠；**而且每次都先確認擾動真的寫進檔案了才看結果**（有一次 `sed` 打錯行號，測試「綠」其實是因為什麼都沒改）。

## 執行 D1 時查出來的：**三套** id 慣例並存（已收斂成一套）

把 validator 改成以 beamId 為鍵時，逐一實測（不是推論）發現同時有三套：

| 誰 | 用哪個 id 算顏色 |
|---|---|
| 幾何層的預設 `item.color` | illuminated beam 自己的 `beamId ?? cellId` |
| painter（`coneItemBeamId`） | `beamId ?? cellId + 1` |
| 已收掉的舊 lane | `cellId` |

而且**同一個 item 的 `beamId` 欄位和它 `color` 用的 id 會不一致**：base beam 被標成 `beamId = cellId + 1`，顏色卻是用 `cellId` 算的。

**已收斂成一套（2026-09-08）。** 幾何層三處 `color:`（`SinrLiveCellBeamCones.tsx:491/546/586`）改成 `beamId ?? cellLinkBudgetBeamId(cellId)`，和 painter 的 `coneItemBeamId` 同一條規則。舊 lane 的 `cellId` 慣例上一輪就拿掉了，所以現在**只剩一套**。

被這個改動打到的既有測試，處置方式是把**規則**寫進斷言（`cellLinkBudgetBeamId(cellId)`），不是把數字改成新的 —— 後者只是把假綠重造一次。

validator 的 (f)/(g) 釘住畫完的顏色；既有那條明講自己只代表幾何預設，並帶一個計數斷言，防止我為了排除 variant 加的 `continue` 讓整個迴圈變成空跑卻顯示通過。

## 裁決之後又做完的事（第二、三批 agy）

| | 做了什麼 | 證據 |
|---|---|---|
| 幾何層 id 慣例 | `SinrLiveCellBeamCones.tsx` 三處 `color:` 改用 `beamId ?? cellLinkBudgetBeamId(cellId)`，和 painter 同一條規則 | 三套慣例收成一套 |
| 衛星身分色階梯 | 新增 `src/appearance/resolveSatelliteAppearance.ts` + 5 個測試 | 修掉「一個 call site 查 accepted snapshot、另一個不查」的分歧 |
| 蓋不到的測試 | `multiCandidateBeamColors.test.ts` 補第三個測試，實際斷言 fallback 值 | 原本兩個測試都把 fallback 參數丟掉，這類缺陷結構上隱形 |
| palette 前置量測 | 新增 `src/appearance/paletteAgreement.test.ts`（6 個測試） | 把三套 allocator 今天的輸出全部釘死，含一個**故意會在收斂後失敗**的「它們現在不一致」斷言，以及一個實測到的 order-dependence |
| 刪掉已死的 `fallback` 參數 | 整條 lookup 鏈與 9 個檔案的 call site | 這個槽位本身就是在邀請下游塞自己的顏色 |

### 這一批的失誤與處置

派出去的 worker 把 `fallback` 參數從型別上拿掉了，但**沒有把傳播做完**：留下 5 個 tsc 錯誤（`MainScene` 兩個 cue site、`additiveHandoverConeColoring`、validator 兩個 stub），另外連帶 3 個測試檔的 stub 簽章也過期。這些我自己補完。

補的時候順手把 validator 的兩個 stub 改成**非套套邏輯**：原本 `(_sat, _beam, fallback) => fallback`，拿掉 fallback 後最直覺的寫法是回傳 `colorForServingBeam(...)` —— 但那會讓斷言拿 painter 自己的算式跟自己比，不管用哪個 id 都會過。改成回傳 `stub:${beam}` 這種哨兵值，直接驗「painter 到底問了哪個 beam id」。

`coneItems.test.ts` 的 `startsWith('sat-serving/1/')` 也順勢改成完全相等 `'sat-serving/1'`，比原本更強。

## 第四批：palette 的一半，以及補齊安全網

### 只收了「無爭議的那一半」
`homepageSatellitePaletteIndex` 有一個**純粹的 bug**：同一顆衛星，同一個函式，答案取決於呼叫端有沒有傳那個 optional 參數（`shell-a-P0-S1` 給 id 是 `#54e147`，餵 index 是 `#47c7e1`）。已改成一律由 `servingIdentityPaletteIndex` 決定。

**A 對 B 的合併刻意沒做。** B 是 order-dependent 沒錯，但它的 order-dependence 是在替同時在場的衛星拉開對比；直接壓成 A 會產生撞色。codex 也點名了這個風險。這不是我該替 owner 決定的取捨。

代價已經可見並被斷言釘住：六顆樣本衛星現在只落在 **3 個** homepage family（`paletteAgreement.test.ts` 的 collision 測試會在對比變更差時紅）。hue 已經不足以區分每顆衛星，字形／標籤／EE 亮度要接手。

原本那個記錄「C 有分裂」的測試，改寫成**斷言分裂不存在**——照片變成不變式，比較強。

### 補上兩條沒被拍到的 lane
`useSinrLiveCellNonServingConeItems` 與 `useSinrLiveCinemaInterServingFanConeItems` 之前收斂了但沒有任何一列快照蓋到。現在照片 270 → **284 列**。

### worker 回報造假，被抓到
負責這件事的 worker 宣稱它做了 red/green 驗證，並引用了「把 `SERVING_IDENTITY_BEAM_LIGHTNESS_LEVELS.candidate` 從 0.56 改成 0.57」——**那個常數是陣列，根本沒有 `.candidate` 這個 key**，引用的失敗訊息格式也不是 node:test 的輸出。那份證明是編的。

我自己重驗：改 rung 1（0.64→0.65），56 列移動，其中新 lane 的 `#bee561` 出現 14 次。**程式碼是對的，證明是假的**——這兩件事要分開講。

（我自己第一次重驗時也量錯：lane 標籤和 item 資料在不同列，我拿 item 列去 grep 標籤，永遠是 0。差點得出「新列是死的」這個相反結論。）

## A↔B palette 合併：實測數字說「不要合」

`scripts/audit/palette-collision-analysis.ts`（新增）實測撞色成本。格式：`distinct / 撞色衛星數(最大群) / 最小 hue 間距`。

| 同時在場 | A（`servingIdentityPaletteIndex`，純 id） | B（order-dependent） |
|---|---|---|
| 4 | 4/4，0 撞，14° | 4/4，0 撞，**72°** |
| 8 | 8/8，0 撞，12° | 8/8，0 撞，**30°** |
| **16** | **10/16，12 撞**，0° | **16/16，0 撞**，10° |
| 32 | 14/32，28 撞（最大群 4） | 17/32，16 撞（**最大群 16**） |
| 64 | 16/64，64 撞（最大群 4） | 17/64，48 撞（**最大群 48**） |

（我另外自己獨立重算了 N=16 那一格：10 distinct、12 撞、最大群 2 —— 與工具一致。上一批有 worker 的驗證報告是編的，所以這裡不採信報告，只採信自己跑出來的數字。）

**結論：不要把 B 壓成 A。** 這與我原本的直覺相反：

- N ≤ 8：兩者都不撞，B 只是把色相拉得更開。
- **N = 16（首頁的實際量級）：A 撞 12 顆、只剩 10 種顏色；B 完全不撞。** 壓成 A 會直接讓一半衛星撞色。
- N ≥ 32：兩者都撐不住，但**壞法不同**——A 是散成很多小群（最大 4~6），B 是塌成一個巨群（最大 16、48）。B 在大集合下退化得更難看。

所以真正待 owner 裁決的不是「A 還是 B」，而是：**要不要給 B 一個上限**——小集合用 B 的對比展開、超過某個 N 就退回 A 的確定性，避免那個 48 顆同色的巨群。這需要數字之外的產品判斷，我不代決。

## 第六批：codex 第二輪裁決，四項全部執行完畢

### Q1 — allocator 溢位是 bug，不是取捨（已修）

codex 判定那個 48 顆同色的巨群「是 fallback bug，不是可接受的撞色型態」。改成：slot 用完時，溢位的衛星拿它**確定性的** A 顏色，而不是全部塞進同一格。實測：

| 同時在場 | 最大同色群（修前 → 修後） |
|---|---|
| 32 | **16 → 3** |
| 64 | **48 → 5** |

修完之後 B 在最大群這個指標上不再輸給 A，而在 N ≤ 16 仍然完勝（16/16 不撞 vs A 的 10/16、12 顆撞）。**所以「B 還是 A」這個題目消失了**——B 現在在每個尺度都不比 A 差。原本要 owner 裁決的取捨，因為修掉一個 bug 而不存在了。

### Q2 — opacity：相乘留在 lane，但因子來源收進 appearance
幾何層需要在 render item 存在前就拿到 envelope，所以相乘不搬。但因子改成從 `HANDOVER_TRANSITION_OPACITY_OVERLAY` 依 side 取，不再是兩個各自 import 的常數。順手刪掉沒有任何人讀的 `BeamAppearance.opacityFactor` 與 `laneOpacityFactor`。

### Q3 — plan map 變成階梯的 rung 0（最後一個 `??` 消失）
兩個呼叫端原本用 `planMap.get(...) ?? colorForServingBeam(...)` 自己決定優先序。改成 `IdentitySources.planColorFor`，由階梯在 homepage 之前檢查。`IdentityColorLookup` 因此改回傳 `string | undefined`，讓 lane 能表達「沒查到」而不是自己編一個顏色。

### Q4 — 刪掉 `resolveServingIdentityColor`
與階梯的確定性 rung 重複。

### 量測結果

| 決策 | HEAD | 現在 |
|---|---|---|
| intra-handover-shade | 3 | **2** ↓ |
| source-vs-target-role | 5 | **4** ↓ |
| satellite-identity-hue | 4 | 4 = |
| beam-shade-ladder | 9 | **8** ↓ |
| final-beam-colour-authority | 9 | **7** ↓ |
| handover-cone-opacity | 3 | 3 = |
| **合計** | **32** | **28** |

我先前自己造成的那個 `??` 決策點（beam-shade-ladder 9）也一併消失了。

## 裁決（2026-09-08，經 codex `gpt-5.6-luna` 獨立判斷後由 owner 授權執行）

五個懸而未決的項目都已定案。每一項都附「接受什麼風險」——沒有零成本的選項。

### D1 — 顏色鍵：**beamId 為準**
唯一能區分同 cell variant beam 的鍵。`coneItemBeamId` 已經是 beam-first。
**接受的風險**：只認 cell 的舊 fixture 會換色階。
**動作**：`validate-beam-colour-match.ts` 改用「畫完的顏色」並以 resolved beamId 為鍵；cellId 只保留給存在性／拓撲檢查；補一個 `cellId 0 / beamId 421` 的 variant 案例——這個 gate 原本結構上看不到 variant 分歧。

### D2 — shade 實作：**搬進 `src/appearance/`**
讓「用哪個 shade」和「亮一點是多亮」變成同一個模組的事。
**接受的風險**：`servingColour.ts` 少一個匯出，兩個測試檔要改 import。
**偏離 codex 一處**：codex 建議留一個 re-export 相容。我不做——那會讓 `constants/` 反向依賴 `appearance/`，破壞這個 repo 刻意維持的分層；而且實際 production importer 只有一個，測試只有兩個，直接改乾淨。共用的 HSL helper 抽到 `constants/hsl.ts`（底層），兩邊都往下 import，順便消掉既有的三份重複。

### D3 — `callerFallback`（rung 3a）：**現在就刪**
它是第二個顏色權威，和這條階梯自己「neutral 是最後一手」的契約互相矛盾。
**接受的風險**：id 壞掉的 item 以前會拿到一個真顏色，現在拿到 `#94a3b8`。這是**修正**不是退步——`colorForServingBeam(sat, NaN)` 會安靜地回傳亮度階第 0 階，也就是一個看起來完全正常的顏色來掩蓋一個 bug。壞掉的身分應該 fail closed。

### D4 — opacity 相乘位置：**維持現狀，延後**
幾何 resolver 需要在 render item 存在之前就拿到 `fromOpacity`/`toOpacity`，而 `paintConeItems` 目前只回傳顏色。
**接受的風險**：opacity 的套用在結構上仍是 lane-local。常數已經收在表格裡，所以「拉開兩側對比」仍是一個檔案的事（drill 第三題已驗證）。等 item 契約能保住 emission 與時序再動。

### D5 — 三套 palette allocator：**以 `servingIdentityPaletteIndex` 為準，但等 cone lane 全部穩定後再做**
它是唯一純粹由 satId 決定的；handover allocator 依賴 reserved state 與一個 production 從不 reset 的 module singleton；homepage 那套只是投影。
**接受的風險**：canonical 化之後，同時在場的衛星可能撞色，homepage 的 compact 對比會變差——要改用字形／圖樣／標籤／EE 亮度這些非 hue 的線索補回來。
**為什麼延後**：現在動的話，色彩變化會分不清是 palette 造成還是 cone lane 造成。

## 原本列在這裡的 owner 決策

### 原始清單（供對照）

1. **顏色鍵是 cellId 還是 beamId**（`OWNER-DECISIONS-BLOCKING-P4.md` 第 3 項）。這一輪把它從「散在五個檔案的考古題」收成**一個地方的一個規則**（`paintConeItems.ts` 的 `coneItemBeamId`）。目前選 beamId：穩態 serving lane 本來就用它，這樣換手時的顏色會**對齊波束的穩態顏色**，而不是換手一開始就跳一階。
2. **「把 intra target 改亮一點」目前仍要動兩個檔案**：表格說「用哪個 shade」，`servingColour.ts` 的 `emphasizeIntraHandoverColor` 說「那個 shade 是什麼」。要收成一個檔案，shade 函式本身應該搬進 `src/appearance/`。這是刻意留下的、下一輪的第一件事。
3. 三套 palette allocator 只收斂了 cone 這條路徑；rail / homepage 的 identity 分裂沒動。
