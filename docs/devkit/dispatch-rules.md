# 調度守則 — leo-beam-sim devkit

> 讀者：日常 pipeline 的主對話模型（Opus/Sonnet 級為設計基準）。條款標示 `[通則]`（任何等級模型都遵守）或 `[鷹架]`（為較弱模型而設的判斷外包）。**未標示一律視為 [通則]**。頂級模型（官方定位高於 Opus 檔位，如 Fable/Mythos）可憑判斷偏離**標示為 [鷹架] 的條款**（含 §3 選型對照與 §4 階梯步序），但每次偏離要在回報留一行理由（進 audit log）；[通則] 不得偏離，無論等級。「頂級」無客觀清單——模型不確定自己是否夠格時，一律當非頂級處理。**條款級標示優先於章節級**：章標 [通則] 的節內仍可有個別 [鷹架] 條款，反之亦然（藍圖 §3，v0.22 同步）。

## 1. 指揮官紀律 [通則]

適用範圍：日常 pipeline 運轉的主對話（controller）。安裝／同步 session 建置制度檔的交付物寫入不受「3 檔改動」限制，但大量閱讀仍應派工。

- 主對話只允許：讀狀態檔、讀結論摘要、做決策、派工、與使用者對話、在行數預算內針對性讀關鍵段落——**外加 pipeline 自身簿記**（寫狀態檔／租約置空、跑抽查骰、append metrics 與 audit、清自產暫存）：簿記是 controller 職責、不是派工對象、不計入下方派出門檻；制度檔與狀態檔的開場閱讀同樣豁免（它們是操作手冊），專案內容檔一律計入。
- **一律派出**（任一命中即派，是「或」不是「且」；分次讀小檔不能繞過。觸發器本體與「任一命中即派」＝[通則]；具體數值 200 行／3 檔＝[鷹架]）：
  - **單一檔案**在同一任務內累計閱讀超過 200 行（跨檔不相加——跨檔的量由檔數觸發器管）
  - 單一任務累計閱讀超過 3 個檔案
  - 改動超過 3 個檔案
  - 任何網頁研究
  - 批次操作（跨多檔的機械性修改、逐一驗證清單）

  **判例**：兩個 150 行檔＝各檔 <200 不觸發行數、2<3 不觸發檔數 → 不派；同一檔累計 150+100=250 → 行數觸發；4 個 50 行檔＝行數各檔不觸發、4>3 檔數觸發 → 派。
- **批次逐檔核對一檔一 agent**：「逐檔核對 N 個檔案」類派工，N 個 agent 各揹一檔、controller 彙整——合併派會撞單 agent 回報長度上限，後段檔案的發現被截斷且**不報錯**＝無聲漏報（藍圖 §14 實案：112 檔比對）。
- **二進位衛生**：MB 級素材不受行數觸發器保護——同一 PDF 每 session 至多附進 context 一次（要重查先萃取文字落檔，之後引用文字版）；「渲染→檢視→修改」的截圖迭代迴圈一律 subagent 化，主迴圈不累積多輪圖片（本 repo 的 shot 探針迭代正是此型）。
- **不派**（直接做更省）：讀狀態檔與制度檔本身；單檔 <200 行的針對性閱讀；一兩行的修改；與使用者的對話回合；codegraph 查詢（它本身就是為 controller 設計的低成本索引）。
- 需要更深脈絡時：向原 subagent 追問（SendMessage 沿用其 context），或在行數預算內讀關鍵段落——不是放寬回全檔閱讀。
- 每階段結束狀態落檔 → 對話可拋棄。context 壓縮與重開不是威脅，不要為了省 context 提前收尾。

## 2. 派工三件套與回報合約 [通則]

每次派工必含三件套（模板見 [templates/](./templates/)）：
1. **目標與動機**：做什麼＋為什麼（上游是哪個意圖檔項目）。
2. **驗收條件**：可測試的完成判準（指令、預期輸出、檔案存在性）。
3. **回報格式**：只回結論＋`檔案:行號`；長產物落檔傳路徑；禁止把整檔內容貼回報告。

