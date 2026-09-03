# 符號來源與對齊狀態(2026-08-22)

## 權威在哪

**唯一符號權威**:

```
~/papers/modqn-paper-reproduction/docs/research/ee-definition-cleanup/2026-08-17-simplified-ee-symbol-table.md
```

標頭寫著 `ACTIVE SYMBOL AUTHORITY`。結構:

- **第 1–9 節**:EE 鏈路、通道、功率、SINR —— **模擬器主要要對的就是這一段**
- 第 10 節:論文全篇符號(RL/訓練端,模擬器多半用不到)
- 文末:**汰換紀錄**(已刪除的符號與依據)—— 進場前先看這一節

## ⛔ 不要看這兩份(它們看起來像權威)

| 檔案 | 為什麼不能用 |
|---|---|
| `thesis-mc/notation-table.md` | **已停止維護**,2026-08-22 併入權威後改為存根 |
| `system-model-refs/system-model-formulas.md`(及 `paper-source/system-model/` 副本) | **自稱「唯一主稿…可直接寫進正文」,且 repo README 直接指向它**。它負責公式推導與引用溯源,**符號值不是權威**。其終端釘定(handheld `G_R=0 dBi`／`NF=9 dB`)已判定過時 |

## 模擬器目前的不一致(2026-08-22 抽查,尚未修)

前端符號的唯一來源是 `src/explain/model/canonicalTermMap.ts`。

| 前端現況 | 論文 | 問題 |
|---|---|---|
| `\theta_{u,b}` | `\theta_{u,s,v}` | **少一個下標**;論文的鏈路量一律三下標 `(u,s,v)` |
| `\widetilde{P}^{DL}_{b}` | 無 `\widetilde` | 舊記號,`\widetilde` 已自論文全面移除 |
| `\eta^{PA}_{b}` | `\eta` = 能量效率 | **同字母不同義**,論文的 `\eta` 是 EE,不是 PA 效率 |
| `\gamma_{req}` | `\gamma_{\mathrm{req}}` | 排版慣例;非錯誤但不一致 |

另有已刪符號殘留:`v_max` 出現在 `src/simulator/analysis.ts`、
`src/simulator/beamIlluminationScenario.ts`。

## 已從論文刪除的符號 —— 不要再引入

| 符號 | 取代者 / 依據 |
|---|---|
| `v_{\max}`(每衛星波束上限) | ~~改為 `V_b = 7`~~ **✗ 2026-08-22 裁決作廢**:**每衛星波束計數上限整個刪除**,`V_b` 不存在。論文式 (3.3) 改為 `U_{s,v}` 定義、式 (3.4) 改為啟用規則 `z_{s,v}=1 ⟺ U_{s,v}>0`。原論文 `V=7` 是 `|𝒱|` 不是上限。見 `~/papers/modqn-paper-reproduction/docs/RULING-2026-08-22-no-beam-count-cap.md` |
| `\mathcal{F}`、`F`、`T_k`(射頻槽索引域與槽吞吐量) | 隨舊 `r3` 一併移除 |
| `\widetilde R_{s,v}`(波束總吞吐量) | 改為 **`U_{s,v}`**(波束服務人數) |
| `N(t)`(啟用波束數) | 定義依賴已刪的 `F` |
| `m^e`(執行遮罩) | 仍是環境端帳務,但**不再是公開符號** |
| `\Delta_s` | 定義依賴已刪的 `v_max` |
| 容量懲罰的 `\tau`、`\lambda` | 該機制整節刪除 |
| `q_{lo}`／`q_{hi}`／`K_{tar}`／`T_{lo}`／`T_{hi}` | 改為 `q_1`／`q_2`／`K`／`T_1`／`T_2`(多字母上下標單字母化) |

## ⚠ 現在可以對、現在還不要對

**可以對齊(已定案)**:
通道與鏈路預算鏈 —— `G^T`(HOBS `J_1/J_3` 型樣)、**`G^R` 與式 (3.10c) 的接收包絡**、
`\theta^{R}_{u,s}`、`A_R`／`B_R`／`G_{R,\max}`／`G_{R,\min}`、`H`、`L`、`\gamma`、
SINR、速率式、功率模型(`P^p`／`P^f`／`P^N`)、EE 定義。

**先不要對(仍會變)**:
`V`(波束位置數,待覆蓋量測)、**衛星高度**(實測 485–540 km,非 780 也非 550)、
dwell `N`、`r3` 的校準尺度、D2 門檻與 TTT。

**理由**:這些綁在新專案 `mcrl-leo-handover` 的 baseline 上,還沒定案。
現在對齊會做兩次。

## 對齊流程建議

1. 先讀權威版**文末的汰換紀錄**,把上表的已刪符號從前端清掉
2. 再以 `canonicalTermMap.ts` 為清單,逐項對權威版第 1–9 節
3. `V`／高度／dwell 等待新專案 baseline 定案後再做第二輪

---

