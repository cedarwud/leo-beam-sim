P064｜Lab C：資料等待、期限與耗能的取捨
Lab C 以同一個服務窗口串起佇列、批次、急件、完成期限與端點能量。判讀順序由工作是否完成、期限是否通過、送達資料與端點 J 組成。

說法：先指出 lora-energy-lab/student_policy.py、# === LORA EDITABLE: lab-c-batch-urgent ===、BATCH_SIZE = 3、URGENT_MARGIN_S 的當前值與完整 END marker；marker 外 consumer branch 逐字讀出 if observation.urgent_pending and observation.urgent_due_in_s <= URGENT_MARGIN_S:，下一行是 return SEND_URGENT。操作：只改 marked block 內的 URGENT_MARGIN_S 一行，先保存 distinct backup，再以兩種平台命令編輯與 py_compile。預期：py_compile 只回報語法可解析；run 才產生 status、run_id、result_path、artifact_source、claim_boundary 與 endpoint-replay.json。解讀：margin 越大越早進入急件分支，可能增加 endpoint J；service、deadline、action、state、delivery 與 endpoint J 必須一起判讀。復原：命令錯誤、identity 不符或 replay 缺失時保留原 artifact 與原狀態，不把空白資料補成結果。轉場：下一頁沿相同 artifact 讀取欄位，確認唯一改動是否真的改變 action timing 與服務期限。

P065｜原始程式：完整 marked block
原始 student_policy.py 顯示完整 marked block、BATCH_SIZE = 3、URGENT_MARGIN_S = 20 與 marker 外分支入口。這頁只保留 code，避免 branch 卡片遮住 end marker。

說法：先指出 lora-energy-lab/student_policy.py、# === LORA EDITABLE: lab-c-batch-urgent ===、BATCH_SIZE = 3、URGENT_MARGIN_S 的當前值與完整 END marker；marker 外 consumer branch 逐字讀出 if observation.urgent_pending and observation.urgent_due_in_s <= URGENT_MARGIN_S:，下一行是 return SEND_URGENT。操作：只改 marked block 內的 URGENT_MARGIN_S 一行，先保存 distinct backup，再以兩種平台命令編輯與 py_compile。預期：py_compile 只回報語法可解析；run 才產生 status、run_id、result_path、artifact_source、claim_boundary 與 endpoint-replay.json。解讀：margin 越大越早進入急件分支，可能增加 endpoint J；service、deadline、action、state、delivery 與 endpoint J 必須一起判讀。復原：命令錯誤、identity 不符或 replay 缺失時保留原 artifact 與原狀態，不把空白資料補成結果。轉場：下一頁沿相同 artifact 讀取欄位，確認唯一改動是否真的改變 action timing 與服務期限。

P065-B｜原始程式：marker 外 consumer branch 與後續分支
consumer branch 位於 marked block 外，逐字保留 observation.urgent_pending、observation.urgent_due_in_s 與 SEND_URGENT。窗口、pacing、batch、WAIT 只在 urgent 條件不成立時判讀。

說法：先指出 lora-energy-lab/student_policy.py、# === LORA EDITABLE: lab-c-batch-urgent ===、BATCH_SIZE = 3、URGENT_MARGIN_S 的當前值與完整 END marker；marker 外 consumer branch 逐字讀出 if observation.urgent_pending and observation.urgent_due_in_s <= URGENT_MARGIN_S:，下一行是 return SEND_URGENT。操作：只改 marked block 內的 URGENT_MARGIN_S 一行，先保存 distinct backup，再以兩種平台命令編輯與 py_compile。預期：py_compile 只回報語法可解析；run 才產生 status、run_id、result_path、artifact_source、claim_boundary 與 endpoint-replay.json。解讀：margin 越大越早進入急件分支，可能增加 endpoint J；service、deadline、action、state、delivery 與 endpoint J 必須一起判讀。復原：命令錯誤、identity 不符或 replay 缺失時保留原 artifact 與原狀態，不把空白資料補成結果。轉場：下一頁沿相同 artifact 讀取欄位，確認唯一改動是否真的改變 action timing 與服務期限。

P066｜第一輪 run：baseline 與 candidate 的檔案收據
baseline 使用原始 policy 建立比較 control，candidate 使用 margin 5 的 policy 產生第二筆 result。每條命令都關聯 result.json、事件 replay 與下一階段的判讀位置。

說法：先指出 lora-energy-lab/student_policy.py、# === LORA EDITABLE: lab-c-batch-urgent ===、BATCH_SIZE = 3、URGENT_MARGIN_S 的當前值與完整 END marker；marker 外 consumer branch 逐字讀出 if observation.urgent_pending and observation.urgent_due_in_s <= URGENT_MARGIN_S:，下一行是 return SEND_URGENT。操作：只改 marked block 內的 URGENT_MARGIN_S 一行，先保存 distinct backup，再以兩種平台命令編輯與 py_compile。預期：py_compile 只回報語法可解析；run 才產生 status、run_id、result_path、artifact_source、claim_boundary 與 endpoint-replay.json。解讀：margin 越大越早進入急件分支，可能增加 endpoint J；service、deadline、action、state、delivery 與 endpoint J 必須一起判讀。復原：命令錯誤、identity 不符或 replay 缺失時保留原 artifact 與原狀態，不把空白資料補成結果。轉場：下一頁沿相同 artifact 讀取欄位，確認唯一改動是否真的改變 action timing 與服務期限。baseline｜Windows PowerShell：.\course.cmd run --lab C --case baseline
baseline｜WSL/POSIX：bash course.sh run --lab C --case baseline
candidate｜Windows PowerShell：.\course.cmd run --lab C --case candidate
candidate｜WSL/POSIX：bash course.sh run --lab C --case candidate
讀 stdout 的 status、run_id、result_path、artifact_source、claim_boundary，再以相同 run_id 配對 endpoint-replay.json，接著讀 service、deadline、action、state、endpoint J。

P067｜exact edit 1：急件門檻由 20 秒改為 5 秒
URGENT_MARGIN_S 定義急件距離期限的剩餘秒數門檻；唯一修改由 20 改為 5。修改前後的完整句、具體問題、action timing 與 service 欄位形成同一條因果鏈。

說法：先指出 lora-energy-lab/student_policy.py、# === LORA EDITABLE: lab-c-batch-urgent ===、BATCH_SIZE = 3、URGENT_MARGIN_S 的當前值與完整 END marker；marker 外 consumer branch 逐字讀出 if observation.urgent_pending and observation.urgent_due_in_s <= URGENT_MARGIN_S:，下一行是 return SEND_URGENT。操作：只改 marked block 內的 URGENT_MARGIN_S 一行，先保存 distinct backup，再以兩種平台命令編輯與 py_compile。預期：py_compile 只回報語法可解析；run 才產生 status、run_id、result_path、artifact_source、claim_boundary 與 endpoint-replay.json。解讀：margin 越大越早進入急件分支，可能增加 endpoint J；service、deadline、action、state、delivery 與 endpoint J 必須一起判讀。復原：命令錯誤、identity 不符或 replay 缺失時保留原 artifact 與原狀態，不把空白資料補成結果。轉場：下一頁沿相同 artifact 讀取欄位，確認唯一改動是否真的改變 action timing 與服務期限。before：marked block 為 BATCH_SIZE = 3、URGENT_MARGIN_S = 20；after：只改成 URGENT_MARGIN_S = 5；完整 END marker 是 # === LORA END EDITABLE: lab-c-batch-urgent ===。備份／編輯／編譯：cp student_policy.py student_policy.before-C-edit.py；nano student_policy.py；.venv/bin/python -m py_compile student_policy.py；Windows：Copy-Item student_policy.py -Destination student_policy.before-C-edit.py；notepad .\student_policy.py；.\.venv\Scripts\python.exe -m py_compile student_policy.py。

P067-B｜exact edit 1：備份、編輯與語法檢查
在 lora-energy-lab/ 根目錄保存 before-C-edit 備份，分列 WSL／POSIX 與 Windows PowerShell 的編輯及 py_compile 命令。py_compile 只檢查語法，run、policy guard、result_path 與 endpoint-replay.json 才驗證行為。

說法：先指出 lora-energy-lab/student_policy.py、# === LORA EDITABLE: lab-c-batch-urgent ===、BATCH_SIZE = 3、URGENT_MARGIN_S 的當前值與完整 END marker；marker 外 consumer branch 逐字讀出 if observation.urgent_pending and observation.urgent_due_in_s <= URGENT_MARGIN_S:，下一行是 return SEND_URGENT。操作：只改 marked block 內的 URGENT_MARGIN_S 一行，先保存 distinct backup，再以兩種平台命令編輯與 py_compile。預期：py_compile 只回報語法可解析；run 才產生 status、run_id、result_path、artifact_source、claim_boundary 與 endpoint-replay.json。解讀：margin 越大越早進入急件分支，可能增加 endpoint J；service、deadline、action、state、delivery 與 endpoint J 必須一起判讀。復原：命令錯誤、identity 不符或 replay 缺失時保留原 artifact 與原狀態，不把空白資料補成結果。轉場：下一頁沿相同 artifact 讀取欄位，確認唯一改動是否真的改變 action timing 與服務期限。before：marked block 為 BATCH_SIZE = 3、URGENT_MARGIN_S = 20；after：只改成 URGENT_MARGIN_S = 5；完整 END marker 是 # === LORA END EDITABLE: lab-c-batch-urgent ===。備份／編輯／編譯：cp student_policy.py student_policy.before-C-edit.py；nano student_policy.py；.venv/bin/python -m py_compile student_policy.py；Windows：Copy-Item student_policy.py -Destination student_policy.before-C-edit.py；notepad .\student_policy.py；.\.venv\Scripts\python.exe -m py_compile student_policy.py。

P068｜margin 5：四個可觀察欄位的預測
margin 5 的預測連接 action 時點、佇列與封包、服務／期限以及端點 J。每個欄位都標出來源、值型態或單位、作用與 run 後判讀。

