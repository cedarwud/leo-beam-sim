工作分類：non-heavy presentation implementation，留在目前環境。

你負責重建 C-120 Part B P046-P063。你不是唯一在 codebase 工作的 agent；唯一 ownership 是
`courseware/c120-lora-leo-deck/alt-skill-deck/part-b-v2-p046-p063/**` 與完成後的
`courseware/c120-lora-leo-deck/alt-skill-deck/latest/LoRaEnergySim-LEO-ALT-PART-B-V2-P046-P063-REVIEW.pptx`。
不要回退或修改其他 lane。

完整閱讀 handoff、`pptx-wrap` 與 `pptx` SKILL.md、`teaching-rewrite/part-b-visible-content.md`、
`part-b-field-audit.md`、`experiment-operation-contract.md`、`field-explanation-contract.md`，以及
`alt-skill-deck/shared/APPROVED-8-SLIDE-STYLE.md`、`alt-skill-deck/shared/LAB-EXPLANATION-ACCEPTANCE.md`。

唯一 visual donor 是 `latest/LoRaEnergySim-LEO-ALT-PART-A-V2-P001-P008-REVIEW.pptx`。
逐頁採相同疏密、2-4 大卡、短因果句、底部欄位帶與留白。Lab B 必須清楚呈現 baseline、為何改、
exact file/block、before/after、執行命令、result/replay 欄位與修改後 causal interpretation；不得形成欄位牆。
實際 `student_policy.py` 不增加教學註解；slides 必須用 read-only 中文註解鏡像逐行解釋 Lab B 的
`ENTER_QUALITY`、`EXIT_QUALITY` 與 `STABLE_STEPS`，並明示 A frozen block、其他行與其他檔案保持不變。
使用 exact educate.pptx、只用 source slide2/slideLayout2、保留背景/footer、title28、body 優先24且>=16、
正確中英字型、native editable Office Math、正式 notes、禁詞與 claim boundary。
WIP PPTX 只放 `/tmp/c120-style-b046-p063/`；全部逐頁 render 並跑 validator/qa_v2_deck 後才以固定檔名發布
到 `latest/`，覆寫同範圍舊檔。不要 commit、不要 push。
