# 真實 Archived-TLE／SGP4 下的 Walker-like LEO Handover 教學與研究架構

## 結論摘要

本研究以你上傳包所指定的 authority 順序為準：ADR-005 定義 archived TLE、SGP4 與 canonical SINR／Power／Throughput／EE；ADR-006 定義跨衛星 Offset＋TTT trace；ADR-009 定義 scientific state 與 presentation state 分離；ADR-010 只取代 ADR-005 的 dense full-catalog 執行機制，不取代共同 UTC、TLE provenance 或 canonical frame；ADR-011 新增 1／7／19 beam layout、Beam Hopping 與 same-satellite beam-switch evidence；產品 SDD 則記錄目前已接通的 source-backed inter／intra replay 與 UI 邊界。這個 authority 與 supersession 關係也與上傳包 README 及 manifest 一致。fileciteturn0file0 fileciteturn0file1 fileciteturn0file2 fileciteturn0file3 fileciteturn0file4 fileciteturn0file5 fileciteturn0file6 fileciteturn0file7

**總結判斷：可以。** 在「每顆研究用衛星的 identity、位置、速度都必須由 frozen archived TLE 經 SGP4 得到」這個條件不變的情況下，仍然可以得到相當接近 Walker 展示的教學效果。關鍵不是把真實星座改成 Walker，而是把 Walker 演示真正有價值的特性拆開：**高事件密度、規律的 plane/shell 視覺結構、清楚的候選 crossing、連續多個 handover story、高仰角事件、慢動作與敘事節奏**。其中前五項可藉由 archive-wide event mining、真實 orbital-plane clustering、scenario/policy selection 與適當的 active-beam/interference model 得到；最後一項完全可以由 presentation clock 達成，而不觸碰 scientific clock。Vallado 等人的 SGP4 基準論文明確強調 TLE mean elements 必須與相容的 SGP4 類模型一起使用，不能把 TLE elements 轉成別的 propagator 後仍視為相同軌跡；同一論文也明列 SGP4 適合大量衛星的 ground-station visibility search 與 communication scheduling。其 §II.D 亦指出標準 SGP4 輸出是 TEME，應先做適當的 Earth-fixed transformation，再進入 observer geometry。這和目前專案「TLE→SGP4→TEME→Earth-fixed→NTPU topocentric」的設計方向一致。citeturn18view0turn18view1 fileciteturn0file2

因此，**Walker-like 不應在本專案被定義成「Walker 軌道」；應定義成「Walker-like presentation characteristics over real TLE evidence」**。這個定義可使 orbital regularity 的視覺語言與 scientific provenance 完全解耦。

本報告使用下列判定：

| 判定 | 本報告中的意思 |
|---|---|
| **VERIFIED** | 已由專案 authority、標準、官方技術資料或原始研究直接支援；不代表尚未跑過的 NTPU archive 實驗結果已被量測。 |
| **PLAUSIBLE** | 物理與工程上合理，且有相關研究或模型支援，但尚未用目前這一份 Starlink／OneWeb archive、NTPU 與 canonical closure 實測。 |
| **REJECTED** | 若被當成目前 canonical TLE research evidence，會違反共同 UTC、TLE identity/provenance、ADR-006 handover state machine 或 canonical-frame 邊界。 |
| **UNVERIFIED** | 必須由目前程式／archive 實際跑出來，文件與公開文獻都不能替你回答其數值。 |

最重要的結論可濃縮成下表。

| 目標 | 是否可完全保留真實 TLE／SGP4 | 最佳手段 | 判定 |
|---|---:|---|---|
| 密集 inter-handover | 是 | archive-wide handover-rich window mining；必要時跨多個真實 run 組成 playlist | **VERIFIED 架構；實際事件數 UNVERIFIED** |
| 高仰角 handover | 是 | 搜尋 archive 的 pass-overlap／peak-elevation 組合，而非移動 RAAN/phase | **VERIFIED 架構；命中率 UNVERIFIED** |
| 清楚 SINR crossing | 是，但不保證每個 run 都有 | 自然 geometry、off-axis gain、caps、真實 interference、association；同時顯示 required power/headroom | **PLAUSIBLE，待實測** |
| 可解釋 intra-satellite beam switch | 是 | 同一 TLE satellite 下的 deterministic beam scenario，並證明 `(UE,s,v1)→(UE,s,v2)` | **VERIFIED** fileciteturn0file6 |
| Walker-like plane 規律感 | 是 | 從 TLE/SGP4 狀態 cluster shell／orbital plane，僅改 grouping/visual encoding | **VERIFIED** |
| 事件附近慢動作、停格、箭頭、文字 | 是 | presentation clock 與 scientific clock 分離 | **VERIFIED** fileciteturn0file4 |
| 跳過長時間沒有事件的區域 | 是 | event-driven seek，TTT/EE 仍依 scientific elapsed time | **VERIFIED** |
| 不同 UTC 真實事件串成教學故事 | 每一 clip 是；整個 montage 不是單一 UTC | Source-backed Event Playlist | **VERIFIED 教學方式；不可當單一 run** |
| 把不同 UTC 衛星疊成一個「看似同時」星座 | 個別物件可有 TLE provenance，但沒有共同物理狀態 | ghost/reference only，禁止進入運算 | **PLAUSIBLE 教學／REJECTED 定量** |
| 改 mean anomaly／RAAN／phase | 否 | 只能另立 synthetic design study | **REJECTED** |
| TLE-fit 後產生 Walker constellation | 否 | 可做獨立 constellation-design study，不能回答本題 canonical 問題 | **REJECTED** |

一項值得現在就納入 provenance 設計的 **2026 年資料格式風險**是：CelesTrak 已指出 legacy TLE 的五位 SATCAT 編號空間於 **2026 年 7 月 11 日**耗盡，新六位編號物件無法以傳統 TLE 格式表示，CelesTrak 因而使用 OMM／JSON／CSV 等格式承載新物件。這不會使你已凍結的 archived TLE 實驗失效，但從 2026 年之後，「full constellation」應精確寫成「full admitted catalog of the frozen TLE archive」，而不能無條件等同於當時所有已編目的太空物件；若未來要納入六位 catalog objects，應另開資料格式／orbit provenance ADR，而不是悄悄把 OMM 混進 TLE contract。citeturn4search1turn4search5

**來源定位重點**如下：Vallado et al., *Revisiting Spacetrack Report #3*, AIAA 2006-6753，§I.A p.2 說明 TLE 與相容 propagator 的必要性，p.3 列出 visibility/scheduling 應用，§II.D p.5 說明 TEME 與 Earth-fixed conversion。citeturn18view0turn18view1 3GPP TR 38.821 V16.2.0 的正式 archive 對應 `g20` 版本，而 ADR-011 引用其 §6.1.1.1、Table 6.1.1.1-4 的 19-beam two-tier hexagonal baseline 與 `ABS = √3 sin(HPBW/2)`；專案同時明確指出這不是 universal payload maximum。citeturn3search2 fileciteturn0file6 TR 38.811 的 NTN channel/mobility study 亦由 3GPP 官方 archive 保存。citeturn3search0

## 候選架構與時空層級比較

### 候選架構比較表

以下「有效換手密度」「高仰角」「SINR 差值」表示該架構**改善取得機會的能力**，不是尚未量測的 NTPU 結果。