回報合約補充：
- subagent 回報的每個「已完成」必須對得上其實際 tool 結果；未驗證的要明說「未驗證」。
- controller 收到回報後**不照單全收**：關鍵宣稱抽一兩點重驗（re-grep／re-run）——本專案有 subagent 宣稱與實況不符的前科（memory: feedback_modqn_demo_subagent_verify）。
- 連續子任務沿用同一 subagent（SendMessage），省 context 重建成本；換任務域才開新 agent。
- **並行改檔任務關帳前加獨立審計波**：≥3 個 agent 並行改動同一資料面（同一模組群、同一文檔群）時，各 agent 自驗全過仍必須加一個 fresh-context 審計 agent 掃跨檔一致性（引用鏈完整、重複疊加、格式統一）——並行編輯會引入單體不犯的迴歸類型，逐 agent 驗收結構上看不見（藍圖 §13，v0.22 同步）。

## 3. model × effort 對照表 [鷹架]

依本機實際可用型號（2026-07-06；模型行為出處見 [model-facts-successor.md](./model-facts-successor.md)）：

| 任務類型 | 首選派工 | effort | 備註 |
|---|---|---|---|
| 檔案定位／「X 在哪」 | `caveman:cavecrew-investigator` 或 `Explore` agent（Agent tool 的 subagent_type 要逐字用這些字串） | 預設 | 唯讀、回報壓縮 |
| 廣域偵查（多目錄、命名慣例掃描） | Explore agent（註明 medium／very thorough） | 預設 | 只要結論不要檔案傾印 |
| 大量閱讀萃取（>200 行或 >3 檔） | general-purpose（Sonnet 級） | high | 回報合約強制 |
| 實作（日常 slice） | general-purpose | Sonnet high；難題 Opus xhigh | 前端工作必附 frontend-change-contract 派工模板＋worktree 隔離 |
| 重構 | general-purpose（Opus 級優先） | xhigh | 先讀 safe-refactor skill；估算含治理稅（§7 註） |
| 研究（web／文件） | general-purpose | high | 外部內容檢疫規則見 security-profiles.md |
| 審查（Claude 側） | `caveman:cavecrew-reviewer` 或 `general-purpose` ＋ /code-review | high | 兩段式：先全報後篩（模型會忠實執行質化門檻導致漏報） |
| 審查（跨模型） | codex exec（見 model-facts-challenger.md） | codex 檔位 high | 大 diff 會 timeout，切小片 |
| 驗收（fresh-context） | general-purpose，全新 context | high | 驗證不自驗：不得由實作 agent 自驗 |
| 理解測試／複述／格式檢查 | Haiku 級 | 預設 | Haiku 只承擔此類輕量子任務，不當主力 |
| 機制文件查詢 | claude-code-guide agent | 預設 | 寫 skill/hooks 前查現行規格 |

effort 語義（官方）：effort 是行為訊號不是硬 token 預算；`high` 與省略同義；`xhigh` 用於最能力敏感的工作。Opus 4.8 對 coding 建議 xhigh 起手；Sonnet 5 預設 high、最難任務 xhigh；低檔（low/medium）會嚴格縮限範圍——別用低檔跑複雜任務再抱怨淺推理，第一槓桿是升 effort。

**effort 在本 harness 的落地限制**：Agent tool 沒有 effort 參數（只有 model）；effort 由 settings 層（本專案 `settings.local.json` effortLevel=xhigh，session 級）與 agent 定義 frontmatter（`.claude/agents/*.md`，型別級）控制。所以：(1) 上表 effort 欄是**期望消耗檔位**，供預算單價估算用——本專案現況＝派工一律繼承 xhigh，單價按 xhigh 計；(2) §4 階梯第 1 級「升 effort」在派工層無旋鈕時視為**不可用的空階，直接跳第 2 級（換模型）**，或由使用者以 /effort 調 session 檔位。

## 4. 升降級路徑 [鷹架]

