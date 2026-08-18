# Part B embedded speaker notes

## P028 — Radio state 與停留時間：endpoint energy 的積分基礎

P028。Radio state 與停留時間：endpoint energy 的積分基礎。目的：建立 state vocabulary、觸發條件、duration 與 energy bucket 的對照。作用機制：SLEEP 是低功耗休息；WAIT 是 awake idle；WAKE、PROCESS、TX、RX 都會留下時間與功率。觀察與判讀：完整 ledger 由 state interval、power、duration 與 endpoint J 組成；action 名稱只標記一次決策。操作受阻時的復原：result／replay 不成 pair 時保留錯誤，回到該次 stdout result_path，不手改 JSON。

## P029 — Lab A：SLEEP 與 WAIT 的 service／energy 比較

P029。Lab A：SLEEP 與 WAIT 的 service／energy 比較。目的：固定挑戰、成功 gate 與一個 exact edit。作用機制：SLEEP 降低 idle power 並支付 wake；WAIT 維持 awake idle 並增加 awake-idle；service 與整段 J 共同形成結果。觀察與判讀：固定 scenario／seed／traffic／window／endpoint boundary，再讀 delivered、deadline、freshness 與 endpoint J。操作受阻時的復原：保留 stdout／stderr；用 A checkpoint 或同 scenario fallback 恢復，不再調參。

## P030 — 封包生命週期：送出與交付分開判定

P030。封包生命週期：送出與交付分開判定。目的：packet ledger 定義交付事件；energy ledger 定義 endpoint 累積。作用機制：generated → queue → attempt → collision／retry → delivered 或 expired → service verdict。觀察與判讀：attempted、retransmissions、unique_delivered、expired 與 deadline 必須一起讀。操作受阻時的復原：result／replay 不成 pair 時保留錯誤，回到該次 stdout result_path，不手改 JSON。

## P031 — Service gate 與 endpoint J 的比較順序

P031。Service gate 與 endpoint J 的比較順序。目的：防止少做工作被誤教成更有效率。作用機制：same identity → delivered／deadline／freshness → service_pass → endpoint J。觀察與判讀：兩次結果須有相同 scenario、job、window、traffic 與 endpoint scope。操作受阻時的復原：result／replay 不成 pair 時保留錯誤，回到該次 stdout result_path，不手改 JSON。

## P032 — W 是瞬間功率，J 是整段累積

P032。W 是瞬間功率，J 是整段累積。目的：把 power rate 與時間累積出的 energy 分開讀。作用機制：WAIT／SLEEP 使用固定 clock step；PROCESS、TX、RX、WAKE 另有 transition cost。觀察與判讀：沿著 interval 看 duration，再把 awake_idle、sleep、wake、process、TX、RX 加回 total。操作受阻時的復原：result／replay 不成 pair 時保留錯誤，回到該次 stdout result_path，不手改 JSON。

## P033 — endpoint energy 公式只涵蓋 endpoint 邊界

P033。endpoint energy 公式只涵蓋 endpoint 邊界。目的：讀懂每個 endpoint state 的功率與停留時間如何累積。作用機制：E_endpoint = Σ P_s t_s；endpoint scope 包含 radio／processing，不包含 satellite／gateway／whole-system wall-plug。觀察與判讀：native Office Math 可編輯；數值仍由 result artifact 提供。操作受阻時的復原：result／replay 不成 pair 時保留錯誤，回到該次 stdout result_path，不手改 JSON。

## P034 — energy efficiency 的分子與分母要同一個邊界

P034。energy efficiency 的分子與分母要同一個邊界。目的：同時確認 delivered data 分子、endpoint energy 分母與 units。作用機制：η_E = D_delivered / E_endpoint；bit ÷ J = bit/J；service_pass 仍是獨立 gate。觀察與判讀：native Office Math 可編輯；efficiency ratio 與 delivery、deadline verdict 分開判定。操作受阻時的復原：result／replay 不成 pair 時保留錯誤，回到該次 stdout result_path，不手改 JSON。

## P035 — 來源、模型、課程假設與結果要分開

P035。來源、模型、課程假設與結果要分開。目的：沿 scenario、seed、policy identity 與 artifact source 回溯一筆結果。作用機制：source → model → course assumption → result；上游 provenance 參考不等於上游程式被執行。觀察與判讀：runner_provenance.upstream_execution=false；claim boundary 隨 artifact 保存。操作受阻時的復原：result／replay 不成 pair 時保留錯誤，回到該次 stdout result_path，不手改 JSON。

