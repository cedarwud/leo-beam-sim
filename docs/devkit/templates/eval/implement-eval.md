# eval：implement 模板

## 樣本情境
「Jain 指標改為 live 讀 manifest 值（intent.md 條目 2）」；相關檔案：`src/showcase/` 下 manifest 載入處＋顯示該值的 UI 檔；對口 validator `validate:modqn:coverage-fairness`。

## 結構斷言
- [ ] 含前端讓路條款（scene/viz/ui/app → STOP／改走 frontend-change-contract）——樣本情境本身觸 UI，填模板的人必須能從模板文字看出該讓路
- [ ] 含樹級 git 操作禁令（stash/checkout/reset 字樣）
- [ ] 含「不裝新依賴→STOP 硬關卡」
- [ ] acceptance 含 tsc、對口 validator、validate:governance 三層
- [ ] 含「宣稱不得超出 tool 結果」「沒跑的明說沒跑」

## 模範回報性質
- 每條 acceptance 有對應指令輸出摘要；缺一條就標「未驗證」
- 改動清單到檔案:行號級；「發現」與「順手改」分開（後者不存在）
