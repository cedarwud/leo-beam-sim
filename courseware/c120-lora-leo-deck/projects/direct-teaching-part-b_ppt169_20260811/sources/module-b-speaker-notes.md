# Direct-teaching Part B speaker notes (P028–P063)

## P028 — Radio state 與停留時間：endpoint energy 的積分基礎

Point：Radio state 與停留時間：endpoint energy 的積分基礎。Say：P028。沿著 state 帶說明每個名稱如何對應 result 的 interval 與 energy bucket。Do：在 固定情境與前一頁保持一致 依序執行或讀取：依頁面上的操作順序讀取既有證據。Why：建立 state vocabulary、觸發條件、duration 與 energy bucket 的對照。。Mechanism：SLEEP 是低功耗休息；WAIT 是 awake idle；WAKE、PROCESS、TX、RX 都會留下時間與功率。。Expect：完整 ledger 由 state interval、power、duration 與 endpoint J 組成；action 名稱只標記一次決策。。Interpret：結果符合預期時，將它解讀為 FALLBACK ARTIFACT｜SIMULATED；結果不符時，保留 stdout、result 與 replay。Transition：接著把這個 evidence 帶到下一個 result／replay gate。Recovery：result／replay 不成 pair 時保留錯誤，回到該次 stdout result_path，不手改 JSON。

## P029 — Lab A：SLEEP 與 WAIT 的 service／energy 比較

Point：Lab A：SLEEP 與 WAIT 的 service／energy 比較。Say：P029。判斷 J 下降但 service_pass 變成 false 時，是否稱為節能成功。Do：在 固定情境與前一頁保持一致 依序執行或讀取：依頁面上的操作順序讀取既有證據。Why：固定挑戰、成功 gate 與一個 exact edit。。Mechanism：SLEEP 降低 idle power 並支付 wake；WAIT 維持 awake idle 並增加 awake-idle；service 與整段 J 共同形成結果。。Expect：固定 scenario／seed／traffic／window／endpoint boundary，再讀 delivered、deadline、freshness 與 endpoint J。。Interpret：結果符合預期時，將它解讀為 LAB A MECHANISM｜SIMULATED TEACHING DATA；結果不符時，保留 stdout、result 與 replay。Transition：接著把這個 evidence 帶到下一個 result／replay gate。Recovery：保留 stdout／stderr；用 A checkpoint 或同 scenario fallback 恢復，不再調參。

## P030 — 封包生命週期：送出與交付分開判定

Point：封包生命週期：送出與交付分開判定。Say：P030。一次 SEND 是 policy decision，不等於 service 已交付。Do：在 固定情境與前一頁保持一致 依序執行或讀取：依頁面上的操作順序讀取既有證據。Why：packet ledger 定義交付事件；energy ledger 定義 endpoint 累積。。Mechanism：generated → queue → attempt → collision／retry → delivered 或 expired → service verdict。。Expect：attempted、retransmissions、unique_delivered、expired 與 deadline 必須一起讀。。Interpret：結果符合預期時，將它解讀為 FALLBACK ARTIFACT｜SIMULATED；結果不符時，保留 stdout、result 與 replay。Transition：接著把這個 evidence 帶到下一個 result／replay gate。Recovery：result／replay 不成 pair 時保留錯誤，回到該次 stdout result_path，不手改 JSON。

## P031 — Service gate 與 endpoint J 的比較順序

Point：Service gate 與 endpoint J 的比較順序。Say：P031。service gate 決定 endpoint J 的解讀層級；低 J 維持為單一觀察值。Do：在 固定情境與前一頁保持一致 依序執行或讀取：依頁面上的操作順序讀取既有證據。Why：防止少做工作被誤教成更有效率。。Mechanism：same identity → delivered／deadline／freshness → service_pass → endpoint J。。Expect：兩次結果須有相同 scenario、job、window、traffic 與 endpoint scope。。Interpret：結果符合預期時，將它解讀為 BOUNDARY RULE｜SIMULATED TEACHING DATA；結果不符時，保留 stdout、result 與 replay。Transition：接著把這個 evidence 帶到下一個 result／replay gate。Recovery：result／replay 不成 pair 時保留錯誤，回到該次 stdout result_path，不手改 JSON。

## P032 — W 是瞬間功率，J 是整段累積

Point：W 是瞬間功率，J 是整段累積。Say：P032。低峰值拖得久仍可能累積較多 J。Do：在 固定情境與前一頁保持一致 依序執行或讀取：依頁面上的操作順序讀取既有證據。Why：把 power rate 與時間累積出的 energy 分開讀。。Mechanism：WAIT／SLEEP 使用固定 clock step；PROCESS、TX、RX、WAKE 另有 transition cost。。Expect：沿著 interval 看 duration，再把 awake_idle、sleep、wake、process、TX、RX 加回 total。。Interpret：結果符合預期時，將它解讀為 MODEL BOUNDARY｜SIMULATED；結果不符時，保留 stdout、result 與 replay。Transition：接著把這個 evidence 帶到下一個 result／replay gate。Recovery：result／replay 不成 pair 時保留錯誤，回到該次 stdout result_path，不手改 JSON。

## P033 — endpoint energy 公式只涵蓋 endpoint 邊界

Point：endpoint energy 公式只涵蓋 endpoint 邊界。Say：P033。公式定義 scope 與累積語義；本次數值來源為 result artifact。Do：在 固定情境與前一頁保持一致 依序執行或讀取：依頁面上的操作順序讀取既有證據。Why：讀懂每個 endpoint state 的功率與停留時間如何累積。。Mechanism：E_endpoint = Σ P_s t_s；endpoint scope 包含 radio／processing，不包含 satellite／gateway／whole-system wall-plug。。Expect：native Office Math 可編輯；數值仍由 result artifact 提供。。Interpret：結果符合預期時，將它解讀為 EDITABLE OFFICE MATH｜SIMULATED；結果不符時，保留 stdout、result 與 replay。Transition：接著把這個 evidence 帶到下一個 result／replay gate。Recovery：result／replay 不成 pair 時保留錯誤，回到該次 stdout result_path，不手改 JSON。