| 方法 | TLE identity | SGP4 完整性 | 共同 UTC | 有效換手密度 | 高仰角 | SINR 差值 | Offset／TTT | interference／EE 有效性 | 教學清晰度 | 學術可辯護性 | 實作複雜度 | UI 標籤與主要風險 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **Common-UTC handover-rich window mining** | 完整 | 完整 | 是 | **高潛力** | **高潛力** | 中～高 | 原封不動 | 完整有效 | 高 | **最高** | 中 | 顯示原始 UTC／publication／score；風險是 archive 可能仍事件稀少 |
| **Longer real run＋whole-timeline compression** | 完整 | 完整 | 是 | 高 | 高 | 不直接改變 | 原 scientific time | 完整有效 | 高 | 高 | 中 | 顯示 physical elapsed time 與 playback ratio；video 時間不能拿來積分 EE |
| **Event-driven seek／slow-motion replay** | 完整 | 完整 | 每個 frame 是 | 高「呈現密度」 | 依原事件 | 不改變 | **必須先離線算完，不得因 seek 跳過 TTT** | 每個 anchor 有效 | **最高** | 高 | 低 | `已略過 XX:XX scientific time`；最推薦 presentation 技術 |
| **Real-event playlist／montage** | 每 clip 完整 | 每 clip 完整 | clip 內是；clip 間否 | **很高** | 很高 | 可挑選清楚事件 | clip 內有效；clip 間不連續 | clip 內有效 | **最高** | 高，只要不冒充單一 run | 中 | `來源事件播放清單`＋每段 UTC；不得跨 clip 累積 TTT/EE |
| **Real TLE shell／orbital-plane clustering** | 完整 | 完整 | 是 | 本身不增加 | 有利搜尋 | 本身不增加 | 不變 | 完整有效 | 高 | **高** | 中 | `TLE-derived grouping`，不能叫 Walker-generated |
| **Scenario-policy tuning preserving TLE geometry** | 完整 | 完整 | 是 | 中～高 | 中 | **高潛力** | canonical 3 dB/30 s 不得靜默更改 | 若 scenario 全部重算則有效 | 高 | 高，但 policy 必須版本化 | 中 | 顯示 scenario/policy revision；最大風險是把 tuning 冒充軌道證據 |
| **True multi-satellite active-beam assignment and interference** | 完整 | 完整 | 是 | 間接提高 | 中 | **最高物理潛力** | 可維持原規則 | **完整有效，前提是真實 ownership/association** | 高 | **很高** | **高** | 新 scenario/ADR；不能只是把 candidate 偷塞進 `I_inter` |
| **Moving UE／multi-observer scenario** | 完整 | 完整 | 是 | 高潛力 | 視路徑／地點 | 中～高 | 有效 | 有效 | 中～高 | 高，但研究問題不同 | 高 | 必須標 observer/trajectory；不是「固定 NTPU」結果 |
| **Presentation-only asynchronous TLE composition** | 個別物件有 | 個別有 | **否** | 視覺上很高 | 可編排 | **不可計算** | **無效** | **無效** | 高 | 低 | 大字 `教學合成／非同時星座狀態`；必須排除運算 |
| **TLE-fitted Walker／phase-shifted hybrid** | **已改造** | 對改造後軌道可另算，但不是原 TLE state | 可造一個 synthetic UTC | 高 | 可設計 | 可設計 | synthetic 中可定義 | synthetic study 可算，但**非本專案 TLE evidence** | 高 | 對本題低 | 中～高 | 必須叫 Synthetic；**REJECTED 作為本題解法** |
| **PassPlan／candidate-set diversity mining** | 完整 | 完整 | 是 | **中～高** | 高 | 中～高 | 最終 trigger 可維持 3 dB/30 s | 有效 | 高 | 高 | 中 | 候選產生 policy 必須固定、digest-bound；不能事後挑 candidate 美化結果 |
| **Geometry-diverse event curriculum** | 每事件完整 | 完整 | clip 內是 | 呈現密度極高 | 可刻意覆蓋不同 elevation bins | 可覆蓋 crossing/capped/uncapped | 原 trace | clip 內有效 | **最高** | 高，若明確是 curated dataset | 低～中 | 顯示 selection criteria，防止 cherry-picking 被誤當 population statistics |

**首要排序不是「改星座」而是「先找對真實資料」。** TLE/SGP4 本來就適合大量 visibility search；近期 LEO handover 研究也表明 handover target/timing、remaining visibility、SINR、elevation 與 load 可以形成多目標 selection，而不同偏好的 policy 會產生不同 handover-rate／link-quality trade-off。2022 年 Hozayen 等人的 time-based graph framework 把可見時間中的衛星 instance 作為 graph vertex，並同時優化 target 與 timing；2026 年 Aldubaikhy 的 peer-reviewed study 則直接用真實 Starlink TLE 驅動模擬，並比較 highest-SINR、highest-elevation、longest-visibility 等不同 handover tendencies。這些研究支持「先在真實幾何上做 window/candidate/policy search」的方向，但**不能拿它們的門檻或結果取代你自己的 ADR-006 3 dB＋30 s**。citeturn18view4turn17search1turn17search3

特別值得注意的是，Aldubaikhy 的實驗直接呈現「最大化 instantaneous SINR 會偏向更多切換，而 stability-oriented strategy 會犧牲部分即時 link quality 以換取更少 handover」的 Pareto 型態。這對你的事件搜尋很重要：**event density 本身不是越多越好**；應尋找「足夠多、但每個都有合理 dwell、完整 TTT、低 forced ratio」的 window。citeturn17search3

### 時空錯置分級

| 層級 | 是否仍可稱完整使用 TLE | 是否存在共同物理狀態 | SINR／Interference／Offset-TTT／Power／EE | 教學 | 論文圖 | 定量實驗 | 必要 provenance／模式 | 判定 |
|---|---|---|---|---|---|---|---|---|
| **A：同 UTC，只改播放速度** | 是 | **是** | 全部有效；integral 用 scientific time | 是 | 是 | 是 | UTC、anchor、playback speed | **VERIFIED** |
| **B：同一 run 跳過無事件區間** | 是 | 每個保留 frame 是 | 全部有效；TTT 必須依原連續時間先算完；EE 不得依影片時間 | **是** | 是 | 是 | 顯示 skipped scientific duration | **VERIFIED** |
| **C：不同 UTC 完整事件片段 playlist** | 每段是 | **沒有跨片段單一共同狀態** | 每段內有效；跨段 TTT/interference/EE continuity 無效 | **非常適合** | 可做 multi-panel | 可逐 clip 分析；跨 clip aggregate 須另定統計 protocol | 每 clip run ID、publication、UTC | **VERIFIED playlist** |
| **D：不同 UTC ghost/reference overlay** | 主體與 ghost 個別是 | **整張畫面否** | 只有 canonical 主體有效；ghost 不加入任何共同計算 | 是 | 可，需醒目說明 | 否 | 每 ghost 原 UTC＋`non-participating` | **PLAUSIBLE 教學** |
| **E：每顆衛星不同時間映射** | 個別軌跡是 TLE-derived | **否** | 混合畫面的 SINR、interference、TTT、Power、EE 全部無物理意義 | 只可概念演示 | 僅可概念圖 | **否** | `Asynchronous composed constellation` | **REJECTED 定量** |
| **F：改 mean anomaly／RAAN／phase** | **否** | synthetic 狀態可存在 | 對 synthetic constellation 可重新計算，但不能沿用 TLE canonical claim | 可作設計教學 | 可另作 synthetic 圖 | 可另做 synthetic study | 明確 `Synthetic TLE-seeded hybrid`＋新 ADR | **REJECTED 本題** |
| **G：TLE fit shells→synthetic Walker** | **否** | synthetic 狀態可存在 | 可建立另一套 simulation，但不是 archived-TLE experiment | 是 | 是，若清楚標示 | 可作 constellation-design research | 獨立資料產品／模型／ADR | **REJECTED 本題** |

