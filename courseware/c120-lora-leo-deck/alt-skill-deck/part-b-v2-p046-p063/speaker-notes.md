# Part B V2 P046-P063 speaker notes

## P046

P046。A candidate 將 Lab A 的 marked value 改為 WAIT 後，以 `--freeze` 產生 receipt 與 checkpoint。receipt 記錄 policy identity、scenario、seed role 與 active block；checkpoint 保存可復原的 policy source。hidden 不再改 policy，只在同一 frozen identity 下讀取另一個 case。這個 lineage 讓後續差異可以回到條件與事件，而不是混入新的 edit。 目前 evidence 尚待取得，數值欄位維持待補；讀取時使用本次 stdout 印出的 result_path，並以同一產物目錄的 endpoint-replay.json 配對。若 receipt 或 checkpoint 缺失，先從 baseline policy 還原，重新執行 A candidate 的 `--freeze`；尚未取得配對 identity 前不進 hidden。 資料分類維持 SIMULATED TEACHING DATA / NOT LIVE / NOT MEASURED / NOT CANONICAL-PARITY-VERIFIED。

## P047

P047。A hidden 只替換 case 條件，不替換 frozen policy。讀取 command stdout 的 `result_path`，再配對同一 run 目錄的 `endpoint-replay.json`。如果 service、delivery 或 endpoint J 方向改變，這是對條件邊界的資訊；結論不延伸成所有 window 或 traffic 都相同。 目前 evidence 尚待取得，數值欄位維持待補；讀取時使用本次 stdout 印出的 result_path，並以同一產物目錄的 endpoint-replay.json 配對。若 hidden path 缺失，從 `artifacts/checkpoints/lab-a-frozen.py` 還原 policy，重新執行 exact hidden case，使用新 stdout result_path。 資料分類維持 SIMULATED TEACHING DATA / NOT LIVE / NOT MEASURED / NOT CANONICAL-PARITY-VERIFIED。

## P048

P048。Lab A 收束時，`state_interval` 來自 result events，單位是秒；它把 WAIT 或 SLEEP 的 action 接到後續時間與 energy bucket。接著讀 packet delivery、service gate 與同一 result 的 `endpoint_energy_j`。這種讀法保留 mechanism、service 與端點 scope，避免把單一 J 值當成完整結論。 目前 evidence 尚待取得，數值欄位維持待補；讀取時使用本次 stdout 印出的 result_path，並以同一產物目錄的 endpoint-replay.json 配對。若三個 result／replay pair 的 identity 無法配對，回到 A freeze gate，重新取得正確 stdout result_path；不手改 JSON。 資料分類維持 SIMULATED TEACHING DATA / NOT LIVE / NOT MEASURED / NOT CANONICAL-PARITY-VERIFIED。

## P049

P049。Lab B 使用 LoRaEnergySim 的 energy-state vocabulary 來串起 quality observation、MODE_CHANGE、packet outcome 與 endpoint energy。這使 hold 參數不只是品質分數，而能沿事件鏈追問何時進入 send-ready、是否取得傳送機會、是否付出 retry 或 radio／processing 成本。LEO 只提供 changing service window 的情境輸入；本套件的結果是固定 scenario 的 simulated teaching data。 目前 evidence 尚待取得，數值欄位維持待補；讀取時使用本次 stdout 印出的 result_path，並以同一產物目錄的 endpoint-replay.json 配對。若前序 A policy 不是 frozen，先還原 `artifacts/checkpoints/lab-a-frozen.py`，完成 compile 後再開始 Lab B。 資料分類維持 SIMULATED TEACHING DATA / NOT LIVE / NOT MEASURED / NOT CANONICAL-PARITY-VERIFIED。

## P050

