# C-120 LoRaEnergySim × LEO full deck speaker notes

## S001 — 每一次 SEND、WAIT、SLEEP，都是能源決策

這堂課先從 IoT endpoint 的能源決策開始，而不是從衛星術語開始。裝置選擇送、等或休眠時，同時改變封包服務與功率乘時間所累積的能量。LoRaEnergySim 讓這些 endpoint 後果可以被觀察；Leo 只提供一個會改變的服務窗口，幫我們看清取捨。請學員先說出一個可能同時改變服務與能量的 endpoint 動作。

## S002 — 節能是一條可檢驗因果鏈

請沿著因果鏈由左到右讀。資料與狀態先進入 policy，policy 產生送、等、休眠或批次行動，接著才有 packet 與 service 後果；功率經過時間才累積成焦耳。最後的 evidence 必須能支持或推翻原先的 prediction，並把機制轉移到其他 IoT 場景。請學員指出哪一段證據可以推翻一個節能說法。

## S003 — LoRa 證據邊界

LoRaEnergySim 的直接價值，是讓 endpoint 的狀態、封包嘗試、重試、送達與能量結果成為可檢查的事件。課程 wrapper 加入的 awake-idle 或 wake 假設必須另外標示，不能說成 upstream 測量。endpoint energy 也不能被改名成既有 C-120 的 canonical system energy。請學員各指出一個可觀察事件與一個不能越過的 claim。

## S004 — LEO：變動服務窗口範例

LEO 在這裡只負責把服務機會變成一個會開、會關、品質會改變的時間窗。這讓學員必須在現在送、等一下、批次或休眠之間做決策，並同時檢查 service 與 energy。學到的是 changing opportunity 下的控制思維，而不是衛星工程專業。請學員把同一個取捨映射到智慧農業、HVAC、edge 或物流。

## S005 — 兩層 evidence 不互相冒充

兩層 replay 可以在同一個 scenario 與 clock 上一起呈現，但各自負責不同 evidence。既有 replay 保留 system 層欄位；新的 endpoint replay 只負責 policy、queue、packet、radio state 與 endpoint energy。共享 anchor 有助於對齊，不代表可以把 endpoint 欄位寫回 system 或 canonical 欄位。請學員把 endpoint J 與 system consumed J 分到正確的一層。

## S006 — 從預測到驗證

學員先留下對 queue、service、state time 與 endpoint energy 的 prediction，再只改 student_policy.py 的 marked region。Runner 產生 deterministic JSON，Leo 做 strict import 後呈現 replay；同一份凍結 policy 還要接受 withheld case。最後留下的是完整 evidence chain 與可重新開啟的 workbook，不是一次成功畫面。此頁先呈現 learner loop，不放尚未凍結的命令或畫面。

## S007 — 操作與修改的五問框架

這五欄不是附加說明，而是每一個 action 的教學契約。學員要知道自己做什麼、為什麼做、改變哪個機制、執行前期待看到什麼，以及意外結果該如何解讀與恢復。release URL、commands、case names 與 line numbers 尚未凍結，因此畫面只呈現 grammar，沒有冒充 final API。請講師示範如何先寫預測，再選最小 recovery。

## S008 — 120 分鐘：setup 與 labs

這頁使用 draft integration SDD 的 exact-120 十段時鐘：WHY、SETUP、MODEL、ANCHOR、三個 labs、RECOVERY、CLINIC 與 TRANSFER 合計 120 分鐘。setup 若受阻，fallback 仍要使用同一 scenario 並在 protected clock 內回到主路徑，不把安裝等待當成 energy-learning evidence。Owner 已授權 placeholder-safe full-deck production，但十段 clock 的最終 classroom freeze 仍須和 release evidence 一起關閉。

## S009 — Opening checkpoint

這一頁記錄 owner 已授權沿著既定 opening route 繼續完成 full deck。後續頁面可以先完整教概念、機制、prediction 與 recovery grammar；release、API、command、line、browser 與 KPI 仍只能以 EVIDENCE PLACEHOLDER 呈現，不能自行補值。這不是 production stop，而是把可作者化內容與待凍結 evidence 清楚分層。

## S010 — 課程包裡有什麼？

先把取得課程包本身當成第一個完整 action。學員只能使用 named release ZIP 或 immutable tag，因為 release 同時綁定 wrapper、policy API、scenario、schemas 與 license provenance；任意 branch 或混雜檔案會破壞後續比較。預期 package root 具備 README、launcher、lock、policy、runner 與 schemas。final filenames、tag、URL 和 receipt 尚未凍結，所以本頁保持 EVIDENCE PLACEHOLDER；缺檔時回到 named release，不自行拼裝課程包。

## S011 — 選擇支援的 OS launcher

講師先讓學員辨識自己使用的作業系統，再選對應的課程入口。此 action 的目的不是比較 OS，而是讓後續 runner 進入一致的環境邊界；權限或 launcher 失敗只能解讀為 operational gate。當前 supported minor、冷啟動命令與 receipt 尚未 release-freeze，所以畫面不展示猜測的 shell syntax。若 setup 受阻，保留同一 scenario 並走 recovery。

## S012 — 為什麼建立隔離的 .venv？

隔離環境的價值是可重現與可回復，不是能源實驗本身。講師可用 system Python 與 course .venv 的兩個框，說明 package location 如何避免其他專案污染 runner。學員要把 environment stage 與後續 energy evidence 分開記錄；建立失敗時先讀診斷或使用同情境 fallback，不移除隔離要求。Python minor、命令與路徑都仍是 placeholder。

## S013 — 為什麼安裝 pinned dependency lock？

把 lock 視為實驗邊界的一部分：同一個 policy 在不同 dependency graph 上不一定代表同一個 runner。學員只需理解 lock 如何限制版本與 hash，不需拆解 upstream framework。hash 或版本失敗時，最小 recovery 是保留 pin、讀取診斷或切換同 scenario fallback；不可用 latest package 讓錯誤消失。當前 lock SHA 與安裝 receipt 沒有 frozen artifact，故只保留 placeholder。

## S014 — 先驗證 provenance，再改 policy

這一步把『我拿到什麼』與『我改了什麼』分開。講師可依序指向 release、upstream、wrapper、lock 與 policy API 的 lineage；學員先確認 scenario anchor 與版本邊界，再進入 marked policy。若 provenance 不一致，這次 run 不具備公平比較資格，應回到 named release 或同情境 fallback。所有現行 receipt、hash 與畫面都尚未凍結，不可自行填入。

## S015 — 讀懂 READY receipt

READY 不是 energy saving 的結果，而是允許進入 prediction 與 run 的環境門檻。講師帶學員區分 runtime、release、scenario、policy API 等 gate 欄位與稍後的 packet/service/state/energy evidence。若 receipt 不是 READY，先定位是哪個 gate 失敗；不要把等待安裝或修復的時間說成節能證據。因 exact command 與 receipt schema 尚未凍結，本頁刻意不捏造命令或 artifact ID。

## S016 — setup recovery gate：第 10／13 分鐘

setup recovery 是時間保護，不是另一個實驗。若第十至第十三分鐘仍未完成環境，改用同一 scenario、seed 與 predecessor 的 fixture result，並把 fallback provenance 留在 workbook。這樣仍能進入 anchor 與 Lab A，而不會把安裝等待誤當成 energy evidence。講師要明確說明 INCOMPLETE 是誠實狀態，不是需要補寫的成功數字。

## S017 — 固定、控制、觀察的變數

把實驗拆成三個區域，學員才知道什麼可以改、什麼必須維持、什麼是結果。scenario、seed、trace、traffic 與 units 是固定條件；marked policy 是受控變因；queue、service、state time、packet outcomes 與 endpoint J 是觀察欄位。system consumed J 與 canonical bit/J 留在另一個 evidence layer。請學員在 run 前先寫一個可被結果推翻的 prediction。

## S018 — Endpoint state vocabulary

先建立狀態詞彙，再進入 policy code。WAIT 是醒著的 idle，SLEEP 是低功率休息；兩者都可能影響時序，但只有 SLEEP 的回到工作狀態會引入明示的 wake latency 或 wake energy。PROCESS、TX、RX 也要各自保留 state time，最後才把各段的功率乘時間累積成 endpoint J。請學員用一條 state ribbon 說明一次傳送前後發生了什麼。