A、B 的安全性尤其高，因為 ADR-009 已經把 playback speed、camera、focus、layer visibility 等定義為 presentation state，而 ADR-006 的 handover 是在完成的 30 秒 scientific anchor 軸上先算出的 immutable trace；換言之，**影片可以在 2 秒內播完 20 分鐘，但那 20 分鐘在 TTT、energy integration、visibility 與 event ordering 上仍然是 20 分鐘**。fileciteturn0file3 fileciteturn0file4

C 也比 E 安全得多。C 不是創造不存在的幾何，而是把多個完整、各自可重現的 scientific episodes 編輯成 narrative。它和論文把不同 experiment snapshots 排成 multi-panel figure 的本質相近；問題只在**不能宣稱 panel A 到 panel B 是同一個連續 UTC run**。因此，若單一 NTPU 兩小時 window 找不到足夠事件，我認為 C 是應該採用的正式後備方案，而不是走 E/F/G。

D 可保留。例如在 canonical 事件旁淡淡顯示「昨天另一個高仰角 pass 的 reference satellite trajectory」，有助解釋 plane/shell。可是 ghost 必須具有不同的 material/line style、原 UTC、小型 provenance badge，且其 object ID 不得進入 association matrix、interference membership、serving/candidate selection、handover state machine 或 energy accounting。這正符合 ADR-009 的 evidence/presentation separation 精神。fileciteturn0file4

E 是最危險的「看起來完全合理」方案。TLE 每顆都是真的並不足以讓畫面成為真的 constellation state：Vallado 指出多衛星分析依賴一致的 time handling，而 SGP4 state 本身是某一傳播 instant 的 state。把 satellite A 放在 10:00、B 放在 10:04、C 放在 10:11，再把三者的 path loss/interference 相加，沒有對應的共同物理 instant。citeturn18view1

F/G 更直接違反 ADR-005。TLE 中本來就帶有 inclination、RAAN、mean anomaly、mean motion 等 mean-element information，但 Vallado 特別警告這些不是可以任意當 osculating Kepler elements 修改後仍聲稱「TLE 軌跡」的參數；用另一套 dynamical treatment 會破壞原 TLE/SGP4 一致性。citeturn0search1turn18view0

## 最推薦的三個架構與物理 SINR 設計

**首選：Canonical Event Atlas＋Event-driven Research Replay**

這是本研究最推薦的架構，也是應該先做的最小增量。資料仍從現有 archive resolver 出發，對大量 `t0` 建立 frozen publication、共同 UTC SGP4、pass index、canonical link frame 與 ADR-006 trace，再把「事件」而不是「日期」變成一級 offline index。ADR-010 已經建立 content-addressed PassIndex、conservative shortlist、exact confirmation、AOS／peak／LOS 與 real UTC event provenance 的架構，實際上已經非常接近這一方案所需的資料層。fileciteturn0file5

它有兩個時鐘：

`scientificClock = 原始 UTC / 30 s canonical anchor`

`presentationClock = seek / pause / slow motion / camera / annotation timing`

例如 scientific time 從 10:02:00 直接 seek 到 10:17:00，在觀眾面前可以只花 0.5 秒，但 handover engine 不會因此認為只經過 0.5 秒；它讀的是已完成的 10:02→10:17 trace。事件附近則可以用 0.25× 或逐 anchor stepping。這不改變任何公式，也不會創造不存在的 handover。fileciteturn0file3 fileciteturn0file7

多事件、高仰角和漂亮 crossing 都由 **selection problem** 解決，而不是 generation problem 解決：從數週到數月 archive 找 event-rich windows，並把事件依 `valid Offset+TTT`、forced ratio、elevation、candidate dwell、visible multiplicity、SINR crossing、before/decision/after completeness 排名。Vallado 明確把 SGP4 的一項典型用途列為大規模 visibility search 與 communication scheduling；因此這種離線 mining 與 TLE/SGP4 本身的使用模式高度一致。citeturn18view0

優點是 scientific claim ceiling 幾乎不需變：所有畫面均可以是 Research Replay，論文 figure、clip、數值、handover count、EE 都可追到 accepted run。缺點是：**archive 是否真的含有足夠「漂亮」的 NTPU valid handover，仍是 UNVERIFIED**。

**次選：Source-backed Event Playlist／Curriculum**

當首選證明「單一 2h window 不夠像 Walker demo」，不需要改軌道。把多個 ranked real events 各自保存成 immutable clip：

`Clip A: 2026-… UTC, Starlink, valid Offset+TTT, high elevation`

`Clip B: 另一 UTC, OneWeb, strong SINR crossing`

`Clip C: same-satellite beam switch`

`Clip D: forced continuity，特別拿來教「這不是正常 TTT handover」`

每段的 before／decision／after 都仍來自同一 accepted run；playlist layer 只是 sequencing。這會比 asynchronous constellation 安全很多，而且可以刻意把「正例、反例、edge case」排成課程。產品 SDD 已經有 source-backed inter/intra replay 與 deterministic capture/provenance 概念，因此此方案不需要另一套 renderer 或公式。fileciteturn0file7

scientific clock 每到新 clip 就明確跳到另一個 UTC/run；presentation clock 可以在 clip 間做 transition。跨 clip 不存在 TTT continuity，也不能把前一 clip 的 cumulative EE 接到下一 clip。論文可用多 panel/多事件表格，但每個 panel 必須各自有 UTC/run ID；若要做 population statistics，應回到 Event Atlas 的全事件 dataset，而不是只統計被 curator 挑出的漂亮 clips。

這是最適合講者實際操作的模式：`next event`、`previous event`、`restart`、`pause at decision`、`show threshold arrow`、`compare required power` 都可以完全是 presentation semantics。

**第三選：True Multi-satellite Active-beam Scenario over TLE Geometry**

這是若 event mining 之後仍發現「valid events 有，但 serving/candidate SINR 太接近」時最值得投入的 scientific extension。

目前 ADR-005 的 current scenario 中，七個 active beams 都屬 serving satellite，因此 canonical `I_inter = 0`；candidate 是 same-instant link counterfactual，而不是第二顆 active interfering satellite。ADR-011/SDD 雖已加入 per-satellite 1／7／19 layout、association、Beam Hopping 與 beam trace，但 current candidate 仍不能因為「在畫面上有 beam」就算進 `I_inter`。fileciteturn0file2 fileciteturn0file6 fileciteturn0file7

真正的 extension 應是：

`common-UTC TLE geometry`

→ 多顆 visible satellites 各自有 declared eligible beams

→ UE association 決定真實 serving pairs

→ `BeamLoad` 與 `BeamActive` 從 assignment 衍生

→ ownership/reuse colour 決定 `I_intra` / `I_inter` membership

→ 同一 canonical `P_DL_actual` 與矩陣計算

→ SINR／Throughput／P_sys／EE

這完全不要求改 SINR/EE algebra，只是把目前「single serving-satellite active ownership」的 scenario 擴展成真正 joint service scenario。ADR-005 本來就定義了 satellite ownership、same-colour `I_inter` 與 canonical matrices，因此 algebraic seam 已存在；但是 scenario semantics、candidate role、association policy、service equivalence、validation fixtures 都需要新 ADR 或至少 ADR-011 的明確 extension。fileciteturn0file2