## P034 — energy efficiency 的分子與分母要同一個邊界

Point：energy efficiency 的分子與分母要同一個邊界。Say：P034。delivery gate 維持獨立；bit 與 J 僅在同一 endpoint boundary 內形成比值。Do：在 固定情境與前一頁保持一致 依序執行或讀取：依頁面上的操作順序讀取既有證據。Why：同時確認 delivered data 分子、endpoint energy 分母與 units。。Mechanism：η_E = D_delivered / E_endpoint；bit ÷ J = bit/J；service_pass 仍是獨立 gate。。Expect：native Office Math 可編輯；efficiency ratio 與 delivery、deadline verdict 分開判定。。Interpret：結果符合預期時，將它解讀為 EDITABLE OFFICE MATH｜SIMULATED；結果不符時，保留 stdout、result 與 replay。Transition：接著把這個 evidence 帶到下一個 result／replay gate。Recovery：result／replay 不成 pair 時保留錯誤，回到該次 stdout result_path，不手改 JSON。

## P035 — 來源、模型、課程假設與結果要分開

Point：來源、模型、課程假設與結果要分開。Say：P035。資料類型維持 coherent simulated result；provenance 記錄 input、policy 與 output 的關聯。Do：在 固定情境與前一頁保持一致 依序執行或讀取：依頁面上的操作順序讀取既有證據。Why：沿 scenario、seed、policy identity 與 artifact source 回溯一筆結果。。Mechanism：source → model → course assumption → result；上游 provenance 參考不等於上游程式被執行。。Expect：runner_provenance.upstream_execution=false；claim boundary 隨 artifact 保存。。Interpret：結果符合預期時，將它解讀為 PROVENANCE SPINE｜SIMULATED；結果不符時，保留 stdout、result 與 replay。Transition：接著把這個 evidence 帶到下一個 result／replay gate。Recovery：result／replay 不成 pair 時保留錯誤，回到該次 stdout result_path，不手改 JSON。

## P036 — 執行結果如何進入重播與工作簿

Point：執行結果如何進入重播與工作簿。Say：P036。配對 identity 比單一漂亮數字更重要。Do：在 固定情境與前一頁保持一致 依序執行或讀取：依頁面上的操作順序讀取既有證據。Why：確保 scenario、anchor、policy、seed 與 units 在整條鏈一致。。Mechanism：scenario package → result.json → endpoint-replay.json → Leo replay → workbook；mismatch 不猜身份。。Expect：同一 ntpu-energy-decision-01、scenario identity、anchor identity、policy identity、seed 與 units。。Interpret：結果符合預期時，將它解讀為 IDENTITY GATE｜FAIL CLOSED；結果不符時，保留 stdout、result 與 replay。Transition：接著把這個 evidence 帶到下一個 result／replay gate。Recovery：identity mismatch：保留輸入與錯誤，回到 matching artifact；不可手改 JSON。

## P037 — Baseline：固定條件下的 control execution

Point：Baseline：固定條件下的 control execution。Say：P037。Baseline 使用固定情境、隨機種子與原始 policy，作為對照執行。Do：在 固定情境與前一頁保持一致 依序執行或讀取：依頁面上的操作順序讀取既有證據。Why：固定條件，使目前 lab 僅有 marked block 變動。。Mechanism：固定 scenario／seed／traffic／window／endpoint scope；只改一個 marked block；觀察 state／packet／service／J。。Expect：若 scenario identity、traffic 或 scope 偷換，A/B 失去因果資格。。Interpret：結果符合預期時，將它解讀為 CONTROL RULE｜SIMULATED；結果不符時，保留 stdout、result 與 replay。Transition：接著把這個 evidence 帶到下一個 result／replay gate。Recovery：result／replay 不成 pair 時保留錯誤，回到該次 stdout result_path，不手改 JSON。

## P038 — LEO：changing-service-window trace 的輸入範例

Point：LEO：changing-service-window trace 的輸入範例。Say：P038。LEO 範例採用預先定義的 changing-service-window trace，作為 endpoint 傳輸時機的輸入。Do：在 固定情境與前一頁保持一致 依序執行或讀取：依頁面上的操作順序讀取既有證據。Why：為 Lab B 的 quality window 問題建立 changing opportunity 背景。。Mechanism：contact_open、quality_band、contact_remaining_s 進入 observation；窗口關閉時只接受 SLEEP。。Expect：changing-service-window trace 依序提供 closed、contact-a、closed、contact-b、closed 的輸入。。Interpret：結果符合預期時，將它解讀為 WINDOW CONTEXT｜NOT LIVE；結果不符時，保留 stdout、result 與 replay。Transition：接著把這個 evidence 帶到下一個 result／replay gate。Recovery：result／replay 不成 pair 時保留錯誤，回到該次 stdout result_path，不手改 JSON。

## P039 — Lab A：等待空檔的 radio state 比較

Point：Lab A：等待空檔的 radio state 比較。Say：P039。Lab A 固定同一工作，沿 state、packet、service、J 解釋差異。Do：在 固定情境與前一頁保持一致 依序執行或讀取：依頁面上的操作順序讀取既有證據。Why：固定 scenario、case workload、service window、seed、endpoint energy model 與 PACE_GAP_STEPS = 2。。Mechanism：SLEEP（低功耗休息）→ WAKE cost；WAIT（清醒閒置）→ awake-idle energy。唯一修改：REST_DURING_GAP = SLEEP → WAIT。。Expect：比較 state duration、wake event／energy、packet outcome、service result 與 endpoint_energy_j；唯一修改 → state 變化 → packet/service → endpoint energy。。Interpret：結果符合預期時，將它解讀為 LAB A MECHANISM｜SIMULATED；結果不符時，保留 stdout、result 與 replay。Transition：接著把這個 evidence 帶到下一個 result／replay gate。Recovery：保留 stdout／stderr；用 A checkpoint 或同 scenario fallback 恢復，不再調參。

## P040 — A-00a：Baseline decision 與 Trace evidence