P050。Lab B 的實際檔案是 `student_policy.py`，作用區塊是 `lab-b-enter-exit-hold`。ENTER_QUALITY=2 與 EXIT_QUALITY=1 先保持不動；本 lab 的唯一 edit 是 STABLE_STEPS。Lab A 的 frozen block、Lab C block、runner、scenario 與 schema 都是固定條件。這個界線讓後續結果可歸因於一個變數。 目前 evidence 尚待取得，數值欄位維持待補；讀取時使用本次 stdout 印出的 result_path，並以同一產物目錄的 endpoint-replay.json 配對。若 marked block 或 predecessor identity 與頁面不同，先停止執行，從 A frozen checkpoint 恢復，再檢查 package baseline。 資料分類維持 SIMULATED TEACHING DATA / NOT LIVE / NOT MEASURED / NOT CANONICAL-PARITY-VERIFIED。

## P051

P051。Before code 顯示 B marked block 的五行相關內容。ENTER_QUALITY=2 定義品質達標；EXIT_QUALITY=1 定義已進入後的保持下限。STABLE_STEPS=2 則要求同一正品質連續出現兩個固定 step，才可進入 send-ready。只有這個數值屬於本頁之後的 edit。 目前 evidence 尚待取得，數值欄位維持待補；讀取時使用本次 stdout 印出的 result_path，並以同一產物目錄的 endpoint-replay.json 配對。先保持 baseline policy 不變，執行 Trace A baseline；stdout 印出的 result_path 是之後比較的基準。 資料分類維持 SIMULATED TEACHING DATA / NOT LIVE / NOT MEASURED / NOT CANONICAL-PARITY-VERIFIED。

## P052

P052。After code 顯示相同的 B block，只有數字 1 被標示為 changed value。ENTER_QUALITY、EXIT_QUALITY、中文註解、Lab A frozen block、Lab C block、runner、scenario、schemas 與檔案格式都保持原樣。這是一個 bounded edit；候選效果要由 Trace A candidate 的事件與結果驗證。 目前 evidence 尚待取得，數值欄位維持待補；讀取時使用本次 stdout 印出的 result_path，並以同一產物目錄的 endpoint-replay.json 配對。存檔後先做 compile，再執行 Trace A candidate 的 `--freeze`；若多於一個值改變，回到 baseline policy 重做。 資料分類維持 SIMULATED TEACHING DATA / NOT LIVE / NOT MEASURED / NOT CANONICAL-PARITY-VERIFIED。

## P053

P053。Baseline 的 STABLE_STEPS=2 需要兩個連續穩定觀測；第一次達標只開始累積，第二次仍穩定才記錄 MODE_CHANGE。Candidate 的值為 1，第一次達標就可能進入 send-ready。這個機制只改變 decision timing；封包是否送達仍由窗口、runner 與 packet outcome 決定。 目前 evidence 尚待取得，數值欄位維持待補；讀取時使用本次 stdout 印出的 result_path，並以同一產物目錄的 endpoint-replay.json 配對。Trace A 要讀 MODE_CHANGE 的時間，再讀 packet、service 與 endpoint J；若沒有事件證據，不把 timing prediction 當成結果。 資料分類維持 SIMULATED TEACHING DATA / NOT LIVE / NOT MEASURED / NOT CANONICAL-PARITY-VERIFIED。

## P054

P054。Trace A 比較的前提是 A frozen predecessor。Baseline 使用 STABLE_STEPS=2；candidate 只改為 1，並以 `--freeze` 產生 B checkpoint；Trace B 維持這個 frozen policy，改看 withheld case。預測是可被反駁的工作假設：較早進入可能增加 service opportunity，也可能增加 radio／processing 成本。 目前 evidence 尚待取得，數值欄位維持待補；讀取時使用本次 stdout 印出的 result_path，並以同一產物目錄的 endpoint-replay.json 配對。執行順序不可交換；candidate freeze 缺失時不進 Trace B，先恢復 A checkpoint 並重跑 candidate freeze。 資料分類維持 SIMULATED TEACHING DATA / NOT LIVE / NOT MEASURED / NOT CANONICAL-PARITY-VERIFIED。