## S019 — WAIT 是 awake idle；SLEEP 有 wake 成本

這頁要拆掉『只要睡眠就一定省』的直覺。WAIT 保留醒著的反應能力，SLEEP 降低休息功率但可能在重新工作時付出 wake latency 與 wake energy；同一段 rest duration 也可能導致不同的 service 結果。公式只用來說明各 state 的功率乘時間與 wake 成本如何累積，方向仍是 prediction，必須由 replay ledger 的 state、delivery、deadline 與 J 來判定。

## S020 — Packet lifecycle

把 packet 從生成到結果排成一條 lifecycle，學員可以沿著同一筆資料看 queue age、attempt、retry、delivered 或 expired。一次 attempt 不是一次 delivered；rate 也不能替代任務是否完成。講師可先讓學員預測某個 pacing 或 rest policy 會讓哪一段變長，再於後續 lab 對照 packet ledger。這一頁不放現行 run artifact 或 KPI。

## S021 — 先畫 service boundary，再比 energy

公平比較的第一個問題不是哪一組 J 較低，而是兩組是否完成同一個 job、在同一個 window 與 boundary 下被評估。required packets、unique delivered bits、deadline、freshness 與 evaluation end 要先固定；service pass 與 energy 另欄記錄。若只比較 W、J 或 rate 卻換了任務，就不能說是 saving。當前 service receipt 與 browser artifact 尚未凍結，這裡只教 boundary。

## S022 — Python survival：常數是 bounded controls

Python survival bridge 只教學員讀懂一個 bounded control，不要求掌握 framework internals。先辨認常數所在的 marked region，再說明它如何改變 policy decision timing 或 branch；engine、scenario、schema 與 evidence writer 都不在可改範圍。預期不只看 policy hash 改變，還要看到 queue、packet、state 或 endpoint J 的可檢查後果。released code、line 與 SHA 尚未凍結，不放假畫面。

## S023 — Python survival：比較與 Boolean 條件

比較式與 Boolean 條件是 policy 的決策閘門。講師逐段問：輸入是哪個已發生的 observation？條件何時成立？成立後只允許哪個 legal action？這樣可避免學員偷看 future quality、future energy 或結果欄位。短暫 spike 不等於穩定訊號，後續 Lab B 會用 hold 與 hysteresis 延伸此概念；現行 code、line 與 browser receipt 仍是 placeholder。

## S024 — Python survival：縮排與觀測輸入

這頁只保留 Python 閱讀所需的最小範圍：看縮排如何決定 branch scope，看 observation 如何進入一個 action。學員不需要修整個 framework；若 traceback 指向 marked line，採最小修復並重新連回 mechanism。若 error 來自未允許的 upstream 或 API 變更，保留 failure evidence、恢復 pinned policy，不能把修改擴大。錯誤文字與 line number 尚未 release-freeze。

## S025 — Python survival：合法 return actions

policy 的 return action 是一個受約束的決策介面，不是任意字串。講師將 API card 放在左側，把 observation、action 與 state/packet consequence 串起來；學員只在 legal action set 中選擇。非法 action 應 fail closed，並保留 mismatch 的 recovery 線索，而不是偷偷擴充 API 或改 runner。現行 API version、action names 與 receipts 都必須等 freeze 後再補。

## S026 — W 是 rate；J 會隨時間累積

這頁把常被混用的 W、J、bit/s、delivered bits 與 bit/J 分開。W 是某一狀態的瞬時功率，J 是功率乘時間的累積；因此短暫低 W 不必然代表整個工作耗能較低。endpoint bit/J 只是在 endpoint energy scope 與固定 service boundary 下的 derived field，不能取代 system layer 的 canonical bit/J。請學員先問任務是否完成，再讀 energy。

## S027 — 公平 baseline 先固定 job、window、boundary

A/B 比較的可信度來自邊界相同，而不是來自最後一張漂亮卡片。先固定 job、traffic、required delivery、evaluation window、contact、deadline、freshness 與 energy scope，再把 inherited policy 與一個 marked change 分成 A/B。結果欄位仍要分開記錄 service、delivered bits、state time 與 endpoint J。若換了 predecessor 或 window，應重新標記為不可比，不得補寫 saving claim。

## S028 — Source → model → course assumption

不要把來源、模型轉換與課程假設壓成同一個數字。source 可以是 pinned TLE、upstream model 或課程 authority；model 將來源轉成 contact、quality、state 與 packet trace；wrapper 另外加入 awake-idle、wake、traffic 或 mission rule 等 assumptions。結果再由 policy action 走到 service、state time 與 endpoint J。學員要能沿著 scenario_id、seed、policy hash 與 artifact provenance 回溯；未凍結 evidence 一律保留 placeholder。

## S029 — 一個 scenario_id 貫穿 runner、replay、workbook

scenario_id 是 identity spine，不只是檔名。從 TLE anchor、scenario package 到 runner、result JSON、Leo import、endpoint replay 與 workbook，都必須回聲同一個 scenario anchor；seed、policy hash、units 與 anchor hash 也要一起驗證。任何 mismatch 都要 fail closed，session 不接受部分更新。這頁不提供現行 hash 或 import receipt，因為 controller 尚未完成 evidence freeze。

## S030 — 合法 interval 讓 LEO 限制 send／wait 選擇

這頁將 LEO 壓縮成一個 legal interval 問題：服務窗口開啟、品質變化、窗口關閉，policy 必須在當下可用的 observation 上做選擇。超出 contact window 或偷看 future quality、future energy 都是不合法的比較。學員先預測 send now、wait、batch、sleep 如何影響 service 與 endpoint J，之後才在 Lab A 用同一個 boundary 檢查。TLE、trace 與畫面尚未凍結，不放數值。

## S031 — Lab A：同一工作，不同節奏

Lab A 的 driving question 很窄：同一工作與同一窗口下，只改送出節奏或 gap 中的休息選擇。講師先讓學員寫 prediction，再確認 scenario、traffic、mission window 與 predecessor 固定；可觀察欄位包括 attempt timing、queue age、service、WAIT/SLEEP time 與 endpoint J。方向性預期不是答案，更大的間隔可能減少頻繁動作，也可能錯過 deadline，必須由 baseline、candidate 與 hidden ledger 判定。

## S032 — 讀 PACE_GAP_STEPS marked block

先不急著改數字，逐行辨識 PACE_GAP_STEPS 如何進入 send 間隔的 decision。講師要把 marked block 與 runner、scenario、result writer 分開，讓學員知道可改範圍與不可改範圍。預測應涵蓋 send time、attempt、queue age、state time、service 與 endpoint J；若 replay 沒有 consequential difference，就判定 fixture 或 policy path 未造成後果，不用動畫或標籤補救。released line、API 與命令仍是 placeholder。

## S033 — 讀 REST_DURING_GAP：WAIT 或 SLEEP

這頁把 Lab A 的第二個 bounded choice 讀清楚：REST_DURING_GAP 只在 legal API 中選 WAIT 或 SLEEP。WAIT 是 awake idle，SLEEP 可能帶來較低休息功率但要付 wake latency 或 energy；因此 prediction 必須同時寫 state-time、wake、delivery、deadline 與 endpoint J。若 action 非法或 evidence 差異為零，保留 failure 並只恢復 marked block，不去改 runner。API、line 與 run/browser receipt 尚未凍結。

## S034 — Mechanism：節奏、休息、服務與 J

在實際 run 前，用這條 state ribbon 把 Lab A 的 mechanism 說完整：gap 先改變 send spacing，rest choice 再把時間放到 awake-idle 或 sleep，window 的剩餘長度決定服務是否仍可完成。mode sequence 影響 attempt、retry、delivery，最後各 state duration 才累積成 endpoint J。這頁不承諾方向性 KPI，只提供 prediction 所需的因果鏈與觀察欄位。

## S035 — 先預測 queue、service、state time、J