Point：左卡的 contact_open=false、steps_since_send 與 REST_DURING_GAP，右卡的 stdout receipt。Say：當前頁先固定 A baseline；窗口關閉時回到 SLEEP，間隔步數不足時由 policy 常數決定 gap action。Operate：在 package root 執行 bash course.sh run --lab A --case baseline，Windows PowerShell 對應 .\course.cmd run --lab A --case baseline。Expect：stdout 讀 status、run_id、result_path、artifact_source、claim_boundary；成功時再沿 result_path 開 result.json 與同目錄 endpoint-replay.json。Interpret：baseline 是原始 policy 的 control，不先把任何 fallback 數值當 fresh run；下一頁把同一 receipt 的 summary 欄位集中讀完。Recover：命令失敗就保留 stdout／stderr，重新取得同一 case 的 path，不猜檔名。Transition：帶著 baseline result_path 進 P040a。

## P040a — A-00b：Baseline summary fields

Point：summary 卡的 fallback label 與十個欄位。Say：這組 6.92 J、4,800 bit、693.641618 bit/J、wake 2、attempt 2、retry 1、expired 3，以及 service_pass=FAIL、deadline_pass=FAIL、freshness_status=expired，是 same-scenario-fallback reference，不是 fresh run。Operate：依上一頁 stdout 的 result_path 開 artifacts/<run_id>/result.json，再開同一目錄 endpoint-replay.json；若只有 reference，就保留 reference 標籤。Expect：欄位名稱與單位逐一對上 summary.service_pass、summary.deadline_pass、summary.freshness_status、summary.delivered_bits、summary.endpoint_energy_j、summary.efficiency、wake、attempt、retry、expired。Interpret：baseline 只建立 control；service 與 deadline 都 false，不能用效率數值掩蓋未交付的 service verdict。Recover：result／replay 不是同一 run 時停止比較，回到 stdout path 重新配對。Transition：把完整 summary 帶到 A 的唯一 edit。

## P041 — A-01a：path 與 BEFORE 完整 marked block

Point：頁首的 package-relative path，以及紫色 BEFORE 卡的兩個 marker 行和 PACE_GAP_STEPS = 2。Say：檔案是 lora-energy-lab/student_policy.py；完整 marked block 從 # === LORA EDITABLE: lab-a-pace-rest === 到 # === LORA END EDITABLE: lab-a-pace-rest ===，baseline 的 REST_DURING_GAP 仍是 SLEEP。Operate：在 package root 以 WSL／POSIX 範例先執行 cp student_policy.py student_policy.before-A-edit.py，再以 nano student_policy.py 開檔並修改，最後執行 .venv/bin/python -m py_compile student_policy.py。Expect：backup 產生 before bytes，py_compile 回傳 0；它只代表 syntax 可解析，尚未驗 marker、policy API、predecessor 或 result。Interpret：這頁的 BEFORE 是唯一 edit 的來源基線，不能把 editor 開啟或 compile 當成 candidate run。Recover：syntax 不通就用 student_policy.before-A-edit.py 還原，再只重跑 py_compile。Transition：下一頁讀完整 AFTER block。

## P041d — A-01d：AFTER 完整 marked block

Point：青色 AFTER 卡的完整五行邊界。Say：AFTER 仍從同一個 lab-a-pace-rest marker 開始，PACE_GAP_STEPS = 2 不動；唯一可見差異是 REST_DURING_GAP = WAIT，END marker 和其他 block 都保留。Operate：以 diff 或逐行目視核對 before-A-edit backup 與目前 student_policy.py，接著執行 .venv/bin/python -m py_compile student_policy.py；Windows 對應 .\.venv\Scripts\python.exe -m py_compile student_policy.py。Expect：只看到一行 value change，compile 回傳 0；沒有額外的 A-baseline 檔名或不存在的 checkpoint 檔。Interpret：這是 policy surface 的 candidate 定義，尚未是 run result；因果判讀要等 P042 的 result／replay pair。Recover：多出任何修改就回 backup，重新只保留 REST_DURING_GAP = SLEEP → WAIT。Transition：下一頁讀 Windows／WSL edit commands。

## P041b — A-01b：WSL 與 PowerShell edit commands

Point：左側 WSL／POSIX 與右側 Windows PowerShell 命令卡。Say：兩邊都在同一個 package-relative student_policy.py 上操作；nano 與 notepad 是 editor 範例，backup 先於 compile。Operate：WSL 逐行執行 cp student_policy.py student_policy.before-A-edit.py；nano student_policy.py；.venv/bin/python -m py_compile student_policy.py。PowerShell 逐行執行 Copy-Item student_policy.py -Destination student_policy.before-A-edit.py；notepad .\student_policy.py；.\.venv\Scripts\python.exe -m py_compile student_policy.py。Expect：兩個環境都得到 syntax guard 結果；compile 不驗 marker、API、前置 policy 或 JSON。Interpret：只要 backup 或 compile 失敗，就沒有 candidate run 的資格；成功只表示可進下一個 exact edit gate。Recover：保留 stderr，從 before-A-edit backup 還原後重試，不跳到 run。Transition：下一頁讀 marker 外 consumer。

## P041c — A-01c：consumer、唯一修改與判讀

Point：marker 外的 function choose_action(observation) branch。Say：精確消費者是 if observation.steps_since_send < PACE_GAP_STEPS: return REST_DURING_GAP；它讀 marked block 的常數，engine 才負責後續 state 與 transition。Operate：先在 code editor 核對這個 branch，再執行 A candidate 的 exact command；compile 不能替代這個 API 與 predecessor 檢查。Expect：run receipt 會提供 result_path；result.json 與 endpoint-replay.json 才能給 state、packet、service、endpoint_energy_j 的實際欄位。Interpret：唯一因果差異是 REST_DURING_GAP = SLEEP 改成 WAIT；預期 awake-idle 可能增加、wake 或 state timing 可能改變，但 service 仍由 gate 判定。Recover：consumer 行或 API 不符時停在這裡，還原 student_policy.before-A-edit.py，不宣稱 candidate 成功。Transition：帶著唯一 edit 進 P042 的三條 run。

## P042 — A-02a：baseline、candidate 與 hidden commands

