# P064–P071 teaching-readability checkpoint audit

此表記錄每頁的主要視覺、新英文欄位、中文定義、來源／值型態、操作作用與判讀。

| 頁面 | 主要視覺與新欄位 | 中文／來源 | 值型態／單位 | 操作作用 | 判讀 |
|---:|---|---|---|---|---|
| 64 | 時序圖：資料等待 → 急件 → 送出 → 服務判定 | queue 佇列／deadline 完成期限／endpoint energy 端點能量 | queue：工作項數；deadline：剩餘時間；energy：J | 來源為 Lab C service window；描述 action 造成的事件順序 | 服務與期限通過後，才比較送達資料與端點 J |
| 65 | marked code 與五段 branch callout | BATCH_SIZE 批次大小／URGENT_MARGIN_S 急件門檻／SEND_URGENT 急件送出／WAIT 等待 | BATCH_SIZE=3；URGENT_MARGIN_S=20 秒；action 為列舉值 | 來源為 student_policy.py；依判斷順序返回 action | 窗口與 urgent 條件成立時，後面的 pacing／batch 分支不接手 |
| 66 | 兩條命令與檔案收據流程 | baseline 原始 control／candidate 修改後案例／result.json 結果檔／replay 事件重播 | case 為文字標籤；result_path 為檔案路徑；replay 為事件序列 | 來源為 terminal runner；產生配對 result 與 replay 供匯入及判讀 | 收據只定位 artifact；下一階段以 service、deadline 與事件讀取結果 |
| 67 | before／after code 與門檻刻度 | URGENT_MARGIN_S 急件剩餘秒數門檻／urgent_due_in_s 剩餘秒數／SEND_URGENT 急件送出 | 20 秒 → 5 秒；條件為 urgent_due_in_s ≤ 門檻 | 來源為 student_policy.py marked line；決定 urgent branch 觸發時點 | 5 秒使觸發更接近期限，送達與 service 結果待 run 證據判定 |
| 68 | 四列 prediction-to-evidence map | action timing 動作時點／queue packet 佇列封包／service deadline 服務期限／endpoint J 端點能量 | event trace；queue/count 與 bit；PASS/FAIL；J | 來源為 result、replay、state ledger；把預測連到可觀察欄位 | 任何 gate 失敗都改變『只是節能』的判讀 |
| 69 | 帶中文欄名的 baseline／candidate ledger | service 服務結果／deadline 期限結果／delivered bits 已送達位元／endpoint J 端點能量／bit/J 能量效率 | PASS/FAIL；PASS/FAIL；bit；J；bit/J | 來源為同情境 deterministic fallback；固定 scenario 與 energy scope | candidate 效率較高但兩個 gate FAIL；gate 狀態保留為主判讀 |
| 70 | 修訂前後門檻與 action timing | revision 修訂 policy／deadline 完成期限／delivery 送達資料／endpoint J 端點能量 | 5 秒 → 30 秒；deadline PASS/FAIL；bit；J | 來源為 marked line 與第二輪 run；只改門檻，保留其他 block | 較早 urgent action 可能增加 J；是否保住 deadline 由第二輪結果決定 |
| 71 | margin 30 的 prediction chain | freeze policy 凍結 policy／required packet 必要封包／state ledger 狀態帳／service gate 服務閘門 | policy bytes 不變；bit；事件列；PASS/FAIL | 來源為 revision receipt、result、replay 與 ledger；固定條件下比較 | deadline PASS 且 J 上升呈現服務／能量取捨；單一效率值不取代 gate |