## P055

P055。Linux 與 macOS 終端機使用 `bash course.sh`；WSL 同樣使用這組 Linux launcher。第一條建立 Trace A baseline；第二條在 STABLE_STEPS=1 的 policy 下建立 candidate freeze；第三條保持 B frozen 執行 Trace B。每一條成功命令都在 stdout 印出本次 `result_path`，後續以該路徑找 result.json。 目前 evidence 尚待取得，數值欄位維持待補；讀取時使用本次 stdout 印出的 result_path，並以同一產物目錄的 endpoint-replay.json 配對。若命令失敗，保留 stdout／stderr；candidate freeze 缺失時不執行 Trace B，先回到 A checkpoint 並重做 candidate。 資料分類維持 SIMULATED TEACHING DATA / NOT LIVE / NOT MEASURED / NOT CANONICAL-PARITY-VERIFIED。

## P056

P056。Windows PowerShell 以 ` .\course.cmd ` 呼叫三個 Lab B cases；Command Prompt 以 `course.cmd` 呼叫同樣三個參數。PowerShell 版本的前綴包含 `.` 與反斜線；Command Prompt 版本不含這個前綴。案例順序保持 baseline、candidate `--freeze`、Trace B，stdout 仍是 result_path 的唯一選取入口。 目前 evidence 尚待取得，數值欄位維持待補；讀取時使用本次 stdout 印出的 result_path，並以同一產物目錄的 endpoint-replay.json 配對。若 shell 解析錯誤，改用該 shell 的完整 launcher，不混用引號或換行；保留錯誤後重新執行 exact case。 資料分類維持 SIMULATED TEACHING DATA / NOT LIVE / NOT MEASURED / NOT CANONICAL-PARITY-VERIFIED。

## P057

P057。每次成功 run 的 stdout 都會印出 `result_path`。該路徑指向 `artifacts/<run_id>/result.json`；同一目錄的 `endpoint-replay.json` 保存 state、queue 與 packet 的回放資料。candidate 加上 `--freeze` 時，另外保存 receipt 與 checkpoint。policy checkpoint 用來恢復 lineage，不能代替遺失的 result。 目前 evidence 尚待取得，數值欄位維持待補；讀取時使用本次 stdout 印出的 result_path，並以同一產物目錄的 endpoint-replay.json 配對。若 result 或 replay 缺一，保留原始 stdout path，不手改 JSON；回到最後一個有效 checkpoint，重跑 exact case 取得新的 pair。 資料分類維持 SIMULATED TEACHING DATA / NOT LIVE / NOT MEASURED / NOT CANONICAL-PARITY-VERIFIED。

## P058

P058。結果判讀固定採四層順序。第一層 service 讀 deadline、freshness 與 delivery；第二層 packet 讀 attempted、retry、collision 與 delivered；第三層 state 讀 MODE_CHANGE 與 WAIT／SLEEP／PROCESS／TX／RX 的時間；第四層讀 endpoint_energy_j。endpoint J 只描述 endpoint radio／processing scope，不是 LEO 或整個 system energy。 目前 evidence 尚待取得，數值欄位維持待補；讀取時使用本次 stdout 印出的 result_path，並以同一產物目錄的 endpoint-replay.json 配對。若 service_pass、packet 或 state 欄位缺失，先確認 result／replay 是同一 run pair，再進行解讀。 資料分類維持 SIMULATED TEACHING DATA / NOT LIVE / NOT MEASURED / NOT CANONICAL-PARITY-VERIFIED。

## P059