### 為什麼 adaptive power 會把 SINR 壓得很接近

這其實不是 simulator 缺點，而是合理的閉迴路現象。你目前 canonical chain 是：

`geometry / gain / loss → h → γ_req → p_req → caps → P_DL_actual → realized SINR`

若 serving 與 candidate 都有足夠 power headroom，而且 `p_req` 的目標就是讓 link 達成類似 service target，那麼兩個 link 一個「比較差」的結果可能主要表現在**需要更多 RF power**，而不是 realized SINR 差很多。這正是 ADR-006 已經預告的情況：如果 canonical power-control closure 讓 serving/candidate SINR 保持在 3 dB 內，第一版可能只產生 forced handover；那是合法科學結果，不是調低 threshold 的授權。fileciteturn0file2 fileciteturn0file3

因此 **VERIFIED 推薦**是同時展示以下 derived diagnostics，而不是只盯 ΔSINR：

| 診斷量 | 教學意義 | 是否改 canonical 結果 |
|---|---|---|
| `p_req` | 兩條 link 為達同一 service target 各需要多少 RF | 否 |
| `P_DL_actual` | 真正送出的 canonical RF | 否 |
| beam-cap binding | `p_req` 是否碰到 `P_beam,max` | 否 |
| satellite-cap binding | aggregate request 是否受 `P_sat,max` 約束 | 否 |
| power headroom | cap 與 required power 的距離；必須用 canonical allocation 定義 | 否 |
| link margin | realized SINR 相對 declared requirement 的 margin | 否 |
| slant range／elevation | 幾何造成 propagation 差異的來源 | 否 |
| off-axis angle／`G_T(theta)` | beam pattern 造成 link 差異的來源 | 否 |
| `I_intra`／`I_inter`／noise | 解釋為什麼相同 signal power 不一定有相同 SINR | 否 |
| capped／uncapped badge | 說明「為什麼這次 SINR 才真正拉開」 | 否 |

自由空間 attenuation 本來就會隨 propagation distance 與 frequency 改變，ITU-R P.525-5 是目前 in-force 的 free-space attenuation recommendation；大氣氣體衰減則有 ITU-R P.676-13 的獨立 recommendation。這些來源支持「高低 elevation／slant-range 差異能造成真實 link-budget 差異」這個物理方向，但你的專案仍應繼續使用已凍結的 canonical loss closure，而不能臨時把完整 ITU model 插進一個 clip 只為把差距放大。citeturn15view0turn15view1

作為**非專案結果的純幾何示例**，若假設球形地球、550 km 高度、只比較 free-space range term，衛星在 zenith 時 slant range 約 550 km；在 30° elevation 時約 993 km，僅距離比例就相當於約 5.1 dB 額外 free-space loss；10° 左右的差距可超過 10 dB。這只是說明「不用偽造公式，真實幾何本來就可以產生數 dB 差異」，並不是 Starlink 校準值，也沒有包含 antenna pattern、atmosphere、interference 或 power control。其物理依據是 P.525 的 free-space attenuation 關係。citeturn15view0

因此，要合理取得更清楚的 ΔSINR，優先順序應是：

**第一層：geometry selection。** 搜尋 range/elevation/off-axis separation 本來就較大的 real crossings。

**第二層：cap-binding scenario。** 在專案 authority 允許的 beam/satellite power caps 範圍內，尋找一邊 uncapped、另一邊 capped 的 anchor。這會自然把「同 target SINR」的 power equalization 打破。不得把 cap 調成只為某一顆 candidate 人工失敗而沒有 scenario rationale。

**第三層：beam geometry。** 由真實 `theta` 與 1／7／19 boresight layout 讓 serving/candidate 擁有不同 off-axis gain。3GPP TR 38.821 Table 6.1.1.1-4 的 19-beam UV-plane baseline 支持規則化 beam boresight geometry；ADR-011 已把它轉成專案可接受的 layout preset，但也明確禁止把 19 當 operational Starlink/OneWeb layout。citeturn3search2 fileciteturn0file6

**第四層：真實 active interference。** 只有當其他 satellite/beam 在同 UTC 真正有 active ownership/reuse membership 時，才加入 `I_inter`。這是最可能產生有解釋力、且不是純 range effect 的 SINR 差異，但也是工作量最大的一層。fileciteturn0file2

**第五層：association/policy。** 可把 expected remaining visibility、elevation、load、headroom 等用於 candidate generation 或 PassPlan，但若正式 handover trace 仍宣稱 ADR-006，就必須讓最後 trigger 保持 `candidate SINR − serving SINR ≥ 3 dB` 持續 30 秒。已有 peer-reviewed／published handover work顯示 visibility time、link quality、elevation 與 load 確實可作為不同 selection policy 的資訊，且 policy 會改變 handover/stability trade-off。citeturn18view4turn17search3

相反地，以下全部應列為 **REJECTED visual manipulation**：直接對 candidate SINR 加 `+6 dB`、對 serving 減 `−3 dB`、在 UI layer 將 candidate power 乘一個沒有 canonical owner 的倍率、把 candidate 默認視為 interferer、畫較窄 beam 卻不重算 antenna gain、把不同 UTC links 的 signal/interference 相加、降低 Offset/TTT 卻仍標示「3 dB/30 s canonical trace」、或用影片播放秒數代替 physical elapsed time 積分 energy。這些做法都會破壞目前 single-frame/single-power ownership。fileciteturn0file2 fileciteturn0file3 fileciteturn0file4

## Offline event-mining 演算法

建議把 mining 正式定義成：

`TLE archive → freeze publication → common-UTC SGP4 → conservative visibility index → exact pass extraction → canonical serving/candidate links → Offset/TTT trace → event scoring → ranked teaching clips`

而不是「把每個兩小時 run 全算完，再人工看哪一個漂亮」。

ADR-010 已提供最關鍵的 scalable pattern：snapshot-aware content key、coarse conservative shortlist、exact SGP4 confirmation、`visibleIdsByAnchor`、AOS/peak/LOS events、禁止 hard-coded top-N，以及 optimized path 對 dense baseline 必須 `missedVisibleIdsByAnchor=[]`。這應直接成為 archive miner 的底座。fileciteturn0file5

**資料凍結。** 每一個 candidate `t0` 先用 ADR-005 的 deterministic resolver 取得單一 frozen publication，記錄 archive ID、publication SHA-256、snapshot digest、每顆 admitted TLE identity/epoch、SGP4 implementation revision。跨 publication 不混 TLE；沒有 admissible record 時標 `unavailable`，不能填 Walker/Kepler。fileciteturn0file2

**第一階段 geometry-only pruning。** 不急著算全部 canonical EE。先由 coarse index 找出可能和 NTPU visibility cone 相交的 IDs，再 exact SGP4；每個時間區域至少要求兩顆同時 visible 才有 inter-HO 候選。對 pass overlap 記錄 `AOS、peak、LOS、max elevation、overlap duration、concurrent visible count`。這一步可以大幅排除「一定不可能產生 valid inter-HO」的 window。

**第二階段 TTT feasibility pruning。** 對任一 serving/candidate pass overlap，要求候選身份至少有足夠 continuous visibility 覆蓋 `pre + TTT + post`。當前 TTT 是 30 秒，而且決策軸只有 30 秒 anchors，因此候選只出現一個瞬間的 window 不值得進入昂貴 canonical evaluation。fileciteturn0file3

