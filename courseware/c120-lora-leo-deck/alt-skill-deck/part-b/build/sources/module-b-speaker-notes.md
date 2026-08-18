# Direct-teaching Part B speaker notes (P028–P063)

## P028 — Radio state 與停留時間：endpoint energy 的積分基礎

P028。沿著 state 帶說明每個名稱如何對應 result 的 interval 與 energy bucket 操作受阻時，result／replay 不成 pair 時保留錯誤，回到該次 stdout result_path，不手改 JSON。

Recovery: result／replay 不成 pair 時保留錯誤，回到該次 stdout result_path，不手改 JSON。

## P029 — Lab A：SLEEP 與 WAIT 的 service／energy 比較

P029。判斷 J 下降但 service_pass 變成 false 時，是否稱為節能成功 操作受阻時，保留 stdout／stderr；用 A checkpoint 或同 scenario fallback 恢復，不再調參。

Recovery: 保留 stdout／stderr；用 A checkpoint 或同 scenario fallback 恢復，不再調參。

## P030 — 封包生命週期：送出與交付分開判定

P030。一次 SEND 是 policy decision，不等於 service 已交付 操作受阻時，result／replay 不成 pair 時保留錯誤，回到該次 stdout result_path，不手改 JSON。

Recovery: result／replay 不成 pair 時保留錯誤，回到該次 stdout result_path，不手改 JSON。

## P031 — Service gate 與 endpoint J 的比較順序

P031。service gate 決定 endpoint J 的解讀層級；低 J 維持為單一觀察值 操作受阻時，result／replay 不成 pair 時保留錯誤，回到該次 stdout result_path，不手改 JSON。

Recovery: result／replay 不成 pair 時保留錯誤，回到該次 stdout result_path，不手改 JSON。

## P032 — W 是瞬間功率，J 是整段累積

P032。低峰值拖得久仍可能累積較多 J 操作受阻時，result／replay 不成 pair 時保留錯誤，回到該次 stdout result_path，不手改 JSON。

Recovery: result／replay 不成 pair 時保留錯誤，回到該次 stdout result_path，不手改 JSON。

## P033 — endpoint energy 公式只涵蓋 endpoint 邊界

P033。公式定義 scope 與累積語義；本次數值來源為 result artifact 操作受阻時，result／replay 不成 pair 時保留錯誤，回到該次 stdout result_path，不手改 JSON。

Recovery: result／replay 不成 pair 時保留錯誤，回到該次 stdout result_path，不手改 JSON。

## P034 — energy efficiency 的分子與分母要同一個邊界

P034。delivery gate 維持獨立；bit 與 J 僅在同一 endpoint boundary 內形成比值 操作受阻時，result／replay 不成 pair 時保留錯誤，回到該次 stdout result_path，不手改 JSON。

Recovery: result／replay 不成 pair 時保留錯誤，回到該次 stdout result_path，不手改 JSON。

## P035 — 來源、模型、課程假設與結果要分開

P035。資料類型維持 coherent simulated result；provenance 記錄 input、policy 與 output 的關聯 操作受阻時，result／replay 不成 pair 時保留錯誤，回到該次 stdout result_path，不手改 JSON。

Recovery: result／replay 不成 pair 時保留錯誤，回到該次 stdout result_path，不手改 JSON。

## P036 — 執行結果如何進入重播與工作簿

P036。配對 identity 比單一漂亮數字更重要 操作受阻時，identity mismatch 時 fail closed

Recovery: identity mismatch：保留輸入與錯誤，回到 matching artifact；不可手改 JSON。

## P037 — Baseline：固定條件下的 control execution

P037。Baseline 使用固定情境、隨機種子與原始 policy，作為對照執行 操作受阻時，result／replay 不成 pair 時保留錯誤，回到該次 stdout result_path，不手改 JSON。

Recovery: result／replay 不成 pair 時保留錯誤，回到該次 stdout result_path，不手改 JSON。

## P038 — LEO：changing-service-window trace 的輸入範例

P038。LEO 範例採用預先定義的 changing-service-window trace，作為 endpoint 傳輸時機的輸入 操作受阻時，result／replay 不成 pair 時保留錯誤，回到該次 stdout result_path，不手改 JSON。

Recovery: result／replay 不成 pair 時保留錯誤，回到該次 stdout result_path，不手改 JSON。

## P039 — Lab A：等待空檔的 radio state 比較

P039。Lab A 固定同一工作，沿 state、packet、service、J 解釋差異 操作受阻時，保留 stdout／stderr；用 A checkpoint 或同 scenario fallback 恢復，不再調參。

Recovery: 保留 stdout／stderr；用 A checkpoint 或同 scenario fallback 恢復，不再調參。