P059。Trace A current evidence 顯示：STABLE_STEPS 由 2 改成 1 後，delivered 從 1/4 增至 3/4，expired 從 3 降至 1；retries 與 collisions 都維持 1。endpoint energy 從 8.86 J 增至 10.66 J，增加 1.80 J，但 service_pass 仍為 false。因此 candidate 改善送達數，不等於完成 service gate。 這組數值來自 current Trace A baseline／candidate result pair；後續仍以同一 run 的 replay 對照 MODE_CHANGE 與 state interval，不把 service false 寫成成功。 資料分類維持 SIMULATED TEACHING DATA / NOT LIVE / NOT MEASURED / NOT CANONICAL-PARITY-VERIFIED。

## P060

P060。Trace B 沿用 Trace A candidate 的 frozen policy，但 current evidence 顯示 delivered 只有 1/3、expired 為 2、service_pass 仍為 false、endpoint energy 為 5.43 J。Trace B 沒有通過 service，因此 5.43 J 只能描述這個 withheld case 的端點成本，不能覆蓋服務失敗，也不能支持整體改善。 保持 B checkpoint 與 policy identity 不變；若 B evidence pair 缺失，先恢復 A predecessor，重新執行 Trace A candidate `--freeze`，再跑 Trace B。 資料分類維持 SIMULATED TEACHING DATA / NOT LIVE / NOT MEASURED / NOT CANONICAL-PARITY-VERIFIED。

## P061

P061。current evidence 的 Lab B 結論是條件式的：Trace A candidate 將 delivered 從 1/4 提高到 3/4、expired 從 3 降到 1，但 endpoint energy 從 8.86 J 增至 10.66 J，且 service_pass 仍為 false。Trace B 使用 frozen candidate，delivered 只有 1/3、expired 為 2、endpoint energy 為 5.43 J，service_pass 同樣為 false。因此 candidate 增加送達並不等於整體改善；Trace B 未通過 service，不能宣稱跨 case 的改善。LoRaEnergySim energy ledger 的幫助在於把這個送達／成本／服務 trade-off 放在同一條可追溯鏈。 保留 B freeze 與兩組 result／replay identity；若欄位不符，回到 B freeze gate，不重新改 policy。 資料分類維持 SIMULATED TEACHING DATA / NOT LIVE / NOT MEASURED / NOT CANONICAL-PARITY-VERIFIED。

## P062

P062。中斷復原分成 copy、compile、exact rerun、new pair 四步。Linux／macOS 終端機與 WSL 使用 cp 和 `.venv/bin/python`；Windows Command Prompt 使用 copy /Y 和 `.venv\Scripts\python.exe`。copy 只恢復 B frozen policy，compile 只確認語法；同一 case 重新 run 才會取得新的 result_path 與同目錄 replay。 目前 evidence 尚待取得，數值欄位維持待補；讀取時使用本次 stdout 印出的 result_path，並以同一產物目錄的 endpoint-replay.json 配對。若缺少 result 或 replay，不手改 artifact；從最後一個 identity 正確的 checkpoint 恢復，依原 case contract 重新執行。 資料分類維持 SIMULATED TEACHING DATA / NOT LIVE / NOT MEASURED / NOT CANONICAL-PARITY-VERIFIED。

## P063

P063。匯入 /course 時，選擇 stdout 的 `result_path` 所指向的 `result.json`，不要上傳 policy source。網站驗證 schema、scenario、case、units、policy lineage 與 provenance；通過後讀取同一目錄的 `endpoint-replay.json`，把 service、packet、state 與 endpoint J 保存到 workbook。讀取順序仍是 service → packet → state → endpoint J。identity、unit 或 provenance 不符時 fail closed，原 workbook 不變。 目前 evidence 尚待取得，數值欄位維持待補；讀取時使用本次 stdout 印出的 result_path，並以同一產物目錄的 endpoint-replay.json 配對。若匯入失敗，保留錯誤與原始 stdout path；回到中斷復原步驟重跑 exact case，取得新的 result／replay pair，不手改 JSON。 資料分類維持 SIMULATED TEACHING DATA / NOT LIVE / NOT MEASURED / NOT CANONICAL-PARITY-VERIFIED。