Lab A 的 prediction lock 要在 baseline 或 candidate run 之前完成。DO 是先寫 queue、service、state time、attempt/delivery 與 endpoint J 的方向；WHY 是讓結果可以確認、推翻或留下 null diff；MECHANISM 是 prediction 先於 result ID，並固定 scenario、window、traffic 與 predecessor；EXPECT 要指出 PACE_GAP_STEPS 與 WAIT/SLEEP 可能改變哪一段 evidence；INTERPRET 必須保留支持、推翻或無差異的 causal clause。workbook、result ID 與 KPI artifact 尚未凍結，故本頁只示範欄位與解讀方式。

## S036 — 先跑基準線

保護時段是第 29–50 分鐘的 Lab A；這一頁的目的，是把未改動的 policy 變成後續比較的控制線。講師先指出 scenario、job、service window 與 energy boundary 都必須固定，再請學員說出如果少了其中一項，A/B 就不公平。學員只啟動 release 所提供的 baseline 流程，不修改任何 policy；預期看到一份可辨識的 receipt 與 result，但目前 command、receipt、artifact 和 KPI 都尚未 release-freeze，投影片只保留 EVIDENCE PLACEHOLDER。若 runner 失敗，將它分類為操作證據而非節能結果，轉入同場景 fallback，並保留這個 checkpoint 的 provenance。常見誤解是把 baseline 的數字當成最佳答案；講師要強調它只是控制線。快完成的學員可先寫下 candidate 可能改變的 queue、service、state time 與 endpoint J。來源：ADR-004 的 baseline/candidate 決策、C120 SDD §5.4、§9.3–9.5；最高 claim ceiling 仍是 simulated teaching data。

## S037 — 只改一個區塊

這一頁落在 Lab A 的 edit-run 段落，保護目的不是教完整 Python，而是讓學員看見一個受界定的決策面。講師逐一讀出兩個標記名稱，說明只允許改 active block；學員先預測較大的間隔或 WAIT/SLEEP 選擇會怎樣改變 send timing 與 state time，再留下小幅 source diff。runner、scenario、energy equation 與 evidence writer 都不可動，否則比較失去因果隔離。預期交付 candidate evidence diff 與 freeze receipt，但 release line、command、hash、result 尚未凍結，因此正文顯示 EVIDENCE PLACEHOLDER，不能填入看似合理的行號或 KPI。若語法或合法 action 錯誤，恢復上一份 marked block，不要重寫整個檔案。常見誤解是把改常數當成調參競賽；這裡只測一個機制假設。快完成的學員可寫出 null diff 時的 falsifier。來源：C120 SDD §8.3、policy teaching map；action matrix ACT-09、ACT-10A。

## S038 — 匯入同一邊界

這一頁是 Lab A 的 import checkpoint，保護目的在於把 runner 與 Leo 的 trust boundary 說清楚。學員交付的是 JSON artifact，不是上傳或執行 Python；Leo 只接受經過 schema、scenario identity、seed、policy、units、events 與 provenance 驗證的結果。講師先讓學員預測成功匯入後應出現 matching endpoint replay，再展示 fail-closed 的意義：任何 identity 或 unit mismatch 都不應留下半套 session。當前 browser pixel、JSON instance、receipt 與 KPI 都尚未凍結，正文與講義不得捏造畫面，僅放 EVIDENCE PLACEHOLDER。若匯入失敗，修正指定 artifact 或切換同場景 fallback，不要在瀏覽器補算。常見誤解是把匯入成功等同於科學真值；這裡只代表 contract 驗證通過。快完成的學員可指出 endpoint replay 與 canonical system replay 的分層。來源：ADR-004 §Decision 3–6、C120 SDD §6、§10；action matrix ACT-11。

## S039 — Lab A 因果回顧

第 29–50 分鐘的 Lab A 在此收束；hidden condition 不是再給一個 slider，而是把相同 policy 放到未揭露的 cost 或 window 上。學員先確認 hidden replay 保持 identical policy identity，再比較三列 ledger 中的 queue、service、state time 與 endpoint J。講師要把『方向支持』、『counterexample』與『inconclusive』分開，不讓一個漂亮的數字取代因果敘述。當前 case 名、artifact、browser evidence 與 KPI 尚未凍結，所有欄位都只可標成 EVIDENCE PLACEHOLDER。若 policy bytes 變了，這次就不再是 withheld evidence，應回到 frozen receipt；若結果沒有 consequential diff，記錄 fixture 無後果並停止擴大結論。慢速學員可先完成一句「改變了什麼／犧牲了什麼」；快速學員可指定下一個可推翻假設的條件。來源：issue 11 Lab A evidence floor、C120 SDD §4.2、§8；action matrix ACT-12A；donor concepts 19–21、36–39 只作重寫提示。

## S040 — Lab B：現在送還是等？

第 50–71 分鐘進入 Lab B；第一句先把 LEO 降回 changing-service-window 的例子，避免課程變成衛星專題。講師用一條 quality trace 問學員：現在送或等一下，哪個決策可能守住 service 並少花 state energy？學員要把 entry、hold、exit 看成同一個 send-ready state 的三個條件，而非任意調整的三個 slider。這頁只建立問題與預測格式，不提前公布 Trace A 或 Trace B 的結果。可移轉的語言是 decision time、contact window、queue、service 與 endpoint J；canonical system energy 仍是另一層。慢速學員可先標示兩個可能的 decision points，快速學員可寫一個可能 counterexample。來源：issue 11 Lab B、ADR-004 的 changing-window framing；所有 live、measured 與 canonical-parity 宣稱仍被 claim ceiling 限制。

## S041 — Entry 何時成立？

這頁用一個 threshold crossing 作為主視覺，講師先讀條件再談數值，避免學員把門檻當成答案。學員只需圈出 ENTER_QUALITY 的標記區域，說出它決定的是進入 send-ready mode 的時刻，而不是 packet delivery 本身。較高 entry 的方向性只是一個可檢驗假設：它可能減少邊緣進入，也可能錯過短窗口。release code、line reference 與 trace 尚未穩定，故正文保留 EVIDENCE PLACEHOLDER，不寫行號、不寫畫面。預期的 observation 是 first entry、wait、service 與 endpoint J；若方向相反，應記錄 counterexample 而非把門檻改回去。慢速學員可用「進入太早／太晚」二選一，快速學員可指出接觸窗口如何使兩者都可能發生。來源：C120 SDD §8、§8.3、B-ENTER teaching map。

## S042 — Exit 為何要分開？

講師在這頁先畫兩條帶：entry band 和較低的 exit band，讓學員看見 hysteresis 的幾何意義。EXIT_QUALITY 不是第二個獨立目標，而是已進入 send-ready mode 後的維持條件；它可能減少 mode chatter，也可能讓 endpoint 在較弱 quality 下保持 active 更久。學員預測應鎖定 mode transitions、retries、service 與 state time，不能只看一張 final KPI 卡。release line 與 trace 尚未凍結，因此正文與 notes 都不提供假的行號或數值，只保留 EVIDENCE PLACEHOLDER。若結果和預測相反，這是值得保留的 evidence，不是需要掩蓋的錯誤。慢速學員可先找出一次「進入」和一次「退出」，快速學員可預測短暫 quality dip 對兩種門檻的不同影響。來源：C120 SDD §8、B-EXIT teaching map；donor hysteresis concept 只作改寫參考。

## S043 — Stable steps 擋住尖峰

這頁把 stable-step counter 當成一個時間過濾器，而非品質分數。學員讀出連續觀測的條件後，先預測較長 hold 會如何改變 first entry 與短窗口中的 missed opportunity。講師提醒：它可能減少短促 entry，也可能讓 service 變差；這是 hypothesis，不能預填 KPI。release marked lines、Trace A 與 browser evidence 未凍結，正文的 EVIDENCE PLACEHOLDER 必須保持可見。結果要沿著 first entry → wait → contact remaining → service → endpoint J 解讀；不要只看 mode count。若語法錯誤，回到上一個合法 marked block，不要改 engine。慢速學員可在 trace 上數出連續步驟，快速學員可提出「剛好錯過窗口」的 held-out 條件。來源：C120 SDD §8、B-HOLD teaching map。

## S044 — 先預測 Trace A

