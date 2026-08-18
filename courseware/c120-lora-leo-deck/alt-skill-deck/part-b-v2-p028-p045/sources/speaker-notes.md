# Part B V2 speaker notes (P028–P045)

## P028｜無線狀態與停留時間（Radio state）

這一張先建立狀態 vocabulary。低功耗休息 `SLEEP` 的功率較低；清醒閒置 `WAIT` 會累積醒著閒置；喚醒 `WAKE` 與封包處理 `PROCESS` 是轉換或處理區間；發射 `TX` 與接收 `RX` 是收發區間。每個狀態由 runner events 保存停留秒數與事件能量，之後才能把動作 `action` 連到 state interval、energy bucket 與端點 J。動作名稱只記一次，不能代替完整狀態帳本。

## P029｜實驗 A：空檔策略的服務與能量

這一張說明為何做實驗 A。固定同一份工作、scenario、seed、traffic、service window、endpoint scope、runner、schema 與 Lab B/C 區塊，只把 `student_policy.py` 的 `lab-a-pace-rest` 中 `REST_DURING_GAP` 由 `SLEEP` 改成 `WAIT`。`SLEEP` 降低空檔功率但可能支付 `WAKE`；`WAIT` 保持清醒閒置，可能少喚醒卻增加 awake-idle J。每次成功要看 stdout 的 `status=OK` 與新 `result_path`，再讀同一 generated run 目錄的 `result.json` 與 `endpoint-replay.json`，順序是服務、封包、狀態、J。

## P030｜封包生命週期：嘗試不等於交付

封包先建立 `generated`，再進入 `queue` 等待合法窗口；策略動作造成 `attempt`，碰撞 `collision` 可能產生 `retry`；最後才有 `delivered` 或 `expired`。嘗試封包數、重傳次數、交付位元與過期封包各有來源與單位，服務通過 `service_pass` 還要共同檢查必要封包、期限與新鮮度。送出次數只能說明嘗試，不是交付或服務成功。

## P031｜服務門檻先於端點能量

公平比較先固定 scenario、seed、traffic、window 與 endpoint scope，再看交付位元 `delivered_bits`、期限 `deadline_pass`、新鮮度 `freshness_status` 與服務通過 `service_pass`。服務門檻先回答工作是否在期限內完成；只有在相同邊界且服務條件清楚時，端點能量 `endpoint_energy_j` 才能用來描述取捨。較低 J 不會自動變成服務成功。

## P032｜功率 W × 時間 s 形成能量 J

功率 P 是狀態當下的高度，單位 W；時間 t 是狀態區間的長度，單位 s；兩者相乘才形成能量 J。每個 bucket 分開保存 awake_idle、sleep、wake、process、tx、rx，WAIT 與 SLEEP 使用固定 10 s 時鐘步長，收發流程另有轉換能量。讀值時保留功率、停留時間與 bucket，避免用單一峰值代替整段累積。

## P033｜端點能量的累積公式

端點能量 `E_endpoint` 的可編輯 Office Math 公式是各狀態功率 `P_s` 與停留時間 `t_s` 的分段累積。`P_s` 單位為 W，來自 energy profile；`t_s` 單位為 s，來自 `STATE_INTERVAL`；結果摘要的 `endpoint_energy_j` 單位為 J。這個 endpoint scope 只涵蓋宣告的 radio 與 processing 狀態及轉換，不包含衛星、閘道或整體插座功率。

## P034｜端點能量效率的 bit/J 邊界

端點效率 `η_E` 的分子是交付資料 `D_delivered`，單位 bit；分母是端點能量 `E_endpoint`，單位 J；結果單位 bit/J。兩者必須來自同一份 result artifact 與同一 endpoint boundary。`service_pass` 與 `deadline_pass` 仍是獨立判定，因此 bit/J 變高不能覆寫服務失敗。

## P035｜來源、模型、課程假設與結果

來源 `Source` 是可追溯的上游 repository／commit 參考，不等於本次量測；模型 `Model` 是固定 runner 行為的課程模擬轉接器；課程假設 `Course` 固定 scenario、window、traffic 與 endpoint profile；結果 `Result` 保存本次 JSON 與同次 replay。`upstream_execution=false` 表示不是上游即時執行，所有數值回到產物與宣告的 claim boundary。

## P036｜執行、事件重播與工作簿的身分鏈

執行 `RUN` 讀 scenario、case 與 policy，輸出 `result.json` 與同目錄 `endpoint-replay.json`。事件重播 `REPLAY` 只讀同一次 run 的 events，顯示 action、radio state、queue 與 packet，不重新執行 policy。比較紀錄 `WORKBOOK` 保存 prediction、baseline、candidate、freeze、withheld 與 result／replay lineage。匯入前核對 `scenario_id`、`run_id`、policy identity、units 與 provenance；任一 mismatch 都維持 fail closed。

## P037｜基準 Baseline：固定條件的對照執行

基準 `Baseline` 使用固定 scenario、seed、traffic、window 與 endpoint scope，保留原始 `student_policy.py` 作為 control。唯一變動只能是目前實驗的 marked block，輸出再觀察 state duration、packet outcome、service verdict 與 endpoint J。兩次結果的身分、單位與端點範圍必須一致，差異才可回到該標記區塊解釋。

## P038｜LEO 的變動服務窗口軌跡

