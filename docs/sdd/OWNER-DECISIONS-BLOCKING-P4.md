# 兩個擋住 P4 的 owner 決策（2026-09-07 量測）

這份文件只有兩個問題要你回答。它們不是風格偏好，是**產品契約**問題，而且擋住的東西可以量化：

| 決策 | 直接解鎖 | 間接解鎖 |
|---|---|---|
| 決策 1：artifact-replay 的進入規格 | 6 個 browser 閘門 | — |
| 決策 2：MODQN demo 的測試進入合約 | 3 個 browser 閘門 | — |
| 兩者合計 | **9 個閘門** | **62 條行為斷言提案 ＋ 58 條 pin 歸屬**（它們的落點就是這些閘門） |

## 背景：今天的閘門帳

26 個 Playwright `*:browser` 閘門，今天開工時 **6 綠 20 紅**（工作區乾淨，全是既有紅燈）。

20 個紅已經處置到只剩這 9 個：

- **6 支修到完整 PASS**（`golden-flow`、`contact-window-labs`、`homepage:multi-candidate`、
  `homepage:authority`、`phase-c:handover-pulse:render`、`phase-c:sinr-live-cells:render`）
- **5 支確認為刻意停放**，已加或已有 `QUARANTINED` 標記（功能被 park、日後重建）
- **9 支卡在下面這兩個決策**

**沒有任何一支是靠放寬斷言變綠的。** 每一層的修法都是「從真值來源推導」或「移除已被產品刻意退休的期待」。

---

## 決策 1｜正規首頁路由要不要尊重 `?sceneSource=`

### 現況（已查證）

`src/App.tsx:403`：

```ts
const [sceneSource, setSceneSource] = useState<SceneSourceMode>(() => (
  isLegacyWalkerRoute ? 'live-sim' : readSceneSourceFromUrl()
));
```

`isLegacyWalkerRoute` 涵蓋 `/`、`/legacy`、`/walker`（`src/App.tsx:399-403`）。
所以在這三條路徑上，URL 的 `?sceneSource=` **一律被忽略**、強制成 `live-sim`。

而 `main.tsx` 裡唯一另一條會掛載 `App` 的是最後的無條件 fallthrough（任意未匹配路徑）；
`?simulator=canonical` 走的是 `SimulatorRoute` 不是 `App`。
**所以現行 build 沒有任何受支援的路徑，能讓外部帶著 `sceneSource` 狀態進入 `App`。**

### 受影響的 6 個閘門

`phase-c:director-cinematic`、`phase-c:artifact-satellite-compass`、
`phase-c:artifact-scene:real-data`、`phase-c:artifact-fail-closed`、
`phase-d:dashboard:real-data`、`phase-d:dashboard`

六支全部用 `?sceneSource=artifact-replay` 進場，因此永遠拿不到 artifact lane。
它們斷言的程式碼**都還活著**（artifact lane resolver、loader、fail-closed、compass、dashboard 都在），
只是常規入口被封鎖——這是「活程式碼被入口封鎖」，不是「功能被移除」。

### 三個選項

| 選項 | 做法 | 代價 |
|---|---|---|
| **A** | 讓 `/` 以外的 legacy 路徑（或一條指定路徑）尊重 `?sceneSource=` | 要確認不會讓一般使用者從書籤誤入 artifact lane |
| **B** | 指定一條專用的非公開路由給驗證用（例如 `/artifact-replay`） | 新增路由；要決定它算不算公開表面 |
| **C** | 退休這 6 個閘門 | **失去 artifact lane 的全部端對端覆蓋**；程式碼還活著卻沒人守 |

**注意 C 的代價**：artifact lane 是活的產品功能，退休閘門等於讓它從此無人看守。

---

## 決策 2｜MODQN demo 的測試進入合約

### 現況（已查證）

`src/app/appRuntimeModel.ts:120` 的 `resolveHomepageInitialRuntimeState` **刻意抹除**持久化的 appMode：

```ts
/**
 * The public Walker App surface is the canonical paper-formula workspace, not a
 * persisted experience switch. Keep profile preferences, but never let a
 * previous MODQN visit replace its parameter/result rails on the next launch.
 */
const appMode = DEFAULT_APP_EXPERIENCE_MODE;   // = 'sinr-experiment'
```

三個閘門用 `localStorage.setItem('leo-beam-sim.app-mode.v1','modqn-demo')` 切 lane，
進場即被重設。這些腳本的註解自己就寫著「AppModeRail is not mounted in this build」——
它們知道 UI 切換路徑沒了才改用 localStorage 繞道，然後那條繞道也被關掉了。

### 受影響的 3 個閘門

`phase-c:sinr-serving-mosaic`、`phase-3:contention-render`、`phase-3:overlay-render`

### 三個選項

| 選項 | 做法 | 代價 |
|---|---|---|
| **A** | 提供一個受支援的公開 MODQN 入口（重建 AppModeRail 或等價物） | 產品範圍決定 |
| **B** | 提供一個明確的、只給驗證用的進入合約（例如具名 query 參數，並在文件與測試裡登記） | 要接受「產品表面存在一個測試專用開關」 |
| **C** | 退休這 3 個閘門 | 失去 MODQN cell lane 的端對端覆蓋 |

---

## 為什麼這兩個決策擋住的不只是 9 個閘門

今天另外量到兩件事，兩份獨立報告各自得出同一結論：

- 130 條「把文字 pin 改成行為斷言」的提案裡，**62 條的落點是紅閘門**——那個閘門不修好，斷言寫了也不會生效
- 79 條卡住的 pin 歸屬裡，agy 判定 **58 條 BLOCKED**，絕大多數卡在「要交給某個閘門守，而它是紅的」

**修紅閘門不是清理工作的其中一項，是其餘所有工作的前置。** 而剩下的紅閘門全部卡在上面這兩個決策。

---

## 我不替你決定的理由

這兩題都是「產品表面該長什麼樣」的問題：首頁該不該尊重 URL 狀態、產品該不該有測試專用入口。
證據我量完了、選項我列完了、代價我標好了，但**選哪一個是產品方向決定**。

`docs/sdd/APP-TSX-TEXT-PIN-TRIAGE.md` 的附錄 A/C/G/J/K 有完整量測與逐條證據。