Point：六條完整、可獨立複製的 command row，順序是 baseline、candidate、hidden。Say：WSL 先跑 bash course.sh run --lab A --case baseline，再跑 bash course.sh run --lab A --case candidate --freeze，最後跑 bash course.sh run --lab A --case hidden；PowerShell 對應三條 .\course.cmd 命令。Operate：每條 command 單獨執行並保存 stdout；candidate 的 --freeze 必須先成功，hidden 才有入場資格。Expect：每次 stdout 讀 status、run_id、result_path、artifact_source、claim_boundary，不顯示任何識別摘要值；candidate 另應留下 artifacts/checkpoints/lab-a-frozen.{json,py}。Interpret：baseline 與 candidate 只相差 A marked edit，hidden 保持 frozen policy；每次 run 的實際 JSON 取自自己的 result_path，不用 reference 假裝 local run。Recover：任一 command 失敗就保留 stdout／stderr，先修復或還原 policy；freeze 缺失時停止 hidden。Transition：下一頁依 receipt 取 result 與 replay。

## P042a — A-02b：stdout fields、result 與 replay pair

Point：stdout fields 卡、artifact pair 卡與 candidate freeze checkpoint。Say：status、run_id、result_path、artifact_source、claim_boundary 是 receipt contract；result_path 是唯一的 artifact join key。Operate：照 stdout 的 result_path 開 artifacts/<run_id>/result.json，再開同一目錄 endpoint-replay.json；candidate freeze 只讀 artifacts/checkpoints/lab-a-frozen.json 與 lab-a-frozen.py。Expect：result 與 replay 共享同一 run 目錄；不在投影片或命令中輸出任何 hash／摘要值。Interpret：只在 result／replay pair 成立時解讀 summary、state、packet；fallback reference 必須標為 reference，不能改寫成 fresh run。Recover：path 遺失或 pair 不一致時保留原 stdout，重跑同一 case；不要手改 JSON，也不要用猜測路徑。Transition：把 pairs 帶到 identity gate。

## P043 — A-03：Identity boundary 與 before／after 比較

Point：baseline 與 candidate 兩張比較卡，以及中間的 identity gate。Say：先確認 scenario_id、policy identity、scope、units 與 run_id，再談能量差異；baseline reference 是 6.92 J／4,800 bit，candidate reference 是 8.86 J／4,800 bit，兩次 service_pass 都 FAIL。Operate：各自從 P042 stdout result_path 開 result.json 與同 run endpoint-replay.json，將兩組欄位寫在 before／after 位置。Expect：兩組 pair 的 scenario 與 scope 一致；summary 仍含 freshness_status=expired、deadline_pass=FAIL 與完整 counters。Interpret：同一 identity 下，candidate endpoint J 增加而 delivered bits 沒變，這支持 WAIT 造成 energy trade-off 的機制，但不支持 service success。Recover：identity、units 或 predecessor 不一致就停止比較，分別回到各自 stdout path。Transition：下一頁拆解 candidate energy buckets。

## P044 — A-04：state ledger 與 endpoint J 的來源

Point：candidate 的 state ledger 與 energy_breakdown_j bucket。Say：awake_idle=6.00 J、sleep=0.04 J、wake=0.02 J、process=0.16 J、tx=2.40 J、rx=0.24 J；每個 J 都要回到 state interval 與 power。Operate：從 candidate result_path 開 events 和 energy_breakdown_j，逐 bucket 核對名稱、數值與 endpoint scope。Expect：六個 bucket 可加總到 endpoint energy；WAIT 的 awake-idle 與 SLEEP 的低功耗段分開出現。Interpret：這些欄位讓 REST_DURING_GAP 的 state 機制可追溯；不能只看 total J，也不能把 tx／rx 當成 gap action。Recover：bucket 缺失或 units 不符時保留 result／replay pair，回到 P042 重新取得同 case artifacts。Transition：接著用 packet ledger 判讀 delivery 與 service。

## P045 — A-05：attempted 不等於 delivered

Point：attempted、retransmissions、delivered_bits、expired 與 service verdict。Say：candidate reference 是 attempted=2、retry=1、delivered_bits=4,800、expired=3、service_pass=FAIL、deadline_pass=FAIL；一次 SEND decision 不等於交付。Operate：在 result.json 讀 counters，在同 run endpoint-replay.json 找 PACKET_ATTEMPT、retry 與 deadline event。Expect：packet outcome、freshness_status=expired 與 endpoint_energy_j=8.86 J 能互相對上；service gate 由 delivery、deadline、freshness 一起判定。Interpret：WAIT 造成的 state energy 變化不能被誤讀成 delivery improvement；先分開 packet 與 service，再談效率。Recover：counter 或 replay event 對不上時停止因果句，回到該次 stdout result_path。Transition：下一頁檢查 candidate freeze lineage。

## P046 — A-06：freeze 是 hidden 的入場條件

Point：freeze gate 的 policy identity、predecessor、active_block_id 與 checkpoint path。Say：hidden 的資格不是一個數字，而是 candidate --freeze 產生的 lab-a-frozen receipt 加上 artifacts/checkpoints/lab-a-frozen.{json,py}。Operate：開 candidate stdout 指出的 result_path，核對 checkpoint 內 scenario、seed、policy identity、predecessor 與 active_block_id=lab-a-pace-rest。Expect：receipt 與 checkpoint 的 identity 全部一致，且 result／replay pair 仍在同一 run 目錄。Interpret：freeze 把唯一 edit 固定成 lineage；沒有它就無法把 hidden 結果歸因到同一 policy。Recover：checkpoint 或 predecessor 遺失時回 P042 的 candidate --freeze，不執行 hidden，也不建立替代檔名。Transition：下一頁以 frozen policy 讀 hidden condition。

## P047 — A-07：hidden 只檢驗，不再調參