## P040 — A-00：Baseline decision 與 Trace evidence

P040。Baseline 固定原始 policy；下一個 case 的唯一修改是 REST_DURING_GAP 操作受阻時，重新取得同一次 baseline 的 result／replay pair

Recovery: P042 baseline result／replay 缺失時重跑該命令，使用新的 stdout result_path，不猜路徑。

## P041 — A-01：把空檔的 REST 改成 WAIT

P041。Prediction 包含 wake event 與 awake-idle 的方向；完成一行 edit 後取得 result 操作受阻時，只還原 A marked block

Recovery: 若 guard 或 syntax 失敗，從 student_policy.before-A-edit.py 還原，只重新 compile。

## P042 — A-02：baseline、candidate 與 hidden 的執行 receipt

P042。三條 exact command 依序建立 baseline、candidate、hidden receipt；run identity 取自 stdout path 操作受阻時，保留 stdout／stderr；用 A checkpoint 或同 scenario fallback 恢復，不再調參。

Recovery: 任一步失敗保留 stdout／stderr；還原 A edit 後重跑該段，freeze 缺失不得進 hidden。

## P043 — A-03：Identity boundary 與 before／after 比較

P043。若 identity 不同，停止比較並重新從各自 stdout 取 pair 操作受阻時，result／replay 不成 pair 時保留錯誤，回到該次 stdout result_path，不手改 JSON。

Recovery: result／replay 不成 pair 時保留錯誤，回到該次 stdout result_path，不手改 JSON。

## P044 — A-04：state ledger 與 endpoint J 的來源

P044。state interval 是 WAIT 耗能因果的必要 evidence 操作受阻時，result／replay 不成 pair 時保留錯誤，回到該次 stdout result_path，不手改 JSON。

Recovery: result／replay 不成 pair 時保留錯誤，回到該次 stdout result_path，不手改 JSON。

## P045 — A-05：attempted 不等於 delivered

P045。delivery、deadline 與 service verdict 決定 energy interpretation；SEND 次數不足以代表交付 操作受阻時，result／replay 不成 pair 時保留錯誤，回到該次 stdout result_path，不手改 JSON。

Recovery: result／replay 不成 pair 時保留錯誤，回到該次 stdout result_path，不手改 JSON。

## P046 — A-06：freeze 是 hidden 的入場條件

P046。freeze 是 lineage gate；receipt 與 checkpoint 定義 hidden 的執行資格 操作受阻時，回到 candidate --freeze

Recovery: hidden 執行條件為完整 checkpoint 與 identity；缺失時還原 baseline，回到 P042 candidate --freeze。

## P047 — A-07：hidden 只檢驗，不再調參

P047。hidden 若方向相反，表示適用範圍縮小；frozen policy 維持不變 操作受阻時，保留 stdout／stderr；用 A checkpoint 或同 scenario fallback 恢復，不再調參。

Recovery: hidden path 缺失時還原 lab-a-frozen.py，回到 P042 hidden 命令；不使用 hardcoded fallback path。

## P048 — Lab A 結論：state、service 與 J 的因果句

P048。結論同時包含 J、適用條件與反例 操作受阻時，result／replay 不成 pair 時保留錯誤，回到該次 stdout result_path，不手改 JSON。

Recovery: result／replay 不成 pair 時保留錯誤，回到該次 stdout result_path，不手改 JSON。

## P049 — Lab B：quality hold 與 service window

P049。Lab B 研究 quality trace 進入 send-ready 的條件；service 由 window、packet 與 deadline 判定 操作受阻時，receipt、predecessor 或 policy identity 不符時停止 withheld，恢復 A／B checkpoint。

Recovery: receipt、predecessor 或 policy identity 不符時停止 withheld，恢復 A／B checkpoint。

## P050 — ENTER_QUALITY：send-ready 的進入閾值

P050。以第一次達到 quality 2 的位置定位 enter；stable hold 與 transition 由同一 trace 連結 操作受阻時，result／replay 不成 pair 時保留錯誤，回到該次 stdout result_path，不手改 JSON。

Recovery: result／replay 不成 pair 時保留錯誤，回到該次 stdout result_path，不手改 JSON。

## P051 — EXIT_QUALITY：enter／exit 的雙閾值

P051。hysteresis 是 enter／exit 條件設計；service 與 energy 仍由 result 驗證 操作受阻時，result／replay 不成 pair 時保留錯誤，回到該次 stdout result_path，不手改 JSON。

Recovery: result／replay 不成 pair 時保留錯誤，回到該次 stdout result_path，不手改 JSON。

## P052 — STABLE_STEPS：拒絕短暫尖峰