說法：先指出 lora-energy-lab/student_policy.py、# === LORA EDITABLE: lab-c-batch-urgent ===、BATCH_SIZE = 3、URGENT_MARGIN_S 的當前值與完整 END marker；marker 外 consumer branch 逐字讀出 if observation.urgent_pending and observation.urgent_due_in_s <= URGENT_MARGIN_S:，下一行是 return SEND_URGENT。操作：只改 marked block 內的 URGENT_MARGIN_S 一行，先保存 distinct backup，再以兩種平台命令編輯與 py_compile。預期：py_compile 只回報語法可解析；run 才產生 status、run_id、result_path、artifact_source、claim_boundary 與 endpoint-replay.json。解讀：margin 越大越早進入急件分支，可能增加 endpoint J；service、deadline、action、state、delivery 與 endpoint J 必須一起判讀。復原：命令錯誤、identity 不符或 replay 缺失時保留原 artifact 與原狀態，不把空白資料補成結果。轉場：下一頁沿相同 artifact 讀取欄位，確認唯一改動是否真的改變 action timing 與服務期限。

P069｜baseline 與 candidate：gate-first 的比較
兩筆 deterministic fallback 來自同一情境與固定 operation contract。服務、期限、送達資料、端點能量與效率都有中文欄名、單位、來源類型與判讀。

說法：先指出 lora-energy-lab/student_policy.py、# === LORA EDITABLE: lab-c-batch-urgent ===、BATCH_SIZE = 3、URGENT_MARGIN_S 的當前值與完整 END marker；marker 外 consumer branch 逐字讀出 if observation.urgent_pending and observation.urgent_due_in_s <= URGENT_MARGIN_S:，下一行是 return SEND_URGENT。操作：只改 marked block 內的 URGENT_MARGIN_S 一行，先保存 distinct backup，再以兩種平台命令編輯與 py_compile。預期：py_compile 只回報語法可解析；run 才產生 status、run_id、result_path、artifact_source、claim_boundary 與 endpoint-replay.json。解讀：margin 越大越早進入急件分支，可能增加 endpoint J；service、deadline、action、state、delivery 與 endpoint J 必須一起判讀。復原：命令錯誤、identity 不符或 replay 缺失時保留原 artifact 與原狀態，不把空白資料補成結果。轉場：下一頁沿相同 artifact 讀取欄位，確認唯一改動是否真的改變 action timing 與服務期限。

P070｜exact edit 2：急件門檻由 5 秒修訂為 30 秒
revision 將門檻由 5 改為 30，保留 candidate 的失敗紀錄並改變 urgent action 的觸發時點。修改前後的完整句與問題連接 deadline、送達資料與端點 J。

說法：先指出 lora-energy-lab/student_policy.py、# === LORA EDITABLE: lab-c-batch-urgent ===、BATCH_SIZE = 3、URGENT_MARGIN_S 的當前值與完整 END marker；marker 外 consumer branch 逐字讀出 if observation.urgent_pending and observation.urgent_due_in_s <= URGENT_MARGIN_S:，下一行是 return SEND_URGENT。操作：只改 marked block 內的 URGENT_MARGIN_S 一行，先保存 distinct backup，再以兩種平台命令編輯與 py_compile。預期：py_compile 只回報語法可解析；run 才產生 status、run_id、result_path、artifact_source、claim_boundary 與 endpoint-replay.json。解讀：margin 越大越早進入急件分支，可能增加 endpoint J；service、deadline、action、state、delivery 與 endpoint J 必須一起判讀。復原：命令錯誤、identity 不符或 replay 缺失時保留原 artifact 與原狀態，不把空白資料補成結果。轉場：下一頁沿相同 artifact 讀取欄位，確認唯一改動是否真的改變 action timing 與服務期限。before：URGENT_MARGIN_S = 5；revision after：只改成 URGENT_MARGIN_S = 30，BATCH_SIZE = 3 與兩個 marker 不變。 revision 備份／編輯／編譯：cp student_policy.py student_policy.before-C-revision.py；nano student_policy.py；.venv/bin/python -m py_compile student_policy.py；Windows：Copy-Item student_policy.py -Destination student_policy.before-C-revision.py；notepad .\student_policy.py；.\.venv\Scripts\python.exe -m py_compile student_policy.py。

P070-B｜exact edit 2：修訂備份、編輯與語法檢查
在 lora-energy-lab/ 根目錄保存 distinct before-C-revision 備份，分列 WSL／POSIX 與 Windows PowerShell 命令。py_compile 只檢查語法，revision freeze run、policy guard、result_path 與 endpoint-replay.json 驗證行為。

說法：先指出 lora-energy-lab/student_policy.py、# === LORA EDITABLE: lab-c-batch-urgent ===、BATCH_SIZE = 3、URGENT_MARGIN_S 的當前值與完整 END marker；marker 外 consumer branch 逐字讀出 if observation.urgent_pending and observation.urgent_due_in_s <= URGENT_MARGIN_S:，下一行是 return SEND_URGENT。操作：只改 marked block 內的 URGENT_MARGIN_S 一行，先保存 distinct backup，再以兩種平台命令編輯與 py_compile。預期：py_compile 只回報語法可解析；run 才產生 status、run_id、result_path、artifact_source、claim_boundary 與 endpoint-replay.json。解讀：margin 越大越早進入急件分支，可能增加 endpoint J；service、deadline、action、state、delivery 與 endpoint J 必須一起判讀。復原：命令錯誤、identity 不符或 replay 缺失時保留原 artifact 與原狀態，不把空白資料補成結果。轉場：下一頁沿相同 artifact 讀取欄位，確認唯一改動是否真的改變 action timing 與服務期限。before：URGENT_MARGIN_S = 5；revision after：只改成 URGENT_MARGIN_S = 30，BATCH_SIZE = 3 與兩個 marker 不變。 revision 備份／編輯／編譯：cp student_policy.py student_policy.before-C-revision.py；nano student_policy.py；.venv/bin/python -m py_compile student_policy.py；Windows：Copy-Item student_policy.py -Destination student_policy.before-C-revision.py；notepad .\student_policy.py；.\.venv\Scripts\python.exe -m py_compile student_policy.py。

P071｜margin 30：修訂後的受控預測
margin 30 的預測描述較早 urgent action、required packet、deadline 與端點能量的方向。結果判讀以 service、delivery、state ledger 與 endpoint J 的共同 evidence 定義。

說法：先指出 lora-energy-lab/student_policy.py、# === LORA EDITABLE: lab-c-batch-urgent ===、BATCH_SIZE = 3、URGENT_MARGIN_S 的當前值與完整 END marker；marker 外 consumer branch 逐字讀出 if observation.urgent_pending and observation.urgent_due_in_s <= URGENT_MARGIN_S:，下一行是 return SEND_URGENT。操作：只改 marked block 內的 URGENT_MARGIN_S 一行，先保存 distinct backup，再以兩種平台命令編輯與 py_compile。預期：py_compile 只回報語法可解析；run 才產生 status、run_id、result_path、artifact_source、claim_boundary 與 endpoint-replay.json。解讀：margin 越大越早進入急件分支，可能增加 endpoint J；service、deadline、action、state、delivery 與 endpoint J 必須一起判讀。復原：命令錯誤、identity 不符或 replay 缺失時保留原 artifact 與原狀態，不把空白資料補成結果。轉場：下一頁沿相同 artifact 讀取欄位，確認唯一改動是否真的改變 action timing 與服務期限。

P072｜第二輪 run：revision freeze 與 surprise
第二輪執行 revision 與 surprise；revision 的 policy bytes 維持固定，surprise 使用同一 policy 讀取新的 service condition。每個 result_path 與 replay 都保存為獨立 artifact。

說法：先指出 lora-energy-lab/student_policy.py、# === LORA EDITABLE: lab-c-batch-urgent ===、BATCH_SIZE = 3、URGENT_MARGIN_S 的當前值與完整 END marker；marker 外 consumer branch 逐字讀出 if observation.urgent_pending and observation.urgent_due_in_s <= URGENT_MARGIN_S:，下一行是 return SEND_URGENT。操作：只改 marked block 內的 URGENT_MARGIN_S 一行，先保存 distinct backup，再以兩種平台命令編輯與 py_compile。預期：py_compile 只回報語法可解析；run 才產生 status、run_id、result_path、artifact_source、claim_boundary 與 endpoint-replay.json。解讀：margin 越大越早進入急件分支，可能增加 endpoint J；service、deadline、action、state、delivery 與 endpoint J 必須一起判讀。復原：命令錯誤、identity 不符或 replay 缺失時保留原 artifact 與原狀態，不把空白資料補成結果。轉場：下一頁沿相同 artifact 讀取欄位，確認唯一改動是否真的改變 action timing 與服務期限。revision｜Windows PowerShell：.\course.cmd run --lab C --case revision --freeze
revision｜WSL/POSIX：bash course.sh run --lab C --case revision --freeze
surprise｜Windows PowerShell：.\course.cmd run --lab C --case surprise
surprise｜WSL/POSIX：bash course.sh run --lab C --case surprise
讀每筆 stdout 的 status、run_id、result_path、artifact_source、claim_boundary，配對 endpoint-replay.json 後再讀 service、deadline、action、state、endpoint J。

P073-A｜服務與期限結果：三筆案例的 gate
三筆 deterministic fallback 依 service、deadline、delivery 排列。這組 gate 結果提供策略判讀的條件，能量欄位放在下一頁。

說法：這是 2026-08-11 14:12 live capture，網址為 http://120.126.151.102:3000/course；目前沒有 accepted result.json，待匯入值維持空白，不能把列舉值說成 current result。欄位定位：依頁面標題與可見欄位逐一讀來源、值／單位、作用、成功變化與失敗不變項。操作：先讀左側 current crop，再按右側欄位或按鈕順序朗讀；每個欄位都說明來源、值／單位、作用、成功變化與失敗不變項。預期：畫面只呈現目前 empty state、Leo scene 或 browser-local progress；成功操作才更新局部 UI，不能改寫 runner artifact。解讀：endpoint result、provider scene 與進度備份分層保存；空 endpoint replay 不升格為 accepted replay。復原：匯入缺失、identity mismatch 或按鈕失敗時保留原 state，回到 README 與 result.json 配對條件。轉場：下一頁繼續相同來源與 claim boundary，先確認資料是否已匯入，再讀下一組欄位。

P073-B｜能量與效率結果：三筆案例的 endpoint ledger
endpoint J 與 bit/J 來自同一組固定條件。效率數值描述端點代價，不能替換三筆案例的 service／deadline 狀態。

