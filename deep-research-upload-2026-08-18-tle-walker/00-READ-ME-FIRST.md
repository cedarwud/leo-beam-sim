# TLE × Walker-like 展示可行性 Deep Research 上傳包

用途：交給 Web GPT Deep Research，研究如何在每顆衛星均使用真實 TLE／SGP4 軌跡的前提下，取得 Walker 類展示所需的多換手、SINR 差值、高仰角與流暢敘事。

## 上傳方式

1. 上傳本資料夾中的 01-DEEP-RESEARCH-PROMPT.md。
2. 同時上傳 sources/ 內全部六份文件。
3. 將 01-DEEP-RESEARCH-PROMPT.md 的全文貼入 Deep Research 對話後開始研究。

## Authority 順序

1. ADR-005：archived TLE、SGP4 與 canonical frame。
2. ADR-006：cross-satellite handover trace。
3. ADR-009：單一 Visual Lab runtime 與 presentation boundary。
4. ADR-010：pass index、共同 UTC 與 synthetic time-offset 限制。
5. ADR-011：beam layouts、Beam Hopping 與 same-satellite beam switch。
6. MULTIBEAM-LEO-ENERGY-VISUAL-LAB-SDD：目前已實作產品 checkpoint 與教學 replay。

## 重要提醒

- sources/ 是目前工作樹文件的唯讀副本，可能包含尚未 commit 的最新內容。
- 不要另外上傳舊 handoff；它早於 ADR-009／010／011，可能造成 authority 混淆。
- 這個研究任務只做方案調查與決策建議，不授權修改程式或科學公式。