P052。Prediction 包含 hold 縮短、送出時機與 quality 條件 操作受阻時，result／replay 不成 pair 時保留錯誤，回到該次 stdout result_path，不手改 JSON。

Recovery: result／replay 不成 pair 時保留錯誤，回到該次 stdout result_path，不手改 JSON。

## P053 — Lab B Trace A：transition prediction 與執行

P053。Prediction 定位 MODE_CHANGE 時點並說明因果理由 操作受阻時，恢復 A frozen predecessor

Recovery: A policy 的 frozen predecessor 是 observation 的固定前提；缺失時還原 lab-a-frozen.py。

## P054 — B-01：Baseline decision 與 Trace A evidence

P054。Baseline 定義 hold=2 的原始 behavior；hold=1 由 candidate evidence 判定 操作受阻時，receipt、predecessor 或 policy identity 不符時停止 withheld，恢復 A／B checkpoint。

Recovery: P056 baseline pair 缺失時重新使用 baseline command 取新 stdout path，不猜路徑。

## P055 — B-02：把穩定等待從 2 改成 1

P055。第三行是唯一 edit；prediction 涵蓋送出時機、quality、retry 與 deadline 操作受阻時，還原 B marked block

Recovery: B guard 失敗時從 student_policy.before-B-edit.py 還原；A frozen block 與 runner 維持原樣。

## P056 — B-03：Trace A baseline、candidate 與 Trace B 的執行 receipt

P056。三條 exact command 依序建立 Trace A baseline、candidate、Trace B receipt；Trace B 不再 retune 操作受阻時，receipt、predecessor 或 policy identity 不符時停止 withheld，恢復 A／B checkpoint。

Recovery: 任一步失敗保留 stdout／stderr；還原 B edit 後重跑該段，freeze 缺失不得進 Trace B。

## P057 — B-04：品質與 service 分開判定，transition 串接機制

P057。quality band 是 context；MODE_CHANGE transition 把 action 接到 packet outcome 操作受阻時，result／replay 不成 pair 時保留錯誤，回到該次 stdout result_path，不手改 JSON。

Recovery: result／replay 不成 pair 時保留錯誤，回到該次 stdout result_path，不手改 JSON。

## P058 — B-05：freeze evidence 決定 Trace B 閱讀資格

P058。Trace B 是 frozen policy 的 withheld verification；調參停止於 candidate freeze 操作受阻時，receipt、predecessor 或 policy identity 不符時停止 withheld，恢復 A／B checkpoint。

Recovery: Trace B 執行條件為 candidate checkpoint 與 identity；缺失時還原 lab-a-frozen.py，回到 P056 candidate --freeze。

## P059 — B-06：Trace B：frozen policy 的 withheld verification

P059。counterexample 界定適用範圍；Trace A 的改善不外推至所有窗口 操作受阻時，receipt、predecessor 或 policy identity 不符時停止 withheld，恢復 A／B checkpoint。

Recovery: Trace B path 來源固定為 stdout result_path；缺失時還原 lab-b-frozen.py，回到 P056 第三條命令。

## P060 — B-07：too-slow 與 ping-pong 是兩種不同問題

P060。evidence 區分 hold、threshold 與 traffic／window 差異 操作受阻時，receipt、predecessor 或 policy identity 不符時停止 withheld，恢復 A／B checkpoint。

Recovery: 兩個 result policy identity 不同時回到 B freeze，使用同一個 checkpoint。

## P061 — Lab B 結論：hysteresis 的條件與邊界

P061。條件差異比一次改善更重要，保留支持、反例與待查部分 操作受阻時，result／replay 不成 pair 時保留錯誤，回到該次 stdout result_path，不手改 JSON。

Recovery: result／replay 不成 pair 時保留錯誤，回到該次 stdout result_path，不手改 JSON。

## P062 — 中斷復原：policy lineage 與新結果分開保存

P062。復原 policy 不會復原遺失的 result；每次重跑都保存新的 stdout path 操作受阻時，保留 stdout／stderr；用 A checkpoint 或同 scenario fallback 恢復，不再調參。

Recovery: result／replay 遺失時不手改 JSON；回 checkpoint 重跑；主機受阻則保留 same-scenario fallback 標籤。

## P063 — result.json 匯入：網站驗證、回放與工作簿

P063。網站只驗證、回放與保存 runner 已產生的 evidence；simulated data 維持 simulated／not live／not measured 分類 操作受阻時，result／replay 不成 pair 時保留錯誤，回到該次 stdout result_path，不手改 JSON。

Recovery: 匯入失敗保留錯誤與 stdout path；回 P062 checkpoint 重跑 exact case，再用新 path 匯入。