**第三階段 canonical link evaluation。** 只對 geometry-qualified windows 建立目前 source-backed PassPlan、association、beam scenario 及 canonical link frame；不得在 miner 使用「較便宜的 approximate SINR」排完名後把近似結果當正式 event evidence。approximation 可以用來 over-include，但 final score 必須由完整 accepted frame 產生。

**第四階段 handover trace。** 完全依 ADR-006：同一 anchor 的 `Δγ = γ_candidate − γ_serving`；Offset 3 dB；TTT 30 s；candidate identity 變化、消失或不滿足 margin 就 reset；serving invisible 造成的切換另標 `forced-continuity`。initial attach 不計 handover。fileciteturn0file3

**第五階段 clip quality。** 每個 valid event 保存至少完整 `before / decision / after`，例如預設 `−90 s / event / +120 s`。這個長度只是 presentation default，可調；scientific anchor identity 不因此改變。

### 建議的 event-quality objective

不要只用一個 weighted score 決定科學價值。最安全是「**hard gates → Pareto ranking → weighted teaching score 作 tie-breaker**」。

先定義 hard gates：

\[
G_e =
I(\text{Offset+TTT valid})
I(\neg \text{forced})
I(\text{same candidate during TTT})
I(\text{visible through required anchors})
I(\text{complete before/decision/after})
I(\text{same run/publication/parameter digest})
\]

只有 `G_e=1` 才列入 `N_valid`。forced continuity 應保留在 dataset 中作反例，但不能進 valid count。這直接符合 ADR-006。fileciteturn0file3

對 window \(W\)，先保留原始、不可被 score 隱藏的 metrics：

\[
N_{\rm valid},\quad N_{\rm forced},\quad
r_{\rm forced}=
\frac{N_{\rm forced}}
{N_{\rm valid}+N_{\rm forced}},
\]

\[
T_{\rm outage},\quad
\Delta\gamma_e(t),\quad
T_{\rm cand,post},\quad
\epsilon_{s,e},\epsilon_{c,e},\quad
N_{\rm visible}(t),\quad
C_{\rm complete}.
\]

其中 elevation 建議同時記錄 serving、candidate 與 `min(ε_serv, ε_cand)`。如果教學目標是「兩顆都高」，應以 minimum 為主，而不是只拿其中一顆的 peak。

Pareto 排序建議依序偏好：

`N_valid ↑`

`forced ratio ↓`

`outage ↓`

`candidate post-decision dwell ↑`

`event elevation ↑`

`crossing clarity ↑`

`concurrent visible count ↑`

`clip completeness ↑`

最後才用一個可調、**明確標為 project-defined** 的 teaching score：

\[
Q(W)=
0.30\,q_N+
0.15\,q_{\rm cross}+
0.10\,q_{\rm dwell}+
0.10\,q_{\rm elev}+
0.05\,q_{\rm vis}+
0.10\,q_{\rm complete}+
0.05\,q_{\rm contrast}
-0.10\,q_{\rm forced}
-0.05\,q_{\rm outage}.
\]

這些權重是 **PLAUSIBLE／設計提案，不是 3GPP 或文獻標準**。它們的目的只是 curator ranking，raw metrics 必須一起保存。

建議 normalized feature 如下：

- `qN = min(N_valid / 4, 1)`：對一個 2h teaching run，四個 valid events 已足以形成密集故事；`4` 是 UI/teaching saturation constant，不是 scientific threshold。
- `qcross` 同時獎勵「before 低於 3 dB threshold、decision 後高於 threshold」與 crossing slope，而不只獎勵永遠遠高於 threshold 的 candidate。
- `qdwell = min(T_cand,post / 120 s, 1)`，避免切過去立刻消失的事件拿高分。
- `qelev = sin(min(ε_serv, ε_cand))`，保留單調高仰角偏好，不必任意硬設單一 cutoff。
- `qvis` 依事件附近同時 visible satellites 數量做 bounded normalization。
- `qcomplete` 要求完整 before/decision/after canonical anchors。
- `qcontrast` 是 ΔSINR 的教學清晰度，但權重刻意較低，避免 miner 為了漂亮數字偏好物理奇異事件。
- `qforced = r_forced`。
- `qoutage` 由 window outage fraction 正規化。

對「高仰角」本身，研究 dataset 建議**不要只凍結一個門檻**，而是同時輸出 `≥45°、≥60°、≥75°` 三個 bins。把 `60°` 當 primary teaching-high-elevation threshold 是合理的 **PLAUSIBLE project convention**，但不應寫成 3GPP requirement。

### Shell、plane 與 phase clustering

TLE format 本身含 inclination、RAAN、mean anomaly、mean motion 等欄位，可用來建立初始 descriptive index。citeturn0search1 但更穩健的 visual/search clustering 建議使用**同一 UTC 經 SGP4 傳播後**的 state，而不是直接比較 epoch 不同的 raw RAAN：

\[
\mathbf{h}_i(t)=\mathbf{r}_i(t)\times\mathbf{v}_i(t),
\qquad
\hat{\mathbf{n}}_i(t)=
\frac{\mathbf{h}_i(t)}
{\|\mathbf{h}_i(t)\|}.
\]

用 plane normal 的 angular distance cluster orbital planes，再搭配 inclination、mean motion／characteristic radius 做 shell grouping。沿 plane 的 phase ordering也由同一 UTC 的 propagated position 投影取得。這樣「plane 1、plane 2、phase order」只是對**真實 contemporaneous SGP4 state**的分類，不會生成新 orbit。Vallado 對 TLE element/propagator coupling 的警告正是避免把 raw mean elements 當成可任意修改的幾何。citeturn18view0

這個 clustering 可直接用來做 Walker-like 視覺語言：同一 plane 同色、不同 shell 不同 line style、candidate crossing 時顯示 plane labels，讓觀眾感受到規律星座結構，但所有 GLB 仍停在原來的 TLE/SGP4 位置。

### Sampling 與 event refinement

目前 **handover decision 必須保留 30 s anchors**。ADR-006 明確拒絕把 historical 3.5 s Walker timer 混進 current trace；ADR-011 也指出若要有更快的 scientific decision axis，必須另做 validated run contract。fileciteturn0file3 fileciteturn0file6

不過 AOS／LOS／peak elevation 等**幾何事件邊界**可以在 indexer 內用更細的真實 UTC SGP4 samples 做 refinement，例如在粗略 crossing 附近採 1–5 s，再用 root/event search 找更精確的 visibility boundary。Orekit 的官方 EventDetector 就以連續 switching function `g` 的 sign change 搭配 root finding 定位事件，並以 elevation crossing horizon 作為典型例子。citeturn16view5

這裡的重要邊界是：

**可做**：1 s refined AOS／LOS／peak、camera timing、trajectory interpolation、annotation。

**不可直接做**：用 1 s refined ΔSINR 偷偷宣稱 7 s TTT handover，而 canonical trace 仍只有 30 s validated scientific axis。

如果未來確實需要 5 s 或 1 s handover science，應新增 `FineDecisionTrace` contract，重新驗證 canonical link inputs、TTT semantics、EE intervals 與 UI labels；不要只改 renderer。

### 搜尋跨度、索引與計算量

建議使用 staged search：

`7 days → 30 days → 90 days → full available archive`

先以 `t0` 每 30 分鐘一個 grid 掃描；7 天是 336 個 start windows，30 天是 1,440，90 天是 4,320。對高分 time regions 再用 5–10 分鐘 offsets refinement。這些是工程搜尋參數，不是 scientific assumptions。

