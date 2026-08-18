# C-120 外部軟體重新檢視

日期：2026-08-10  
範圍：重新檢視 Cooja 以外的候選工具，以及 `scenario-globe-viewer` 與 `leo-satcom-lab` 對 C-120 的實際幫助。

## 一句話結論

應該「跳出 Cooja 看工具」，但不應該「跳出節能主軸」。C-120 的學生端仍以 Leo 原生的節能決策實驗為唯一主線；`scenario-globe-viewer`/ESTNeT、ns-3/Hypatia、Wireshark/PCAP、Cooja 等只應在 staff/backend 產生或驗證可重播資料。若時間有限，搬移 `PacketTrace` 契約、驗證器與已審核 fixture，比讓兩個專案同時常駐、再透過 API 串接更穩健。

這不是把衛星模擬器變成課程主角，而是讓衛星/封包資料服務「節能決策」：學生改變服務、等待、切換、批次或期限策略，才可觀察 delivered bits、consumed J 與 bit/J 的因果變化。

## 1. 先鎖住學生端與 staff/backend 邊界

這是本次重新檢視的硬性篩選條件。

| 層 | 學生實際接觸 | 工具角色 | 可宣稱的邊界 |
|---|---|---|---|
| Student-facing energy core | Leo `/course/c120` 的情境、策略與回放控制 | 只使用已封裝的 provider/replay | `SIMULATED TEACHING DATA / NOT LIVE / NOT MEASURED / NOT CANONICAL-PARITY-VERIFIED`；學習核心是 J、bit/J 與服務結果的取捨 |
| Staff/backend satellite context | 不要求安裝、編譯或開啟外部 IDE | ESTNeT/OMNeT++、Hypatia、Cooja、PCAP 產生或審核 fixture | 只把明確標註的封包/狀態資料帶入；不可因為有衛星軌跡就宣稱整星或牆上插座能耗 |
| Optional evidence clinic | 只看預先準備的封包或 Energest 證據 | Wireshark/TShark、Cooja/Energest | 封包觀察與端點能耗估計是輔助證據，不取代 C-120 的能源口徑 |

**VERIFIED（本地）**：目前交接文件已把 C-120 定義為 120 分鐘、energy-first、Leo-like host 加上 isolated route；real backend 是 optional，且學生不應被要求安裝套件或讀寫 source。[C-120 handoff, line 5](/home/u24/leo-satcom-lab/.scratch/90min-satellite-course/CURRENT-C120-HANDOFF.md:5) [C-120 handoff, line 42](/home/u24/leo-satcom-lab/.scratch/90min-satellite-course/CURRENT-C120-HANDOFF.md:42) [C-120 contract, line 1](/home/u24/demo/leo-beam-sim/src/course/c120/contract.ts:1)

**INFERENCE（本報告）**：因此，任何候選工具若要求學生先學 NED/C++、Java/Gradle、Python/CMake、Docker/資料庫，或只能提供漂亮的 LEO 畫面而沒有 `action → packet/service → J → bit/J`，就不適合成為學生端主軟體。

**UNKNOWN（不得偷補）**：目前尚未有 classroom-ready 的 20 人、跨平台與 novice timing 證據；本報告不把任何外部工具的可執行性推成課程通過。

## 2. 目前已有資料能怎麼用

### `scenario-globe-viewer`：可搬資料契約，不必搬整個 viewer

**VERIFIED（本地）**：viewer 的 `PacketTrace` 已有封包樣本（latency、jitter、throughput、loss、link state、handover）與 summary/segment 形狀。[PacketTrace contract, line 17](/home/u24/papers/scenario-globe-viewer/src/features/multi-station-selector/estnet-trace-contract.ts:17) 它有 manifest、pair-match fail-closed、fixture shape validation 與 `fetch`/cache；manifest hint 不是 truth，fixture metadata 才是 truth。[trace contract, line 123](/home/u24/papers/scenario-globe-viewer/src/features/multi-station-selector/estnet-trace-contract.ts:123) [trace loader, line 262](/home/u24/papers/scenario-globe-viewer/src/features/multi-station-selector/estnet-trace-contract.ts:262)