說法：這是 2026-08-11 14:12 live capture，網址為 http://120.126.151.102:3000/course；目前沒有 accepted result.json，待匯入值維持空白，不能把列舉值說成 current result。欄位定位：依頁面標題與可見欄位逐一讀來源、值／單位、作用、成功變化與失敗不變項。操作：先讀左側 current crop，再按右側欄位或按鈕順序朗讀；每個欄位都說明來源、值／單位、作用、成功變化與失敗不變項。預期：畫面只呈現目前 empty state、Leo scene 或 browser-local progress；成功操作才更新局部 UI，不能改寫 runner artifact。解讀：endpoint result、provider scene 與進度備份分層保存；空 endpoint replay 不升格為 accepted replay。復原：匯入缺失、identity mismatch 或按鈕失敗時保留原 state，回到 README 與 result.json 配對條件。轉場：下一頁繼續相同來源與 claim boundary，先確認資料是否已匯入，再讀下一組欄位。

P073-C｜唯一修改如何改變 state 與 packet 事件
三筆結果回到同一條 event chain：門檻、action、state、packet、delivery 與 endpoint J。這頁將數值比較還原為可觀察機制。

說法：這是 2026-08-11 14:12 live capture，網址為 http://120.126.151.102:3000/course；目前沒有 accepted result.json，待匯入值維持空白，不能把列舉值說成 current result。欄位定位：依頁面標題與可見欄位逐一讀來源、值／單位、作用、成功變化與失敗不變項。操作：先讀左側 current crop，再按右側欄位或按鈕順序朗讀；每個欄位都說明來源、值／單位、作用、成功變化與失敗不變項。預期：畫面只呈現目前 empty state、Leo scene 或 browser-local progress；成功操作才更新局部 UI，不能改寫 runner artifact。解讀：endpoint result、provider scene 與進度備份分層保存；空 endpoint replay 不升格為 accepted replay。復原：匯入缺失、identity mismatch 或按鈕失敗時保留原 state，回到 README 與 result.json 配對條件。轉場：下一頁繼續相同來源與 claim boundary，先確認資料是否已匯入，再讀下一組欄位。

P074｜surprise：frozen policy 的適用邊界
surprise 保留 margin 30 的 frozen policy，並呈現新的 service condition。2,400 bit、5.41 J、3 次重傳與 3 張逾期封包形成條件式判讀。

說法：先指出 lora-energy-lab/student_policy.py、# === LORA EDITABLE: lab-c-batch-urgent ===、BATCH_SIZE = 3、URGENT_MARGIN_S 的當前值與完整 END marker；marker 外 consumer branch 逐字讀出 if observation.urgent_pending and observation.urgent_due_in_s <= URGENT_MARGIN_S:，下一行是 return SEND_URGENT。操作：只改 marked block 內的 URGENT_MARGIN_S 一行，先保存 distinct backup，再以兩種平台命令編輯與 py_compile。預期：py_compile 只回報語法可解析；run 才產生 status、run_id、result_path、artifact_source、claim_boundary 與 endpoint-replay.json。解讀：margin 越大越早進入急件分支，可能增加 endpoint J；service、deadline、action、state、delivery 與 endpoint J 必須一起判讀。復原：命令錯誤、identity 不符或 replay 缺失時保留原 artifact 與原狀態，不把空白資料補成結果。轉場：下一頁沿相同 artifact 讀取欄位，確認唯一改動是否真的改變 action timing 與服務期限。

P075｜Lab C 結論：service／deadline gate 與 endpoint J
固定條件下，margin 5、30 與 surprise 的 gate 結果共同界定結論。endpoint J 的比較隨 delivery、deadline 與事件鏈一起解讀。

說法：先指出 lora-energy-lab/student_policy.py、# === LORA EDITABLE: lab-c-batch-urgent ===、BATCH_SIZE = 3、URGENT_MARGIN_S 的當前值與完整 END marker；marker 外 consumer branch 逐字讀出 if observation.urgent_pending and observation.urgent_due_in_s <= URGENT_MARGIN_S:，下一行是 return SEND_URGENT。操作：只改 marked block 內的 URGENT_MARGIN_S 一行，先保存 distinct backup，再以兩種平台命令編輯與 py_compile。預期：py_compile 只回報語法可解析；run 才產生 status、run_id、result_path、artifact_source、claim_boundary 與 endpoint-replay.json。解讀：margin 越大越早進入急件分支，可能增加 endpoint J；service、deadline、action、state、delivery 與 endpoint J 必須一起判讀。復原：命令錯誤、identity 不符或 replay 缺失時保留原 artifact 與原狀態，不把空白資料補成結果。轉場：下一頁沿相同 artifact 讀取欄位，確認唯一改動是否真的改變 action timing 與服務期限。

P076｜執行器、結果檔、課程頁與進度備份
terminal runner 產生 result 與 replay，/course 讀取並驗證 identity，replay 顯示事件，進度備份只保存本機紀錄。READY 只寫 browser-local setup status。

說法：這是 2026-08-11 14:12 live capture，網址為 http://120.126.151.102:3000/course；目前沒有 accepted result.json，待匯入值維持空白，不能把列舉值說成 current result。欄位定位：terminal runner 產生 result.json 與 replay；課程頁只驗證、重播與保存；進度備份只保存 A／B／C 匯入紀錄與本機存檔點。操作：先讀左側 current crop，再按右側欄位或按鈕順序朗讀；每個欄位都說明來源、值／單位、作用、成功變化與失敗不變項。預期：畫面只呈現目前 empty state、Leo scene 或 browser-local progress；成功操作才更新局部 UI，不能改寫 runner artifact。解讀：endpoint result、provider scene 與進度備份分層保存；空 endpoint replay 不升格為 accepted replay。復原：匯入缺失、identity mismatch 或按鈕失敗時保留原 state，回到 README 與 result.json 配對條件。轉場：下一頁繼續相同來源與 claim boundary，先確認資料是否已匯入，再讀下一組欄位。

P077-A｜匯入一：result.json、欄位與單位
14:12 live Lab A capture 顯示 result.json 選擇器與尚未匯入狀態。這張 crop 只記錄目前空狀態；尚未產生 accepted replay 或 endpoint artifact。

說法：這是 2026-08-11 14:12 live capture，網址為 http://120.126.151.102:3000/course；目前沒有 accepted result.json，待匯入值維持空白，不能把列舉值說成 current result。欄位定位：result.json、units、import state；按鈕先選結果檔，欄位來源是 runner artifact，值與單位待匯入，失敗時原 import state 不變。操作：先讀左側 current crop，再按右側欄位或按鈕順序朗讀；每個欄位都說明來源、值／單位、作用、成功變化與失敗不變項。預期：畫面只呈現目前 empty state、Leo scene 或 browser-local progress；成功操作才更新局部 UI，不能改寫 runner artifact。解讀：endpoint result、provider scene 與進度備份分層保存；空 endpoint replay 不升格為 accepted replay。復原：匯入缺失、identity mismatch 或按鈕失敗時保留原 state，回到 README 與 result.json 配對條件。轉場：下一頁繼續相同來源與 claim boundary，先確認資料是否已匯入，再讀下一組欄位。

P077-B｜匯入二：情境、run 與 policy lineage
14:12 live Lab A 仍要求先選 result.json；目前沒有匯入紀錄。experiment、case、run identity 與 policy lineage 是待核對契約，identity 不配對時目前畫面保持。

說法：這是 2026-08-11 14:12 live capture，網址為 http://120.126.151.102:3000/course；目前沒有 accepted result.json，待匯入值維持空白，不能把列舉值說成 current result。欄位定位：experiment／case、run identity、policy lineage；來源是 result header 與 receipt，值待匯入，配對失敗時目前畫面保持。操作：先讀左側 current crop，再按右側欄位或按鈕順序朗讀；每個欄位都說明來源、值／單位、作用、成功變化與失敗不變項。預期：畫面只呈現目前 empty state、Leo scene 或 browser-local progress；成功操作才更新局部 UI，不能改寫 runner artifact。解讀：endpoint result、provider scene 與進度備份分層保存；空 endpoint replay 不升格為 accepted replay。復原：匯入缺失、identity mismatch 或按鈕失敗時保留原 state，回到 README 與 result.json 配對條件。轉場：下一頁繼續相同來源與 claim boundary，先確認資料是否已匯入，再讀下一組欄位。

P078-A｜frame selector 一：選取畫面與目前 frame
14:12 live Lab A 尚未匯入，故 frame selector 與 current frame 只作欄位契約說明。每欄標出來源、值、作用、成功變化與失敗不變項；沒有 sequence 就不補寫。

說法：這是 2026-08-11 14:12 live capture，網址為 http://120.126.151.102:3000/course；目前沒有 accepted result.json，待匯入值維持空白，不能把列舉值說成 current result。欄位定位：frame selector、current frame；來源是 endpoint replay，值是 frame identity，作用是固定共同時間點，失敗時原 frame 保持。操作：先讀左側 current crop，再按右側欄位或按鈕順序朗讀；每個欄位都說明來源、值／單位、作用、成功變化與失敗不變項。預期：畫面只呈現目前 empty state、Leo scene 或 browser-local progress；成功操作才更新局部 UI，不能改寫 runner artifact。解讀：endpoint result、provider scene 與進度備份分層保存；空 endpoint replay 不升格為 accepted replay。復原：匯入缺失、identity mismatch 或按鈕失敗時保留原 state，回到 README 與 result.json 配對條件。轉場：下一頁繼續相同來源與 claim boundary，先確認資料是否已匯入，再讀下一組欄位。

P078-B｜frame selector 二：八欄與 queue／event 分工
八個 replay fields 與 queue／event 的資料責任分開說明。14:12 live capture 沒有 current result，frame identity 或事件值待 result.json 匯入後核對。

說法：這是 2026-08-11 14:12 live capture，網址為 http://120.126.151.102:3000/course；目前沒有 accepted result.json，待匯入值維持空白，不能把列舉值說成 current result。欄位定位：八欄、queue、event；來源是 endpoint artifact 與 ledger，值待匯入，作用是分頁讀取事件脈絡，失敗時原 event 保持。操作：先讀左側 current crop，再按右側欄位或按鈕順序朗讀；每個欄位都說明來源、值／單位、作用、成功變化與失敗不變項。預期：畫面只呈現目前 empty state、Leo scene 或 browser-local progress；成功操作才更新局部 UI，不能改寫 runner artifact。解讀：endpoint result、provider scene 與進度備份分層保存；空 endpoint replay 不升格為 accepted replay。復原：匯入缺失、identity mismatch 或按鈕失敗時保留原 state，回到 README 與 result.json 配對條件。轉場：下一頁繼續相同來源與 claim boundary，先確認資料是否已匯入，再讀下一組欄位。