## P036 — 執行結果如何進入重播與工作簿

P036。執行結果如何進入重播與工作簿。目的：確保 scenario、anchor、policy、seed 與 units 在整條鏈一致。作用機制：scenario package → result.json → endpoint-replay.json → Leo replay → workbook；mismatch 不猜身份。觀察與判讀：同一 ntpu-energy-decision-01、scenario identity、anchor identity、policy identity、seed 與 units。操作受阻時的復原：identity mismatch：保留輸入與錯誤，回到 matching artifact；不可手改 JSON。

## P037 — Baseline：固定條件下的 control execution

P037。Baseline：固定條件下的 control execution。目的：固定條件，使目前 lab 僅有 marked block 變動。作用機制：固定 scenario／seed／traffic／window／endpoint scope；只改一個 marked block；觀察 state／packet／service／J。觀察與判讀：若 scenario identity、traffic 或 scope 偷換，A/B 失去因果資格。操作受阻時的復原：result／replay 不成 pair 時保留錯誤，回到該次 stdout result_path，不手改 JSON。

## P038 — LEO：changing-service-window trace 的輸入範例

P038。LEO：changing-service-window trace 的輸入範例。目的：為 Lab B 的 quality window 問題建立 changing opportunity 背景。作用機制：contact_open、quality_band、contact_remaining_s 進入 observation；窗口關閉時只接受 SLEEP。觀察與判讀：changing-service-window trace 依序提供 closed、contact-a、closed、contact-b、closed 的輸入。操作受阻時的復原：result／replay 不成 pair 時保留錯誤，回到該次 stdout result_path，不手改 JSON。

## P039 — Lab A：等待空檔的 radio state 比較

P039。Lab A：等待空檔的 radio state 比較。目的：固定 scenario、case workload、service window、seed、endpoint energy model 與 PACE_GAP_STEPS = 2。作用機制：SLEEP（低功耗休息）→ WAKE cost；WAIT（清醒閒置）→ awake-idle energy。唯一修改：REST_DURING_GAP = SLEEP → WAIT。觀察與判讀：比較 state duration、wake event／energy、packet outcome、service result 與 endpoint_energy_j；唯一修改 → state 變化 → packet/service → endpoint energy。操作受阻時的復原：保留 stdout／stderr；用 A checkpoint 或同 scenario fallback 恢復，不再調參。

## P040 — A-00：Baseline decision 與 Trace evidence

P040。A-00：Baseline decision 與 Trace evidence。目的：以 P042 第一條 stdout result_path 建立 A control。作用機制：contact_open=false（服務窗口布林狀態）→ SLEEP；steps_since_send < PACE_GAP_STEPS（間隔步數）→ REST_DURING_GAP；gap 結束後選擇 WAIT 或 SEND。觀察與判讀：參考 baseline：6.92 J、4,800 bit、service_pass=FAIL；實際以 stdout path 為準。操作受阻時的復原：P042 baseline result／replay 缺失時重跑該命令，使用新的 stdout result_path，不猜路徑。

## P041 — A-01：把空檔的 REST 改成 WAIT

P041。A-01：把空檔的 REST 改成 WAIT。目的：只改 Lab A 的一個 marked block，使 action 差異具可歸因性。作用機制：PACE_GAP_STEPS=2 保持不變；唯一修改為 REST_DURING_GAP：SLEEP → WAIT；state 變化由 packet／service／J result 觀察。觀察與判讀：backup + py_compile 回傳碼 0；active block 清楚顯示 REST_DURING_GAP = WAIT。操作受阻時的復原：若 guard 或 syntax 失敗，從 student_policy.before-A-edit.py 還原，只重新 compile。

## P042 — A-02：baseline、candidate 與 hidden 的執行 receipt

P042。A-02：baseline、candidate 與 hidden 的執行 receipt。目的：Lab A 三個 case 共用 stdout result_path 讀法。作用機制：baseline → A exact edit + candidate --freeze → hidden frozen policy；每一條 path 與同 run replay 配對。觀察與判讀：每次成功 stdout 有 status=OK、artifact_source=student-run、新 result_path；candidate 另有 lab-a-frozen checkpoint。操作受阻時的復原：任一步失敗保留 stdout／stderr；還原 A edit 後重跑該段，freeze 缺失不得進 hidden。