**VERIFIED（本地）**：外部輸入 front door 可處理 ESTNeT `.vec`、scavetool CSV、ping、iperf3，並嵌入 input SHA-256、latency semantics、assumptions 與 non-claims；operator-measured 會被拒絕。[external ingest, line 1](/home/u24/papers/scenario-globe-viewer/scripts/estnet/external_trace_ingest.py:1) 契約也明定 `.vec → adapter → PacketTrace JSON → panel` 是 staged/reviewed/curated，而非自動升格為真值。[ingestion contract, line 20](/home/u24/papers/scenario-globe-viewer/scripts/estnet/PACKET-TRACE-CONTRACT.md:20)

**INFERENCE**：最短路徑是把 schema、fail-closed validator、metadata 與已審核 JSON fixture 改成 Leo 可消費的 provider；不要把 viewer 的 Vite process 當 C-120 的 runtime API。當前 viewer 是 static fixture fetch，Vite config 只有 dev server；雙開兩個專案再互相呼叫會多出 port、啟動順序、版本與 provenance 問題，卻不會自動產生能源因果鏈。

### `leo-satcom-lab`：提供課程邊界與研究來源，不是另一個學生 IDE

**VERIFIED（本地）**：C-120 的 accepted decision 把 LEO 降為 index/context；不插入外部 orbit tool，學習物件是 energy decision toolkit，LEO 只提供 service window、switch、wait、freshness、deadline、budget 等情境。[issue 11, line 17](/home/u24/leo-satcom-lab/.scratch/90min-satellite-course/issues/11-120min-energy-first-curriculum-reset.md:17)

**VERIFIED（本地）**：Leo 的 C-120 contract 已有 stable scenario identity、provider kind、systemPowerW、consumedEnergyJ、deliveredBits、bit/J、deadline/freshness 與 warnings；預設路徑是 coherent simulated fixture，backend replay 尚未接入 default route。[C-120 contract, line 75](/home/u24/demo/leo-beam-sim/src/course/c120/contract.ts:75) [C120 continuation, line 13](/home/u24/demo/leo-beam-sim/docs/handoff/C120-SERVER-CONTINUATION-2026-08-10.md:13)

**INFERENCE**：外部模擬器的最佳價值是 staff 產生「更有衛星背景的 input」，再以相同 scenario identity 回放；它不應改寫 energy formula，也不應讓外部工具的輸出越過 claim ceiling。

## 3. 候選比較

判準中的「整合」指整合成可重播、可追溯的 C-120 provider，不是把外部程式永久嵌入瀏覽器。`低/中/高` 是本次工程風險判斷，不是已完成的通過測試。

