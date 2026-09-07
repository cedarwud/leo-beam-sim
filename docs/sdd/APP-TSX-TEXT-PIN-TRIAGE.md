# App.tsx 文字 pin 分流（P4 前置）

量測時間 2026-09-06，工作區乾淨，HEAD `4563819`（`wip/ee-handover-authority-2026-09-05`）。
方法：16 個 `agy` 併行判斷（Gemini 3.7 Flash High，材料內嵌；分兩輪，第二輪修正了第一輪的召回率問題）＋ controller 端 TypeScript AST 計數與**實跑**交叉驗證。
每一列的行號與引文都對過原始碼；每一個「今天是紅是綠」都是實跑，不是推論。

## 一、§0b 有兩句需要更正

### （1）「那 41 個今天是綠的，只證明了文字沒有移動」——實測為假

有 npm key 的 40 個 pin validator 今天全部實跑：**18 綠、22 紅**。
其中 **9 個是被 App.tsx 的文字 pin 本身弄紅的**：

| validator | 紅在哪一條 App.tsx pin |
|---|---|
| `validate:frontend:scene-lane-governance` | `liveTimelineWindowStartSec + target`（字面已 0 次） |
| `validate:timeline:scrubbing` | `replayController?.seek(target);`（0 次） |
| `validate:modqn:omega-s4-heuristic-not-paper` | `handoverMode === 'decision-overlay-on-live-sinr' ? … : 'sinr-offset'`（0 次） |
| `validate:phase-e:sat-count-override` | `applySceneTopology(trainingProfile, activeSceneTopology)`（0 次） |
| `validate:phase-b:service-client` | 用 `indexOf` 對 App.tsx 做**版面順序**斷言，`aside=-1` |
| `validate:phase6b:handover-policy-controls` | 負向 `assertNotContains(appSource,'handoverPolicySection={')`，現已出現 1 次 |
| `validate:phase6c:handover-policy-placement` | 同上（同腳本的第二個 npm key） |
| `validate:modqn:phase5a-runtime-beam-layout` | 迴圈 ratchet `beamCount|beam-count`，App.tsx 已違反 |
| `validate:modqn:phase6p-hobs-sinr-kpi-baseline` | regex pin `/\bAPP_EPOCH_MS\b/` 對 App.tsx 漂移 |

另 13 個紅是別的原因（`TopologyTab.tsx`、`timelineRailAuthority`、fixture 漂移、6u→6v 串接失敗等），與 App.tsx 無關。

**所以 inverted governance 的形狀跟 §0b 寫的不一樣**：這面牆不是 41 盞綠燈擋著重構，而是**已經倒了一半、而且沒人發現**。既有紅燈本身就是 P4 的前置債務——在一半閘門已紅的地上開始分解，之後分不出「我弄紅的」和「本來就紅的」。

### （2）「41 validators read its SOURCE TEXT」——數字取決於怎麼數，而怎麼數有兩個陷阱

用 TypeScript AST（不是 grep）逐一解析後：

| | 數量 |
|---|---|
| `scripts/validate-*` 提到 `App.tsx` | 43 |
| 其中真的對 App.tsx 原始碼做斷言 | **28** |
| 只在註解／路徑清單裡提到 | 15 |
| 字面 pin（`includes('…')` / `assertContains(app,'…')`） | **223**（正向 186 / 負向 37） |
| 非字面 pin（regex `.test()`、`indexOf`、`countOccurrences`、非字面 `includes`） | **48** |

**我在這件事上自己踩了兩次坑，兩次都是 §0b 已經寫過的那類錯誤：**

1. **`source`、`app` 這種變數名會在同一個 validator 裡重綁到別的檔案**（`ArtifactPicker.tsx`、`ModqnSceneHud.tsx`…）。用檔案層級 grep 數，會把別人的 pin 算成 App.tsx 的。第一版量出 200 條，作用域感知後降到 126。
2. **這些腳本的主流寫法是多行 `assertContains(\n appSource,\n '…')`**，逐行 regex 抓不到，於是 126 又是低估。改用 AST 後才穩定在 223。

也就是說，「量一下有多少 pin」這件事本身就手刻 regex 錯了三次。**這正是 §0b 自己列的「檔名 grep ≠ 有被測」，換方向再犯**。AST 版本的驗證方式是：它必須重現實跑觀察到的每一條紅——四條逐一比對，全部命中。

## 二、223 條字面 pin 的可證明強度

| 狀態 | 條數 | 意義 |
|---|---|---|
| 正向、字面在 App.tsx 出現 **1 次** | 129 | 抓得住它指名的東西 |
| 正向、出現 **>1 次** | **41** | **可證明的假綠**：字面抓不住標籤所指的那一個 |
| 正向、出現 **0 次** | **16** | **今天已紅** |
| 負向、出現 0 次 | 35 | 真的在守 |
| 負向、出現 >0 次 | **2** | **今天已紅** |

「出現 >1 次」不是判斷，是計數。三個最極端的：

- `validate-phase-b-artifact-picker.tsx:213` 斷言 `useState<string | null>(null)` 存在，標籤說這證明「App.tsx tracks selectedUserTrainedJobId」。該字面在 App.tsx 出現 **6 次**；把 `selectedUserTrainedJobId` 整個刪掉，這條仍然綠。
- `validate-phase-e-sat-count-override.tsx:137` 的 `sceneLane === 'modqn-live-cell-preview'` 出現 **12 次**。
- `validate-phase-h-s8-hud-camera-default.ts:86` 的 `bundleProvenanceKind={bundleProvenanceKind}` 出現 **5 次**，標籤宣稱它證明 HUD 拿到了 provenance。

## 三、agy 的判斷品質（實測）

5 個 agy 併行、材料內嵌，共回 **275 列**。

- **行號與引文**：275 列全部對得上原始碼，**0 個幻覺行號**。7 列初判「找不到」，查證後都是註解列或樣板字串（`App.tsx contains ${expected}`）被 agy 正確展開——是我的核對腳本太嚴。
- **方向沒錯**：41 條標「分解後不會紅」的，沒有一條是正向字面 pin 誤標。會誤導人留著爛 pin 的那個方向，零誤判。
- **問題是漏，不是錯**：223 條字面 pin 只列到 152 條，**漏 71 條**，集中在同一檔案的後段重複區塊——材料讀完了，但表格沒寫完。**這是「材料我抽好、你判斷」這種派工的系統性弱點：它的召回率跟材料長度成反比。**下次要嘛切更細，要嘛要求它先輸出總數再逐條填。
- **它看不到的**：agy 手上沒有 App.tsx 本體，所以不知道哪些字面已經 0 次、哪些 >1 次。41 條可證明假綠裡，它判 V（該刪）11 條、判 B（可轉行為）12 條、漏列 18 條。判 B 不算錯（背後的事實確實是行為），但**「這條現在就抓不到它自己宣稱抓的東西」只有 controller 端量得出來**。

分類彙總（275 列）：**B 可轉行為 162 ／ V 該刪 76 ／ S 真結構約束 23 ／ N 非 pin 14**；分解衝擊 **RED 220 ／ OK 55**。

**第二輪（11 個 worker，套用上面的對策）驗證了這個診斷。** 每個 batch 切到 ≤25 條、≤14KB，並要求它自報條數：
**覆蓋率從 68% 拉到 95.6%**（227 條要判、回了 217、漏 10），220 列引文核對 **全數通過、0 可疑**。
順帶一提，**它自報的「實際輸出 N 列」不可信**（w6 自稱 38 列、實際 31 列）——自查機制只讓漏列更容易被發現，
真正的對帳還是要 controller 用「標記行號集合 vs 回傳行號集合」的差集去算。
第二輪新增判斷：**B 146 ／ V 68 ／ S 6**（見附錄 D）。

## 四、建議順序

1. **先處理 9 個已紅的 App pin**——修好，或明確判定該刪。這是開始分解的前置條件。
2. **76 條 V 逐條刪除前各自證明它抓不到東西。** 41 條「出現 >1 次」的用計數就是證據，不必跑 mutation；其餘的要用 mutation：把標籤宣稱保護的那個東西改掉，斷言仍綠，才算證完。
3. **162 條 B 不必一次轉完。** 分解 App.tsx 時哪一塊先動，就先補那一塊的行為斷言；其餘 pin 先刪不補——它們現在也沒在保護東西。
4. **23 條 S 去檔名化**（改成對模組圖或 glob 斷言）。這是唯一分解後仍該存在的一類。
5. **agy 第一輪漏掉的 71 條已在第二輪補判完**（附錄 D），MainScene.tsx 的 159 條也一併判了。
   仍有 10 條兩輪都沒判到，見附錄 D 開頭的統計。
6. **20 個 browser 紅燈要先分辨「app 回歸」與「閘門過期」**——已查證 5 個屬於後者（附錄 C）。

## 五、逐檔分流表

判＝agy 分類（B 可轉行為／S 真結構／V 該刪／N 非 pin）；出現次數＝controller 端 AST 實測；
⛔ 今天已紅、⚠ 可證明假綠。「未判」＝agy 漏列，需補判。

### `scripts/validate-frontend-scene-lane-governance.ts`

`validate:frontend:scene-lane-governance` — 今天 HEAD 實跑：**紅**