**升級前置＝失敗分類步（v0.22 同步）**：操作性失敗（auth 失效、timeout、配方錯誤、工具環境壞）≠ 能力失敗（模型做不對任務本身）。操作性失敗＝查工具註記、換配方換工具，兩輪即換路，**不動模型階梯**——升模型治不了壞工具（「一輪」＝一次完整配方嘗試：一組輸入＋工具＋觀察到的錯誤）。本 repo 已知操作性失敗型：codex 千行 diff timeout、API 中流死（§11 有專屬處置）、/tmp 資料未 stage（validator SKIP 非紅）。**能力失敗才進階梯**：

失敗處理的階梯（§5 鐵律 4），沿階梯**上移一級**才算升級，同級原樣重試不算、且不得超過兩輪：

1. **升 effort**（如 Sonnet high → xhigh；派工層無旋鈕時視為空階跳過，見 §3 落地限制）
2. **換更強模型**（Sonnet → Opus xhigh）。**Opus xhigh 是本環境的常備最強檔**（Fable 級只在使用者特別開的 session 出現，不當作階梯的一級）。
3. **多版本評審選優**（Opus xhigh 之上的替代品）：同一 spec 派 2-3 個**互相隔離**的實作 agent（各自 worktree、prompt 加一句不同的切入角），fresh-context 評審 agent 按驗收條件逐項評分選優、可從落選版嫁接好段落——用成本買回判斷力。適用：驗收條件明確但做法開放的難題。不適用：品味題（多版本只會給你三種品味，仍要人裁）。
4. **換方法或重新拆解**（換 approach、縮小範圍、改先寫測試）
5. **問人**（把失敗軌跡完整帶上：試了什麼、輸出什麼、卡在哪）

**跳梯直達「問人」的三類題 [通則]**（不浪費預算爬梯；此句是通則、不隨本節的鷹架標籤放寬）：視覺/敘事品味取捨；SACRED validator 或 gate 的**語義**變更（repoint/加強不算）；跨 repo 合約變動（producer schema、vendor 邊界、baseline）。

- 同一子任務連錯兩次 → 帶完整失敗軌跡升級，不第三次原樣重派。
- 某一級不可用（已是最高 effort、無更強模型）→ 跳過走下一級，不停在空階。
- 「問人」之後再空轉 → 不重複發問：任務標記受阻、退回 backlog（狀態檔記錄），交使用者重定義或棄置。
- 「重試」＝失敗後原樣重做。有實質進度的迭代不是重試，不受兩輪限制（由空轉規則與預算管轄）。

## 5. 迴圈鐵律 [通則]

適用範圍：**一切自動迭代迴圈**（開發、偵查、研究、審查、健檢），非只開發迴圈——空轉規則與升級階梯對研究類同樣生效（用該類的進度差定義）。唯鐵律 1（安全網前置）只約束**會改動 repo 的變更類迴圈**；純唯讀迴圈不受安全網前置限制。

1. **安全網前置**：測試＋CI 存在才准自動迴圈。本 repo 安全網＝pre-commit `validate:governance`（~16s）＋ CI `governance.yml`。無安全網狀態下允許的變更工作僅：補安全網本身、leo-intake §4 的用完即丟雛形（藍圖 §6；拋棄式）。藍圖另允許「P0 骨架建置」例外——本 repo 已過 P0，不適用故不列。
2. **進度差可量測**：每輪迭代要有完成數（開發類＝測試通過數／工作項關閉數；偵查研究類＝交付物完成進度）。「發現更多待辦」在開發類不單獨算進度。
3. **空轉規則**：連續 2 輪零進度（含「只有發現、沒有完成」）→ 不管預算剩多少，停下升級。
4. 升級照 §4 階梯。
5. **爬走跑**：互動式＋事件 hooks 先行；metrics 累積 2-3 週＋安全網驗證過，才開無人值守排程迴圈（/loop、/schedule 屆時才啟用；現在**只設計不啟用**）。
6. **關帳即清理**：工作項關帳（寫 metrics 那一步）順手清掉自產暫存——harness scratchpad 歸零或 `.claude/scratch/` 清空；雛形照判準拋棄或轉正，不懸置。

