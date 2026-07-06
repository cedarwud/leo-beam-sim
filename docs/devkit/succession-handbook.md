# 接班手冊 — leo-beam-sim（藍圖 §16 落地）

> 讀者：**非頂級 controller**（Opus/Sonnet 檔位的日常主對話模型——本手冊全文以此措辭寫、不綁死型號；你讀到這裡，你就是非頂級，[鷹架] 條款對你全束縛、不得援引「頂級可偏離」豁免）。目的：離場的最強檔已把「已知問題的判斷」預先做完——你執行；「未知問題」導向合議與使用者——你不硬扛。
> **加嚴不算衝突**：本手冊條款與其他制度檔可同時滿足時照較嚴者執行；只有真正互斥（兩者不可能同時滿足）才算衝突、上報使用者。不得以「上位制度較鬆」繞過本手冊的加嚴條款。
> 出處：2026-07-07 Fable 離場 session 定稿；模式照 ai-devkit 藍圖 §16（fields-flow 試點已以 Opus 本尊驗證此類手冊可執行）。

## 1. 判斷分工位階表

| 層 | 誰裁 | 內容（本 repo 實例） |
|---|---|---|
| 你可獨裁（做了留紀錄） | controller | 機械執行、bug 抓取與修復、validator repoint（不弱化）、blast-radius 估算、S/M 派工與驗收、照 SDD 施工 |
| 跨模型合議（Codex/Gemini 第二意見後才定） | controller＋挑戰者 | 架構 trade-off（如切片大小 vs 載入策略的重估）、「換路 vs 繼續加力」的邊界案、規格有兩讀且都合理 |
| 必上使用者（跳梯，dispatch-rules §4 尾 [通則]） | 使用者 | 視覺/敘事品味取捨、SACRED/gate **語義**變更、跨 repo 合約、§2 品味自留清單全部 |

離場模型的替代品＝**挑戰者多數決＋多版本評審選優**（dispatch-rules §4 第 3 級），不是可選項——合議層的題自己單裁＝越權。

## 2. 品味兩清單（處置不同，勿混）

**A. 已鎖決策**（重開＝推翻 Active 決策＝硬關卡；完整清單與證據在 preference-profile「品味凍結」節）：palette FINAL（🟡serving/🔵takeover/灰底）、cone blending=Additive（8e4e1e7 像素驗收）、AA-off ~9FPS 交換、win 軸敘事框架、雙用途骨架方案。**邊界句**：執行已鎖設計自身驗收條款內的微調（如 opacity 在既列 token 範圍調整）＝工程修正、非重開。

**B. 使用者自留題**（不得代決，**連 A/B 變體都不主動做**——做了變體＝框定了選項空間）：demo 敘事節奏與口試答辯用語；EE 的最終呈現選型（旋鈕 vs meter）；P3 紅綠場的過曝/鋸齒裁決；self-check chip 的對外文案定稿；任何「要不要對口委展示 X」。**「對外」判準**：口委/觀眾/公開 repo 讀者看得到的字＝對外；純 debug/內部字串不算；**拿不準是否對外 → 當對外處理**（往嚴靠）。

## 3. 措辭紅線（出現即違規的句式；why＝這些句子會把研究敘事帶偏或虛報證據）

1. 「Jain 提升／更公平所以贏」——Jain＝diagnostic-only（獎 equal-misery 塌縮），永不當 win 軸。
2. 「贏在 reward／scalar 更高」——win 軸＝coverage/served＋EE＋Gini/Lorenz。
3. 「catfish 帶來改善」——A1≈A2 已證 catfish present-but-inert。
4. 「PIXEL-VERIFIED」不附截圖路徑、「已驗證」不附本 session tool 結果、「CI 綠」不附 run id——證據句必附指針。
5. 「重播數據顯示…（經顯示層調整後）」——顯示層永不改寫真值；措辭必須區分 producer 真值與顯示。

## 4. 實踩陷阱（離場模型親踩親修；復發高危）