| 行 | 判 | 分解後 | App.tsx 出現次數 | 斷言 / 標籤 | 處置 |
|---|---|---|---|---|---|
| 623 | V | RED | 1× | App owns MODQN visual layer preset state | 斷言 useState 變數名稱是純內部實作細節，抽成 Hook 即假紅且無防護力，應直接刪除。 |
| 637 | V | RED | 1× | App scene lane import | 斷言特定 import 路徑字面值，元件拆解後即假紅，應直接刪除。 |
| 638 | B | RED | 1× | App explicit proof request into scene lane resolver | 轉為 Playwright 測試：點擊 proof toggle 按鈕，斷言 root 元素之 `data-scene-lane="modqn-replay-p |
| 645 | V | RED | 2× ⚠假綠 | App MainScene lane prop | 斷言 JSX prop 傳遞字串無法保證執行期正確性，改用 Context 亦不受影響，應直接刪除。 |
| 646 | V | RED | 2× ⚠假綠 | App ControlBar lane prop | 與 645 行同為 JSX prop 傳遞字串鎖定，刪除完全不影響任何防護。 |
| 647 | V | RED | 1× | App imports timeline and rail authority module | 斷言 import 來源字串無 runtime 意義，移至 timeline 模組即假紅，應直接刪除。 |
| 648 | V | RED | 1× | App imports the live Walker rail adapter | 模組 import 字串 pin，拆分子元件後必定假紅，應直接刪除。 |
| 649 | V | RED | 1× | App imports the live Walker event index helper | 內部 helper import 斷言，對終端行為無任何保護價值，應直接刪除。 |
| 652 | V | RED | 1× | App builds the live Walker event index outside render | 斷言函式呼叫字串無法驗證 render 外部時機，重構至 Hook 會假紅，應直接刪除。 |
| 653 | B | RED | 1× | App adapts live Walker event index to rail events | 轉為 Playwright 測試：切換至 Live 模式，斷言 `[data-testid="handover-event-map-track"]` 渲染出對應 |
| 656 | V | RED | 1× | App separates MODQN producer source horizon from display- | 內部變數名字串鎖定，時間軸長度區隔應由單元測試或 timeline 屬性驗證，應直接刪除。 |
| 661 | V | RED | 1× | App passes the active source horizon seconds to Timeline | 斷言 JSX prop 傳遞字面值，時間軸行為應由 TimelineBar 單元測試或 E2E 覆蓋，此處應刪除。 |
| 664 | V | RED | 1× | App anchors live timeline display to the selected live W | 區域常數宣告字串鎖定，搬移至 Hook 即假紅且不保證運算正確，應直接刪除。 |
| 665 | B | RED | 1× | App displays live timeline as window elapsed time, not ab | 轉為 Playwright 測試：讀取時間軸時間文字標籤，斷言顯示數值為從 0 起算的相對 elapsed 時間而非絕對時間。 |
| 666 | B | RED | 1× | App does not mutate the live Walker window start when se | 轉為 Playwright 測試：拖曳 seek 後，斷言 telemetry 或狀態中的 `demoStartOffset` 保持不變。 |
| 667 | B | RED | 1× | App bounds the absolute live seek target before dispatch | 轉為 Playwright 測試：點擊或拖曳時間軸超出範圍，斷言 seek target 被 clamp 在最大時長內。 |
| 668 | B | RED | 0× ⛔今天已紅 | App converts bottom timeline elapsed seek to absolute Wa | 轉為 Playwright 測試：在時間軸 seek 偏移量 t，斷言場景時間更新為 `windowStart + t`。 |
| 669 | V | RED | 6× ⚠假綠 | App clamps the live seek target to the governed timeline | 斷言常數名稱字串無行為防護力，已由 667 行之 clamp 行為測試覆蓋，應直接刪除。 |
| 670 | B | RED | 1× | App routes live lanes to the live Walker event index rai | 轉為 Playwright 測試：切換到 `sinr-live` 與 `modqn-live-cell-preview`，斷言 rail 事件清單來源為 Wal |
| 671 | B | RED | 1× | App keeps MODQN replay proof on producer rail events | 轉為 Playwright 測試：切換到 `modqn-replay-proof` lane，斷言 rail 上渲染 MODQN producer 之事件標記。 |
| 674 | B | RED | 3× ⚠假綠 | App browser lane telemetry | 轉為 Playwright 測試：讀取 root 元素之 `data-scene-lane` 屬性，斷言其隨當前 lane 切換同步變更。 |
| 675 | S | OK | NEG 0× | App must not promote the slow-motion producer rail axis | 去檔名化改為全域架構守門：以 ESLint 或 AST 掃描 `src/**/*.tsx`，禁止引用已棄用的 `producerDisplayTimeline` |
| 676 | V | RED | 1× | App handover rail uses descriptor-owned duration | 斷言 JSX 屬性傳遞字面值，應改由檢驗渲染後軌道寬度或 style 自訂屬性 `--handover-rail-axis-duration` 驗證，此處刪除。 |
| 677 | B | RED | 1× | App handover rail uses descriptor-owned source label | 轉為 Playwright 測試：斷言 rail 介面上的 source label 文字節點內容與當前 descriptor 定義之 label 一致。 |
| 678 | B | RED | 1× | App handover rail exposes descriptor source owner | 轉為 Playwright 測試：斷言 rail 元素上的 `data-source-owner` 屬性值與 descriptor 之 `sourceOwner |
| 679 | V | RED | 1× | App handover rail exposes descriptor source gaps | 斷言 JSX prop 字面值是實作細節，若有 gap 警告應直接以 DOM gap badge 驗證，此處應直接刪除。 |
| 680 | V | RED | 1× | App timeline duration is active-descriptor-owned | 內部變數賦值字串鎖定，使用者只在乎時間軸長度顯示，搬至 Hook 即假紅，應直接刪除。 |
| 684 | B | RED | 1× | Homepage selects the archived-TLE timeline descriptor on | 轉為 Playwright 測試：切換至 Archived TLE 場景時，斷言 TimelineBar 呈現的時間軸總長度切換為 2 小時 TLE windo |
| 685 | B | RED | 0× ⛔今天已紅 | Homepage timeline seek selects a published TLE anchor | 轉為 Playwright 測試：在首頁 TLE 模式操作時間軸 seek，斷言分析面板或場景視圖對應更新至該 TLE anchor。 |
| 686 | B | RED | 1× | Homepage timeline uses the archived-TLE anchor step only | 轉為 Playwright 測試：在 TLE 場景下檢查時間軸 slider 的 step 屬性或鍵盤 step 幅度是否符合 TLE anchor step。 |
| 687 | S | OK | NEG 0× | App must not derive timeline horizon from sceneSource al | 去檔名化改為架構 AST/linter 規則：禁止在所有前端檔案 (`src/**/*.{ts,tsx}`) 中直接以 `sceneSource === 'ar |
| 692 | S | OK | NEG 0× | App must not derive handover rail source labels from fre | 去檔名化改為架構 linter/grep 規則：禁止在任何元件中以 free `sceneSource` 字串推導 handover rail source l |
| 701 | B | OK | — | App no longer mounts the AlgorithmDock (C5: Dashboard vi | 轉為 Playwright 測試：在所有模式下斷言 `await expect(page.locator('[data-testid="algorithm-do |
| 820 | V | RED | 1× | App imports AlgorithmDashboard for the artifact-replay s | 斷言特定 import 模組字串，當 metrics 拆為獨立 Sidebar 元件時必定假紅，應直接刪除。 |
| 825 | B | RED | — | App mounts AlgorithmDashboard exactly once (artifact-rep | 轉為 Playwright 測試：在 artifact-replay 側邊欄開啟時，斷言 `await expect(page.locator('[data-t |
| 832 | V | RED | — | App AlgorithmDashboard mount exists | 與 825 行完全重複且為純字串位置檢查，刪除完全無損失。 |
| 834 | B | RED | — | App sidebar dashboard renders only the metric tiles (C4 | 轉為 Playwright 測試：在側邊欄檢查 dashboard 容器內存在 metric tiles，且 flowchart 節點 `toHaveCount |
| 835 | B | RED | — | App sidebar dashboard uses the sidebar layout variant | 轉為 Playwright 測試：斷言側邊欄內 dashboard 節點帶有 `[data-variant="sidebar"]` 屬性或對應 class。 |
| 838 | B | RED | — | App sidebar metrics are lane-owned inside the artifact r | 轉為 Playwright 測試：切換右側邊欄 tab 為 artifact 時 metric 可見，切換為 live tab 時 metric 不可見。 |
| 907 | B | RED | 1× | App mounts the headless telemetry feed for modqn-demo in | 轉為 Playwright 測試：在 `modqn-demo` 模式下切換任意 tab，驗證 telemetry 通訊（網路請求或 window 全域 tele |
| 920 | B | RED | 1× | App reads the artifact-source transport header on the re | 轉為 Playwright 測試：透過 route intercept 模擬 `X-Showcase-Artifact-Source: test-source` |
| 925 | B | RED | 1× | App warns whenever the artifact source is not the pinned | 轉為 Playwright 測試：當 artifact header 為非 pinned producer 時，斷言畫面上出現警告樣式或 warning bad |
| 930 | B | RED | 1× | App maps a completed header-absent 200 to the distinct s | 轉為 Playwright 測試：模擬無此 header 之 200 回應，斷言 `[data-testid="artifact-source-badge"]` |
| 935 | B | RED | 1× | App warn copy only calls the synthetic fixture "syntheti | 轉為 Playwright 測試：分別提供 synthetic 與 unverified source header，斷言畫面警告文字分別出現 "synthet |
| 950 | **未判** | — | 1× | `from './ui/ArtifactSourceBadge'` | （agy 漏列，待補判） |
| 955 | B | RED | 1× | App mounts the artifact-source honesty badge in the arti | 轉為 Playwright 測試：在 `artifact-replay` lane 斷言 `[data-testid="artifact-source-badg |
| 960 | B | RED | 1× | App exposes the resolved artifact source as scene teleme | 轉為 Playwright 測試：斷言 DOM 節點屬性 `[data-artifact-source]` 包含已解析的 artifact source 字串值 |
| 988 | B | RED | 1× | App exposes the director FSM phase as shell telemetry fo | 轉為 Playwright 測試：在 director 動畫各階段，讀取 DOM 上的 `data-director-phase` 屬性斷言狀態轉換。 |
| 993 | B | RED | 1× | App exposes the effective playback speed as shell teleme | 轉為 Playwright 測試：調整播放速度控制項，斷言 DOM 上的 `data-effective-speed` 屬性數值同步更新。 |
| 1031 | V | RED | 1× | App wires the extracted director orchestration hook | 斷言 App 呼叫特定 Hook 名稱是內部實作細節，重構下沉至 Scene 模組會假紅，應直接刪除。 |
| 1047 | B | RED | 1× | App labels the live Director focus claim by lane (overla | 轉為 Playwright 測試：切換兩種 live lane 並啟動 Director，斷言 `[data-live-director-focus-claim |
| 1053 | V | RED | 1× | App prefers the Worker-backed SINR-live handover index f | Worker transport 建立應封裝在專門 adapter/service 模組中，App.tsx 原始碼斷言純屬實作細節，應直接刪除。 |
| 1058 | V | RED | 1× | App posts the canonical SINR-live event-index input to t | Worker 通訊細節應由 Worker 模組自身單元測試保證，留在 App.tsx 原始碼斷言無效，應直接刪除。 |
| 1063 | V | RED | 1× | App retains the deterministic chunked SINR-live builder | Worker fallback 應在 worker adapter 內部測試與實作，App.tsx 不應包含此類細節字串，應直接刪除。 |
| 1091 | B | RED | 1× | App exposes the live Director focus claim as honesty tel | 轉為 Playwright 測試：啟用 Director focus 時，斷言 DOM 上存在 `data-live-director-focus-claim` |
| 1096 | B | RED | 1× | App exposes the resolved live Director focus event sourc | 轉為 Playwright 測試：觸發 Director focus 事件時，斷言 `data-live-director-focus-event-sec` 屬 |
| 1209 | V | RED | 1× | App imports the honest satellite azimuth compass | 斷言 import 模組字面值，拆分 UI 容器時會假紅，應直接刪除。 |
| 1214 | B | RED | — | ArtifactSatelliteCompass is mounted exactly once | 轉為 Playwright 測試：切換到 `artifact-replay` lane 時，斷言 `await expect(page.locator('[da |
| 1221 | V | RED | — | ArtifactSatelliteCompass mount exists in App | 與 1214 行重複且僅為 indexOf 檢查，完全無實質保護力，應直接刪除。 |
| 1223 | B | RED | — | ArtifactSatelliteCompass mount is lane-gated to artifact | 轉為 Playwright 測試：在 `artifact-replay` lane 斷言 compass 可見，切換至其他 lane 斷言 compass 消失 |
| 1387 | V | RED | 1× | App explicit proof request state | 斷言 useState 宣告語法是純內部狀態實現細節，搬移至 state hook 後立即假紅，應直接刪除。 |
| 1388 | B | RED | 2× ⚠假綠 | App proof request is limited to decision overlay mode | 轉為 Playwright 測試：在非 decision overlay 模式下，斷言 proof toggle 按鈕處於 disabled 狀態或不可見。 |
| 1389 | B | RED | 2× ⚠假綠 | App proof request reset outside eligible lane | 轉為 Playwright 測試：開啟 proof toggle 後切換至不支援的 lane 再切回，斷言 proof request 狀態已自動重置為關閉。 |
| 1390 | B | RED | 1× | App wires proof viewport active state into cue panel | 轉為 Playwright 測試：切換到 `modqn-replay-proof` lane，斷言 cue panel (`[data-testid="cue- |
| 1391 | B | RED | 1× | App wires proof viewport toggle callback only when eligi | 轉為 Playwright 測試：驗證符合條件時點擊 toggle 可觸發 viewport 切換，不符條件時按鈕不可點擊。 |
| 1392 | B | RED | 1× | App lane-aware left sidebar tabs | 轉為 Playwright 測試：切換不同的 sceneLane 與 handoverMode，斷言左側邊欄出現的 Tab 項目清單符合預期。 |
| 1393 | B | RED | 1× | App lane-aware right sidebar tabs | 轉為 Playwright 測試：切換不同的 sceneLane 與 handoverMode，斷言右側邊欄出現的 Tab 項目清單符合預期。 |
| 1394 | B | RED | 1× | App unified MODQN Evidence/Replay left sidebar branch | 轉為 Playwright 測試：在左側邊欄點擊 Evidence tab，斷言 Evidence 側邊欄內容面板出現。 |
| 1395 | B | RED | 1× | App folds the artifact source summary into the Evidence | 轉為 Playwright 測試：在 Evidence rail 的 artifact 子視圖下，斷言 `await expect(page.locator(' |
| 1398 | B | OK | NEG 0× | S4: App no longer renders a Setup left sidebar branch (m | 轉為 Playwright 測試：斷言左側邊欄所有 Tab 中不存在 `data-tab="setup"`。 |
| 1399 | B | RED | 1× | App artifact right sidebar branch | 轉為 Playwright 測試：在右側邊欄點選 Artifact tab，斷言 Artifact 專屬側邊欄面板呈現在 DOM 中。 |
| 1403 | B | RED | 1× | App recorded-replay scene fail-closed gate | 轉為 Playwright 測試：在 frame 未載入完成時，斷言顯示 fail-closed 預留佔位元件而非損毀的 3D 場景。 |
| 1404 | B | RED | 1× | App artifact scene fail-closed placeholder | 轉為 Playwright 測試：在載入無效/空 frame 時，斷言 `[data-testid="artifact-scene-fail-closed"]` |
| 1405 | B | RED | 1× | App skips MODQN replay bundle startup fetch outside the | 轉為 Playwright 測試：在 `artifact-replay` 模式載入頁面，監聽網路請求並斷言未發出 MODQN replay bundle 相關  |
| 1410 | V | OK | NEG 0× | App must not retain the retired MODQN replay-fetch error | 斷言已廢棄變數名不存在無實質保護，只要 UI 沒有舊版錯誤 banner 即可（由 E2E 測試覆蓋），應直接刪除。 |
| 1412 | B | RED | 2× ⚠假綠 | App should hide the MODQN Phase I HUD outside the live c | 轉為 Playwright 測試：切換到非 `modqn-live-cell-preview` lane，斷言 `[data-testid="modqn-pha |
| 1417 | B | RED | 1× | App should hide the MODQN training service banner outsid | 轉為 Playwright 測試：切換至其他 lane，斷言 `[data-testid="service-status-banner"]` 不存在於頁面。 |
| 1423 | B | OK | NEG 0× | App must not resolve the MODQN replay-proof lane from ap | 轉為 Playwright 測試：進入 `modqn-demo` 模式，在未點擊 proof toggle 前，斷言 `data-scene-lane` 不會自 |
| 1473 | B | RED | 1× | App pauses the handover rail display sweep with playback | 轉為 Playwright 測試：點擊暫停播放，斷言 handover rail 的動畫游標樣式或 class 切換為暫停狀態。 |
| 1474 | B | RED | 1× | App synchronizes handover rail display sweep with playba | 轉為 Playwright 測試：調整播放速率為 2x，斷言 handover rail DOM 上的 animation-duration 或 playbac |
| 1507 | V | RED | 1× | App imports the SINR-live display/camera drawer | 斷言 import 來源字串無助於品質，重構移至專屬 Drawer 容器即假紅，應直接刪除。 |
| 1549 | B | RED | — | App mounts the SINR-live tuners | 轉為 Playwright 測試：在 `sinr-live` 模式下，斷言 `[data-testid="sinr-live-display-drawer"]` |
| 1551 | B | RED | — | App lane-gates the SINR-live tuners on the SINR-live lan | 轉為 Playwright 測試：切換到非 `sinr-live` lane，斷言 `[data-testid="sinr-live-display-drawe |
| 1558 | B | RED | — | App mounts the global quick-control checkboxes | 轉為 Playwright 測試：在所有 sceneLane 下，斷言 `[data-testid="sinr-live-quick-controls"]` 均 |
| 1572 | B | OK | NEG 0× | SINR-live orientation card removed (it duplicated the si | 轉為 Playwright 測試：在 `sinr-live` lane 斷言 `[data-testid="sinr-live-orientation-card |
| 1577 | V | OK | NEG 0× | App no longer imports the removed orientation card | 斷言未使用的 import 字面值應由 TS/ESLint 負責，在測試中斷言字串無意義，應直接刪除。 |
| 1582 | B | OK | NEG 0× | G1-LEFT-DEFAULT: App no longer renders a signal-tuning l | 轉為 Playwright 測試：斷言左側邊欄不存在 `[data-tab="signal"]` 按鈕。 |
| 1587 | B | OK | NEG 0× | G1-LEFT-DEFAULT: App no longer renders a handover-policy | 轉為 Playwright 測試：斷言左側邊欄不存在 `[data-tab="handover"]` 按鈕。 |
| 1593 | B | RED | 1× | App injects the archived-TLE parameter surface into the | 轉為 Playwright 測試：打開 SINR-live drawer，斷言內部包含 `[data-testid="archived-tle-paramete |
| 1598 | B | RED | 1× | App keeps the Walker policy surface on the explicit teac | 轉為 Playwright 測試：在 Walker scene 啟動時打開 drawer，斷言 `[data-testid="teaching-policy-s |
| 2182 | B | RED | 1× | App threads the producer-readiness gate OR the URL over | 轉為 Playwright 測試：造訪帶有 `?modqnServiceAllocation=1` 之網址，斷言畫面上的 service allocation  |
| 2959 | V | OK | NEG 0× | App does not retain the retired top-level LaneExperience | 廢棄 import 檢查屬於 ESLint/TS 職責，無法保護執行期行為，應直接刪除。 |
| 2964 | B | OK | — | LaneExperienceBar is not mounted after the MODQN sub-nav | 轉為 Playwright 測試：斷言全域 DOM 中 `page.locator('[data-testid="lane-experience-bar"]') |
| 2969 | V | OK | NEG 0× | the canonical homepage must not import the retired Live | 檢查單一檔案的廢棄 import 字串無意義，重構拆檔後更無拘束力，應直接刪除。 |
| 2974 | B | OK | NEG 0× | the canonical homepage must not mount the retired Live / | 轉為 Playwright 測試：斷言首頁 DOM 中 `page.locator('[data-testid="modqn-view-toggle"]')`  |
| 2979 | V | RED | 1× | App owns a runtime sceneSource state (the lane switch is | 狀態宣告字串是內部實作細節；「可透過 UI 切換 lane」應轉為點擊 UI 切換按鈕並驗證場景變化的 Playwright 測試，此處刪除。 |
| 2984 | V | RED | 1× | App owns the lane experience transition handler | 斷言內部 callback 宣告字串，拆解成 Custom Hook 立即假紅，應直接刪除。 |
| 2993 | V | RED | — | handleExperienceChange exists | 與 2984 行重複且為字串位置檢測，無任何保護力，應直接刪除。 |
| 2995 | B | RED | — | lane switch cancels an armed/active Director focus (no c | 轉為 Playwright 測試：在 Director focus 啟用中觸發切換 lane，斷言 Director focus telemetry 屬性被清除 |
| 3067 | V | OK | NEG 0× | App must not import the retired in-MODQN view navigation | 與 2969 行完全重複之廢棄 import 字串斷言，應直接刪除。 |
| 3072 | B | OK | — | ModqnViewToggle must not be mounted on the canonical hom | 與 2974 行重複，轉為 Playwright 測試斷言首頁無 `[data-testid="modqn-view-toggle"]` 節點後，本斷言刪除。 |
| 3129 | V | RED | 1× | App imports the Advanced setup drawer (hosts the relocat | 模組 import 字串 pin，若 drawer 移至獨立 Shell 模組會假紅，應直接刪除。 |
| 3206 | B | RED | 1× | App exposes the MODQN decision-policy toggle only on the | 轉為 Playwright 測試：在 `modqn-live-cell-preview` lane 打開 Advanced drawer 斷言決策控制項可見，在 |
| 3221 | V | RED | 1× | App imports the NOT-paper disclosure banner | 斷言 import 字串是實作細節，搬移 banner 至獨立 Alert 容器即假紅，應直接刪除。 |
| 3226 | B | RED | 1× | App co-mounts the NOT-paper banner whenever omega-heuris | 轉為 Playwright 測試：在 `modqn-live-cell-preview` 啟用 `omega-heuristic` 模式，斷言 `[data-t |
| 3231 | B | RED | 1× | Artifact lane entry clears an active live-only omega-heu | 轉為 Playwright 測試：在 live 下啟用 omega-heuristic 後切換至 artifact-replay，斷言 handover mod |
| 3236 | B | RED | 1× | App wires the MODQN decision-policy toggle | 轉為 Playwright 測試：在 Advanced drawer 變更決策模式，斷言畫面 UI 與 telemetry 狀態相應更新。 |
| 3308 | B | RED | 1× | App mounts the Advanced setup drawer | 轉為 Playwright 測試：斷言頁面上存在 `[data-testid="advanced-setup-drawer"]`（或點擊設定按鈕可展開 draw |
| 3313 | V | RED | 7× ⚠假綠 | App passes appMode into the Advanced setup drawer | 斷言 JSX 傳遞 prop 字串，若改用 Context 注入即假紅，應由 drawer 內容行為測試覆蓋，此處刪除。 |
| 3318 | V | RED | 3× ⚠假綠 | App passes handoverMode into the Advanced setup drawer | 斷言 prop 傳遞字串，無行為驗證價值，應由 drawer 內部選項行為測試取代並直接刪除。 |
| 3323 | V | RED | 2× ⚠假綠 | App passes the MODQN visual-layer preset into the Advanc | 純內部 prop 傳遞文字 pin，刪除不影響任何功能，應直接刪除。 |
| 3328 | V | RED | 1× | App passes the live-cell decision-policy gate into the A | 與 3206 行完全重複之 JSX 屬性文字 pin，應直接刪除。 |
| 3333 | B | RED | 1× | App wires the MODQN visual-layer setter into the Advance | 轉為 Playwright 測試：在 Advanced drawer 點選圖層 preset，斷言場景圖層設定與 DOM telemetry 同步變更。 |
| 3338 | V | RED | 1× | App wires the MODQN decision-policy setter into the Adva | 與 3236 行重複，驗證 drawer 內切換決策之行為已在該處建議，此重複文字 pin 應直接刪除。 |
| 3343 | B | RED | 1× | App wires load-into-scene into the Model Library | 轉為 Playwright 測試：在 Model Library 點擊「載入至場景」，斷言 3D 場景載入新模型且 telemetry 顯示對應 model i |
| 3348 | V | OK | NEG 0× | Advanced drawer no longer owns load-into-scene after D2 | 斷言舊 prop 名稱未被使用屬於 TypeScript 型別檢查範疇，字串比對無實質防護力，應直接刪除。 |
| 3423 | B | OK | — | App no longer mounts the ViewModeToggle (C5: Dashboard v | 轉為 Playwright 測試：斷言頁面 DOM 中 `page.locator('[data-testid="view-mode-toggle"]')` 數 |
| 3428 | S | OK | NEG 0× | App has no dashboard-view branch — the 3D scene is the o | 去檔名化改為架構 guard：禁止在 `src/**/*.{ts,tsx}` 中對已廢棄的 `effectiveViewMode === 'dashboard' |

### `scripts/validate-live-walker-handover-event-focus.tsx`

`validate:live-walker:handover-event-focus` — 今天 HEAD 實跑：**綠**

| 行 | 判 | 分解後 | App.tsx 出現次數 | 斷言 / 標籤 | 處置 |
|---|---|---|---|---|---|
| 226 | **未判** | — | 1× | `timelineRailDescriptor.rail.sourceOwner === 'live-walker'` | （agy 漏列，待補判） |
| 229 | B | RED | — | App live Walker rail seek source-owner guard | 改為 Playwright 行為斷言：在 live-walker 模式點擊時間軸事件 marker，驗證畫面視圖與時間軸指標正確跳轉至目標秒數。 |
| 231 | **未判** | — | 1× | `timelineRailDescriptor.rail.sourceOwner === 'sinr-live-cell-` | （agy 漏列，待補判） |
| 234 | B | RED | — | App SINR cell-truth rail seek source-owner guard | 改為 Playwright 行為斷言：在 sinr-live-cell 模式點擊時間軸 rail，驗證 seek 事件觸發且場景狀態同步更新。 |
| 236 | **未判** | — | 1× | `timelineRailDescriptor.rail.horizonKind === 'live-walker-win` | （agy 漏列，待補判） |
| 239 | B | RED | — | App live-window rail seek horizon guard | 改為 Playwright 行為斷言：操作 live-walker-window 時間軸範圍，驗證視窗邊界限制與 seek 行為符合預期。 |
| 241 | **未判** | — | 1× | `setLiveTimelineSeekRequest({` | （agy 漏列，待補判） |
| 244 | V | RED | — | App live Walker rail source-time seek request | 建議刪除。斷言內部 React state setter 名稱 `setLiveTimelineSeekRequest` 屬實作細節，改名或重構對使用者完全無感 |

### `scripts/validate-modqn-handover-story-layer.ts`

`validate:modqn:handover-story-layer` — 今天 HEAD 實跑：**紅**

| 行 | 判 | 分解後 | App.tsx 出現次數 | 斷言 / 標籤 | 處置 |
|---|---|---|---|---|---|
| 466 | V | RED | 1× | `assertContains(app, 'const [modqnVisualLayerPreset,` | 刪除。狀態是由 App 本地持有或下沉至 context/store 對使用者無差別，功能由 controls 與圖層連動驗證。 |
| 489 | S | RED | 1× | `assertContains(app, "from './app/timelineRailAuthor` | 去檔名化：改為對 `src/` 或 timeline 相關模組掃描 import graph，確保時間軸策略統一自 `timelineRailAuthority |
| 490 | S | RED | 1× | `assertContains(app, "from './app/liveWalkerHandover` | 去檔名化：改為對軌道適配層模組進行結構檢查，確保 live Walker 事件適配經由指定適配模組匯入。 |
| 491 | S | RED | 1× | `assertContains(app, "from './scene/liveWalkerHandov` | 去檔名化：改為對事件索引建構相關檔案斷言，確保 `liveWalkerHandoverEventIndex` 引用符合架構邊界。 |
| 498 | V | RED | 1× | `assertContains(app, 'producerTraceDisplayDurationSe` | 刪除。這是私有變數命名，只要軌道 UI 渲染時間軸長度與來源視界秒數分離之行為正確即可。 |
| 502 | S | RED | 1× | `assertContains(app, 'buildLiveWalkerHandoverEventIn` | 去檔名化：改為掃描時間軸資料層/hook 模組，確保 `buildLiveWalkerHandoverEventIndex` 於正確生命週期被呼叫。 |
| 503 | S | RED | 1× | `assertContains(app, 'liveWalkerHandoverEventIndexTo` | 去檔名化：改為對 Handover rail 資料轉換管線檔案斷言，驗證轉換函式在管線中被呼叫。 |
| 504 | B | RED | 1× | `assertContains(app, "if (sceneLane === 'sinr-live'` | 轉為行為斷言：切換至 `sinr-live` 或 `modqn-live-cell-preview` lane，檢查 `[data-testid="handov |
| 505 | B | RED | 1× | `assertContains(app, "if (sceneLane === 'modqn-repla` | 轉為行為斷言：切換至 `modqn-replay-proof` lane，檢查軌道上的事件列來源標籤為 `producer trace`。 |
| 506 | S | OK | NEG 0× | `assertNotContains(app, 'producerDisplayTimeline', '` | 去檔名化：改為對 `src/` 中所有 timeline 渲染元件做負向 AST/字串掃描，防止子模組誤用 `producerDisplayTimeline`。 |
| 508 | B | RED | 0× ⛔今天已紅 | `assertContains(app, 'horizonSec={timelineRailDescri` | 轉為行為斷言：在 Playwright 檢查 TimelineBar DOM 屬性或畫面上顯示的總時間刻度是否符合來源視界秒數。 |
| 509 | V | RED | 1× | `assertContains(app, 'const liveTimelineWindowStartS` | 刪除。這是私有變數指派語法，實際行為應透過操作時間軸觀察起點 offset 是否正確錨定。 |
| 510 | B | RED | 1× | `assertContains(app, 'simState.simTimeSec - liveTime` | 轉為行為斷言：在模擬推進時，讀取 TimelineBar 顯示的時間文字，驗證其顯示為相對視窗經過時間。 |
| 511 | B | RED | 1× | `assertContains(app, 'demoStartOffsetSec: demoStartO` | 轉為行為斷言：操作時間軸進行 seek（跳轉）後，驗證 live Walker window 起點狀態未被竄改。 |
| 512 | B | RED | 0× ⛔今天已紅 | `assertContains(app, 'const absoluteTargetSec = live` | 轉為行為斷言：在時間軸 seek 到指定秒數，驗證模擬引擎接收到的目標時間已正確加上 window offset。 |

### `scripts/validate-modqn-omega-s1-sidebar-truth-up.tsx`

`(無 npm key)` — 今天 HEAD 實跑：**未跑**

| 行 | 判 | 分解後 | App.tsx 出現次數 | 斷言 / 標籤 | 處置 |
|---|---|---|---|---|---|
| 133 | **未判** | — | 0× ⛔今天已紅 | `useModqnDemoStub` | （agy 漏列，待補判） |
| 135 | S | OK | — | `S1.1a: src/App.tsx must not import useModqnDemoStub` | 真結構約束（禁止匯入已刪除的 demo stub），應去檔名化為使用 ESLint/AST 規則掃描 `src/**/*.{ts,tsx}` 全專案禁止匯入 ` |

### `scripts/validate-modqn-omega-s2-runtime-fetch.tsx`

`(無 npm key)` — 今天 HEAD 實跑：**未跑**

| 行 | 判 | 分解後 | App.tsx 出現次數 | 斷言 / 標籤 | 處置 |
|---|---|---|---|---|---|
| 76 | S | OK | — | `S2.1: src/App.tsx must not import MODQN_PHASE7F_REPLAY_PLAYBACK_SHELL_MODEL` | 去檔名化：改為對 `src/**/*.{ts,tsx}`（排除 `playback-shell.ts`）做靜態 import 檢查，確保全專案 UI 模組皆未引 |
| 83 | B | RED | — | `S2.1a: App.tsx must wire fetchModqnReplayBundleEnvelope` | 轉為行為斷言：在 Playwright 中攔截網路請求，驗證進入重播模式時會發出 bundle envelope 請求並將資料填入介面。 |
| 84 | **未判** | — | 4× ⚠假綠 | `fetchModqnReplayBundleEnvelope` | （agy 漏列，待補判） |
| 89 | B | RED | — | `S2.1b: App.tsx must call getModqnReplayPlaybackFallbackShellModel for fallback path` | 轉為行為斷言：模擬 bundle fetch 失敗情境，驗證畫面自動降級使用 fallback shell 正常渲染 10 個 slot 且無錯誤崩潰。 |
| 90 | **未判** | — | 2× ⚠假綠 | `getModqnReplayPlaybackFallbackShellModel` | （agy 漏列，待補判） |
| 104 | B | OK | — | `S2.1d: App.tsx must not mount the removed MODQN bundle fetch warning banner` | 轉為行為斷言：在 fetch 失敗時透過 Playwright 斷言 DOM 內 `[data-testid="modqn-bundle-fetch-banne |
| 105 | **未判** | — | 0× ⛔今天已紅 | `data-testid="modqn-bundle-fetch-banner"` | （agy 漏列，待補判） |
| 109 | V | OK | — | `S2.1d: App.tsx must not mount the removed MODQN bundle fetch warning banner` | 刪除。這是比對 CSS class 字串，與上一條 testid 檢查重複且無語意保護力，使用者完全無法感知。 |
| 110 | **未判** | — | 0× ⛔今天已紅 | `leo-modqn-bundle-fetch-banner` | （agy 漏列，待補判） |

### `scripts/validate-modqn-omega-s3-replay-mode-wiring.tsx`

`(無 npm key)` — 今天 HEAD 實跑：**未跑**

| 行 | 判 | 分解後 | App.tsx 出現次數 | 斷言 / 標籤 | 處置 |
|---|---|---|---|---|---|
| 12 | N | OK | — | `//   (g) data-handover-criterion attribute is added` | 標頭說明註解，無實際斷言邏輯，重構時隨註解更新。 |
| 261 | B | RED | — | `assert(\n    appSrc.includes('data-handover-criteri` | 轉為 Playwright 行為斷言：在頁面中定位 canvas（如 `[data-testid="leo-shell-canvas"]`），驗證具備 `dat |
| 262 | **未判** | — | 1× | `data-handover-criterion` | （agy 漏列，待補判） |
| 265 | B | RED | — | `assert(\n    appSrc.includes("handoverMode === 'dec` | 轉為行為斷言：切換 handoverMode，驗證 canvas 上的 `data-handover-criterion` 屬性值在兩模式間正確切換。 |
| 266 | **未判** | — | 0× ⛔今天已紅 | `handoverMode === 'decision-overlay-on-live-sinr' ? 'decision` | （agy 漏列，待補判） |
| 269 | B | RED | — | `assert(\n    appSrc.includes("if (handoverMode !== ` | 轉為行為斷言：在非 overlay 模式下，檢查頁面上 MODQN replay 覆蓋圖層 DOM 節點不存在或為空。 |
| 270 | **未判** | — | 1× / 11× ⚠假綠 | `if (handoverMode !== 'decision-overlay-on-live-sinr')` | （agy 漏列，待補判） |
| 318 | B | RED | — | `assert(\n    appSrc.includes('<LaneExperienceBar va` | 轉為行為斷言：點選 `[data-testid="lane-experience-bar"]` 上的選項，驗證應用程式模式與對應視圖正確切換。 |
| 319 | **未判** | — | 0× ⛔今天已紅 | `<LaneExperienceBar value={sceneLane} onChange={handleExperie` | （agy 漏列，待補判） |
| 398 | B | RED | — | `assert(\n    appSrc.includes('readInitialRuntimeSta` | 轉為行為斷言：開機/載入頁面並處於 overlay 模式時，驗證 profile 選擇器維持預設 profile 而未被強制覆寫。 |
| 399 | **未判** | — | 2× ⚠假綠 | `readInitialRuntimeState` | （agy 漏列，待補判） |
| 400 | **未判** | — | NEG 0× | `selectedProfileId: handoverMode === 'decision-overlay-on-liv` | （agy 漏列，待補判） |
| 403 | B | OK | — | `assert(\n    !appSrc.includes('window.confirm')\n ` | 轉為行為斷言：在 Playwright 監聽 dialog 事件並切換至 overlay 模式，驗證無跳出 confirm 對話框且無自動切換 profile。 |
| 404 | **未判** | — | NEG 0× | `window.confirm` | （agy 漏列，待補判） |
| 405 | **未判** | — | NEG 0× | `decision-overlay-on-live-sinr requires the modqn-1sat-7beam ` | （agy 漏列，待補判） |
| 406 | **未判** | — | NEG 0× | `resetRuntimeToProfile(targetProfileId)` | （agy 漏列，待補判） |
| 407 | **未判** | — | NEG 0× | `previousNonModqnProfileIdRef` | （agy 漏列，待補判） |
| 410 | B | RED | — | `assert(\n    appSrc.includes('getLeftSidebarTabsFor` | 轉為行為斷言：切換不同 MODQN 子場景，檢查左側側邊欄渲染的 Tab 清單是否符合規格且預設開啟 Evidence tab。 |
| 411 | **未判** | — | 2× ⚠假綠 | `getLeftSidebarTabsForSceneLane` | （agy 漏列，待補判） |
| 421 | B | RED | — | `assert(\n    appSrc.includes('getRightSidebarTabsFo` | 轉為行為斷言：在不同 scene lane 下，檢查右側側邊欄渲染的 Tab 集合（SINR/Evidence/Artifact）符合隔離設計。 |
| 422 | **未判** | — | 2× ⚠假綠 | `getRightSidebarTabsForSceneLane` | （agy 漏列，待補判） |
| 433 | B | RED | — | `assert(\n    appSrc.includes('handoverMode={handove` | 轉為行為斷言：切換 handoverMode，驗證 live status 與 evidence panel UI 上的 mode 狀態展示即時連動。 |
| 434 | **未判** | — | 3× ⚠假綠 | `handoverMode={handoverMode}` | （agy 漏列，待補判） |
| 437 | B | RED | — | `assert(\n    appSrc.includes('resolveSceneLane({')\` | 轉為行為斷言：驗證在未發起明確 proof 請求時，即使處於 `modqn-demo` 模式，系統亦不會自動切入 `modqn-replay-proof` la |
| 438 | **未判** | — | 1× | `resolveSceneLane({` | （agy 漏列，待補判） |
| 439 | **未判** | — | 13× ⚠假綠 | `appMode,` | （agy 漏列，待補判） |
| 440 | **未判** | — | 17× ⚠假綠 | `sceneSource,` | （agy 漏列，待補判） |
| 441 | **未判** | — | 1× | `modqnReplayProofRequested: modqnReplayProofRequestActive` | （agy 漏列，待補判） |
| 442 | **未判** | — | NEG 0× | `modqnReplayProofRequested: appMode === 'modqn-demo'` | （agy 漏列，待補判） |

### `scripts/validate-modqn-omega-s4-heuristic-not-paper.tsx`

`validate:modqn:omega-s4-heuristic-not-paper` — 今天 HEAD 實跑：**紅**

| 行 | 判 | 分解後 | App.tsx 出現次數 | 斷言 / 標籤 | 處置 |
|---|---|---|---|---|---|
| 217 | B | RED | — | `App.tsx uses the public decision-overlay-on-live-sinr/sinr-offset ternary literal` | 轉為行為斷言：切換交遞模式時，透過 Playwright 斷言容器的 `data-handover-criterion` 屬性正確反映所選模式。 |
| 218 | **未判** | — | 0× ⛔今天已紅 | `handoverMode === 'decision-overlay-on-live-sinr' ? 'decision` | （agy 漏列，待補判） |
| 221 | B | OK | — | `App.tsx does not emit the removed 'omega-heuristic-not-paper' criterion` | 轉為行為斷言：在各種操作狀態下斷言 DOM 任何元素的 `data-handover-criterion` 皆不會出現已廢除的值。 |
| 222 | **未判** | — | NEG 0× | `'omega-heuristic-not-paper'` | （agy 漏列，待補判） |
| 229 | B | RED | — | `App.tsx co-mounts HeuristicNotPaperBanner gated on omega-heuristic AND the modqn-live lan | 轉為行為斷言：在 `modqn-live-cell-preview` 啟用 `omega-heuristic` 斷言 Banner 出現，切換至其他 lane  |
| 230 | **未判** | — | 1× | `handoverMode === 'omega-heuristic' && sceneLane === 'modqn-l` | （agy 漏列，待補判） |
| 472 | S | OK | — | `No keyboard handler near omega-heuristic references in App.tsx/main.tsx` | 去檔名化：改為對 `src/**/*.{ts,tsx}` 靜態掃描，確保全專案中無任何鍵盤事件監聽器（`keydown`/`keyup`）可旁路觸發此模式。 |
| 476 | S | OK | — | `No URL/search parser near omega-heuristic references in App.tsx/main.tsx` | 去檔名化：改為對 `src/**/*.{ts,tsx}` 做全域 URL/Query 參數解析掃描，確保無 query 參數可旁路啟用該模式。 |

### `scripts/validate-modqn-phase5a-runtime-beam-layout.ts`

`validate:modqn:phase5a-runtime-beam-layout` — 今天 HEAD 實跑：**紅**

| 行 | 判 | 分解後 | App.tsx 出現次數 | 斷言 / 標籤 | 處置 |
|---|---|---|---|---|---|
| 226 | B | OK | — | ${relativePath} exposed 7/19/37 as a UI control | 改為 Playwright 行為斷言：檢查控制面板 DOM，斷言 `expect(page.getByText(/7\s*\/\s*19\s*\/\s*37/) |
| 227 | B | OK | — | ${relativePath} exposed 19/37 beam-count UI wording | 改為 Playwright 行為斷言：斷言 UI DOM 中無匹配 `/19[- ]?beam\|37[- ]?beam/i` 的文字節點。 |

### `scripts/validate-modqn-phase6l-r1-channel-adapter-parity-backfill.ts`

`validate:modqn:phase6l-r1-channel-adapter-parity-backfill` — 今天 HEAD 實跑：**綠**

| 行 | 判 | 分解後 | App.tsx 出現次數 | 斷言 / 標籤 | 處置 |
|---|---|---|---|---|---|
| 106 | N | OK | — | 'src/App.tsx' | 僅為常數路徑清單，無字串斷言；未來若重構拆分模組，確保掃描清單或 glob 涵蓋新目錄即可。 |

### `scripts/validate-modqn-phase6o-channel-adapter-parity.ts`

`validate:modqn:phase6o-channel-adapter-parity` — 今天 HEAD 實跑：**綠**

| 行 | 判 | 分解後 | App.tsx 出現次數 | 斷言 / 標籤 | 處置 |
|---|---|---|---|---|---|
| 250 | N | OK | — | 'src/App.tsx' | 僅為常數路徑清單，無字串斷言；無需特殊處置。 |

### `scripts/validate-modqn-phase6p-hobs-sinr-kpi-baseline.ts`

`validate:modqn:phase6p-hobs-sinr-kpi-baseline` — 今天 HEAD 實跑：**紅**

| 行 | 判 | 分解後 | App.tsx 出現次數 | 斷言 / 標籤 | 處置 |
|---|---|---|---|---|---|
| 277 | N | OK | — | `'src/App.tsx',` | 僅為受檢檔案路徑清單常數宣告，非斷言；若 App.tsx 拆分，後續維護可將此路徑替換為拆分後的子目錄。 |
| 745 | V | RED | — | `App APP_EPOCH_MS import/use` | 斷言特定常數識別字是否存在於 App.tsx 文字中；若時間轉換封裝至自訂 hook 或時間模組會假紅，時間計算是否正確由時間軸顯示行為測試保證，應刪除。 |

### `scripts/validate-modqn-phase6r-runtime-frame-step-boundary.ts`

`validate:modqn:phase6r-runtime-frame-step-boundary` — 今天 HEAD 實跑：**綠**

| 行 | 判 | 分解後 | App.tsx 出現次數 | 斷言 / 標籤 | 處置 |
|---|---|---|---|---|---|
| 46 | N | OK | — | 'src/App.tsx' | 僅為常數路徑清單，無字串斷言；無需特殊處置。 |

### `scripts/validate-modqn-phase6t-source-channel-shadow-kpi.ts`

`validate:modqn:phase6t-source-channel-shadow-kpi` — 今天 HEAD 實跑：**紅**

| 行 | 判 | 分解後 | App.tsx 出現次數 | 斷言 / 標籤 | 處置 |
|---|---|---|---|---|---|
| 300 | N | OK | — | 'src/App.tsx' | 僅為常數路徑清單，無字串斷言；無需特殊處置。 |

### `scripts/validate-modqn-phase6u-beam-gain-mismatch.ts`

`validate:modqn:phase6u-beam-gain-mismatch` — 今天 HEAD 實跑：**紅**

| 行 | 判 | 分解後 | App.tsx 出現次數 | 斷言 / 標籤 | 處置 |
|---|---|---|---|---|---|
| 235 | N | OK | — | 'src/App.tsx' | 僅為常數路徑清單，無字串斷言；無需特殊處置。 |

### `scripts/validate-modqn-phase6v-antenna-pattern-convention.ts`

`validate:modqn:phase6v-antenna-pattern-convention` — 今天 HEAD 實跑：**紅**

| 行 | 判 | 分解後 | App.tsx 出現次數 | 斷言 / 標籤 | 處置 |
|---|---|---|---|---|---|
| 136 | N | OK | — | 'src/App.tsx' | 僅為常數路徑清單，無字串斷言；無需特殊處置。 |

### `scripts/validate-modqn-phase7k-replay-scene-layer.ts`

`validate:modqn:phase7k-replay-scene-layer` — 今天 HEAD 實跑：**紅**

| 行 | 判 | 分解後 | App.tsx 出現次數 | 斷言 / 標籤 | 處置 |
|---|---|---|---|---|---|
| 419 | **未判** | — | 1× | `if (handoverMode !== 'decision-overlay-on-live-sinr')` | （agy 漏列，待補判） |
| 422 | B | RED | — | `App replay-to-scene mode gate` | 轉為 Playwright 行為測試：在 UI 切換 `handoverMode`，驗證在非 `decision-overlay-on-live-sinr` 模 |
| 424 | **未判** | — | 2× ⚠假綠 | `createOmegaRescalarizedModqnReplayPlaybackDisplayState` | （agy 漏列，待補判） |
| 427 | V | RED | — | `App replay-to-scene bridge` | 斷言內部 helper 函式名稱是否存在於 App.tsx；若重構為 adapter 模組或 hook 則假紅，只要重播資料正確渲染在場景中即可，使用者無感，應 |
| 444 | **未判** | — | 1× | `<ModqnReplayCuePanel` | （agy 漏列，待補判） |
| 448 | B | RED | — | `App replay sidebar cue panel` | 轉為 Playwright 行為測試：在進入重播相關模式時，斷言側邊欄中存在 `[data-testid="modqn-replay-cue-panel"]`。 |
| 449 | **未判** | — | 1× | `modqnReplayProofRequested: modqnReplayProofRequestActive` | （agy 漏列，待補判） |
| 453 | V | RED | — | `App must resolve the scene lane before mounting replay scene proof` | 斷言元件內部 state 變數對 prop 的傳遞字面值；重構或更名 state 時使用者完全無感，且 lane 是否啟用已可由場景渲染行為驗證，應刪除。 |
| 459 | **未判** | — | NEG 0× | `modqnReplayProofRequested: appMode === 'modqn-demo'` | （agy 漏列，待補判） |
| 462 | B | RED | — | `App must not resolve the MODQN replay-proof lane from broad MODQN mode alone (explicit re | 轉為 Playwright 負向行為測試：切換到 `modqn-demo` 但未發起 proof request 時，斷言場景中不存在 replay scene |

### `scripts/validate-modqn-showcase-final-audit.ts`

`validate:modqn:showcase-final-audit` — 今天 HEAD 實跑：**綠**

| 行 | 判 | 分解後 | App.tsx 出現次數 | 斷言 / 標籤 | 處置 |
|---|---|---|---|---|---|
| 81 | B | RED | — | D7 paper-faithful load is wired through Model Library | 改為 Playwright 行為斷言：在 Model Library 彈窗點擊載入 paper-faithful 按鈕，驗證應用程式狀態與參數成功切換。 |
| 82 | B | RED | — | D7 synthetic/non-producer source is visible in Model Library | 改為 Playwright 行為斷言：開啟 Model Library，驗證 `[data-testid="showcase-artifact-source"] |

### `scripts/validate-modqn-visual-showcase-p1e-static-frame-integration.ts`

`validate:modqn:visual-showcase:p1e:static-frame-integration` — 今天 HEAD 實跑：**綠**

| 行 | 判 | 分解後 | App.tsx 出現次數 | 斷言 / 標籤 | 處置 |
|---|---|---|---|---|---|
| 36 | N | OK | — | App.tsx (JSDoc 說明文字) | 僅為頂部 JSDoc 註解中提及 App.tsx，無任何程式碼斷言，無需處理。 |

### `scripts/validate-modqn-visual-showcase-p2b-display-filter.ts`

`validate:modqn:visual-showcase:p2b:display-filter` — 今天 HEAD 實跑：**綠**

| 行 | 判 | 分解後 | App.tsx 出現次數 | 斷言 / 標籤 | 處置 |
|---|---|---|---|---|---|
| 29 | N | OK | — | // Mirror App.tsx processing logic | 僅為單行註解提及 App.tsx，無斷言；未來建議直接匯入共享模組而非手動鏡像邏輯。 |

### `scripts/validate-phase-b-artifact-picker.tsx`

`validate:phase-b:artifact-picker` — 今天 HEAD 實跑：**綠**

| 行 | 判 | 分解後 | App.tsx 出現次數 | 斷言 / 標籤 | 處置 |
|---|---|---|---|---|---|
| 9 | N | OK | — | `//   (e) App.tsx wires picker, load handler,` | 檔案開頭的驗證項目說明註解，無實際斷言邏輯，隨重構更新註解即可。 |
| 211 | V | RED | 1× | `assert(source.includes('import { ArtifactPicker }')` | 刪除。斷言特定 import 字面寫法是實作細節，搬移至子版面或容器元件時會假紅，對使用者無差別。 |
| 212 | V | RED | 2× ⚠假綠 | `assert(source.includes('fetchTrainingServiceManife` | 刪除。斷言函式名稱存在無法保證資料請求與處理正確，封裝到 Hook 或子模組後會假紅，使用者無感。 |
| 213 | V | RED | 6× ⚠假綠 | `assert(source.includes('useState<string \\| null>(nu` | 刪除。斷言通用的 useState 宣告字串毫無語意保護力且極易假紅，應由選取 Job 的 UI 互動行為替代。 |
| 214 | V | RED | — | `assert(\n    source.includes("useState<'paper-fait` | 刪除。斷言內部 State 宣告型別字串過度拘泥實作，真實驗證應由 UI 初始呈現的 provenance chip 取代。 |
| 215 | **未判** | — | 1× | `useState<'paper-faithful' \\| 'user-trained'>('paper-faithful'` | （agy 漏列，待補判） |
| 218 | V | RED | 2× ⚠假綠 | `assert(source.includes('handleLoadIntoScene'), 'App` | 刪除。內部回呼函式名稱為私有實作，更名、改為 inline 或抽離皆不影響載入功能。 |
| 219 | B | RED | 1× | `assert(source.includes('<ArtifactPicker'), 'App.tsx` | 轉為 Playwright 行為斷言：在 `modqn-demo` 模式下，檢查頁面上是否存在 `[data-testid="artifact-picker"] |
| 220 | B | RED | — | `assert(\n    source.includes('onLoadEntry={handleLo` | 轉為行為斷言：在 ArtifactPicker 中點選 entry 載入按鈕，驗證場景/狀態是否成功切換為該 artifact 模型。 |
| 221 | **未判** | — | 1× | `onLoadEntry={handleLoadIntoScene}` | （agy 漏列，待補判） |
| 224 | B | RED | — | `assert(\n    source.includes('onLoadPaperFaithful=` | 轉為行為斷言：點擊 `[data-testid="revert-to-paper-faithful"]` 後，驗證系統切換回 baseline（如 banner |
| 225 | **未判** | — | 1× | `onLoadPaperFaithful={handleRevertToPaperFaithful}` | （agy 漏列，待補判） |
| 228 | B | RED | — | `assert(\n    source.includes('artifactReplaySource` | 轉為行為斷言：切換 artifact replay 來源時，驗證 Model Library 清單項目之 `[data-artifact-kind]` 是否正確 |
| 229 | **未判** | — | 1× | `artifactReplaySource={showcaseArtifactSource}` | （agy 漏列，待補判） |
| 232 | B | RED | — | `assert(\n    countOccurrences(source, 'bundleProve` | 轉為行為斷言：切換 provenance 為 `user-trained` 時，驗證 Banner 與 Model Library 等節點是否同步渲染 `use |

### `scripts/validate-phase-b-jobs-panel.tsx`

`validate:phase-b:jobs-panel` — 今天 HEAD 實跑：**綠**

| 行 | 判 | 分解後 | App.tsx 出現次數 | 斷言 / 標籤 | 處置 |
|---|---|---|---|---|---|
| 197 | S | OK | NEG 0× | `App.tsx no longer imports JobsPanel directly (moved to the Advanced drawer)` | 去檔名化：改為架構層級檢查（如 ESLint import 限制），確保 `JobsPanel` 僅能由 `AdvancedSetupDrawer` 引入。 |
| 200 | V | RED | — | `App.tsx imports the Advanced setup drawer` | 刪除。字面斷言 App.tsx import 抽屜無防護力，抽屜元件若被收納進 Layout 元件會假紅，使用者只在乎抽屜能否開啟。 |
| 201 | **未判** | — | 1× | `import { AdvancedSetupDrawer } from './ui/AdvancedSetupDrawe` | （agy 漏列，待補判） |
| 204 | B | RED | — | `App.tsx mounts the Advanced setup drawer` | 轉為行為斷言：在 MODQN 模式下透過 Playwright 斷言 DOM 中存在 Drawer 觸發按鈕或抽屜容器。 |
| 205 | **未判** | — | 1× | `<AdvancedSetupDrawer` | （agy 漏列，待補判） |
| 216 | B | RED | — | `App.tsx wires Advanced setup drawer MODQN decision-policy setter` | 轉為行為斷言：在 Drawer 內變更 decision policy，驗證 policy handler 觸發且模擬參數更新。 |
| 223 | B | RED | — | `App.tsx gates the Advanced drawer on the MODQN lanes (never on SINR)` | 轉為行為斷言：切換至 `sinr-live` 時斷言 Drawer 按鈕不存在於 DOM，切換回 MODQN 時斷言存在。 |
| 241 | B | OK | — | `S4: App.tsx no longer renders a 'setup' left tab branch` | 轉為行為斷言：斷言左側導覽列中不存在 `[data-testid="tab-setup"]` 節點。 |
| 242 | **未判** | — | NEG 0× | `activeLeftSidebarTab === 'setup'` | （agy 漏列，待補判） |

### `scripts/validate-phase-b-service-client.tsx`

`validate:phase-b:service-client` — 今天 HEAD 實跑：**紅**

| 行 | 判 | 分解後 | App.tsx 出現次數 | 斷言 / 標籤 | 處置 |
|---|---|---|---|---|---|
| 184 | **未判** | — | 1× | `import { ServiceStatusBanner } from './ui/modqn-training/Ser` | （agy 漏列，待補判） |
| 185 | V | RED | — | `App.tsx imports ServiceStatusBanner` | 斷言 import 語句字面寫法；若將右側欄拆為獨立模組匯入即假紅，面板能否正常使用對使用者無差，應刪除。 |
| 188 | **未判** | — | 1× | `<ServiceStatusBanner appMode={appMode} />` | （agy 漏列，待補判） |
| 189 | B | RED | — | `App.tsx mounts ServiceStatusBanner with appMode` | 轉為 Playwright 行為測試：切換 `appMode`，斷言 `[data-testid="service-status-banner"]` 的顯示狀態 |
| 197 | B | RED | — | `ServiceStatusBanner appears after leo-shell-right aside and before SidebarTabShell` | 轉為 Playwright 行為測試：在右側欄 `aside.leo-shell-right` 內，斷言 ServiceStatusBanner 之 DOM 節 |

### `scripts/validate-phase-b-training-form.tsx`

`validate:phase-b:training-form` — 今天 HEAD 實跑：**綠**

| 行 | 判 | 分解後 | App.tsx 出現次數 | 斷言 / 標籤 | 處置 |
|---|---|---|---|---|---|
| 160 | **未判** | — | 1× | `import { AdvancedSetupDrawer } from './ui/AdvancedSetupDrawe` | （agy 漏列，待補判） |
| 161 | V | RED | — | `App.tsx imports AdvancedSetupDrawer` | 斷言 import 語句字面寫法；屬於實作細節，搬遷時必紅且使用者無感，應刪除。 |
| 164 | **未判** | — | 1× | `<AdvancedSetupDrawer` | （agy 漏列，待補判） |
| 165 | B | RED | — | `App.tsx mounts AdvancedSetupDrawer` | 轉為 Playwright 行為測試：點擊開啟 Advanced Drawer 按鈕，斷言 `[data-testid="advanced-setup-draw |

### `scripts/validate-phase-c-artifact-fail-closed-browser.ts`

`(無 npm key)` — 今天 HEAD 實跑：**未跑**

| 行 | 判 | 分解後 | App.tsx 出現次數 | 斷言 / 標籤 | 處置 |
|---|---|---|---|---|---|
| 4 | N | OK | — | App.tsx ~1948-1956 (JSDoc 說明文字) | 僅為 JSDoc 審計說明，無任何程式碼字串斷言，無需處理。 |

### `scripts/validate-phase-c-camera-preset.tsx`

`validate:phase-c:camera-preset` — 今天 HEAD 實跑：**紅**

| 行 | 判 | 分解後 | App.tsx 出現次數 | 斷言 / 標籤 | 處置 |
|---|---|---|---|---|---|
| 301 | B | RED | — | `intra TRIGGER button jogs the primary UE to force a real intra HO — seek-free so the puls | 轉為行為斷言：點擊 `[data-testid="director-intra-trigger"]`，驗證 UE 產生 jog 位移並觸發 intra hand |
| 305 | B | RED | — | `intra FOCUS button arms the cinema ONLY (no jog) — the seek no longer cold-attaches the j | 轉為行為斷言：點擊 `[data-testid="director-intra-focus"]`，驗證相機進入 armed 狀態且 UE 座標保持不變。 |
| 309 | B | RED | — | `App gates the inter button on a source-backed inter rail event` | 轉為行為斷言：載入無 inter 事件的資料時斷言 `director-inter-focus` 按鈕 disabled，載入有 inter 資料時斷言 ena |
| 523 | B | RED | — | `App mounts CinematicSeekFadeOverlay gated on the director cinematic OR live focus (ITEM # | 轉為行為斷言：觸發 Director focus 時，斷言遮罩元件掛載並在動畫淡入淡出（150ms）後完成 seek。 |

### `scripts/validate-phase-c-scene-scale-override.tsx`

`validate:phase-c:scene-scale-override` — 今天 HEAD 實跑：**紅**

| 行 | 判 | 分解後 | App.tsx 出現次數 | 斷言 / 標籤 | 處置 |
|---|---|---|---|---|---|
| 144 | V | RED | — | App.tsx contains sceneVisualScale={ | 建議刪除。此為 JSX prop 傳遞字面語法 pin，應由整體 scale 行為測試保護，直接刪除字串斷言。 |

### `scripts/validate-phase-d-app-wire.tsx`

`validate:phase-d:app-wire` — 今天 HEAD 實跑：**紅**

| 行 | 判 | 分解後 | App.tsx 出現次數 | 斷言 / 標籤 | 處置 |
|---|---|---|---|---|---|
| 99 | V | RED | — | `App.tsx imports fetchUserTrainedBundleEnvelope from training-trigger path` | 刪除。斷言特定檔案的 import 路徑字面寫法極脆弱，搬到 hook 即假紅，功能應由載入模型的 E2E 流程保護。 |
| 100 | **未判** | — | 1× | `import { fetchUserTrainedBundleEnvelope } from './modqn/trai` | （agy 漏列，待補判） |
| 110 | V | RED | — | `App.tsx imports fetchModqnReplayBundleEnvelope from replay-bundle barrel` | 刪除。字面比對 barrel import 字串無法保證正確性，重構拆檔只會帶來阻礙，使用者無感知。 |
| 121 | V | RED | — | `App.tsx imports createModqnReplayPlaybackShellModel` | 刪除。內部狀態建構 helper 的引用位置屬於實作細節，移入 store 或 hook 不影響任何畫面行為。 |
| 125 | V | RED | — | `App.tsx imports createModqnReplayPlaybackDisplayState` | 刪除。斷言 App.tsx 匯入特定 helper 名稱，改用 Context 或 Reducer 時會造成假紅但功能完全正常。 |
| 129 | V | RED | — | `App.tsx imports getModqnReplayPlaybackModelValidationIssue` | 刪除。驗證函式之呼叫位置應封裝在資料層，對頂層元件斷言 import 毫無保護力。 |
| 233 | **未判** | — | 1× | `data-testid="load-into-scene-error-banner"` | （agy 漏列，待補判） |
| 247 | B | RED | — | `App.tsx passes handleRevertToPaperFaithful into ArtifactPicker` | 轉為行為斷言：在 Playwright 點擊 `[data-testid="revert-to-paper-faithful"]`，斷言場景狀態與資料成功還原為 |
| 248 | **未判** | — | 1× | `onLoadPaperFaithful={handleRevertToPaperFaithful}` | （agy 漏列，待補判） |
| 270 | S | OK | — | `App.tsx does not import fetchArtifactManifest` | 去檔名化：改為對 `src/**/*.{ts,tsx}` 掃描，確保全專案任何 UI 模組皆不得引入已棄用的 `artifactManifest`。 |
| 274 | V | RED | — | `handleLoadIntoScene does not call fetchArtifactManifest` | 刪除。正則解析 App.tsx 內部 callback 內容極度脆弱且與第 270 行全域禁止 import 重複，函式改名或外移即壞。 |
| 326 | **未判** | — | NEG 0× | `satsPerPlane: envAxes.nSatellites` | （agy 漏列，待補判） |

### `scripts/validate-phase-d-decision-viz.tsx`

`validate:phase-d:decision-viz` — 今天 HEAD 實跑：**紅**

| 行 | 判 | 分解後 | App.tsx 出現次數 | 斷言 / 標籤 | 處置 |
|---|---|---|---|---|---|
| 265 | **未判** | — | 1× | `import { DecisionVizPanel } from './ui/modqn-training/Decisi` | （agy 漏列，待補判） |
| 266 | V | RED | — | `App.tsx imports DecisionVizPanel from modqn-training path` | 斷言特定檔案路徑的 import 字面語法；若抽取為側邊欄子模組或透過 barrel 匯入會假紅，使用者無感，應刪除。 |
| 268 | B | RED | — | `DecisionVizPanel mounts inside leo-modqn-sidebar-stack section` | 轉為 Playwright 行為測試：在 MODQN 模式下，斷言 `section.leo-modqn-sidebar-stack` 內掛載了 `[data- |
| 272 | B | RED | — | `DecisionVizPanel mount appears after RewardCurvePanel` | 轉為 Playwright 行為測試：在側邊欄中檢查 DOM 順序，斷言 `[data-testid="reward-curve-panel"]` 渲染在 `[ |

### `scripts/validate-phase-d-reward-curve.tsx`

`validate:phase-d:reward-curve` — 今天 HEAD 實跑：**紅**

| 行 | 判 | 分解後 | App.tsx 出現次數 | 斷言 / 標籤 | 處置 |
|---|---|---|---|---|---|
| 281 | **未判** | — | 1× | `import { RewardCurvePanel } from './ui/modqn-training/Reward` | （agy 漏列，待補判） |
| 282 | V | RED | — | `App.tsx imports RewardCurvePanel from modqn-training path` | 斷言 import 字面值；若模組搬移至新子樹或透過 re-export 匯入會假紅，使用者無感，應刪除。 |
| 286 | B | RED | — | `RewardCurvePanel mounts inside leo-modqn-sidebar-stack section` | 轉為 Playwright 行為測試：在 MODQN 模式下檢查側邊欄容器內是否存在 `[data-testid="reward-curve-panel"]`。 |

### `scripts/validate-phase-e-sat-count-override.tsx`

`validate:phase-e:sat-count-override` — 今天 HEAD 實跑：**紅**

| 行 | 判 | 分解後 | App.tsx 出現次數 | 斷言 / 標籤 | 處置 |
|---|---|---|---|---|---|
| 128 | **未判** | — | 0× ⛔今天已紅 | `applySceneTopology(trainingProfile, activeSceneTopology)` | （agy 漏列，待補判） |
| 129 | **未判** | — | 2× ⚠假綠 | `applyTrainingEnvAxesToProfile` | （agy 漏列，待補判） |
| 130 | B | RED | — | App.tsx applies live scene topology after signal and training profile layers | 改為 Playwright 行為斷言：在 UI 調整衛星數量或拓撲覆寫，驗證場景衛星總數與 3D 渲染節點即時反映更新。 |
| 132 | B | RED | 2× ⚠假綠 | App.tsx joins getSceneTopologyResetKey into reset chain | 改為 Playwright 行為斷言：變更拓撲結構設定，驗證模擬器 frame 計數與執行狀態觸發 reset 初始化。 |
| 134 | B | RED | 7× ⚠假綠 | App.tsx passes appMode into SignalTuningPanel | 改為 Playwright 行為斷言：切換不同 appMode（如 sinr-experiment），驗證 SignalTuningPanel 內部對應控制選項 |
| 136 | **未判** | — | 3× ⚠假綠 | `liveSceneTopologyControlsEnabled` | （agy 漏列，待補判） |
| 137 | **未判** | — | 12× ⚠假綠 | `sceneLane === 'modqn-live-cell-preview'` | （agy 漏列，待補判） |
| 138 | B | RED | — | App.tsx enables topology overrides on both live scene lanes | 改為 Playwright 行為斷言：切換到 `modqn-live-cell-preview` 視圖，驗證拓撲覆寫控制項 `[data-testid="top |

### `scripts/validate-phase-f-ue-distribution-mode.tsx`

`validate:phase-f:ue-distribution-mode` — 今天 HEAD 實跑：**紅**

| 行 | 判 | 分解後 | App.tsx 出現次數 | 斷言 / 標籤 | 處置 |
|---|---|---|---|---|---|
| 246 | V | RED | 3× ⚠假綠 | App.tsx delegates runtime config construction | 建議刪除。斷言 App.tsx 呼叫特定 helper 函式 `buildAppRuntimeConfig` 屬內部實作細節，搬移到 context 或自訂 h |

### `scripts/validate-phase-g-ue-mobility-step.tsx`

`validate:phase-g:ue-mobility-step` — 今天 HEAD 實跑：**紅**

| 行 | 判 | 分解後 | App.tsx 出現次數 | 斷言 / 標籤 | 處置 |
|---|---|---|---|---|---|
| 258 | V | RED | 3× ⚠假綠 | `App delegates runtime config construction` | 斷言特定 helper 函式識別字在 App.tsx 內被呼叫；若邏輯搬移至 context provider 或 hook 會假紅，設定建構正確性已由執行期模 |

### `scripts/validate-phase-h-s4-beam-hopping-toggle.ts`

`validate:phase-h:s4-beam-hopping-toggle` — 今天 HEAD 實跑：**綠**

| 行 | 判 | 分解後 | App.tsx 出現次數 | 斷言 / 標籤 | 處置 |
|---|---|---|---|---|---|
| 40 | B | OK | NEG 0× | App.tsx does not mount BeamHoppingToggle | 改為 Playwright 行為斷言：斷言頁面 DOM 不存在 `[data-testid="beam-hopping-toggle"]` 或 Beam Hop |
| 41 | S | OK | NEG 0× | App.tsx does not apply removed beam-hopping demo override | 改為去檔名化的全專案靜態檢查：使用 AST 或全域 glob 掃描 `src/**/*.{ts,tsx}`，確保無任何程式碼呼叫已廢棄的 `applyBeamH |

### `scripts/validate-phase-h-s5-orbit-trail-modqn-demo.ts`

`validate:phase-h:s5-orbit-trail-modqn-demo` — 今天 HEAD 實跑：**綠**

| 行 | 判 | 分解後 | App.tsx 出現次數 | 斷言 / 標籤 | 處置 |
|---|---|---|---|---|---|
| 27 | **未判** | — | 1× | `appMode !== 'modqn-demo' \\|\\| reducedMotion` | （agy 漏列，待補判） |
| 28 | B | RED | — | `App.tsx runtimeVisualSettings gates the modqn-demo override on appMode + reducedMotion` | 轉為 Playwright 行為測試：在瀏覽器中切換 `appMode='modqn-demo'` 或開啟系統 `reducedMotion`，斷言場景中的 O |
| 31 | **未判** | — | 1× | `orbitTrail: false` | （agy 漏列，待補判） |
| 32 | B | RED | — | `App.tsx disables orbitTrail in modqn-demo override` | 轉為 Playwright 行為測試：於 `modqn-demo` 模式下斷言 OrbitTrail 相關 DOM 標記（如 `[data-testid="or |
| 35 | **未判** | — | 1× | `spineParticles: true` | （agy 漏列，待補判） |
| 36 | B | RED | — | `App.tsx enables spineParticles in modqn-demo override` | 轉為 Playwright 行為測試：於 `modqn-demo` 模式且未開啟 reducedMotion 時，斷言 SpineParticles 效果相關  |
| 42 | V | RED | — | `runtimeVisualSettings useMemo deps include appMode + reducedMotion` | 斷言 React hook 依賴陣列字串為內部實作細節；模式與偏好設定變更時的響應已由行為測試驗證，使用者完全無感，應刪除。 |

### `scripts/validate-phase-h-s8-hud-camera-default.ts`

`validate:phase-h:s8-hud-camera-default` — 今天 HEAD 實跑：**綠**

| 行 | 判 | 分解後 | App.tsx 出現次數 | 斷言 / 標籤 | 處置 |
|---|---|---|---|---|---|
| 25 | V | RED | — | `App.tsx declares modqnDemoCameraAppliedRef` | 刪除。斷言內部 `useRef` 變數名稱為純白箱細節，重構抽成 custom hook 即報錯，使用者完全無感。 |
| 26 | **未判** | — | 4× ⚠假綠 | `modqnDemoCameraAppliedRef` | （agy 漏列，待補判） |
| 29 | B | RED | — | `App.tsx schedules oblique preset on modqn-demo entry (Phase I pull-back from too-close cl | 轉為行為斷言：切換進入 `modqn-demo` 模式時，透過 `window.__SCENE_CAMERA__` 或截圖斷言鏡頭自動套用 `oblique`  |
| 30 | **未判** | — | 1× | `camera.selectCameraPreset('oblique')` | （agy 漏列，待補判） |
| 33 | B | RED | — | `Camera default applied once per modqn-demo session entry` | 轉為行為斷言：進入 `modqn-demo` 手動旋轉視角後切換 tab 再切回，驗證視角不會被強制重複重置。 |
| 34 | **未判** | — | 1× | `appMode === 'modqn-demo' && !modqnDemoCameraAppliedRef.curre` | （agy 漏列，待補判） |
| 37 | B | RED | — | `Ref resets when leaving modqn-demo so re-entry re-applies the default` | 轉為行為斷言：離開 `modqn-demo` 至其他模式後再次進入，驗證鏡頭預設視角會再度自動套用。 |
| 38 | **未判** | — | 5× / 1× ⚠假綠 | `appMode !== 'modqn-demo'` | （agy 漏列，待補判） |
| 76 | V | RED | — | `App.tsx imports ModqnSceneHud` | 刪除。字面比對 import 字串無法保證渲染，由 HUD DOM 節點存在性測試覆蓋即可。 |
| 77 | **未判** | — | 1× | `import { ModqnSceneHud } from './ui/modqn-controls/ModqnScen` | （agy 漏列，待補判） |
| 80 | B | RED | 1× | `App.tsx mounts <ModqnSceneHud />` | 轉為行為斷言：在 `modqn-demo` 模式下斷言 `[data-testid="modqn-scene-hud"]` 存在於 DOM。 |
| 81 | B | RED | — | `App.tsx threads sceneSource into HUD truth chip` | 轉為行為斷言：斷言 HUD truth chip 依當前 `sceneSource` 渲染對應標籤文字（如 `live-sim · profile-derive |
| 82 | **未判** | — | 2× ⚠假綠 | `sceneSource={sceneSource}` | （agy 漏列，待補判） |
| 85 | B | RED | — | `App.tsx threads bundleProvenanceKind into HUD truth chip` | 轉為行為斷言：切換 baseline 與 user-trained 模型時，斷言 HUD truth chip 正確顯示對應模式標籤。 |
| 86 | **未判** | — | 5× ⚠假綠 | `bundleProvenanceKind={bundleProvenanceKind}` | （agy 漏列，待補判） |
| 89 | B | RED | — | `App.tsx threads simState into HUD` | 轉為行為斷言：在模擬推進時，斷言 HUD 上的 `[data-testid="modqn-scene-hud-sim-time"]` 與數值即時更新。 |
| 90 | **未判** | — | 2× ⚠假綠 | `simState={simState}` | （agy 漏列，待補判） |

### `scripts/validate-phase-i-s6-hud-preview-banner.tsx`

`validate:phase-i:s6-hud-preview-banner` — 今天 HEAD 實跑：**綠**

| 行 | 判 | 分解後 | App.tsx 出現次數 | 斷言 / 標籤 | 處置 |
|---|---|---|---|---|---|
| 246 | S | OK | NEG 0× | `App.tsx has 0 occurrences of BeamHoppingToggle` | 真結構約束（已刪除元件禁令），應去檔名化為對全專案 `src/**/*.{ts,tsx}` 進行 glob 掃描，防止任何模組重新引入 `BeamHopping |
| 248 | S | OK | NEG 0× | `App.tsx has 0 occurrences of applyBeamHoppingDemoOverride` | 真結構約束（已廢棄函式禁令），應去檔名化為對 `src/**/*.ts*` 進行禁令檢查，確保該 helper 不在任何拆分模組中被調用。 |
| 251 | S | OK | NEG 0× | `App.tsx has 0 occurrences of BeamHoppingDemoState` | 真結構約束（已廢棄型別禁令），應去檔名化為對全專案原始碼掃描，確保型別無殘留引用。 |
| 253 | **未判** | — | NEG 0× | `DEFAULT_BEAM_HOPPING_DEMO_STATE` | （agy 漏列，待補判） |
| 254 | S | OK | — | `App.tsx has 0 occurrences of DEFAULT_BEAM_HOPPING_DEMO_STATE` | 真結構約束（已廢棄常數禁令），應去檔名化為對整個 `src/` 進行常數符號檢查，確保無任何模組重新定義或引入該常數。 |

### `scripts/validate-phase6b-handover-policy-controls.tsx`

`validate:phase6b:handover-policy-controls` — 今天 HEAD 實跑：**紅**

| 行 | 判 | 分解後 | App.tsx 出現次數 | 斷言 / 標籤 | 處置 |
|---|---|---|---|---|---|
| 147 | B | RED | — | `expected the SINR-live Advanced drawer mount` | 轉為 Playwright 行為測試：在 SINR-live 模式下點擊開啟 Advanced Drawer，斷言 DOM 中存在 `[data-testid= |
| 148 | B | RED | 1× | `parameterSection={` | 轉為 Playwright 行為測試：開啟 SINR 抽屜後，斷言抽屜內部包含參數設定區塊（`[data-testid="sinr-parameter-sect |
| 149 | S | RED | NEG 1× ⛔今天已紅 | `handoverPolicySection={` | 真結構邊界約束（禁止向 SINR 抽屜傳入切換策略區塊），應去檔名化為對 `src/ui/SinrLiveDisplayDrawer.tsx` 介面型別進行型別 |
| 150 | S | RED | NEG 2× ⛔今天已紅 | `<HandoverPolicyControls` | 真結構架構約束（主視圖禁止掛載 Walker handover policy 元件），應去檔名化為對 `src/ui/` 下所有非 handover-polic |

### `scripts/validate-phase8b-path-loss-controls.tsx`

`validate:phase8b:path-loss-controls` — 今天 HEAD 實跑：**紅**

| 行 | 判 | 分解後 | App.tsx 出現次數 | 斷言 / 標籤 | 處置 |
|---|---|---|---|---|---|
| 641 | B | RED | 2× ⚠假綠 | setStaleFormulaEvidenceKey(getSignalTuningEvidenceKey(next)) | 改為 Playwright 行為斷言：在 UI 調整 Path Loss 參數，驗證畫面上出現公式證據已過期（stale evidence）的警告標籤。 |
| 642 | B | RED | 4× ⚠假綠 | isFormulaEvidenceStale={staleFormulaEvidenceKey !== null} | 改為 Playwright 行為斷言：驗證子控制面板在 stale 狀態下渲染出警告提示 DOM 節點，替代此 JSX prop 字串鎖定。 |
| 643 | B | OK | NEG 0× | setSimState(createInitialSimState(effectiveProfile)); | 改為 Playwright 行為斷言：模擬運行中微調 Path Loss 參數，斷言當前模擬時間戳記持續累加，未被重置回 0 幀。 |

### `scripts/validate-phase9b-power-noise-separation.tsx`

`validate:phase9b:power-noise-separation` — 今天 HEAD 實跑：**綠**

| 行 | 判 | 分解後 | App.tsx 出現次數 | 斷言 / 標籤 | 處置 |
|---|---|---|---|---|---|
| 280 | B | RED | 2× ⚠假綠 | setStaleFormulaEvidenceKey(getSignalTuningEvidenceKey(next)) | 改為 Playwright 行為斷言：調整 Power/Noise 參數，驗證 stale evidence 警示 UI 正確觸發，並刪除此重複的源碼字串斷言。 |
| 281 | B | RED | 4× ⚠假綠 | isFormulaEvidenceStale={staleFormulaEvidenceKey !== null} | 改為 Playwright 行為斷言：驗證 Power/Noise 面板能接收並展示 stale 警告狀態，廢棄 JSX prop 字面檢查。 |

### `scripts/validate-s1b-replay-geometry-trace.tsx`

`validate:s1b:replay-geometry-trace` — 今天 HEAD 實跑：**綠**

| 行 | 判 | 分解後 | App.tsx 出現次數 | 斷言 / 標籤 | 處置 |
|---|---|---|---|---|---|
| 150 | N | OK | — | (App.tsx) (單行註解) | 僅為註解中說明渲染通道由 App.tsx 掛載，無任何原始碼斷言，無需處理。 |

### `scripts/validate-s4-event-index-forecast-label.tsx`

`validate:s4:event-index-forecast-label` — 今天 HEAD 實跑：**綠**

| 行 | 判 | 分解後 | App.tsx 出現次數 | 斷言 / 標籤 | 處置 |
|---|---|---|---|---|---|
| 6 | N | OK | — | (App passes simStepSec=30 s, App.tsx build site) | 僅為 JSDoc 說明文字提及 App.tsx 呼叫點，無程式碼斷言，無需處理。 |

### `scripts/validate-timeline-scrubbing.tsx`

`validate:timeline:scrubbing` — 今天 HEAD 實跑：**紅**

| 行 | 判 | 分解後 | App.tsx 出現次數 | 斷言 / 標籤 | 處置 |
|---|---|---|---|---|---|
| 147 | B | RED | 1× | `timeline seek target clamp` | 轉為 Playwright 行為測試：操作時間軸拖曳至邊界外（如 `<0` 或 `>duration`），斷言 `[data-timeline-current- |
| 148 | B | RED | 0× ⛔今天已紅 | `artifact replay seek wiring` | 轉為 Playwright 行為測試：在 artifact 重播模式下點擊/拖動時間軸，斷言畫面上的封包重播幀與時間同步跳轉至目標時間點。 |
| 149 | B | RED | 0× ⛔今天已紅 | `live seek absolute time mapping` | 轉為 Playwright 行為測試：在 live sim 模式下 seek 時間軸，斷言 HUD 或時間面板上顯示的絕對時間等於視窗起始時間加上目標偏移秒數。 |
| 150 | B | RED | 6× ⚠假綠 | `live seek clamps to the source horizon` | 轉為 Playwright 行為測試：在 live 模式下將時間軸拖曳至最大長度，斷言時間顯示被限制在 7200s (2:00:00) 且無法超出。 |
| 151 | V | RED | 1× | `live seek request state` | 斷言內部 useState setter 名稱；若改寫為 useReducer 或自訂 hook 會假紅，seek 狀態之有效性已由場景響應行為保證，使用者無感 |
| 152 | B | RED | 4× ⚠假綠 | `live seek clears observed handover rail events` | 轉為 Playwright 行為測試：在產生切換事件後操作 live seek，斷言時間軸/事件軌道上的 observed handover 節點標記被清空。 |
| 153 | B | RED | 1× | `app shell current time dataset` | 轉為 Playwright 行為測試：使用 `page.locator('[data-timeline-current-time-sec]')` 讀取真實 DO |
| 154 | B | RED | 1× | `app shell duration dataset` | 轉為 Playwright 行為測試：直接讀取 DOM 元素 `[data-timeline-duration-sec]` 的屬性值，斷言其符合當前模式之時間總 |
| 155 | B | RED | 0× ⛔今天已紅 | `app shell source owner dataset` | 轉為 Playwright 行為測試：讀取 DOM 屬性 `page.locator('[data-timeline-source-owner]')`，斷言在不 |
| 156 | B | RED | 0× ⛔今天已紅 | `app shell horizon kind dataset` | 轉為 Playwright 行為測試：讀取 DOM 屬性 `page.locator('[data-timeline-horizon-kind]')`，斷言 l |
| 157 | B | RED | 0× ⛔今天已紅 | `app shell claim kind dataset` | 轉為 Playwright 行為測試：讀取 DOM 屬性 `page.locator('[data-timeline-claim-kind]')`，斷言對應的  |
| 158 | V | RED | 1× | `runtime config receives live seek target` | 斷言物件屬性賦值字面值；內部傳遞欄位命名若重構使用者無感，且 seek 是否生效已由場景時間跳轉行為測試驗證，應刪除。 |
| 159 | V | RED | 1× | `runtime config receives live seek key` | 斷言內部 requestKey 屬性對接之字串寫法；屬於實作細節，使用者無感，應刪除。 |

---

# 附錄 A：26 個 `*:browser` validator 基準（session prompt 的「第一個動作」）

在乾淨的 HEAD `4563819` 上，對已在 :3000 執行的 dev server 逐個實跑（`APP_URL=http://localhost:3000`，每個 timeout 420s）。
**結果：6 綠、20 紅。** 工作區乾淨，所以這 20 個全部是既有紅燈，不是任何人今天弄出來的。

| | validator | 秒 | 失敗第一行 |
|---|---|---|---|
| 綠 | `golden-flow:course-segments` | 126 | |
| 綠 | `homepage:sinr-layout` | 9 | |
| 綠 | `global-constellation` | 237 | |
| 綠 | `beam:visual-invariants` | 39 | |
| 綠 | `phase-h:sinr-live-render` | 9 | |
| 綠 | `tle-journey` | 25 | |
| 紅 | `golden-flow` | 13 | UI 文案改了：驗證器要 `所需功率 P′`，畫面現在是 `理想補償功率需求 P′` |
| 紅 | `homepage:authority` | 124 | `page.waitForFunction` 逾時 30s |
| 紅 | `homepage:multi-candidate` | 71 | `intra: current Next button copy` 斷言不符 |
| 紅 | `contact-window-labs` | 1 | 數值不相等 |
| 紅 | `phase-c:director-cinematic` | 31 | `page.waitForFunction` 逾時 30s |
| 紅 | `phase-c:director-cinematic:live` | 9 | director controls mount on the live lane |
| 紅 | `phase-c:handover-cinema` | 8 | director controls mount on the live lane |
| 紅 | `phase-c:handover-pulse:render` | 137 | ambient pulse 在 live lane 畫出 ≥1 cone |
| 紅 | `phase-c:sinr-serving-mosaic` | 10 | second load resolves to the MODQN cell lane |
| 紅 | `phase-c:sinr-live-cells:render` | 103 | `page.waitForFunction` 逾時 90s |
| 紅 | `phase-c:artifact-satellite-compass` | 32 | `page.waitForFunction` 逾時 30s |
| 紅 | `phase-c:lane-experience-bar` | 14 | `page.waitForSelector` 逾時 10s |
| 紅 | `phase-c:artifact-scene:real-data` | 31 | `page.waitForFunction` 逾時 30s |
| 紅 | `phase-c:artifact-fail-closed` | 31 | `page.waitForSelector` 逾時 30s |
| 紅 | `phase-d:dashboard:real-data` | 31 | `page.waitForFunction` 逾時 30s |
| 紅 | `phase-3:contention-render` | 2 | lane 解析成 `sinr-live`，預期 `modqn-live-cell-preview` |
| 紅 | `phase-3:overlay-render` | 2 | 同上 |
| 紅 | `live-walker:handover-event-focus` | 35 | `locator.waitFor` 逾時 30s |
| 紅 | `phase-d:dashboard` | 21 | `locator.waitFor` 逾時 20s |
| 紅 | `frontend:advanced-drawer-modality` | 35 | `page.click` 逾時 30s |

**已排除的環境解釋。** `governance.yml` 的 visual-gates 註解警告「本機 MODQN producer 路徑缺席會讓 modqn 路由降級」。實查：`/home/u24/papers/modqn-paper-reproduction`、`.venv/bin/modqn-export`、`artifacts/baseline-modqn-pilot02-rerun-2026-05-15/run` 三者都在，dev server 的 `/modqn-bundles/` 回 200。所以這些紅**不是**那個已知環境因素。

**CI 的 7 個 visual-gates 成員，本機有 6 個紅**（`phase-3:contention-render`、`phase-3:overlay-render`、`phase-c:handover-cinema`、`phase-c:handover-pulse:render`、`phase-c:sinr-serving-mosaic`、`phase-c:sinr-live-cells:render` 紅；`phase-h:sinr-live-render` 綠）。visual-gates 目前不是 required check——這也解釋了為什麼沒人看到。

## 這對 P4 的意義

§0b 說「網子存在，它是瀏覽器形狀的」。那句話沒錯，但**這張網今天有 77% 是破的**。

session prompt 的分岔判準是「大部分綠 → 直接開始拆；大量紅 → 先弄清楚哪些是既有紅燈」。答案明確落在後者，而且比預期更極端：**不需要用 worktree 回舊 commit 比對**——工作區是乾淨的 HEAD，所以定義上這 20 個全部是既有紅燈。要查的不是「哪些是既有的」，而是「這 20 個是幾個根因造成的」。

失敗訊息本身就指向少數幾個共同根因：`director controls mount on the live lane` 出現 2 次、lane 解析成 `sinr-live` 而非 `modqn-live-cell-preview` 出現 2 次（外加 mosaic 的「second load resolves to the MODQN cell lane」是同一族），以及 8 個 artifact-replay 路由上的 `waitForFunction/waitForSelector` 逾時。**先修 lane 解析與 artifact-replay 載入這兩族，可能一次拉回大半。**

# 附錄 B：MainScene.tsx 的數字也要更正

用同一套 AST 工具量 `src/scene/MainScene.tsx`：

| | §0b 寫的 | 實測 |
|---|---|---|
| 讀它原始碼的 validator | 5 | **22**（共 25 個提到它） |
| 字面 pin | — | **159**（正向 150 / 負向 9），另有 27 條非字面 pin |
| 正向、出現 0 次（今天已紅） | — | **20** |
| 正向、出現 >1 次（可證明假綠） | — | **53** |

`src/AppWalkerSandbox.tsx` 則確認為 §0b 說的 0——沒有任何 validator 提到它。

所以三個神函式的治理形狀是：App.tsx 與 MainScene.tsx 各被上百條文字 pin 綁著（且各有一批已經紅了、一批是假綠），AppWalkerSandbox.tsx 則完全沒有任何靜態或行為守衛。

---

# 附錄 C：20 個 browser 紅燈的根因（已查證的部分）

第 14 個 agy 拿到 20 份失敗輸出＋`src/app/sceneLane.ts` 全文做歸因。它引用的每一段證據我都回原始 log 核對過，**全部屬實**；`sceneLane.ts` 的邏輯陳述也正確。以下是我在它的分組上再往下查、**查到底**的兩族。

## C-1　lane 一族（3 個紅）：seed localStorage 的切換手法已經失效

`validate:phase-3:contention-render`、`validate:phase-3:overlay-render`、`validate:phase-c:sinr-serving-mosaic` 都是用同一招切到 MODQN lane：

```js
// scripts/validate-phase-3-contention-render-browser.ts:77-84
// AppModeRail is not mounted in this build, so the modqn-demo cell lane is
window.localStorage.setItem('leo-beam-sim.app-mode.v1', 'modqn-demo');
await page.goto(`${appUrl}/?sceneSource=live-sim&modqnServiceAllocation=1`, …);
```

`readPersistedAppMode()` 會正確讀回 `'modqn-demo'`。但 `src/App.tsx:458`：

```ts
initialRuntimeRef.current = resolveHomepageInitialRuntimeState(readInitialRuntimeState());
```

而 `src/app/appRuntimeModel.ts:120` 的 `resolveHomepageInitialRuntimeState` **刻意丟掉持久化的 appMode**：

```ts
/**
 * The public Walker App surface is the canonical paper-formula workspace, not a
 * persisted experience switch. Keep profile preferences, but never let a
 * previous MODQN visit replace its parameter/result rails on the next launch.
 */
const appMode = DEFAULT_APP_EXPERIENCE_MODE;   // = 'sinr-experiment'
```

於是 `resolveSceneLane` 只剩一條路可走 → `'sinr-live'`。**這不是 app 壞了，是一個刻意的產品決定讓那 3 個 validator 的切換手法失效，而沒人回頭更新 validator。**

注意這 3 個腳本的註解自己就寫著「AppModeRail is not mounted in this build」——它們知道 UI 切換路徑沒了，改用 localStorage 繞道，然後那條繞道也被關掉了。

## C-2　LaneExperienceBar 一族（2 個紅）：閘門要求一個沒人掛載的元件

- `src/ui/LaneExperienceBar.tsx` 存在，但 **`grep -rn "<LaneExperienceBar" src/` 與 `grep -rn "from '.*LaneExperienceBar'" src/` 都是空的——沒有任何檔案 import 或掛載它。**
- `validate:phase-c:lane-experience-bar:browser` 等 `[data-testid="lane-experience-bar"]` 可見（該 testid 只由那個死檔案產生）→ 逾時。
- `validate:frontend:advanced-drawer-modality:browser` 點 `[data-testid="lane-experience-modqn-live-cell-preview"]`（同一個 bar 的分段）→ 逾時。
- 同時 `validate:frontend:scene-lane-governance` **主動要求** App.tsx 不得掛載它：
  `assert.equal(countOccurrences(appSource,'<LaneExperienceBar'), 0, 'LaneExperienceBar is not mounted after the MODQN sub-nav consolidation')`。

**一次「MODQN sub-nav 整併」拿掉了掛載點、加了一條靜態閘門去強制它被拿掉，卻沒退休兩個仍在驅動它的 browser 閘門。**這和 `governance.yml` 註解裡記的 handover-ticker 事件是同一類（Rule#9），只是這次沒人發現。

## C-3　其餘 15 個

agy 分了 2 組獨立錯誤（golden-flow 文案漂移、multi-candidate Next 按鈕文案、contact-window 4≠6、handover-pulse cone=0、5 個個別 DOM 逾時），並**誠實列出 6 個它無法從現有證據歸因**的 `waitForFunction` 逾時（`homepage:authority`、`director-cinematic`、`sinr-live-cells:render`、`artifact-satellite-compass`、`artifact-scene:real-data`、`dashboard:real-data`），說明需要 predicate 原始碼與 console log 才能判。這個「不知道就說不知道」的邊界是對的——那 6 個確實只印了通用逾時訊息。

**其中 director controls 一族（2 個）值得優先查**：`director-cinematic:live` 與 `handover-cinema` 都是 `director controls mount on the live lane` 的 `0 !== 1`，是同一個掛載條件，形狀跟 C-2 一樣。

## 這改變了對「網子」的判斷

20 個紅裡，**已查證有 5 個（C-1 三個 ＋ C-2 兩個）不是應用程式壞掉，而是閘門本身過期**——它們斷言的是已經被刻意移除的 UI 與已經被刻意關掉的切換路徑。

所以 §0b 說的「網子是瀏覽器形狀的、它端到端跑真應用」仍然成立，但**這張網有一部分綁在已經不存在的東西上**。P4 開工前要做的不只是修紅燈，而是先分辨每個紅燈是「app 回歸」還是「閘門過期」——這和 App.tsx 那 223 條文字 pin 的分流是同一件事，只是換到行為層。

---

# 附錄 D：第二輪 agy 補判（App.tsx 漏判 71 條 ＋ MainScene.tsx 全量）

第二輪切成 ≤25 條/batch，覆蓋率 95.6%（227 條要判、回了 217），220 列引文核對 **全數通過、0 可疑**。

### `scripts/validate-frontend-scene-lane-governance.ts`

| 行 | 判 | 分解後 | 斷言 | 處置 |
|---|---|---|---|---|
| 950 | V | RED | `assertContains(appSource, "from './ui/ArtifactSourceBadge'", ...)` | 建議刪除；此為 UI Badge 的 import 路徑字面值，移入子 Header 或 Banner 後使用者看不到任何行為差異。 |
| 1650 | V | RED | `resolveSceneLaneRenderPlan({` | 鎖定內部函式呼叫語法；若重構為 custom hook 或 inline 計算，只要場景各項渲染與遙測正常，使用者完全無感，應予刪除。 |
| 1747 | B | RED | `if (!showSinrServingMosaic) return null;` | 轉為行為斷言：Playwright 在非 `sinr-live`（如 `modqn-demo`）模式下，驗證 canvas 遙測未渲染 SINR mosaic 顏色覆蓋  |
| 1752 | B | RED | `buildSinrServingUeColorMapFromCells(cellFrame.ues)` | 轉為行為斷言：Playwright 在 `sinr-live` 模式下驗證 `[data-testid="leo-main-scene"]` 或 canvas 遙測屬性反 |
| 1821 | V | RED | `sim.sinrLiveCells` | 全檔出現 48 次的屬性路徑，搬移至子元件即假紅且無鑑別力；beam cone 渲染應改由 Playwright 斷言 canvas dataset 的 cone ren |
| 1929 | B | RED | `beamDisplaySpec.showNonServingCones ? null : sinrLiveTargetSatIds` | 轉為行為斷言：Playwright 切換 Other-beams 開關，斷言 canvas 上的 cone rendered count dataset 從 ≤2 tar |
| 1959 | B | RED | `recentHandoverEvents: (sim.sinrLiveCells?.recentHandoverEvents ?? [])` | 轉為行為斷言：Playwright 在 `sinr-live` 模擬換手時，斷言 canvas 上 `data-sinr-live-handover-pulse-cone |
| 1966 | B | RED | `telemetryCountDatasetKey="sinrLiveHandoverPulseConeRenderedCount"` | 轉為行為斷言：Playwright 在 `sinr-live` 執行時，斷言 canvas 上存在 `data-sinr-live-handover-pulse-cone |
| 1976 | B | RED | `telemetryCountDatasetKey="sinrLiveTriggeredIntraConeRenderedCount"` | 轉為行為斷言：Playwright 在 `sinr-live` 觸發同軌換手時，斷言 canvas 具備 `data-sinr-live-triggered-intra- |
| 1981 | V | RED | `resolveTriggeredIntraConeItems({` | 內部計算輔助函式呼叫語法；只要觸發換手時 canvas 上報之 triggered-intra cone 數量正確，重構或封裝不影響行為，應予刪除。 |
| 2023 | S | OK | `<EarthFixedCells` | 轉為模組架構約束：改寫為針對 `src/scene/**/*.tsx` 的 AST/grep 規則，禁止任何場景模組引入或掛載已退役的 `EarthFixedCells` |
| 2131 | B | RED | `resolveSceneLaneUeMarkerShape(sceneLane)` | 轉為行為斷言：Playwright 切換不同 `sceneLane`，透過 DOM probe 或 canvas 遙測檢驗 UE marker 形狀屬性符合該 lane  |
| 2137 | B | RED | `const showUav = sceneLane === 'sinr-live';` | 轉為行為斷言：Playwright 切換 lane，斷言 `[data-testid="uav-marker"]` 或 canvas UAV 相關 dataset 僅在  |
| 2143 | B | RED | `data-scene-lane={sceneLane}` | 轉為行為斷言：Playwright 切換 lane，斷言 `[data-testid="leo-main-scene"]` 容器上的 `data-scene-lane`  |
| 2153 | V | RED | `deriveProfileHandoverStoryModel` | 內部資料生成函式識別字；若抽成 hook 或搬移，只要 handover story UI 與遙測正確輸出，外部行為毫無差異，應予刪除。 |
| 2192 | V | RED | `modqnServiceAllocationEnabled: runtime.modqnServiceAllocationEnabled ?? false` | 內部物件屬性傳遞細節；其效果已在 downstream telemetry 體現，單獨 pin 傳遞語法無防護價值，應予刪除。 |
| 2197 | B | RED | `showModqnServiceAllocation && modqnVisualLayers.serviceMap` | 轉為行為斷言：Playwright 在非 modqn lane 或關閉 serviceMap 圖層時，斷言 canvas 的 `data-modqn-service-ma |
| 2202 | B | RED | `showUeCounts={modqnVisualLayers.ueCountBadges && showModqnServiceAllocation}` | 轉為行為斷言：Playwright 在圖層控制面板切換 `ueCountBadges`，斷言 DOM 上 `[data-testid="modqn-ue-count-ba |
| 2207 | B | RED | `modqnServedUeCount={showModqnServiceAllocation ? modqnServiceMap.servedUeCount : 0}` | 轉為行為斷言：Playwright 切換 service allocation 開關，斷言 canvas 的 `data-modqn-served-ue-count` 於 |
| 2212 | B | RED | `modqnIdleUeCount={showModqnServiceAllocation ? modqnServiceMap.idleUeCount : 0}` | 轉為行為斷言：Playwright 切換 service allocation 開關，斷言 canvas 的 `data-modqn-idle-ue-count` 於停用 |
| 2217 | B | RED | `modqnServiceMapEnabled={showModqnServiceAllocation && modqnVisualLayers.serviceMap ? '1' : '0' | 轉為行為斷言：Playwright 切換開關，斷言 canvas 上的 `data-modqn-service-map-enabled` 屬性精確對應 `"1"` 或 ` |
| 2222 | S | OK | `const beamLoadContentionEnabled = showCellOverlay && modqnVisualLayers.serviceMap` | 轉為模組架構約束：改寫為針對 `src/scene/**/*.tsx` 的 AST/grep 規則，禁止任何子模組以 `showCellOverlay` 作為 MODQN |
| 2227 | V | RED | `deriveModqnServiceMap({` | 內部計算函式呼叫語法；若抽成 hook 或封裝進子元件，只要 MODQN 遙測與 3D 渲染正常，使用者完全無感，應予刪除。 |
| 2232 | V | RED | `buildModqnCellServiceReadout({` | 內部輔助函式呼叫；若封裝進狀態管理，只要 readout 面板 DOM 正確呈現數值，內部如何呼叫無任何差異，應予刪除。 |
| 2237 | V | RED | `slotSec: CELL_SCHEDULE_VIZ_SLOT_SEC` | 常數參數傳遞寫法；常數若改為模組內部預設或 context 提供，只要 diagnostics 面板計算結果正確即無外部差異，應予刪除。 |
| 2242 | V | RED | `modqnCellServiceReadout,` | 物件屬性簡寫語法；狀態傳遞若改由 context 或分流發布，只要 SimState 訂閱者收到正確資料即可，此字串 pin 應予刪除。 |
| 2247 | B | RED | `assertContains(mainSceneSource, 'markerColor: isOtherHandover', ...)` | 轉為 Playwright 行為測試，切換 MODQN lane 與 handover 狀態，檢查 canvas 遙測屬性或 UE marker 顏色輸出；刪除原檔物件屬 |
| 2252 | B | RED | `assertContains(mainSceneSource, 'mosaic?.markerColor ?? service?.markerColor', ...)` | 轉為單元測試或 Playwright 測試，模擬 SINR mosaic 存在與缺失情境以驗證 fallback 優先級行為，刪除原始碼 nullish coalesci |
| 2267 | B | RED | `assertContains(mainSceneSource, 'ueCountByCellId={modqnServiceMap.ueCountByCellId}', ...)` | 轉為 Playwright 測試，斷言 `[data-testid="cell-overlay"]` 或 canvas 遙測屬性正確反映各 cell 之 UE 數量，刪除 |
| 2272 | B | RED | `assertContains(mainSceneSource, 'const showCellReassignmentEventArcs = modqnVisualLayers.hando | 轉為 Playwright 測試，切換 preset 之 `handoverCues` 開關並觀察重分配事件弧線層的顯隱狀態，刪除區域變數宣告字串。 |
| 2277 | B | RED | `assertContains(mainSceneSource, 'selectProfileDerivedHandoverCues', ...)` | 出現 2 次；應將 density cap 邏輯移至專屬 helper 單元測試，並由 Playwright 斷言場景遙測 `data-handover-cue-coun |
| 2282 | B | RED | `assertContains(mainSceneSource, 'visible={showCellReassignmentEventArcs}', ...)` | 轉為 Playwright 行為測試，驗證重分配弧線圖層在條件切換時的節點/遙測可見性，刪除 JSX `visible` 屬性字面斷言。 |
| 2287 | B | RED | `assertContains(mainSceneSource, '<HandoverStoryLayer', ...)` | 轉為 Playwright 測試，在啟用 handover story 時斷言 `[data-testid="handover-story-layer"]` 或場景圖層遙 |
| 2292 | B | RED | `assertContains(mainSceneSource, "{presentationPlan.visible['event-effects'] && showProfileHand | 轉為 Playwright 組合測試，分別切換 `event-effects`、presentation stage 與 `handoverStory` 驗證圖層掛載行為 |
| 2297 | B | RED | `assertContains(mainSceneSource, "{presentationPlan.visible['serving-beams'] && showCellOverlay | 轉為 Playwright 測試，驗證 `serving-beams`、`showCellOverlay` 與 `beamCones` 開關組合下波束錐圖層的顯隱狀態，刪 |
| 2302 | B | RED | `assertContains(mainSceneSource, 'beamConeScope: renderedCellBeamConeScope', ...)` | 轉為 Playwright 斷言 canvas 遙測屬性 `data-rendered-beam-cone-scope` 或單元測試計數 helper，刪除物件欄位賦值字 |
| 2307 | B | RED | `assertContains(mainSceneSource, 'resolveCellBeamConeSatelliteCount', ...)` | 出現 2 次；轉為 Playwright 檢查 HUD/遙測中衛星波束錐計數輸出，或由純函式單元測試覆蓋，刪除識別字字串 pin。 |
| 2312 | B | RED | `assertContains(mainSceneSource, 'beamConeScope={modqnVisualLayers.beamConeScope}', ...)` | 轉為 Playwright 測試，切換 visual preset 中的 beam cone scope 並驗證 CellBeamCones 範圍遙測連動更新，移除 JS |
| 2323 | B | RED | `assertContains(mainSceneSource, 'deriveBeamLoadContention([...modqnServiceMap.ueById.values()] | 轉為 Playwright 行為測試，載入具資源爭用的 MODQN profile 並斷言爭用發光層遙測（如 `data-contention-glow`）正確產生數值， |
| 2333 | V | RED | `assertContains(mainSceneSource, 'const focusBeamLoad = beamLoadContentionEnabled', ...)` | 鎖定內部暫存變數宣告，變數重命名或 inline 對使用者渲染毫無影響，屬於過度鎖定實現細節，應直接刪除。 |
| 2338 | B | RED | `assertContains(mainSceneSource, "beamLoadContention.byUeId.get(focusedCellBeamConeUe?.id ?? '' | 轉為 Playwright 測試：選取特定 UE 後，斷言 `[data-testid="beam-load-cylinder"]` 遙測精確反映該 UE 之 conte |
| 2343 | B | RED | `assertContains(mainSceneSource, '<BeamLoadCylinder', ...)` | 出現 2 次；轉為 Playwright 行為測試，在聚焦 UE 且具負載時斷言波束負載圓柱圖層存在於 DOM/場景遙測中，刪除 JSX 標籤字串。 |
| 2348 | B | RED | `assertContains(mainSceneSource, "{presentationPlan.visible['load-overlays'] && showCellOverlay | 轉為 Playwright 測試，組合驗證四項開關狀態與 BeamLoadCylinder 的顯隱關聯，刪除四重條件式字串斷言。 |
| 2353 | B | RED | `assertContains(mainSceneSource, 'visible={(focusBeamLoad?.load ?? 0) > 0}', ...)` | 轉為 Playwright 測試，分別選取「負載 > 0」與「負載 = 0」的 UE，斷言圓柱圖層 visible 遙測屬性分別為 true 與 false，刪除 JSX |
| 2388 | V | RED | `assertContains(mainSceneSource, 'import { BeamLoadUploadParticles }', ...)` | 鎖定單一檔案的 import 字面寫法；子模組化後該元件改由子圖層引入即可，使用者視覺無差別，應直接刪除。 |
| 2423 | V | RED | `assertContains(mainSceneSource, 'resolveCellBeamConeItems', ...)` | 出現 2 次且與 2443 行重複，僅斷言內部 helper 識別字存在，對使用者行為無保護作用，應直接刪除。 |
| 2428 | V | RED | `assertContains(mainSceneSource, 'const uploadParticlesEnabled =', ...)` | 鎖定局部變數宣告識別字，即便變數重命名或 inline 使用者亦毫無感知，為無效防護，應直接刪除。 |
| 2433 | B | RED | `assertContains(mainSceneSource, "modqnVisualLayerPreset === 'explain-handover'", ...)` | 轉為 Playwright 測試，切換 visual preset 至 `explain-handover` 與其他模式，斷言上行粒子效果之掛載與可見狀態，刪除條件式字面 |
| 2438 | B | RED | `assertContains(mainSceneSource, '&& modqnVisualLayers.handoverStory', ...)` | 出現 4 次易產生假綠；應轉為 Playwright 測試，在切換 `handoverStory` 圖層開關時斷言對應粒子特效之顯隱狀態，刪除片段字串。 |
| 2443 | B | RED | `assertContains(mainSceneSource, 'resolveCellBeamConeItems({', ...)` | 轉為 Playwright 測試驗證上行粒子之發射路徑與波束錐幾何遙測一致，或在粒子子元件單元測試中驗證，刪除原檔函式調用字串。 |
| 2448 | V | RED | `beamConeScope: 'focus-satellite'` | 內部函式參數物件字面值；若重構為 enum 或常數使用者完全無感，此原始碼字面鎖定應直接刪除。 |
| 2453 | B | RED | `<BeamLoadUploadParticles` | 改為 Playwright 行為斷言：啟用上傳粒子功能後，檢查 `[data-testid="leo-main-scene"]` 上的 `data-upload-part |
| 2458 | V | RED | `focusCones={uploadParticleFocusCones}` | 內部 JSX prop 傳遞變數名稱；改由 hook 或 context 傳遞時行為完全不變，屬無效字串鎖定，應直接刪除。 |
| 2463 | V | RED | `beamLoadContention={beamLoadContention}` | 內部 JSX prop 變數綁定；重命名或重構內部狀態使用者看不出差別，應直接刪除。 |
| 2468 | V | RED | `focusedUe={focusedCellBeamConeUe}` | 出現 2 次為假綠且純屬內部 prop 命名；UE 聚焦正確性應在遙測屬性 `data-focused-ue-id` 驗證，此字面斷言應刪除。 |
| 2473 | B | RED | `paused={paused}` | 出現 4 次為假綠；應轉為行為斷言：Playwright 點擊暫停控制項 `[data-testid="sim-pause-button"]`，斷言 `[data-tes |
| 2478 | B | RED | `reducedMotion={runtime.reducedMotion}` | 出現 5 次為假綠；應改為 Playwright 行為斷言：設定 `page.emulateMedia({ reducedMotion: 'reduce' })`，斷言  |
| 2744 | B | RED | `replayBackedHandoverStoryVisible` | 出現 3 次；應改為行為斷言：在重播證明模式下，透過 Playwright 讀取 `[data-testid="leo-main-scene"]` 的 `data-rep |
| 2749 | V | RED | `function ArtifactSceneContent` | 鎖定同檔函式宣告關鍵字，直接阻礙元件抽檔為獨立模組；只要場景重播渲染正常，是否在同檔宣告使用者完全無感，應刪除。 |
| 2754 | B | RED | `sceneFrame?.sceneSource === 'artifact-replay'` | 改為行為斷言：載入含 `artifact-replay` 來源的重播 frame，透過 Playwright 驗證 `[data-testid="leo-main-sce |
| 2759 | B | RED | `<ArtifactSceneContent` | 改為行為斷言：切換至 Artifact 重播時，在 Playwright 斷言容器節點 `[data-testid="artifact-scene-content"]`  |
| 2764 | B | RED | `liveSimulationEnabled="0"` | 改為行為斷言：進入 Artifact 重播模式，讀取 `[data-testid="leo-main-scene"]` 上的遙測屬性 `data-live-simulat |
| 2769 | B | RED | `liveSimulationEnabled={simSource === 'live' ? '1' : '0'}` | 改為行為斷言：在 Playwright 分別切換 `simSource` 為 live 與 non-live，驗證 `[data-testid="leo-main-sce |
| 2821 | B | RED | `{presentationPlan.visible['serving-footprints']\n        && showSinrLiveCellBeams` | 多行 JSX 條件字串；應改為 Playwright 行為斷言：開啟 serving footprint 與 SINR cell beams 顯示，斷言遙測節點 `[da |
| 2826 | B | OK | `{!multiCandidateAuthorityActive && presentationPlan.visible['serving-footprints']` | 負向字串斷言，搬遷後對新檔無防護力；應轉為行為斷言：啟用 multi-candidate 模式時開啟 serving-footprints，斷言 `[data-testi |
| 2831 | B | RED | `&& showLiveSceneEffects\n        && !handoverDisplayIsolation.hideTimelineEffects\n        &&  | 出現 0 次目前已紅；應改為 Playwright 行為測試：在無 display isolation 時，斷言 `[data-testid="handover-link |
| 2843 | B | RED | `<DecisionHandoverCue` | 改為行為斷言：觸發 decision-frame transition 事件時，在 Playwright 中斷言 `[data-testid="decision-hand |
| 2862 | V | RED | `acceptedHandoverPresentation?.commit,` | 內部變數屬性讀取字串；改用解構賦值或重構 hook 使用者完全無感，接管權威轉移應由單元測試或 E2E 狀態機驗證，此字串斷言應刪除。 |
| 2867 | V | RED | `const visibleSatelliteId = authorityPresentationCommitObserved` | 內部區域變數宣告語法；單一 filled-cone owner 應由遙測屬性 `data-visible-satellite-id` 驗證，此原始碼鎖定應刪除。 |
| 2872 | B | OK | `authorityPresentationCommitObserved\n      \|\| handoverPresentation.phase === 'releasing'` | 負向斷言，原檔 0 次故不變紅但失去防護；應改為行為斷言：在 releasing 動畫階段若無 commit receipt，斷言遙測屬性 `data-handover- |
| 2877 | B | RED | `&& showHandoverToastOverlay\n        && (` | 出現 0 次目前已紅；應改為 Playwright 行為斷言：啟用 handover toast 時，驗證 `[data-testid="handover-toast-o |
| 2883 | B | RED | `<MultiCandidateBeamScene` | 出現 2 次；應改為行為斷言：切換至 multi-candidate 模式，透過 Playwright 斷言 `[data-testid="multi-candidate |
| 2888 | B | RED | `multiCandidateSceneRenderPlan?.telemetry.renderedPairCount` | 改為行為斷言：在多候選場景渲染時，讀取 `[data-testid="leo-main-scene"]` 上的 `data-rendered-pair-count` 遙測 |
| 2893 | B | RED | `multiCandidateSceneRenderPlan?.solidDataLinkCount` | 改為行為斷言：透過 Playwright 讀取 `[data-testid="leo-main-scene"]` 之 `data-solid-link-count` 遙測 |
| 2898 | B | RED | `multiCandidateCentralOverlayActive && !multiCandidateServingCarrierRenderable` | 改為行為斷言：在 central overlay 啟用且 serving carrier 不可渲染時，斷言 canvas 遙測屬性 `data-serving-carri |
| 2903 | B | RED | `assertContains(mainSceneSource, "{presentationPlan.visible['candidate-footprints'] && showSinr | 改為 Playwright 行為斷言：在中央比較疊加層開啟時啟用 candidate footprints，驗證 candidate footprint 圖層在 canv |
| 2919 | B | RED | `assertContains(mainSceneSource, "enabled: simSource === 'live' && sceneFrame.sceneSource !== ' | 改為 Playwright 行為斷言或整合測試：在 artifact replay 與 archived TLE 模式下驗證 SimState 發布器不送出任何狀態更新， |

### `scripts/validate-live-walker-handover-event-focus.tsx`

| 行 | 判 | 分解後 | 斷言 | 處置 |
|---|---|---|---|---|
| 226 | B | RED | `assertContains(appSource, "timelineRailDescriptor.rail.sourceOwner === 'live-walker'", ...)` | 改為 Playwright 行為測試，在時間軸點擊 `live-walker` 軌道，觀察時間軸 seek 指標與 focus target 時間正確對齊 live-wa |
| 231 | B | RED | `assertContains(appSource, "timelineRailDescriptor.rail.sourceOwner === 'sinr-live-cell-truth'" | 改為 Playwright 行為測試，在時間軸點擊 `sinr-live-cell-truth` 軌道，斷言時間軸請求正確導向 SINR cell truth 時間。 |
| 236 | B | RED | `assertContains(appSource, "timelineRailDescriptor.rail.horizonKind === 'live-walker-window'",  | 改為 Playwright 行為測試，在 live-walker 視窗時間軸進行點擊/拖曳，斷言可視時間區間與焦點範圍受到正確約束。 |
| 241 | B | RED | `assertContains(appSource, 'setLiveTimelineSeekRequest({', ...)` | 改為 Playwright 互動測試，點擊時間軸軌道後斷言 UI 狀態或元素之 `data-click-target-sec` 屬性更新；原始碼斷言純屬內部 React  |

### `scripts/validate-modqn-handover-story-layer.ts`

| 行 | 判 | 分解後 | 斷言 | 處置 |
|---|---|---|---|---|
| 549 | V | RED | `assertContains(mainScene, 'deriveProfileHandoverStoryModel', 'MainScene derives story model'); | 斷言內部推導函式識別字，就算重構改名使用者也毫無差別，且推導結果已由第 563–564 行 telemetry 覆蓋，應刪除。 |
| 550 | B | RED | `assertContains(mainScene, '{showProfileHandoverStoryLayer && modqnVisualLayers.handoverStory & | 轉為 Playwright 測試，在 UI 切換 `handoverStory` 開關，觀察 `[data-testid="leo-main-scene"]` 的 `da |
| 551 | V | RED | `assertContains(mainScene, 'deriveModqnServiceMap({', 'MainScene derives MODQN all-UE service m | 斷言內部 helper 呼叫語法，搬移或改名對使用者無感，且 UE 服務狀態已由第 568 行 `el.dataset.modqnServedUeCount` 覆蓋，應刪 |
| 552 | B | RED | `assertContains(mainScene, 'buildModqnCellServiceReadout({', 'MainScene builds MODQN service re | 轉為 Playwright 測試，在 MODQN 運行時檢查 UI 面板 `[data-testid="modqn-cell-service-readout"]` 的文字 |
| 553 | V | RED | `assertContains(mainScene, 'modqnCellServiceReadout,', 'MainScene passes MODQN service readout  | 斷言物件屬性縮寫與參數傳遞字串，重命名或內聯傳遞使用者看不出差別，且已由第 570 行 publisher 檢查涵蓋，應刪除。 |
| 554 | B | RED | `assertContains(mainScene, 'markerColor: mosaic?.markerColor ?? service?.markerColor', 'MainSce | 轉為 Playwright 測試，在同時開啟 SINR mosaic 與 MODQN service 時，檢查 GroundScene 的 UE 標記點渲染顏色是否符合  |
| 555 | B | RED | `assertContains(mainScene, 'ueCountByCellId={modqnServiceMap.ueCountByCellId}', 'MainScene pass | 轉為 Playwright 測試，檢查 `[data-testid="cell-overlay"]` 或其標籤上顯示的各 Cell UE 計數是否與實際服務 UE 數量一 |
| 556 | B | RED | `assertContains(mainScene, 'const showCellReassignmentEventArcs = modqnVisualLayers.handoverCue | 轉為 Playwright 測試，在 UI 切換 `handoverCues` 開關，斷言 `[data-testid="leo-main-scene"][data-mo |
| 557 | V | RED | `assertContains(mainScene, 'selectProfileDerivedHandoverCues', 'MainScene caps profile-derived  | 鎖定內部密度過濾函式名（且出現 2 次造成假綠），重構為 inline 算法不影響畫面弧線密度，應刪除。 |
| 558 | V | RED | `assertContains(mainScene, 'visible={showCellReassignmentEventArcs}', 'MainScene passes explici | 鎖定 JSX 屬性傳遞字面，改用條件渲染 `{showCellReassignmentEventArcs && <...>}` 使用者看不出差別，且與第 556/569  |
| 559 | B | RED | `assertContains(mainScene, '{showCellOverlay && modqnVisualLayers.beamCones && (', 'MainScene g | 轉為 Playwright 測試，切換 `beamCones` 與 `cellOverlay` 開關，檢查 `[data-testid="leo-main-scene"] |
| 560 | V | RED | `assertContains(mainScene, 'beamConeScope: renderedCellBeamConeScope', 'MainScene passes visual | 鎖定內部 helper 參數賦值字面，變數改名使用者毫無差別，且下游已有第 566–567 行遙測斷言覆蓋，應刪除。 |
| 561 | V | RED | `assertContains(mainScene, 'resolveCellBeamConeSatelliteCount', 'MainScene computes MODQN beam- | 鎖定內部計算函式名（出現 2 次為假綠），計算結果已在第 567 行 `el.dataset.cellBeamConeSatelliteCount` 驗證，應刪除。 |
| 562 | B | RED | `assertContains(mainScene, 'beamConeScope={modqnVisualLayers.beamConeScope}', 'MainScene passes | 轉為 Playwright 測試，在控制面板切換 `beamConeScope` 下拉選項，斷言 `[data-testid="leo-main-scene"][data |
| 572 | B | RED | `assertContains(mainScene, 'replayBackedHandoverStoryVisible', 'MainScene keeps replay proof st | 轉為 Playwright 測試，在 replay 模式下操作時間軸，檢查 `[data-testid="leo-main-scene"][data-handover-s |

### `scripts/validate-modqn-omega-s1-sidebar-truth-up.tsx`

| 行 | 判 | 分解後 | 斷言 | 處置 |
|---|---|---|---|---|
| 133 | S | OK | `appSource.includes('useModqnDemoStub')` | 去檔名化改為全專案架構檢查，使用 ESLint `no-restricted-imports` 或以 glob 對 `src/**/*.{ts,tsx}` 斷言全域不得匯 |

### `scripts/validate-modqn-omega-s2-runtime-fetch.tsx`

| 行 | 判 | 分解後 | 斷言 | 處置 |
|---|---|---|---|---|
| 84 | B | RED | `appSource.includes('fetchModqnReplayBundleEnvelope')` | 改為 Playwright 行為測試，進入 Replay 模式時以 `page.waitForRequest` 監聽 MODQN replay bundle 請求，驗證資 |
| 90 | B | RED | `appSource.includes('getModqnReplayPlaybackFallbackShellModel')` | 改為 Playwright 測試，模擬 bundle fetch 回傳 404/500，驗證應用程式不崩潰並平滑降級載入 Fallback Shell Model 畫面。 |
| 105 | B | OK | `appSource.includes('data-testid="modqn-bundle-fetch-banner"')` | 改為 Playwright 測試，在 fetch 失敗情境下斷言 `page.locator('[data-testid="modqn-bundle-fetch-bann |
| 110 | V | OK | `appSource.includes('leo-modqn-bundle-fetch-banner')` | 刪除此條；此為舊 CSS 類別字串斷言且與行 105 的 testid 斷言重複，純文字被移除時使用者無法感知任何差異。 |

### `scripts/validate-modqn-omega-s3-replay-mode-wiring.tsx`

| 行 | 判 | 分解後 | 斷言 | 處置 |
|---|---|---|---|---|
| 262 | B | RED | `appSrc.includes('data-handover-criterion')` | 轉為 Playwright 行為斷言：在頁面載入後透過 `page.locator('[data-handover-criterion]')` 檢查 DOM 根容器或指定 |
| 266 | B | RED | `appSrc.includes("handoverMode === 'decision-overlay-on-live-sinr' ? 'decision-overlay-on-live- | 轉為 Playwright 行為斷言：切換 handoverMode 下拉選單，斷言 `[data-handover-criterion]` 屬性值在 `'decisio |
| 270 | B | RED | `appSrc.includes("if (handoverMode !== 'decision-overlay-on-live-sinr')")` | 轉為 Playwright 行為斷言：在非 decision-overlay 模式下，斷言 MODQN replay 面板（如 `[data-testid="modqn- |
| 270 | V | RED | `appSrc.includes('return null;')` | 斷言通用 JS 語法 `return null;`（App 內出現 11 次），無法鎖定特定邏輯且搬家或改寫三元式對使用者毫無差別，應直接刪除。 |
| 319 | B | RED | `appSrc.includes('<LaneExperienceBar value={sceneLane} onChange={handleExperienceChange} />')` | 轉為 Playwright 行為斷言：定位 `[data-testid="lane-experience-bar"]`，點擊切換各 lane 標籤並斷言 active 狀 |
| 399 | B | RED | `appSrc.includes('readInitialRuntimeState')` | 轉為 Playwright 行為斷言：應用初次啟動時，檢查 Profile 選擇器（`[data-testid="profile-select"]`）的預設選中值為預設  |
| 411 | B | RED | `appSrc.includes('getLeftSidebarTabsForSceneLane')` | 轉為 Playwright 行為斷言：切換至各 scene lane，斷言左側 Sidebar（`[data-testid="left-sidebar-tab"]`）正確 |
| 422 | B | RED | `appSrc.includes('getRightSidebarTabsForSceneLane')` | 轉為 Playwright 行為斷言：切換至各 scene lane，斷言右側 Sidebar（`[data-testid="right-sidebar-tab"]`）呈 |
| 434 | B | RED | `appSrc.includes('handoverMode={handoverMode}')` | 轉為 Playwright 行為斷言：切換 handoverMode，驗證 Live Status 與 MODQN Evidence 面板內顯示的 handover 模式 |
| 438 | B | RED | `appSrc.includes('resolveSceneLane({')` | 轉為 Playwright 行為斷言：操作 appMode 與 sceneSource 切換，驗證畫面進入對應的 scene lane 佈局與 HUD 標籤。 |
| 439 | V | RED | `appSrc.includes('appMode,')` | 斷言通用參數名稱 `appMode,`（出現 13 次為典型假綠），對功能與使用者無任何保證價值，應予刪除。 |
| 440 | V | RED | `appSrc.includes('sceneSource,')` | 斷言普遍識別字 `sceneSource,`（出現 17 次），無法保證特定傳參正確性且重構無感，應予刪除。 |
| 441 | B | RED | `appSrc.includes('modqnReplayProofRequested: modqnReplayProofRequestActive')` | 轉為 Playwright 行為斷言：點擊觸發 replay proof 請求，驗證系統切換至 proof lane；單純切換 appMode 則不應觸發 proof l |

### `scripts/validate-modqn-omega-s4-heuristic-not-paper.tsx`

| 行 | 判 | 分解後 | 斷言 | 處置 |
|---|---|---|---|---|
| 218 | B | RED | `appSrc.includes("handoverMode === 'decision-overlay-on-live-sinr' ? 'decision-overlay-on-live- | 轉為 Playwright 行為斷言：切換 handover 模式，斷言 DOM 容器的 `data-handover-criterion` 屬性在兩者間正確變更。 |
| 230 | B | RED | `appSrc.includes("handoverMode === 'omega-heuristic' && sceneLane === 'modqn-live-cell-preview' | 轉為 Playwright 行為斷言：在 modqn-live-cell-preview 下切換至 omega-heuristic，斷言 `[data-testid="h |

### `scripts/validate-modqn-phase7k-replay-scene-layer.ts`

| 行 | 判 | 分解後 | 斷言 | 處置 |
|---|---|---|---|---|
| 419 | B | RED | `assertContains(appSource, "if (handoverMode !== 'decision-overlay-on-live-sinr')", ...)` | 改用 Playwright 切換切換模式下拉選單，驗證當模式為 `decision-overlay-on-live-sinr` 時即時決策覆蓋層顯示，其餘模式則不顯示。 |
| 424 | V | RED | `assertContains(appSource, 'createOmegaRescalarizedModqnReplayPlaybackDisplayState', ...)` | 建議刪除；此為內部 helper 函式名稱，搬移或重新封裝成 custom hook 對使用者無可觀察差異。 |
| 444 | B | RED | `assertContains(appSource, '<ModqnReplayCuePanel', 'App replay sidebar cue panel')` | 改用 Playwright 在 MODQN 回放模式下驗證側邊欄節點 `[data-testid="modqn-replay-cue-panel"]` 存在且可見。 |
| 449 | V | RED | `assertContains(appSource, 'modqnReplayProofRequested: modqnReplayProofRequestActive', ...)` | 建議刪除；此為內部 prop 鍵值字串綁定，只要點擊回放按鈕時 proof 圖層能如期渲染，變數命名對使用者完全透明。 |
| 459 | B | OK | `assertNotContains(appSource, "modqnReplayProofRequested: appMode === 'modqn-demo'", ...)` | 改用 Playwright 進入 `modqn-demo` 模式且未勾選/點擊 proof 請求時，斷言 proof 圖層節點 `[data-testid="modqn- |
| 464 | S | OK | `assertNotContains(mainSceneSource, 'createModqnProducerContextSatellites', ...)` | 轉為對 `src/scene/**/*.{ts,tsx}` 的全域 AST 或 import 依賴圖結構斷言，確保整個 scene 模組皆不得匯入或呼叫 `createM |
| 469 | S | OK | `assertNotContains(mainSceneSource, 'generateWalkerConstellation', ...)` | 轉為對 `src/scene/**/*.{ts,tsx}` 的模組依賴圖結構斷言，禁止 scene 渲染模組直接匯入與呼叫 `generateWalkerConstell |
| 474 | V | OK | `assertNotContains(mainSceneSource, 'modqnProducerContextSatellites.map', ...)` | 刪除此行；斷言內部特定變數名稱與 `.map` 寫法屬於無效 pin，重構變更變數名使用者毫無感知，應由 Playwright 驗證 replay 模式下衛星標記來源與數 |
| 486 | B | RED | `assertContains(mainSceneSource, 'showLiveSatelliteMarkers && viz.displaySats', ...)` | 改為 Playwright 行為斷言：在 `modqn-replay-proof` lane 驗證 live 衛星標記不渲染，切換回 `sinr-live` 則正常顯示衛 |
| 498 | B | RED | `assertContains(mainSceneSource, '{showSinrLiveCellBeams && (', ...)` | 改為 Playwright 行為斷言：在 `modqn-replay-proof` lane 驗證 beam cones 不渲染，在 `sinr-live` lane 驗 |

### `scripts/validate-phase-3-overlays.ts`

| 行 | 判 | 分解後 | 斷言 | 處置 |
|---|---|---|---|---|
| 84 | B | RED | `ok(mainScene.includes('const beamLoadContentionEnabled = showModqnServiceAllocation && modqnVi | 改為 Playwright 行為斷言：在 UI 勾選 serviceMap 時驗證 canvas 遙測屬性 `data-contention-glow` 顯示，關閉時隱藏 |
| 88 | B | RED | `ok(cylinderGate >= 0 && mainScene.includes('<BeamLoadCylinder'), ...)` | 改為 Playwright 行為斷言：在 UI 同時啟用 cell overlay、handover story 與 service allocation 時，驗證 ca |
| 97 | B | RED | `ok(mainScene.includes('<BeamLoadUploadParticles'), ...)` | 改為 Playwright 行為斷言：在符合條件的情境下，於 Playwright 驗證 canvas 遙測屬性 `data-upload-particles` 處於啟用 |

### `scripts/validate-phase-b-artifact-picker.tsx`

| 行 | 判 | 分解後 | 斷言 | 處置 |
|---|---|---|---|---|
| 215 | V | RED | `source.includes("useState<'paper-faithful' \| 'user-trained'>('paper-faithful')")` | 建議刪除；內部 state 型別宣告與初值寫法若抽離至 hook 亦不影響使用者，UI 預設值應由 Playwright 檢查 Provenance 選項初始選取狀態。 |
| 221 | V | RED | `source.includes('onLoadEntry={handleLoadIntoScene}')` | 建議刪除；此為內部 callback 命名與 JSX 接線字串，應改由 Playwright 點擊 Model Library 條目並斷言場景已載入對應模型。 |
| 225 | V | RED | `source.includes('onLoadPaperFaithful={handleRevertToPaperFaithful}')` | 建議刪除；此為內部回呼名稱，應改由 Playwright 點擊還原至基準按鈕並斷言場景重設回 paper-faithful 狀態。 |
| 229 | V | RED | `source.includes('artifactReplaySource={showcaseArtifactSource}')` | 建議刪除；此為內部變數傳遞語法，使用者僅能觀察到畫面上的來源分離標籤文字，應改測 DOM 渲染內容。 |

### `scripts/validate-phase-b-jobs-panel.tsx`

| 行 | 判 | 分解後 | 斷言 | 處置 |
|---|---|---|---|---|
| 201 | V | RED | `appSource.includes("import { AdvancedSetupDrawer } from './ui/AdvancedSetupDrawer';")` | 建議刪除；此為 App.tsx 的特定 import 路徑字串，抽到佈局層或容器時使用者毫無感知。 |
| 205 | B | RED | `appSource.includes('<AdvancedSetupDrawer')` | 改用 Playwright 點擊進階設定按鈕，斷言抽屜容器 `[data-testid="advanced-setup-drawer"]` 開啟並正確呈現表單內容。 |
| 242 | B | OK | `!appSource.includes("activeLeftSidebarTab === 'setup'")` | 改用 Playwright 檢查左側邊欄 `page.locator('[data-testid="tab-setup"]')` 的 element count 為 0（ |

### `scripts/validate-phase-b-service-client.tsx`

| 行 | 判 | 分解後 | 斷言 | 處置 |
|---|---|---|---|---|
| 184 | V | RED | `appSource.includes("import { ServiceStatusBanner } from './ui/modqn-training/ServiceStatusBann | 建議刪除；此為元件 import 字面值，抽出至右側欄子元件時此斷言會假紅，使用者無感。 |
| 188 | B | RED | `appSource.includes('<ServiceStatusBanner appMode={appMode} />')` | 改用 Playwright 檢查右側側邊欄 `aside.leo-shell-right` 內部渲染出 `[data-testid="service-status-ban |

### `scripts/validate-phase-b-training-form.tsx`

| 行 | 判 | 分解後 | 斷言 | 處置 |
|---|---|---|---|---|
| 160 | V | RED | `appSource.includes("import { AdvancedSetupDrawer } from './ui/AdvancedSetupDrawer';")` | 斷言 import 的字面路徑寫法，改由 barrel 匯入或搬移至佈局層使用者看不出差別，應刪除。 |
| 164 | B | RED | `appSource.includes('<AdvancedSetupDrawer')` | 轉為 Playwright 行為斷言：點擊開啟 Advanced Setup 按鈕，斷言 `[data-testid="advanced-setup-drawer"]`  |

### `scripts/validate-phase-c-camera-preset.tsx`

| 行 | 判 | 分解後 | 斷言 | 處置 |
|---|---|---|---|---|
| 257 | B | RED | `check(mainSceneSource.includes("if (effectiveCinematicMode !== 'director')"), 'director comman | 轉為 Playwright 測試，在非 director 模式下派發 director 指令，斷言 OrbitControls 狀態與相機座標維持不變。 |
| 260 | B | RED | `check(mainSceneSource.includes('controls.enabled = false'), 'acquiring disables OrbitControls' | 轉為 Playwright 測試，觸發 director focus 時，斷言 canvas 遙測屬性 `data-controls-enabled="false"` 或 |
| 336 | S | RED | `check(mainSceneSource.includes("from './directorFocusPose'"), 'MainScene imports resolveDirect | 去檔名化，改對 `src/scene/**/*.{ts,tsx}` 的模組依賴圖斷言：`resolveDirectorFocusPose` 必須來自獨立模組，且任何 sc |

### `scripts/validate-phase-c-scene-scale-override.tsx`

| 行 | 判 | 分解後 | 斷言 | 處置 |
|---|---|---|---|---|
| 194 | V | RED | `mainSceneSource.includes('visualScaleMultipliers: SceneVisualScaleMultipliers')` | 刪除此條；Props 型別標註應由 TypeScript 編譯器（`tsc`）靜態保障，源碼字串匹配在型別重構或解構時容易假紅。 |
| 195 | B | RED | `mainSceneSource.includes('visualScaleMultipliers.beamFootprintMultiplier')` | 轉為 Playwright 測試，在調諧面板調整波束縮放乘數後，斷言畫布波束尺寸或 `data-beam-footprint-multiplier` 遙測值隨之變更。 |
| 196 | V | RED | `mainSceneSource.includes('visualScaleMultipliers,')` | 刪除此條；斷言包含逗號的變數傳遞語法極其脆弱，改由視覺縮放的整合渲染測試確保波束視覺層正常工作。 |

### `scripts/validate-phase-c-ue-marker-size.tsx`

| 行 | 判 | 分解後 | 斷言 | 處置 |
|---|---|---|---|---|
| 164 | B | RED | `check(mainSceneCompact.includes('ueMarkerMultiplier={visualScaleMultipliers.ueMarkerMultiplier | 改為 Playwright 行為斷言：在 TopologyTab 調整 UE marker multiplier 滑桿，驗證 canvas 上 UE 標記的縮放大小或遙測 |

### `scripts/validate-phase-d-app-wire.tsx`

| 行 | 判 | 分解後 | 斷言 | 處置 |
|---|---|---|---|---|
| 100 | V | RED | `appSource.includes("import { fetchUserTrainedBundleEnvelope } from './modqn/training-trigger/u | 刪除此字串斷言；此為內部模組匯入語法細節，無關 runtime 行為，若需驗證資料載入應以 Playwright 攔截網路請求或驗證應用狀態。 |
| 233 | B | RED | `appSource.includes('data-testid="load-into-scene-error-banner"')` | 改為 Playwright 行為測試，模擬載入失敗情境後操作頁面，斷言 `page.locator('[data-testid="load-into-scene-erro |
| 248 | B | RED | `appSource.includes('onLoadPaperFaithful={handleRevertToPaperFaithful}')` | 改為 Playwright 行為測試，點擊 `page.locator('[data-testid="revert-to-paper-faithful"]')`，並斷言場 |
| 326 | B | OK | `!appSource.includes('satsPerPlane: envAxes.nSatellites')` | 改為單元測試或 Playwright 測試，傳入指定 `envAxes` 後驗證場景衛星總數顯示為正確乘積；否定文字斷言於程式碼搬遷後雖維持綠燈但缺乏實質防護力。 |

### `scripts/validate-phase-d-decision-viz.tsx`

| 行 | 判 | 分解後 | 斷言 | 處置 |
|---|---|---|---|---|
| 265 | V | RED | `appSource.includes("import { DecisionVizPanel } from './ui/modqn-training/DecisionVizPanel';") | 刪除此條；此為內部 import 語法細節，且同檔後續已驗證 `<DecisionVizPanel` 掛載與排序，單獨限制 import 字串對使用者毫無意義。 |

### `scripts/validate-phase-d-reward-curve.tsx`

| 行 | 判 | 分解後 | 斷言 | 處置 |
|---|---|---|---|---|
| 281 | V | RED | `appSource.includes("import { RewardCurvePanel } from './ui/modqn-training/RewardCurvePanel';") | 斷言 import 的字面寫法，改自 barrel 匯入對使用者無差異，應刪除並由側邊欄內 RewardCurvePanel（`[data-testid="reward- |

### `scripts/validate-phase-e-sat-count-override.tsx`

| 行 | 判 | 分解後 | 斷言 | 處置 |
|---|---|---|---|---|
| 128 | B | RED | `appSource.includes('applySceneTopology(trainingProfile, activeSceneTopology)')` | 轉為 Playwright 行為斷言：在控制面板修改 scene topology 參數，斷言 3D 場景內衛星實體數量與 HUD 拓撲資訊相應更新。 |
| 129 | B | RED | `appSource.includes('applyTrainingEnvAxesToProfile')` | 轉為 Playwright 行為斷言：調整訓練環境軸向設定，斷言對應面板上的環境 profile 參數數值正確聯動。 |
| 136 | B | RED | `appSource.includes('liveSceneTopologyControlsEnabled')` | 轉為 Playwright 行為斷言：在 live scene lane 下斷言拓撲控制項（`[data-testid="topology-controls"]`）為 e |
| 137 | V | RED | `appSource.includes("sceneLane === 'modqn-live-cell-preview'")` | 斷言普遍字面條件（出現 12 次為假綠），無法精確代表控制項啟用邏輯且使用者無感，應直接刪除。 |

### `scripts/validate-phase-f-ue-distribution-mode.tsx`

| 行 | 判 | 分解後 | 斷言 | 處置 |
|---|---|---|---|---|
| 257 | B | RED | `check(mainSceneSource.includes('runtime.ueDistributionMode'), 'MainScene threads runtime.ueDis | 轉為 Playwright 測試，在 UI 切換 UE 分布模式選項，斷言場景遙測屬性 `[data-testid="leo-main-scene"][data-ue-d |

### `scripts/validate-phase-g-ue-mobility-params.tsx`

| 行 | 判 | 分解後 | 斷言 | 處置 |
|---|---|---|---|---|
| 227 | B | RED | `mainSceneSource.includes('runtime.ueMobilityParams')` | 轉為 Playwright 測試，在拓撲面板設定移動性參數後推進模擬幀，斷言 UE 移動狀態或畫布遙測座標隨時間發生位移。 |

### `scripts/validate-phase-g-ue-mobility-step.tsx`

| 行 | 判 | 分解後 | 斷言 | 處置 |
|---|---|---|---|---|
| 262 | B | RED | `check(mainSceneSource.includes('runtime.ueMobilityMode'), 'MainScene threads runtime.ueMobilit | 轉為 Playwright 行為斷言：在瀏覽器啟動含 UE 移動性的場景並步進模擬，操作時驗證 UE 座標或 `[data-testid="leo-main-scene" |

### `scripts/validate-phase-g-ue-trail-viz.tsx`

| 行 | 判 | 分解後 | 斷言 | 處置 |
|---|---|---|---|---|
| 183 | V | RED | `check(mainSceneSource.includes('useUeTrailHistory'), ...)` | 刪除此行；斷言特定 Hook 識別字屬於實作細節，搬遷至子模組不影響功能與使用者體驗，應改由 184/185 的行為斷言覆蓋。 |
| 184 | B | RED | `check(mainSceneSource.includes('runtime.enableUeTrails === true && propSceneFrame === undefine | 改為 Playwright 行為斷言：在 TopologyTab 切換 UE trail toggle，驗證 live sim 下 canvas 出現軌跡遙測資料，而在重 |
| 185 | B | RED | `check(mainSceneSource.includes('ueTrailHistory={showCellOverlay ? undefined : ueTrailHistory}' | 改為 Playwright 行為斷言：在開啟 UE trails 情況下啟用 cell overlay，驗證軌跡節點自動隱藏或 unmount。 |

### `scripts/validate-phase-h-s1-live-sim-beams.ts`

| 行 | 判 | 分解後 | 斷言 | 處置 |
|---|---|---|---|---|
| 111 | B | RED | `source.includes('SinrLiveCellBeamCones')` | 轉為 Playwright 瀏覽器測試，在 live-sim 模式下斷言 `canvas[data-beam-cone-count]` 大於 0，驗證即時波束圓錐是否實際 |
| 116 | B | RED | `source.includes('beamConeCount')` | 轉為 Playwright 斷言 `await expect(page.locator('canvas')).toHaveAttribute('data-beam-con |
| 121 | V | RED | `source.includes('viz.satBeams')` | 刪除此條；斷言內部變數存取路徑無法保護功能，改由波束視覺化端到端渲染與 `useBeamViz` 單元測試覆蓋。 |
| 121 | V | OK | `source.includes('viz.satBeams.get')` | 刪除此條；該字串在目標檔出現 0 次為無效死斷言，僅因 OR 條件假綠，對使用者行為無任何防護作用。 |
| 126 | V | RED | `source.includes('resolveSinrLiveCellBeamConeItems')` | 刪除對主場景原始碼的內部函式名稱斷言；其核心計算邏輯應由獨立純函式單元測試驗證，場景端只驗證最終畫布呈現。 |
| 131 | B | RED | `source.includes('footprintRadius')` | 轉為 Playwright 測試，調整波束半徑參數後，斷言畫布遙測屬性（如 `data-beam-footprint-radius`）或渲染幾何尺寸相應更新。 |

### `scripts/validate-phase-h-s2-live-sim-sat-markers.ts`

| 行 | 判 | 分解後 | 斷言 | 處置 |
|---|---|---|---|---|
| 65 | B | RED | `expect(source.includes('viz.displaySats.map(sat => ('), ...)` | 改為 Playwright 行為斷言：在 live sim 模式下讀取 canvas 遙測或 `[data-testid="satellite-marker"]`，驗證渲 |
| 69 | B | RED | `expect(source.includes('showLiveSatelliteMarkers && viz.displaySats.map'), ...)` | 改為 Playwright 行為斷言：在關閉衛星顯示或非 live 模式下，驗證所有 `SatelliteMarker` 標記皆 unmount 且數量為 0。 |

### `scripts/validate-phase-h-s3-live-sim-callouts.ts`

| 行 | 判 | 分解後 | 斷言 | 處置 |
|---|---|---|---|---|
| 79 | B | RED | `source.includes('<SinrLiveCellBeamCallouts')` | 轉為 Playwright 測試，點擊「Beam Info」切換按鈕，斷言畫面上出現波束標註層（如 `[data-testid="beam-callout-overlay |
| 98 | B | RED | `source.includes("beamCalloutsEnabled={showBeamCallouts ? '1' : '0'}")` | 轉為 Playwright 測試，切換波束標註開關後，斷言 `canvas[data-beam-callouts-enabled]` 屬性在 `'1'` 與 `'0'`  |

### `scripts/validate-phase-h-s5-orbit-trail-modqn-demo.ts`

| 行 | 判 | 分解後 | 斷言 | 處置 |
|---|---|---|---|---|
| 27 | B | RED | `source.includes("appMode !== 'modqn-demo' \|\| reducedMotion")` | 改為 Playwright 行為測試，切換 `appMode` 至 `modqn-demo` 或開啟減弱動態效果，斷言畫面上軌道與粒子特效依條件啟用/停用。 |
| 31 | B | RED | `source.includes('orbitTrail: false')` | 改為 Playwright 測試，在 `modqn-demo` 模式下斷言軌道軌跡（orbit trail）圖層為關閉狀態或檢查設定面板狀態為 false。 |
| 35 | B | RED | `source.includes('spineParticles: true')` | 改為 Playwright 測試，在 `modqn-demo` 模式下斷言脊柱粒子特效（spine particles）設定為開啟並渲染於場景中。 |
| 61 | B | RED | `source.includes('showOrbitTrail')` | 轉為 Playwright 測試，操作軌道軌跡開關控制項，斷言畫布遙測屬性 `data-orbit-trail-enabled` 或軌道 Mesh 顯示狀態同步切換。 |
| 65 | B | RED | `source.includes('showSpineParticles')` | 轉為 Playwright 測試，操作脊柱粒子開關控制項，斷言畫布遙測屬性 `data-spine-particles-enabled` 或粒子系統渲染狀態。 |
| 69 | V | RED | `source.includes('effectsEnabled: runtime.effectsEnabled')` | 刪除此條；硬編碼檢查物件屬性指派語法無法防止行為退化，渲染計畫的狀態推導應由 `sceneLaneRenderPlan.test.ts` 單元測試覆蓋。 |
| 74 | V | RED | `source.includes('effectsEnabled: runtime.effectsEnabled')` | 刪除此條；與第 69 行字串完全重複且屬於內部實作細節，使用者無法感知該行程式碼寫法差異。 |

### `scripts/validate-phase-h-s8-hud-camera-default.ts`

| 行 | 判 | 分解後 | 斷言 | 處置 |
|---|---|---|---|---|
| 26 | V | RED | `source.includes('modqnDemoCameraAppliedRef')` | 斷言內部 useRef 變數名稱（出現 4 次），變數重新命名或抽離至 hook 對使用者毫無差別，應予刪除。 |
| 30 | B | RED | `source.includes("camera.selectCameraPreset('oblique')")` | 轉為 Playwright 行為斷言：切換至 modqn-demo 模式時，檢查相機 preset 選擇器（`[data-testid="camera-preset-ob |
| 34 | B | RED | `source.includes("appMode === 'modqn-demo' && !modqnDemoCameraAppliedRef.current")` | 轉為 Playwright 行為斷言：進入 modqn-demo 後手動旋轉調整相機視角，觸發 state 更新後斷言視角不會被強制重設回 oblique。 |
| 38 | V | RED | `source.includes("appMode !== 'modqn-demo'")` | 斷言通用條件字面 `appMode !== 'modqn-demo'`（出現 5 次），無法特異定位重置邏輯且使用者無感，應予刪除。 |
| 38 | B | RED | `source.includes('modqnDemoCameraAppliedRef.current = false')` | 轉為 Playwright 行為斷言：進入 modqn-demo -> 調整視角 -> 離開模式 -> 再次進入 modqn-demo，斷言視角重新套用 oblique  |
| 44 | B | RED | `expect(mainScene.includes("'paper-faithful-closeup'"), 'MainScene exposes paper-faithful-close | 轉為 Playwright 測試，在 HUD 相機選單選擇 `paper-faithful-closeup` 預設，斷言相機鏡頭移動且 canvas 的 `data-ca |
| 77 | V | RED | `source.includes("import { ModqnSceneHud } from './ui/modqn-controls/ModqnSceneHud'")` | 斷言 import 的字面寫法，改由 barrel 匯入或搬至容器組件對使用者毫無差別，應刪除並由 HUD 掛載行為測試保護。 |
| 82 | B | RED | `source.includes('sceneSource={sceneSource}')` | 轉為 Playwright 行為斷言：切換 sceneSource，斷言 HUD 上的 truth chip（`[data-testid="hud-truth-chip" |
| 86 | B | RED | `source.includes('bundleProvenanceKind={bundleProvenanceKind}')` | 轉為 Playwright 行為斷言：載入不同來源 bundle 時，斷言 HUD 上的 provenance chip（`[data-testid="hud-prove |
| 90 | B | RED | `source.includes('simState={simState}')` | 轉為 Playwright 行為斷言：啟動模擬運作，斷言 HUD 上的步數/時間計數器（`[data-testid="hud-sim-state"]`）數值隨模擬狀態動態 |

### `scripts/validate-phase-i-s4-cell-overlay.tsx`

| 行 | 判 | 分解後 | 斷言 | 處置 |
|---|---|---|---|---|
| 228 | B | RED | `mainSceneSource.includes('resolveSceneLaneRenderPlan({')` | 改為 Playwright 行為測試：在 dev server 切換 scene lane 為 `modqn-live-cell-preview` 時驗證 canvas  |
| 252 | B | RED | `mainSceneSource.includes('cellOverlaySlotIndex=')` | 改為 Playwright 行為斷言：在 Playwright 檢查 canvas 或 `[data-testid="leo-main-scene"]` 的 `datas |
| 253 | B | RED | `mainSceneSource.includes('cellOverlayActiveCount=')` | 改為 Playwright 行為斷言：在 Playwright 讀取 canvas 的 `data-cell-overlay-active-count`，驗證 activ |
| 254 | B | RED | `mainSceneSource.includes('cellOverlayIdleCount=')` | 改為 Playwright 行為斷言：在 Playwright 讀取 canvas 的 `data-cell-overlay-idle-count`，驗證 idle 數量 |
| 255 | B | RED | `mainSceneSource.includes('cellOverlayCellCount=')` | 改為 Playwright 行為斷言：在 Playwright 讀取 canvas 的 `data-cell-overlay-cell-count`，驗證總 cell 覆 |

### `scripts/validate-phase-i-s5a-footprint-handover.tsx`

| 行 | 判 | 分解後 | 斷言 | 處置 |
|---|---|---|---|---|
| 319 | B | RED | `mainSceneSource.includes('{showCellOverlay && (\n        <CellHandoverArcs')` | 轉為 Playwright 條件渲染測試，切換至 `modqn-live-cell-preview` 模式時斷言換手弧線遙測存在，非 live 模式時斷言不渲染。 |
| 323 | B | RED | `mainSceneSource.includes('cellHoReassignmentCount=')` | 轉為 Playwright 瀏覽器測試，斷言 `canvas[data-cell-ho-reassignment-count]` 遙測屬性存在且隨換手事件動態更新。 |
| 324 | B | RED | `mainSceneSource.includes('cellHoInterCount=')` | 轉為 Playwright 瀏覽器測試，斷言 `canvas[data-cell-ho-inter-count]` 遙測屬性能正確反映 Inter-cell 換手計數。 |
| 325 | B | RED | `mainSceneSource.includes('cellHoIntraCount=')` | 轉為 Playwright 瀏覽器測試，斷言 `canvas[data-cell-ho-intra-count]` 遙測屬性能正確反映 Intra-cell 換手計數。 |

### `scripts/validate-phase-i-s5b-cell-beam-cones.tsx`

| 行 | 判 | 分解後 | 斷言 | 處置 |
|---|---|---|---|---|
| 372 | V | RED | `mainSceneSource.includes('CellBeamCones,')` | 刪除此字串 pin；此為元件匯入識別字，搬移至子場景模組時會誤報變紅，且使用者無法感知匯入形式差異。 |
| 373 | V | RED | `mainSceneSource.includes('resolveCellBeamConeRenderCount,')` | 刪除此字串 pin；內部輔助函式匯入名稱屬實作細節，使用者無感，計算邏輯應由單元測試保障。 |
| 374 | V | RED | `mainSceneSource.includes('resolveCellBeamConeSatelliteCount,')` | 刪除此字串 pin；此為內部計數函式名稱，搬移或重構對使用者無差別，改由子模組單元測試驗證。 |
| 375 | B | RED | `mainSceneSource.includes('{showCellOverlay && modqnVisualLayers.beamCones && (\n <CellBeamCone | 轉為 Playwright 行為斷言：切換 `showCellOverlay` 與 `beamCones` 開關，驗證 `[data-testid="leo-main-s |
| 376 | V | RED | `mainSceneSource.includes('schedule={cellSchedule}')` | 刪除此字串 pin；內部 JSX prop 傳遞語法搬移即紅，排程數據是否生效已由波束渲染行為覆蓋，使用者看不出語法差異。 |
| 377 | V | RED | `mainSceneSource.includes('satelliteWorldById={satelliteWorldById}')` | 刪除此字串 pin；內部座標字典之 prop 傳遞為實作細節，搬家或改用 context 使用者無感，渲染異常直接由畫面與遙測捕獲。 |
| 378 | V | RED | `mainSceneSource.includes('satelliteTintById={satelliteTintById}')` | 刪除此字串 pin；著色 prop 傳遞為內部實作，搬遷至子模組不影響渲染結果，外觀正確性由視覺回歸測試保護。 |
| 379 | B | RED | `mainSceneSource.includes('beamConeScope={modqnVisualLayers.beamConeScope}')` | 轉為 Playwright 行為斷言：在 UI 操作切換 `beamConeScope` 下拉選項，透過 `[data-testid="leo-main-scene"]` |
| 383 | B | RED | `mainSceneSource.includes('{showSinrLiveCellBeams && (')` | 轉為 Playwright 行為斷言：切換至 sinr-live 模式，斷言 `[data-testid="leo-main-scene"]` 的 `data-sinr- |
| 384 | V | RED | `mainSceneSource.includes('items={sinrLiveCellBeamConeItems}')` | 刪除此字串 pin；內部變數與 prop 綁定字串搬遷即紅，波束項目正確性由 sinr-live 渲染與遙測斷言保護。 |
| 385 | V | RED | `mainSceneSource.includes('dimShallowCones')` | 刪除此字串 pin；此為元件內部 prop 旗標字串，低仰角變暗效果應由著色器單元測試或視覺測試保護，字串無法保證效果。 |
| 386 | B | RED | `mainSceneSource.includes('primaryServingSatId={primaryServingRecord?.servingSatId ?? null}')` | 轉為 Playwright 行為斷言：在 sinr-live 模擬切換服務衛星時，斷言 `[data-testid="leo-main-scene"]` 上的 `data |
| 387 | B | RED | `mainSceneSource.includes('primaryServingCellId={primaryServingRecord?.cellId ?? null}')` | 轉為 Playwright 行為斷言：在 sinr-live 模擬中驗證 `[data-testid="leo-main-scene"]` 的 `data-primary |
| 395 | B | RED | `mainSceneSource.includes('{showSinrLiveCellBeams && (')` | 轉為 Playwright 行為斷言：在 sinr-live 模式下驗證 `[data-testid="leo-main-scene"]` 的覆蓋圈遙測屬性（如 `dat |
| 396 | V | RED | `mainSceneSource.includes('<SinrLiveCellFootprintRings')` | 刪除此字串 pin；JSX 元件標籤名稱搬移至子元件即紅，地面覆蓋圈是否正確掛載應由 canvas 遙測與行為測試驗證。 |
| 397 | V | RED | `mainSceneSource.includes('items={sinrLiveCellBeamConeItems}')` | 刪除此字串 pin；內部 prop 傳遞語法且與第 384 行重複，搬遷至子模組不影響使用者觀察到的覆蓋圈項目。 |
| 402 | B | RED | `mainSceneSource.includes('{showGroundRipple && (')` | 轉為 Playwright 行為斷言：在 UI 切換地面漣漪開關，斷言 `[data-testid="leo-main-scene"]` 的 `data-ground-r |
| 413 | B | RED | `mainSceneSource.includes('cellBeamConeCount={showCellOverlay ? String(renderedCellBeamConeCoun | 轉為 Playwright 行為斷言：在瀏覽器開啟 cell overlay，以 `page.locator('[data-testid="leo-main-scene" |
| 414 | V | RED | `mainSceneSource.includes('resolveCellBeamConeRenderCount({')` | 刪除此字串 pin；此為內部函式呼叫語法，搬移或改寫使用者無感，遙測輸出之正確性已由 DOM 屬性行為測試驗證。 |

### `scripts/validate-phase-i-s7b-serving-count-selector.tsx`

| 行 | 判 | 分解後 | 斷言 | 處置 |
|---|---|---|---|---|
| 241 | B | RED | `mainSceneSource.includes('runtime.cellServingCount ?? DEFAULT_SERVING_COUNT')` | 轉為 Playwright 或整合測試，在未指定與指定服務小區數時，分別斷言 `canvas[data-serving-cell-count]` 顯示預設值與自訂值。 |

### `scripts/validate-s3-one-reset.tsx`

| 行 | 判 | 分解後 | 斷言 | 處置 |
|---|---|---|---|---|
| 330 | B | RED | `ok(mainSceneSrc.includes("const useEarthFixedCellTruth = sceneLane === 'sinr-live' \|\| sceneL | 轉為 Playwright 測試，分別在 `sinr-live`、`modqn-live-cell-preview` 與其他 lane 載入頁面，檢查 `[data-te |

---

# 附錄 E：206 條單次 pin 的分流（2026-09-06 第二階段）

這批是「字面在目標檔剛好出現 1 次」的正向斷言——它們**抓得住**自己指名的東西，問題是「那個東西值不值得用文字釘住」。
9 個 agy worker（每批 ≤23 條）判完，**覆蓋率 100%（206/206）**，引文核對 203/206 通過。

分類結果：**B 可轉行為斷言 130 ／ V 該刪 73 ／ S 真結構約束 3**。


### `scripts/validate-frontend-scene-lane-governance.ts`

| 行 | 判 | 分解後 | 斷言 | 處置 |
|---|---|---|---|---|
| 623 | V | RED | `const [modqnVisualLayerPreset, setModqnVisualLayerPreset]` | 刪除。此斷言僅鎖定內部 React state 宣告字面；狀態抽至 custom hook 時必紅但對使用者零影響，應由現有 preset UI 控制項測試覆蓋 |
| 637 | V | RED | `from './app/sceneLane'` | 刪除。純粹釘死特定相對路徑 import 字串，若將 scene lane 封裝至子元件或容器模組將引發假紅，無實質保護力。 |
| 638 | B | RED | `modqnReplayProofRequested: modqnReplayProofRequestActive` | 轉為 Playwright 行為測試。於 UI 觸發重播證明請求（點選 proof toggle/按鈕），驗證容器 `[data-scene-lane="mod |
| 647 | V | RED | `from './app/timelineRailAuthority'` | 刪除。釘死 App.tsx 的內部 import 語法，抽取時間軸容器或 Hook 時會假紅，對使用者無任何可觀察差異。 |
| 648 | V | RED | `from './app/liveWalkerHandoverRailAdapter'` | 刪除。為內部適配器之引用字面，重構至 timeline 領域模組時無效中斷建置，應予刪除。 |
| 649 | V | RED | `from './scene/liveWalkerHandoverEventIndex'` | 刪除。斷言 App 直接依賴特定 scene helper 檔名與路徑，違反模組封裝且對執行期行為毫無保障。 |
| 652 | B | RED | `buildLiveWalkerHandoverEventIndex({` | 轉為 Playwright 行為測試。載入即時 Walker 場景，定位 `[data-testid="timeline-rail"]` 並斷言渲染出對應數量與 |
| 653 | B | RED | `liveWalkerHandoverEventIndexToRailEvents(liveWalkerHandoverEventIndex)` | 轉為 Playwright 行為測試。於即時模擬模式下檢查時間軸軌道（`[data-testid="timeline-rail"]`）是否成功將事件轉換並呈現為 |
| 656 | B | RED | `producerTraceDisplayDurationSec` | 轉為 Playwright 行為測試。在 MODQN 重播模式下讀取時間軸與軌道屬性（如 `[data-testid="timeline-bar"]` 之 du |
| 661 | B | RED | `horizonSec={activeTimelineDescriptor.horizonSec}` | 轉為 Playwright 行為測試。透過 Selector `[data-testid="timeline-bar"]` 檢查 DOM 屬性 `data-ho |
| 664 | B | RED | `const liveTimelineWindowStartSec = demoStartOffset;` | 轉為 Playwright 行為測試。設定指定之 `demoStartOffset` 載入即時場景，選取 `[data-testid="timeline-sta |
| 665 | B | RED | `simState.simTimeSec - liveTimelineWindowStartSec` | 轉為 Playwright 行為測試。推進模擬進度，選取 `[data-testid="timeline-current-time"]` 斷言顯示值為視窗經過時 |
| 666 | B | RED | `demoStartOffsetSec: demoStartOffset` | 轉為 Playwright 行為測試。在時間軸進行拖曳/seek 互動，斷言時間軸視窗起點標籤與 `[data-testid="timeline-bar"]`  |
| 667 | B | RED | `const absoluteTargetSec = Math.min(` | 轉為 Playwright 行為測試。模擬將時間軸 scrubber 拖曳至超出邊界的位置，斷言目標時間被限制在最大允許秒數內，未發生越界異常。 |
| 670 | B | RED | `if (sceneLane === 'sinr-live' \\|\\| sceneLane === 'modqn-live-cell-preview') return li | 轉為 Playwright 行為測試。分別切換 sceneLane 至 `sinr-live` 與 `modqn-live-cell-preview`，斷言 ` |
| 671 | B | RED | `if (sceneLane === 'modqn-replay-proof') return modqnHandoverRailEvents;` | 轉為 Playwright 行為測試。切換 sceneLane 至 `modqn-replay-proof`，斷言 `[data-testid="handove |
| 676 | B | RED | `durationSec={timelineRailDescriptor.rail.durationSec}` | 轉為 Playwright 行為測試。檢查 `[data-testid="handover-rail"]` 之 `data-duration-sec` 屬性或寬 |
| 677 | B | RED | `sourceLabel={timelineRailDescriptor.rail.sourceLabel}` | 轉為 Playwright 行為測試。讀取 `[data-testid="rail-source-label"]` 之文字內容，斷言顯示之資料源標籤與目前啟用之 |
| 678 | B | RED | `sourceOwner={timelineRailDescriptor.rail.sourceOwner}` | 轉為 Playwright 行為測試。定位 `[data-testid="handover-rail"]` 並檢查 DOM 屬性 `data-source-ow |
| 679 | B | RED | `sourceGapReasons={timelineRailDescriptor.rail.sourceGapReasons}` | 轉為 Playwright 行為測試。在具有資料間隙之情境下，斷言 `[data-testid="handover-rail"]` 出現警告標記 `[data- |
| 680 | B | RED | `const timelineDurationSec = activeTimelineDescriptor.durationSec;` | 轉為 Playwright 行為測試。切換不同場景模式，選取 `[data-testid="timeline-bar"]` 並斷言顯示與屬性中的總時長隨 act |
| 684 | B | RED | `const activeTimelineDescriptor = isArchivedTleSceneActive` | 轉為 Playwright 行為測試。於首頁切換存檔 TLE 場景，斷言 `[data-testid="timeline-bar"]` 之 `data-sour |
| 686 | B | RED | `stepSec={isArchivedTleSceneActive` | 改為 Playwright 行為測試：切換至 Archived TLE 場景與一般場景，定位時間軸滑桿元素（如 `[data-testid="timeline- |
| 820 | V | RED | `from './showcase/dashboard/AlgorithmDashboard'` | 刪除（V）。純屬頂層 import 路徑字面釘住；重構將指標面板拆至 Sidebar 子元件後即假紅，指標是否正常渲染由 Sidebar DOM 測試保護即可。 |
| 907 | B | RED | `<TrainingTelemetryFeed enabled={appMode === 'modqn-demo'}` | 改為 Playwright 行為測試：啟動頁面並帶入 `appMode=modqn-demo` 參數，驗證頁面遙測資料流（WebSocket/網路請求或 DOM |
| 920 | B | RED | `r.headers.get('X-Showcase-Artifact-Source')` | 改為 Playwright 行為測試：使用 `page.route` 攔截 Replay fetch 請求並注入自定義 `X-Showcase-Artifact |
| 925 | B | RED | `artifactSource !== PRODUCER_PINNED_SOURCE` | 改為 Playwright 行為測試：載入非 producer 釘選之產物（如 synthetic fixture），操作進入重播模式，檢查畫面是否出現非 pr |
| 930 | B | RED | `r.headers.get('X-Showcase-Artifact-Source') ?? HEADER_ABSEN...` | 改為 Playwright 行為測試：模擬 200 成功回應但不帶來源標頭，斷言 DOM 上 `[data-artifact-source]` 屬性或 Badg |
| 935 | B | RED | `artifactSource === SYNTHETIC_FIXTURE_SOURCE` | 改為 Playwright 行為測試：分別傳入合成 fixture 與未驗證來源之產物，定位 Badge/Alert 元素，斷言畫面警示文案精確呈現 "synt |
| 950 | V | RED | `from './ui/ArtifactSourceBadge'` | 刪除（V）。純屬 import 語法釘住；重構拆分至 Replay 工具列或側邊欄子元件後即便在 `App.tsx` 消失，只要畫面正常渲染 Badge 即無損 |
| 955 | B | RED | `<ArtifactSourceBadge source={showcaseArtifactSource} />` | 改為 Playwright 行為測試：切換至 `artifact-replay` lane，使用 `page.locator('[data-testid="ar |
| 960 | B | RED | `data-artifact-source={` | 改為 Playwright 行為測試：載入頁面後直接透過 `page.locator('[data-artifact-source]')` 斷言該 DOM 遙測 |
| 988 | B | RED | `data-director-phase={camera.directorPhase}` | 改為 Playwright 行為測試：在 Director 模式下操作運鏡流程，讀取並斷言 Shell 節點上的 `[data-director-phase]` |
| 993 | B | RED | `data-effective-speed={playback.effectiveSpeed` | 改為 Playwright 行為測試：操作播放速率控制器（如 1x、2x），斷言外層節點上的 `[data-effective-speed]` 屬性值同步變更為 |
| 1031 | V | RED | `useDirectorOrchestration({` | 刪除（V）。釘住內部 Hook 呼叫字串；重構將 Director 編排下移至專屬 Provider/Controller 必假紅，外層運鏡行為由既有 Dire |
| 1047 | B | RED | `sceneLane === 'modqn-live-cell-preview' ? 'overlay-demo' : '...` | 改為 Playwright 行為測試：在啟用 Director Focus 下切換 `modqn-live-cell-preview` 與一般 live 模式， |
| 1053 | S | RED | `createSinrLiveCellHandoverEventIndexWorkerTransport()` | 保留但去檔名化（S）。改為掃描 `src/**/*.{ts,tsx}` 或模組依賴圖，確保事件索引協調模組引用 `createSinrLiveCellHando |
| 1058 | V | RED | `indexWorker.build(buildInput` | 刪除（V）。釘死內部局部變數與呼叫語法；Worker 通訊與索引建立細節應由 Worker 模組之單元/整合測試保護，而非原始碼字串匹配。 |
| 1063 | S | RED | `builder = createSinrLiveCellHandoverEventIndexBuilder(buildI...` | 保留但去檔名化（S）。改為掃描 `src/engine/**` 或索引協調模組，驗證保留 `createSinrLiveCellHandoverEventInd |
| 1091 | B | RED | `data-live-director-focus-claim={directorFocusEnabled ? live...` | 改為 Playwright 行為測試：操作 Director Focus 開關，斷言 DOM 上 `[data-live-director-focus-clai |
| 1096 | B | RED | `data-live-director-focus-event-sec={liveDirectorFocusEventS...` | 改為 Playwright 行為測試：觸發 Director Focus 跳轉事件，定位 `page.locator('[data-live-director- |
| 1209 | V | RED | `from './ui/ArtifactSatelliteCompass'` | 刪除（V）。純屬頂層 import 路徑字面釘住；指南針元件搬移至 Replay 子元件後此行必紅，其掛載與方位角呈現應由其 DOM 節點或子元件測試保護。 |
| 1387 | V | RED | `const [modqnReplayProofRequested, setModqnReplayProofRequest...` | 刪除（V）。直接釘死 React 內部 `useState` 宣告字串；重構抽取 Hook 必假紅，狀態切換應由點擊切換按鈕並觀察 Viewport 渲染的行為 |
| 1390 | B | RED | `proofViewportActive={sceneLane === 'modqn-replay-proof'}` | 改為 Playwright 行為測試：切換 `sceneLane` 至 `'modqn-replay-proof'`，定位 Cue Panel 元素（如 `[d |
| 1391 | B | RED | `canToggleModqnReplayProof ? setModqnReplayProofRequested : undefined` | 轉為 Playwright 行為測試：在具備與不具備切換資格的情境下，點擊 Proof 切換按鈕並斷言 Proof Viewport 是否正確展開/切換，或按鈕 |
| 1392 | B | RED | `getLeftSidebarTabsForSceneLane(sceneLane, handoverMode)` | 轉為 Playwright 行為測試：切換不同的 `sceneLane` 與 `handoverMode`，檢查左側側邊欄渲染出的 Tab 標籤項目清單是否符合 |
| 1393 | B | RED | `getRightSidebarTabsForSceneLane(sceneLane, handoverMode)` | 轉為 Playwright 行為測試：切換不同的 `sceneLane` 與 `handoverMode`，檢查右側側邊欄渲染出的 Tab 標籤項目清單是否正確 |
| 1394 | B | RED | `activeLeftSidebarTab === 'evidence'` | 轉為 Playwright 行為測試：點擊或切換至 `evidence` 分頁，斷言 Evidence/Replay 面板內容 DOM（如 `[data-tes |
| 1395 | B | RED | `data-testid="artifact-replay-sidebar"` | 轉為 Playwright 行為測試：在對應模式下開啟側邊欄，直接以 `page.locator('[data-testid="artifact-replay- |
| 1399 | B | RED | `activeRightSidebarTab === 'artifact'` | 轉為 Playwright 行為測試：切換右側側邊欄至 `artifact` 分頁，斷言 Artifact 相關面板與屬性是否正確渲染於畫面。 |
| 1403 | B | RED | `!recordedReplayActive \\|\\| activeSceneFrame !== undefined` | 轉為 Playwright 行為測試：模擬錄製回放幀尚未就緒時斷言出現 fail-closed placeholder，就緒後斷言該 placeholder 消 |
| 1404 | B | RED | `data-testid="artifact-scene-fail-closed"` | 轉為 Playwright 行為測試：在回放幀未載入時，直接以 `page.locator('[data-testid="artifact-scene-fail |
| 1405 | B | RED | `if (sceneSource === 'artifact-replay' \\|\\| appMode !== 'modqn-demo') return;` | 轉為 Playwright 網路行為測試：在 `artifact-replay` 或非 `modqn-demo` 模式啟動時，監聽網路請求並斷言未發送 MODQ |
| 1413 | B | RED | `sceneLane === 'modqn-live-cell-preview' && <ServiceStatusBanner appMode={appMode} />` | 轉為 Playwright 行為測試：切換至 `modqn-live-cell-preview` 時斷言 ServiceStatusBanner 出現，切換至其 |
| 1469 | B | RED | `axisPlaying={!playback.paused}` | 轉為 Playwright 行為測試：操作播放/暫停控制項，觀察 HandoverEventRail 軌道上的播放狀態標記或動畫屬性是否同步切換。 |
| 1470 | B | RED | `axisPlaybackRate={playback.effectiveSpeed}` | 轉為 Playwright 行為測試：調整播放速率（如 1x 切換為 5x），斷言 HandoverEventRail 上的播放速率相關屬性或 CSS 變數是否 |
| 1503 | V | RED | `from './ui/SinrLiveDisplayDrawer'` | 刪除。這是對單一檔案 import 路徑字面的死釘；只要抽出的 Drawer 元件能正常在 DOM 渲染，App 本身是否直接 import 該路徑對使用者與架 |
| 1589 | B | RED | `parameterSection={` | 轉為 Playwright 行為測試：打開 SINR-live Drawer，斷言其內部是否包含 TLE 參數設定區塊之 DOM 元素或 testid。 |
| 1594 | B | RED | `teachingPolicySection={isWalkerSceneActive ? (` | 轉為 Playwright 行為測試：在 Walker 場景啟用與停用狀態下分別打開 Drawer，斷言 Walker 教學策略區塊是否正確渲染或隱藏。 |
| 1739 | B | RED | `if (!showSinrServingMosaic) return null;` | 轉為 Playwright 行為測試：在非 SINR 模式（或關閉 mosaic 時），檢查 Canvas 遙測屬性，斷言 SINR mosaic 渲染計數為  |
| 1744 | B | RED | `buildSinrServingUeColorMapFromCells(cellFrame.ues)` | 轉為 Playwright 行為測試：在 SINR-live 模式下隨 cell frame 變更，斷言 Canvas 遙測中 UE 標記的著色狀態正確對應 c |
| 1943 | B | RED | `recentHandoverEvents: (sim.sinrLiveCells?.recentHandoverEvents ?? [])` | 轉為 Playwright 行為測試：模擬換手事件發生時，讀取 Canvas 上 `data-sinr-live-handover-pulse-cone-ren |
| 1950 | B | RED | `telemetryCountDatasetKey="sinrLiveHandoverPulseConeRenderedCount"` | 轉為 Playwright 行為測試：在瀏覽器中直接斷言 Canvas DOM 節點上存在 `data-sinr-live-handover-pulse-con |
| 1960 | B | RED | `telemetryCountDatasetKey="sinrLiveTriggeredIntraConeRenderedCount"` | 轉為 Playwright 行為測試：在瀏覽器中直接斷言 Canvas DOM 節點上存在 `data-sinr-live-triggered-intra-co |
| 1965 | B | RED | `resolveTriggeredIntraConeItems({` | 轉為 Playwright 行為測試：觸發 intra 換手事件後，在 2.5 秒顯示視窗內驗證 Canvas 遙測 `data-sinr-live-trigg |
| 2117 | B | RED | `const showUav = sceneLane === 'sinr-live';` | 轉為 Playwright 行為測試：切換 `sceneLane` 至 `sinr-live` 時斷言 UAV 遙測/渲染存在，切換至其他 lane 則斷言 U |
| 2123 | B | RED | `data-scene-lane={sceneLane}` | 轉為 Playwright 瀏覽器測試，使用 `page.locator('[data-scene-lane]')` 檢查 DOM 屬性是否隨場景切換為當前的  |
| 2158 | B | RED | `MODQN_SERVICE_ALLOCATION_PRODUCER_READY \\|\\| readModqnServiceAllocationOverrideFromUr | 轉為 Playwright 瀏覽器測試，開啟帶有 `?modqnServiceAllocation=1` 的網址，驗證服務配置遙測與 UI 是否解除 parke |
| 2168 | V | RED | `modqnServiceAllocationEnabled: runtime.modqnServiceAllocationEnabled ?? false` | 刪除此字串斷言。此為內部物件屬性組裝細節，若被違反使用者無感，真行為已被下游圖層渲染與遙測斷言覆蓋。 |
| 2174 | B | RED | `showUeCounts={modqnVisualLayers.ueCountBadges && showModqnServiceAllocation}` | 轉為 Playwright 瀏覽器測試，切換 `ueCountBadges` 或 service allocation 閘門，檢查 Cell Overlay 上 |
| 2179 | B | RED | `modqnServedUeCount={showModqnServiceAllocation ? modqnServiceMap.servedUeCount : 0}` | 轉為 Playwright 瀏覽器測試，在 parked 狀態下讀取 DOM/Canvas 遙測屬性 `data-modqn-served-ue-count`， |
| 2184 | B | RED | `modqnIdleUeCount={showModqnServiceAllocation ? modqnServiceMap.idleUeCount : 0}` | 轉為 Playwright 瀏覽器測試，在 parked 狀態下驗證遙測屬性 `data-modqn-idle-ue-count` 為 `0`，且不受 cell |
| 2189 | B | RED | `modqnServiceMapEnabled={showModqnServiceAllocation && modqnVisualLayers.serviceMap ? '1 | 轉為 Playwright 瀏覽器測試，在不同圖層開關與 URL 參數下，驗證 DOM 遙測屬性 `data-modqn-service-map-enabled |
| 2199 | V | RED | `deriveModqnServiceMap({` | 刪除此字串斷言。此為內部資料推導函式呼叫，改寫或抽取至 hook 不影響外部行為，其正確性應由消費其產物的 UI 行為測試保障。 |
| 2204 | V | RED | `buildModqnCellServiceReadout({` | 刪除此字串斷言。釘死內部 helper 函式名稱對外部黑盒行為無約束力，其產生的服務讀數應由 SimState/Telemetry 測試覆蓋。 |
| 2210 | V | RED | `modqnCellServiceReadout,` | 刪除此字串斷言。此處僅為物件傳遞內部變數之簡寫語法，即使移除或更名，只要資料流傳遞正常，使用者完全無法察覺差異。 |
| 2215 | V | RED | `markerColor: isOtherHandover` | 刪除此字串斷言。釘住局部三元運算子指派為脆弱內部實作，色彩回退邏輯應在獨立的 marker 樣式單元測試中驗證。 |
| 2220 | V | RED | `mosaic?.markerColor ?? service?.markerColor` | 刪除此字串斷言。純運算式細節應抽取至純函式並以單元測試保護優先級，不應在元件 JSX/主場景檔案內進行字面鎖定。 |
| 2235 | B | RED | `ueCountByCellId={modqnServiceMap.ueCountByCellId}` | 轉為 Playwright 瀏覽器測試，進入 MODQN 場景並檢查各 Cell Overlay 節點呈現的 UE 數量文字是否與當前服務分佈吻合。 |
| 2240 | V | RED | `const showCellReassignmentEventArcs = modqnVisualLayers.handoverCues` | 刪除此字串斷言。宣告局部中繼變數為內部語法糖，改寫為 inline 或自定義 hook 不影響功能，不應限制重構自由度。 |
| 2246 | B | RED | `visible={showCellReassignmentEventArcs}` | 轉為 Playwright 瀏覽器測試，切換 `handoverCues` 視覺選項，驗證重分配事件弧線（Event Arcs）圖層的可見性狀態或遙測標記。 |
| 2251 | B | RED | `<HandoverStoryLayer` | 轉為 Playwright 瀏覽器測試，在滿足條件時透過 `page.locator('[data-testid="handover-story-layer"] |
| 2256 | B | RED | `{presentationPlan.visible['event-effects'] && showProfileHandoverStoryLayer && modqnVis | 轉為 Playwright 瀏覽器測試，分別關閉 `event-effects` 或 `handoverStory` 圖層開關，驗證 HandoverStory |
| 2261 | B | RED | `{presentationPlan.visible['serving-beams'] && showCellOverlay && modqnVisualLayers.beam | 轉為 Playwright 瀏覽器測試，切換 `serving-beams` 或 `beamCones` 開關，驗證波束錐體（Beam Cones）圖層節點是否 |
| 2266 | V | RED | `beamConeScope: renderedCellBeamConeScope` | 刪除此字串斷言。此為傳入 render-count helper 的參數命名寫法，無 runtime 直接訊號，對使用者行為無可觀察影響。 |
| 2272 | B | RED | `beamConeScope={modqnVisualLayers.beamConeScope}` | 轉為 Playwright 瀏覽器測試，變更 `beamConeScope` 控制項設定，驗證場景中波束錐體渲染數量與遙測屬性是否相應更新。 |
| 2283 | B | RED | `deriveBeamLoadContention([...modqnServiceMap.ueById.values()].map(projection => ({` | 轉為 Playwright 瀏覽器測試，在 MODQN 爭端情境下驗證爭用波束光暈（contention glow）之遙測屬性或視覺節點具備非零爭用狀態。 |
| 2293 | V | RED | `const focusBeamLoad = beamLoadContentionEnabled` | 刪除此字串斷言。內部變數宣告與計算為私有實作，焦點 UE 負載顯示應由 UI 面板數值或焦點遙測屬性測試直接驗證。 |
| 2298 | V | RED | `beamLoadContention.byUeId.get(focusedCellBeamConeUe?.id ?? '')` | 刪除。此處釘死內部 Map 存取語法，重構為 helper 函式或抽離 hook 即假紅；使用者無感，波束負載邏輯應由渲染與單元測試保障。 |
| 2304 | B | RED | `{presentationPlan.visible['load-overlays'] && showCellOverla...` | 轉為行為斷言。在 Playwright 中切換圖層顯示設定，斷言 BeamLoadCylinder 3D 物件或 canvas 遙測屬性的掛載/卸載狀態。 |
| 2309 | B | RED | `visible={(focusBeamLoad?.load ?? 0) > 0}` | 轉為行為斷言。在 Playwright 中模擬 UE 負載為 0 與大於 0，透過 canvas 遙測或物件屬性斷言圓柱體幾何體的 visible 行為。 |
| 2344 | V | RED | `import { BeamLoadUploadParticles }` | 刪除。釘死單一檔案的 import 語法；若抽成子圖層元件或透過 barrel 匯入會引發無意義假紅，對使用者無任何行為差異。 |
| 2380 | V | RED | `const uploadParticlesEnabled =` | 刪除。釘死元件內部區域變數宣告；重構改名或 inline 完全不影響執行期行為，屬無效約束。 |
| 2385 | B | RED | `modqnVisualLayerPreset === 'explain-handover'` | 轉為行為斷言。在 Playwright 中切換視覺 Preset 選項，斷言粒子系統是否在 `explain-handover` 模式下於畫面中正確啟動。 |
| 2391 | V | RED | `resolveCellBeamConeItems({` | 刪除。釘死內部輔助函式呼叫字串；邏輯搬移至子圖層即假紅，波束錐體計算正確性應由場景渲染與演算法單元測試驗證。 |
| 2396 | B | RED | `beamConeScope: 'focus-satellite'` | 轉為行為斷言。在 Playwright 中選定聚焦衛星，斷言粒子效果僅限定在該聚焦波束錐體範圍內渲染，而非全域發散。 |
| 2401 | B | RED | `<BeamLoadUploadParticles` | 轉為行為斷言。在 Playwright 中觸發上傳粒子圖層開關，驗證場景 canvas telemetry 或 DOM 遙測節點掛載狀態。 |
| 2406 | V | RED | `focusCones={uploadParticleFocusCones}` | 刪除。釘死 JSX prop 傳遞字面與內部變數名；重構改名或在子元件內部存取對使用者毫無差別，屬過度約束。 |
| 2411 | V | RED | `beamLoadContention={beamLoadContention}` | 刪除。釘死 prop 傳遞寫法；改用 Context 或模組狀態管理即假紅，應由粒子碰撞/競爭的視覺遙測測試替代。 |
| 2681 | V | RED | `function ArtifactSceneContent` | 刪除。強行限制 composer 必須存在於同檔，阻礙拆分獨立檔案；其存在價值應由回放路由行為測試保證。 |
| 2686 | B | RED | `sceneFrame?.sceneSource === 'artifact-replay'` | 轉為行為斷言。在 Playwright 中載入回放資料幀，斷言畫面切換至 Artifact 場景且即時模擬遙測標記為停用。 |
| 2691 | B | RED | `<ArtifactSceneContent` | 轉為行為斷言。在 Playwright 中切換回放幀，斷言場景掛載了 Artifact 回放專屬的 `[data-testid]` 或遙測標記。 |
| 2696 | B | RED | `liveSimulationEnabled="0"` | 轉為行為斷言。在 Playwright 進入回放模式時，檢查 DOM/Canvas 節點上的 `[data-live-simulation-enabled="0 |
| 2701 | B | RED | `liveSimulationEnabled={simSource === 'live' ? '1' : '0'}` | 轉為行為斷言。在 Playwright 中分別切換即時模擬與 TLE 模式，斷言 DOM 遙測屬性分別輸出 `"1"` 與 `"0"`。 |
| 2753 | B | RED | `{presentationPlan.visible['serving-footprints']\n && showS...` | 轉為行為斷言。在 Playwright 中開啟服務覆蓋開關並切換候選模式，斷言覆蓋腳印 3D 圖層持續存在且未被多候選權威覆蓋清除。 |
| 2775 | B | RED | `<DecisionHandoverCue` | 轉為行為斷言。在 Playwright 中觸發換手決策幀，斷言畫面出現換手提示（DecisionHandoverCue）對應的 DOM 節點或 Canvas 特 |
| 2794 | V | RED | `acceptedHandoverPresentation?.commit,` | 刪除。釘死內部屬性存取與依賴項字串片段；重構為 hook 或解構即假紅，對使用者無可觀察影響。 |
| 2799 | V | RED | `const visibleSatelliteId = authorityPresentationCommitObserv...` | 刪除。釘死內部變數宣告與賦值字串；換手過渡期的波束錐體唯一性應由 Canvas 遙測資料斷言，而非約束區域變數命名。 |
| 2816 | B | RED | `multiCandidateSceneRenderPlan?.telemetry.renderedPairCount` | 轉為行為斷言。在 Playwright 中啟用多候選模式，讀取場景遙測屬性 `[data-rendered-pair-count]` 驗證數值與配對數相符。 |
| 2821 | B | RED | `multiCandidateSceneRenderPlan?.solidDataLinkCount` | 轉為行為斷言。在 Playwright 中配置連線場景，讀取 DOM 上的 `[data-solid-data-link-count]` 驗證其正確發布全域實體 |
| 2826 | B | RED | `multiCandidateCentralOverlayActive && !multiCandidateServingCarrierRenderable` | 改為 Playwright 測試：在 Central Overlay 啟用且 serving carrier 不可渲染時，斷言 overlay fallback |
| 2847 | B | RED | `enabled: simSource === 'live' && sceneFrame.sceneSource !== 'artifact-replay'` | 改為 Playwright 測試：切換至 `artifact-replay` 模式時，驗證 canvas 遙測屬性或網路層無 live SimState 推播； |
| 2907 | V | RED | `const [sceneSource, setSceneSource] = useState<SceneSourceMode>` | 刪除此斷言；釘住內部 state 宣告語法，若重構成 custom hook（如 `useSceneLaneState`），使用者在 UI 模式切換上毫無感知， |
| 2912 | V | RED | `const handleExperienceChange = useCallback((targetLane: SceneLane) => {` | 刪除此斷言；釘住單一回呼函式名稱與宣告方式，切換 experience 時的實際狀態重置與 URL 同步應由既有行為測試保護，更名或抽離對使用者無差別。 |
| 3057 | V | RED | `from './ui/AdvancedSetupDrawer'` | 刪除此斷言；釘死 App.tsx 的單一 import 路徑，抽離至 Shell/Layout 容器時必然假紅，且 TypeScript 編譯器與 Drawer |
| 3134 | B | RED | `showDecisionPolicyControls={sceneLane === 'modqn-live-cell-preview'}` | 改為 Playwright 測試：在 `modqn-live-cell-preview` 斷言 `[data-testid="decision-policy-c |
| 3149 | V | RED | `from './ui/HeuristicNotPaperBanner'` | 刪除此斷言；純粹釘住 App.tsx 的 import 語法，Banner 搬至橫幅容器時會假紅，而使用者只在乎 Banner 是否正確依條件渲染在畫面上。 |
| 3154 | B | RED | `handoverMode === 'omega-heuristic' && sceneLane === 'modqn-live-cell-preview' && <Heuri | 改為 Playwright 測試：在 `modqn-live-cell-preview` 下選擇 `omega-heuristic` 模式，斷言 `[data- |
| 3159 | B | RED | `if (targetLane === 'artifact-replay') {\n      if (handoverMode === 'omega-heuristic')` | 改為 Playwright 測試：在 live 下啟用 `omega-heuristic` 並切換至 `artifact-replay`，斷言 policy 下 |
| 3164 | V | RED | `onModqnDecisionPolicyChange={handleModqnDecisionPolicyChange}` | 刪除此斷言；釘住內部 prop 命名與接線，若改用 Context 或內聯處理，行為完全不變但字串斷言即假紅，點擊切換效果應由 E2E 互動測試覆蓋。 |
| 3236 | B | RED | `<AdvancedSetupDrawer` | 改為 Playwright 測試：操作觸發按鈕，斷言 `[data-testid="advanced-setup-drawer"]` 出現於 DOM 中；抽至  |
| 3244 | B | RED | `showDecisionPolicyControls={sceneLane === 'modqn-live-cell-preview'}` | （與 3134 重疊）改為 Playwright 測試：在 Drawer 內檢查 `[data-testid="decision-policy-controls |
| 3249 | V | RED | `onModqnVisualLayerPresetChange={setModqnVisualLayerPreset}` | 刪除此斷言；釘住內部 state setter 與 prop 接線名稱，狀態重構至 Store/Context 時使用者毫無感知，但靜態字串檢查會立刻變紅。 |
| 3254 | V | RED | `onModqnDecisionPolicyChange={handleModqnDecisionPolicyChange}` | （與 3164 重複）刪除此斷言；純內部 prop 命名綁定，無 runtime 語意保證，重構搬遷後使用者視覺與操作皆無差異。 |
| 3259 | V | RED | `onLoadEntry={handleLoadIntoScene}` | 刪除此斷言；釘住 Model Library 的 callback 屬性名稱，真實行為已由點擊載入後場景狀態改變之測試覆蓋，內部換名或搬移不影響使用者。 |

### `scripts/validate-live-walker-handover-event-focus.tsx`

| 行 | 判 | 分解後 | 斷言 | 處置 |
|---|---|---|---|---|
| 226 | B | RED | `timelineRailDescriptor.rail.sourceOwner === 'live-walker'` | 在 Playwright 點擊 `live-walker` rail 上的事件節點，斷言時間軸觸發 live seek 並更新 `[data-timeline- |
| 231 | B | RED | `timelineRailDescriptor.rail.sourceOwner === 'sinr-live-cell-truth'` | 在 Playwright 切換至 SINR cell-truth 模式並點擊 rail 標記，斷言觸發對應的 cell truth seek 與狀態更新。 |
| 236 | B | RED | `timelineRailDescriptor.rail.horizonKind === 'live-walker-window'` | 在 Playwright 點擊視窗時間軸刻度，斷言視窗時間與絕對時間轉換正確反應於時間軸與模擬播放狀態。 |
| 241 | V | RED | `setLiveTimelineSeekRequest({` | 斷言內部 React 狀態 setter 呼叫；若改由自訂 Hook 或事件中心驅動，外部行為不變，應刪除。 |

### `scripts/validate-modqn-handover-story-layer.ts`

| 行 | 判 | 分解後 | 斷言 | 處置 |
|---|---|---|---|---|
| 466 | V | RED | `const [modqnVisualLayerPreset, setModqnVisualLayerPreset]` | 刪除。釘死內部 `useState` 變數名稱；重構抽成 custom hook 或 state store 時會假紅，且 preset 功能已有 UI 控制項 |
| 489 | V | RED | `from './app/timelineRailAuthority'` | 刪除。釘死 App.tsx 的 import 路徑字面；時間軸邏輯下放至子元件後 App 無需直接引用即會假紅，對執行期功能無保護力。 |
| 490 | V | RED | `from './app/liveWalkerHandoverRailAdapter'` | 刪除。釘死 import 語法字面；重構將 rail adapter 移至專屬時間軸子模組時會假紅，使用者無任何感知差別。 |
| 491 | V | RED | `from './scene/liveWalkerHandoverEventIndex'` | 刪除。釘死 import 語法字面；將 event index 建構移入自訂 hook 或協調模組時會假紅，缺乏實質防護價值。 |
| 498 | V | RED | `producerTraceDisplayDurationSec` | 刪除。釘死內部區域變數名稱；時長計算與分離已有 timelineAuthority 單元測試與 UI 渲染保證，變數改名或抽離不影響功能。 |
| 502 | V | RED | `buildLiveWalkerHandoverEventIndex({` | 刪除。釘死 App.tsx 內的函式呼叫字面；邏輯抽至自訂 hook 時會假紅，事件索引的正確性應由軌道渲染與遙測驗證。 |
| 503 | V | RED | `liveWalkerHandoverEventIndexToRailEvents(liveWalkerHandover` | 刪除。釘死內部轉換函式呼叫與變數名稱；重構管線時會假紅，事件映射結果應透過軌道渲染驗證。 |
| 504 | B | RED | `if (sceneLane === 'sinr-live' \\|\\| sceneLane === 'modqn-live-` | 轉行為斷言。Playwright 切換至 `sinr-live` 與 `modqn-live-cell-preview` 模式，操作檢驗 `[data-test |
| 505 | B | RED | `if (sceneLane === 'modqn-replay-proof') return modqnHandove` | 轉行為斷言。Playwright 切換至 `modqn-replay-proof` 模式，檢驗 `[data-testid="handover-event-ra |
| 509 | V | RED | `const liveTimelineWindowStartSec = demoStartOffset;` | 刪除。釘死內部變數賦值；時間軸窗口錨定應透過時間軸顯示數值與 Seek 行為驗證，變數改名或抽入 hook 不影響使用者體驗。 |
| 510 | B | RED | `simState.simTimeSec - liveTimelineWindowStartSec` | 轉行為斷言。在 live Walker 模式下播放或 seek，透過 Playwright 讀取時間軸時間文字（如 `[data-testid="timelin |
| 511 | B | RED | `demoStartOffsetSec: demoStartOffset` | 轉行為斷言。在 live Walker 模式下拖曳時間軸 seek，操作驗證時間軸起始標籤或 telemetry dataset 中的 window offse |
| 551 | V | RED | `deriveModqnServiceMap({` | 刪除。釘死 MainScene 內部的函式呼叫；抽離至專屬 service layer 或 hook 時會假紅，產出正確性直接由下游 UE 覆蓋與遙測驗證。 |
| 552 | V | RED | `buildModqnCellServiceReadout({` | 刪除。釘死 MainScene 內的建構呼叫；邏輯搬移至狀態發布模組時會假紅，其效果已由 SimState 與遙測驗證。 |
| 553 | V | RED | `modqnCellServiceReadout,` | 刪除。僅釘住物件屬性縮寫字面；讀數發布是否正常已由 `el.dataset.modqnServedUeCount` 遙測斷言保護，變數更名無使用者影響。 |
| 555 | B | RED | `ueCountByCellId={modqnServiceMap.ueCountByCellId}` | 轉行為斷言。在 MODQN 模式下透過 Playwright 檢查 `[data-testid="cell-overlay"]` 或 cell badge 上的 |
| 556 | V | RED | `const showCellReassignmentEventArcs = modqnVisualLayers.hand` | 刪除。釘死內部暫存變數宣告；此 flag 的開關效果已在行 558 的 visibility 或 3D 渲染層體現，變數宣告本身無防護價值。 |
| 558 | B | RED | `visible={showCellReassignmentEventArcs}` | 轉行為斷言。透過 UI 切換包含與不包含 handoverCues 的 preset，在 Playwright 中檢驗 3D 場景中 reassignment  |
| 560 | V | RED | `beamConeScope: renderedCellBeamConeScope` | 刪除。純屬內部輔助函式傳參字面；實際 scope 行為已由行 566 的 `el.dataset.cellBeamConeScope` 遙測斷言完整保護。 |
| 562 | B | RED | `beamConeScope={modqnVisualLayers.beamConeScope}` | 轉行為斷言。操作切換不同 beamConeScope 之 preset，透過 Playwright 觀察 canvas 上 `data-cell-beam-co |

### `scripts/validate-modqn-omega-s3-replay-mode-wiring.tsx`

| 行 | 判 | 分解後 | 斷言 | 處置 |
|---|---|---|---|---|
| 262 | B | RED | `appSrc.includes('data-handover-criterion')` | 轉為 Playwright 測試：定位 DOM 容器（如 `page.locator('[data-handover-criterion]')`），斷言該 DO |
| 271 | B | RED | `appSrc.includes("if (handoverMode !== 'decision-overlay-on-live-sinr')")` | 轉為 Playwright 測試：切換交接模式至非 overlay 模式（如 `sinr-offset`），斷言 MODQN 重播疊加層 `[data-test |
| 435 | V | RED | `appSrc.includes('resolveSceneLane({')` | 刪除。釘死 App 內特定輔助函式的呼叫語法；若抽換為 custom hook 或狀態機派生會假紅，場景閘門行為應由行為測試覆蓋。 |
| 436 | V | RED | `appSrc.includes('modqnReplayProofRequested: modqnReplayProofRequestActive')` | 刪除。釘死內部參數傳遞物件的鍵值字面；重播證明圖層是否受 proof request 開關控制應由 Playwright 行為測試覆蓋。 |

### `scripts/validate-modqn-omega-s4-heuristic-not-paper.tsx`

| 行 | 判 | 分解後 | 斷言 | 處置 |
|---|---|---|---|---|
| 230 | B | RED | `handoverMode === 'omega-heuristic' && sceneLane === 'modqn-live-cell-preview' && <Heuri | 改為 Playwright 測試：切換至 `modqn-live-cell-preview` 並選取 `omega-heuristic` 模式，斷言 `[dat |

### `scripts/validate-modqn-phase7k-replay-scene-layer.ts`

| 行 | 判 | 分解後 | 斷言 | 處置 |
|---|---|---|---|---|
| 419 | B | RED | `assertContains(appSource, "if (handoverMode !== 'decision-overlay-on-live-sinr')", 'App | 轉為 Playwright 測試：切換 `handoverMode` 至非 overlay 模式時，驗證場景 canvas/DOM 中的 MODQN 重播層標記 |
| 440 | B | RED | `assertContains(appSource, '<ModqnReplayCuePanel', 'App replay sidebar cue panel')` | 轉為 Playwright 測試：在重播模式下展開側邊欄，斷言 `[data-testid="modqn-replay-cue-panel"]` 於 DOM 中 |
| 445 | V | RED | `assertContains(appSource, 'modqnReplayProofRequested: modqnReplayProofRequestActive', ' | 刪除。釘死內部參數傳遞鍵值字面；其實質保護的閘門條件應轉為 Playwright 測試（切換 Proof Request 開關驗證重播證明層渲染）。 |

### `scripts/validate-phase-3-overlays.ts`

| 行 | 判 | 分解後 | 斷言 | 處置 |
|---|---|---|---|---|
| 84 | B | RED | `const beamLoadContentionEnabled = showModqnServiceAllocation && modqnVisualLayers.servi | 在 Playwright 分別切換服務分配與服務地圖圖層開關，斷言只有兩者皆開啟時 contention glow 遙測標記才為 active。 |
| 97 | B | RED | `<BeamLoadUploadParticles` | 在 Playwright 滿足圖層啟用條件（如開啟 cell overlay 與 handover story），斷言粒子圖層節點掛載且遙測粒子數 > 0。 |

### `scripts/validate-phase-b-artifact-picker.tsx`

| 行 | 判 | 分解後 | 斷言 | 處置 |
|---|---|---|---|---|
| 211 | V | RED | `source.includes('import { ArtifactPicker }')` | 刪除。釘死 import 識別字字面；若將選取器封裝進 Modal 或側邊欄子模組會假紅，且執行期由誰直接 import 對使用者無差別。 |
| 215 | V | RED | `source.includes("useState<'paper-faithful' \\| 'user-trained'>('paper-faithful')")` | 刪除。釘死內部 `useState` 泛型簽名與初值字面；初值狀態應由 UI 預設渲染的 provenance 標籤或徽章（如 `[data-testid="p |
| 219 | B | RED | `source.includes('<ArtifactPicker')` | 轉為 Playwright 測試：點擊開啟 Model Library / Artifact Picker 按鈕，斷言選取器對話框 `[data-testid= |
| 221 | B | RED | `source.includes('onLoadEntry={handleLoadIntoScene}')` | 轉為 Playwright 測試：在 ArtifactPicker 中選取模型條目並點擊載入，斷言場景狀態與模型名稱更新為選定的模型資料。 |
| 225 | B | RED | `source.includes('onLoadPaperFaithful={handleRevertToPaperFaithful}')` | 轉為 Playwright 測試：在 Model Library 介面點擊「恢復為論文基準 (Paper-Faithful)」，斷言系統標籤與場景參數切換回論文 |
| 229 | B | RED | `source.includes('artifactReplaySource={showcaseArtifactSource}')` | 轉為 Playwright 測試：開啟 ArtifactPicker 時，斷言來源選擇/顯示區塊（如 `[data-testid="artifact-repla |

### `scripts/validate-phase-b-jobs-panel.tsx`

| 行 | 判 | 分解後 | 斷言 | 處置 |
|---|---|---|---|---|
| 201 | V | RED | `appSource.includes("import { AdvancedSetupDrawer } from './ui/AdvancedSetupDrawer';")` | 刪除。釘死特定元件的 import 路徑與寫法，阻礙 barrel 匯入或版面容器重構，對使用者與執行期毫無防護價值。 |
| 205 | B | RED | `appSource.includes('<AdvancedSetupDrawer')` | 轉為 Playwright 測試：點擊開啟進階設定按鈕，斷言 `[data-testid="advanced-setup-drawer"]` 抽屜展開且內部配置 |

### `scripts/validate-phase-b-service-client.tsx`

| 行 | 判 | 分解後 | 斷言 | 處置 |
|---|---|---|---|---|
| 184 | V | RED | `import { ServiceStatusBanner } from './ui/modqn-training/ServiceStatusBanner';` | 刪除此斷言；單檔 import 語句釘死，側邊欄抽離至 `RightSidebar.tsx` 時 App.tsx 將不再包含此 import，TypeScrip |
| 188 | B | RED | `<ServiceStatusBanner appMode={appMode} />` | 改為 Playwright 測試：定位右側欄 `page.locator('aside.leo-shell-right [data-testid="servic |

### `scripts/validate-phase-b-training-form.tsx`

| 行 | 判 | 分解後 | 斷言 | 處置 |
|---|---|---|---|---|
| 160 | V | RED | `import { AdvancedSetupDrawer } from './ui/AdvancedSetupDrawer';` | 斷言特定檔案之靜態 import 路徑字面；若改用 barrel export 或 dynamic import 使用者無感，應刪除。 |
| 164 | B | RED | `<AdvancedSetupDrawer` | 在 Playwright 點擊進階設定按鈕，斷言抽屜 DOM 節點（如 `[data-testid="advanced-setup-drawer"]`）成功掛載 |

### `scripts/validate-phase-c-camera-preset.tsx`

| 行 | 判 | 分解後 | 斷言 | 處置 |
|---|---|---|---|---|
| 260 | B | RED | `controls.enabled = false` | 轉行為斷言。Playwright 觸發 director acquiring 運鏡時模擬 canvas 滑鼠拖曳，驗證相機姿態不隨滑鼠改變（OrbitContr |
| 336 | V | RED | `from './directorFocusPose'` | 刪除。釘死 MainScene.tsx 的 import 路徑字面；相機邏輯抽離至 CameraController 後 MainScene 不再引用它即會假紅 |

### `scripts/validate-phase-c-scene-scale-override.tsx`

| 行 | 判 | 分解後 | 斷言 | 處置 |
|---|---|---|---|---|
| 195 | B | RED | `visualScaleMultipliers.beamFootprintMultiplier` | 轉為 Playwright 行為測試：在 SignalTuningPanel 調整 beam scale 數值，斷言 Canvas 上光束涵蓋面積遙測值或視覺縮 |

### `scripts/validate-phase-d-app-wire.tsx`

| 行 | 判 | 分解後 | 斷言 | 處置 |
|---|---|---|---|---|
| 100 | S | RED | `import { fetchUserTrainedBundleEnvelope } from './modqn/training-trigger/userTrainedBun | 改為去檔名化架構約束：透過 ESLint 或 AST/glob 規則檢查全專案 `src/**/*.{ts,tsx}` 對 envelope fetch 的引用 |
| 233 | B | RED | `data-testid="load-into-scene-error-banner"` | 改為 Playwright 測試：觸發模型載入錯誤情境，斷言 `page.getByTestId('load-into-scene-error-banner') |
| 248 | V | RED | `onLoadPaperFaithful={handleRevertToPaperFaithful}` | 刪除此斷言；釘住內部回呼 prop 名稱，真正功能（點擊 revert 按鈕還原預設）由 252 行 testid 搭配的瀏覽器測試保護，內部接線語法改變對使用 |

### `scripts/validate-phase-d-decision-viz.tsx`

| 行 | 判 | 分解後 | 斷言 | 處置 |
|---|---|---|---|---|
| 265 | V | RED | `appSource.includes("import { DecisionVizPanel } from './ui/modqn-training/DecisionVizPa | 刪除。釘死 import 語法與路徑，阻礙側邊欄面板重構；只要 DecisionVizPanel 在側邊欄正常掛載即可，使用者對 import 語法無感。 |

### `scripts/validate-phase-d-reward-curve.tsx`

| 行 | 判 | 分解後 | 斷言 | 處置 |
|---|---|---|---|---|
| 281 | V | RED | `import { RewardCurvePanel } from './ui/modqn-training/Reward` | 刪除。釘死 import 語句字面；若側邊欄抽成獨立元件（如 `ModqnSidebar`），App.tsx 不再 import 它即會假紅，且元件掛載可由 D |

### `scripts/validate-phase-f-ue-distribution-mode.tsx`

| 行 | 判 | 分解後 | 斷言 | 處置 |
|---|---|---|---|---|
| 257 | B | RED | `runtime.ueDistributionMode` | 轉為 Playwright 瀏覽器測試，在 TopologyTab 切換 UE 分布模式單選鈕，驗證模擬核心產生之 UE 位置分佈狀態或相關遙測產生相應變更。 |

### `scripts/validate-phase-g-ue-mobility-params.tsx`

| 行 | 判 | 分解後 | 斷言 | 處置 |
|---|---|---|---|---|
| 227 | B | RED | `runtime.ueMobilityParams` | 轉為行為斷言。在 Playwright 中透過 TopologyTab 變更移動參數，驗證模擬迴圈步進時 UE 座標更新與遙測資料符合該設定。 |

### `scripts/validate-phase-g-ue-mobility-step.tsx`

| 行 | 判 | 分解後 | 斷言 | 處置 |
|---|---|---|---|---|
| 262 | B | RED | `runtime.ueMobilityMode` | 改為 Playwright/模擬整合測試：在場景中設定不同 `ueMobilityMode`（如 `random-walk` 與 `static`），推進模擬時 |

### `scripts/validate-phase-h-s3-live-sim-callouts.ts`

| 行 | 判 | 分解後 | 斷言 | 處置 |
|---|---|---|---|---|
| 79 | B | RED | `<SinrLiveCellBeamCallouts` | 改為 Playwright 測試：操作 UI 開啟「Beam Info」開關，斷言畫面上出現對應的 Beam Callout DOM 節點（`[data-tes |
| 98 | B | RED | `beamCalloutsEnabled={showBeamCallouts ? '1' : '0'}` | 改為 Playwright 測試：切換 Beam Info 開關，直接讀取 canvas/scene 容器的 dataset `expect(await pag |

### `scripts/validate-phase-h-s5-orbit-trail-modqn-demo.ts`

| 行 | 判 | 分解後 | 斷言 | 處置 |
|---|---|---|---|---|
| 27 | B | RED | `appMode !== 'modqn-demo' \|\| reducedMotion` | 在 Playwright 啟動 `appMode=modqn-demo` 並模擬 `prefers-reduced-motion`，斷言特效設定遙測屬性正確響應 |
| 31 | B | RED | `orbitTrail: false` | 在 Playwright 切換至 `modqn-demo` 模式，讀取設定面板或 DOM/Canvas 遙測屬性，斷言 `orbitTrail` 處於停用狀態。 |
| 35 | B | RED | `spineParticles: true` | 在 Playwright 切換至 `modqn-demo` 模式，斷言 spine particles 對應之遙測屬性或渲染節點處於啟用狀態。 |

### `scripts/validate-phase-h-s8-hud-camera-default.ts`

| 行 | 判 | 分解後 | 斷言 | 處置 |
|---|---|---|---|---|
| 27 | B | RED | `source.includes("camera.selectCameraPreset('oblique')")` | 轉為 Playwright 測試：切換進入 `modqn-demo` 模式，操作 UI 模式切換按鈕，斷言相機預設下拉選單或 canvas 遙測屬性（如 `[d |
| 31 | V | RED | `source.includes("appMode === 'modqn-demo' && !modqnDemoCameraAppliedRef.current")` | 刪除。釘死內部 `useRef` 命名與條件運算式語法；業務意圖（單次套用預設）應由 Playwright 測試（進入模式後手動調整鏡頭，驗證 re-rende |
| 35 | V | RED | `source.includes("appMode !== 'modqn-demo'") && source.includes('modqnDemoCameraAppliedR | 刪除。釘死內部 ref 重設賦值語法，使用者完全無法感知；重入行為應由 Playwright 測試（離開 `modqn-demo` 再重新進入，確認相機再次切回 |
| 41 | B | RED | `mainScene.includes("'paper-faithful-closeup'")` | 轉為 Playwright 測試：檢查相機預設選單控制項中存在 `paper-faithful-closeup`（如 `option[value="paper- |
| 74 | V | RED | `source.includes("import { ModqnSceneHud } from './ui/modqn-controls/ModqnSceneHud'")` | 刪除。釘死特定檔案的 import 路徑寫法，阻礙 barrel 匯入或元件重構；只要 HUD 正常渲染，使用者對 import 語法無感。 |
| 77 | B | RED | `source.includes('<ModqnSceneHud')` | 轉為 Playwright 測試：在對應場景與模式下，斷言 HUD 容器（如 `[data-testid="modqn-scene-hud"]`）在 DOM 中 |

### `scripts/validate-phase-i-s5b-cell-beam-cones.tsx`

| 行 | 判 | 分解後 | 斷言 | 處置 |
|---|---|---|---|---|
| 373 | V | RED | `resolveCellBeamConeRenderCount,` | 斷言特定 Helper 函式之識別字存在；若將計算內聯或重構抽取，渲染結果不受影響，應刪除。 |
| 374 | V | RED | `resolveCellBeamConeSatelliteCount,` | 斷言內部計算函式名稱，為實作細節；就算函式改名或由上層傳入，畫面與行為皆無變化，應刪除。 |
| 379 | B | RED | `beamConeScope={modqnVisualLayers.beamConeScope}` | 在 Playwright 操作圖層選單切換 beam cone scope，斷言 3D 場景 telemetry（`canvas[data-cell-beam- |
| 413 | B | RED | `cellBeamConeCount={showCellOverlay ? String(renderedCellBeamConeCount) : ''}` | 在 Playwright 切換 `showCellOverlay` 開關，斷言 `canvas` 上的 `data-cell-beam-cone-count`  |
| 414 | V | RED | `resolveCellBeamConeRenderCount({` | 斷言內部函式呼叫語法；只要 Telemetry dataset 輸出正確，呼叫形式不影響任何執行期行為，應刪除。 |

### `scripts/validate-phase-i-s7b-serving-count-selector.tsx`

| 行 | 判 | 分解後 | 斷言 | 處置 |
|---|---|---|---|---|
| 241 | B | RED | `runtime.cellServingCount ?? DEFAULT_SERVING_COUNT` | 在 Playwright 初始化 `cellServingCount` 為 null 的場景，斷言場景 Telemetry（`canvas[data-cell- |

### `scripts/validate-phase6b-handover-policy-controls.tsx`

| 行 | 判 | 分解後 | 斷言 | 處置 |
|---|---|---|---|---|
| 148 | B | RED | `assertContains(appSource, 'parameterSection={');` | 轉為 Playwright 測試：開啟 SINR Live 抽屜，斷言抽屜內存在參數控制區塊（如 `[data-testid="drawer-parameter |

### `scripts/validate-timeline-scrubbing.tsx`

| 行 | 判 | 分解後 | 斷言 | 處置 |
|---|---|---|---|---|
| 147 | B | RED | `const target = clampTimelineTime(targetSec, timelineDurationSec);` | 在 Playwright 操作時間軸拖曳至超出邊界（< 0 或 > duration），斷言 DOM `[data-timeline-current-time- |
| 151 | V | RED | `setLiveTimelineSeekRequest({` | 斷言內部 React 狀態更新語法，若重構成 Hook 或 Reducer 使用者完全無感；即時跳轉行為應由 E2E 測試覆蓋，此條應刪除。 |
| 153 | B | RED | `data-timeline-current-time-sec={timelineCurrentTimeSec.toFixed(3)}` | 在 Playwright 透過 `page.locator('[data-timeline-current-time-sec]')` 讀取屬性，斷言時間軸播放與 |
| 154 | B | RED | `data-timeline-duration-sec={timelineDurationSec.toFixed(3)}` | 在 Playwright 讀取 `[data-timeline-duration-sec]` 屬性，斷言其數值正確反映當前場景之總時長。 |
| 158 | V | RED | `liveTimelineSeekTargetSec: liveTimelineSeekRequest?.targetSec` | 斷言內部 config 物件傳參細節；若透過 Context 或狀態庫傳遞使用者無法察覺差異，屬於無效釘字應刪除。 |
| 159 | V | RED | `liveTimelineSeekRequestKey: liveTimelineSeekRequest?.requestKey` | 斷言內部 Request Key 之組裝賦值，為純內部管道實作細節；實質功能由跳轉行為保證，應刪除。 |

---

# 附錄 F：執行結果與三個被抓到的量測 bug（2026-09-06 第二階段）

前面的附錄記錄的是**判斷**。這一節記錄**實際執行**的結果，以及執行過程中被抓出來的三個錯誤——
兩個是我自己量測工具的 bug，一個是執行 agent 的越權。三個都是被機器對帳抓到的，不是靠讀報告。

## F-1　實際清掉了什麼

5 個 `codex exec`（gpt-5.6-sol）依「只准刪可證明無效的斷言、嚴禁 re-pin、嚴禁動 src/」的授權執行：

| | 清理前 | 清理後 |
|---|---|---|
| `src/App.tsx` 可證明假綠 | 38 | **1** |
| `src/scene/MainScene.tsx` 可證明假綠 | 53 | **28**（餘數落在沒指派的檔案） |
| `src/App.tsx` 字面 pin | 220 | 181 |
| `src/scene/MainScene.tsx` 字面 pin | 159 | 134 |
| **單次 pin（授權外，不准動）** | 129 / 77 | **129 / 77 未變** |
| 40 個 pin validator | 18 綠 / 22 紅 | 19 綠 / 20 紅 |

**「單次 pin 數量完全沒變」是「沒有越權刪除」最硬的證據**——比任何一份 agent 報告都可靠。

範圍驗收：`src/**`、`package.json`、`.github/**` 一行未動；HEAD 與 stash 未動；
`tsc --noEmit -p tsconfig.scripts.json` exit 0。

## F-2　bug 一：複合斷言連坐（agent 越權，我抓到）

`validate-phase-h-s5-orbit-trail-modqn-demo.ts` 從綠變紅。表層原因是該檔有斷言數量 ratchet
（`assert.ok(PASSED.length >= 17)`），刪 4 條後剩 16。執行的 agent **主動回報了這個 0→1**、
說明原因、並說明為何不自己修（改數字＝為變綠而改斷言字面），升級給 owner——行為正確。

但它沒發現底層問題：那是 `&&` 複合斷言

    expect(
      source.includes('effectsEnabled: runtime.effectsEnabled')      // MainScene，2 次 → 該刪
        && renderPlan.includes('input.effectsEnabled.orbitTrail'),   // 另一個檔案，1 次 → 有效
      'Scene lane render plan reads runtime.effectsEnabled.orbitTrail',
    );

只有前半被授權刪除，它把**整條**刪掉，連帶刪掉對 `src/scene/sceneLaneRenderPlan.ts` 的**單次有效**斷言。

**處置**：只復原 renderPlan 那一半、保留該刪的 MainScene 半邊。這同時解掉 ratchet（16+2=18 ≥ 17），
不必動門檻數字。現在 `PASS (18/0)`。

**教訓**：驗收時要專門掃「被刪除行裡出現的其他接收變數」。單看「刪了幾條」看不出連坐。

## F-3　bug 二：我的計數器讀不懂 `assert.equal(x.includes(y), false)`（我的 bug，agy 抓到）

跨模型複核（4 個 agy 拿到 diff）判出 3 條 `越權`。查證後**完全屬實，而且是我的工具害的**：

    assert.equal(
      appSource.includes('useModqnDemoStub'),
      false,
      'S1.1a: src/App.tsx must not import useModqnDemoStub',
    );

我的計數器只把 `!src.includes(x)` 和 `assertNotContains(src, x)` 認成負向斷言，
**沒認出 `assert.equal(src.includes(x), false, …)` 這種寫法**。於是它把這條讀成
「正向斷言、字面 0 次」→ 標成「今天已紅」→ agent 依授權把它刪了。

實際上 0 次代表**這個守衛正在生效、是綠的**。三條全是這種：
`useModqnDemoStub`、`data-testid="modqn-bundle-fetch-banner"`、`leo-modqn-bundle-fetch-banner`。

**處置**：修 `scripts/audit/count-source-pins.ts`（新增 `isNegated()`，涵蓋 `!x`、`x === false`、
`x !== true`、`assert.equal(x, false)`、`assert.notEqual(x, true)`），並復原三條守衛。
修補後重量，三條都正確標成 `NEG`／0 次，負向總數 37 → 40。

**教訓**：**「今天已紅」這個判準本身可能是量錯的。** 這是今天第四次因為量測方法而得出錯誤結論
（前三次見 §一(2)：變數重綁、多行呼叫、reader 函式名不固定）。
量測工具本身需要跨模型複核，不能只複核它的產出。

## F-4　bug 三：孤兒 `recordPass`（我抓到）

`validate-modqn-omega-s2-runtime-fetch.tsx` 刪掉兩條合法的假綠斷言後，留下了

    // Removed source pin: fetchModqnReplayBundleEnvelope occurs 4 times …
    recordPass('S2.1a', 'App.tsx wires fetchModqnReplayBundleEnvelope');

**斷言沒了，但 `recordPass` 還在**——validator 會回報 S2.1a／S2.1b 通過，背後卻沒有任何檢查。
這正是弱模型實驗記錄過的「加兩個空洞檢查然後回報 6 checks passing」的同一個失敗形狀，
只是這次是刪除造成的副產品。

**處置**：移除孤兒 `recordPass`，改成註解說明這兩個檢查為何被移除、以及要重新守護該用行為斷言。
**一個沒有斷言的 pass 比沒有檢查更糟。**

## F-5　§5 缺的工具現在存在了

`scripts/refactor/analyze-closure-captures.ts`（閉包捕獲分析器）與 `scripts/refactor/extract-region.ts`
（區域抽取執行器，`tsc --noEmit` 當網子、失敗自行 byte-exact 回滾、不借 git）。
測試 **3/3 與 7/7 全過**（我獨立重跑確認）。實測輸出見 `docs/sdd/GOD-FUNCTION-CAPTURE-ANALYSIS.md`。

`App` 的真實規模不是 4,297 行，而是 **232 個 hook 呼叫（useState 64／useRef 29／useMemo 63／
useCallback 45／useEffect 31）與 116 個 owned written bindings**，可抽取性評分 29/100，
理由是「跨越 hook 邊界」。這些 hook 數我用 grep 獨立核對過，與工具一致。

## F-6　20 個 browser 紅燈：9 個出自同一個產品決定

`docs/sdd/worker-reports/W-F.md` 把 15 個未歸因的紅分成 5 組（G1 6／G2 3／G3 2／G4 3／G5 1 個誠實的 D 類）。
我獨立驗證了最大的 G1：`src/App.tsx:403` 是

    isLegacyWalkerRoute ? 'live-sim' : readSceneSourceFromUrl()

而那 6 個 validator 全部用 `?sceneSource=artifact-replay` 進場（6/6 查證屬實）。
**首頁路由刻意忽略 URL 的 sceneSource。**

這與附錄 C 記的 `resolveHomepageInitialRuntimeState` 強制重設 appMode 是**同一個模式**。合計：
**20 個 browser 紅燈裡有 9 個出自同一件事——正規首頁路由被刻意硬化成忽略 URL／localStorage 的
進場狀態，而 validator 還在用舊的進場手法。**

`isLegacyWalkerRoute` 涵蓋 `/`、`/legacy`、`/walker`；`main.tsx` 裡唯一另一條會掛 `App` 的是最後的
無條件 fallthrough（任意未匹配路徑），而 `?simulator=canonical` 走的是 `SimulatorRoute` 不是 `App`。
**所以現行 build 沒有第二條「受支援的」路徑可以讓 validator 帶著 URL 狀態進到 App。**
修法有三種——讓首頁尊重 `?sceneSource=`、指定一條專用路由、或退休那 6 個閘門——
**三種都是產品決定，留給 owner。**

## F-7　還沒做的

- MainScene 仍有 **28 條可證明假綠**，落在這輪沒指派的 validator 檔案裡。
- 附錄 E 判出的 **73 條 V（該刪）** 尚未執行刪除；**130 條 B** 尚未轉成行為斷言。
- 20 個 browser 紅燈只有 5 個被查證為閘門過期、9 個歸因到首頁路由硬化，**尚未有任何一個被修或退休**。
- `extract-region.ts` 只在合成 fixture 上跑過，**尚未用在真正的神函式上**——邊界仍未決定，那是 owner 的事。

---

# 附錄 G：第三階段執行結果（2026-09-06 收尾）

前兩階段做的是**判斷**，這一階段是**執行**：把判定為 V 的刪掉、把剩餘的假綠清掉、修可修的 browser 閘門。

## G-1　清乾淨了

| | 今天開始 | 現在 |
|---|---|---|
| `src/App.tsx` 字面 pin | 223 | **135** |
| `src/App.tsx` 可證明假綠 | 41 | **0** |
| `src/App.tsx` 單次 pin | 129 | 84 |
| `src/scene/MainScene.tsx` 字面 pin | 159 | **79** |
| `src/scene/MainScene.tsx` 可證明假綠 | 53 | **1** |
| `src/scene/MainScene.tsx` 單次 pin | 77 | 50 |

**回歸檢查用 worktree 在 HEAD 上實跑同一批 validator 比對失敗集合（不是比數量）**：
28 個受影響的 validator 中，**綠→紅 0 個**，紅→綠 1 個（`validate:phase-e:sat-count-override`）。
`tsc --noEmit -p tsconfig.scripts.json` exit 0。`src/**`、`package.json`、`.github/**` 一行未動。

## G-2　兩個被抓到並修掉的執行副作用

**斷言數量 ratchet 跌破門檻（兩次）。** `validate-phase-h-s5-orbit-trail-modqn-demo`（>=17）與
`validate-phase-h-s8-hud-camera-default`（>=18）都在刪除後跌破自己的計數門檻。
**兩次都沒有調整門檻數字**（那等於為變綠而改斷言）。做法是找出被刪複合斷言裡**單次出現、真的釘得住**的那一半
還原成獨立斷言：s5 還原 `renderPlan.includes('input.effectsEnabled.orbitTrail'/'…spineParticles')`（16→18），
s8 還原 `source.includes('modqnDemoCameraAppliedRef.current = false')`（17→18）。兩個現在都 PASS。

**這個模式值得記下來**：複合斷言 `a && b` 裡常常一半是假綠、一半是有效的單次 pin。
正確處置是拆開保留有效的那一半，不是整條刪、也不是整條留。

## G-3　這一輪沒有越權（上一輪有）

專門掃了上一輪踩過的兩個陷阱：
- **複合斷言連坐**：所有非目標接收變數（`renderPlanSource`、`telemetrySource`、`appRuntimeModelSrc`）
  的刪除經查證**全是正確的外科式編輯**——只拿掉目標檔那一項，保留其餘。
- **孤兒 pass**：唯一命中的是 `validate-timeline-scrubbing.tsx:160`，查證後它前面仍有 5 條存活的
  `assertContains`，不是孤兒。

工作單裡把這兩個陷阱寫成明文規則（A/B/C 三條執行細節）之後就沒再犯。

## G-4　browser 閘門：修好一層，露出下一層

`validate:golden-flow`、`validate:homepage:multi-candidate`、`validate:contact-window-labs` 三個的
**過期文案／過期契約層已修**，三個都因此走過了原本的失敗點，但各自停在**更後面的斷言**上：

- `contact-window-labs`：act 連結數已改成從 `SIX_ACTS_VISIBLE_ROUTES.length` 推導（不再硬編 6），
  現在卡在 nav 少了 `a[href="/"]`（0≠1）。
- `golden-flow`：文案已跟隨 `goldenFlowPresentationRegression.test.ts` 這個權威改成 `理想補償功率需求 P′`，
  現在卡在 `new-normal: only beat-authorized controls are exposed`。
- `homepage:multi-candidate`：按鈕文案已改成首頁實際的 `Intra/Inter Handover`，
  現在卡在「按鈕要露出正數 indexed-event 計數」。

**這三層已經是逐個閘門的行為除錯，不再是同一類的過期契約。**

另外一個**必須更正的發現**：`validate:phase-c:director-cinematic:live:browser` 與
`validate:phase-c:handover-cinema:browser` 的檔頭自己寫著 `QUARANTINED 2026-06-20`，
明載它們會 hard-fail 在 `director controls mount on the live lane: 0 !== 1`，並指示
「腳本保留、日後 live-lane cinema 重建時再掛回 `validate:live-render`」。
**它們是刻意停放的，不是未發現的紅燈，不該退休。** 附錄 A 的「20 紅」把它們當一般紅燈計入了。

20 個 browser 紅燈的最終歸屬：

| 類別 | 數量 | 誰處理 |
|---|---|---|
| 自我標記 QUARANTINED（設計如此） | 2 | 不動，等功能重建 |
| 首頁忽略 `?sceneSource=`（附錄 C／W-F G1） | 6 | **產品決定 → owner** |
| 首頁忽略 localStorage appMode（附錄 C-1） | 3 | **產品決定 → owner** |
| LaneExperienceBar 沒人掛載（附錄 C-2） | 2 | 可退休（移除覆蓋，owner 決定） |
| handover-event-rail：同一個被移除的 surface | 1 | 同 QUARANTINED 族 |
| 過期文案／契約（G4） | 3 | **本輪已修一層，各露出下一層** |
| legacy natural-pulse carrier（W-F G3） | 2 | 未處理 |
| 證據不足（W-F G5） | 1 | 待查 |

## G-5　神函式：一行都沒動

    src/App.tsx               4,684 行（App 388–4684 = 4,297 行）   未動
    src/scene/MainScene.tsx   6,092 行                              未動
    src/AppWalkerSandbox.tsx  3,222 行                              未動

`git diff -- src/` 全空。**拆分尚未開始，這是刻意的**：

1. §5 要求邊界「由強模型／owner 決定、由工具執行」。**工具現在存在了**
   （`scripts/refactor/extract-region.ts`，`tsc` 當網子、失敗自行 byte-exact 回滾），
   但**邊界仍未決定**，而那不是我能替 owner 決定的事。
2. 26 個 browser 閘門仍有 20 紅，其中 9 個的修法是產品決定。在這上面動刀，之後分不出哪些紅是拆出來的。

**最短可行路徑**：用 `analyze-closure-captures.ts --candidates` 掃出**零 state 捕獲**的候選區域
（工具二只接受這種形狀，其餘一律拒絕），owner 選一個，跑 `extract-region.ts` 執行。
這種抽取不依賴那 20 個紅閘門也能用 `tsc` 驗證。

---

# 附錄 H：P4 開始了——第一批抽取（2026-09-06）

**`src/App.tsx` 的 `App` 從 4,297 行降到 4,250 行，`src/App.tsx` 從 4,684 降到 4,642。**
抽出 5 個模組。這是 P4 第一次有程式碼真的被搬動。

## H-1　流程符合 §5

§5 的限制是「decided by a strong model and executed by tooling with `tsc` as the net —
**never by a model rewriting files**」。實際做法：

1. `analyze-closure-captures.ts --candidates` 掃出候選並評分（工具算的，不是猜的）
2. **邊界由我（強模型）挑選**：只取 score ≥ 95、零 state 捕獲的區域
3. `extract-region.ts` **執行**搬移、產生 import/export、插入呼叫點，
   然後自己跑 `tsc --noEmit` 當網子（每一塊都回報 `typecheck.status: 0`）

沒有任何一塊是我手動改寫 `App.tsx` 搬出去的。

## H-2　抽出的五塊

| 新模組 | 原行號 | 行數 | props | tsc |
|---|---|---|---|---|
| `src/ui/SixActsTopEntry.tsx` | L4042–4060 | 19 | 0 | 0 |
| `src/ui/ArchivedTleBoundaryNote.tsx` | L4259–4271 | 13 | 1 | 0 |
| `src/ui/HomepageBeamRailWaiting.tsx` | L3909–3917 | 9 | 0 | 0 |
| `src/ui/GlobalLocaleToggleSlot.tsx` | L4101–4106 | 6 | 0 | 0 |
| `src/ui/HomepageCanonicalRightRail.tsx` | L4452–4456 | 5 | 1 | 0 |

每抽一塊行號就位移，所以每一輪都**重新掃描候選**，不沿用上一輪的行號。

## H-3　抽出來之後發現工具的一個真缺陷

工具產生的 props 介面帶著**絕對路徑**：

    homepageCanonicalAnalysis: import("/home/u24/demo/leo-beam-sim/src/ui/signal-tuning/useHomepageCanonicalAnalysis").HomepageCanonicalAnalysisState;

來源是 `analyze-closure-captures.ts:261` 的 `checker.typeToString()`——它對跨模組型別就是吐
`import("<絕對路徑>")`。**在這台機器上 `tsc` 會過，換一個 checkout（CI、別人的機器）就壞。**

已修：在 `extract-region.ts` 的產出點加 `rebaseInlineImports()`，把 `import("<abs>")` 依目標檔位置改寫成相對路徑
（工具本身已有同樣的 rebase 邏輯處理 import 語句，只是沒套用到型別字串）。修完 `src/` 已無絕對路徑殘留，
`tsc -p tsconfig.json` 與 `tsc -p tsconfig.scripts.json` 都是 0，`extract-region` 的 7 個測試仍全過。

另外我把批次用的 `AppExtracted1..4` 改成有意義的名字（依各自 `data-testid` / 內含元件命名）。

## H-4　行為驗證

拆分前為綠的 6 個 browser 閘門重跑：第一輪 5 綠 1 紅，把那 1 紅重跑兩次後**全部 6 個綠**。

紅的是 `validate:global-constellation:browser`。判定為**不穩定，不是拆分造成的**：

- **實測**：同一份服務中的程式碼跑三次，rc=1 / rc=0 / rc=0（第三次是完整 PASS）。
  這個閘門是 237 秒的重 WebGL 場景，第一次跑的時候機器上還有 codex／agy 併行，時序敏感。
- **結構**：路由 `/prototype/global-constellation` 由 `main.tsx:243` 用自己的元件處理，
  **`App.tsx` 根本沒被掛載**；它查的 8 個 testid 與抽出的 4 個 testid 零重疊。

**一個必須記下來的方法錯誤**：我原本開了 worktree 想「在 HEAD 上跑對照」，但那次跑用的是
`APP_URL=http://localhost:3000`，而該 dev server 服務的是**主 checkout**——所以 worktree 只換掉了
validator 腳本（而那個檔案我根本沒改過），**app 程式碼兩次都是同一份**。
那個對照沒有測到它宣稱要測的東西。要真的比對 HEAD 的 app 行為，必須在 worktree 裡**另起一個 dev server**
指向 worktree 自己的埠。這是本 session 第五次「量測方法本身出錯」。

## H-5　抽取沒有改變神函式的難度

抽出 5 塊之後，`App` 的捕獲統計幾乎不動：

    hook 呼叫  232（useState 64 / useRef 29 / useMemo 63 / useCallback 45 / useEffect 31）
    ownedWrittenBindings  116

**這正是 §0b 說的重點**：這個函式的難度在 hooks 和 closures，不在行數。抽掉 47 行純呈現 JSX
不會讓它變好拆——**真正的下一步是決定哪些 state 該跟著搬**，而工具目前明確拒絕處理有寫入捕獲的區域
（這是它的設計，不是缺陷）。

所以第一批抽取的意義不是「少了 47 行」，而是**證明了整條路徑可用**：
掃候選 → 人選邊界 → 工具執行 → `tsc` 當網子 → 行為閘門驗證。下一批要動 state 時，這條路徑不用重建。

---

# 附錄 I：130 條 B 類的行為斷言提案與其驗收（2026-09-07）

7 個 `codex exec`（gpt-5.6-sol）併行：Y1–Y6 為 130 條 B 類各產出「可直接實作的行為斷言提案」，
Y7 處理 8 個可動的 browser 閘門。**因為 codex 沙箱起不了 Chromium，它們只做調查與提案，
瀏覽器驗證由主 session 負責。**

## I-1　提案分佈（自報，總數對得上）

| | 數量 |
|---|---|
| 可轉換為行為斷言 | 58 |
| 無法轉換（沒有 runtime 訊號，應改判 S 或 V） | 43 |
| 已被既有測試覆蓋（可直接刪除，不必轉換） | 29 |
| **合計** | **130** ✓ |

**「已被覆蓋 29 條」是意外的收穫**：這些 pin 守的事情已經有單元測試或既有 browser 閘門在守，
轉換是白工，直接刪即可。**「無法轉換 43 條」的誠實度也值得記**——工作單明講「寧可誠實地標無法轉換，
也不要編一個看起來合理但不存在的 selector」，它們照做了三分之一。

## I-2　驗收：提案的 selector 有 13% 不能用

工作單的紀律是「selector 必須是你在 `src/` 實際 grep 到的、附檔案:行號，不准發明 testid」。
機器核對 70 個被提及的 testid（`src/` 共有 774 個真實 testid）：

| 判定 | 數量 | 說明 |
|---|---|---|
| 字面存在於 `src/` | 57 | 可用 |
| 樣板產生且元件有掛載 | 4 | `modqn-layer-preset-*`（`ModqnAdvancedDisplayControls`，由 `AdvancedSetupDrawer` 掛載）→ 可用 |
| **樣板產生但元件是死碼** | **3** | `lane-experience-modqn-live-cell-preview`、`lane-experience-sinr-live`、`modqn-view-modqn-replay-proof` |
| **完全找不到（編造）** | **6** | `advanced-setup-trigger`、`advanced-setup-drawer`、`decision-policy-controls`、`rail-source-label`、`sinr-live-manual-status`、`source-gap-warning` |

**那 3 個「死碼 selector」是最陰險的一類**：字串確實存在於 `src/`，grep 得到，看起來完全合規——
但 `LaneExperienceBar` 與 `ModqnViewToggle` 都**沒有任何檔案 import 或掛載**（本 session 已兩次查證），
所以那些 testid 在執行期永遠不會出現。**照這種提案寫出來的斷言會直接逾時，或更糟——
如果寫成「不存在」的負向斷言，就會變成永遠綠的假綠。**

單純檢查「selector 是否存在於 src/」抓不到這一類。**驗收必須多問一句：那個元件有人掛載嗎。**

## I-3　處置

**這 9 條提案不得實作**，對應的原 pin 應改判：死碼 selector 那 3 條 → 該 pin 守的 UI 已被移除，
改判 V（刪除）；編造 selector 那 6 條 → 退回，需重新調查是否真有觀察點，找不到就改判 S 或 V。

其餘 61 個 selector 通過查證，可以進入實作與瀏覽器驗證階段。

## I-4　「已被覆蓋」這個建議幾乎整組是空的

Y1–Y6 有 29 條建議「已被既有測試覆蓋，可直接刪除不必轉換」。逐條追它們引用的覆蓋者：

| 被引用為覆蓋者的閘門 | 引用次數 | 今天實測狀態 |
|---|---|---|
| `validate:live-walker:handover-event-focus:browser` | 5 | 紅 |
| `validate:phase-3:overlay-render:browser` | 5 | 紅 |
| `validate:homepage:authority:browser` | 4 | 紅 |
| `validate:phase-c:lane-experience-bar:browser` | 4 | 紅（且斷言在死碼元件上） |
| `validate:frontend:advanced-drawer-modality:browser` | 3 | 紅 |
| `validate:phase-c:director-cinematic:live:browser` | 3 | 紅（**刻意 QUARANTINED**） |
| `validate:phase-c:handover-cinema:browser` | 3 | 紅（**刻意 QUARANTINED**） |
| `validate:homepage:multi-candidate:browser` | 1 | 紅 |
| `validate:phase-c:handover-pulse:render:browser` | 1 | 紅 |
| `validate:phase-3:contention-render:browser` | 1 | 紅 |
| `validate:homepage:sinr-layout:browser` | 1 | **綠** |
| `validate-timeline-jump-end-browser.ts` | 1 | 無 npm key |

**32 次引用中 30 次的覆蓋者是紅的。**

照這個建議刪除，等於**拿一個會過的靜態檢查，換一個不會過的瀏覽器閘門**——覆蓋率不是持平，是淨損失。
其中兩個覆蓋者還是自我標記 `QUARANTINED`、按設計保證永遠紅的閘門。

**根因是工作單的漏洞，不是 worker 的錯**：我寫「請標出這條目前是否已經有別的測試在守」，
但**沒有要求它確認那個測試現在是不是綠的**。在一個 26 個閘門有 20 個紅的 repo 裡，
「有測試在守」和「有測試在通過」是兩件完全不同的事——而這份文件從第一頁就在講這件事。

**處置**：29 條「已被覆蓋」全部退回，只有引用綠閘門的那 1 條成立。
其餘 28 條要重新判斷——它們實際上多半屬於「無法轉換」或「可轉換但覆蓋它的閘門要先修好」。

**這條要寫進日後所有派工的驗收清單**：任何「已被 X 覆蓋」的主張，都要附 X 今天的實測紅綠。

## I-5　跨模型複核：130 條提案只有 32 條可直接實作

6 個 agy（Gemini 3.7 Flash High）拿到 Y1–Y6 的提案原文做獨立複核。我把已查證的事實直接寫進 prompt
當前提（9 個無效 selector、26 個閘門中哪 6 個是綠的），它不必也不能自己探 repo。

| 判定 | 數量 |
|---|---|
| **OK（可直接實作）** | **32** |
| 落在紅閘門（要先修那個閘門這條才生效） | 62 |
| selector 無效 | 18 |
| **削弱（看起來像行為斷言，實際證明了比較弱的事）** | **18** |
| 合計 | 130 ✓ |

**「削弱」這一類是複核最有價值的產出**，它抓的是「提案會綠、但原本要守的東西已經壞了」的情況：

- `L1392` / `L1393`：提案說「已被 `src/app/appRuntimeModel.test.ts` 純函式測試覆蓋，可直接刪」。
  但那個測試只證明 **mapping 函式本身**正確，**證明不了 `App.tsx` 有呼叫它**。
  刪掉 pin 就失去接線守衛——函式可以完好無缺地躺在那裡沒人用。
- `L935`：同一形狀，提案主張子元件的單元測試已覆蓋文案分流。
- 另有 6 條的提案是「因為目前路徑不可達／屬性恆為 false，放棄轉換、改判 V」——
  複核指出那等於**用「現在測不到」當成「不需要守」**，兩者不同。

**綜合三層驗收，130 條提案的真實可用率是 32/130（25%）。**
Y1–Y6 自報「可轉換 58」，扣掉 selector 無效與削弱後剩 32；而那 58 之外的 72 條裡，
還有 62 條的落點是紅閘門——**在 26 個閘門有 20 個紅的 repo 裡，
「轉成行為斷言」這件事本身就被紅閘門卡住了。**

這回到同一個結論：**修紅閘門是所有後續工作的前置**，不只是為了乾淨的基準，
而是因為行為斷言需要一個會跑的落點。

---

# 附錄 J：8 個可動 browser 閘門的處置（2026-09-07）

Y7 對 8 個「可以動」的閘門逐個給處置提案（其餘 12 個是產品決定或刻意 quarantine）。
它沒有一律退休，分寸抓得對：**修 4 ／ 退休 3 ／ 保留並標記 2**（7b 只退休過期子段，保留有效半段）。

## J-1　已執行：golden-flow 的 torn read（validator 自己的 bug，不是產品 bug）

Y7 判定 `validate:golden-flow:browser` 的失敗是**測試自己的 torn read**：

    // 原本
    const elapsed = Number(await page.locator('main').getAttribute('data-control-evaluation-elapsed-sec'));
    const expected = goldenFlowControlsAvailable(beat, elapsed).join(',');
    assert.equal(await page.locator('main').getAttribute('data-visible-controls'), expected, ...);

元件每個 animation frame 更新 `reviewWallElapsedSec`，且**兩個 dataset 出自同一次 render 的同一個元素**
（`GoldenFlowPrototype.tsx:1188,1193` — 已查證）。但 validator 用兩次獨立 `getAttribute`，
在 6.000 秒的控制項開放邊界上，第一讀可能拿到 `5.999`（期待集合 `[]`）、第二讀已經是 `replay,next`。

**已修**：改成一次 `locator.evaluate` 原子讀取兩個 attribute，用同一次的 elapsed 算期待值。
`tsc` 0。實跑後**該條斷言不再失敗**——閘門走過它，停在更後面。

**但因此露出一個既有的無障礙違規**：mobile 390×844 下 `.golden-flow-angle-power-ee__note`
字級 `.92rem`（14.72px），違反該閘門「所有可見文字 ≥16 CSS px」的契約。
這個檔案沒有「mobile 提高字級」的既有慣例，所以改 `.92rem` 是**設計決定，留給 owner**。
它是既有問題，只是閘門以前卡在前面根本走不到這條。

## J-2　已執行：handover-event-focus 加上 QUARANTINED 標記

Y7 判定它與兩支已 quarantine 的 director/cinema 閘門**同根因**（live-tab rail 是「日後重建」的 parked feature），
應比照先例保留腳本並加標記，**不是退休**。

查證後執行：它**本來就已經不在 package.json 的任何 aggregate 鏈裡**，與那兩支狀態完全相同，
所以加標記純粹是補上缺的文件。已加，內容註明根因、為何不是產品回歸、以及何時該重新掛回。

## J-3　待 owner 決定：3 個退休提案

退休會移除覆蓋，是 owner 決定，我不自己執行。Y7 的證據如下：

- `validate:phase-c:lane-experience-bar:browser` — 等待的 top-level `LaneExperienceBar` 已被刻意移除，
  現行靜態 governance 甚至**正向要求** App 不 import、不 mount 它。
- `validate:frontend:advanced-drawer-modality:browser` — drawer 本體仍在 MODQN lane 掛載，
  但本閘門**唯一的進入方式**是點已不存在的 `LaneExperienceBar` segment；首頁現行政策明載
  「intentionally does not mount the public SINR/MODQN experience switch」。
  以 URL/localStorage 或直接改 state 切 lane 都是繞道。
- `validate:phase-c:handover-pulse:render:browser` — 整支閘門的目的就是要求 legacy natural-pulse carrier
  在首頁出現，而首頁現行政策刻意永不 render 它。

## J-4　待實作：2 個修法提案

- `validate:contact-window-labs:browser` — 改用可存取名稱定位公開首頁連結，再驗證解析後 pathname。
- `validate:homepage:multi-candidate:browser` — 首頁 quick button 已刻意變成 authored lecture 入口、
  計數也刻意不對使用者顯示；應把 flow action 改成點**公開、source-backed 的 intra/inter timeline marker**
  （該閘門本來就已經先驗證過這兩個 marker）。
- `validate:phase-c:sinr-live-cells:render:browser` — **只移除過期的 ambient pulse 子段**，
  serving-cell render 半段仍保護真實行為，不可整支退休。（Y7 在這裡沒有過度退休，值得記。）

## J-5　待 owner：1 個真實回歸嫌疑

`validate:homepage:authority:browser` — Y7 判定右 rail 與中央 callout 共用 accepted Walker frame
是現行 accepted ADR 契約、兩個 surface 與其 datasets 都還在 build 裡，**不應退休或弱化**，
這次紅燈應當成真實 integration regression（或 dev-server/checkout 不一致）處理。
但只靠通用 30 秒 timeout，**誠實地說**無法指出是第一個 callout wait 還是第二個 predicate 的哪個 conjunct，
因此不能指定修復行。

---

# 附錄 K：codex 決策審查推翻了前一輪三次，也抓到我一個錯（2026-09-07）

owner 授權「需要審核的可與 codex 討論後進行」。D1（gpt-5.6-sol）拿到 5 件待決事項，
被要求**自己重新查證每一條證據、可以推翻前一輪**。結果它推翻了 Y7 三次。

## K-1　三個「退休」提案，兩個改判 QUARANTINED、一個改判「修」

**退休 vs QUARANTINED 的分界**：既有先例（三支 director/rail 閘門）是「功能被 park、日後重建」
→ 保留腳本＋標記＋移出 aggregate。D1 逐一查證這三支屬於哪邊：

| 閘門 | Y7 | D1 | 依據 |
|---|---|---|---|
| `phase-c:lane-experience-bar` | 退休 | **QUARANTINED** | 證據只證明「公開入口已隱藏」，未證明「永久移除」；元件刻意保留在 unreferenced allowlist，handoff 記載保留給 internal proof tooling |
| `frontend:advanced-drawer-modality` | 退休 | **QUARANTINED** | 它保護的契約（drawer 非 modal、無 scrim、timeline 仍可操作）沒有被廢除；drawer 仍條件式掛載，governance 還反向要求 npm key 存在。**入口 parked，保護契約仍活著** |
| `phase-c:handover-pulse:render` | 退休 | **修** | Y7 漏查：natural-pulse renderer 仍保留在非首頁 lane |

**兩個 QUARANTINED 已標記**（保留腳本與 npm key，註明何時該解除）。

## K-2　`/legacy` 這個修法已實作並經實跑證實

D1 指出 Y7 只查了首頁：抑制條件是
`shouldSuppressLegacyPrimaryHandover = homepageVisualIdentity === true && lane === 'sinr-live'`
（`src/app/sceneLane.ts:61`），而 `homepageVisualIdentity` 由 `pathname === '/'` 決定
（`src/App.tsx:4343`）。**`/legacy` 走同一個 App 與 MainScene，但旗標為 false，所以 pulse 仍會 render。**

我逐條複驗屬實後把閘門入口改為 `/legacy`。**實跑證實**：閘門走過原本的
`ambient pulse rendered >= 1 cone` 失敗點，停在更深的 count==render settled-frame 檢查。
**「首頁換掉 legacy carrier」退休的是 homepage-only 的呈現方式，不是 pulse renderer 本身——
所以閘門該搬家，不是該刪。**

## K-3　D1 抓到我一個錯：mobile 字級慣例是存在的

我在附錄 J-1 寫「這個檔案沒有 mobile 提高字級的既有慣例，所以改 `.92rem` 是設計決定」。**錯了。**

`@media (max-width: 1179px)` 區塊裡**已經**把 `.golden-flow-angle-power-ee span`（`__note` 的同層兄弟）、
event copy、handover chain spans 都提到 `1rem`。我先前只搜 390/4xx 斷點，
而這個專案的 mobile 斷點是 **1179px**，所以什麼都沒找到。

**這是今天第八次量測方法出錯，形狀和前七次一樣：用一個會安靜回空集合的查法，然後把空集合當成事實。**

修正後：加 `.golden-flow-angle-power-ee__note { font-size: 1rem; }` 是**跟隨同區塊既有慣例的維護**，
不是設計決定。已套用，16px 違規消失。

## K-4　golden-flow 是層層堆疊的四層紅

每修好一層就露出下一層，這本身值得記錄：

1. 過期文案（`所需功率 P′` → `理想補償功率需求 P′`）— 已修
2. **validator 自己的 torn read**（兩次獨立 `getAttribute` 跨越 animation frame）— 已修
3. mobile 390×844 字級 14.72px < 16px 契約 — 已修
4. mobile 320×720 元素碰撞（`ue-handle` 疊到 `primary-cue` + `axis-guide`，125×25px）— **未修**

第 4 層的 `@media (max-width: 360px)` 區塊慣例是「極窄寬度隱藏或縮小次要元素」，
但「這三個裡哪個次要」是產品判斷，不是跟隨慣例，因此交給 codex 決策審查。

**一個閘門的紅可能是四個獨立問題疊在一起。** 只看第一行失敗訊息會嚴重低估工作量——
今天最初的「20 紅」在這個意義上是低估，不是高估。

## K-5　agy 對 79 條卡住案例的最終歸屬

6 個 agy 判完：**S=7 ／ U=10 ／ V=5 ／ BLOCKED=58**。

**58/80 是 BLOCKED**，且絕大多數卡在同一件事：要交給某個 browser 閘門守，而那個閘門今天是紅的。
這與 I-5 的 62/130「落在紅閘門」是同一個結論的兩次獨立確認：

**修紅閘門不是清理工作的其中一項，它是其餘所有工作的前置。**

---

# 附錄 L：六支 browser 閘門從紅轉綠，共 15 層（2026-09-07）

今天開工時 26 個閘門 6 綠 20 紅。這一節記錄修好的六支，以及每一支的層數——
**因為「一個閘門的紅是好幾個獨立問題疊在一起」是今天最反直覺、也最影響工作量估計的發現。**

| 閘門 | 層 | 各層原因 |
|---|---|---|
| `golden-flow` | 4 | 過期文案 → validator 自己的 torn read → mobile 字級 <16px → 320px 元素碰撞 |
| `contact-window-labs` | 3 | 硬編 6 個 act → `count()` 不等待 → `aria-current` 假設當前 act 在導覽裡 |
| `homepage:multi-candidate` | 2 | 過期按鈕文案 → 改驅動 source-backed marker 而非 authored lecture 按鈕 |
| `homepage:authority` | 3 | EE 斷言錯位 → metric 數量硬編 → 過期互動步驟 |
| `phase-c:handover-pulse:render` | 3 | 入口該用 `/legacy` → Node 端輪詢有盲窗 → 抓取時倍速未降回 1x |
| `phase-c:sinr-live-cells:render` | 1 | pulse 子段與「首頁刻意不 render pulse」衝突，數學上永不可綠 |

**沒有一層是靠放寬斷言換來的。** 每一層的修法都屬於兩類之一：
從真值來源推導（不要換一個硬編值），或移除已被產品刻意退休的期待。

## L-1　「無法診斷」不是事實，是缺少儀器

`homepage:authority` 最值得記。前兩輪分析都誠實表示「只有一個 30 秒 timeout，
無法指出九個 conjunct 裡的哪一個」。加上儀器之後，四步就到根因：

1. 把 predicate 的大 `&&` 改成逐條檢查，**條件與順序完全不變**，只在失敗時把第一個未滿足的條件名記在
   `window` 上（不能用回傳字串——那在 `waitForFunction` 裡是 truthy，第一輪就假通過）
2. 立刻報出 `serving row metric texts are non-empty`
3. 逐欄拆開 → `energyEfficiencyBitsPerJoule`
4. 根因：`HomepageBeamRail.tsx:381` **刻意把 EE 濾出 metric grid**，改由 `EeProgressSummary` 呈現。
   閘門要求一個 rail 設計上就不渲染的元素

**儀器本身不弱化任何斷言**，這是它可以無條件加上去的原因。

## L-2　「安靜地沒作用」的條件式操作

`handover-pulse` 的除錯過程中，我一度斷言「`src/` 沒有 `timeline-speed-20x`，所以倍速從沒生效」。
**錯了**——testid 是樣板 `timeline-speed-${preset}x` 產生的，`SPEED_PRESETS = [1,2,5,10,20]`。
我當天稍早才把這個陷阱寫進附錄 I-2（`lane-experience-${lane}` 那次），然後自己再踩一次。

但這個誤判指出一個真實的風險形狀：閘門裡大量存在
`if (await x.count()) await x.click();` 這種**條件式操作**。
控制項若真的消失，它不會報錯，只會安靜地什麼都不做，讓後面的斷言在錯誤的前提下失敗。
**這種寫法把「入口消失」偽裝成「行為錯誤」。**

## L-3　真正的根因：時序在倍速下被放大

`handover-pulse` 的最終修法要兩半同時做：

- **瀏覽器端 rAF 偵測**取代 Node 端 500ms 輪詢。pulse 保留窗是 **4 秒模擬時間**
  （`SINR_LIVE_RECENT_HANDOVER_RETENTION_SEC`），在 20 倍速下 500ms 的 Node 輪詢等於跨越
  **10 秒模擬時間**——盲窗比整個保留窗還大 2.5 倍。
- **抓取前把倍速降回 1x**。CDP 從 Node 發暫停到瀏覽器真的停止，那段延遲在 20x 下同樣被放大 20 倍，
  足以讓暫停落在 pulse 窗外。

過程中一個假說被材料推翻：原本猜「暫停後等 1500ms 導致淡出」，但 pulse 是依**模擬時鐘**淡出
（`sinrLiveCellModel.test.ts:332`），而暫停會停止模擬時鐘——所以實際時間再久也不會淡出。
**停止猜測、加一行診斷輸出之後，一次就看到 `rendered=NaN`（元件已卸載），根因立刻清楚。**

## L-4　剩下的 9 支全部卡在兩個 owner 決策

見 `docs/sdd/OWNER-DECISIONS-BLOCKING-P4.md`。它們不是技術問題：
6 支卡在「正規首頁路由要不要尊重 `?sceneSource=`」，3 支卡在「MODQN demo 的測試進入合約」。
兩者合計還間接擋住 **62 條行為斷言提案**與 **58 條 pin 歸屬**——它們的落點就是這些閘門。