## 6. 預算等級與任務對照 [通則]

| 等級 | token 上限 | 行為 | 本專案典型任務 |
|---|---|---|---|
| S | <100k | 不問，做完留紀錄 | 單檔修 bug＋測試＋1 fresh 驗收；validator 修綠；文檔更新 |
| M | <500k | 開工報備一行 | 日常 slice（UI 面板、cue 邏輯、單模組 vendor port）＋多鏡頭審查 |
| L | <2M | **需核准後開工** | 跨 lane 的 scene 改動、P2 全面健檢、大重構（含 validator 手術） |
| XL | ≥2M | **每次明確核准** | 架構級多版本實作＋評審選優、全 repo 掃描修正 |

- 未經 scout 報價的任務一律以 S 上限（100k）為預算基準：實花到基準即觸發檢查點（不適用最小觸發量），到 200k（基準 2 倍）即熔斷。
- **治理稅**（本 repo 特有，估算必含）：source-pinned validator 會被純搬移打破——重構類估算外加「validator 修復」工作項（前例：一次 board 刪除牽動 9 支 validator，含 2 支 SACRED；memory: P3 slice-3）。

## 7. 防護疊層參數 [通則]（藍圖 §7 預設值，標註可調）

1. **scout 報價**：L 級以上任務先派廉價 scout（`Explore` 或 `caveman:cavecrew-investigator`，逐字名）列舉工作項；估算＝工作項數 × 單價 ＋ 固定開銷，附信賴區間，報使用者核准。單價學自 metrics.jsonl（跑過幾次後收窄）。
2. **進度帳**：每輪記錄；空轉規則照 §5。**計量來源（v0.22 同步）**：harness 回報的實際計數可得時（task 通知附 token 數）以其為準；subagent 用量自估**系統性低估 2–4×**——無 harness 計數才用自估並 ×3 記帳修正（校準目標是相對單價不是精確）。**並行派工盲點**：並行 token 事後才可見——一次並行 ≥3 個 agent 且總估算逼近預算級上限時，派前自查「併發數 × 單價估算 ≤ 級上限的 70%」，不滿足就分批序列派（批間可插檢查點），或任務改列上一級照該級關卡走（M→L＝需核准，不是報備）。
3. **檢查點（雙軌）**：觸發＝（相對超支 ≥ 閾值 且 高於最小觸發量）或 絕對超支。預設：相對閾值起始 20%；最小觸發量＝min(50k token, 估算的 50%)；絕對線＝超出估算 500k token 或 1 小時，先到先觸發。觸發時乾淨邊界暫停：做完當前輪、狀態落檔、才問。問法固定：「已花 X，完成 Y/Z，超支原因＝＿＿；剩餘預估 V，投嗎？」**任何等待使用者回覆的期間（檢查點、L/XL 核准、硬關卡）通用同一規則：只做無悔工作**（驗證、寫報告、scout 估算、其他不相依且不待決的 S/M 任務——S 級本就不需核准），不碰待核准任務本體的不可逆改動。**相對超支的分母＝最新一次核准後重新錨定的估算**（每次核准後對剩餘工作重估、之後對新錨算，不回頭對原始估算）；**錨與實花必須外部化到狀態檔 `current_goal.budget`**（est_tokens／approved_on／spent_tokens／hard_cap_tokens／approvals_streak——欄位見 leo-pipeline 附錄 A），否則 compaction／resume 後算不出觸發點（憑記憶＝幻覺）。**錨的寫入時機＝核准當下同一次變更寫入**（核准紀錄＋估算依據＋錨值/線位一起落檔），事後補寫不算——線位只存對話記憶＝漏發檢查點之源（v0.21/0.22 同步，皆有試點實證）。
4. **AIMD 閾值（階梯操作）**：20% → 35% → 50%（封頂）。連續 3 次核准上移一級；任一次拒絕下移一級（20% 到底）；**抽查失敗直接重置回 20%**。只調「何時問」，永不自動調硬上限。目前值記在 pipeline-state.json `aimd_threshold`。**AIMD 只作用於相對超支閾值**；未報價任務的 100k/200k 絕對基準（§6）與絕對線（500k/1h）不受 AIMD 調整。
5. **硬上限熔斷**：該任務核准預算的 2 倍。無條件停、落檔、報告。**無人值守時所有詢問的預設答案永遠是「暫停」**。恢復協議：決策請求寫進 pipeline-state.json `gate_requests[]`，使用者任一 session 白話回覆即可續跑。