Point：hidden path、frozen policy 與 summary boundary。Say：hidden reference 是 3.61 J、0 bit、wake 0、attempt 0、retry 0、expired 3、service_pass=FAIL；它是適用條件限制，不是新的調參結果。Operate：用 P042 的 bash course.sh run --lab A --case hidden，或 PowerShell .\course.cmd run --lab A --case hidden；再沿 stdout result_path 開 result.json 與同 run replay。Expect：policy identity 仍指向 lab-a-frozen，summary 欄位保持完整，freshness_status=expired。Interpret：同一 frozen policy 在不同窗口／traffic 條件下可能呈現不同 outcome；因此只縮小 claim，不把 hidden 數字外推成普遍結論。Recover：hidden path 缺失就恢復 lab-a-frozen checkpoint，重新跑該命令；不手填結果。Transition：把 primary 與 hidden 的條件放進 Lab A 結論句。

## P048 — Lab A 結論：state、service 與 J 的因果句

Point：condition → mechanism → evidence → claim ceiling 的結論骨架。Say：先填 trace 條件，再寫 WAIT 如何改變 state，接著引用 packet／service 與 J，最後寫 hidden 的適用條件限制。Operate：引用 P042 三組 result_path／replay pair、P044 六個 energy bucket 與 P045 service fields；不要引入未出現在 pair 的數值。Expect：結論同時包含 endpoint_energy_j、delivered_bits、service_pass、deadline_pass、freshness_status 與條件邊界。Interpret：可支持的句子是「在固定 identity 與指定 window 下，WAIT 透過 awake-idle state 改變 endpoint J」；service 是否成功仍由 gate 決定。Recover：缺一個 pair 就把結論停在已知欄位，回到 P042 重新建立 artifacts。Transition：帶著 state／service 分離的讀法進 Lab B。

## P049 — Lab B：quality hold 與 service window

Point：Lab B：quality hold 與 service window。Say：P049。Lab B 研究 quality trace 進入 send-ready 的條件；service 由 window、packet 與 deadline 判定。Do：在 固定情境與前一頁保持一致 依序執行或讀取：依頁面上的操作順序讀取既有證據。Why：定義 quality trace、enter、hold、exit 與 service-window transition。。Mechanism：quality_band + stable_steps → REST／SEND_READY transition → packet／deadline／service → endpoint J。。Expect：固定 A frozen predecessor，只改 B stable hold，最後用 Trace B 找 too-slow 的適用條件限制。。Interpret：結果符合預期時，將它解讀為 LAB B QUESTION｜SIMULATED；結果不符時，保留 stdout、result 與 replay。Transition：接著把這個 evidence 帶到下一個 result／replay gate。Recovery：receipt、predecessor 或 policy identity 不符時停止 withheld，恢復 A／B checkpoint。

## P050 — ENTER_QUALITY：send-ready 的進入閾值

Point：ENTER_QUALITY：send-ready 的進入閾值。Say：P050。以第一次達到 quality 2 的位置定位 enter；stable hold 與 transition 由同一 trace 連結。Do：在 student_policy.py lab-b-enter-exit-hold block 依序執行或讀取：依頁面上的操作順序讀取既有證據。Why：說明 quality crossing 如何進入 send-ready。。Mechanism：切換條件：quality_band ≥ ENTER_QUALITY 且 stable_steps ≥ STABLE_STEPS；threshold 是 decision gate，非 energy knob。。Expect：ENTER_QUALITY=2、EXIT_QUALITY=1、STABLE_STEPS=2；下一步只改第三行。。Interpret：結果符合預期時，將它解讀為 THRESHOLD MODEL｜SIMULATED；結果不符時，保留 stdout、result 與 replay。Transition：接著把這個 evidence 帶到下一個 result／replay gate。Recovery：result／replay 不成 pair 時保留錯誤，回到該次 stdout result_path，不手改 JSON。

## P051 — EXIT_QUALITY：enter／exit 的雙閾值

Point：EXIT_QUALITY：enter／exit 的雙閾值。Say：P051。hysteresis 是 enter／exit 條件設計；service 與 energy 仍由 result 驗證。Do：在 same quality trace；send_mode_active branch 依序執行或讀取：依頁面上的操作順序讀取既有證據。Why：用 enter／exit 分離避免品質邊界 ping-pong。。Mechanism：ENTER_QUALITY=2；已進入後 quality≥EXIT_QUALITY=1 時保持 send-ready；quality < 1 時退出。。Expect：兩條 threshold 形成 hysteresis band；transition、retry、service、J 仍須由 result 驗證。。Interpret：結果符合預期時，將它解讀為 HYSTERESIS MODEL｜SIMULATED；結果不符時，保留 stdout、result 與 replay。Transition：接著把這個 evidence 帶到下一個 result／replay gate。Recovery：result／replay 不成 pair 時保留錯誤，回到該次 stdout result_path，不手改 JSON。

## P052 — STABLE_STEPS：拒絕短暫尖峰

Point：STABLE_STEPS：拒絕短暫尖峰。Say：P052。Prediction 包含 hold 縮短、送出時機與 quality 條件。Do：在 student_policy.py B marked block 依序執行或讀取：依頁面上的操作順序讀取既有證據。Why：把短暫 quality spike 與連續穩定分開。。Mechanism：engine 每個固定 clock step 更新 stable_steps；stable_steps=2 時 send_mode_active 切成 ready；改成 1 會縮短 hold。。Expect：Prediction：STABLE_STEPS=1 可能提早一個 step 的 MODE_CHANGE；packet／service／J 由 result 觀察。。Interpret：結果符合預期時，將它解讀為 HOLD MODEL｜SIMULATED；結果不符時，保留 stdout、result 與 replay。Transition：接著把這個 evidence 帶到下一個 result／replay gate。Recovery：result／replay 不成 pair 時保留錯誤，回到該次 stdout result_path，不手改 JSON。

## P053 — Lab B Trace A：transition prediction 與執行

