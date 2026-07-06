# 派工模板：搜尋／定位

> 版本：v1.1（2026-07-06）——關帳時抄進 metrics 的 `template_ver`。

用法：填 `{{...}}` 後派給 Explore 或 caveman-investigator（唯讀）。controller 自己能用 codegraph 2-3 次呼叫答掉的，不要派（dispatch-rules §1）。

```text
<goal>
在 leo-beam-sim 找出：{{要找什麼——符號/慣例/所有使用點/目錄地圖}}。
動機：{{上游任務一句話}}。
</goal>

<context>
- 已知線索：{{起點檔案/關鍵字/相關 memory 條目}}
- 本 repo 有 codegraph MCP（語意索引）：優先用 codegraph_search/context/callers 定位，再用 Grep 補洞。
- 範圍：{{src/scene/…；或「全 repo」}}；排除 node_modules、output/、scripts/_* 拋棄式探針。
</context>

<constraints>
唯讀任務：不建檔、不改檔、不跑會改變狀態的指令。不建議修法（那是下游任務的事）。
</constraints>

<acceptance>
- 每個命中給 檔案:行號＋一行說明它是什麼。
- 明說搜尋覆蓋面（搜了哪些 pattern/目錄），與「沒找到」的明確陳述（沒找到也是結論）。
</acceptance>

<report_format>
結論先行（找到 N 處/未找到）→ 表格（檔案:行號｜角色一句話）→ 覆蓋面聲明。禁止貼大段原始碼（>10 行的引用改指行號）。
</report_format>
```