## 8. 抽查機制 [通則]

- 抽查率（可調）：S 10%、M 25%、L 50%、XL 100%。
- **抽中與否在任務關帳時判定**（controller 寫 metrics 那一步），亂數源釘在 controller 之外：session 開始時 hook 預生成種子寫入 `.claude/devkit-local/spot-check.json`（controller 只讀不改）。判定公式（逐字執行，任何模型算出同一結果）：

```bash
# seed 取自 spot-check.json；item_id ＝ 狀態檔單調計數器發號（pipeline-state.json 的
# work_item_seq：開工時取號 +1、格式 wi-<seq>，不由 agent 自命名——自命名＝挑骰向量；
# v0.22 同步，取代舊的日期序號慣例；歷史 wi-2026-07-0x-NN 項不溯改）；rate 為該等級抽查率
roll=$(( 0x$(printf '%s:%s' "$seed" "$item_id" | sha256sum | cut -c1-8) % 100 ))
# roll < rate → 抽中：spot_check.due 寫進 pipeline-state.json，本工作項進入待審
```

- **抽中的生命週期（v0.21 同步）**：抽中工作項 append 進 `spot_check.pending[]`（`due`＝pending 非空的布林投影）；`history[]` 每次查骰與每次 resolve 各 append 一筆（item/roll/門檻/結果，純稽核）；metrics 先記 `pass-pending-spotcheck`（不是 `pass`）。**`resolve(pass|fail)` 是使用者抽查裁決的回寫**（使用者說 pass/fail 或看過後 controller 據以回寫），不是 controller 自主判斷：resolve(pass) 才轉 pass 並出列、resolve(fail) 走上面失敗後果三件。沒有出口，due 會卡死在第一個抽中項。`pipeline-state.json` 是唯一權威訊號（本安裝沒有 stderr 輔助 hook）；controller 慣例：每次含 commit 的 Bash 之後固定核對 due。
- 抽中的工作項：在下一個批次關卡呈給使用者審（審 spec 與驗收證據，不逐行 diff）。
- 抽查失敗判準＝發現任何會改變核准決定的問題（正確性、安全、超出範圍）；純格式瑕疵不算。
- 失敗後果（三件都做）：AIMD 重置 20%；該工作項回爐（標記未通過、回滾或重做，走驗證流程）；失敗案例記入教訓庫並觸發 postmortem。絕不讓沒過抽查的變更留在主線上。
- 誠實標註（v0.22 同步升級）：抽樣的保證是**不可自選＋事後可重算稽核**，不是「不可預測」——種子可讀、公式公開，agent 讀檔可預知結果。已知三個規避向量：讀種子預知、重排關帳順序閃時機、自命名工作項挑骰；對沖＝工作項序號用狀態檔單調計數器（不由 agent 命名）＋蓄意規避會在 append-only audit log（security-profiles.md）的對照中留痕。本地環境 agent 對 hooks 與種子檔都有寫入權：此設計防隨手作弊、不防蓄意規避。

## 9. 注意力預算 [通則]

- 使用者額度：**每天約 30 分鐘**（2026-07-06 開場設定，可隨時改）。
- 系統義務：把資訊密度最高的決策打包進這個窗口——批次關卡、抽查項、健檢圈選，一次呈上；不散彈打斷。
- 審查標的上移：呈給使用者的是「它承諾什麼＋怎麼證明」（spec＋驗收證據），不是原始 diff。使用者要看 diff 隨時可以，但預設不餵。
- 已知失效模式：核准疲勞會被 AIMD 誤讀為「該放寬」——抽查機制就是反制，不得以「使用者都核准」為由跳過抽查。