## P043 — A-03：Identity boundary 與 before／after 比較

P043。A-03：Identity boundary 與 before／after 比較。目的：開啟 P042 的 baseline／candidate paths，核對 identity 後填 before／after 句。作用機制：scenario identity、policy identity、summary、claim boundary 與同 run endpoint-replay 必須可配對。觀察與判讀：baseline 6.92 J／4,800 bit；candidate 8.86 J／4,800 bit；兩者 service 都 FAIL。操作受阻時的復原：result／replay 不成 pair 時保留錯誤，回到該次 stdout result_path，不手改 JSON。

## P044 — A-04：state ledger 與 endpoint J 的來源

P044。A-04：state ledger 與 endpoint J 的來源。目的：從 candidate events 與 energy_breakdown_j 找 WAIT 的 awake-idle／wake 成本。作用機制：WAIT 取代 gap 的 SLEEP 後，awake idle 可能增加、wake 可能減少；兩類 bucket 構成 total J 的解釋。觀察與判讀：參考：awake_idle=6.00 J、sleep=0.04 J、wake=0.02 J、process=0.16 J、tx=2.40 J、rx=0.24 J。操作受阻時的復原：result／replay 不成 pair 時保留錯誤，回到該次 stdout result_path，不手改 JSON。

## P045 — A-05：attempted 不等於 delivered

P045。A-05：attempted 不等於 delivered。目的：把 attempted、retry、delivered、expired 接回 service verdict。作用機制：一次 SEND 是 decision；collision／retry／deadline 共同決定 packet outcome；service_pass 與 deadline_pass 定義 service gate。觀察與判讀：參考 candidate：attempted=2、retransmissions=1、delivered_bits=4,800、expired=3、service_pass=FAIL、deadline_pass=FAIL。操作受阻時的復原：result／replay 不成 pair 時保留錯誤，回到該次 stdout result_path，不手改 JSON。

## P046 — A-06：freeze 是 hidden 的入場條件

P046。A-06：freeze 是 hidden 的入場條件。目的：讀 P042 candidate freeze 的 lineage；freeze receipt 是唯讀 evidence。作用機制：lab-a-frozen receipt 綁定 policy identity、predecessor、active_block_id、scenario、seed 與 receipt identity。觀察與判讀：存在 artifacts/checkpoints/lab-a-frozen.{json,py}；identity 與 active_block_id=lab-a-pace-rest 對得上。操作受阻時的復原：hidden 執行條件為完整 checkpoint 與 identity；缺失時還原 baseline，回到 P042 candidate --freeze。

## P047 — A-07：hidden 只檢驗，不再調參

P047。A-07：hidden 只檢驗，不再調參。目的：讀 P042 第三條 hidden path，保留 frozen policy 並縮小 claim。作用機制：REST_DURING_GAP=WAIT 與 policy identity 不變；新 contact／traffic condition 可改變結果。觀察與判讀：參考 hidden：3.61 J、0 bit、service_pass=FAIL；這是 counterexample。操作受阻時的復原：hidden path 缺失時還原 lab-a-frozen.py，回到 P042 hidden 命令；不使用 hardcoded fallback path。

## P048 — Lab A 結論：state、service 與 J 的因果句

P048。Lab A 結論：state、service 與 J 的因果句。目的：把 state、packet／service、J 與 primary／hidden 條件串成一句。作用機制：同一 scenario／policy identity 下，WAIT 的 state 機制可能改變 packet outcome；hidden case 定義 claim ceiling。觀察與判讀：句型：在 ______ trace，WAIT 透過 ______ state 改變 ______ packet／service，J ______；hidden ______，所以結論 ______。操作受阻時的復原：result／replay 不成 pair 時保留錯誤，回到該次 stdout result_path，不手改 JSON。

## P049 — Lab B：quality hold 與 service window

P049。Lab B：quality hold 與 service window。目的：定義 quality trace、enter、hold、exit 與 service-window transition。作用機制：quality_band + stable_steps → REST／SEND_READY transition → packet／deadline／service → endpoint J。觀察與判讀：固定 A frozen predecessor，只改 B stable hold，最後用 Trace B 找 too-slow counterexample。操作受阻時的復原：receipt、predecessor 或 policy identity 不符時停止 withheld，恢復 A／B checkpoint。

