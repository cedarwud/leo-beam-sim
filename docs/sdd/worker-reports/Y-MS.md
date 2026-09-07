# Y-MS `SceneRenderContent` 下沉報告

本輪固定點為目前共用 checkout 的 `HEAD 6c13376`；`MainScene.tsx` 只接入本輪 6 個純模組。沒有執行任何 git 寫入指令，也沒有執行 `*:browser`、`check:ee` 或 `check:visual`。其他 session 的 dirty WIP 保持原樣。

## 分組與判斷

| 語意組 | 目前宣告 | 判斷 | 動作 |
|---|---|---|---|
| earth-fixed cell placement | `sceneGeometry`、`sinrLiveCellPlacementById` | `sceneGeometry` 已是 `sceneGeometryFromProfile` 的薄 adapter；`sinrLiveCellPlacementById` 才是獨立的 archived/live 座標投影與 map 建構 | 前者不抽；後者抽 |
| multi-candidate scene identity | `multiCandidateSceneRenderPlan`、`multiCandidateCandidateReviewRenderPlan`、`multiCandidateSatelliteColorsInput`、兩個 `multiCandidateBeamColorBy...` | 前三者分別只是既有 pure resolver/hook 的輸入接線；兩個 beam color map 有獨立的 precedence、cell/beam 雙索引政策 | 前三者不抽；兩個 map 合併抽成一個 pure module |
| handover marker / geographic anchor | `handoverMarkerSatelliteIds`、`manualHandoverEvent`、`authorityHandoverPresentationCandidate`、`handoverPresentationCandidateInput`、`homepageIntraCellAnchor` | marker union 與 intra anchor 是可命名、可獨立驗證的衍生政策；其餘是既有 pure resolver/hook 的接線，或包含 presentation owner 的輸入組裝 | marker、anchor 抽；其餘不抽 |
| clock / presentation transition | `nowMs`、`latchedAuthorityTransition` | `nowMs` 在 `useFrame` 寫 tick refs 與 React state，形成 feedback edge；latched transition 是單純 episode/boundary projection | `nowMs` 不抽；latched transition 抽 |
| SINR-live visual derivation | `sinrLiveConePalette`、匿名 cone-item adapter、`sinrLiveCellTruthSpineParticlePlans`、匿名 `useHandoverConeItems` adapter | palette 是 spec 欄位的直接重排；cone adapters 已有 resolver/hooks；spine particle plan 是獨立的 hero-cone selection 與 immutable particle row | 只有 spine particle plan 抽 |
| presentation I/O 與 camera owner | `beamInfoItemsInput`、兩個 `command` effect、`tween` | `beamInfoItemsInput` 是既有 pure hook 的薄輸入接線；command/tween 會消費或寫回 camera、controls、refs、state | 全部不抽 |

## 每組結果

所有新模組都使用命名 input type，公開函式不讀 React state、不啟動 canvas；元件內只保留 `useMemo` adapter。每組完成後均依序跑該組 `node:test` 與 `npx tsc --noEmit -p tsconfig.json`，tsc 均為 exit 0。

| 組 | 純模組簽章 | 測試 | MainScene 接縫與行數背景 |
|---|---|---|---|
| cell placement | `resolveSinrLiveCellPlacementById(input: SinrLiveCellPlacementInput): ReadonlyMap<number, SinrLiveCellPlacement>` | `src/scene/sinrLiveCellPlacement.test.ts`：3 tests；disabled、live east/ north 座標、archived placement | `sinrLiveCellPlacementById` 現在為 15 行左右的 adapter；原本 28 行計算下沉 |
| beam color indexes | `resolveMultiCandidateBeamColors(input: MultiCandidateBeamColorsInput): MultiCandidateBeamColors` | `src/scene/multiCandidateBeamColors.test.ts`：2 tests；scene index、authority overwrite、inactive gate | 兩個原本共 61 行的 map 計算合併為一個 resolver + 兩個 map alias |
| marker satellite set | `resolveHandoverMarkerSatelliteIds(input: HandoverMarkerSatelliteIdsInput): ReadonlySet<string>` | `src/scene/handoverMarkerSatelliteIds.test.ts`：2 tests；union order、review plan absent 時不保留 stale ids | 原本 38 行 union 邏輯改為薄 adapter |
| homepage intra anchor | `resolveHomepageIntraCellAnchor(input: HomepageIntraCellAnchorInput): HomepageIntraCellAnchorWorldPoint` | `src/scene/homepageIntraCellAnchor.test.ts`：3 tests；candidate priority、hero fallback、missing placement fallback | 原本 25 行 source-cell priority/placement lookup 改由 pure resolver 完成；React adapter 只轉 `THREE.Vector3` |
| SINR truth spine particles | `resolveSinrLiveCellTruthSpineParticlePlans(input: SinrLiveCellTruthSpineParticlePlansInput): readonly SpineParticlePlan[]` | `src/scene/sinrLiveCellTruthSpineParticlePlans.test.ts`：2 tests；restricted hero cone、gate/缺 cone | 原本 32 行 selection/clone/phase 計算改為薄 adapter |
| latched authority transition | `resolveLatchedAuthorityTransition(input: LatchedAuthorityTransitionInput): AuthorityHandoverTransition | null` | `src/scene/latchedAuthorityTransition.test.ts`：3 tests；selected boundary、commit receipt、inactive/mismatched episode | 原本 31 行 episode match/boundary projection 改為薄 adapter |

