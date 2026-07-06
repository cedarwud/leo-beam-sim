# 接班模型行為事實 — Claude 系（含出處版本）

> 用途：制度與派工對準**文件化行為**而非想像。模型換代時照 [maintenance-protocol.md](./maintenance-protocol.md) §3.6 重驗本檔。
> 出處：Anthropic 官方 prompting 指南，2026-07-06 由安裝 session 全文閱讀——`prompting-claude-fable-5`、`prompting-claude-opus-4-8`、`prompting-claude-sonnet-5`、`claude-prompting-best-practices`（platform.claude.com docs）＋ effort 參數頁（同日 WebFetch，筆記存安裝 session scratchpad）。標【推斷】者非官方原文。

## 跨模型通用（設計制度時的地基）

1. **字面執行**：不會把指令從一個情況默默推廣到另一個。規則必須寫明適用範圍與例外（「Apply this formatting to every section, not just the first one」層級的明確度）。
2. **嚴格守質化門檻 → 漏報**：審查 prompt 說「只報重要的」，模型會調查一樣深但少報。對策＝兩段式：找的階段要求全報（附信心＋嚴重度），篩選交給獨立步驟。
3. **原生回報進度**：長 agentic 任務會自發給高品質進度更新——不要再加「每 3 個 tool call 總結一次」類鷹架，反而劣化。
4. **prefill 已死**：4.6 起最後一則 assistant 預填回 400。格式控制改用直接指令／XML／structured outputs。
5. **平行 tool call 原生**：獨立呼叫會自動並行；派工模板不必教。
6. **狀態外部化偏好**：結構化資料用 JSON、進度筆記用自由文字、git 當狀態追蹤——與本系統狀態檔設計一致。
7. **effort 是行為訊號不是 token 預算**；`high`＝省略時的預設。值域 low/medium/high/xhigh/max；xhigh 支援 Fable 5／Mythos 5／Opus 4.8／4.7／Sonnet 5，max 另含 Opus 4.6／Sonnet 4.6 系。

## Fable 5（本安裝執筆者；使用者目前的預設模型）

- 長回合預設：hard task 單回合可跑很久；防過度規劃句式＝「有足夠資訊就動手，不重推已確立事實」。
- **進度宣稱要對 tool 結果審計**：官方句式（「Before reporting progress, audit each claim against a tool result」）近乎消除虛報——已融入判斷 rubric §2。
- **不要要求轉錄推理**：要求 echo/transcribe 內部推理會觸發 `reasoning_extraction` 拒絕——模板與制度檔禁用「show your thinking」類指令（藍圖 §11 既有規定，此為機理）。
- 平行 subagent 派發可靠；長壽 subagent 沿用 context 省時省錢。
- 偶發早停（回合尾只剩承諾沒有 tool call）：對策＝自主運轉提醒句（「檢查最後一段，若是承諾就現在做完」）。
- 罕見 context 預算焦慮：harness 顯示剩餘 token 時可能提前收尾——CLAUDE.md 安心語反制。
- adaptive thinking 恆開、不可 disabled；skills 若對舊模型寫得過度規範，在 Fable 上反而劣化（遷移時審視刪減）。

## Opus 4.8（接班主力候選①）

- **effort 是第一槓桿**，比任何前代 Opus 都重要：coding／agentic 起手 xhigh；max 有過度思考風險、報酬遞減，測過再用。
- 低檔嚴格縮限範圍：low/medium 跑複雜任務會淺推理——升 effort，不要用 prompt 繞。
- **傾向少用工具、多用推理**；升 effort 顯著增加工具使用。knowledge work 尤甚。
- **預設少派 subagent**：要平行派工得明確指示（何時該派、何時不該）——調度守則的強制派工觸發器即為此設計。
- thinking 預設關（需 `thinking:{type:"adaptive"}`）【API 行為；Claude Code harness 下由 harness 決定】。
- 互動式 session 比單發自主任務耗更多 token（每個 user turn 後重推理）——批次關卡、減少往返正好對症。

## Sonnet 5（接班主力候選②；理解測試基準模型）

- effort 預設 high；最難 coding/agentic 用 xhigh。跨代對映：Sonnet 5 @ medium ≈ Sonnet 4.6 @ high。
- adaptive thinking **預設開**（與 4.6 相反）；`temperature`/`top_p`/`top_k` 非預設值回 400。
- 比 4.6 更主動用工具、跑自驗迴圈；thinking 關掉會降低工具觸發。
- **新 tokenizer 同文多 ~30% token**：max_tokens 與預算估算要留 headroom（metrics 單價學習會自然吸收）。
- **有官方記載的 context awareness**（追蹤自己剩餘 context）→ 會想在 context 將盡時提前收尾。反制＝CLAUDE.md 安心語（「context 會自動壓縮，不要提前收尾」）。

## Haiku 4.5（僅限輕量子任務）

- 有官方記載的 context awareness（同上反制適用）。
- 本系統用途上限：理解測試複述、格式檢查、機械 checklist 核對（調度守則 §3）。不當實作主力、不當審查主力。【系統設計決策，非官方限制】

## 對制度檔寫作的直接含義（給未來修訂者）

- 門檻操作化：「會造成行為錯誤、測試失敗或誤導結果的都要報」，不寫「報重要的」。
- 正例優於禁令；每條規則附適用範圍。
- 範圍點名：適用所有情況就寫「所有」，只適用某 lane 就點名——字面派不會自己推廣。
- 長材料放前、指令放後；XML 區隔；範例 3–5 個且多樣。