這頁是 Lab B 執行前的 prediction lock，保護時段仍是第 50–71 分鐘。學員要先寫 first entry、wait count、service 與 endpoint J 的預測，再看 Trace A 結果；這個順序避免用 outcome 反推看似合理的故事。講師固定 scenario、trace、traffic 與 predecessor policy，說明預測是可回溯的實驗前承諾。Trace A 的現行 data、artifact、KPI 和 workbook pixel 尚未凍結，正文標示 EVIDENCE PLACEHOLDER。若 observed mode 或 service 沒有任何 consequential change，就只能報告 null diff，不能稱為成功。慢速學員可用方向詞完成句子，快速學員可寫出一個會推翻預測的 quality segment。來源：action matrix ACT-07、C120 SDD §8.3、§10.3。

## S045 — Trace A：基準與候選

這頁把 Lab B 的 baseline 與 candidate 並列，但不展示未凍結的 terminal screenshot。學員先執行 untouched Trace A baseline，再只改 Lab B marked block 執行 candidate；predecessor policy、scenario、seed、traffic 與 boundary 都必須相同。講師指出這個 sequence 是公平比較的機制，而不是盲目複製兩個 command。commands、results、hash、KPI 仍是 EVIDENCE PLACEHOLDER；正式 release API 後才可替換。若結果只改動畫或 label，視為未通過 consequential-fixture gate；若有 queue、mode、service、state 或 endpoint J 變化，才進下一頁 freeze。慢速學員可先在 ledger 標記固定與可變欄，快速學員可提前指出最可能的 trade-off。來源：C120 SDD §8、§9.3、§9.4；action matrix ACT-08B、ACT-10B。

## S046 — 先凍結 policy

這頁是 Lab B 的關鍵 gate，保護目的在於讓 Trace B 成為真正的 withheld test。學員以已接受的 Trace A candidate 建立 freeze，理解 receipt 綁定的是 policy bytes、scenario、predecessor 與 active block，而不是一個手寫標籤。講師要強調 freeze 不是宣稱 KPI 變好，而是宣稱比較條件已固定。current receipt、schema、line 與 browser evidence 尚未 release-freeze，正文必須保留 EVIDENCE PLACEHOLDER。若任何 bytes 改變，Trace B 只能重新走 Trace A candidate/freeze，不可把新結果冒充 held-out evidence。慢速學員可用 identity checklist，快速學員可說明為何 filename 不能取代 content hash。來源：C120 SDD §9.3 freeze receipt、§10.3；action matrix freeze dependency。

## S047 — Trace B 不准重調

講師先遮住 Trace B 的形狀，再請學員用已凍結的 policy 執行，不允許看見結果後調整門檻。目的不是追求每一條 trace 都變好，而是看規則在新 quality/contact 條件下是否仍有合理 causal explanation。預期輸出是 Trace B replay 與一個 qualified verdict；command、result、browser、KPI 尚未凍結，全部以 EVIDENCE PLACEHOLDER 標示。若 changed bytes 出現，這次結果只能算 retuning，應恢復 frozen file/receipt。常見誤解是把 held-out pass 當成普遍最優；講師應要求學員指出條件與 claim scope。慢速學員只需回答支持、推翻或無法判定，快速學員可寫出下一個 fair counterexample。來源：C120 SDD §4.2、§9.3、§10；action matrix ACT-12B。

## S048 — 沿著 evidence 讀

這頁教學員如何讀 evidence，而不是只看最後一個數字。講師引導從 mode changes 到 attempts、retries、service，再到 endpoint J，讓每一個結論都有事件鏈。瀏覽器只呈現 validated artifact，不在 client 端新算科學結果；這也保留 endpoint 與 canonical system 的層級差異。現行 browser、result artifact 與 KPI 未凍結，正文只放 EVIDENCE PLACEHOLDER。若 Trace B 是 counterexample，應保留它並重寫 qualified claim，不能用顏色、動畫或 label 把它改成成功。慢速學員可沿箭頭讀一條事件，快速學員可指出哪一個事件最能推翻預測。來源：C120 SDD §9.5–9.6、§10.3；donor trace/evidence concepts 只作改寫。

## S049 — Lab B：承認反例

第 50–71 分鐘的 Lab B 在此完成 debrief；主視覺的三格不是成績榜，而是三種證據狀態。學員要以 frozen policy 為前提，將 Trace B 歸為支持、counterexample 或 inconclusive，並寫一句「由於哪個機制，哪個 evidence 改變／沒有改變」。講師可用 too-slow 或 ping-pong 作為語言 scaffold，但不預先宣稱哪一格會出現。artifacts、browser、KPI 與 case identity 未凍結，故 EVIDENCE PLACEHOLDER 不可刪除。若身份或 freeze 不符，回到 recovery；不要偷偷改 policy 或填入缺失數字。快完成的學員可提出一個下一輪實驗，慢速學員只需完成 causal stem。來源：issue 11 Lab B evidence floor、C120 SDD §10.3；donor concepts 12、36–39。

## S050 — Recovery：保存再開

第 71–76 分鐘是 recovery reset，保護目的在於讓課程不因一次操作失敗而遺失因果鏈。學員保存 checkpoint 後重新開啟，確認 scenario identity、prediction、receipts、artifacts 與 recovery provenance 仍在；reopen 不應重算數值，也不應自動把缺欄補成完成。當前 workbook receipt、pixel、artifact 尚未 release-freeze，正文以 EVIDENCE PLACEHOLDER 呈現。講師展示 COMPLETE 與 INCOMPLETE 是兩種誠實狀態，不是失敗與成功的美化標籤。若 runner 或 import 仍阻塞，保留已存在的 evidence，切到 matching fallback，再回到 Lab C。慢速學員可照 identity checklist，快速學員可指出哪個缺失欄位必須維持 INCOMPLETE。來源：C120 SDD §4.1、§12、§14；action matrix ACT-13。

## S051 — 同場景 fallback

這頁把 fallback 定義成同場景的保護路徑，而不是另一組資料或隱形捷徑。講師說明 setup、run、import 任一處卡住時，學員在保護時限內切換 matching artifact；它保留 scenario identity、clock 與 provenance，讓 causal lesson 可以繼續。fallback 不是 measured energy、live backend 或 canonical parity 證據。artifact、browser、recovery clock 與目前 UI 都尚未凍結，所以正文清楚標示 EVIDENCE PLACEHOLDER。學員要在 workbook 記錄「為何切換、回到哪一頁、哪些結果是 fallback」，不能刪除失敗歷史。慢速路徑是直接重建 queue → action → state → energy；快速路徑可比較 normal 與 fallback 的 claim boundary。來源：ADR-004 Decision 7、C120 SDD §4.1、§14；action matrix ACT-04、ACT-11。

## S052 — Lab C：佇列如何花 J？

第 76–99 分鐘進入 Lab C；主問題不是把節能定義成少送資料，而是在有限 service window 與 budget 下，怎麼安排 queue、batch、sleep 與 urgent send。講師固定 scenario、traffic、service boundary 與 mission window，再分開 normal freshness/deadline 和 urgent deadline。學員先說出「少花 J 但失去 required delivery」不算合格節能，之後才進入 policy edit。這頁不依賴未凍結的 browser 或 KPI，概念可以完整教學。慢速學員可先將 queue cards 排成 generated → send → delivered/expired，快速學員可提出 batch 與 urgent 互相衝突的窗口。來源：issue 11 Lab C storyboard、C120 SDD §8–§9.6；endpoint energy 只在 declared endpoint scope 內解讀。

## S053 — 三件事不要混

講師在這頁讓三張卡各自站在不同時間軸：queue age 是等待歷史，deadline 是最晚完成，freshness 是資訊還有沒有用。學員要能指出三者不是同一個 score，也不能用一個漂亮的 endpoint bit/J 掩蓋 deadline 或 freshness 失敗。policy 只可看到 decision-time 的合法 observation；future delivery、future collision、final service 與 future energy 都是結果。這個概念是後面 batch/urgent edit 的護欄，不需要 current runtime evidence。慢速學員可用三個提問逐卡回答，快速學員可設計一張 urgent 卡和一張 bulk 卡比較。來源：C120 SDD §8.1、§9.6；issue 11 Lab C contract。

