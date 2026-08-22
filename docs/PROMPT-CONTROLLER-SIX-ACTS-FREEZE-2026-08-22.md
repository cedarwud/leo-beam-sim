# 給 controller：六幕教學專案定稿版本裁決請求

**送出者**：`~/demo/leo-beam-sim` 六幕教學 session（分支 `feat/six-acts-p0-vertical-slice`）
**日期**：2026-08-22
**要什麼**：一份「這個教學專案要對到論文的哪一版、哪些數值可以定稿」的裁決。
**不要什麼**：不是要你重審教學設計；六幕的 UI／動線／動畫已完成並通過 gate。

---

## 0. 現況一句話

六幕教學的**畫面全部做完**（6 個 route、160 測試綠、`validate:governance` 5/5）。
公式鏈用的是權威版符號，**但四個數值常數是我為了讓課堂曲線成形自己編的 DEMO 值**，
而論文端在 2026-08-19～22 之間已經把其中兩個釘死了。我需要知道要不要換、以及換之後
教學敘事要怎麼改。

---

## 1. 我已經核對過、**沒有**分歧的部分（不需要你裁決，僅供你確認我沒看錯）

| 項目 | 論文端 | 我的實作 |
|---|---|---|
| 功率遞推 | ADR-005：segment 起始 2 W；`p(t)=p(t−1)·G^T(θ(t−1))/G^T(θ(t))`；**無 cap/clip** | 完全相同（`anglePowerChain.ts`），超過額定只「回報」不夾值 |
| 段落中斷條件 | handover／outage／unserved／re-entry／episode reset 都重起 2 W | 相同 |
| SINR | `γ_{u,s,v} = p·H·G^T(θ)/(I+σ²)` | 相同 |
| 速率 | `R_{u,s,v} = (B^w/U_{s,v})·log₂(1+γ)` | 相同 |
| 功率鏈 | `P^p = p/ξ`、`P^N = P^f + Σ P^p` | 相同 |
| 波束型樣 | HOBS Eq.(3) J₁/J₃ | 直接呼叫引擎的 `computeBeamGainDb`；已驗 θ=θ_3dB 時為 −3.010 dB |
| θ_3dB | 3.32°（ADR-008 亦為 3.32°） | 相同，且真的接進數值鏈 |
| 波束數上限 | RULING-2026-08-22：**刪除**，不留常數不留參數 | 已用測試禁止 `v_max`／`V_b`／`k_cap` 出現在任何 course-facing 輸出 |
| 已刪符號 | `γ_req`、需求功率反推、`\widetilde` 等 | 同上，掃執行期輸出＋掃去註解後的原始碼 |

---

## 2. 需要你裁決的五件事

### 【裁決 1】ξ：我用了論文明確否決的形式 ← 最重要

- **ADR-006 §29**：`ξ = 0.35`，**常數**。
- **ADR-006 拒絕清單**：把 ξ 做成隨功率變化「makes xi depend on legacy cap semantics」。
- **我的 Act 5**：`ξ = 0.35·√(p/1.65)`，隨功率上升。

**後果不只是數字**：常數 ξ 讓 `P^N` 對 p **線性**，我現在的 √p 版本讓它次線性。
提案文件 Act 5 寫的「電源端功率隨 **√p** 成長（cap 內 ξ∝√p 使 P^p≈c·√p）」
**也是舊的**，跟 ADR-006 對不上。

> **請裁決**：Act 5 改用常數 ξ=0.35（我會同步改掉三段式的右段敘事，從「√p」改成
> 「線性成長 vs log 速率」），還是保留 √p 並標成 COURSE-ASSUMPTION？
> 我的建議是改成常數——教學敘事會**更乾淨**（線性 vs log 比 √p vs log 好講）。

### 【裁決 2】P^f：我編了一個數，論文有公式

- **ADR-006**：`P^f(t) = 0.338 W × N_active_beam(t) + 0.2 W × N_active_satellite(t)`
- **我的 Act 5**：`fixedOverheadW = 3`（純粹調到讓 EE 峰落在滑桿中段）

7 beam + 1 sat 代進去是 **2.566 W**，跟我編的 3 很接近，但那是巧合不是推導。

> **請裁決**：直接改用 ADR-006 公式（我需要你確認課堂場景的 `N_active_beam` 與
> `N_active_satellite` 各是多少；ADR-008 用 7 beam／1 sat）。

### 【裁決 3】η 的口徑：教「單鏈路顯示量」還是「系統級 headline」？

符號表第 256 行明確切開兩件事：

