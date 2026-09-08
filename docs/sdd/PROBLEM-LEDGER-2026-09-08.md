# 問題總帳

單一事實來源。最後更新 2026-09-09。

**分級**
- `VERIFIED` = 我在本機樹上親自複驗過(重跑指令 / 讀到 file:line)
- `REPORTED` = worker 給了 file:line 與輸出,我尚未親自複驗
- `PENDING` = 稽核仍在跑

**唯一驗收標準**:改一件渲染決策要動幾個檔案 + 改完能不能**算出來**是否正確(不靠看畫面)。

---

## ✅ 已解決(有 commit)

| # | 問題 | commit | 複驗 |
|---|---|---|---|
| S1 | MODQN 全系統移除(181 檔 −58,819 行) | (前) | `grep -ril modqn src` = 0 |
| S2 | 13 個孤兒 npm script + 找出它們的守衛 | `99eedfb` | 守衛自己抓到我後來的誤還原 |
| S3 | drill 板把「錨點失配、量不到」誤報成「已收斂」 | `e9e4419` | 新增 `invalid` 桶;12/2/0 exit 0 |
| S4 | drill `is_green` 不檢查 node 退出碼 | `5a89faf` | 缺檔 exit=1 現在被抓 |
| S5 | 三條顏色道繞過 identity ladder | `de96cc7` | 改一行,三條道同動;舊權威不動 |
| S6 | 「第 N 秒畫面上是什麼」無法計算 | `8e40f8f` | `--diff 6,7` 印出 intra 換手全部變化 |
| S7 | render-timeline 的 wall time 印在 stdout 破壞確定性 | `8e40f8f` | 移到 stderr,5/5 逐位相同 |
| S8 | `validate:frame-plan` 對 intra 著色全盲 | 未提交 | 實測:同擾動現在抓到 6 個顏色差異 |
| S9 | manifest 只有 12 筆,且**收斂的三個模組沒登記** | `5076ba9` | 我自己複驗:query 空、正對照命中 |
| S10 | `MultiCandidateBeamScene` 兩套重複 precedence ladder | `a85a4e7` | 孤立 seam 2→1;drill invalid 桶抓到 worker 衝突 |
| S11 | identity ladder rung 0/2 無 headless 入口(工具靜靜印錯顏色) | `a3c4eeb` | `#8397d1`→`#2758ec rung=0-plan`;工具現在印出哪一階贏 |
| S12 | `satelliteTint` 六個消費者未收斂 | `e2afdd4` | 改一行,九條道同動;退役權威不動 |
| S13 | 27 個瀏覽器閘門可假綠 | `d9eba1b` | 自驗:假驗證器打死 port → VOID/DID NOT RUN,exit 1 |
| S14 | MainScene 五個決策無擁有者 | `ea102f8` | 9 個 move,timeline cmp 全 0/0;五個都登記 manifest |
| S15 | T1 tsc 錯誤 2 個 / T2 `opacityFactor` 死欄位 | `ea102f8` `3c6100f` | tsc 2→0;刪除後 sha256 未變證明無人觀測 |
| S16 | `App.tsx` / `sinrLiveCellModel.ts` 探索成本過高 | `8e2c5f9` | 8 個任務 **27,992 → 5,043 行(−82%)**;timeline 逐位相同 |
| S17 | **render-timeline 自己只看得見 29%** | `cef049c` | 42 個突變普查 → 補強到 **45.2%**,23 個盲點逐一機械歸類 |

---

## 🔄 進行中(7 個 worker,完成會自動通知)

| worker | 機器 | 問題 |
|---|---|---|
| `mutation` | 本機 | A1 偵測率;`test:all` 那 36 個孤兒的分類**不可信**(只查了「有沒有 assert」) |
| `seams` | 本機 | C4–C6 三條剩餘顏色縫 + 2 個 drill frontier |
| `jsdom` | 本機 | 24 個 NEEDS-DOM 驗證器移出真瀏覽器 |
| `sat-rtcov` | sat | render-timeline **自己**看得見多少(≥25 個突變) |
| `sat-void` | sat | 27 個真瀏覽器閘門的 VOID 守衛 |
| `sat-manifest` | sat | **那 13 個決策的清單完整嗎** —— 分母沒人驗證過 |
| `sat-residue` | sat | tmp commit 考古:還有多少「從沒被決定過」的行為 |

---

## 🔬 已量出但尚未決定的(新)

| # | 發現 | 證據 |
|---|---|---|
| M1 | **舊的瀏覽器閘門一個都沒真正跑過** —— 全部 0.76~1.10 秒 exit 1 = VOID。移植成 DOM 後才第一次真的執行並通過 | `/tmp/jsdom-port.md` 對照表 |
| M2 | **homepage 有 React 無限重渲染**:`Maximum update depth exceeded` ×2。暫停狀態下 `errors:0`,所以與播放狀態有關 | 移植後跑 112.84s 才紅;舊閘門 0.97s VOID 從沒看見過 |
| M3 | 換手功能**在現在的程式碼裡是健康的**:7200 秒 126 次(45 intra + 81 inter),presentation-starts 126,**dropped 0** | `/tmp/handover-death.md`,四個假設全排除 |
| M4 | 但有**兩個 1 秒空窗**(t=1889、t=2051),`satId=null`,下一次換手 t=1894/2057 自行恢復 | 成因 `sinrLiveCellModel.ts:2813-2850` 的 detach 清空 |
| M5 | 首頁 intra/inter 按鈕跑**固定 72 秒手寫劇本**,`t=52s` 把服務身分換成作者指定的贏家。可從任意時刻按、會重啟、端點缺失 fail-closed | `App.tsx:2252/:2292` |
| M6 | homepage 六色系仍是第二調色盤,收斂會重新著色整個首頁(gold 55°→280° 等) | `seams` 報告列出每個 hue 的位移 |
| M7 | **「timeline 逐位相同」的保證範圍是 45%,不是 100%**。已提交的重構仍有 `test:appearance`(85)與 drill(14/14)兩層獨立覆蓋 | `cef049c` |
| M8 | 剩餘 23 個盲點:**7 個 UNREACHABLE-ROUTE**(預設路由真的跑不到,補不了)、**12 個 NOT-WIRED**(harness 沒接生產路徑,`sat-wire` 正在補)、3 個已修 | `/tmp/render-timeline-coverage.md` |