P079-A｜進度備份記錄一：匯入紀錄與本機存檔點
14:12 live 進度備份 capture 顯示 A／B／C 匯入紀錄為 0、本機存檔點為 #0、備份格式為 JSON。這是本機進度紀錄，並不會重算 runner result。

說法：這是 2026-08-11 14:12 live capture，網址為 http://120.126.151.102:3000/course；目前沒有 accepted result.json，待匯入值維持空白，不能把列舉值說成 current result。欄位定位：A／B／C 匯入紀錄、本機存檔點；來源是進度備份，值為 0 與 #0，成功才更新本機 record，並不重算 runner result。操作：先讀左側 current crop，再按右側欄位或按鈕順序朗讀；每個欄位都說明來源、值／單位、作用、成功變化與失敗不變項。預期：畫面只呈現目前 empty state、Leo scene 或 browser-local progress；成功操作才更新局部 UI，不能改寫 runner artifact。解讀：endpoint result、provider scene 與進度備份分層保存；空 endpoint replay 不升格為 accepted replay。復原：匯入缺失、identity mismatch 或按鈕失敗時保留原 state，回到 README 與 result.json 配對條件。轉場：下一頁繼續相同來源與 claim boundary，先確認資料是否已匯入，再讀下一組欄位。

P079-A2｜進度備份記錄二：來源／角色與復原邊界
來源／角色與復原邊界分開保留資料責任與本機處置。進度備份沒有已保存 runner result；identity 不符時目前紀錄保持。

說法：這是 2026-08-11 14:12 live capture，網址為 http://120.126.151.102:3000/course；目前沒有 accepted result.json，待匯入值維持空白，不能把列舉值說成 current result。欄位定位：source／role、backup format；來源是本機進度備份，值為來源角色與 JSON，還原失敗時原紀錄保持。操作：先讀左側 current crop，再按右側欄位或按鈕順序朗讀；每個欄位都說明來源、值／單位、作用、成功變化與失敗不變項。預期：畫面只呈現目前 empty state、Leo scene 或 browser-local progress；成功操作才更新局部 UI，不能改寫 runner artifact。解讀：endpoint result、provider scene 與進度備份分層保存；空 endpoint replay 不升格為 accepted replay。復原：匯入缺失、identity mismatch 或按鈕失敗時保留原 state，回到 README 與 result.json 配對條件。轉場：下一頁繼續相同來源與 claim boundary，先確認資料是否已匯入，再讀下一組欄位。

P079-B｜進度備份控制一：下載與從備份還原
14:12 live 進度備份提供下載進度備份與從備份還原。成功才寫入本機紀錄；目前備份內容尚未下載。

說法：這是 2026-08-11 14:12 live capture，網址為 http://120.126.151.102:3000/course；目前沒有 accepted result.json，待匯入值維持空白，不能把列舉值說成 current result。按鈕定位：下載進度備份、建立本機存檔點；來源是 browser-local progress，成功寫入 JSON 或存檔點，失敗時原進度保持。操作：先讀左側 current crop，再按右側欄位或按鈕順序朗讀；每個欄位都說明來源、值／單位、作用、成功變化與失敗不變項。預期：畫面只呈現目前 empty state、Leo scene 或 browser-local progress；成功操作才更新局部 UI，不能改寫 runner artifact。解讀：endpoint result、provider scene 與進度備份分層保存；空 endpoint replay 不升格為 accepted replay。復原：匯入缺失、identity mismatch 或按鈕失敗時保留原 state，回到 README 與 result.json 配對條件。轉場：下一頁繼續相同來源與 claim boundary，先確認資料是否已匯入，再讀下一組欄位。

P079-B2｜進度備份控制二：建立／還原存檔點與重設
14:12 live 進度備份提供建立本機存檔點、還原本機存檔點與重設本機進度。這些本機 controls 不重算 runner result。

說法：這是 2026-08-11 14:12 live capture，網址為 http://120.126.151.102:3000/course；目前沒有 accepted result.json，待匯入值維持空白，不能把列舉值說成 current result。按鈕定位：從備份還原、重設本機進度；來源是 JSON 或 local progress，成功更新本機畫面，失敗時原狀態保持。操作：先讀左側 current crop，再按右側欄位或按鈕順序朗讀；每個欄位都說明來源、值／單位、作用、成功變化與失敗不變項。預期：畫面只呈現目前 empty state、Leo scene 或 browser-local progress；成功操作才更新局部 UI，不能改寫 runner artifact。解讀：endpoint result、provider scene 與進度備份分層保存；空 endpoint replay 不升格為 accepted replay。復原：匯入缺失、identity mismatch 或按鈕失敗時保留原 state，回到 README 與 result.json 配對條件。轉場：下一頁繼續相同來源與 claim boundary，先確認資料是否已匯入，再讀下一組欄位。

P080｜本機進度備份：建立、還原、重設的狀態機
建立與還原本機存檔點只讀寫進度備份；重設本機進度改變 local state。這些 controls 不改 runner artifact、service gate 或 replay result。

說法：這是 2026-08-11 14:12 live capture，網址為 http://120.126.151.102:3000/course；目前沒有 accepted result.json，待匯入值維持空白，不能把列舉值說成 current result。狀態定位：下載、建立、還原、重設四種本機進度操作；它們只改 browser-local state，不改 runner artifact、service gate 或 replay result。操作：先讀左側 current crop，再按右側欄位或按鈕順序朗讀；每個欄位都說明來源、值／單位、作用、成功變化與失敗不變項。預期：畫面只呈現目前 empty state、Leo scene 或 browser-local progress；成功操作才更新局部 UI，不能改寫 runner artifact。解讀：endpoint result、provider scene 與進度備份分層保存；空 endpoint replay 不升格為 accepted replay。復原：匯入缺失、identity mismatch 或按鈕失敗時保留原 state，回到 README 與 result.json 配對條件。轉場：下一頁繼續相同來源與 claim boundary，先確認資料是否已匯入，再讀下一組欄位。

P081｜轉移一：智慧農場的灌溉 service gate
智慧農場以水位、作物 freshness 與灌溉期限作為 service condition。pump endpoint J 只在服務條件明確後描述；目前未提供 live farm KPI。

說法：這是 2026-08-11 14:12 live capture，網址為 http://120.126.151.102:3000/course；目前沒有 accepted result.json，待匯入值維持空白，不能把列舉值說成 current result。欄位定位：水位、freshness、灌溉期限與 pump endpoint J；來源是轉移假設，目前未提供 live KPI，先讀 service condition，再解讀端點代價。操作：先讀左側 current crop，再按右側欄位或按鈕順序朗讀；每個欄位都說明來源、值／單位、作用、成功變化與失敗不變項。預期：畫面只呈現目前 empty state、Leo scene 或 browser-local progress；成功操作才更新局部 UI，不能改寫 runner artifact。解讀：endpoint result、provider scene 與進度備份分層保存；空 endpoint replay 不升格為 accepted replay。復原：匯入缺失、identity mismatch 或按鈕失敗時保留原 state，回到 README 與 result.json 配對條件。轉場：下一頁繼續相同來源與 claim boundary，先確認資料是否已匯入，再讀下一組欄位。

P082｜轉移二：HVAC 的舒適度與設備期限
HVAC 將 urgent branch 對應舒適度、設備保護與尖峰事件。fan／compressor endpoint J 以宣告 scope 保存，沒有現場量測宣稱。

說法：這是 2026-08-11 14:12 live capture，網址為 http://120.126.151.102:3000/course；目前沒有 accepted result.json，待匯入值維持空白，不能把列舉值說成 current result。欄位定位：舒適度、設備期限與 fan／compressor endpoint J；來源是轉移假設，成功條件是 service 與 deadline，失敗時能源描述不升格。操作：先讀左側 current crop，再按右側欄位或按鈕順序朗讀；每個欄位都說明來源、值／單位、作用、成功變化與失敗不變項。預期：畫面只呈現目前 empty state、Leo scene 或 browser-local progress；成功操作才更新局部 UI，不能改寫 runner artifact。解讀：endpoint result、provider scene 與進度備份分層保存；空 endpoint replay 不升格為 accepted replay。復原：匯入缺失、identity mismatch 或按鈕失敗時保留原 state，回到 README 與 result.json 配對條件。轉場：下一頁繼續相同來源與 claim boundary，先確認資料是否已匯入，再讀下一組欄位。

P083｜轉移三：edge inference 的 freshness gate
edge inference 將 packet delivery 改為任務 freshness 與完成狀態。edge endpoint Joule 仍跟在 service gate 之後，使用條件式推理。

說法：這是 2026-08-11 14:12 live capture，網址為 http://120.126.151.102:3000/course；目前沒有 accepted result.json，待匯入值維持空白，不能把列舉值說成 current result。欄位定位：freshness、完成狀態與 edge endpoint Joule；來源是轉移假設，先讀 freshness gate，再讀能源 scope。操作：先讀左側 current crop，再按右側欄位或按鈕順序朗讀；每個欄位都說明來源、值／單位、作用、成功變化與失敗不變項。預期：畫面只呈現目前 empty state、Leo scene 或 browser-local progress；成功操作才更新局部 UI，不能改寫 runner artifact。解讀：endpoint result、provider scene 與進度備份分層保存；空 endpoint replay 不升格為 accepted replay。復原：匯入缺失、identity mismatch 或按鈕失敗時保留原 state，回到 README 與 result.json 配對條件。轉場：下一頁繼續相同來源與 claim boundary，先確認資料是否已匯入，再讀下一組欄位。

P084｜轉移出口：保留可重播的 policy hypothesis
transfer record 保留 condition、branch、event、service、energy scope 與 claim ceiling。workbook export／reopen 維持 lineage，另開 fresh run 需保持 identity。