Point：Lab B Trace A：transition prediction 與執行。Say：P053。Prediction 定位 MODE_CHANGE 時點並說明因果理由。Do：在 Trace A；A frozen predecessor；B candidate target=1 依序執行或讀取：依頁面上的操作順序讀取既有證據。Why：在 action 前標出 enter、hold、exit；prediction 與 result 以同一 trace 對照。。Mechanism：policy 讀取當下／過去 observation；future trace 與 result summary 不在 policy input。。Expect：填入 enter step、hold 連續步數、exit quality、service／J 方向；再執行 P056。。Interpret：結果符合預期時，將它解讀為 PREDICTION LOCK｜SIMULATED；結果不符時，保留 stdout、result 與 replay。Transition：接著把這個 evidence 帶到下一個 result／replay gate。Recovery：A policy 的 frozen predecessor 是 observation 的固定前提；缺失時還原 lab-a-frozen.py。

## P054 — B-01a：Baseline decision 與 Trace A evidence

Point：A WAIT predecessor、B hold=2 與 Trace A baseline command。Say：B 的 control 依賴 A frozen predecessor；quality ≥ 2 且 stable_steps ≥ 2 時才進 send-ready，engine 會留下 MODE_CHANGE。Operate：執行 bash course.sh run --lab B --case trace-a-baseline，PowerShell 對應 .\course.cmd run --lab B --case trace-a-baseline。Expect：stdout 有 status、run_id、result_path、artifact_source、claim_boundary；reference summary 是 8.86 J、4,800 bit、active_s=8、service_pass=FAIL。Interpret：baseline 是 B hold=2 的 control，MODE_CHANGE REST → SEND_READY 在 t=130 s；transition 較早不等於 service success。Recover：baseline pair 缺失時保留 stdout，重跑同一命令取得新的 result_path。Transition：下一頁讀完整 Trace A baseline summary。

## P054a — B-01b：Trace A baseline summary fields

Point：Trace A baseline summary 卡與右側 MODE_CHANGE interpretation。Say：這個 same-scenario-fallback reference 的 summary.service_pass、deadline_pass 都 FAIL，freshness_status=expired，delivered_bits=4,800，endpoint_energy_j=8.86 J，efficiency=541.760722 bit/J，wake=1、attempt=2、retry=1、expired=3。Operate：依 P054 stdout result_path 開 result.json，再開同 run endpoint-replay.json，核對 MODE_CHANGE REST → SEND_READY、t=130 s、active_s=8。Expect：summary 欄位與 event 時點屬於同一 run pair；不顯示任何識別摘要值。Interpret：Trace A baseline 提供 hold=2 的控制行為；下一個 candidate 只把 STABLE_STEPS 改成 1，其他 identity 維持。Recover：summary 與 event 不在同一 run 時停止，從 stdout path 重新配對。Transition：進入 B 的 BEFORE block。

## P055 — B-02a：path 與 BEFORE 完整 marked block

Point：B 的 package-relative path 與紫色 BEFORE marked block。Say：完整 block 是 lab-b-enter-exit-hold；ENTER_QUALITY = 2、EXIT_QUALITY = 1、STABLE_STEPS = 2，三行都要保留。Operate：WSL 先 cp student_policy.py student_policy.before-B-edit.py，再以 nano student_policy.py 開檔並修改，最後跑 .venv/bin/python -m py_compile student_policy.py。Expect：backup 留住 hold=2 的 source bytes，compile 回傳 0；compile 只驗 syntax，沒有驗 choose_action、engine、predecessor 或 result。Interpret：這是 B candidate 的唯一修改前基線；A WAIT predecessor 與 runner scope 不在此頁被改動。Recover：syntax 失敗用 student_policy.before-B-edit.py 還原，只重跑 compile。Transition：下一頁核對完整 AFTER block。

## P055d — B-02d：AFTER 完整 marked block

Point：B 的青色 AFTER block。Say：ENTER_QUALITY = 2 與 EXIT_QUALITY = 1 仍不動；只有 STABLE_STEPS = 2 改為 1，兩個 marker 行和其他 block 原樣保留。Operate：以 diff 核對 before-B-edit backup 與目前檔案，接著執行 .venv/bin/python -m py_compile student_policy.py；PowerShell 對應 .\.venv\Scripts\python.exe -m py_compile student_policy.py。Expect：差異只有第三行，compile 回傳 0；MODE_CHANGE 尚未在這個 code page 生成。Interpret：AFTER 只定義 policy input surface，transition timing、packet、service 與 endpoint J 必須等 P056 run pair。Recover：多出任何行差異就回 student_policy.before-B-edit.py，重新保留單一 edit。Transition：進入 Trace A baseline／candidate／Trace B exact commands。

## P055b — B-02b：WSL 與 PowerShell edit commands

Point：B 的 WSL／POSIX 與 Windows PowerShell 命令卡。Say：editor 只是開啟相對路徑；backup 先保存 before，最後才做 py_compile。Operate：WSL 執行 cp student_policy.py student_policy.before-B-edit.py；nano student_policy.py；.venv/bin/python -m py_compile student_policy.py。PowerShell 執行 Copy-Item student_policy.py -Destination student_policy.before-B-edit.py；notepad .\student_policy.py；.\.venv\Scripts\python.exe -m py_compile student_policy.py。Expect：兩邊 compile 都只回報 syntax；任何 marker、API、MODE_CHANGE、service 都要等 run。Interpret：這個 gate 的目的，是在進入 Trace A 前保留可恢復的 policy bytes。Recover：命令失敗保留 stderr，從 before-B-edit backup 還原，不執行 Trace A。Transition：回 P055d 讀 candidate AFTER。

## P055c — B-02c：consumer、function location 與唯一修改

Point：marker 外 consumer、choose_action(observation) 與 student_policy.py:116–118。Say：quality_ready 的實際條件是 observation.quality_band >= ENTER_QUALITY 且 observation.stable_steps >= STABLE_STEPS；function choose_action(observation) 只消費這些 global，run_simulation 位於 lora_energy_lab/engine.py:238–249，engine 依 global 建立 MODE_CHANGE。Operate：在 source 檔以 nl -ba student_policy.py 核對 116–118，再執行 candidate --freeze；Windows 使用 .\course.cmd run --lab B --case trace-a-candidate --freeze，WSL 使用 bash course.sh run --lab B --case trace-a-candidate --freeze。Expect：candidate stdout 提供 result_path 與 lab-b-frozen checkpoint；replay 會記錄 MODE_CHANGE、PACKET_ATTEMPT、retry、delivered_bits、expired。Interpret：唯一 edit 是 STABLE_STEPS=2 → 1；較早 MODE_CHANGE 是 engine event，不可寫成 student_policy.py 直接產生 transition，也不能直接宣稱 service 成功。Recover：condition line、API 或 predecessor 不符時停止 run，還原 student_policy.before-B-edit.py。Transition：下一頁核對完整 AFTER block，再讀 Trace A commands。