ADR-010 記錄過的 dense Starlink checkpoint 約為 10,760 satellites × 241 anchors，即約 **2.59 million satellite-anchor states**，當時同級 full local request 約 118.71 MiB private typed arrays、9.62 s；數量明確是 snapshot-dependent。fileciteturn0file5 如果對 30 天 1,440 個 start windows 每次都 dense 重算，概念上會重複處理約 37 億 satellite-anchor combinations；因此 archive mining 必須依 publication、time chunk 與 observer reuse pass/index cache，而不是把現有兩小時 job 放進最外層雙重迴圈。

建議 index hierarchy：

`publication digest`

→ `satellite/orbit coarse index`

→ `time chunk`

→ `exact visible IDs`

→ `pass overlap`

→ `canonical-qualified windows`

→ `handover events`

→ `clip score`

相鄰 chunk 必須帶 overlap；不得用 top-N 截掉「看起來不重要」的 satellite。ADR-010 的 zero-missed-visible-satellite gate 應延伸到 miner。fileciteturn0file5

每個 ranked clip 至少保存：

`archiveId`

`publicationSha256`

`resolvedSnapshotDigest`

`TLE identity/epoch receipts`

`requested t0`

`observer coordinates`

`SGP4 revision`

`visibility policy revision`

`scenario/beam/association digest`

`canonical parameter digest`

`handover policy = offset 3 dB / TTT 30 s`

`event type`

`before/decision/after anchor UTCs`

`event quality score version`

`forced flag`

`presentation script ID`

如此 Figure/Clip 只需引用 event receipt，不需重新推導科學資料。

## 最小驗證實驗

目前上傳的六份 authoritative documents **沒有包含可在本對話直接執行的完整 Starlink／OneWeb TLE archive、PassIndex artifact 或 event trace dataset**；因此「固定 NTPU 搜 30 天到底有幾次 valid inter handover、其中幾次 ≥60°」在此刻必須標為 **UNVERIFIED**。任何現在直接給你一個數字都會是假精確。文件只能證明 pipeline、現有 snapshot/run architecture 和目前 3 dB/30 s 規則，而不能替 archive sweep 產生結果。fileciteturn0file2 fileciteturn0file3 fileciteturn0file5

建議第一個實驗完全不碰前端，名稱可定為：

**`NTPU Real-TLE Handover Availability Sweep`**

輸入固定如下：

| 輸入 | 設定 |
|---|---|
| Constellations | Starlink、OneWeb 分開報告 |
| Observer | NTPU `24.9441667°, 121.3713889°` |
| Archive resolver | ADR-005 deterministic frozen-publication rule |
| Propagator | 現行 validated SGP4 |
| Canonical window | 7200 s，241 × 30 s anchors |
| Canonical model | 目前 accepted defaults，不改公式 |
| PassPlan | 現行 source-backed policy，記 policy digest |
| Handover | ADR-006：3.0 dB offset＋30 s TTT |
| Forced continuity | 獨立 event type |
| Beam scenario | 先跑目前 default；不要一開始同時改 beam/power/policy |
| Search grid | 7 d → 30 d → 90 d；`t0` 每 30 min |
| Fine geometry | 只用於 AOS/LOS/peak refinement，不改 HO trace |
| High elevation bins | 45°／60°／75° |
| Clip completeness | 至少 before／decision／after |

這個實驗應輸出**每個 constellation、每個 search range**的：

`number of valid Offset+TTT events`

`forced events`

`forced / all service changes`

`valid events per physical hour`

`number ≥45/60/75°`

`serving/candidate elevation at event`

`candidate residual visibility after decision`

`concurrent visible satellites`

`ΔSINR before / qualification / decision / after`

`p_req`

`P_DL_actual`

`beam/satellite cap binding`

`power headroom`

`link margin`

`I_intra / I_inter / noise`

`outage seconds`

`complete clip count`

並輸出 population distributions，而不只輸出「最佳五個事件」。

### 第一題：多長搜尋範圍可找到多少 valid inter handover？

**答案必須由 sweep 決定。** 建議停止條件不是預先假定「30 天一定夠」，而是先畫 cumulative curve：

\[
N_{\rm valid}(D),\quad
N_{\rm high-elev}(D),\quad
r_{\rm forced}(D)
\]

其中 \(D=1,\ldots,7,30,90\) days。當新增搜尋日期的 marginal event diversity 已明顯下降，就知道是否值得跑 full archive。

教學上的**建議成功門檻**可定為：30 天以內至少找到 **6 個完整 valid Offset+TTT clips**，且不是同一 satellite pair/近似幾何的重複事件。這是 **PLAUSIBLE product acceptance threshold，不是通訊標準**。

若 30 天 `<6`，不要先碰軌道：擴到 90 天或完整 archive。

### 第二題：多少事件達到高仰角？

主報 `≥45°、≥60°、≥75°` 三個 bins。建議把「至少 3 個 valid events 兩顆衛星的 event-time minimum elevation ≥60°」視為 Walker-like teaching curriculum 的理想門檻。

若 valid events 多但高仰角少，**先擴 archive time span**，而不是改 orbit phase。固定 observer 的 pass geometry 隨 orbital phase/time 自然變化，visibility search 正適合找這類機會。citeturn18view0

若完整 archive 仍不足，再把「其他 observer」當獨立研究條件。multi-observer 會擴大事件 dataset，但不應用來聲稱「NTPU 本來就有這些高仰角事件」。

### 第三題：SINR 差值是否足以教學？

不要只問「平均 ΔSINR 多大」。至少分三類：

**Crossing-clear**：before 低於 3 dB threshold、candidate qualification/decision 達到 ≥3 dB，且畫面能看出 crossing。

**Power-clear / SINR-compressed**：SINR 看似接近，但 `p_req`／headroom 明顯不同。這其實是 adaptive-power 很好的教學案例。

**Cap-separated**：candidate 或 serving 的 required power 被 cap 截住，因而 realized SINR 明顯分離。

對教學可暫訂：至少 3 個事件具有 `max ΔSINR − min ΔSINR ≥ 4 dB` 的 clip dynamic range，或有清楚 cap-binding transition；這個 **4 dB 是 UI clarity threshold，不是 handover validity threshold**。正式 valid trigger 仍只有 ADR-006 的 3 dB/30 s。fileciteturn0file3

如果 valid event 數本身為零，那麼「SINR 是否足夠教學」的第一個答案反而很清楚：目前 adaptive closure／scenario 沒有創造 3 dB sustained crossing。此時應看 `p_req/headroom/caps`，找出是 geometry 本身相近，還是 power controller 把差異補平。

### 第四題：哪些參數可合理提高事件密度？

應按 claim risk 排序：

| 手段 | 第一輪是否應測 | 原因 |
|---|---:|---|
| 搜尋日期／t0 | **是** | 不改 science，只選真實 window |
| candidate/PassPlan diversity | **是** | 可從同時可見真實 satellites 找較有 dwell/crossing 的候選；policy 要固定 |
| beam layout 1/7/19 | 第二輪 | 已由 ADR-011 授權 scenario，會改 off-axis/association |
| fixed/BH illumination | 第二輪 | 可產生真正 same-satellite beam transitions；不是 operational schedule claim |
| `P_beam,max` / `P_sat,max` | 第二輪 | canonical inputs；可測 capped/uncapped regime |
| `K_FR` | 第二輪 | canonical input，同時影響 bandwidth/noise/reuse interference |
| true multi-satellite ownership/interference | 第三輪 | 物理價值高，但需要新 scenario validation |
| bounded representative UE position | 可做 sensitivity | ADR-009 已授權 bounded probe，但研究問題從固定 default UE 變成位置 experiment |
| arbitrary moving UE | 不在第一輪 | 現 authority 沒有授權完整 mobility scenario |
| Offset/TTT | **不要在 canonical sweep 改** | 現有 trace 固定 3 dB/30 s；要做 sensitivity 應另立 policy arm |
| asynchronous time／phase shift | **禁止** | 不能用來增加正式事件 |