## S054 — Batch 換取等待

這頁把 BATCH_SIZE 當成一個 schedule mechanism，而不是「越大越省」的旋鈕。學員只圈出 marked positive integer，預測 flush 時機、activation、wake/TX 次數與 queue age 的變化。講師要同時放上 service gate：如果 expired 或 required delivery 變差，單看 J 下降不能算成功。現行 code、result、browser 與 KPI 未凍結，正文的 EVIDENCE PLACEHOLDER 必須保留；不要填入擬真的 batch count。預期解讀路徑是 queue age → delivered/expired → service → endpoint J。慢速學員可先比較小批次與大批次的時間線，快速學員可指定一個不值得等的 urgent deadline。來源：C120 SDD §8、C-BATCH teaching map；action matrix C-BATCH。

## S055 — Urgent 提前介入

這頁以倒數線表示 URGENT_MARGIN_S：它是 deadline override 的時間判斷，不是能量預算本身。學員先說出較大 margin 可能提前送 urgent、也可能較早花掉 energy；方向必須由 evidence 決定。講師把 normal pacing/batching 與 urgent branch 分開，提醒 urgent 不應偷換成第二套 headline ratio。current code、result、KPI 未 release-freeze，投影片只標 EVIDENCE PLACEHOLDER。解讀要同時查看 urgent send time、deadline/freshness 與 TX/RX/wake，再看 endpoint J。慢速學員可在 countdown 上畫觸發點，快速學員可構造一個 urgent 與 bulk 同時到達的 case。來源：C120 SDD §8、C-URGENT teaching map；action matrix C-URGENT。

## S056 — 讀 Lab C 標記線

這頁是 Lab C 的 code bridge，保護目的在於讓學員知道哪些線可以動、哪些線不能動。講師逐行說明 queue、urgent deadline 與 return action 的關係，再讓學員圈出 BATCH_SIZE 和 URGENT_MARGIN_S。runner、scenario、schema、energy model 與 browser logic 都不在 edit surface。因為 released code、line、API 未凍結，正文保留 EVIDENCE PLACEHOLDER，不能提供假的 screenshot 或行號。若 syntax 或 illegal action 失敗，只恢復 active block，並重新說出 mechanism；不要複製一份新的 policy。慢速學員可用 branch flow 圖，快速學員可指出哪個 future field 不能放進 condition。來源：C120 SDD §8.1–§8.3；action matrix ACT-06、C-BATCH、C-URGENT。

## S057 — 先鎖 Lab C 預測

第 76–99 分鐘的 Lab C 從 baseline prediction 開始，而不是直接改 batch 或 urgent。學員先寫 queue、service、state time 與 endpoint J，再執行 untouched baseline，這樣結果才有 confirm/falsify 的對象。講師說明 default policy 只是 control，不是最佳排程；service gate 與 endpoint energy scope 必須同時保存。baseline artifact、result、browser 與 KPI 尚未凍結，正文標示 EVIDENCE PLACEHOLDER。若學員忘記預測，這次可以探索但不能宣稱完成 causal checkpoint。慢速學員可用四欄 workbook stem，快速學員可加寫 delivered/expired 的預測。來源：action matrix ACT-07、ACT-08C；C120 SDD §8.3、§9.5–9.6。

## S058 — 只改一次再跑

這頁把 Lab C 的第一次 candidate 限定為一個 marked constant，並要求在相同 boundary 下執行。學員先選擇要測 batching 或 urgency，寫出預測，再留下 small diff；不要同時改兩個常數。講師把 action time、queue、state、energy 與 service 綁在同一條 causal chain。command、hash、artifact、KPI 未凍結，正文維持 EVIDENCE PLACEHOLDER，不假造 result。若沒有 consequential diff，這不是「看起來差不多」而是 fixture gate 未通過；恢復 active block 或記錄 null result。慢速學員可用一條 mechanism stem，快速學員可設計一次 service trade-off 的比較。來源：C120 SDD §8.3、§9.3；action matrix ACT-09、ACT-10C1。

## S059 — 先看 packet，不看總分

這頁要求學員先讀 packet lifecycle，再看任何總結數字。講師依 generated → attempt → retry/delivered/expired 的順序帶讀 queue strip，讓學員看見 batch 或 urgent choice 的實際後果。少做 activation 不等於完成任務；delivery、freshness、deadline 與 service 必須先過 boundary。current browser、artifact、KPI 尚未凍結，正文清楚標示 EVIDENCE PLACEHOLDER。若 event 缺失，保留缺失並回到 validator/fallback，不在 workbook 手填一個合理值。慢速學員可只追一張 urgent card，快速學員可比較 normal 與 urgent 的 queue age。來源：C120 SDD §7.2、§9.5–9.6、§10.3；action matrix ACT-11。

## S060 — 再看 state 與 J

這頁把 Lab C 的 endpoint state ribbon 和能量分解放在同一條時間軸。學員依序找 sleep、awake-idle、wake、process、TX、RX，再理解每個狀態如何以 power × time 或 wake lump-sum 貢獻 J。公式只表達 endpoint layer 的 accounting，不能被拿去替換現有 C-120 canonical consumed J；講師要明說兩層 replay 不互相冒充。現行 browser、artifact、KPI 未凍結，正文只保留 EVIDENCE PLACEHOLDER。若 wake latency 使 contact 關閉，wake cost 仍可存在，但 send 不一定成功；這正是 service 與 energy 必須分欄的原因。慢速學員可先指 state，快速學員可比較同一送達量下不同 state time。來源：C120 SDD §7.1、§9.2.1、§9.6；ADR-004 two-layer replay boundary。

## S061 — 只准一次修正

這頁是 Lab C 的唯一 revision gate。學員先讀 candidate queue、packet、state、service 與 endpoint J，再選一個 evidence-backed mechanism，只改 BATCH_SIZE 或 URGENT_MARGIN_S 其中之一，並更新 prediction。講師要保留 predecessor identity，讓 revision 仍可和 baseline/candidate 對照。code、command、hash、result、receipt 尚未凍結，正文保留 EVIDENCE PLACEHOLDER。第二次 revision、跨區塊修改或把結果改成 label 都不合格；syntax error 只回到同一 marked block。慢速學員可用「觀察→推理→一個改動」三格 scaffold，快速學員可指出 revision 可能使哪個 service 欄位惡化。來源：C120 SDD §8.3、§9.3；action matrix ACT-10C2、ACT-10C3。

## S062 — Surprise case 收束

第 76–99 分鐘的 Lab C 在 surprise case 收束；學員不能在看到 surprise 後再改 policy。講師並列 candidate、revision、surprise 三列 ledger，要求學員找出省下的 power-time 成本與可能犧牲的 service、freshness 或 deadline。surprise artifact、KPI、browser pixel 都尚未凍結，正文標示 EVIDENCE PLACEHOLDER。若 policy identity 改變，這次不是 held-out evidence；若 result null，保留 null 並檢查 fixture 是否 consequential。慢速學員可完成一句比較句，快速學員可提出跨 domain 的相同機制。來源：issue 11 Lab C storyboard、C120 SDD §4.2、§8.3、§10.3；action matrix ACT-12C。

## S063 — Evidence clinic：何時可知？

第 99–109 分鐘是 evidence clinic；第一問是「在做決策的那一刻，學員真的知道什麼？」講師把 available-now 與 post-action 兩欄分開，讓學員把 elapsed、contact、quality、queue、urgent pending 與 previous action 放在合法欄，把 future delivery、collision、final service、energy 放在結果欄。這不是限制想像，而是確保 prediction 能被真正的 action test。current UI、schema、validator 未凍結，正文保留 EVIDENCE PLACEHOLDER。慢速學員可用卡片分類，快速學員可解釋 leakage 如何讓 offline score 看似變好卻不代表節能。來源：C120 SDD §8.1、§8.3、§19.2；issue 11 Evidence clinic。

## S064 — Prediction 不是 saving