## P056 — B-03a：Trace A baseline、candidate 與 Trace B commands

Point：六條 B command row，依序是 Trace A baseline、Trace A candidate、Trace B。Say：WSL 執行 bash course.sh run --lab B --case trace-a-baseline；bash course.sh run --lab B --case trace-a-candidate --freeze；bash course.sh run --lab B --case trace-b。PowerShell 執行對應的 .\course.cmd 三條命令。Operate：每條 command 保存自己的 stdout；candidate --freeze 成功後才進 Trace B，Trace B withheld 不再調參。Expect：每次 receipt 讀 status、run_id、result_path、artifact_source、claim_boundary；candidate 應有 artifacts/checkpoints/lab-b-frozen.{json,py}。Interpret：Trace A baseline 用 hold=2，candidate 用 hold=1，Trace B 保持 frozen candidate policy；比較依 identity 與 predecessor，不依畫面印象。Recover：任一 run 失敗保留 stdout／stderr，還原 B edit 或 predecessor，再只重跑失敗 case。Transition：下一頁讀 stdout fields 與 artifact pair。

## P056a — B-03b：stdout fields、result 與 replay pair

Point：B receipt 的 fields、artifact pair 與 lab-b-frozen checkpoint。Say：result_path 指到 artifacts/<run_id>/result.json；同目錄 endpoint-replay.json 才是可配對的事件來源。Operate：依三次 stdout 各自開 result.json 和 endpoint-replay.json；candidate freeze 只開 artifacts/checkpoints/lab-b-frozen.json 與 lab-b-frozen.py。Expect：status、run_id、result_path、artifact_source、claim_boundary 可追溯，且不顯示任何識別摘要值。Interpret：若沒有同一 run 的 pair，不能讀 MODE_CHANGE、packet、service 或 energy；Trace B 只讀 frozen policy evidence。Recover：path 或 pair 缺失就保存 stdout，回到相同 case 重跑，不手改 JSON。Transition：帶著三組 pair 進 causal transition 頁。

## P057 — B-04a：品質與 service 分開判定的 causal overview

Point：quality → MODE_CHANGE → packet → service／J 的 causal overview。Say：quality band 是 observation context；STABLE_STEPS=1 只改 quality_ready timing，MODE_CHANGE 由 lora_energy_lab/engine.py 建立，packet 與 service 再由 result/replay 判定。Operate：先取 Trace A candidate result_path，再依同目錄 replay 找 transition 與 PACKET_ATTEMPT；不要用 policy code 推填 event。Expect：summary fields 與 MODE_CHANGE 時點能和 delivered_bits、expired、endpoint_energy_j 對上。Interpret：這張 overview 只建立因果鏈，較快 transition 不等於 service success；下一頁列出完整數值。Recover：event 與 summary 不成 pair 時回 P056a 的 stdout path。Transition：讀 P057a 的 transition／service evidence。

## P057a — B-04b：Trace A MODE_CHANGE 與 service evidence

Point：MODE_CHANGE 三段時點與右側 packet／service fields。Say：Trace A candidate reference 的 MODE_CHANGE 是 REST → SEND_READY t=20 s、SEND_READY → REST t=80 s、REST → SEND_READY t=110 s；summary 是 10.66 J、9,600 bit、efficiency=900.562852 bit/J、wake=1、attempt=4、retry=1、expired=1、service_pass=FAIL。Operate：在 endpoint-replay.json 逐事件核對三段 transition，再在 result.json 讀 delivered_bits、deadline_pass、freshness_status、endpoint_energy_j。Expect：transition、packet、service、J 屬於同一 candidate run；service 仍 false。Interpret：較早 transition 改變 active timing 與 delivery opportunity，但不保證 deadline／freshness gate；transition speed 不是 service verdict。Recover：任何時點或欄位對不上就保留原 pair，重讀 result_path，不用另一個 case 補數字。Transition：下一頁檢查 Trace B 的 freeze lineage。

## P058 — B-05：freeze evidence 決定 Trace B 閱讀資格

Point：A frozen → B frozen → Trace B gate。Say：Trace B 的執行資格由 A predecessor、B policy identity、active_block_id=lab-b-enter-exit-hold、scenario 與 candidate receipt 一起決定。Operate：開 artifacts/checkpoints/lab-b-frozen.{json,py}，把它和 P056 candidate stdout 的 result_path、replay pair 逐欄核對。Expect：A predecessor 指向 WAIT 版本，B checkpoint 指向 STABLE_STEPS=1，identity 沒有漂移。Interpret：freeze gate 把 Trace B 限定為同一 candidate policy；這裡停止調參，只做 withheld verification。Recover：checkpoint、predecessor 或 active block 不一致時回 lab-a-frozen，再重做 P056 candidate --freeze。Transition：以 frozen policy 讀 Trace B summary。

## P059 — B-06a：Trace B：frozen policy 的 withheld setup

Point：Trace B frozen setup、第三條 stdout path 與 claim ceiling。Say：Trace B 沿用 STABLE_STEPS=1 與 REST_DURING_GAP=WAIT；新 window／traffic 只用來測試適用條件，不重新修改 policy。Operate：執行 bash course.sh run --lab B --case trace-b 或 .\course.cmd run --lab B --case trace-b，依 stdout result_path 開 result.json 與同 run endpoint-replay.json。Expect：policy identity 仍是 lab-b-frozen；reference summary 是 5.43 J、4,800 bit、efficiency=883.977901 bit/J、wake=1、attempt=2、retry=1、expired=2、service_pass=FAIL。Interpret：Trace B 讀的是 frozen policy 在新條件下的 outcome；結果不同時只降低 claim 適用範圍，不再調參。Recover：第三條 path 缺失就回 candidate freeze，恢復 lab-b-frozen 後重跑 Trace B。Transition：下一頁把 summary 欄位與邊界寫完整。