## ⬜ 待辦(未派)

| # | 問題 | 為何還沒做 |
|---|---|---|
| T4 | `HANDOVER_TRANSITION_SOURCE_OPACITY_FACTOR` 在預設路由不可達(唯一消費者被關閉的 overlay 擋住) | 要先確認 overlay 是否該永久關閉 |
| T6 | 20/24 個 NEEDS-DOM 驗證器未移植 —— 19 個是**現在的程式碼到不了那個斷言面**(MODQN 移除的後果),1 個因 M2 那個 React bug 而紅 | 等 M2 修完再重評 |
| T7 | M4 的兩個 1 秒空窗:要決定是「明確的覆蓋中斷狀態」還是「視覺連續性保持」 | owner 決定,不是重構副作用 |
| T8 | M5 的按鈕:要決定是**教學控制**還是**即時控制** | owner 決定 |

---

## 🔒 凍結(等 owner 或另一 session 定案,不得動手)

| # | 問題 | 已測得的數字 |
|---|---|---|
| F1 | **功率快取不一致**:multi-candidate 路徑把候選功率狀態跨換手帶進來(`sinrLiveCellModel.ts:2944-2964`),正規重算又丟掉(`:3116-3132`)→ 候選 B 留著反事實快取值,選上的 B 卻冷啟動 | 同一個東西兩個數字 |
| F2 | **顯示 EE ≠ 決策 EE**。顯示端是 seeded 動畫,鎖 [80k,180k],非服務候選硬夾到 `serving−4000`「regardless of physics」 | 決策 **557,335** / 顯示 **176,000** bit/J |
| F3 | F2 從來不是設計決定 —— 由訊息叫 `tmp` 的 `6b9474e` 引入(62 檔 +5344 行,已知造成 8 個回歸)。後續修復 `df0ce68` **只補了決策端** | 之前 `beamMetrics.ts:150` 直接讀真值 |

> F2 是「為什麼每次都要用看的」的直接答案:**畫面在結構上不可能解釋它正在播的那次換手**。
> 還原會讓畫面變不好看 —— 但要知道,那是**還原一個意外**,不是放棄一個設計。

---

## ✔️ 已查明「不是問題」(避免重複調查)

| # | 曾懷疑 | 實測結論 |
|---|---|---|
| N1 | intra handover 是假的 / 為 demo 捏造 | **是真的**。同衛星同 cell 換更好波束,替代 boresight 指向服務區原點而非 UE,程式明確擋掉 UE-following cheat(`sinrLiveCellModel.ts:667`) |
| N2 | 真 TLE 下 intra 會歸零 | **不會**。59→31(−47%),inter 75→99。真 TLE 在該地點比 Walker **密 2.9 倍**(145 vs 51 顆),零空窗 |
| N3 | 左欄控制項可能失效 | **沒有** INERT / ORPHAN-WRITE。22 + 13 + 19 個控制項全部 `LIVE-BOTH`,每個都做過 headless 因果證明 |
| N4 | 功率每幀重設 | **沒有**。實測第一步 0.825→0.7646 W,狀態有帶下去。換手時重設**是對的**(論文模型規定新服務段從 p⁰=p_max/2 重啟) |
| N5 | 顯示分岔會污染物理 | **六條全部不洩回決策**。決策端讀真物理,顯示端在決策之後才跑 |
| N6 | 時間/狀態不確定性 | 決策路徑都用穩定鍵排序,查不到不確定來源 |
| N7 | `src/prototype/` 是廢棄原型 | **是 LIVE 生產教學實作**(27k 行)。曾差點被當成死碼刪掉 |

---

## 解決順序(有強制性,不是偏好)

1. **A1 偵測率**先於一切。網子有 2/3 網目是通的時候,任何修改都可能無聲破壞別的東西,返工次數不可預測。
2. **量測工具自己的覆蓋率**(`sat-rtcov`、`sat-manifest`)其次。一個被信任超過其真實敏感度的工具,比沒有工具更糟 —— **它的沉默會被讀成「什麼都沒變」**。
3. 顏色縫、VOID 守衛、jsdom 移植可並行。
4. **F1/F2 最後,而且是 owner 的決定,不是重構的副作用。**

## 反覆出現的根因(寫下來以免再犯)

**一個查詢悄悄回傳空集合,而空集合被當成事實。**

本對話已發生:`git status --porcelain` 讓 blast radius 恆為 0、`until [ ! -s /dev/null ]` 恆真、drill 錨點失配被讀成「已收斂」、`sed` 改到錯行卻報告測試通過、broken-script-refs 正則把 `ts` 排在 `tsx` 前面誤報 107 筆(94 筆是假的)、瀏覽器閘門沒跑完卻被讀成綠。

**對策**:任何擾動都必須先 `grep` 確認落地;任何空查詢都要附上一個**已知會命中**的正對照。
