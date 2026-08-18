工作分類：non-heavy presentation implementation，留在目前環境。

你負責重建 C-120 Part C P081-P097。唯一 ownership：
`courseware/c120-lora-leo-deck/alt-skill-deck/part-c-v2-p081-p097/**` 與完成後的
`courseware/c120-lora-leo-deck/alt-skill-deck/latest/LoRaEnergySim-LEO-ALT-PART-C-V2-P081-P097-REVIEW.pptx`。
你不是唯一在 codebase 工作的 agent，不得回退其他 lane。

完整閱讀 handoff、`pptx-wrap`/`pptx` SKILL.md、`teaching-rewrite/part-c-visible-content.md`、
`part-c-teaching-readability-audit.md`、`experiment-operation-contract.md`、`field-explanation-contract.md`、
`alt-skill-deck/shared/APPROVED-8-SLIDE-STYLE.md`、`alt-skill-deck/shared/LAB-EXPLANATION-ACCEPTANCE.md`。
唯一 visual donor 是 `latest/LoRaEnergySim-LEO-ALT-PART-A-V2-P001-P008-REVIEW.pptx`。

重建整段為相同疏密與視覺骨架，不是只修 OOXML。網站頁面使用 current clean crops；沒有 current evidence
就標示待補，不仿造畫面/KPI。每頁只解釋少數欄位，先 service、delivery，再 endpoint J、bit/J，並說明網站
讀取/寫入/保持不變的狀態。exact template/layout2/footer/title28/body>=16/字型/notes/禁詞/claim boundary 全部保留。
若引用 `student_policy.py`，只能顯示 read-only 中文註解鏡像，不得暗示網站會上傳或執行該程式；網站只匯入
配對的 result/replay evidence。
WIP PPTX 只放 `/tmp/c120-style-c081-p097/`；逐頁 render 與 validator/qa_v2_deck 通過後才發布固定檔名到
`latest/`。不要 commit、不要 push。