說法：這是 2026-08-11 14:12 live capture，網址為 http://120.126.151.102:3000/course；目前沒有 accepted result.json，待匯入值維持空白，不能把列舉值說成 current result。欄位定位：condition、branch、event、service、energy scope、claim ceiling；來源是 transfer record，成功保留 lineage，失敗時不補結果。操作：先讀左側 current crop，再按右側欄位或按鈕順序朗讀；每個欄位都說明來源、值／單位、作用、成功變化與失敗不變項。預期：畫面只呈現目前 empty state、Leo scene 或 browser-local progress；成功操作才更新局部 UI，不能改寫 runner artifact。解讀：endpoint result、provider scene 與進度備份分層保存；空 endpoint replay 不升格為 accepted replay。復原：匯入缺失、identity mismatch 或按鈕失敗時保留原 state，回到 README 與 result.json 配對條件。轉場：下一頁繼續相同來源與 claim boundary，先確認資料是否已匯入，再讀下一組欄位。

P085-A｜匯入資料：source 與 case
14:12 live Lab A 以 source 與 experiment／case 兩欄說明資料責任與情境配對。目前仍是尚未匯入，不宣稱 accepted upload。

說法：這是 2026-08-11 14:12 live capture，網址為 http://120.126.151.102:3000/course；目前沒有 accepted result.json，待匯入值維持空白，不能把列舉值說成 current result。欄位定位：source、experiment／case；來源是 result.json 與 header，值待匯入，成功建立 selected state，失敗時 import state 保持。操作：先讀左側 current crop，再按右側欄位或按鈕順序朗讀；每個欄位都說明來源、值／單位、作用、成功變化與失敗不變項。預期：畫面只呈現目前 empty state、Leo scene 或 browser-local progress；成功操作才更新局部 UI，不能改寫 runner artifact。解讀：endpoint result、provider scene 與進度備份分層保存；空 endpoint replay 不升格為 accepted replay。復原：匯入缺失、identity mismatch 或按鈕失敗時保留原 state，回到 README 與 result.json 配對條件。轉場：下一頁繼續相同來源與 claim boundary，先確認資料是否已匯入，再讀下一組欄位。

P085-B｜匯入狀態與備用標籤
14:12 live Lab A 的 import state 與 fallback label 分開說明。尚未匯入與同情境備用各自保留 identity 邊界。

說法：這是 2026-08-11 14:12 live capture，網址為 http://120.126.151.102:3000/course；目前沒有 accepted result.json，待匯入值維持空白，不能把列舉值說成 current result。欄位定位：import state、fallback label；來源是課程頁 gate 與 README，值為尚未匯入及同情境備用標籤，成功才進 replay，失敗時原 state 保持。操作：先讀左側 current crop，再按右側欄位或按鈕順序朗讀；每個欄位都說明來源、值／單位、作用、成功變化與失敗不變項。預期：畫面只呈現目前 empty state、Leo scene 或 browser-local progress；成功操作才更新局部 UI，不能改寫 runner artifact。解讀：endpoint result、provider scene 與進度備份分層保存；空 endpoint replay 不升格為 accepted replay。復原：匯入缺失、identity mismatch 或按鈕失敗時保留原 state，回到 README 與 result.json 配對條件。轉場：下一頁繼續相同來源與 claim boundary，先確認資料是否已匯入，再讀下一組欄位。

P086-A｜service 與 delivered bits
14:12 live Lab A 沒有 current result。service 與 delivered bits 只說明待匯入欄位契約，值保持待 result.json。

說法：這是 2026-08-11 14:12 live capture，網址為 http://120.126.151.102:3000/course；目前沒有 accepted result.json，待匯入值維持空白，不能把列舉值說成 current result。欄位定位：service、delivered bits；來源是 result summary 與 endpoint，值待匯入，service 是第一個 gate，失敗時原 record 保持。操作：先讀左側 current crop，再按右側欄位或按鈕順序朗讀；每個欄位都說明來源、值／單位、作用、成功變化與失敗不變項。預期：畫面只呈現目前 empty state、Leo scene 或 browser-local progress；成功操作才更新局部 UI，不能改寫 runner artifact。解讀：endpoint result、provider scene 與進度備份分層保存；空 endpoint replay 不升格為 accepted replay。復原：匯入缺失、identity mismatch 或按鈕失敗時保留原 state，回到 README 與 result.json 配對條件。轉場：下一頁繼續相同來源與 claim boundary，先確認資料是否已匯入，再讀下一組欄位。

P086-B｜endpoint J 與 bit/J
14:12 live Lab A 沒有 current result。endpoint J 與 bit/J 只說明 scope、單位與失敗邊界，不填入數值。

說法：這是 2026-08-11 14:12 live capture，網址為 http://120.126.151.102:3000/course；目前沒有 accepted result.json，待匯入值維持空白，不能把列舉值說成 current result。欄位定位：endpoint J、bit/J；來源是 endpoint result，單位是 J 與 bit/J，作用是描述端點代價與效率，失敗時不改寫 service。操作：先讀左側 current crop，再按右側欄位或按鈕順序朗讀；每個欄位都說明來源、值／單位、作用、成功變化與失敗不變項。預期：畫面只呈現目前 empty state、Leo scene 或 browser-local progress；成功操作才更新局部 UI，不能改寫 runner artifact。解讀：endpoint result、provider scene 與進度備份分層保存；空 endpoint replay 不升格為 accepted replay。復原：匯入缺失、identity mismatch 或按鈕失敗時保留原 state，回到 README 與 result.json 配對條件。轉場：下一頁繼續相同來源與 claim boundary，先確認資料是否已匯入，再讀下一組欄位。

P087-A｜replay fields 一至二
14:12 live Lab A 尚未匯入。Radio 與 Action 是待 replay 欄位契約，不把列舉值當成目前 frame 結果。

說法：這是 2026-08-11 14:12 live capture，網址為 http://120.126.151.102:3000/course；目前沒有 accepted result.json，待匯入值維持空白，不能把列舉值說成 current result。欄位定位：Radio、Action；來源是 endpoint replay 與 policy replay，列舉值待匯入，成功更新 frame／event，失敗時原 action 保持。操作：先讀左側 current crop，再按右側欄位或按鈕順序朗讀；每個欄位都說明來源、值／單位、作用、成功變化與失敗不變項。預期：畫面只呈現目前 empty state、Leo scene 或 browser-local progress；成功操作才更新局部 UI，不能改寫 runner artifact。解讀：endpoint result、provider scene 與進度備份分層保存；空 endpoint replay 不升格為 accepted replay。復原：匯入缺失、identity mismatch 或按鈕失敗時保留原 state，回到 README 與 result.json 配對條件。轉場：下一頁繼續相同來源與 claim boundary，先確認資料是否已匯入，再讀下一組欄位。

P087-B｜replay fields 三至四
14:12 live Lab A 尚未匯入。Queue count 與累積 endpoint J 只說明來源、單位與 frame identity，待 result.json。

說法：這是 2026-08-11 14:12 live capture，網址為 http://120.126.151.102:3000/course；目前沒有 accepted result.json，待匯入值維持空白，不能把列舉值說成 current result。欄位定位：Queue count、累積 endpoint J；來源是 queue snapshot 與 frame ledger，單位是 packet count 與 J，成功更新同一 frame，失敗時原 queue 保持。操作：先讀左側 current crop，再按右側欄位或按鈕順序朗讀；每個欄位都說明來源、值／單位、作用、成功變化與失敗不變項。預期：畫面只呈現目前 empty state、Leo scene 或 browser-local progress；成功操作才更新局部 UI，不能改寫 runner artifact。解讀：endpoint result、provider scene 與進度備份分層保存；空 endpoint replay 不升格為 accepted replay。復原：匯入缺失、identity mismatch 或按鈕失敗時保留原 state，回到 README 與 result.json 配對條件。轉場：下一頁繼續相同來源與 claim boundary，先確認資料是否已匯入，再讀下一組欄位。

P088-A｜queue 與事件一
14:12 live Lab A 尚未匯入。queue item 與 event type 分開說明，事件值待 result.json，不補寫未見事件。

說法：這是 2026-08-11 14:12 live capture，網址為 http://120.126.151.102:3000/course；目前沒有 accepted result.json，待匯入值維持空白，不能把列舉值說成 current result。欄位定位：queue item、event type；來源是 result queue 與 packet trace，值待匯入，成功配對 service，失敗時原 event 保持。操作：先讀左側 current crop，再按右側欄位或按鈕順序朗讀；每個欄位都說明來源、值／單位、作用、成功變化與失敗不變項。預期：畫面只呈現目前 empty state、Leo scene 或 browser-local progress；成功操作才更新局部 UI，不能改寫 runner artifact。解讀：endpoint result、provider scene 與進度備份分層保存；空 endpoint replay 不升格為 accepted replay。復原：匯入缺失、identity mismatch 或按鈕失敗時保留原 state，回到 README 與 result.json 配對條件。轉場：下一頁繼續相同來源與 claim boundary，先確認資料是否已匯入，再讀下一組欄位。

P088-B｜queue 與事件二
14:12 live Lab A 尚未匯入。packet identity 與 delivery state 只定義欄位責任，待配對後才連回 service 與 deadline。

說法：這是 2026-08-11 14:12 live capture，網址為 http://120.126.151.102:3000/course；目前沒有 accepted result.json，待匯入值維持空白，不能把列舉值說成 current result。欄位定位：packet identity、delivery state；來源是 event ledger 與 service event，成功連回 deadline，失敗時原 identity 與 state 保持。操作：先讀左側 current crop，再按右側欄位或按鈕順序朗讀；每個欄位都說明來源、值／單位、作用、成功變化與失敗不變項。預期：畫面只呈現目前 empty state、Leo scene 或 browser-local progress；成功操作才更新局部 UI，不能改寫 runner artifact。解讀：endpoint result、provider scene 與進度備份分層保存；空 endpoint replay 不升格為 accepted replay。復原：匯入缺失、identity mismatch 或按鈕失敗時保留原 state，回到 README 與 result.json 配對條件。轉場：下一頁繼續相同來源與 claim boundary，先確認資料是否已匯入，再讀下一組欄位。

P089-A｜timeline 一：contact 與 quality
14:12 live Lab A 的時間軸尚未載入 sequence。contact 與 quality 只作欄位契約，不捏造 transition。

說法：這是 2026-08-11 14:12 live capture，網址為 http://120.126.151.102:3000/course；目前沒有 accepted result.json，待匯入值維持空白，不能把列舉值說成 current result。欄位定位：contact、quality；來源是 frame，值為 contact ID／status 與 ordinal band，成功更新欄位，失敗時原 state 保持。操作：先讀左側 current crop，再按右側欄位或按鈕順序朗讀；每個欄位都說明來源、值／單位、作用、成功變化與失敗不變項。預期：畫面只呈現目前 empty state、Leo scene 或 browser-local progress；成功操作才更新局部 UI，不能改寫 runner artifact。解讀：endpoint result、provider scene 與進度備份分層保存；空 endpoint replay 不升格為 accepted replay。復原：匯入缺失、identity mismatch 或按鈕失敗時保留原 state，回到 README 與 result.json 配對條件。轉場：下一頁繼續相同來源與 claim boundary，先確認資料是否已匯入，再讀下一組欄位。