| 候選 | 有意義的學生動作與能源鏈 | 封包/能源輸出 | Leo 整合與安裝風險 | 平台、免費/授權 | 判決 |
|---|---|---|---|---|---|
| **Leo 原生 C-120** | 改策略、deadline、switch/wait、服務批次；直接得到 service、J、delivered bits、bit/J | 已有 typed evidence；能源鏈最完整 | 低；學生不需要外部 runtime | 瀏覽器路徑；本專案授權需另依 repo 確認 | **主線、排名 1** |
| **OMNeT++ + INET + ESTNeT** | 直接改 NED/C++/參數對 C-120 新手太重；staff 可先跑多個政策情境 | INET 是網路模型套件；ESTNeT 可表達 satellite/ground communication、power/attitude，但 `PacketTrace` 本身不等於 J | 中高；可重用既有 `.vec → PacketTrace`，但 build/GUI 依賴多 | [INET](https://inet.omnetpp.org/) 開源；[OMNeT++ Academic Public License](https://omnetpp.org/intro/license.html) 對 academic/nonprofit 免費、商業用途另需授權；本地 ESTNeT license 明列 LGPLv3。[ESTNeT license, line 1](/home/u24/papers/estnet-bootstrap-kit/LICENSES/ESTNET-LICENSE.txt:1) | **staff/backend，排名 2；不是學生端主角** |
| **LoRaEnergySim** | 可改 payload、傳送頻率、SF、ADR、sleep/process/Tx/Rx energy profile 與重傳條件；直接對應低功耗 IoT 決策 | Python 結果含 collision、retransmission、total energy、energy per bit；沒有原生 LEO、PCAP 或服務 API | 低至中；需做固定版本、seed、輸出 schema 與 Leo adapter；專案目前沒有 turnkey classroom bundle | [官方 repository](https://github.com/GillesC/LoRaEnergySim)；GPL-3.0 | **最值得先做的外部學生端低摩擦 probe；不得冒充 LEO 模型** |
| **FLoRa** | 可改 LoRa spreading factor、Tx power、traffic/ADR；可觀察 delivery 與 node-level radio energy，但不是 C-120 system energy | LoRa collision/capture、gateway/backhaul、per-node energy | 高；繼承 OMNeT++/INET 版本耦合 | [FLoRa 官方頁](https://flora.aalto.fi/)；[LGPLv3 license](https://github.com/florasim/flora/blob/master/LICENSE.md) | **有條件的完整型學生 probe；需預建 workspace，LEO 僅作外部情境** |
| **FLoRaSat** | 對 direct-to-satellite IoT 很貼題，但會把學習重心拉向 access、constellation 與 routing；官方資料未證明可直接採用的 energy model | LEO orbit、large constellation、DtS-IoT packet/network results | 高；OMNeT++/INET/FLoRa stack，且能源仍需另接 | [Inria AGORA 2025](https://radar.inria.fr/report/2025/agora/index.html) | **staff packet/contact donor；不進學生端** |
| **ns-3 Energy + Hypatia** | 可研究 packet routing/LEO state；學生直接操作需要 Python/C++/ns-3，能源需另寫 device/source/model，不能自然得到整星 EE | [ns-3 Energy framework](https://www.nsnam.org/docs/models/html/energy.html) 有 source/device/harvester/radio states；[Hypatia](https://github.com/snkas/hypatia) 有 precomputed LEO state、packet-level ns-3、satviz | 中高；Hypatia 官方流程偏 recent Linux，需建多個 module；不適合 90 分鐘安裝 | ns-3 GPLv2 系列；Hypatia 分成 MIT（satgenpy）與 GPLv2（ns-3-sat-sim），依元件查核 | **staff research producer；drop from student vertical** |
| **Cooja + Energest** | 改 duty cycle、sleep/listen/TX 行為可形成端點 state → time → estimated J；仍需包裝成學生策略 | Cooja 有 mote/radio/timeline；Energest 是 software-based time tracking 加 platform power table 的估計，不是量測 | 高；Java/Gradle/submodule/Docker/GUI；最適合 staff 預跑或 prebuilt replay | [Contiki-NG repo（BSD-3-Clause）](https://github.com/contiki-ng/contiki-ng)；Docker/Windows/macOS/WSL 有額外 GUI 限制 | **optional、排名 3；只教 endpoint energy** |
| **Wireshark/TShark + PCAP** | 看 filter、loss、timestamp、retransmission；本身沒有可導致 J 改變的 student action | packet evidence 強；PCAP 不產生 LEO mobility、power 或 energy | 低至中；跨平台好，若要給 Leo 讀取需新增 PCAP→PacketTrace adapter；預載 capture 可免安裝 | [Wireshark User Guide/download](https://www.wireshark.org/docs/wsug_html/)；主要程式 GPLv2-or-later | **evidence clinic；不是獨立 vertical** |
| **Node-RED** | 預載 flow 可改 threshold/batch/route policy，但能源數字仍由 Leo provider 決定 | event/message routing；官方文件沒有 LEO/energy model | 中；Node.js/Docker、port 1880、flow persistence；跨平台可行但多一個 runtime | [官方 first flow](https://nodered.org/docs/tutorials/first-flow)；[Apache-2.0 package](https://github.com/node-red/node-red/blob/main/package.json) | **drop from core；可作 staff control-flow probe** |
| **ThingsBoard CE** | dashboard/rule-chain/telemetry 操作可視化，但不形成 simulation → packet → J 因果鏈 | telemetry、rule message、dashboard；無 LEO/energy model | 高；Docker Compose、資料庫/多服務、port 與初始化，和 Leo 的 policy UI 重疊 | [ThingsBoard Docker](https://thingsboard.io/docs/installation/docker/)；[Apache-2.0 repo](https://github.com/thingsboard/thingsboard) | **drop；IoT monitoring 不是本課程模擬器** |

### 為何不以衛星專業工具取代節能核心

官方能力不能直接等同於課程證據：ESTNeT/INET 的 satellite、power、attitude model 或 Hypatia 的 LEO packet simulation，只有在明確定義輸入、功率表、aggregate denominator、時間窗口與 identity mapping 後，才可能成為 C-120 的能源證據。若只把 throughput、loss 或 orbit state 送進 Leo，不能推導 `consumedEnergyJ`；若只把端點 Energest J 相加，也不能宣稱 whole-satellite/system/wall-plug energy。

這個邊界與現有 handoff 一致：LEO 值是 simulated teaching only，不能外推真實衛星、整星或牆上插座。[issue 11, line 92](/home/u24/leo-satcom-lab/.scratch/90min-satellite-course/issues/11-120min-energy-first-curriculum-reset.md:92)

## 4. 最多三個 vertical-demo 候選（依優先順序）

「Vertical demo」定義為：學生有一個可理解的 action，該 action 經過同一 scenario identity，造成 service/packet 結果與能源證據的可觀察變化，最後在 Leo 顯示可解釋的 trade-off。

### 1. Leo 原生節能決策（唯一學生主線）

**路徑**：學生改 service policy（例如等待、切換、批次、期限）→ C-120 typed replay → service/freshness/deadline → `systemPowerW`/`consumedEnergyJ`/`deliveredBits` → `bit/J` 與證據卡。

**理由**：因果鏈、單位、claim boundary 與 120 分鐘節奏已在 C-120 contract；不受外部安裝或 GUI 影響。這是唯一應先接受 classroom validation 的 vertical。

### 2. Leo + staff 產生的 PacketTrace replay（ESTNeT/OMNeT++ 優先；PCAP 僅作另一個輸入源）

**staff 流程**：在 staff 環境跑已固定版本的 ESTNeT/OMNeT++ → 以既有 external ingest 產生帶 hash/provenance 的 `PacketTrace` → review/verify → 映射到 C-120 scenario identity → 學生只在 Leo 改能源策略。

**學生可看到**：封包交付、loss、latency、handover 與由 C-120 provider 產生的 J/bit-J；不能看到或操作 ESTNeT IDE。`PacketTrace` 的封包數據若沒有獨立 power model，只能當 packet/service evidence。

**PCAP 位置**：Wireshark/TShark 可作 evidence clinic，或另做 `pcapng → PacketTrace` staff adapter；不要把即時抓包宣稱成 reproducible LEO simulation。這個 vertical 的核心仍是 Leo energy replay，而非 Wireshark。

### 3. Leo + 外部端點能耗 probe（先試 LoRaEnergySim；再比較 FLoRa 或 Cooja）

**低摩擦首測**：固定 LoRaEnergySim commit、seed、energy profile 與 baseline script → 學生只改 payload／傳送間隔／SF／ADR 等批准欄位並執行 → 匯出 collision、retransmission、delivered data、endpoint J 與 energy/bit → 以明確 `energy_scope=endpoint-radio` 接入 Leo。這條線最能維持節能主軸，但沒有 LEO physics；Leo 的 contact/service window 必須是分開標示的情境輸入。

**完整型比較**：若需要較完整的事件模擬與 GUI，再比較預建 FLoRa/INET workspace；若希望連結其他講師的 embedded/IoT 內容，再比較 Cooja/Energest。兩者都必須明示 endpoint estimate，不是實測、整星能耗或 wall-plug energy。若沒有 `student action → tool input → same identity → result`，則降級為靜態展示，不算 vertical demo。

## 5. 建議的實作順序與停止線

1. **先保護 energy core**：凍結 C-120 identity、units、formula、fixture claim boundary；外部輸入只能成為 provider/replay，不改既有 energy semantics。
2. **先做資料搬移，不做雙程序依賴**：從 `scenario-globe-viewer` 搬 `PacketTrace` schema、validator、metadata 與已審核 fixture；先以檔案/adapter 接 Leo，不以兩個 dev server/API 為 release prerequisite。
3. **ESTNeT 只在 staff lane**：本地 bootstrap kit 現況是 maintenance mode，釘住 OMNeT++ 5.5.1、INET 4.2.0、OpenSceneGraph/osgEarth 與 ESTNeT，且 Ubuntu WSL2 只做 GUI smoke，native Linux/VMware 才適合真正 graphics validation。[bootstrap README, line 13](/home/u24/papers/estnet-bootstrap-kit/README.md:13) [bootstrap README, line 172](/home/u24/papers/estnet-bootstrap-kit/README.md:172) 這正是「預先產生 fixture」而非「學生安裝」的理由。
4. **再做一個端點能耗 bake-off**：先以 LoRaEnergySim 做低摩擦 probe，再拿預建 FLoRa/INET 與 Cooja/Energest 比較；只保留能讓新手完成 `edit → run → export → Leo replay` 且 identity/window/units 對齊的一條。
5. **每個外部 artifact 必須 fail closed**：缺 provenance、scenario identity、unit、power model 或 non-claim 時，不顯示或降級為非權威 context。外部模擬輸出不可自動升格為 canonical parity。

**停止線**：若新增工具使學生需要安裝/編譯、使教師必須維護兩套 live service、使 packet trace 與 J 的關係靠猜測、或使課程改教 orbit/network simulator 而非 energy decision，就停止該 lane，回到 Leo-native fixture。

## 6. 最終排名

1. **Leo 原生 C-120 energy core**：先做，且是唯一學生端主角。
2. **ESTNeT/OMNeT++ staff-generated PacketTrace replay**：最能利用現有 `scenario-globe-viewer` 資料；學生不碰工具，封包 context 不侵蝕節能主軸。
3. **端點能耗外部 probe**：先試 LoRaEnergySim；需要更完整事件 GUI 時再試 FLoRa/INET，需要 embedded OS transfer 時才試 Cooja/Energest。三者只能擇一成為學生端 companion，且都不得冒充 LEO system energy。

FLoRaSat、ns-3/Hypatia、Node-RED、ThingsBoard、Wireshark/PCAP 都值得保留在候選資料庫，但不應進入前三個學生 vertical：前兩者偏衛星／網路研究工程，後兩者缺 energy authority，PCAP 則是證據工具而非因果模擬器。最終答案不是「只用 Cooja」，而是「Leo 做節能決策、最多一套外部工具提供端點能耗操作、衛星工具只做可追溯的 staff 輸入；每個輸出都服從同一個 energy claim boundary」。

## 7. 被排除的相鄰工具

Wokwi 可作微控制器展示，但沒有本案需要的 LEO packet/energy system boundary；SimPy 只是可自行建模的 Python framework，會把所有語義與校準責任推回課程團隊；Orange Data Mining 屬 optional prediction/competition lane，不產生 packet trace 或 energy authority。三者不增加本次 C-120 vertical 的獨特學習價值，故不納入前三名。

## 8. 主要一手來源

- [OMNeT++ license](https://omnetpp.org/intro/license.html)、[INET official site](https://inet.omnetpp.org/)、[opp_env official repository](https://github.com/omnetpp/opp_env)
- [ESTNeT official repository](https://github.com/estnet-framework/estnet)、[ESTNeT paper](https://link.springer.com/article/10.1007/s12567-020-00316-6)
- [FLoRa official site](https://flora.aalto.fi/)、[FLoRa repository/license](https://github.com/florasim/flora)
- [ns-3 installation](https://www.nsnam.org/docs/release/3.44/installation/html/index.html)、[ns-3 energy models](https://www.nsnam.org/docs/models/html/energy.html)、[Hypatia repository](https://github.com/snkas/hypatia)
- [Contiki-NG Cooja tutorial](https://docs.contiki-ng.org/en/master/doc/tutorials/Running-Contiki-NG-in-Cooja.html)、[Energest](https://docs.contiki-ng.org/en/develop/doc/programming/Energest.html)
- [LoRaEnergySim repository](https://github.com/GillesC/LoRaEnergySim)、[FLoRaSat / Inria AGORA 2025](https://radar.inria.fr/report/2025/agora/index.html)
- [Wireshark User’s Guide](https://www.wireshark.org/docs/wsug_html/)、[TShark manual](https://www.wireshark.org/docs/man-pages/tshark.html)
- [Node-RED first flow](https://nodered.org/docs/tutorials/first-flow)、[ThingsBoard Docker installation](https://thingsboard.io/docs/installation/docker/)