- worktree 從舊 HEAD 開場／回收協議／中流死續推 → dispatch-rules §11（逐字照做）。
- validator 手術 blast-radius 爆炸（預估 2 支實際 9 支含 SACRED 的前例）→ rubric §4 換路訊號＋refactor 模板雙 STOP。
- untracked 檔案會被環境吃掉 → 制度檔／設計文檔落地即 commit；個人層走 devkit-local symlink。
- 本機綠 ≠ CI 綠（未 commit WIP／機器路徑依賴）→ rubric §2 CI 列（乾淨 worktree 首驗）。
- **「既有紅的 validator 順手可修」＝先定因再動**（Opus 本尊測試揪出的歧義，特此明文）：改法讓它 PASS 之前先判 (A) source-pin 隨 DOM/碼搬移而 rot →合法 repoint（你可獨裁，但獨立工作項＋negative-control＋browser 級用 validate:ready 實證）；(B) 執行行為真回歸、改 selector 只是讓 validator 看向別處＝**遮真紅**（rubric §4 紅線）。沒定因不動手；「順手兩行」永遠不是 validator 修復的合法形狀。

## 5. Data-blind 裁決 playbook（rubric §4b [通則]：先有 playbook 才准看數字）

### Playbook 1：CI 首跑收割（在途：等使用者 push 觸發）

**第 0 步有效性 gate**：run 必須跑在 commit `16a5268` 之後的 HEAD、且 `npm ci` step 成功——npm ci 失敗＝run 無效，只修環境不裁任何分支。

| 結果分支 | 封閉措辭（逐字用） | 後續動作 |
|---|---|---|
| static-gates 綠 | 「CI 首綠（run <id>／commit <sha>）：復活鏈驗證成立。」 | 記 audit＋等累計 3 綠 → runway #7（軟模式綁 required check，步驟在 health-2026-07-07.md） |
| static-gates 紅在 `typecheck:scripts` | 「本機綠、CI 紅＝環境差異（node 版本/依賴解析），非程式碼回歸。」 | 屍檢 log 定位差異；不改 gate、不動 tsconfig 門檻 |
| static-gates 紅在 `static:all`，log 含 `[SKIP-DATA-UNAVAILABLE]` 行 | 「缺料 SKIP 屬預期（≤17 支且逐支點名）；紅在 <key>＝真訊號。」 | 對紅的 key 逐項屍檢；**禁止為綠而 quarantine**（棘輪）；skip 數異常（>17 或未點名）＝guard 回歸，查 e591723 |
| visual-gates 紅在 playwright install／30min timeout | 「infra flake 路徑，非 gate 斷言失敗。」 | retry 一次；連兩次 → 提案 playwright cache step（health 報告已列），不動 gate 清單 |
| visual-gates 紅在某 gate 斷言 | 「瀏覽器級 <gate> 紅：先本地 `validate:ready` 復現再定性。」 | 本地復現＝真 regression 走正常流程；本地綠＝CI 環境差異記 production-feedback 觀察名單 |

**選單外的結論句＝越權，停下問使用者。**

### Playbook 2：EE producer relay 到貨（在途：等使用者發 relay）

有效性 gate＋開工檢查單＝intent.md EE 條目（四項逐勾）。封閉措辭：schema 齊 →「relay 完整（H/I_hat/σ² 逐欄核對過），照檢查單開工。」；缺欄 →「relay 不完整：缺 <欄位>。退回 producer 補件；**不得以近似值或 leo 側重算頂替**（repo 邊界 1）。」

## 6. 驗收紀錄（§16.5 兩件，2026-07-07 完成）

- (a) **本尊誤讀測試 PASS 10/10**：受測＝fresh Opus 4.8（自報 `claude-opus-4-8[1m]`）；出題/受測/評分三方分離（答案鍵預先落檔、Sonnet 評分方獨立裁決）；四題越權方向關卡（A/B 變體、已鎖重開、缺料頂替、自 resolve）全對；受測方自報的兩處歧義（既有紅 validator 定因、「對外」文案判準）已回寫本手冊 §2B/§4。
- (b) **真任務行為乾跑 PASS 8/8、零重大偏差**：fresh Opus 以接班 controller 身分把 runway #1 slice-α 規劃到派工前一步（零寫入協定遵守）；盲評分表 8 項全中；超綱表現＝自查出 memory GIT STATE 過時並據實改用 worktree 隔離、實查 /tmp 資料在場、預排 negative-control。
- 結論：本手冊＋制度層對 Opus 4.8 的**行為級**可執行性成立（不只讀得懂，做得對）。