P089-B｜timeline 二：radio 與 policy branch
14:12 live Lab A 尚未匯入。radio state 與 policy branch 待 frame sequence，未知值保持未知。

說法：這是 2026-08-11 14:12 live capture，網址為 http://120.126.151.102:3000/course；目前沒有 accepted result.json，待匯入值維持空白，不能把列舉值說成 current result。欄位定位：radio state、policy branch；來源是 Radio 與 Action，成功更新 transition，失敗時原 state 與 action 保持。操作：先讀左側 current crop，再按右側欄位或按鈕順序朗讀；每個欄位都說明來源、值／單位、作用、成功變化與失敗不變項。預期：畫面只呈現目前 empty state、Leo scene 或 browser-local progress；成功操作才更新局部 UI，不能改寫 runner artifact。解讀：endpoint result、provider scene 與進度備份分層保存；空 endpoint replay 不升格為 accepted replay。復原：匯入缺失、identity mismatch 或按鈕失敗時保留原 state，回到 README 與 result.json 配對條件。轉場：下一頁繼續相同來源與 claim boundary，先確認資料是否已匯入，再讀下一組欄位。

P090-A｜execution ledger 一
14:12 live Lab A 的 execution ledger 尚未建立。experiment／case 與 role 只說明配對契約，案例不符時停止更新。

說法：這是 2026-08-11 14:12 live capture，網址為 http://120.126.151.102:3000/course；目前沒有 accepted result.json，待匯入值維持空白，不能把列舉值說成 current result。欄位定位：experiment／case、role；來源是 result ledger 與 comparison receipt，成功配對案例，失敗時 selected record 保持。操作：先讀左側 current crop，再按右側欄位或按鈕順序朗讀；每個欄位都說明來源、值／單位、作用、成功變化與失敗不變項。預期：畫面只呈現目前 empty state、Leo scene 或 browser-local progress；成功操作才更新局部 UI，不能改寫 runner artifact。解讀：endpoint result、provider scene 與進度備份分層保存；空 endpoint replay 不升格為 accepted replay。復原：匯入缺失、identity mismatch 或按鈕失敗時保留原 state，回到 README 與 result.json 配對條件。轉場：下一頁繼續相同來源與 claim boundary，先確認資料是否已匯入，再讀下一組欄位。

P090-B｜execution ledger 二
14:12 live Lab A 尚未匯入。service／endpoint J 與 source／selected state 只說明 scope，沒有 current result 可升格。

說法：這是 2026-08-11 14:12 live capture，網址為 http://120.126.151.102:3000/course；目前沒有 accepted result.json，待匯入值維持空白，不能把列舉值說成 current result。欄位定位：service／endpoint J、source／selected state；來源是 result 與 browser-local import state，成功維持 scope，失敗時 terminal record 不改。操作：先讀左側 current crop，再按右側欄位或按鈕順序朗讀；每個欄位都說明來源、值／單位、作用、成功變化與失敗不變項。預期：畫面只呈現目前 empty state、Leo scene 或 browser-local progress；成功操作才更新局部 UI，不能改寫 runner artifact。解讀：endpoint result、provider scene 與進度備份分層保存；空 endpoint replay 不升格為 accepted replay。復原：匯入缺失、identity mismatch 或按鈕失敗時保留原 state，回到 README 與 result.json 配對條件。轉場：下一頁繼續相同來源與 claim boundary，先確認資料是否已匯入，再讀下一組欄位。

P091-A｜Evidence：Leo scene 與空 endpoint replay
14:12 live Evidence capture 顯示真實 Leo scene，但 endpoint replay 區仍為空。scenario metadata 與 endpoint result 分開標示；沒有 replay 就不宣稱結果。

說法：這是 2026-08-11 14:12 live capture，網址為 http://120.126.151.102:3000/course；目前沒有 accepted result.json，待匯入值維持空白，不能把列舉值說成 current result。欄位定位：Leo scene、scenario input、endpoint result；Evidence 目前只有場景，endpoint replay 空白，沒有 result.json 就不宣稱結果。操作：先讀左側 current crop，再按右側欄位或按鈕順序朗讀；每個欄位都說明來源、值／單位、作用、成功變化與失敗不變項。預期：畫面只呈現目前 empty state、Leo scene 或 browser-local progress；成功操作才更新局部 UI，不能改寫 runner artifact。解讀：endpoint result、provider scene 與進度備份分層保存；空 endpoint replay 不升格為 accepted replay。復原：匯入缺失、identity mismatch 或按鈕失敗時保留原 state，回到 README 與 result.json 配對條件。轉場：下一頁繼續相同來源與 claim boundary，先確認資料是否已匯入，再讀下一組欄位。

P091-B｜Evidence：identity 與空 replay 邊界
14:12 live Evidence capture 只提供 Leo scene 與空 endpoint replay。identity 尚待 result.json 配對；不宣稱 accepted result 或 provider PASS。

說法：這是 2026-08-11 14:12 live capture，網址為 http://120.126.151.102:3000/course；目前沒有 accepted result.json，待匯入值維持空白，不能把列舉值說成 current result。欄位定位：identity boundary、empty capture；來源是 Evidence scene 與 README，endpoint replay 空白，配對失敗時不宣稱 provider PASS。操作：先讀左側 current crop，再按右側欄位或按鈕順序朗讀；每個欄位都說明來源、值／單位、作用、成功變化與失敗不變項。預期：畫面只呈現目前 empty state、Leo scene 或 browser-local progress；成功操作才更新局部 UI，不能改寫 runner artifact。解讀：endpoint result、provider scene 與進度備份分層保存；空 endpoint replay 不升格為 accepted replay。復原：匯入缺失、identity mismatch 或按鈕失敗時保留原 state，回到 README 與 result.json 配對條件。轉場：下一頁繼續相同來源與 claim boundary，先確認資料是否已匯入，再讀下一組欄位。

P092-A1｜進度備份：下載與建立本機存檔點
14:12 live 進度備份的下載 JSON 與建立本機存檔點分開說明。#0、尚未下載保持誠實，成功才更新本機 record。

說法：這是 2026-08-11 14:12 live capture，網址為 http://120.126.151.102:3000/course；目前沒有 accepted result.json，待匯入值維持空白，不能把列舉值說成 current result。按鈕定位：下載進度備份、建立本機存檔點；來源是 A／B／C 匯入紀錄與 local progress，成功更新 JSON 或 #0，失敗時原紀錄保持。操作：先讀左側 current crop，再按右側欄位或按鈕順序朗讀；每個欄位都說明來源、值／單位、作用、成功變化與失敗不變項。預期：畫面只呈現目前 empty state、Leo scene 或 browser-local progress；成功操作才更新局部 UI，不能改寫 runner artifact。解讀：endpoint result、provider scene 與進度備份分層保存；空 endpoint replay 不升格為 accepted replay。復原：匯入缺失、identity mismatch 或按鈕失敗時保留原 state，回到 README 與 result.json 配對條件。轉場：下一頁繼續相同來源與 claim boundary，先確認資料是否已匯入，再讀下一組欄位。

P092-A2｜進度備份：從備份還原與目前紀錄
14:12 live 進度備份的從備份還原與目前紀錄分開說明。沒有備份檔時不宣稱可還原。

說法：這是 2026-08-11 14:12 live capture，網址為 http://120.126.151.102:3000/course；目前沒有 accepted result.json，待匯入值維持空白，不能把列舉值說成 current result。按鈕定位：從備份還原、目前進度紀錄；來源是 JSON 與 browser-local progress，成功更新畫面，失敗時原狀態保持，且不重算 runner result。操作：先讀左側 current crop，再按右側欄位或按鈕順序朗讀；每個欄位都說明來源、值／單位、作用、成功變化與失敗不變項。預期：畫面只呈現目前 empty state、Leo scene 或 browser-local progress；成功操作才更新局部 UI，不能改寫 runner artifact。解讀：endpoint result、provider scene 與進度備份分層保存；空 endpoint replay 不升格為 accepted replay。復原：匯入缺失、identity mismatch 或按鈕失敗時保留原 state，回到 README 與 result.json 配對條件。轉場：下一頁繼續相同來源與 claim boundary，先確認資料是否已匯入，再讀下一組欄位。

P092-B1｜進度備份：建立與還原本機存檔點
14:12 live 進度備份的建立／還原本機存檔點分開說明。本機保存點與 runner artifact 分層。

說法：這是 2026-08-11 14:12 live capture，網址為 http://120.126.151.102:3000/course；目前沒有 accepted result.json，待匯入值維持空白，不能把列舉值說成 current result。按鈕定位：建立本機存檔點、還原本機存檔點；來源是 identity 與 local checkpoint，成功新增或回復 record，失敗時原 progress 保持。操作：先讀左側 current crop，再按右側欄位或按鈕順序朗讀；每個欄位都說明來源、值／單位、作用、成功變化與失敗不變項。預期：畫面只呈現目前 empty state、Leo scene 或 browser-local progress；成功操作才更新局部 UI，不能改寫 runner artifact。解讀：endpoint result、provider scene 與進度備份分層保存；空 endpoint replay 不升格為 accepted replay。復原：匯入缺失、identity mismatch 或按鈕失敗時保留原 state，回到 README 與 result.json 配對條件。轉場：下一頁繼續相同來源與 claim boundary，先確認資料是否已匯入，再讀下一組欄位。

P092-B2｜進度備份：重設本機進度與結果邊界
14:12 live 進度備份的重設本機進度與 result boundary 分開說明。重設只改 local progress，不重算 endpoint result。

