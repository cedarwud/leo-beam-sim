P064｜Lab C：急件應提前多久送出？
本頁建立 Lab C 的問題：批次等待可以減少傳送啟動，但有期限的急件不能無限期等待。後續只改動 `student_policy.py` 的 `lab-c-batch-urgent` 區塊；服務結果先於端點 J 解讀。`queue age` 是等待秒數，`deadline` 是完成期限，`endpoint J` 只描述宣告的端點範圍。

P065A｜定位唯一可編輯區塊：檔案、標記、目標值
先在 package 根目錄定位 `/home/u24/lora-energy-lab/student_policy.py`，再搜尋 `LORA EDITABLE: lab-c-batch-urgent`。本頁只確認檔案、標記與目標常數，不執行、不改值。`BATCH_SIZE = 3` 是固定批次門檻；本 Lab 唯一可改的是 `URGENT_MARGIN_S`。Lab A／B 區塊、runner、scenario、schema 與能量模型保持原樣。

P065B｜基準原始值：20 秒代表什麼？
原始檔案中的 `URGENT_MARGIN_S = 20` 表示：當仍有緊急封包，且最接近期限的剩餘時間小於或等於 20 秒，急件分支才回傳 `SEND_URGENT`。急件分支排在 pacing 與批次之前；窗口關閉時更前面的判斷仍會回傳 `SLEEP`。這頁只讀原始值，尚未修改。

P066｜第一輪操作：基準 20，再執行候選 5
先在未修改的 policy 上執行 baseline，保存 stdout 印出的 `result_path`。完成下一頁的單一修改與預測記錄後，再以同一個 package 根目錄執行 candidate。兩次都保留同一 run 目錄內配對的 `result.json` 與 `endpoint-replay.json`；不猜檔名。Linux／macOS 終端機與 WSL 使用 Linux 指令，Windows PowerShell／Command Prompt 使用 `course.cmd`。

P067｜第一次修改：只把 20 改成 5
只在 `/home/u24/lora-energy-lab/student_policy.py` 的 `lab-c-batch-urgent` marked block，把 `URGENT_MARGIN_S` 從 20 改成 5。5 表示剩餘時間更接近期限時才走 `SEND_URGENT`，所以急件介入可能較晚。`BATCH_SIZE = 3`、Lab A／B frozen blocks、runner、scenario、schema、其他常數、函式與檔案均保持原樣；本頁不放執行命令。

P068｜候選執行前：先鎖定可反駁預測
候選預測寫入 workbook：把門檻從 20 改成 5，急件 override 可能較晚觸發，早期 `WAKE`／`TX` 可能減少，但封包可能更接近期限甚至失去交付。驗證順序固定為 `service`、`deadline`、packet delivery／expiry、state ledger，最後才讀 `endpoint J` 與 bit/J。任一服務門檻失敗，都不能只用低 J 宣稱成功。

P069｜候選結果怎麼讀：先匯入，再判服務
candidate 命令完成後，將 stdout 的 `result_path` 指向的 `result.json` 與同一 run 目錄的 `endpoint-replay.json` 一起保存。匯入後先讀 `service_pass` 與 `deadline_pass`，再讀 `delivered_packets`／`expired_packets`，最後回到 replay 的 state event 與 `endpoint_energy_j`。目前結果為 baseline 4/4、expired 0、10.66 J；candidate 3/4、expired 1、9.74 J。candidate 少 0.92 J 但兩個 gate 都 FAIL。

P070｜第二次修改：只把 5 改成 30
保留 candidate 5 的結果後，只在同一個 marked block 把 `URGENT_MARGIN_S` 從 5 改成 30。30 表示期限尚有較多餘裕時就可回傳 `SEND_URGENT`，所以 action 可能較早，可能增加 `WAKE`／`TX`，也可能保住期限。`BATCH_SIZE = 3`、Lab A／B frozen blocks、runner、scenario、schema 與其他檔案都不變；本頁不放執行命令。