## P050 — ENTER_QUALITY：send-ready 的進入閾值

P050。ENTER_QUALITY：send-ready 的進入閾值。目的：說明 quality crossing 如何進入 send-ready。作用機制：切換條件：quality_band ≥ ENTER_QUALITY 且 stable_steps ≥ STABLE_STEPS；threshold 是 decision gate，非 energy knob。觀察與判讀：ENTER_QUALITY=2、EXIT_QUALITY=1、STABLE_STEPS=2；下一步只改第三行。操作受阻時的復原：result／replay 不成 pair 時保留錯誤，回到該次 stdout result_path，不手改 JSON。

## P051 — EXIT_QUALITY：enter／exit 的雙閾值

P051。EXIT_QUALITY：enter／exit 的雙閾值。目的：用 enter／exit 分離避免品質邊界 ping-pong。作用機制：ENTER_QUALITY=2；已進入後 quality≥EXIT_QUALITY=1 時保持 send-ready；quality < 1 時退出。觀察與判讀：兩條 threshold 形成 hysteresis band；transition、retry、service、J 仍須由 result 驗證。操作受阻時的復原：result／replay 不成 pair 時保留錯誤，回到該次 stdout result_path，不手改 JSON。

## P052 — STABLE_STEPS：拒絕短暫尖峰

P052。STABLE_STEPS：拒絕短暫尖峰。目的：把短暫 quality spike 與連續穩定分開。作用機制：engine 每個固定 clock step 更新 stable_steps；stable_steps=2 時 send_mode_active 切成 ready；改成 1 會縮短 hold。觀察與判讀：Prediction：STABLE_STEPS=1 可能提早一個 step 的 MODE_CHANGE；packet／service／J 由 result 觀察。操作受阻時的復原：result／replay 不成 pair 時保留錯誤，回到該次 stdout result_path，不手改 JSON。

## P053 — Lab B Trace A：transition prediction 與執行

P053。Lab B Trace A：transition prediction 與執行。目的：在 action 前標出 enter、hold、exit；prediction 與 result 以同一 trace 對照。作用機制：policy 讀取當下／過去 observation；future trace 與 result summary 不在 policy input。觀察與判讀：填入 enter step、hold 連續步數、exit quality、service／J 方向；再執行 P056。操作受阻時的復原：A policy 的 frozen predecessor 是 observation 的固定前提；缺失時還原 lab-a-frozen.py。

## P054 — B-01：Baseline decision 與 Trace A evidence

P054。B-01：Baseline decision 與 Trace A evidence。目的：用 P056 第一條 stdout path 建立 Trace A control。作用機制：A block 保持 WAIT；B hold=2；quality≥2 且 stable_steps≥2 時切換 send-ready。觀察與判讀：參考 Trace A baseline：8.86 J、4,800 bit、service_pass=FAIL。操作受阻時的復原：P056 baseline pair 缺失時重新使用 baseline command 取新 stdout path，不猜路徑。

## P055 — B-02：把穩定等待從 2 改成 1

P055。B-02：把穩定等待從 2 改成 1。目的：只改 B marked block 的 stable hold，測試較快進入 send-ready。作用機制：ENTER_QUALITY=2、EXIT_QUALITY=1 與 A WAIT 保持原樣；STABLE_STEPS=1 改變 MODE_CHANGE 時機。觀察與判讀：backup + py_compile 回傳碼 0；active block 顯示 STABLE_STEPS = 1。操作受阻時的復原：B guard 失敗時從 student_policy.before-B-edit.py 還原；A frozen block 與 runner 維持原樣。

## P056 — B-03：Trace A baseline、candidate 與 Trace B 的執行 receipt

P056。B-03：Trace A baseline、candidate 與 Trace B 的執行 receipt。目的：Lab B 三個 case 共用 stdout result_path 讀法。作用機制：A frozen + B=2 baseline → B=1 candidate --freeze → B frozen Trace B；每次 path 配同 run replay。觀察與判讀：三次 stdout 有 status=OK、artifact_source=student-run、新 result_path；candidate 另有 lab-b-frozen checkpoint。操作受阻時的復原：任一步失敗保留 stdout／stderr；還原 B edit 後重跑該段，freeze 缺失不得進 Trace B。

## P057 — B-04：品質與 service 分開判定，transition 串接機制