## P059a — B-06b：Trace B summary 與 claim ceiling

Point：Trace B summary fields 與 claim ceiling。Say：same-scenario-fallback reference 的 service_pass=FAIL、deadline_pass=FAIL、freshness_status=expired、delivered_bits=4,800、endpoint_energy_j=5.43 J、efficiency=883.977901 bit/J、wake=1、attempt=2、retry=1、expired=2。Operate：沿第三條 stdout result_path 開 result.json，再開同 run endpoint-replay.json，確認 frozen policy identity。Expect：summary、transition、packet 與 replay 都屬於 Trace B pair；這是 reference 時清楚標註，不宣稱 fresh local run。Interpret：Trace B service 仍 false，較低 J 或較高 bit/J 不能越過 deadline／freshness gate；結論停在條件式 claim。Recover：欄位缺失或 identity 漂移時回 P056 candidate freeze，不使用另一個 case 的數值。Transition：下一頁分辨 too-slow 與 ping-pong。

## P060 — B-07：too-slow 與 ping-pong 是兩種不同問題

Point：too-slow 與 ping-pong 的兩條事件序列。Say：too-slow 是 hold 太久錯過 service window；ping-pong 是 enter／exit 太近造成多次 MODE_CHANGE、retry 與額外 endpoint J。Operate：對每個 sequence 讀 transition、PACKET_ATTEMPT、retry、expired、service_pass 與 energy bucket，不用 quality 曲線單獨下判斷。Expect：兩個 failure mode 都能在 result／replay 找到不同 event signature；平滑 quality 只作 context。Interpret：同一 policy identity 下仍要分開 timing、packet 與 service；一個 mode 的改善不能外推到另一個 mode。Recover：policy identity 不同時停止比較，回到 B freeze 建立同一 lineage。Transition：把支持與限制合併成 Lab B 條件句。

## P061 — Lab B 結論：hysteresis 的條件與邊界

Point：Trace A support 與 Trace B boundary 的結論框。Say：先寫 Trace A 哪個 MODE_CHANGE／packet／J 欄位支持機制，再寫 Trace B 哪個 service／deadline／freshness 欄位限制外推，最後才寫 hysteresis 的條件。Operate：引用 P057a 與 P059a 的同名 fields 和各自 result_path，不混用兩個 run 的數字。Expect：句子同時包含 transition、delivered_bits、service_pass、endpoint_energy_j、window／traffic 條件。Interpret：較快 transition 可是機制 evidence，service false 仍是 claim boundary；因此結論必須是 conditional，而不是普遍保證。Recover：少一個 pair 就保留已知部分，回 P056 或 P059 的原始 stdout path。Transition：最後用 P062 的 supported restore contract 管理中斷。

## P062 — P062a：中斷復原 overview

Point：recovery overview 的 status → restore → compile → exact rerun。Say：先讀 course.* status，再只使用三個支援 checkpoint 名稱 lab-a-frozen、lab-b-frozen、release-default；restore 只回復 policy lineage，不會復原遺失的 result。Operate：WSL 依序可執行 bash course.sh status、bash course.sh restore --checkpoint lab-a-frozen、bash course.sh restore --checkpoint lab-b-frozen、bash course.sh restore --checkpoint release-default；PowerShell 依序使用 .\course.cmd 對應命令。Expect：status 留下 receipt；restore 後重新 compile 並 exact rerun，新的 stdout 會帶新的 result_path 與配對 endpoint-replay.json。Interpret：restore 是可追溯的 lineage recovery，不是把 fallback 當成 fresh run；每次結果都重新以 stdout claim_boundary 判讀。Recover：result／replay 遺失時不手改 JSON，回 identity 正確 checkpoint 再跑一次。Transition：下一頁提供可逐行複製的 recovery commands。

## P062b — P062b：Windows PowerShell 與 WSL exact recovery commands

Point：WSL／POSIX 與 Windows PowerShell 的 status 及三個 restore 命令。Say：WSL 逐行執行 bash course.sh status；bash course.sh restore --checkpoint lab-a-frozen；bash course.sh restore --checkpoint lab-b-frozen；bash course.sh restore --checkpoint release-default。PowerShell 逐行執行 .\course.cmd status；.\course.cmd restore --checkpoint lab-a-frozen；.\course.cmd restore --checkpoint lab-b-frozen；.\course.cmd restore --checkpoint release-default。Expect：命令各自可複製；restore 只接受這三個 checkpoint，完成後仍要 compile 與 exact rerun 才會產生新 result_path。Interpret：命令成功代表 policy lineage 已回復，不代表 result、replay 或 service 已成功；那些欄位要從新的 stdout pair 讀。Recover：保留 stdout／stderr，回到最後 identity 正確 checkpoint；不手改 JSON。Transition：帶新的 result_path 進目前 browser UI。

## P063 — result.json 匯入：LoRa 實驗結果工作台

Point：完整入口 http://120.126.151.102:3000/course、頁名 LoRa 實驗結果工作台，以及 證據、進度備份兩個 tabs。Say：目前 browser 只選 result.json；證據 tab 驗 schema、identity、units、provenance，進度備份 tab 是本機 controls；endpoint-replay.json 目前 accepted replay 為 none。Operate：由最新 stdout result_path 選對應 result.json，再觀察 empty evidence state；不要把畫面說成成功 upload 或 live measurement。Expect：UI 名稱、入口與 current-browser-evidence/course-20260811-1412-live/README.md 一致；identity／schema／units 不一致時 fail closed。Interpret：這頁只證明現行 browser boundary，不提升 endpoint energy 到 system 或 canonical claim，也不宣稱 replay 已被接受。Recover：匯入失敗保留瀏覽器錯誤和 stdout path，回 P062 restore／exact rerun 取得新 result.json。Transition：下一段進 Part C 的 web field reading，沿新的 receipt、result、replay pair 讀欄位。