說法：這是 2026-08-11 14:12 live capture，網址為 http://120.126.151.102:3000/course；目前沒有 accepted result.json，待匯入值維持空白，不能把列舉值說成 current result。按鈕定位：重設本機進度、result boundary；來源是 local progress 與 runner artifact，重設只改本機紀錄，失敗時原 result 保持。操作：先讀左側 current crop，再按右側欄位或按鈕順序朗讀；每個欄位都說明來源、值／單位、作用、成功變化與失敗不變項。預期：畫面只呈現目前 empty state、Leo scene 或 browser-local progress；成功操作才更新局部 UI，不能改寫 runner artifact。解讀：endpoint result、provider scene 與進度備份分層保存；空 endpoint replay 不升格為 accepted replay。復原：匯入缺失、identity mismatch 或按鈕失敗時保留原 state，回到 README 與 result.json 配對條件。轉場：下一頁繼續相同來源與 claim boundary，先確認資料是否已匯入，再讀下一組欄位。

P093-A｜empty-state／recovery：匯入狀態與配對結果
14:12 live Lab C 是尚未匯入且沒有 replay 的 empty state。empty import state 與 matching artifact 分開說明，rejection result 尚未出現。

說法：這是 2026-08-11 14:12 live capture，網址為 http://120.126.151.102:3000/course；目前沒有 accepted result.json，待匯入值維持空白，不能把列舉值說成 current result。欄位定位：empty import state、matching artifact；來源是 Lab C current capture，值為尚未匯入與待配對，成功才回到 record，失敗時原 session 保持。操作：先讀左側 current crop，再按右側欄位或按鈕順序朗讀；每個欄位都說明來源、值／單位、作用、成功變化與失敗不變項。預期：畫面只呈現目前 empty state、Leo scene 或 browser-local progress；成功操作才更新局部 UI，不能改寫 runner artifact。解讀：endpoint result、provider scene 與進度備份分層保存；空 endpoint replay 不升格為 accepted replay。復原：匯入缺失、identity mismatch 或按鈕失敗時保留原 state，回到 README 與 result.json 配對條件。轉場：下一頁繼續相同來源與 claim boundary，先確認資料是否已匯入，再讀下一組欄位。

P093-B｜empty-state／recovery：同情境備用
14:12 live Lab C 的 same-scenario fallback 與 empty-state boundary 分開說明。未配對時保留原 session。

說法：這是 2026-08-11 14:12 live capture，網址為 http://120.126.151.102:3000/course；目前沒有 accepted result.json，待匯入值維持空白，不能把列舉值說成 current result。欄位定位：same-scenario fallback、empty-state boundary；來源是 Lab C fallback label，成功更新 selected fallback，失敗時不補 selected result。操作：先讀左側 current crop，再按右側欄位或按鈕順序朗讀；每個欄位都說明來源、值／單位、作用、成功變化與失敗不變項。預期：畫面只呈現目前 empty state、Leo scene 或 browser-local progress；成功操作才更新局部 UI，不能改寫 runner artifact。解讀：endpoint result、provider scene 與進度備份分層保存；空 endpoint replay 不升格為 accepted replay。復原：匯入缺失、identity mismatch 或按鈕失敗時保留原 state，回到 README 與 result.json 配對條件。轉場：下一頁繼續相同來源與 claim boundary，先確認資料是否已匯入，再讀下一組欄位。

P094-A｜Prepare：READY 與備用環境
14:12 live Prepare capture 顯示目前狀態為尚未記錄；READY 與 fallback source 分開說明。兩個按鈕尚待操作，browser-local state 不等於 terminal receipt。

說法：這是 2026-08-11 14:12 live capture，網址為 http://120.126.151.102:3000/course；目前沒有 accepted result.json，待匯入值維持空白，不能把列舉值說成 current result。按鈕定位：記錄 READY、記錄備用環境；14:12 live 畫面的目前狀態是尚未記錄，兩個按鈕都尚未操作。記錄 READY 只保存已存在的 terminal READY receipt 到 browser-local progress；它不執行 setup、verify 或 run，也不產生 result.json。記錄備用環境只保存 fallback source，失敗時原狀態保持。操作：先讀左側 current crop，再按右側欄位或按鈕順序朗讀；每個欄位都說明來源、值／單位、作用、成功變化與失敗不變項。預期：畫面只呈現目前 empty state、Leo scene 或 browser-local progress；成功操作才更新局部 UI，不能改寫 runner artifact。解讀：endpoint result、provider scene 與進度備份分層保存；空 endpoint replay 不升格為 accepted replay。復原：匯入缺失、identity mismatch 或按鈕失敗時保留原 state，回到 README 與 result.json 配對條件。轉場：下一頁繼續相同來源與 claim boundary，先確認資料是否已匯入，再讀下一組欄位。

P094-B｜Prepare：terminal receipt 與完成邊界
14:12 live Prepare capture 沒有 terminal receipt。install、verify、run、upload 各由自身 receipt 定義，失敗時 browser-local status 保持。

說法：這是 2026-08-11 14:12 live capture，網址為 http://120.126.151.102:3000/course；目前沒有 accepted result.json，待匯入值維持空白，不能把列舉值說成 current result。欄位定位：terminal receipt、completion boundary；來源是 install／verify／run／upload receipt，成功配對 result_path 與 replay，缺收據時 browser-local status 保持。操作：先讀左側 current crop，再按右側欄位或按鈕順序朗讀；每個欄位都說明來源、值／單位、作用、成功變化與失敗不變項。預期：畫面只呈現目前 empty state、Leo scene 或 browser-local progress；成功操作才更新局部 UI，不能改寫 runner artifact。解讀：endpoint result、provider scene 與進度備份分層保存；空 endpoint replay 不升格為 accepted replay。復原：匯入缺失、identity mismatch 或按鈕失敗時保留原 state，回到 README 與 result.json 配對條件。轉場：下一頁繼續相同來源與 claim boundary，先確認資料是否已匯入，再讀下一組欄位。

P095-A1｜導覽：global navigation 與語言
14:12 live Lab A capture 的 global navigation 與 language controls 分開說明。按鈕只改 focus 或 language。

說法：這是 2026-08-11 14:12 live capture，網址為 http://120.126.151.102:3000/course；目前沒有 accepted result.json，待匯入值維持空白，不能把列舉值說成 current result。按鈕定位：global navigation、繁中／EN；來源是 route 與 language state，成功更新 focus／language，失敗時目前頁面保持。操作：先讀左側 current crop，再按右側欄位或按鈕順序朗讀；每個欄位都說明來源、值／單位、作用、成功變化與失敗不變項。預期：畫面只呈現目前 empty state、Leo scene 或 browser-local progress；成功操作才更新局部 UI，不能改寫 runner artifact。解讀：endpoint result、provider scene 與進度備份分層保存；空 endpoint replay 不升格為 accepted replay。復原：匯入缺失、identity mismatch 或按鈕失敗時保留原 state，回到 README 與 result.json 配對條件。轉場：下一頁繼續相同來源與 claim boundary，先確認資料是否已匯入，再讀下一組欄位。

P095-A2｜導覽：Lab tabs 與結果邊界
14:12 live tabs 已改為準備、實驗 A／B／C、證據、進度備份。切頁不重寫 endpoint result。

說法：這是 2026-08-11 14:12 live capture，網址為 http://120.126.151.102:3000/course；目前沒有 accepted result.json，待匯入值維持空白，不能把列舉值說成 current result。按鈕定位：實驗 A／B／C tabs、endpoint result；切頁只更新 section route，成功顯示新頁，失敗時 current section 保持，切頁不重寫 result。操作：先讀左側 current crop，再按右側欄位或按鈕順序朗讀；每個欄位都說明來源、值／單位、作用、成功變化與失敗不變項。預期：畫面只呈現目前 empty state、Leo scene 或 browser-local progress；成功操作才更新局部 UI，不能改寫 runner artifact。解讀：endpoint result、provider scene 與進度備份分層保存；空 endpoint replay 不升格為 accepted replay。復原：匯入缺失、identity mismatch 或按鈕失敗時保留原 state，回到 README 與 result.json 配對條件。轉場：下一頁繼續相同來源與 claim boundary，先確認資料是否已匯入，再讀下一組欄位。

P095-B1｜fallback loader：選取與來源
14:12 live Lab B 是 empty state。fallback loader 與 selected source 分開說明，沒有從空白狀態宣稱 selected result。

說法：這是 2026-08-11 14:12 live capture，網址為 http://120.126.151.102:3000/course；目前沒有 accepted result.json，待匯入值維持空白，不能把列舉值說成 current result。欄位定位：fallback loader、selected source；來源是 experiment order 與 source list，成功切換 fallback，失敗時原 state 保持。操作：先讀左側 current crop，再按右側欄位或按鈕順序朗讀；每個欄位都說明來源、值／單位、作用、成功變化與失敗不變項。預期：畫面只呈現目前 empty state、Leo scene 或 browser-local progress；成功操作才更新局部 UI，不能改寫 runner artifact。解讀：endpoint result、provider scene 與進度備份分層保存；空 endpoint replay 不升格為 accepted replay。復原：匯入缺失、identity mismatch 或按鈕失敗時保留原 state，回到 README 與 result.json 配對條件。轉場：下一頁繼續相同來源與 claim boundary，先確認資料是否已匯入，再讀下一組欄位。

P095-B2｜fallback loader：identity 配對與空狀態
14:12 live Lab B 的 identity match 與 empty-state boundary 分開說明。未配對時原 result 保持。

說法：這是 2026-08-11 14:12 live capture，網址為 http://120.126.151.102:3000/course；目前沒有 accepted result.json，待匯入值維持空白，不能把列舉值說成 current result。欄位定位：identity match、empty-state boundary；來源是 case／run 與 Lab B capture，配對成功才讀 record，失敗時原 result 保持。操作：先讀左側 current crop，再按右側欄位或按鈕順序朗讀；每個欄位都說明來源、值／單位、作用、成功變化與失敗不變項。預期：畫面只呈現目前 empty state、Leo scene 或 browser-local progress；成功操作才更新局部 UI，不能改寫 runner artifact。解讀：endpoint result、provider scene 與進度備份分層保存；空 endpoint replay 不升格為 accepted replay。復原：匯入缺失、identity mismatch 或按鈕失敗時保留原 state，回到 README 與 result.json 配對條件。轉場：下一頁繼續相同來源與 claim boundary，先確認資料是否已匯入，再讀下一組欄位。

P096-A｜進度備份：下載與建立本機存檔點
14:12 live 進度備份的下載進度備份與建立本機存檔點分開說明。#0、0 筆匯入紀錄保持為 browser-local record。

