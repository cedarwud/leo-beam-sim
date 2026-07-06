# 調度守則 — leo-beam-sim devkit

> 讀者：日常 pipeline 的主對話模型（Opus/Sonnet 級為設計基準）。條款標示 `[通則]`（任何等級模型都遵守）或 `[鷹架]`（為較弱模型而設的判斷外包）。**未標示一律視為 [通則]**。頂級模型（官方定位高於 Opus 檔位，如 Fable/Mythos）可憑判斷偏離**標示為 [鷹架] 的條款**（含 §3 選型對照與 §4 階梯步序），但每次偏離要在回報留一行理由（進 audit log）；[通則] 不得偏離，無論等級。「頂級」無客觀清單——模型不確定自己是否夠格時，一律當非頂級處理。

## 1. 指揮官紀律 [通則]

適用範圍：日常 pipeline 運轉的主對話（controller）。安裝／同步 session 建置制度檔的交付物寫入不受「3 檔改動」限制，但大量閱讀仍應派工。

- 主對話只允許：讀狀態檔、讀結論摘要、做決策、派工、與使用者對話、在行數預算內針對性讀關鍵段落。
- **一律派出**（任一命中即派，是「或」不是「且」；分次讀小檔不能繞過）：
  - 單一任務累計閱讀超過 200 行
  - 單一任務累計閱讀超過 3 個檔案
  - 改動超過 3 個檔案
  - 任何網頁研究
  - 批次操作（跨多檔的機械性修改、逐一驗證清單）
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

失敗處理的階梯（§5 鐵律 4），沿階梯**上移一級**才算升級，同級原樣重試不算、且不得超過兩輪：

1. **升 effort**（如 Sonnet high → xhigh）
2. **換更強模型**（Sonnet → Opus；Opus → 問使用者是否動用最強檔）
3. **換方法或重新拆解**（換 approach、縮小範圍、改先寫測試）
4. **問人**（把失敗軌跡完整帶上：試了什麼、輸出什麼、卡在哪）

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
2. **進度帳**：每輪記錄；空轉規則照 §5。
3. **檢查點（雙軌）**：觸發＝（相對超支 ≥ 閾值 且 高於最小觸發量）或 絕對超支。預設：相對閾值起始 20%；最小觸發量＝min(50k token, 估算的 50%)；絕對線＝超出估算 500k token 或 1 小時，先到先觸發。觸發時乾淨邊界暫停：做完當前輪、狀態落檔、才問。問法固定：「已花 X，完成 Y/Z，超支原因＝＿＿；剩餘預估 V，投嗎？」**任何等待使用者回覆的期間（檢查點、L/XL 核准、硬關卡）通用同一規則：只做無悔工作**（驗證、寫報告、scout 估算、其他不相依且不待決的 S/M 任務——S 級本就不需核准），不碰待核准任務本體的不可逆改動。
4. **AIMD 閾值（階梯操作）**：20% → 35% → 50%（封頂）。連續 3 次核准上移一級；任一次拒絕下移一級（20% 到底）；**抽查失敗直接重置回 20%**。只調「何時問」，永不自動調硬上限。目前值記在 pipeline-state.json `aimd_threshold`。**AIMD 只作用於相對超支閾值**；未報價任務的 100k/200k 絕對基準（§6）與絕對線（500k/1h）不受 AIMD 調整。
5. **硬上限熔斷**：該任務核准預算的 2 倍。無條件停、落檔、報告。**無人值守時所有詢問的預設答案永遠是「暫停」**。恢復協議：決策請求寫進 pipeline-state.json `gate_requests[]`，使用者任一 session 白話回覆即可續跑。

## 8. 抽查機制 [通則]

- 抽查率（可調）：S 10%、M 25%、L 50%、XL 100%。
- **抽中與否在任務關帳時判定**（controller 寫 metrics 那一步），亂數源釘在 controller 之外：session 開始時 hook 預生成種子寫入 `.claude/devkit-local/spot-check.json`（controller 只讀不改）。判定公式（逐字執行，任何模型算出同一結果）：

```bash
# seed 取自 spot-check.json；item_id 為工作項 ID——命名固定 wi-YYYY-MM-DD-NN（當日序號、開工時即定），
# 關帳時不得重命名（改名＝挑骰向量；audit log 可回溯）；rate 為該等級抽查率
roll=$(( 0x$(printf '%s:%s' "$seed" "$item_id" | sha256sum | cut -c1-8) % 100 ))
# roll < rate → 抽中：spot_check.due 寫進 pipeline-state.json，本工作項進入待審
```

- **`pipeline-state.json` 的 `spot_check.due` 是唯一權威訊號**（本安裝沒有 stderr 輔助 hook；日後若加，仍以 due 為準）。controller 慣例：每次含 commit 的 Bash 之後，固定核對 due。
- 抽中的工作項：在下一個批次關卡呈給使用者審（審 spec 與驗收證據，不逐行 diff）。
- 抽查失敗判準＝發現任何會改變核准決定的問題（正確性、安全、超出範圍）；純格式瑕疵不算。
- 失敗後果（三件都做）：AIMD 重置 20%；該工作項回爐（標記未通過、回滾或重做，走驗證流程）；失敗案例記入教訓庫並觸發 postmortem。絕不讓沒過抽查的變更留在主線上。
- 誠實標註：本地環境 agent 對 hooks 有寫入權，此設計是降低誘因＋留審計痕跡，不是防篡改保證；append-only audit log（security-profiles.md）是必要配套。

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

## 11. 工作暫存慣例 [通則]

實驗腳本／中間輸出／一次性草稿不得散落專案源碼：優先用 harness scratchpad（本環境 `/tmp/claude-1000/...-leo-beam-sim/<session>/scratchpad`）；跨 session 要留的用 `.claude/scratch/`（gitignored）。關帳時清空（鐵律 6）。既有慣例補充：本 repo 的拋棄式探針腳本命名 `scripts/_*.ts`（gitignore 未涵蓋、靠命名慣例辨識）——新增探針沿用此慣例並在關帳時刪除；歷史遺留的 `scripts/_*` 與 `.githooks/` 未追蹤檔不是本系統轄區，未經使用者指示不得清理。