P071｜修訂執行前：把較早介入寫成取捨預測
修訂預測寫入 workbook：把門檻從 5 改成 30，急件 action 可能較早，端點能量可能上升，但 required packet 可能在期限前完成。判讀必須同時對照 delivery、deadline、state ledger、retry／expiry 與 endpoint J。若固定 primary case 中 20 與 30 都在同一決策時點觸發，兩者結果可能相同；這是條件造成的 null contrast，不是模型失效。

P072｜第二輪操作：revision 30 freeze，再跑 surprise
先執行 revision 30 並建立 freeze receipt，再以完全相同的 policy bytes 執行 surprise withheld。兩個命令都以 stdout 新印出的 `result_path` 為準，並保存同一 run 目錄的 `result.json` 與 `endpoint-replay.json`。surprise 不新增 edit、不重新調參；它只檢查 frozen policy 在新 service condition 下的 claim boundary。

P073｜20／5／30：沿同一條時間線讀三筆結果
三筆結果共用相同 primary scenario 與 endpoint boundary。baseline 20 為 service／deadline true／true、delivered 4／4、expired 0、endpoint 10.66 J；candidate 5 為 false／false、delivered 3／4、expired 1、endpoint 9.74 J；revision 30 回到 true／true、4／4、expired 0、10.66 J。固定 primary case 在決策時剩 10 秒，因此 20 與 30 都觸發急件，兩者可能是 null contrast；不能把相同結果解讀成 30 永遠最佳。

P074｜Surprise：沿用 30，保留失敗邊界
surprise 沿用 frozen margin 30 policy，不建立第三次 edit。目前結果為 service false、deadline false、delivered 1／4、retries 3、collisions 2、expired 3、endpoint 5.41 J。低 J 不能覆蓋服務失敗；這筆 record 的用途是界定 margin 30 的適用範圍，並保留 result／replay provenance。

P075｜Lab C 結語：服務與期限先於端點 J
Lab C 支持的結論是：urgent margin 會改變 deadline／energy trade-off，效果依 service condition 而定。candidate 5 在參考情境少用 endpoint J 卻失去兩個 gate；revision 30 在固定 primary case 恢復 gate，但 surprise 顯示新窗口條件仍可能失敗。這個結論停留在宣告的 endpoint evidence layer，不延伸成全系統或所有窗口的保證。

P076｜網站責任：匯入、重播、保存比較
本機 runner 讀取 `student_policy.py` 並產生 `result.json` 與配對 `endpoint-replay.json`；網站只接受已產生的 JSON artifact。網站驗證 schema、identity、units、policy lineage 與 provenance，再 materialize replay 並保存 workbook 比較；網站不執行本機 Python。匯入時選 stdout 指出的 `result.json`，不是 policy source。

P077｜匯入檢查：identity、units、事件逐層驗證
匯入先檢查 JSON／schema、scenario identity、runner provenance、lab／case／seed、policy lineage、units／energy sum、event legality 與 claim boundary，通過後才 materialize replay。任一層失敗時，既有 session 與 workbook 維持原狀；保留錯誤與原始 path，修正來源後重新匯入。

P078｜事件重播：佇列 → 動作 → 狀態 → 封包 → J
REPLAY 讀取已驗證的 `endpoint-replay.json` event ledger，不重新執行 policy，也不在瀏覽器推導新的科學數值。沿同一 frame 讀 `Queue`、`Action`、`Radio`／state、packet delivery／expiry 與累積 endpoint J，才能把程式分支對回服務結果。較低 J 若沒有 delivery 與 service 欄位，不能完成 Lab C 判讀。

P079｜Workbook：保存四個角色的來源鏈
WORKBOOK 保存 baseline、candidate、revision 與 surprise 的 prediction、changed line、result_path、配對 replay、service／deadline、endpoint scope、recovery note 與 claim boundary。surprise 即使 FAIL 也保留原 record；必要 evidence 缺少時狀態維持 INCOMPLETE，不能用另一筆結果補寫。

P080｜保存與重開：核對身份，不補造結果
保存 workbook 後關閉頁面，再重新開啟並核對 scenario、anchor、policy／predecessor identity、endpoint scope、prediction、result 與 replay。重開只重新驗證身份與完成度，不執行 `student_policy.py`，也不把失敗 surprise 改寫為成功。缺件時維持 INCOMPLETE，沿 matching artifact 或 release backup recovery。