> `η_{u,s,v}` 是概念簡報／模擬器的 **selected-link 顯示量**，不取代論文正式結果的系統級 EE。
> 論文 headline 與方法比較仍使用**全體使用者總 throughput 對系統總能耗的 ratio-of-sums**。

我的 Act 5 曲線標的是「η（能量效率）」，但算的是 `Σ_u R / P^N`——那是**系統級**，
不是 `η_{u,s,v}`。標籤與內容不一致。

> **請裁決**：Act 5 教哪一個？如果教系統級 ratio-of-sums，我把標籤改掉；
> 如果教 `η_{u,s,v}`，我把分子改成單一鏈路。

### 【裁決 4】干擾耦合 κ：整條曲線的形狀由它決定，而它是我編的

我在 Act 5 加了 `I(p) = κ·p·(訊號基準)` 讓干擾隨功率上升。**沒有這一項，速率永遠不飽和，
三段式的右段（報酬遞減）根本演不出來**——這是我實作時才發現的。

而且 **κ 同時決定 γ 的上限（≈1/κ）**，也就決定了 `LOW_SINR_RATIO` 會不會動：

- κ=3 → γ 上限 −4.8 dB → 整條掃描都在引擎 −5 dB 門檻以下 → 欄位釘死 100%，第二層陷阱無訊號
- κ=2 → 工作點跨過門檻 → 100% → 75% → 50%，陷阱可演

我選了 κ=2。**這是一個純粹為了教學效果選的數。**

> **請裁決**：(a) 論文端是否有可用的同頻干擾模型／耦合值可以接？
> (b) 若沒有，κ=2 掛 `COURSE-ASSUMPTION` 徽章可否接受？

### 【裁決 5】場景衝突：三套幾何同時存在

| 來源 | 高度 | 用途 |
|---|---|---|
| ADR-008 moving-footprint fixture | **780 km**、7 beam、100 UE 10×10 grid | mechanism contract（非 Family-B benchmark） |
| `SYMBOL-SOURCE-OF-TRUTH.md` | **實測 485–540 km**，列在「先不要對」清單 | — |
| 我的 Act 4 教學窗 | **真實 OneWeb ≈1190 km**（真 TLE、真 SGP4、NTPU 觀測者） | 換手劇場 |

Act 4 用的是**真實星座封存 TLE**，本來就跟論文的合成場景是兩回事。但課堂會同時出現
這兩種幾何，學生會問「所以衛星到底多高」。

> **請裁決**：課堂要不要明講「Act 1/2/4 是真實星座封存資料；Act 3/5 是論文場景」？
> 還是要把 Act 3/5 也改成 780 km／ADR-008 的 fixture？

---

## 3. 順便回報一個論文端的內部不一致（不影響我，但你可能要處理）

- `RULING-2026-08-22`：波束數上限**全刪**，「不要為它留常數或參數」。
- `ADR-008` 決策表最後一列：`Admission: 至多 max_active_beams = v_max = k_cap = 3 per satellite`。

ADR-008 自稱是 mechanism contract、不是 Family-B benchmark contract，可能因此不受裁決約束；
但它**逐字使用了被刪除的 `v_max` 與 `k_cap` 命名**。請確認 ADR-008 是被 supersede 了、
還是被刻意排除在裁決範圍外。

---

## 4. 另外兩件仍卡在前一輪裁決、尚未解決的

1. **live profile 未統一到圖集參數**。圖集用 `DEFAULT_SIMULATOR_PARAMETERS`（reuse 3、
   B=500 MHz → `B^w`=166.667 MHz，符合 ch5 表 5-2）；**六個前端 profile 沒有一個對得上**
   （五個是 reuse 3／B=100 MHz，`modqn-4sat-7beam-paper-faithful` 是 reuse 1／B=500 MHz）。
   改 profile 是動物理，屬 owner 決定。
2. **`canonicalEe/producer.ts:411-431` 仍在算 `gammaReqB` 並反推 `pReqUW`**，
   驅動實際的下行功率配置。已刪符號的命名還在引擎內；我只擋住它外洩到 course-facing 輸出。

---

## 5. 我要的輸出格式

請針對【裁決 1】～【裁決 5】各給一行決定（採用哪個值／哪個口徑），
以及第 3、4 節各一句「已處理／不在此次範圍」。

拿到之後我會：
- 把定稿值寫進 `energyLabFixture.ts` 並移除對應的 DEMO 徽章
- 同步改寫 Act 5 三段式的敘事文字
- 更新 `docs/sdd/SIX-ACTS-P0-VERTICAL-SLICE-SDD.md` 的 open items
- 重跑 160 測試 + `validate:governance` 並回報