P057。B-04：品質與 service 分開判定，transition 串接機制。目的：沿 P056 paths 對齊 MODE_CHANGE、packet、deadline、service 與 J。作用機制：STABLE_STEPS=1 改變 enter timing；PACKET_ATTEMPT、retry、delivered、expired 由 result 觀察。觀察與判讀：參考 Trace A candidate：attempted=4、delivered_bits=9,600、expired=1、10.66 J、service_pass=FAIL。操作受阻時的復原：result／replay 不成 pair 時保留錯誤，回到該次 stdout result_path，不手改 JSON。

## P058 — B-05：freeze evidence 決定 Trace B 閱讀資格

P058。B-05：freeze evidence 決定 Trace B 閱讀資格。目的：讀 P056 candidate freeze 的 lineage；freeze receipt 是唯讀 evidence。作用機制：lab-b-frozen 綁定 A predecessor、B policy identity、active_block_id、Trace A、scenario 與 receipt identity。觀察與判讀：存在 artifacts/checkpoints/lab-b-frozen.{json,py}；active_block_id=lab-b-enter-exit-hold，identity 與 predecessor 對得上。操作受阻時的復原：Trace B 執行條件為 candidate checkpoint 與 identity；缺失時還原 lab-a-frozen.py，回到 P056 candidate --freeze。

## P059 — B-06：Trace B：frozen policy 的 withheld verification

P059。B-06：Trace B：frozen policy 的 withheld verification。目的：讀 P056 第三條 Trace B path，判斷 hold=1 的泛化邊界。作用機制：STABLE_STEPS=1 與 REST_DURING_GAP=WAIT 不變；新窗口／traffic 可暴露不同 outcome。觀察與判讀：參考 Trace B：5.43 J、4,800 bit、expired=2、service_pass=FAIL。操作受阻時的復原：Trace B path 來源固定為 stdout result_path；缺失時還原 lab-b-frozen.py，回到 P056 第三條命令。

## P060 — B-07：too-slow 與 ping-pong 是兩種不同問題

P060。B-07：too-slow 與 ping-pong 是兩種不同問題。目的：用 MODE_CHANGE、packet outcome 與 endpoint ledger 區分兩種失敗。作用機制：too-slow：hold 太久錯過窗口；ping-pong：enter／exit 太近，多次 transition、retry 與額外 J。觀察與判讀：每個 failure mode 以事件與 summary 判定；平滑 quality 線維持為 context evidence。操作受阻時的復原：兩個 result policy identity 不同時回到 B freeze，使用同一個 checkpoint。

## P061 — Lab B 結論：hysteresis 的條件與邊界

P061。Lab B 結論：hysteresis 的條件與邊界。目的：把 Trace A 支持的機制與 Trace B 暴露的邊界一起保留。作用機制：hold=1 可能增加 delivery 但 service 仍失敗；效果受 window、traffic、deadline 與 endpoint scope 約束。觀察與判讀：條件式句型：Trace A ______；Trace B ______；因此 hysteresis 有效的條件是 ______。操作受阻時的復原：result／replay 不成 pair 時保留錯誤，回到該次 stdout result_path，不手改 JSON。

## P062 — 中斷復原：policy lineage 與新結果分開保存

P062。中斷復原：policy lineage 與新結果分開保存。目的：從最後一個 identity 正確的 checkpoint 回到可重跑階段。作用機制：policy checkpoint 復原 policy lineage；重跑產生新的 stdout result_path 與配對 replay。觀察與判讀：copy → py_compile → exact case；新結果使用新的 stdout path。操作受阻時的復原：result／replay 遺失時不手改 JSON；回 checkpoint 重跑；主機受阻則保留 same-scenario fallback 標籤。

## P063 — result.json 匯入：網站驗證、回放與工作簿

P063。result.json 匯入：網站驗證、回放與工作簿。目的：自然銜接 Leo /course：網站驗證 result／replay，不執行 policy。作用機制：stdout result_path → 選取 result.json → 驗證 schema／identity／units／provenance → 讀同 run endpoint-replay.json → workbook。觀察與判讀：成功顯示同一 scenario、case、run identity、replay；不一致時 fail closed，原 workbook 不被悄悄改寫。操作受阻時的復原：匯入失敗保留錯誤與 stdout path；回 P062 checkpoint 重跑 exact case，再用新 path 匯入。