LEO 在本模組只提供變動服務窗口軌跡。`contact_open` 是窗口是否開啟的布林狀態；`quality_band` 是 0–3 的品質分類，不是 dB；`contact_remaining_s` 是剩餘秒數。三者由固定 scenario trace 進入 policy observation；窗口關閉時只接受 `SLEEP`，窗口開啟時品質與剩餘時間共同改變動作的服務機會。

## P039｜實驗 A：為何改 REST_DURING_GAP

實驗 A 的目的，是在固定工作與服務窗口下檢驗一個可反駁機制。檔案是 `student_policy.py`，標記區塊是 `lab-a-pace-rest`；基準為 `REST_DURING_GAP=SLEEP`，候選只改成 `WAIT`。固定 `PACE_GAP_STEPS=2`、scenario、seed、traffic、window、runner、schema 與 Lab B/C 區塊。成功訊號是 stdout `status=OK` 與新 `result_path`；同一目錄有 `result.json` 與 `endpoint-replay.json`。匯入或檢視時依服務、封包、狀態、J 順序讀取。

## P040｜A-00：基準決策與對照證據

基準的 `student_policy.py`／`lab-a-pace-rest` 保持 `PACE_GAP_STEPS=2` 與 `REST_DURING_GAP=SLEEP`。窗口未開時 `contact_open=false` 回傳 `SLEEP`；送出間隔不足時回傳空檔策略。Linux／macOS 終端機或 WSL 執行 `bash course.sh run --lab A --case baseline`；成功 stdout 印出 `status=OK` 與新的 `result_path`，同目錄產生 `result.json` 與 `endpoint-replay.json`。先讀 summary／events，再讀 replay。6.92 J、4,800 bit、service false 是參考摘要，實際數值以該 path 為準；基準建立 before 對照，不回答是否省電。

## P041｜A-01：只改 REST_DURING_GAP

這一張的唯一 edit 是 `student_policy.py` 的 `lab-a-pace-rest`：把 `REST_DURING_GAP = SLEEP` 改成 `REST_DURING_GAP = WAIT`。`PACE_GAP_STEPS=2`、其他 marked blocks、runner、scenario、schema 與 generated JSON 都保持不變。Linux／macOS 終端機或 WSL 先執行 `cp student_policy.py student_policy.before-A-edit.py`，再執行 `.venv/bin/python -m py_compile student_policy.py`；Windows 使用 `copy /Y` 與 `.venv\Scripts\python.exe -m py_compile`。成功是無語法錯誤且回傳碼 0；這一張只做編輯檢查，下一張才取得 run 的 result_path。預測是 WAIT 可能減少 WAKE 但增加 awake-idle，方向必須由後續 state、packet、service、J 證據決定。

## P042｜A-02：基準 → 候選 → 隱藏檢查

這是實驗 A 唯一的執行與 receipt 頁。第一步不改 policy 執行 `bash course.sh run --lab A --case baseline` 或 Windows `course.cmd`，成功要有 `status=OK` 與新 `result_path`。第二步完成 P041 的 WAIT edit，執行 candidate `--freeze`；成功除新 path 外，還要有 `artifacts/checkpoints/lab-a-frozen.json` 與 `.py`。第三步保持凍結策略執行 hidden，不再編輯；成功只接受新的 path，不建立第二個 freeze。每個 path 讀同一 generated 目錄的 result 與 replay，順序是服務、封包、狀態、J；缺少 freeze 就停止 hidden。

## P043｜同一邊界的改前／改後

三次 evidence 都從 P042 stdout 的 result_path 讀取；比較前核對 scenario_id、seed、policy identity、units、provenance 與 endpoint scope。baseline SLEEP：service=false、deadline=false、delivered=1/4、retries=1、collisions=1、expired=3、wake=2、endpoint=6.92 J、bit/J=693.641618。candidate WAIT：service=false、deadline=false、delivered=1/4、retries=1、collisions=1、expired=3、wake=1、endpoint=8.86 J、bit/J=541.760722。hidden frozen WAIT：service=false、deadline=false、delivered=0/3、retries=0、collisions=0、expired=3、wake=0、endpoint=3.61 J、bit/J=0。WAIT 沒改善服務，且 endpoint 多耗 1.94 J；hidden 的低 J 來自完全未送達，不能視為節能成功。

## P044｜A-04：狀態帳本回到端點能量

使用 candidate 的 result_path，先在 events 找 `STATE_INTERVAL` 的 WAIT／SLEEP 停留秒數，再找 `WAKE` 轉換，最後對照 `energy_breakdown_j`。參考 bucket 是 awake_idle 6.00 J、sleep 0.04 J、wake 0.02 J、process 0.16 J、tx 2.40 J、rx 0.24 J；實際數值以本次 artifact 為準。解釋句要指出哪個狀態區間增加或減少、哪個 bucket 因而改變，才能把 WAIT 的機制連回 endpoint J。

## P045｜封包結果回到服務判定

先把 baseline SLEEP 與 candidate WAIT 對齊：delivered 皆為 1/4、retries=1、collisions=1、expired=3、deadline=false、service=false；WAIT 只讓 wake 由 2 降到 1，endpoint 卻由 6.92 J 升到 8.86 J（+1.94 J），bit/J 由 693.641618 降到 541.760722。hidden frozen WAIT 是 delivered=0/3、retries=0、collisions=0、expired=3、wake=0、endpoint=3.61 J、bit/J=0，低 J 的原因是完全未送達，不是節能成功。使用各自 P042 stdout result_path 的 result.json 與配對 endpoint-replay.json；服務門檻先於端點 J，嘗試或較低 J 都不能覆寫 service=false。