# 補充(2026-08-22 04:41 之後):B1 與 B8 已落地

## 又一批已刪符號 —— 前端不得出現

| 符號 | 狀態 |
|---|---|
| `a_u^{d,*}(t+1)` / `a_u^{*}(t+1)`(三目標共用的下一步動作) | **刪除**(B1)。TD target 改回原論文 vanilla,每個目標各自在自己的目標網路取 max,不再有跨目標共用動作 |
| `Q_j^{online}`(用於選動作的線上網路) | **刪除**。現在只剩 `Q_j^{target}` |

**若前端有呈現訓練流程或 TD target,「線上網路選動作 → 目標網路評估同一動作」的敘事已作廢。**

## 壅塞情境 χ 降級

`χ` 與跨使用者情境正規化在論文中已改為「**可選機制,預設關閉,僅作為消融項**」,
不再是三類設計之一(摘要已改為兩類)。前端若把它當成常駐特徵呈現,須加上可選/預設關閉的標示。

## 提醒:前端仍待修的四處(2026-08-22 抽查,尚未處理)

| 前端 | 論文 |
|---|---|
| `\theta_{u,b}` | `\theta_{u,s,v}`(三下標) |
| `\widetilde{P}^{DL}_{b}` | `\widetilde` 已自論文全面移除 |
| `\eta^{PA}_{b}` | 論文的 `\eta` 是 EE,同字母不同義 |
| `\gamma_{req}` | `\gamma_{\mathrm{req}}` |

外加 `v_max` 殘留於 `src/simulator/analysis.ts`、`src/simulator/beamIlluminationScenario.ts`
⚠ **2026-08-22 更正:那是刪除,不是改名為 `V_b`。** 前端不得引入任何對應論文的每衛星波束計數上限符號。
(`MAX_BEAMS_PER_SATELLITE` / `maxBeams` 是**渲染層**限制,與論文符號無關 ——
`beamScheduleTrace.test.ts:75` 已斷言 trace 不得暴露論文 `v_max`,維持此解耦。)

## 新 `r3` 的呈現框架(若前端要顯示負載平衡)

```
r_{3,u}(t) = −U_{b_u(t)}(t)
Σ_u U_{b_u(t)}(t) = Σ_{s,v} U_{s,v}(t)²
```

`b_u(t)` 為使用者 `u` 當步所選的波束。**舊的「最忙槽位 vs 最閒槽位差距」(`T_k`、`ℱ`、`F`)全部作廢。**

---

# 對齊狀態更新(2026-08-22 09:1x,漂移檢查後覆核)

## ✅ 「四處待修＋v_max」已於 2026-08-22 對齊完成(上方兩處「尚未修/尚未處理」為過時陳述)

`canonicalTermMap.ts` 實查(sha256 與 2026-08-21T17:30Z 基準一致,agy 對齊版原封未動):
`\theta_{u,s,v}`(:169)、`\gamma_{\mathrm{req}}`(:179)、`P^{DL}_{s,v}` 無 widetilde(:186)、
`\xi_{u,s,v}` 取代 `\eta^{PA}`(:195);另 30 餘項同步對齊(對照表:`.scratch/symbol-alignment/agy-report.md`)。
`v_max` 註解殘留已自 `analysis.ts`、`beamIlluminationScenario.ts` 清除。
驗證:`SignalTuningPanel.formula.test` 通過;`scientificEvidenceModel.test` 失敗經 HEAD 對照證實為既有資料問題,與符號無關。

## ✅ B1/B8 前端掃描(本次漂移新增項)——無受影響顯示面

- `a_u^{d,*}`/`Q_j^{online}`/「線上網路選動作→目標網路評估」敘事:src/ui 全域 grep **無出現**。
- `χ` 壅塞情境:前端**無呈現**(僅 modqn 引擎層,與「程式保留、預設關閉」相容)。
- 舊 r3 槽位敘事(`T_k`/`ℱ`):**無出現**;`r3LoadBalance` 僅為權重 key 識別子,非公式呈現。
- 容量懲罰符號(`π`/`Π`/`λ`/`L`/`ε_V`):**無出現**。

## ⚠ 旗標(非顯示層問題,待 owner 決定)

`src/ui/modqn-training/trainingFormModel.ts` 的 `softmaxTemperature`(UI 標「Softmax temp」):
純工程欄位、無論文符號框架,不違反顯示規範;但其對應機制(容量懲罰 §4.5)已於 2026-08-22
自論文整節刪除——訓練端是否保留此旋鈕屬工程決策,非本輪符號對齊範圍。

## 漂移偵測基準

`leo-beam-sim/.scratch/symbol-alignment/authority-baseline.sha256`(含權威表完整快照副本)。
每次接手先跑 hash 比對;不一致再 diff 快照。本節即 2026-08-21T17:30Z → 2026-08-22 漂移
(容量懲罰刪除、B1 TD-target 回歸 vanilla、B8 χ 降級、r3 計數式定義)的處理紀錄。