`K_FR`、power caps、beam geometry 等已經是現有 canonical/scenario surface 的有效科學因子；但一次 experiment 最好只改一類，以免「事件變多」到底由哪個 control 造成變得不可識別。fileciteturn0file2 fileciteturn0file6

### 第五題：是否真的需要跨時間合成？

判定樹應是：

`30 d NTPU mining 足夠` → **不需要 C/D/E**

`90 d/full archive 有足夠事件，但沒有單一 2h window 足夠密` → 用 **B + C**：event-driven playback／real-event playlist

`archive-wide 仍少 valid event，但有很多 forced` → 先研究 candidate/association/caps/interference，**不要先 composition**

`valid event 夠但 SINR 很平` → 加 `p_req/headroom` 教學，再測 physically justified cap/joint interference

`固定 NTPU 研究問題本身就無法提供所需 curriculum` → C 是正式推薦的教學 montage；D 只作 context

**只有為了純概念藝術性展示才需要 E；F/G 完全不是解這個問題的必要條件。**

因此，最小實驗的成功/失敗路線可摘要為：

| 實驗結果 | 下一步 |
|---|---|
| 30 d 已有 ≥6 valid、≥3 high-elev、forced ratio 可接受 | 直接建 Event Atlas／Replay |
| valid 足夠但分散於不同 UTC | Source-backed Playlist |
| valid 少、forced 多 | 擴 archive＋檢查 candidate planner／dwell |
| ΔSINR 平，但 `p_req` 差明顯 | UI 顯示 required power/headroom；不修改 SINR |
| ΔSINR 與 power 都平 | 先測 beam/cap/reuse，再考慮 joint interference |
| 固定 NTPU full archive 仍不足 | multi-observer/mobility 作新 research scenario；playlist 作 teaching |
| 只有 synthetic Walker 才能達到目標 | 應承認「真實 TLE 無此事件分布」，而不是改造 TLE 後仍叫 real-TLE result |

## ADR／模式邊界

建議新增一份 presentation/provenance ADR，而不是改 ADR-005/006 的 science。其核心規範可以直接寫成以下四層。

**Canonical／Research Replay**

Scientific state 必須是單一 accepted run：一個 frozen publication、每顆 satellite 的 admitted TLE identity、一個共同 UTC anchor、一套 scenario/parameter digest、一個 handover trace identity。Playback speed、pause、camera、annotation、show/hide、scene focus 不改 scientific state。Event-driven seek 可以跳 UTC，但每個顯示 frame 都必須是原 accepted run 中的 identified state；TTT 已按原 scientific sequence 計算，EE 使用原 physical `dt`。此模式可以輸出正式研究 evidence、Figure、CSV、manifest。這延續 ADR-005、ADR-006、ADR-009 的既有 contract。fileciteturn0file2 fileciteturn0file3 fileciteturn0file4

**Source-backed Event Playlist**

每個 clip 都必須是上述 Canonical/Research Replay 的 immutable subset。playlist 只擁有 presentation ordering，不擁有 satellite state、handover state 或 formula values。每個 transition 必須顯示新 UTC，並明示 `跳轉 +17m30s` 或 `下一個獨立事件：YYYY-MM-DD HH:MM:SS UTC`。不得跨 clip 延續 TTT progress、handover count、cumulative energy 或 evaluation EE。

此模式可以用於教學，也可以用於論文 multi-panel figure／supplementary video；但 caption 必須寫「selected real-TLE events from multiple UTC intervals」，不能寫成「continuous two-hour experiment」。若要從 playlist 中做統計推論，必須回到未經 curator 篩選的 Event Atlas population。

我會給此模式 **VERIFIED／建議新 ADR 或 ADR-009 amendment**。

**Teaching／Composed Replay**

這個模式才允許 D/E 型 ghost 或 asynchronous reference。最低規範應逐字包含你要求的六點，並再加兩項：

- 畫面持續顯示 **「教學合成／非同時星座狀態」**；
- 每個片段或物件保存並可查看其**原始 UTC、TLE publication、satellite identity**；
- asynchronous object **不加入共同 interference**；
- 不從 mixed-time 畫面產生 **handover、SINR、Power、Throughput 或 EE**；
- composed sequence **不得匯出為正式研究證據**；
- canonical state 與 presentation/composed state **完全分離**；
- ghost 必須在 scene graph/data contract 具有 `participatesInScience=false`，不能只靠 UI 顏色約定；
- capture manifest 必須標 `evidenceClass=teaching-composed`，且正式 evidence exporter 必須拒絕該 class。

D 型 ghost overlay 可以在這裡使用；E 型 asynchronous constellation 也只能留在這裡。此模式需要**獨立 ADR**，因為它第一次允許畫面不再對應單一 simultaneous scientific state。ADR-010 已明確拒絕 synthetic per-satellite time offsets 作為 real pass/event timing，所以不能只把 E 稱為「新的 animation option」。fileciteturn0file5

**禁止／Synthetic boundary**

以下情況不應只顯示 warning，而應 fail closed：

`forced continuity → 標成 Offset+TTT handover`

`Beam Hopping eligible-set change → 標成 intra handover，但 UE service pair 沒變`

`不同 UTC object → 加進 interference matrix`

`playlist clip boundary → 延續 TTT`

`presentation time → 用於 EE integration`

`candidate counterfactual → 默認 active interferer`

`offset/TTT 改過 → 仍標 canonical 3 dB/30 s`

`mean anomaly/RAAN/phase 改過 → 仍標 TLE-derived SGP4`

`TLE-fitted Walker → 匯出成 archived-TLE evidence`

`renderer / visual layer → 重算另一份 SINR、Power、Throughput、EE`

前兩項在 ADR-006/011 已有非常清楚的禁止條款：forced continuity 是另一事件類別；Beam Hopping slot change 只有在同一 UE、同一 satellite、不同 beam identity 的 accepted serving pair transition 發生時才構成 same-satellite beam switch。fileciteturn0file3 fileciteturn0file6

F/G 若未來仍有研究價值，可以建立第五種 **Synthetic Design Study**，但它必須擁有不同的 run type，例如 `SYNTHETIC-WALKER`，不能繼承 `TLE-derived SGP4` evidence class。這不是說 synthetic constellation 沒有學術價值；只是它回答的是「如果 constellation 具有某 Walker geometry 會如何」，不是「archive 中真實衛星在該 UTC 如何」。Vallado 關於 TLE mean elements 與 propagator model coupling 的警告使這條 provenance boundary 特別重要。citeturn18view0

## 最終決策

**首選決策：建立 `Canonical Event Atlas`，把問題從「如何改場景讓事件更多」改成「archive 中哪些真實場景本來就具有高教學品質」。**