本輪新增 6 個純模組、6 個測試檔，共 15 tests，全部通過。相關既有 pure suites 另跑 42 tests，全部通過；完整 `tsc` 最後一次亦為 exit 0。`MainScene.tsx` 由 HEAD 的 5,129 行變為目前 5,018 行，減少 111 行；這只是變更背景，不是成功判準。新增模組與測試合計 619 行，測試可測性才是本輪驗收依據。

補充診斷：`src/scene/multiCandidateMainSceneIntegration.test.ts` 是舊的 source-pin suite，目前 12 tests 中 6 pass、6 fail；`src/scene/archivedTleMainSceneSource.test.ts` 也仍要求已在前一輪移出的 inline `sceneSource/status` 形狀。這些是既有 source layout contract drift，不是本輪 pure resolver 的測試；沒有為了迎合舊 source-pin 回塞字串或重複實作。

## 我判斷不該抽的

- `sceneGeometry`（目前約第 1355 行）：`propSceneFrame` 分支與 profile fallback 是 scene owner 對兩種來源的選擇；真正的 profile 計算已在 `SceneGeometry.ts` 的 `sceneGeometryFromProfile`。再抽一層只會測 adapter wiring，不能增加有效 seam。

- `multiCandidateSceneRenderPlan` 與 `multiCandidateCandidateReviewRenderPlan`（目前約第 2011、2043 行）：兩者已直接呼叫有測試的 `resolveMultiCandidateBeamScene`，差異只是各自的 render gate、snapshot 與 primary UE 輸入。搬走會製造 duplicate scene projection adapter。

- `multiCandidateSatelliteColorsInput`（目前約第 2171 行）、`manualHandoverEvent`（約第 2415 行）、`authorityHandoverPresentationCandidate`（約第 2612 行）：分別是既有 `useMultiCandidateSatelliteColors`、`resolveManualHandoverDemoEvent`、`resolveAuthorityHandoverPresentationEvent` 的薄接線；pure policy 已在被測模組內。

- `nowMs`（約第 2471 行的 `useFrame`）：它不只是 clock calculation，還更新 manual/cinema tick refs 並呼叫 `setManualHandoverNowMs`、`setCinemaHandoverNowMs`，直接形成 presentation feedback edge。抽成 hook 只會搬移副作用，沒有合適的 React-free value seam。

- `readApexWorld`（約第 2566 行）：它是 ref 初始化區段內把 `viz.coneApexWorldById` 的 `THREE.Vector3` 轉成 anchor record 的局部 helper；生命週期與 captured ref 仍由 owner 管理，單獨成模組的測試只會驗證一個三欄 copy。

- `handoverPresentationCandidateInput`（約第 2693 行）與 `homepageSceneBeamVisibilityInput`（約第 2936 行）：都是把 owner 的 state、snapshot、gate 和既有輸入整理給已存在的 `useHandoverPresentationCandidate` / `useHomepageBeamVisibility`。它們是 I/O adapter，不是新的 domain calculation。

- `sinrLiveConePalette`（約第 3101 行）：只是 `beamDisplaySpec` 欄位的直接 rename/重排；沒有 precedence、selection 或 normalization 政策。抽出後測試只能證明欄位搬運，接縫不會變深。

- 匿名的 `useSinrLiveCellBeamConeItems` adapter（約第 3154 行）與匿名的 `useHandoverConeItems` adapter（約第 3278 行）：前者已由既有 hook 接到 geometry/presentation input，後者還同時組 pulse、triggered intra、cinema pair、authority pair 的 policy/geometry/output。把後者搬到 custom hook 會重演本任務已否決的高參數網，且沒有更好的 pure boundary。

- `beamInfoItemsInput`（約第 3504 行）：`beamInfoItems` 本身已在前一輪下沉並有測試；這裡只是 render owner 將當前 cones、handover items、visibility flags 組成其輸入，不是 UI tree 內的可測 domain calculation。

- 兩個 `command` effect（目前約第 3677、3712 行）與 `tween`／`useFrame`（約第 3779 行）：它們讀取 one-shot commands，並寫 camera position、OrbitControls、tween refs、director snapshot、camera transition state。這是 camera owner 與 feedback edge，不是明確輸入到明確輸出的 pure function；保留在 `SceneRenderContent`。

## 寫不出測試因此退回的

無。上述不抽項目是依語意判斷為既有 seam、薄接線、UI/camera owner 或 feedback edge，不是因為測試寫不出來而留下半套抽取。所有本輪交付的 pure seam 都有不掛 React、不啟動 canvas 的 `node:test` + `node:assert/strict` 測試。