這頁要拆掉最常見的錯誤推論：prediction accuracy 高，不代表 energy saving 或 service pass 高。學員用 legal feature 與 leaky future result 做一次分類，理解 policy 的 input 與 replay 的 output 是不同角色。講師要求任何節能句子都回到 service、state、J 與 declared scope，而不是停在 score。released API、validator、browser evidence 未凍結，正文的 EVIDENCE PLACEHOLDER 是必要的誠實標記。慢速學員可只回答「現在知道／事後才知道」，快速學員可反駁一個把 future energy 放入 feature 的設計。來源：issue 11 Evidence clinic、C120 SDD §8.1、§9.6；donor evidence qualification 70–75 只作改寫。

## S065 — 證據要帶 provenance

講師把 evidence record 當成一條 lineage spine，而不是一張散落的結果表。學員要能找出 scenario_id、case、policy identity、seed、source mode、events、summary、energy scope 與 units，並把 measured、derived、assumed、simulated 分類保持分開。任何 claim 都必須回到這筆 record 能支持的 boundary；endpoint energy 不能被改名成 canonical system energy。current artifacts、hashes、browser evidence 尚未凍結，正文顯示 EVIDENCE PLACEHOLDER，避免填入假 receipt。慢速學員可完成 identity checklist，快速學員可判斷一個缺 provenance 的數值為何只能作 unverified。來源：C120 SDD §7.1–§7.2、§9.5–§9.6、§20；donor concepts 70–75、96–97、113。

## S066 — Claim 有上限

這頁把 claim ceiling 放到 evidence clinic 的最後，讓學員知道誠實不是把課程說小，而是把證據說準。允許的方向是 course-packaged simulated LoRa endpoint-energy lab integrated with Leo for bounded novice validation；不可宣稱 live、measured、canonical parity、whole-system/wall-plug 或 classroom-ready。講師特別指出 endpoint replay 與現有 C-120 system evidence 是兩層，不可把 endpoint J 或 endpoint bit/J 改名成 canonical。release、browser、KPI 與 human gates 未完成前，正文保留 EVIDENCE PLACEHOLDER。慢速學員可用 claim ladder 判斷句子能否保留，快速學員可把一個過大的 claim 改寫成 bounded claim。來源：ADR-004 Decision 8、C120 SDD §9.6、§20；issue 11 claim boundary。

## S067 — 把機制搬出去

第 109–120 分鐘開始 competition transfer；這頁先把機制 token 從 LEO 拆出來，再放入智慧農場、HVAC、edge inference 與物流。學員要看到可移轉的是 batch、freshness、wait/act、wake cost、urgent margin 與 deadline，不是 TLE 或衛星名稱。講師要求每個 domain 都保留同一條 policy → queue/service → power×time → J → evidence 骨架。這頁不需要 current browser 或 KPI，概念可以完整講；若學員想引用 LEO 數字，提醒 claim scope 仍是 simulated endpoint layer。慢速學員可挑一個 domain 完成機制替換，快速學員可指出其 held-out condition。來源：issue 11 Competition transfer、C120 SDD §1、§13.1。

## S068 — 寫可推翻的假設

學員在這頁把課程結果翻成 competition hypothesis，保護目的不是寫口號，而是留下可反駁的機制。講師可提供句型「在固定 mission 與 service boundary 下，若改變某個 decision rule，則哪個 evidence 會改變」，再要求寫 direction、boundary 與 held-out condition。hypothesis 必須連到 queue、service、state time 或 J，不能只說更聰明、更快或更省。final workbook artifact 尚未凍結，正文保留 EVIDENCE PLACEHOLDER。慢速學員可先完成一個 domain token remap，快速學員可加入可能的 counterexample。來源：issue 11 Competition transfer、C120 SDD §1、§13.1；claim ceiling 仍不可逾越。

## S069 — 先寫 falsifier

這頁在 exit 前把 falsifier 寫清楚：同一 policy、不改 bytes、換一個合理但未揭露的 window、trace 或 urgent event。學員先指定會讓假設失效的條件，再寫若它發生要看哪一個 service/state/J evidence。withheld artifact 與 KPI 未凍結，正文以 EVIDENCE PLACEHOLDER 呈現；不可用假數值保證支持。講師提醒：若為了通過 falsifier 而先改 policy，結果不再是 held-out evidence，必須回到 frozen receipt。慢速學員可選一張條件卡，快速學員可設計不只一個 counterexample 並說明哪個更公平。來源：C120 SDD §4.2、§9.3、§10.3；issue 11 evidence floor。

## S070 — Export，重開，再離場

最後 109–120 分鐘的 exit gate 是 export、close、reopen，而不是投影片播完。學員要確認 workbook 保存 scenario、predictions、run/import/freeze/fallback provenance、hypothesis 與 falsifier，關閉後再開仍指向同一 identity。講師強調 reopen 不會重算或補造結果；缺 evidence 就保持 INCOMPLETE，這比假裝完成更有教學價值。current workbook JSON、receipt、browser pixel 未凍結，正文保留 EVIDENCE PLACEHOLDER，不能寫假的 COMPLETE 截圖或 KPI。若 session 中斷，先重綁同場景 fallback，再回到 exit；若證據完整，仍只作 bounded simulated teaching claim，等待 owner 與 human gates。慢速學員可依 export checklist 完成，快速學員可口頭說明一個 claim 的 provenance。來源：C120 SDD §12、§14、§19.4–19.5；action matrix ACT-13。

## S071 — Setup 分支：八分鐘時鐘

這一頁是準備分支的時間契約，不是冷啟動已通過的證明。依 issue 11 的 exact-120 cadence，準備必須有明確的 05–08、08、10、13 分鐘節點；ADR-004／SDD 允許使用準備好的 runner，但仍保留同 scenario fallback。請引導學員先說出每個節點的目的，再看現行收據；命令、路徑與收據尚未凍結時，畫面只顯示 EVIDENCE PLACEHOLDER。若切換 fallback，明示這是保持課程因果鏈的 recovery，不是 runner、live 或 canonical parity 的通過。

## S072 — 確認釋出根目錄

把根目錄當成第一個 provenance 檢查，而不是檔案尋寶。SDD 的課程套件包含說明、跨作業系統 setup、鎖定依賴、policy、runner 與 schemas；這些角色要來自同一個 reviewed release。不要在課堂中補上看似相近的檔案，也不要把任意 branch 當成釋出版本。真正路徑與檔名尚未由 controller freeze，因此畫面必須保留 placeholder；缺檔時回到 named archive，並在 workbook 留下 recovery provenance。

## S073 — 診斷環境與 lock

請先把故障放回它所屬的層次：環境、依賴 lock，或後續 runner。setup 失敗不是功率、能量或服務結果，也不應用來比較 policy。隔離 interpreter 的目的，是避免系統 Python 或另一個專案的套件污染課程 runner；hash-pinned lock 的目的，是保留 reviewed dependency graph。現行錯誤欄位與 hash 尚未凍結，不能填入猜測值；移除 pin 會破壞可追溯性，應改走診斷或同 scenario fallback。

## S074 — 讀一則 setup 錯誤

這一頁教的是錯誤閱讀的範圍控制。請讓學員指出錯誤發生在 runner 尚未開始之前，並用一個類別描述它；不要把課堂變成框架除錯課。最小 recovery step 可以是重新使用支援的啟動方式、確認釋出根目錄，或切到同 scenario artifact，但具體命令仍等待 release evidence。錯誤證據未凍結前不能寫出實際 traceback；若分類不明，保留不確定性並轉入 fallback。

## S075 — 匯入同 scenario fallback

fallback 的關鍵是同一 scenario identity，而不是一張看起來相似的預設畫面。issue 11 要求後續 labs 消費學員產生的 scenario_id；若走 identical fallback，workbook 與全畫面都要標 source_mode=fallback。ADR-004 將 fixture 保留為 mandatory classroom recovery，且不把它冒充成 live backend。artifact ID、import receipt 與實際畫面目前都未凍結，請保留 placeholder 並讓 provenance 可在 reopen 時追溯。

## S076 — Python 復原：縮排

這不是要求學員重寫 Python，而是把一個標記區的結構讀清楚。用縮排階梯說明條件、合法 action 與 return 必須在預期 block 內；不要在頁面上偽造釋出行號或實際程式片段。修復目標是恢復 policy API 的可執行路徑，並讓後續 runner event 能被觀察，不是更動科學公式或 upstream engine。若 syntax gate 仍紅，回到同一標記區；不要藉機修改其他區域。

