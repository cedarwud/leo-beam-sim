工作分類：non-heavy presentation implementation，留在目前環境。

你負責重建 C-120 Part B P028-P045。你不是唯一在 codebase 工作的 agent；唯一 ownership 是
`courseware/c120-lora-leo-deck/alt-skill-deck/part-b-v2-p028-p045/**` 與完成後的
`courseware/c120-lora-leo-deck/alt-skill-deck/latest/LoRaEnergySim-LEO-ALT-PART-B-V2-P028-P045-REVIEW.pptx`。
不要回退或修改其他 lane。

開始前完整閱讀：

- `courseware/c120-lora-leo-deck/ALT-SKILL-AUTHORING-HANDOFF.md`
- `/home/u24/.codex/skills/pptx-wrap/SKILL.md`
- `/home/u24/.codex/skills/pptx/SKILL.md`
- `courseware/c120-lora-leo-deck/teaching-rewrite/part-b-visible-content.md`
- `courseware/c120-lora-leo-deck/teaching-rewrite/part-b-field-audit.md`
- `courseware/c120-lora-leo-deck/teaching-rewrite/experiment-operation-contract.md`
- `courseware/c120-lora-leo-deck/alt-skill-deck/shared/APPROVED-8-SLIDE-STYLE.md`
- `courseware/c120-lora-leo-deck/alt-skill-deck/shared/LAB-EXPLANATION-ACCEPTANCE.md`

唯一 visual donor 是
`courseware/c120-lora-leo-deck/alt-skill-deck/latest/LoRaEnergySim-LEO-ALT-PART-A-V2-P001-P008-REVIEW.pptx`。
必須逐頁仿照其疏密、2-4 張大卡、短因果句、底部欄位帶與留白。不要只修碰撞；重建文字牆頁。
每個實驗要先說為何做、改哪個 exact block、原碼含義、before/after、exact command、結果欄位與 causal explanation。
實際 `student_policy.py` 不增加教學註解；使用 slides 中的 read-only 中文註解鏡像。先以白話說明整個
`choose_action()` 判斷順序，再在 Lab A before/after 頁逐行解釋 active block，明示其他行與檔案不變。
使用 exact educate.pptx、只用 source slide2/slideLayout2、保留背景/footer、title28、body 優先24且不得低於16、正確中英字型、native editable Office Math、正式 notes、禁詞與 claim boundary。
WIP PPTX 只能放 `/tmp/c120-style-b028-p045/`；逐頁 render 與 validator/qa_v2_deck 通過後，才以固定檔名發布到 `latest/`，覆寫舊檔，不保留副本。不要 commit、不要 push。
