# 下一個 session 的起點：收斂渲染外觀決策

## owner 的真實目標（這是唯一的驗收標準）

> 「我很常在畫面上看到波束/衛星/換手的渲染，我想去改這些渲染的相關邏輯，
> 然後會改非常多次都失敗，甚至把原本好的也改壞了。
> 我希望我想要改什麼，都可以用簡單的 prompt 敘述後就可以完成。」

**驗收不是行數，是「改一件渲染決策要動幾個檔案」。**

## 診斷：為什麼「改三個地方還是壞」

`docs/sdd/RENDERING-ARCHITECTURE-AUDIT.md` 的核心結論：

> owner 輸入「把 intra 換手的波束顏色改成某種變化」時，**不是在修改一個 policy，
> 而是在猜測這個詞目前落在哪一組語意**：steady serving identity 的顏色？
> semantic role 的 pulse 顏色？selected/committed carrier 的顏色？homepage 的 EE shade？
> source/target 同色系強調？還是某個舊 layer 的 fallback？

已量測的證據：

| | 數量 |
|---|---|
| 顏色/調色決策函式 | **36 個，散在 6 個目錄** |
| 獨立的 palette index 分配 | **至少 2 套**（`handoverVisualIdentity.ts` 的 `choosePaletteIndex` 與 `homepageSatelliteVisualIdentity.ts` 的 `homepageSatellitePaletteIndex`） |
| 「換手呈現」決策點 | 40 個檔案、123 處 |
| 碰觸 `markerColor`/`identityColor`/`cssColor` | 28 個檔案 |

**同一顆衛星在不同畫面可能拿到不同顏色，沒有任何地方保證一致。**

## 兩份獨立複核推翻了 audit 的順序

`AUDIT` 建議「先收斂上游真值 → 再 identity → 再 handover appearance → 最後拆 React shell」。
兩個 agy 各自複核後**都推翻了這個順序**（`docs/sdd/worker-reports/agy-rev/REV1.md`、`REV2.md`）：

> **即使上游 100% 純淨單一，只要終端 resolver 依然把 identity 與 role 攪在一起，
> owner 下 prompt 依然會猜錯語意並改壞畫面。**（REV1）

REV2 獨立得到同樣結論，並指出這一步的優勢：**不需要改 Three.js 渲染樹、
不需要等 owner 決定 cell/beam、可以在單元測試中 100% 驗證。**

## 第一步（兩份複核一致指向的具體標的）

把散在 `MainScene.tsx`、`servingColour.ts` 等處的 **36 個顏色判定規則**，
收斂成一個**不依賴 React、不讀 ref、無副作用**的純函式：

```ts
resolveHandoverAppearance(input: {
  serving: ...; target: ...; phase: ...; role: ...;
}): Appearance
```

REV1 給的合成契約：

```
FinalColor = Compose(BaseIdentityColor, HandoverStateModifier)
```

- **Base Layer** — 純粹由衛星/小區身分決定（`servingColour` 唯一提供，**嚴禁包含事件狀態**）
- **Modifier Layer** — 純粹由換手事件狀態決定（pulse、alpha、target highlight）

並且**拔除下游所有自主 fallback**：不准任何元件因為「是不是 homepage mount」
或「有沒有 beamId」私自改寫色彩計算，下游只能接收合成完畢的最終結構。

配一個**外觀矩陣測試**（給定 serving/target/phase/role 的組合，斷言輸出），
先例是 `src/scene/coneItems.test.ts`——不掛 React、不啟動 canvas。

**做完之後**：owner 想改 intra target 顏色時，目標只有唯一的 `HandoverStateModifier`，
改動立即生效且不污染基礎身分色。那會是全專案第一個「改一個檔案、保證全域生效」的落地點。

## 最大的執行風險（REV2 的原話，值得警惕）

> 在缺乏真實視覺驗證工具（Chromium/Pixel Diff）的情況下，**深陷次要模組的過度工程**，
> 最終在巨石元件中引爆更難察覺的視覺撕裂與競態條件。

**這句話正好描述了上一個 session 做的事**：花了大量時間拆檔（約 1,500 行、42 個模組、
110 個測試），但拆走的是安全的純計算，而 owner 要改的渲染邏輯留在耦合最深、沒動的那堆裡。

## 可以直接用的工具與既有資產

| 路徑 | 用途 |
|---|---|
| `scripts/refactor/extract-region.ts` | 抽取工具，三種形狀（helper/jsx/hook），`tsc` 當網子、失敗自動 byte-exact 回滾、不安全時在寫檔前拒絕 |
| `scripts/refactor/analyze-closure-captures.ts` | 量任何區域的捕獲剖面（state/ref/寫入點/可抽取性評分） |
| `scripts/audit/count-source-pins.ts` | 用 AST 數源碼文字 pin，能分辨已紅/假綠/負向斷言 |
| `src/scene/coneItems.test.ts` | 純函式測試的範本（不掛 React、不啟動 canvas） |
| `src/scene/handoverAuthorityJoin.ts`、`handoverEventCuePolicy.ts` | 已存在的 policy 模組雛形，方向對但涵蓋不全 |

## 上一個 session 的教訓（別重蹈）

1. **`tsc` 綠 ＋ 行數下降不是成功判準。** 那個判準便宜、永遠說 yes。
   第一次抽取拿到了漂亮的行數，產出的卻是一個 30 參數、完全測不了的 hook——
   獨立審查判定是「**把工具的網子誤當成架構邊界**」，技術債轉移。
   重切後參數降到 4 個並寫得出測試，才算真的建立邊界。
2. **真正的判準是「能不能寫出不掛 React 的單元測試」。** 寫不出來就是接縫錯了。
3. **26 個 browser 閘門連續跑的結果不可信。** 高負載下時序敏感的閘門會偽紅，
   實測有 4 個「綠→紅」逐個重跑後全部 PASS。驗回歸要逐個跑或降併行。
4. **嚴禁 re-pin。** 文字 pin 因重構假紅時，正確處置是轉行為斷言／去檔名化／刪除，
   **不是把 regex 改指向新位置**——那只是把假綠重新製造一次。
5. **量測方法本身會錯。** 上個 session 有九次量測失誤（樣板產生的 testid 用字面 grep 找不到、
   mobile 斷點搜錯數字、`pgrep` 自我匹配、`assert.equal(x, false)` 這種負向斷言形式沒被認出）。
   **用一個會安靜回空集合的查法，然後把空集合當成事實**——這是最常見的錯誤形狀。

## 仍待 owner 裁決（不要幫他決定）

見 `docs/sdd/OWNER-DECISIONS-BLOCKING-P4.md`：

1. **正規首頁路由要不要尊重 `?sceneSource=`** — 解鎖 6 個 browser 閘門
2. **MODQN demo 的測試進入合約** — 解鎖 3 個
3. **顏色鍵是 cellId 還是 beamId** — `MainScene` 與 `validate-beam-colour-match.ts` 目前用不同的鍵，沒有東西偵測這個分歧

前兩項還間接擋住 62 條行為斷言提案與 58 條 pin 歸屬。

## 建議的新 session 開場

```
讀 docs/sdd/NEXT-SESSION-RENDERING-CONVERGENCE.md。

我的目標：改波束/衛星/換手的渲染邏輯時，能用一句 prompt 描述就改完，
而不是改很多次都失敗、還把原本好的改壞。

你是 controller，派多個 sub-agent 執行。
驗收標準不是行數，是「改一件渲染決策要動幾個檔案」。
```