## S077 — 比較式與合法 action

請把 syntax 與 semantics 分成兩個判斷。比較式要使用當下允許的 observation，return 則只能選擇 pinned API 允許的 action；兩者都不能偷看未來結果或改寫 runner。實際 API 名稱、released text 與錯誤訊息尚未凍結，所以頁面只保留 EVIDENCE PLACEHOLDER。即使程式能執行，也只代表某個操作 gate 可能通過，不能直接推出公平比較或節能結果。

## S078 — 只讀 traceback 標記區

traceback 閱讀的目的，是找到最小可控的修復點，而不是追查整個 framework。先找標記行，再將它對回 policy contract；不要從模糊的錯誤文字臆測行號。現行 traceback、line pointer 與 error message 都是未凍結證據，必須原樣以 placeholder 佔位。若錯誤不屬於標記面，保護來源與 workbook，改用講師 recovery 或同 scenario fixture。

## S079 — 修一行，接回機制

這一頁把程式修復重新接到課程的因果要求。學員只改一個標記行，然後確認 policy identity、runner event 與結果 artifact 是否仍能連起來；不要用畫面變色代替 consequential evidence。實際 code、receipt、hash 與 result 仍待 release freeze，因此畫面不能發明它們。若下游 queue、packet、state、service 或 endpoint energy 沒有變化，應判定 fixture gate 未成立，回到 lab debrief 或 recovery，而不是宣布成功。

## S080 — 快速分支：凍結 policy

freeze 是 Lab B 或快速分支進入 withheld case 前的公平性閘門。先把 policy bytes、scenario identity 與 receipt 綁在一起，再看新 trace；這樣 counterexample 才能說明機制，而不是反映事後調參。精確 freeze schema、hash preimage、artifact ID 都由 controller freeze 後才能放入教材。若凍結後檔案被改動，必須回復同一檔案與 receipt，或重新走同 scenario recovery；不能把新 policy 冒充 frozen policy。

## S081 — 預測公平 counterexample

快速分支不是多一個任意 slider，而是對同一 policy 提供一個公平的新條件。先固定 job、window、boundary 與 policy，再預測 opportunity 或 quality trace 改變時，service、state time、endpoint J、delivered bits 可能怎樣走。這些方向是待檢驗假說，不是保證的 KPI。實際 trace 與 result 未凍結時只顯示 placeholder；下一頁才執行 frozen policy replay。

## S082 — 不重調，直接跑新 case

本頁的操作前提是上一頁的 freeze receipt 已存在。學員不修改 policy，只對明示的 withheld sub-trace 執行 replay；因此觀察到的變化可以回到 opportunity、queue、state 或服務條件。命令、case name、artifact 與結果目前都未 release-freeze，不能在教材中虛構。若 ranking 改變，描述「在此條件下」的機制；不要將單一 withheld verdict 擴大成全面最佳。

## S083 — 反思排名為何改變

debrief 要把排名變化拆成可觀察的條件，而不是只問誰比較高。讓學員在 ledger 中標出 opportunity、queue、state time 或 service boundary 的差異，並說出 policy mechanism 期待改變哪條 causal link。baseline、candidate、withheld 的 ID 與數值仍是未凍結證據，所以這頁提供判讀框架而不提供答案。排名改變可能是公平反例；排名不變也不代表 policy 在所有條件都最好。

## S084 — Leo 匯入失敗：先看邊界

Leo importer 的核心行為是 fail closed：不相容 artifact 不應部分寫入 session。依 ADR-004／SDD，至少要保護 schema、scenario identity、seed、policy hash、units 與 provenance；這些欄位的實際名稱與 receipt 等待 contract freeze。請強調 endpoint replay 是自己的 evidence layer，不能把 endpoint energy 靜默改填既有 Leo/system consumed J。匯入失敗時 session 保持不變，修復命名 artifact 或切同 scenario fallback。

## S085 — 用 rendered artifact 繼續

離線 artifact packet 是「繼續學習」的證據包，不是把缺失的 runtime 或 browser evidence 藏起來。學員可讀已產出的 queue、packet、state、energy records，並把它們和 workbook checkpoint 綁定；此頁不執行新的 policy 或 run。packet path、receipt、browser pixels 與欄位尚未凍結，因此只能標示 placeholder。若 packet identity 或 source mode 不一致，停止使用並回到同 scenario fallback。

## S086 — 重建 queue 到 energy

復原時不要從最後的 J 值倒推故事；請沿著 queue、policy action、radio state、endpoint energy 的時間順序重建。每一條箭頭都需要對應事件、時間、packet outcome 或 energy field，並保留 scenario identity 與 units。若資料缺欄或 provenance 斷裂，不能以合理想像補足；停在 fail-closed，回到受影響 lab 或 fallback。這頁可作為 recovery reset 的口頭一句話骨架。

## S087 — 低 W 不等於低 J

這是從 donor W/J 概念重寫的 deepening，不是搬用舊數值或舊場景。用兩個 power-time area 讓學員看到低峰值但很久，可能累積更多 J；相反地，短暫高峰也要放回 service 與 deadline 檢查。公式只表達累積關係，不提供本課的實測或模擬數字。比較時固定 job、window、boundary；現行 P(t)、J 與服務 artifact 尚未凍結，請保留 placeholder。

## S088 — 先定 service boundary

此頁採用 donor 的 service gate 論證，但完全按 current C-120 authority 重寫。先固定工作、時間窗與 energy boundary，再把 endpoint ratio 與 system canonical ratio 分開：兩者的分子都使用 unique delivered bits，但分母分別是 endpoint J 與 system consumed J。service_pass、freshness、deadline、J 與 delivered bits 是分開的服務、限制與證據欄位。公式是可編輯的 raw LaTeX 語義提示，不代表本課已取得 KPI。若少做服務而 bit/J 看似上升，不能稱節能；endpoint bit/J 也不可稱 canonical bit/J。

## S089 — 兩層 energy authority

這一頁是防止語義混用的 authority map。ADR-004 把 LoRa endpoint replay 與既有 C-120 Leo/system authoritative replay 分開；兩者可共享 scenario、clock 與 workbook，但 endpoint energy 不能自動變成 system consumed J。請要求學員先指出結果屬於哪一層，再描述 service 或 energy。adapter parity、current replay 與 browser evidence 尚未成立時，保留 placeholder，不以相似欄位宣稱等價。

## S090 — 公平 baseline 與同窗口

公平 A/B 是 donor 概念的 current rewrite。請把 scenario_id、job、時間窗、service boundary 與 power model 放在同一條 contract，再只改一個 policy block；其餘 provenance 保持。觀察欄要分列 queue、packet、service、state time、J、delivered bits 與 bit/J，避免用一個讀數遮住服務代價。缺 identity、receipt 或多改一個 block 時，comparison 不成立，應回到 baseline 或 recovery。

## S091 — 把機制移到非 LEO

LEO 在本課只是清楚的 changing-opportunity 例子。轉移到智慧農場或 HVAC 時，可以保留「機會會變動、policy 選擇時機、能量與服務有取捨」這個 mechanism token，但必須重新定義場域的 service、deadline 與 power model。不要把 LEO 的數值、contact window 或 endpoint claim 直接搬過去。transfer card 與 falsifier 尚未有現行 artifact，請以 placeholder 讓學員提出可被推翻的競賽假說。

## S092 — 四種 claim 分類

這頁沿用 donor 的四欄分類，但把 claim ceiling 改成 current C-120 語境。measured、derived、assumed、simulated 不是品質排序，而是不同的來源與可宣稱範圍。course-added traffic、power 與 service boundary 必須標為 assumption；fixture 或 runner output 必須標為 simulated，不可升格 measured KPI。若 lineage 或分類不清，claim 留在 placeholder／INCOMPLETE，不能用漂亮畫面補強。

## S093 — LoRaEnergySim 的邊界