這最符合目前 ADR chain，也最可能用最少程式改動回答最關鍵的未知數。ADR-010 的 pass-index/coarse-to-exact architecture、ADR-006 的 immutable handover trace、ADR-009 的 presentation clock、以及 SDD 已經存在的 source-backed replay，四者拼起來幾乎就是 Event Atlas 所需的全套 substrate。fileciteturn0file3 fileciteturn0file4 fileciteturn0file5 fileciteturn0file7

**首選 presentation 是 A＋B：共同 UTC canonical science，加 event-driven seek／slow motion。** 這可以在完全不犧牲論文可辯護性的情況下，得到最接近 Walker demo 的「事件密度」。即使 30 分鐘只有一個事件，觀眾也不需要等 30 分鐘。

**次選是 C：Source-backed Event Playlist。** 如果單一兩小時 NTPU window 很難同時具備多次 valid HO、高 elevation、漂亮 crossing、intra beam switch，那就從不同真實 UTC 各選最佳完整事件。不要把「一場演講需要五個例子」錯誤轉譯成「宇宙必須在同一 UTC 同時提供五個漂亮例子」。

**第三個應投入的 scientific architecture 是 true multi-satellite active-beam assignment/interference，而不是 asynchronous orbit composition。** 它直接處理目前 SINR 差異可能太平的物理原因，同時讓 `I_inter`、load、active-beam ownership、cap competition 真正變成 multi-satellite quantity；代價是要新增 scenario/policy authority 和較重的 parity validation。現有 `I_inter=0 by construction` 及 candidate counterfactual 邊界代表這項工作不能只改一個 visualization flag。fileciteturn0file2

**Real TLE shell／orbital-plane clustering 應加入首選方案，但定位為索引＋視覺化，而不是 orbit generator。** 它能提供 Walker 演示最有辨識度的「plane/shell 規律感」，又完全不需要改任何 satellite state。TLE 的 mean elements 可作 metadata，最終 grouping 建議以 common-UTC SGP4 `r,v` plane normals 為依據。citeturn0search1turn18view0

**scenario-policy tuning 可以做，但一定要分實驗 arm。** beam layout、Beam Hopping、power caps、reuse、association 都可以在保留 TLE geometry 下改變結果；ADR-011 已明確把 Beam Hopping 定義成 simulator experiment，而不是 operational Starlink/OneWeb schedule。fileciteturn0file6 3 dB Offset＋30 s TTT 則不能因事件少而靜默改；若要做 `1/2/3/4 dB × 15/30/60 s` sensitivity sweep，它應是一個新的 handover-policy study，輸出不能和 canonical trace 混在一起。fileciteturn0file3

**Moving UE／multi-observer 是後備研究方向，不是第一個補救。** multi-observer 很適合回答「這個星座在不同 observer 幾何下是否更容易產生 handover-rich windows」；moving UE 也可能增加 cell/beam transition。但目前 ADR-009 只明確授權 bounded representative-UE position probe，而不是任意長距離 UE mobility，所以完整 moving-UE trace 應另有 scenario authority。fileciteturn0file4

**不建議方案：E、F、G。** E 可以留在 Teaching/Composed Mode 作非定量 visual composition；F/G 對本題則沒有必要。它們也許能迅速得到「很漂亮的 Walker scene」，但同時會丟掉目前專案最難建立、也是最有學術價值的 TLE/SGP4 provenance。Vallado 的資料模型警告和 ADR-005 都直接支持拒絕這條捷徑。citeturn18view0 fileciteturn0file2

**第一個最小實驗**應只有一件事：固定現行 scientific contract，跑 `NTPU Starlink + OneWeb 7d/30d/90d event sweep`，先回答 event availability，而不是先修改 UI、beam policy 或 handover rule。

在那份結果出來之前，以下結論**不能下**：

| 現在不能聲稱的事情 | 狀態 |
|---|---|
| 「NTPU 的 Starlink 每兩小時一定有 X 次 valid handover」 | **UNVERIFIED** |
| 「OneWeb 比 Starlink 更適合這個 demo」 | **UNVERIFIED** |
| 「30 天一定足以找到 6 個高品質事件」 | **UNVERIFIED** |
| 「forced continuity 一定是主要 event 類型」 | **UNVERIFIED**，ADR-006 只說它可能發生 |
| 「≥60° valid handover 很常見」 | **UNVERIFIED** |
| 「目前 power control 一定使所有 candidate ΔSINR <3 dB」 | **UNVERIFIED**；文件只指出此情況可能發生 |
| 「需要跨時間合成才能完成教學」 | **不能下；應最後才判定** |
| 「joint interference 一定會讓 HO 變多」 | **UNVERIFIED** |
| 「降低 Offset/TTT 是必要的」 | **不能下；而且不是 current canonical trace** |
| 「TLE-fitted Walker 是唯一可行架構」 | **REJECTED** |

反之，以下已可下正式架構決策：

**VERIFIED：** orbit identity/position/velocity 繼續全部由 frozen archived TLE＋SGP4 取得是正確的 scientific boundary；TLE 不應被 phase/RAAN/mean-anomaly 改造後仍稱原始 evidence。citeturn18view0 fileciteturn0file2

**VERIFIED：** slow motion、pause、step、seek、camera、text、arrow、layer focus 可以和 scientific state 分離，不需要改 science。fileciteturn0file4

**VERIFIED：** forced continuity 必須和 3 dB/30 s Offset＋TTT handover 分開。fileciteturn0file3

**VERIFIED：** intra-handover 必須是同一 UE、同一 satellite、不同 beam identity；Beam Hopping schedule change 本身不夠。fileciteturn0file6

**VERIFIED：** current candidate 不能偷偷被加入 inter-satellite interference；真正的 `I_inter` 需要 active ownership。fileciteturn0file2

**VERIFIED：** event-driven replay 與 multi-UTC real-event playlist 足以提供「Walker-like narrative density」，且不必修改軌道；前者可以是完整 Research Replay，後者應明確是多個獨立 source-backed episodes。fileciteturn0file4 fileciteturn0file7

**PLAUSIBLE 且最值得實測：** archive-wide mining 很可能比改 handover threshold、改軌道或 asynchronous composition 更有效地找到高仰角、candidate overlap、有效 dwell 與 crossing 組合。TLE/SGP4 本來就適合大規模 visibility/schedule search，而既有 LEO handover 文獻也支持把 visibility duration、elevation、SINR、load 與 handover stability 一起納入 target/window selection。citeturn18view0turn18view4turn17search3

因此，架構上的最終順位應定為：

**首選：`Real-TLE Event Atlas → Canonical Research Replay → event-driven presentation`。**

**次選：`Source-backed Multi-UTC Event Playlist`，保持每段完整 provenance，不建立假共同 UTC。**

**第三順位：`True Multi-satellite Active-beam / Interference Scenario`，在 mining 證明 SINR contrast 確實不足後再投入。**

**可並行的小增量：`TLE/SGP4 shell-plane clustering`、required-power/headroom/cap-status explanatory overlays、geometry-diverse curriculum ranking。**

**僅教學：不同 UTC ghost/reference overlays。**

**不建議作為本專案解法：per-satellite asynchronous constellation、phase-shifted TLE hybrid、TLE-fitted synthetic Walker。**

這個順序保留了目前專案最珍貴的特性：**畫面可以像 Walker demo 一樣清楚、密集、可控，但所有被稱為研究證據的衛星、handover、SINR、Power、Throughput 與 EE，仍然只來自一個能回到 archived TLE、SGP4、原始 UTC 與 immutable canonical frame 的真實 scientific state。** fileciteturn0file2 fileciteturn0file3 fileciteturn0file4