說法：這是 2026-08-11 14:12 live capture，網址為 http://120.126.151.102:3000/course；目前沒有 accepted result.json，待匯入值維持空白，不能把列舉值說成 current result。按鈕定位：下載進度備份、建立本機存檔點；來源是 local progress，值為 0 筆與 #0，成功更新本機紀錄，失敗時原紀錄保持。操作：先讀左側 current crop，再按右側欄位或按鈕順序朗讀；每個欄位都說明來源、值／單位、作用、成功變化與失敗不變項。預期：畫面只呈現目前 empty state、Leo scene 或 browser-local progress；成功操作才更新局部 UI，不能改寫 runner artifact。解讀：endpoint result、provider scene 與進度備份分層保存；空 endpoint replay 不升格為 accepted replay。復原：匯入缺失、identity mismatch 或按鈕失敗時保留原 state，回到 README 與 result.json 配對條件。轉場：下一頁繼續相同來源與 claim boundary，先確認資料是否已匯入，再讀下一組欄位。

P096-B｜進度備份：還原與重設本機進度
14:12 live 進度備份的從備份還原與重設本機進度分開說明。條件不足時不執行 Python、不重算 replay。

說法：這是 2026-08-11 14:12 live capture，網址為 http://120.126.151.102:3000/course；目前沒有 accepted result.json，待匯入值維持空白，不能把列舉值說成 current result。按鈕定位：從備份還原、重設本機進度；來源是 JSON 與 browser-local progress，成功更新畫面，失敗時原紀錄保持，不執行 Python。操作：先讀左側 current crop，再按右側欄位或按鈕順序朗讀；每個欄位都說明來源、值／單位、作用、成功變化與失敗不變項。預期：畫面只呈現目前 empty state、Leo scene 或 browser-local progress；成功操作才更新局部 UI，不能改寫 runner artifact。解讀：endpoint result、provider scene 與進度備份分層保存；空 endpoint replay 不升格為 accepted replay。復原：匯入缺失、identity mismatch 或按鈕失敗時保留原 state，回到 README 與 result.json 配對條件。轉場：下一頁繼續相同來源與 claim boundary，先確認資料是否已匯入，再讀下一組欄位。

P097-A｜provider replay controls 一：播放與暫停
14:12 live Evidence 有 Leo scene 但 endpoint replay 空白；play 與 pause 只作 replay controls 契約說明。provider cursor identity 保持獨立。

說法：這是 2026-08-11 14:12 live capture，網址為 http://120.126.151.102:3000/course；目前沒有 accepted result.json，待匯入值維持空白，不能把列舉值說成 current result。按鈕定位：播放結果、暫停重播；來源是 provider frames，值為 playback cursor，成功更新 cursor，失敗時原 cursor 保持。操作：先讀左側 current crop，再按右側欄位或按鈕順序朗讀；每個欄位都說明來源、值／單位、作用、成功變化與失敗不變項。預期：畫面只呈現目前 empty state、Leo scene 或 browser-local progress；成功操作才更新局部 UI，不能改寫 runner artifact。解讀：endpoint result、provider scene 與進度備份分層保存；空 endpoint replay 不升格為 accepted replay。復原：匯入缺失、identity mismatch 或按鈕失敗時保留原 state，回到 README 與 result.json 配對條件。轉場：下一頁繼續相同來源與 claim boundary，先確認資料是否已匯入，再讀下一組欄位。

P097-B｜provider replay controls 二：滑桿與端點 selector
14:12 live Evidence 的 endpoint replay 尚未匯入；slider／鄰接畫面與 endpoint selector 分開說明。兩層 frame identity 不混讀。

說法：這是 2026-08-11 14:12 live capture，網址為 http://120.126.151.102:3000/course；目前沒有 accepted result.json，待匯入值維持空白，不能把列舉值說成 current result。按鈕定位：slider／上一／下一畫面、endpoint selector；來源是 provider frames 與 endpoint frames，成功更新相應 frame，失敗時原 identity 保持。操作：先讀左側 current crop，再按右側欄位或按鈕順序朗讀；每個欄位都說明來源、值／單位、作用、成功變化與失敗不變項。預期：畫面只呈現目前 empty state、Leo scene 或 browser-local progress；成功操作才更新局部 UI，不能改寫 runner artifact。解讀：endpoint result、provider scene 與進度備份分層保存；空 endpoint replay 不升格為 accepted replay。復原：匯入缺失、identity mismatch 或按鈕失敗時保留原 state，回到 README 與 result.json 配對條件。轉場：下一頁繼續相同來源與 claim boundary，先確認資料是否已匯入，再讀下一組欄位。

P098-A｜replay fields 五至六
14:12 live Lab A 尚未匯入。Elapsed 與 Contact ID 是待 replay 欄位契約，未見 frame 不補值。

說法：這是 2026-08-11 14:12 live capture，網址為 http://120.126.151.102:3000/course；目前沒有 accepted result.json，待匯入值維持空白，不能把列舉值說成 current result。欄位定位：Elapsed、Contact ID；來源是 trace 與 fallback contact，單位為秒與識別字串，成功跟隨 frame，失敗時原值保持。操作：先讀左側 current crop，再按右側欄位或按鈕順序朗讀；每個欄位都說明來源、值／單位、作用、成功變化與失敗不變項。預期：畫面只呈現目前 empty state、Leo scene 或 browser-local progress；成功操作才更新局部 UI，不能改寫 runner artifact。解讀：endpoint result、provider scene 與進度備份分層保存；空 endpoint replay 不升格為 accepted replay。復原：匯入缺失、identity mismatch 或按鈕失敗時保留原 state，回到 README 與 result.json 配對條件。轉場：下一頁繼續相同來源與 claim boundary，先確認資料是否已匯入，再讀下一組欄位。

P098-B｜replay fields 七至八
14:12 live Lab A 尚未匯入。Contact 與 ordinal Quality 是待 replay 欄位契約，Quality 不宣稱 dB 量測。

說法：這是 2026-08-11 14:12 live capture，網址為 http://120.126.151.102:3000/course；目前沒有 accepted result.json，待匯入值維持空白，不能把列舉值說成 current result。欄位定位：Contact、Quality；來源是 contact state 與 frame quality，值為 open／closed 與 ordinal band，成功更新欄位，失敗時原 frame 保持。操作：先讀左側 current crop，再按右側欄位或按鈕順序朗讀；每個欄位都說明來源、值／單位、作用、成功變化與失敗不變項。預期：畫面只呈現目前 empty state、Leo scene 或 browser-local progress；成功操作才更新局部 UI，不能改寫 runner artifact。解讀：endpoint result、provider scene 與進度備份分層保存；空 endpoint replay 不升格為 accepted replay。復原：匯入缺失、identity mismatch 或按鈕失敗時保留原 state，回到 README 與 result.json 配對條件。轉場：下一頁繼續相同來源與 claim boundary，先確認資料是否已匯入，再讀下一組欄位。

P099-A｜控制契約一：Prepare 與 Import
Prepare 與 Import controls 讀取 terminal receipt、repository、source 與 identity，成功後更新 browser-local status 或 import state。驗證失敗時原 state 保持。

說法：這是 2026-08-11 14:12 live capture，網址為 http://120.126.151.102:3000/course；目前沒有 accepted result.json，待匯入值維持空白，不能把列舉值說成 current result。按鈕定位：開啟套件、記錄 READY、記錄備用環境、匯入狀態；成功更新 browser-local status 或 import state，驗證失敗時原 state 保持。操作：先讀左側 current crop，再按右側欄位或按鈕順序朗讀；每個欄位都說明來源、值／單位、作用、成功變化與失敗不變項。預期：畫面只呈現目前 empty state、Leo scene 或 browser-local progress；成功操作才更新局部 UI，不能改寫 runner artifact。解讀：endpoint result、provider scene 與進度備份分層保存；空 endpoint replay 不升格為 accepted replay。復原：匯入缺失、identity mismatch 或按鈕失敗時保留原 state，回到 README 與 result.json 配對條件。轉場：下一頁繼續相同來源與 claim boundary，先確認資料是否已匯入，再讀下一組欄位。

P099-B｜控制契約二：Replay 與進度備份
Replay 與進度備份 controls 讀寫 selected frame、cursor、本機存檔點與 lineage。成功後更新對應畫面或 record，失敗時原值保留。

說法：這是 2026-08-11 14:12 live capture，網址為 http://120.126.151.102:3000/course；目前沒有 accepted result.json，待匯入值維持空白，不能把列舉值說成 current result。按鈕定位：播放／暫停／slider、上一／下一畫面、endpoint selector、下載／還原／存檔點；各自只寫 cursor、frame 或本機 record。操作：先讀左側 current crop，再按右側欄位或按鈕順序朗讀；每個欄位都說明來源、值／單位、作用、成功變化與失敗不變項。預期：畫面只呈現目前 empty state、Leo scene 或 browser-local progress；成功操作才更新局部 UI，不能改寫 runner artifact。解讀：endpoint result、provider scene 與進度備份分層保存；空 endpoint replay 不升格為 accepted replay。復原：匯入缺失、identity mismatch 或按鈕失敗時保留原 state，回到 README 與 result.json 配對條件。轉場：下一頁繼續相同來源與 claim boundary，先確認資料是否已匯入，再讀下一組欄位。

P099-C｜控制契約三：Task 與證據狀態
Task controls 讀取 evidence condition，寫入 completion 與 lock。進度備份只保存本機進度與 A／B／C 匯入紀錄，不執行 Python。

說法：這是 2026-08-11 14:12 live capture，網址為 http://120.126.151.102:3000/course；目前沒有 accepted result.json，待匯入值維持空白，不能把列舉值說成 current result。按鈕定位：task checkbox、檢查證據並繼續、證據已鎖定、fallback loader；成功更新 completion／focus／lock／source，失敗時原 state 保持。操作：先讀左側 current crop，再按右側欄位或按鈕順序朗讀；每個欄位都說明來源、值／單位、作用、成功變化與失敗不變項。預期：畫面只呈現目前 empty state、Leo scene 或 browser-local progress；成功操作才更新局部 UI，不能改寫 runner artifact。解讀：endpoint result、provider scene 與進度備份分層保存；空 endpoint replay 不升格為 accepted replay。復原：匯入缺失、identity mismatch 或按鈕失敗時保留原 state，回到 README 與 result.json 配對條件。轉場：下一頁繼續相同來源與 claim boundary，先確認資料是否已匯入，再讀下一組欄位。