LoRaEnergySim 的價值在 endpoint state、packet outcome 與 energy consequence 能連到 IoT 節能問題；它不是現成的 C-120 system energy producer。frozen C-120 scenario anchor 必須由 provider 提供並驗證，runner 只能驗證後回聲，不能合成或重新命名 scenario_id；course wrapper 只加入課程輸入與 Leo JSON seam。ADR-004 要求 endpoint replay 與 system replay 分層，且沒有 live telemetry 或 classroom pass 的自動推論。這頁的實際 provider、wrapper 與 result schema 尚未 release-freeze，請保留 placeholder。

## S094 — 上游 pin 與課程 wrapper

這個 appendix page 要讓 provenance 的所有權一眼可見。上游 revision 與 license 屬來源；course-owned wrapper 將固定 scenario、seed、policy 與 result schema；Leo 只透過 versioned JSON 溝通，不把 upstream Python 直接 import 進 React。locations、run duration、serialization 與 lock 也要先凍結，才能討論 reproducibility。精確 revision、lock SHA 與 release receipt 尚未確認，禁止自行填值。

## S095 — 課程假設與未驗證主張

請把「上游提供什麼」和「課程新增什麼」拆開。traffic、power parameter、service boundary 與 scenario sub-trace 可能是課程假設；它們不是 upstream measurement。SDD 與 current handoff 都把 cold-start、browser import、fixture consequence、novice timing 列為尚待驗證的 gate。這頁不提供漂亮的通過數字；每個結果仍需帶 source、version、assumption 與 result lineage，否則只能降低 claim。

## S096 — student_policy.py 可用邊界

這張 API card 是操作邊界，不是完整 Python 教科書。學員只閱讀允許的 observation，並從 bounded action 中做選擇；不可讀 future outcome、改 upstream engine、schema 或 scientific formula。實際 released line numbers、API version 與合法 action 名稱由 controller freeze 後才可放入頁面，因此目前只用 placeholder。每個合法 action 都要能在 runner event 與結果 evidence 中被追溯，否則不算 consequential policy surface。

## S097 — Scenario 到 result schema

這頁是 contract flow：scenario package 先固定條件，runner 消費 policy，result writer 產生帶 provenance 的 JSON，Leo importer 再驗證。核心不是檔案格式本身，而是同一個 scenario_id、seed、units 與 policy hash 穿過 TLE、三個 labs、withheld、Leo 與 workbook。現行 schema instance、命令與欄位尚未凍結，不能自行命名或填入 hash。任何 mismatch 都必須 fail closed，不能靠手動拼接一個看似合理的 result。

## S098 — Fail-closed 驗證梯

validation ladder 將資料信任拆成可教的幾個 gate。先看 schema，再看 identity、units、policy／seed 與 provenance；任何一項失敗都不能部分寫進 session。這個 fail-closed 行為同時保護 endpoint/system authority 邊界，避免把 endpoint 值轉寫成 system consumed J。現行 receipt 與 UI 尚未凍結，請在正式 release 前替換 placeholder，並保留 fallback 與 recovery provenance。

## S099 — Radio state 與能量帳

這張 ribbon 讓學員把休眠、醒來、處理、傳送、接收與 awake idle 放回時間順序。WAIT 不是 SLEEP 的同義詞；WAIT 是醒著的 idle，SLEEP 可能降低功率但需要 wake latency 或 wake energy。公式把各狀態功率乘時間與每次 wake 的 lump-sum energy 一起列入帳，實際模型與欄位仍以 frozen contract 為準。所有 state energy 先標在 endpoint replay，不可自動改寫 Leo/system consumed J。

## S100 — W、J、bit/s 與 bit/J

這一頁把 donor 的 W/J 與吞吐概念去重後放進同一條 unit ladder。W 是瞬時功率，J 是時間累積能量；bit/s 是資料率，unique delivered bits 是服務量。endpoint bit/J 使用 endpoint J，system canonical bit/J 使用 system consumed J，兩者不可互稱。完成時間、service_pass、freshness、deadline 與 budget remaining 仍是不同欄位，不能拿來互換。公式是語義視覺，不是新 metric；若 job、window 或 boundary 不同，先降低 claim。

## S101 — Endpoint 與 system energy

這是 APP-09 對第 89 頁的 provenance 展開。endpoint layer 可以回答 packet、queue、radio state 與 endpoint energy 的問題；system layer 才承擔既有 C-120 authoritative replay 與 canonical fields。兩層共享 scenario、clock、source_mode 與 workbook，不代表所有 energy 欄位可互換。任何 adapter mapping 都需要 owner freeze 與 parity evidence；目前 mapping 與 replay 證據未凍結，保持 placeholder。

## S102 — TLE 只錨定變動窗口

TLE-to-NTPU 是每位學員必做的短 glass-box anchor，但它不是節能實驗。請把 TLE、SGP4／position 與 course-added window mapping 分成 source、model-derived 與 course output；TLE 不自帶 traffic、power、handover policy 或 energy。真正的學習價值在同一 scenario_id 被後續 labs 消費，否則 TLE 只會是裝飾性 onboarding。source revision、position trace 與 window artifact 未凍結前，不要填入外部檔名或數值。

## S103 — 來源到結果的 lineage

lineage spine 的四個節點要在講解與 workbook 中保持一致。source 說明從哪裡來，model 說明如何轉換，assumption 說明課程加了什麼，result 說明產出屬於哪個 layer。donor 的 evidence clinic 概念在此重寫成 current provenance；不使用歷史 artifact、URL、hash 或 line number 代替現行證據。任何一節斷鏈時，主張只能維持 bounded teaching statement。

## S104 — SINR、dB 與 linear

這是 appendix vocabulary，不是要求非通訊背景學員推導 link budget。用一個 dB 與 linear 的轉換概念幫助閱讀 quality trace，但 quality observation 仍不等於 delivered service、energy 或 bit/J。公式是 donor 語義的最小重寫；不可把舊 donor 公式偷渡成 browser-side producer。實際 quality field 與 unit 尚未 release-freeze，未標單位就停止比較並保留 placeholder。

## S105 — Angle、range 與 power boundary

角度、距離與 RF quality 只能提供 opportunity 或 observation context，不能單獨決定 traffic、power 或服務。這頁保留 donor appendix 的詞彙，但刪除 legacy geometry 與 EE 主張；每個 producer、assumption、result 都要在 lineage 中分層。consumed power 必須先說明屬於 endpoint 還是 system boundary，不能因為名稱相近就合併。field mapping 與 parity 尚未凍結，故使用 placeholder。

## S106 — 四欄 claim classifier

請把 classifier 當成 claim 的護欄。measured 需要實體或儀器證據；derived 需要 frozen inputs、model 與 lineage；assumed 是課程設定；simulated 是 fixture、runner 或 endpoint replay output。current C-120 的 simulated teaching ceiling 不會因為欄位很詳細就變成 measured。donor 的分類概念已重寫，正式 workbook、notes 與 deck 必須使用同一分類；不確定時保留 placeholder。

## S107 — 授權與修改邊界

這張 source ledger 將授權與技術邊界放在同一個視覺中。ADR-004 記錄 LoRaEnergySim 為 GPL-3.0，並要求課程 wrapper 以可分開釋出的方式處理；Leo 透過 documented JSON 溝通，不直接 import 或 link upstream Python。可修改範圍限於 course-owned wrapper、scaffolded policy surface 與已凍結的 versioned contract；upstream internals、Leo scientific formulas、schemas 與產出 artifact 不在 learner edit surface。正式 notices、citation、release provenance 尚未凍結，不能宣稱 release。

## S108 — Glossary、claim 與 reopen

最後一頁把 glossary、claim ceiling 與 recovery route 綁回同一個 reopenable workbook。請讓學員用固定詞彙說出 scenario、source_mode、service_pass、consumed J 與 endpoint replay 的邊界，再確認缺失或 mismatch 如何 fail closed、切同 scenario fallback、最後 export／reopen。COMPLETE 不是漂亮結果，而是 identity、prediction、receipt、result、recovery 與 provenance 都能重開；否則誠實標 INCOMPLETE。正式 artifact 與 reopen receipt 尚未凍結，且最高 claim 仍限於明示的 simulated teaching ceiling。