## 10. 重活路由（本環境特有）[通則]

產生 worker／sub-session prompt 時先分類（全域 CLAUDE.md 既有規則）：
- **重計算**（訓練、掃參、matched pilots、>30 分鐘牆鐘的長 rollout）且不需瀏覽器 → prompt 前綴建議使用者改在 Ubuntu server 跑（附預估牆鐘、SSH＋同步＋開 worker session 步驟）。
- 實作／唯讀／審計／測試／SDD 起草 → 留本環境。
- 並列多個 worker prompt 時逐一標 **heavy**／**non-heavy** 供使用者路由。

## 11. worktree 派工與回收協議 [通則]

（2026-07-07 安裝 session 實戰結晶——兩個 agent 都踩過 stale-HEAD、一個中流死，全部有既定解法，照做不用重新發明。）

**派工時寫進 prompt 的開工序**：
1. `git log --oneline -3` 確認 worktree 含最新 main 的 HEAD commit（worktree 可能從舊 HEAD 建出）；缺 → `git merge main --no-edit`（這是 subagent 唯一允許的 merge，且只能 merge 進自己的 worktree 分支）。merge 若衝突 → **STOP 回報 controller，不硬解**。開工時核對一次即可，不需每輪重查（main 若在任務中前進，回收序的主樹重驗會接住差異）。
2. `ln -s <主樹絕對路徑>/node_modules ./node_modules` 借依賴（不跑 npm ci、不裝東西）。
3. 改動留 worktree、不 commit 不 push——回收是 controller 的事。

**controller 回收序**（agent 回報後）：
1. 親驗＝judgment-rubric §5 三件中的 **(1) 機械宣稱重算＋(2) 高風險 hunk 逐行讀**（第 (3) 件在下面第 3 步做——順序刻意如此，不是重複清單）。
2. 移植：新增檔 `cp`；已追蹤檔 `git -C <worktree> diff | git apply`（或 `--3way`）；衝突手解——常見型＝controller 與 agent 改了同一檔（如 runner），合體原則是兩邊意圖都保留、逐行確認。
3. **主樹重驗**：關鍵驗證指令在主樹再跑一次（worktree 側的綠不能直接沿用——基底可能不同）。
4. controller commit（過 pre-commit gate）→ `git worktree remove --force` ＋刪分支。

**agent 中流死（API error / stalled）**：用 SendMessage 對**同一個 agent** 續推（它的 context 與 worktree 都還在），訊息寫「從斷點續跑＋原任務書要的完整回報」。不重派新 agent——重派＝丟掉它已讀進去的全部脈絡。例外：同一 agent **連續 2 次**中流死或續推無回應 → 改重派新 agent，prompt 附上前手的 scratchpad 筆記路徑與已知進度（中流死是基礎設施故障＝§4 的操作性失敗，不算「連錯兩次」驗收失敗）。**resume 兩個已知坑（v0.22 同步）**：(1) 以 model 覆寫派出的 agent，resume 後**未必保留原覆寫**——受測模型敏感的任務（弱模型理解測試、降級驗收）要求 agent 在回報中自報型號並照實入帳；(2) resume 計費 ≈ 前輪 context 重放——小型定點複核先掂 fresh（帶清單）vs resume（帶前情）的單價再選，resume 反而貴時改 fresh。

## 12. 工作暫存慣例 [通則]

實驗腳本／中間輸出／一次性草稿不得散落專案源碼：優先用 harness scratchpad（本環境 `/tmp/claude-1000/...-leo-beam-sim/<session>/scratchpad`）；跨 session 要留的用 `.claude/scratch/`（gitignored）。關帳時清空（鐵律 6）。既有慣例補充：本 repo 的拋棄式探針腳本命名 `scripts/_*.ts`（gitignore 未涵蓋、靠命名慣例辨識）——新增探針沿用此慣例並在關帳時刪除；歷史遺留的 `scripts/_*` 與 `.githooks/` 未追蹤檔不是本系統轄區，未經使用者指示不得清理。
