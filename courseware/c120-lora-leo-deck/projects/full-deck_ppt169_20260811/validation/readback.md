# c120-lora-leo-full-deck-native_20260811_030600

- Source: `c120-lora-leo-full-deck-native_20260811_030600.pptx`
- Total slides: 108

## Slide 1

每一次 SEND、WAIT、SLEEP，都是能源決策

智慧節能與物聯網應用

> [SmartArt scan unavailable: Missing required PPTX part: ppt/slides/slide1.xml]

### Speaker Notes

這堂課先從 IoT endpoint 的能源決策開始，而不是從衛星術語開始。裝置選擇送、等或休眠時，同時改變封包服務與功率乘時間所累積的能量。LoRaEnergySim 讓這些 endpoint 後果可以被觀察；Leo 只提供一個會改變的服務窗口，幫我們看清取捨。請學員先說出一個可能同時改變服務與能量的 endpoint 動作。

## Slide 2

節能是一條可檢驗因果鏈

- STATE / DATA → POLICY → PACKET / SERVICE
- POWER × TIME → ENDPOINT ENERGY → EVIDENCE
- LaTeX：E_{\mathit{endpoint}}=\sum_s P_s t_s
- 每一箭都要有可檢查後果，不用動畫代替。
- 服務先過 boundary，再比較能量與 delivered bits。
- 可轉移：smart farm / HVAC / edge / logistics

Authority｜C120 integration SDD 1082–1096

> [SmartArt scan unavailable: Missing required PPTX part: ppt/slides/slide2.xml]

### Speaker Notes

請沿著因果鏈由左到右讀。資料與狀態先進入 policy，policy 產生送、等、休眠或批次行動，接著才有 packet 與 service 後果；功率經過時間才累積成焦耳。最後的 evidence 必須能支持或推翻原先的 prediction，並把機制轉移到其他 IoT 場景。請學員指出哪一段證據可以推翻一個節能說法。

## Slide 3

LoRa 證據邊界

- 可觀察｜SLEEP / WAIT / WAKE / PROCESS / TX / RX
- 可觀察｜packet attempt / retry / delivered / expired
- 可觀察｜queue / service / endpoint energy
- 不能宣稱｜NOT LIVE / NOT MEASURED / NOT SYSTEM ENERGY
- wrapper-added assumptions 必須與 upstream evidence 分開。
- Claim ceiling｜SIMULATED TEACHING DATA / NOT LIVE / NOT MEASURED / NOT CANONICAL-PARITY-VERIFIED

Authority｜ADR-004 24–38；C120 integration SDD 883–907

### Speaker Notes

LoRaEnergySim 的直接價值，是讓 endpoint 的狀態、封包嘗試、重試、送達與能量結果成為可檢查的事件。課程 wrapper 加入的 awake-idle 或 wake 假設必須另外標示，不能說成 upstream 測量。endpoint energy 也不能被改名成既有 C-120 的 canonical system energy。請學員各指出一個可觀察事件與一個不能越過的 claim。

## Slide 4

LEO：變動服務窗口範例

- CHANGING SERVICE WINDOW
- OPEN → QUALITY SHIFTS → CLOSE
- 現在送｜等待｜批次｜休眠
- LEO 讓 changing opportunity 更容易被看見。
- 學到的是 IoT 控制機制，不是衛星專業。
- 可轉移｜smart farm / HVAC / edge / logistics

Authority｜C120 integration SDD 14–37, 1082–1096

### Speaker Notes

LEO 在這裡只負責把服務機會變成一個會開、會關、品質會改變的時間窗。這讓學員必須在現在送、等一下、批次或休眠之間做決策，並同時檢查 service 與 energy。學到的是 changing opportunity 下的控制思維，而不是衛星工程專業。請學員把同一個取捨映射到智慧農業、HVAC、edge 或物流。

## Slide 5

兩層 evidence 不互相冒充

- SHARED｜scenario / TLE source / clock
- SYSTEM｜power / consumed J / canonical bit/J
- ENDPOINT｜policy / queue / packet / radio state
- ENDPOINT｜endpoint J / endpoint service
- NO ALIASING｜endpoint J ≠ system J
- 相同單位不等於相同 evidence scope。

Authority｜C120 integration SDD 366–388

### Speaker Notes

兩層 replay 可以在同一個 scenario 與 clock 上一起呈現，但各自負責不同 evidence。既有 replay 保留 system 層欄位；新的 endpoint replay 只負責 policy、queue、packet、radio state 與 endpoint energy。共享 anchor 有助於對齊，不代表可以把 endpoint 欄位寫回 system 或 canonical 欄位。請學員把 endpoint J 與 system consumed J 分到正確的一層。

## Slide 6

從預測到驗證

- DO｜先記錄 prediction，再 edit marked region、run、import
- WHY｜讓 learner loop 可歸因且不把安裝等待當成 evidence
- MECHANISM｜policy bytes → deterministic JSON → strict replay → withheld case
- EXPECT｜queue / service / state / endpoint energy evidence 可追溯到同一 policy
- INTERPRET｜null diff 或 mismatch 代表 gate / fixture 問題；採最小 recovery
- FLOW｜PREDICT → EDIT → RUN → IMPORT → LEO REPLAY → WITHHELD CASE
- EVIDENCE PLACEHOLDER｜release / API / command / line / artifact 尚未凍結

Authority｜ADR-004 42–71；C120 integration SDD 14–31, 287–295

### Speaker Notes

學員先留下對 queue、service、state time 與 endpoint energy 的 prediction，再只改 student_policy.py 的 marked region。Runner 產生 deterministic JSON，Leo 做 strict import 後呈現 replay；同一份凍結 policy 還要接受 withheld case。最後留下的是完整 evidence chain 與可重新開啟的 workbook，不是一次成功畫面。此頁先呈現 learner loop，不放尚未凍結的命令或畫面。

## Slide 7

操作與修改的五問框架

- DO｜做什麼：一個命令、檔案或 marked line
- WHY｜為何需要：保住比較邊界與 learner agency
- MECHANISM｜改變哪個 policy / packet / state / energy 機制
- EXPECT｜預期哪個 receipt / evidence 改變
- INTERPRET｜符合、意外、失敗；採最小 recovery
- EVIDENCE PLACEHOLDER｜release / API / command / line 尚未凍結

Authority｜C120 integration SDD 273–295, 762–766

### Speaker Notes

這五欄不是附加說明，而是每一個 action 的教學契約。學員要知道自己做什麼、為什麼做、改變哪個機制、執行前期待看到什麼，以及意外結果該如何解讀與恢復。release URL、commands、case names 與 line numbers 尚未凍結，因此畫面只呈現 grammar，沒有冒充 final API。請講師示範如何先寫預測，再選最小 recovery。

## Slide 8

120 分鐘：setup 與 labs

- WHY 5｜SETUP 8｜MODEL 8｜ANCHOR 8
- LAB A 21｜LAB B 21｜RECOVERY 5
- LAB C 23｜CLINIC 10｜TRANSFER 11
- 合計｜120 分鐘
- 保護｜setup 有 fallback；三個 causal labs 時鐘固定
- CLOCK STATUS｜DRAFT SDD / PLACEHOLDER-SAFE PRODUCTION

Draft clock｜C120 integration SDD 115–170；ADR-004 amendment

### Speaker Notes

這頁使用 draft integration SDD 的 exact-120 十段時鐘：WHY、SETUP、MODEL、ANCHOR、三個 labs、RECOVERY、CLINIC 與 TRANSFER 合計 120 分鐘。setup 若受阻，fallback 仍要使用同一 scenario 並在 protected clock 內回到主路徑，不把安裝等待當成 energy-learning evidence。Owner 已授權 placeholder-safe full-deck production，但十段 clock 的最終 classroom freeze 仍須和 release evidence 一起關閉。

## Slide 9

Opening checkpoint

- OWNER AUTHORIZATION｜可繼續完成 full deck。
- ROUTE｜IoT endpoint first；LEO 是 changing-window example。
- TEMPLATE｜沿用 educate.pptx 原生背景、版型與字體規約。
- BOUNDARY｜endpoint evidence 與 system/canonical evidence 分離。
- EVIDENCE PLACEHOLDER｜release / API / command / line / browser / KPI 未凍結。
- NEXT｜先做概念、機制與 prediction；證據凍結後再替換 placeholder。

Owner direction｜ADR-004 42–71；C120 integration SDD 1321–1352

### Speaker Notes

這一頁記錄 owner 已授權沿著既定 opening route 繼續完成 full deck。後續頁面可以先完整教概念、機制、prediction 與 recovery grammar；release、API、command、line、browser 與 KPI 仍只能以 EVIDENCE PLACEHOLDER 呈現，不能自行補值。這不是 production stop，而是把可作者化內容與待凍結 evidence 清楚分層。

## Slide 10

課程包裡有什麼？

- DO｜取得 named release ZIP 或 immutable tag；URL EVIDENCE PLACEHOLDER
- WHY｜從審閱過的 course source 開始，不追 moving branch
- MECHANISM｜release 綁定 wrapper、policy API、scenario、schema、license
- EXPECT｜README / launcher / lock / policy / runner / schemas 齊全
- INTERPRET｜缺檔或版本混雜就停止；只回到 named release
- EVIDENCE PLACEHOLDER｜final filenames、tag、URL 與 receipt 未凍結

Authority｜ADR-004 Decision 1–5；C120 integration SDD 219–252

### Speaker Notes

先把取得課程包本身當成第一個完整 action。學員只能使用 named release ZIP 或 immutable tag，因為 release 同時綁定 wrapper、policy API、scenario、schemas 與 license provenance；任意 branch 或混雜檔案會破壞後續比較。預期 package root 具備 README、launcher、lock、policy、runner 與 schemas。final filenames、tag、URL 和 receipt 尚未凍結，所以本頁保持 EVIDENCE PLACEHOLDER；缺檔時回到 named release，不自行拼裝課程包。

## Slide 11

選擇支援的 OS launcher

- DO｜選擇相符的 OS launcher；實際命令 EVIDENCE PLACEHOLDER
- WHY｜讓 Windows / macOS / WSL/Linux 走可支援入口
- MECHANISM｜launcher 建立同一課程環境與 runner 啟動邊界
- EXPECT｜OS stage receipt 通過；cold-start 證據 EVIDENCE PLACEHOLDER
- INTERPRET｜入口或權限失敗是操作問題；改走診斷或同情境 fallback
- EVIDENCE PLACEHOLDER｜supported OS、命令、terminal/browser receipt 尚未凍結

Authority｜ADR-004 Course-authority amendment；C120 integration SDD 255–272

### Speaker Notes

講師先讓學員辨識自己使用的作業系統，再選對應的課程入口。此 action 的目的不是比較 OS，而是讓後續 runner 進入一致的環境邊界；權限或 launcher 失敗只能解讀為 operational gate。當前 supported minor、冷啟動命令與 receipt 尚未 release-freeze，所以畫面不展示猜測的 shell syntax。若 setup 受阻，保留同一 scenario 並走 recovery。

## Slide 12

為什麼建立隔離的 .venv？

- DO｜建立課程專用 .venv；命令 EVIDENCE PLACEHOLDER
- WHY｜隔離 system Python 與其他專案依賴
- MECHANISM｜獨立 interpreter / package location 綁定 runner
- EXPECT｜環境 stage receipt 通過；版本與路徑 EVIDENCE PLACEHOLDER
- INTERPRET｜失敗只證明環境未就緒；不解讀為 energy result，改走 recovery
- EVIDENCE PLACEHOLDER｜Python minor、命令、冷啟動 receipt 尚未凍結

Authority｜ADR-004 Course-authority amendment；C120 integration SDD 255–272, 303–304

### Speaker Notes

隔離環境的價值是可重現與可回復，不是能源實驗本身。講師可用 system Python 與 course .venv 的兩個框，說明 package location 如何避免其他專案污染 runner。學員要把 environment stage 與後續 energy evidence 分開記錄；建立失敗時先讀診斷或使用同情境 fallback，不移除隔離要求。Python minor、命令與路徑都仍是 placeholder。

## Slide 13

為什麼安裝 pinned dependency lock？

- DO｜由 setup 安裝 hash-pinned dependency lock；命令 EVIDENCE PLACEHOLDER
- WHY｜重現審閱過的 dependency graph，不取 latest
- MECHANISM｜lock 限定 runner 可載入的 package versions / hashes
- EXPECT｜install stage 與 lock receipt 通過；lock SHA EVIDENCE PLACEHOLDER
- INTERPRET｜hash/version failure 停在 setup；不移除 pin，改走診斷或 fallback
- EVIDENCE PLACEHOLDER｜lock hash、命令、current receipt 未凍結

Authority｜ADR-004 Decision 1；C120 integration SDD 255–272, 303–304

### Speaker Notes

把 lock 視為實驗邊界的一部分：同一個 policy 在不同 dependency graph 上不一定代表同一個 runner。學員只需理解 lock 如何限制版本與 hash，不需拆解 upstream framework。hash 或版本失敗時，最小 recovery 是保留 pin、讀取診斷或切換同 scenario fallback；不可用 latest package 讓錯誤消失。當前 lock SHA 與安裝 receipt 沒有 frozen artifact，故只保留 placeholder。

## Slide 14

先驗證 provenance，再改 policy

- DO｜讀 release / upstream / wrapper / lock provenance receipt；欄位 EVIDENCE PLACEHOLDER
- WHY｜在 policy 編輯前確認來源與邊界一致
- MECHANISM｜anchor、wrapper、lock 與 policy API 綁成可追溯 lineage
- EXPECT｜來源欄位與同一 scenario identity 對齊；current receipt EVIDENCE PLACEHOLDER
- INTERPRET｜不一致即停止該次比較；使用 named release 或同情境 fallback
- EVIDENCE PLACEHOLDER｜release URL/tag、receipt、hash、line/browser evidence 未凍結

Authority｜ADR-004 Decision 1–4；C120 integration SDD 390–491, 768–797

### Speaker Notes

這一步把『我拿到什麼』與『我改了什麼』分開。講師可依序指向 release、upstream、wrapper、lock 與 policy API 的 lineage；學員先確認 scenario anchor 與版本邊界，再進入 marked policy。若 provenance 不一致，這次 run 不具備公平比較資格，應回到 named release 或同情境 fallback。所有現行 receipt、hash 與畫面都尚未凍結，不可自行填入。

## Slide 15

讀懂 READY receipt

- DO｜讀 verify 的 READY／failure receipt；exact command EVIDENCE PLACEHOLDER
- WHY｜先確認 runtime、release、scenario、policy API 再改 policy
- MECHANISM｜receipt 把環境 gate 與實驗結果分離
- EXPECT｜READY 顯示可進入 prediction；欄位與 artifact ID EVIDENCE PLACEHOLDER
- INTERPRET｜非 READY 指向失敗 gate；修復或切同 scenario fallback，不產生 energy claim
- EVIDENCE PLACEHOLDER｜命令、receipt fields、artifact ID 未凍結

Authority｜C120 integration SDD 297–320, 739–797

### Speaker Notes

READY 不是 energy saving 的結果，而是允許進入 prediction 與 run 的環境門檻。講師帶學員區分 runtime、release、scenario、policy API 等 gate 欄位與稍後的 packet/service/state/energy evidence。若 receipt 不是 READY，先定位是哪個 gate 失敗；不要把等待安裝或修復的時間說成節能證據。因 exact command 與 receipt schema 尚未凍結，本頁刻意不捏造命令或 artifact ID。

## Slide 16

setup recovery gate：第 10／13 分鐘

- DO｜第 13 分鐘前切入同情境 fallback；artifact EVIDENCE PLACEHOLDER
- WHY｜保住三個 causal labs 的 protected clock
- MECHANISM｜固定 scenario / seed / predecessor，改用預先驗證的 result
- EXPECT｜fallback provenance receipt；artifact ID EVIDENCE PLACEHOLDER
- INTERPRET｜安裝等待不是 energy evidence；缺口保留為 INCOMPLETE
- CLOCK｜00–10 setup；10–13 recovery；13 後回到 anchor / Lab A
- EVIDENCE PLACEHOLDER｜切換命令、artifact ID、browser receipt 未凍結

Authority｜C120 integration SDD 172–199；ADR-004 Decision 7

### Speaker Notes

setup recovery 是時間保護，不是另一個實驗。若第十至第十三分鐘仍未完成環境，改用同一 scenario、seed 與 predecessor 的 fixture result，並把 fallback provenance 留在 workbook。這樣仍能進入 anchor 與 Lab A，而不會把安裝等待誤當成 energy evidence。講師要明確說明 INCOMPLETE 是誠實狀態，不是需要補寫的成功數字。

## Slide 17

固定、控制、觀察的變數

- FIXED｜scenario_id、seed、contact/quality trace、traffic、units
- CONTROLLED｜marked policy constants / branch、同一 predecessor
- OBSERVED｜queue、service、state time、packet outcomes、endpoint J
- KEEP SEPARATE｜system consumed J / canonical bit/J 不由 endpoint replay 改寫
- BEFORE RUN｜留下 prediction，讓 evidence 可確認或推翻
- ONE DOMINANT MAP｜fixed → controlled → observed

Authority｜C120 integration SDD 390–491, 612–688

### Speaker Notes

把實驗拆成三個區域，學員才知道什麼可以改、什麼必須維持、什麼是結果。scenario、seed、trace、traffic 與 units 是固定條件；marked policy 是受控變因；queue、service、state time、packet outcomes 與 endpoint J 是觀察欄位。system consumed J 與 canonical bit/J 留在另一個 evidence layer。請學員在 run 前先寫一個可被結果推翻的 prediction。

## Slide 18

Endpoint state vocabulary

- SLEEP｜低功率休息；醒來需付 wake latency / energy
- WAIT｜醒著的 idle；不等於 SLEEP
- WAKE｜重新進入可行動狀態的轉換
- PROCESS｜處理資料；TX / RX｜傳輸 / 接收
- STATE TIME｜每段時間分開記錄，再累積 endpoint J
- OBSERVE｜state sequence 與 packet result 一起看

Authority｜C120 integration SDD 567–571, 711–737；C120 controller 2026-08-10

### Speaker Notes

先建立狀態詞彙，再進入 policy code。WAIT 是醒著的 idle，SLEEP 是低功率休息；兩者都可能影響時序，但只有 SLEEP 的回到工作狀態會引入明示的 wake latency 或 wake energy。PROCESS、TX、RX 也要各自保留 state time，最後才把各段的功率乘時間累積成 endpoint J。請學員用一條 state ribbon 說明一次傳送前後發生了什麼。

## Slide 19

WAIT 是 awake idle；SLEEP 有 wake 成本

- WAIT｜awake idle：維持反應，不新增 wake transition
- SLEEP｜低功率休息：醒來可能增加 latency 與 wake energy
- 同一 rest duration 不代表相同 service 或 endpoint J
- LaTeX：E_{\mathit{endpoint}}=\sum_s P_s t_s+\sum_k E_{\mathit{wake},k}
- 預測｜比較 state-time、wake、delivery、deadline 與 J
- 解讀｜方向是待驗假說；以 replay ledger 判斷

Authority｜C120 integration SDD 711–737；action matrix A-REST

### Speaker Notes

這頁要拆掉『只要睡眠就一定省』的直覺。WAIT 保留醒著的反應能力，SLEEP 降低休息功率但可能在重新工作時付出 wake latency 與 wake energy；同一段 rest duration 也可能導致不同的 service 結果。公式只用來說明各 state 的功率乘時間與 wake 成本如何累積，方向仍是 prediction，必須由 replay ledger 的 state、delivery、deadline 與 J 來判定。

## Slide 20

Packet lifecycle

- GENERATED｜queue 裡形成待送資料
- ATTEMPT｜policy 在可用窗口做一次傳送嘗試
- RETRY｜失敗後依規則再次嘗試
- DELIVERED / EXPIRED｜服務結果分開記錄
- 觀察｜queue age、attempt、retry、delivery、expiry、service
- 不要把 attempt 數或 rate 直接當成 delivered bits

Authority｜ADR-004 Decision 4–5；C120 integration SDD 817–907

### Speaker Notes

把 packet 從生成到結果排成一條 lifecycle，學員可以沿著同一筆資料看 queue age、attempt、retry、delivered 或 expired。一次 attempt 不是一次 delivered；rate 也不能替代任務是否完成。講師可先讓學員預測某個 pacing 或 rest policy 會讓哪一段變長，再於後續 lab 對照 packet ledger。這一頁不放現行 run artifact 或 KPI。

## Slide 21

先畫 service boundary，再比 energy

- 先定義｜evaluation window、required packets / unique bits、deadline / freshness
- SERVICE PASS｜在邊界內完成任務；energy 另欄記錄
- INVALID A/B｜只比較 W、J 或 rate，卻換了 job / window / boundary
- 同一 scenario / clock 讓 policy 變化可歸因
- prediction 與 replay 都要同時回答 service 與 energy
- EVIDENCE PLACEHOLDER｜current service receipt / browser artifact 未凍結

Authority｜C120 integration SDD 549–566, 883–907；DONOR-REWRITE 19–21

### Speaker Notes

公平比較的第一個問題不是哪一組 J 較低，而是兩組是否完成同一個 job、在同一個 window 與 boundary 下被評估。required packets、unique delivered bits、deadline、freshness 與 evaluation end 要先固定；service pass 與 energy 另欄記錄。若只比較 W、J 或 rate 卻換了任務，就不能說是 saving。當前 service receipt 與 browser artifact 尚未凍結，這裡只教 boundary。

## Slide 22

Python survival：常數是 bounded controls

- DO｜在 student_policy.py 只改 marked constant；line EVIDENCE PLACEHOLDER
- WHY｜隔離一個可控制量，保留 engine / evidence 不變
- MECHANISM｜常數改變 policy decision timing / branch
- EXPECT｜policy bytes / hash 改變；queue / packet / state / J 應有可檢查差異
- INTERPRET｜只有 label / animation 變化不算 consequential；restore marked block
- EVIDENCE PLACEHOLDER｜released code、line、命令、policy SHA 未凍結

Authority｜C120 integration SDD 612–688；action matrix ACT-09

### Speaker Notes

Python survival bridge 只教學員讀懂一個 bounded control，不要求掌握 framework internals。先辨認常數所在的 marked region，再說明它如何改變 policy decision timing 或 branch；engine、scenario、schema 與 evidence writer 都不在可改範圍。預期不只看 policy hash 改變，還要看到 queue、packet、state 或 endpoint J 的可檢查後果。released code、line 與 SHA 尚未凍結，不放假畫面。

## Slide 23

Python survival：比較與 Boolean 條件

- DO｜讀 marked comparison / Boolean condition；line EVIDENCE PLACEHOLDER
- WHY｜辨識 observation → condition → legal action，避免 future leakage
- MECHANISM｜threshold / Boolean result 決定 WAIT、SLEEP 或 SEND
- EXPECT｜condition crossing 對應 mode、attempt、service、state evidence
- INTERPRET｜短暫 spike 不等於穩定訊號；意外時只修 marked block
- EVIDENCE PLACEHOLDER｜released code、line、API 與 browser receipt 未凍結

Authority｜C120 integration SDD 619–653, 658–688；action matrix B-ENTER / B-EXIT / B-HOLD

### Speaker Notes

比較式與 Boolean 條件是 policy 的決策閘門。講師逐段問：輸入是哪個已發生的 observation？條件何時成立？成立後只允許哪個 legal action？這樣可避免學員偷看 future quality、future energy 或結果欄位。短暫 spike 不等於穩定訊號，後續 Lab B 會用 hold 與 hysteresis 延伸此概念；現行 code、line 與 browser receipt 仍是 placeholder。

## Slide 24

Python survival：縮排與觀測輸入

- DO｜只讀 3–6 行 policy 與觀測輸入；line EVIDENCE PLACEHOLDER
- WHY｜縮排決定 branch scope；觀測欄位定義可用資訊
- MECHANISM｜同一 observation 在合法 scope 內產生一個 action
- EXPECT｜syntax / API gate 通過；runtime evidence 不應因排版以外改變
- INTERPRET｜traceback 指向 marked line 就最小修復；不 debug framework
- EVIDENCE PLACEHOLDER｜released code、line、error text、command 未凍結

Authority｜C120 integration SDD 619–653, 658–688；action matrix ACT-06

### Speaker Notes

這頁只保留 Python 閱讀所需的最小範圍：看縮排如何決定 branch scope，看 observation 如何進入一個 action。學員不需要修整個 framework；若 traceback 指向 marked line，採最小修復並重新連回 mechanism。若 error 來自未允許的 upstream 或 API 變更，保留 failure evidence、恢復 pinned policy，不能把修改擴大。錯誤文字與 line number 尚未 release-freeze。

## Slide 25

Python survival：合法 return actions

- DO｜從 API card 讀合法 return action；exact API EVIDENCE PLACEHOLDER
- WHY｜讓每次 policy decision 落在 runner 可驗證的 action set
- MECHANISM｜observation → action → state / packet consequence；非法字串 fail closed
- EXPECT｜action receipt 與 replay event 可追溯到 policy hash
- INTERPRET｜非法 action 是 policy/API mismatch；恢復 pinned policy，不擴充 API
- EVIDENCE PLACEHOLDER｜API version、action names、line、receipt 未凍結

Authority｜C120 integration SDD 619–653, 658–688；action matrix ACT-06

### Speaker Notes

policy 的 return action 是一個受約束的決策介面，不是任意字串。講師將 API card 放在左側，把 observation、action 與 state/packet consequence 串起來；學員只在 legal action set 中選擇。非法 action 應 fail closed，並保留 mismatch 的 recovery 線索，而不是偷偷擴充 API 或改 runner。現行 API version、action names 與 receipts 都必須等 freeze 後再補。

## Slide 26

W 是 rate；J 會隨時間累積

- W｜瞬時功率：某一狀態每秒消耗多少
- J｜能量：功率在時間上的累積
- LaTeX：E_{\mathit{endpoint}}=\sum_s P_s t_s
- bit/s｜傳輸速率；delivered bits｜任務完成的有效量
- endpoint bit/J｜本 lab 的 derived field；不等同 canonical bit/J
- canonical bit/J｜system layer 的 boundary-specific metric
- 先確認 service，再比較 energy；不要用低 W 代替低 J

Authority｜C120 integration SDD 711–737, 883–907；DONOR-REWRITE 14, 16–17

### Speaker Notes

這頁把常被混用的 W、J、bit/s、delivered bits 與 bit/J 分開。W 是某一狀態的瞬時功率，J 是功率乘時間的累積；因此短暫低 W 不必然代表整個工作耗能較低。endpoint bit/J 只是在 endpoint energy scope 與固定 service boundary 下的 derived field，不能取代 system layer 的 canonical bit/J。請學員先問任務是否完成，再讀 energy。

## Slide 27

公平 baseline 先固定 job、window、boundary

- FIX THE JOB｜同一 scenario、traffic、required delivery
- FIX THE WINDOW｜同一 evaluation end、contact / deadline / freshness
- FIX THE BOUNDARY｜同一 energy scope、units、aggregation
- A｜inherited policy；B｜one marked policy change
- COMPARE｜service、delivered bits、state time、endpoint J 分欄
- 不公平｜換 job / window / predecessor 後再宣稱 saving

Authority｜C120 integration SDD 549–566, 612–688；DONOR-REWRITE 36–39

### Speaker Notes

A/B 比較的可信度來自邊界相同，而不是來自最後一張漂亮卡片。先固定 job、traffic、required delivery、evaluation window、contact、deadline、freshness 與 energy scope，再把 inherited policy 與一個 marked change 分成 A/B。結果欄位仍要分開記錄 service、delivered bits、state time 與 endpoint J。若換了 predecessor 或 window，應重新標記為不可比，不得補寫 saving claim。

## Slide 28

Source → model → course assumption

- SOURCE｜pinned TLE / upstream model / course authority
- MODEL｜runner transforms source into contact / quality / state / packet trace
- ASSUMPTION｜wrapper-added awake-idle、wake、traffic、mission rule
- COURSE RESULT｜policy action → packet/service → state time → endpoint J
- LINEAGE｜scenario_id、seed、policy hash、artifact provenance
- 未證實的現行 receipt、KPI、browser pixels 一律 EVIDENCE PLACEHOLDER

Authority｜C120 integration SDD 390–491, 689–737；DONOR-REWRITE 70–75

### Speaker Notes

不要把來源、模型轉換與課程假設壓成同一個數字。source 可以是 pinned TLE、upstream model 或課程 authority；model 將來源轉成 contact、quality、state 與 packet trace；wrapper 另外加入 awake-idle、wake、traffic 或 mission rule 等 assumptions。結果再由 policy action 走到 service、state time 與 endpoint J。學員要能沿著 scenario_id、seed、policy hash 與 artifact provenance 回溯；未凍結 evidence 一律保留 placeholder。

## Slide 29

一個 scenario_id 貫穿 runner、replay、workbook

- ONE ID｜TLE anchor → scenario package → runner → result JSON
- SAME ID｜Leo import / endpoint replay / Energy Decision Workbook
- CHECK｜scenario_id、anchor hash、seed、policy hash、units
- MISMATCH｜strict import fail closed；session 不被部分更新
- NO CAST｜endpoint fields 不寫入 C-120 system/canonical fields
- EVIDENCE PLACEHOLDER｜current hash / schema instance / import receipt 未凍結

Authority｜ADR-004 Decision 3–5；C120 integration SDD 390–491, 952–988

### Speaker Notes

scenario_id 是 identity spine，不只是檔名。從 TLE anchor、scenario package 到 runner、result JSON、Leo import、endpoint replay 與 workbook，都必須回聲同一個 scenario anchor；seed、policy hash、units 與 anchor hash 也要一起驗證。任何 mismatch 都要 fail closed，session 不接受部分更新。這頁不提供現行 hash 或 import receipt，因為 controller 尚未完成 evidence freeze。

## Slide 30

合法 interval 讓 LEO 限制 send／wait 選擇

- NTPU window｜服務機會 OPEN → QUALITY SHIFTS → CLOSE
- LEGAL｜只在 contact / policy action window 內做決策
- ILLEGAL｜超出窗口或使用 future quality / future energy
- LEO 只提供 changing opportunity；policy 仍是 IoT 控制面
- 預測｜send now、wait、batch、sleep 對 service 與 endpoint J 的方向
- EVIDENCE PLACEHOLDER｜TLE、contact trace、current map / browser artifact 未凍結

Authority｜C120 integration SDD 390–491；DONOR-REWRITE 4–6

### Speaker Notes

這頁將 LEO 壓縮成一個 legal interval 問題：服務窗口開啟、品質變化、窗口關閉，policy 必須在當下可用的 observation 上做選擇。超出 contact window 或偷看 future quality、future energy 都是不合法的比較。學員先預測 send now、wait、batch、sleep 如何影響 service 與 endpoint J，之後才在 Lab A 用同一個 boundary 檢查。TLE、trace 與畫面尚未凍結，不放數值。

## Slide 31

Lab A：同一工作，不同節奏

- DRIVING QUESTION｜同一工作，改變送出節奏會怎樣？
- KEEP FIXED｜scenario、traffic、mission window、predecessor
- CHANGE ONE｜PACE_GAP_STEPS 或 REST_DURING_GAP 的 marked choice
- WATCH｜attempt timing、queue age、service、WAIT/SLEEP time、endpoint J
- PREDICT FIRST｜更大間隔可能改變 idle/rest 與 deadline 風險
- CLAIM｜方向待驗；以 baseline / candidate / hidden ledger 判定

Authority｜C120 integration SDD 612–688；full-deck outline Lab A 31–39

### Speaker Notes

Lab A 的 driving question 很窄：同一工作與同一窗口下，只改送出節奏或 gap 中的休息選擇。講師先讓學員寫 prediction，再確認 scenario、traffic、mission window 與 predecessor 固定；可觀察欄位包括 attempt timing、queue age、service、WAIT/SLEEP time 與 endpoint J。方向性預期不是答案，更大的間隔可能減少頻繁動作，也可能錯過 deadline，必須由 baseline、candidate 與 hidden ledger 判定。

## Slide 32

讀 PACE_GAP_STEPS marked block

- DO｜逐行讀 PACE_GAP_STEPS marked block；line EVIDENCE PLACEHOLDER
- WHY｜把 pace decision 與其餘 runner / scenario 隔離
- MECHANISM｜gap steps 改變兩次 send 間的 clock distance
- EXPECT｜send time、attempt、queue age、state time、service / J 可出現差異
- INTERPRET｜無 evidence 差異代表 fixture 未造成後果；不以動畫補足
- EVIDENCE PLACEHOLDER｜released code、line numbers、API、command 未凍結

Authority｜C120 integration SDD 612–688；action matrix A-PACE

### Speaker Notes

先不急著改數字，逐行辨識 PACE_GAP_STEPS 如何進入 send 間隔的 decision。講師要把 marked block 與 runner、scenario、result writer 分開，讓學員知道可改範圍與不可改範圍。預測應涵蓋 send time、attempt、queue age、state time、service 與 endpoint J；若 replay 沒有 consequential difference，就判定 fixture 或 policy path 未造成後果，不用動畫或標籤補救。released line、API 與命令仍是 placeholder。

## Slide 33

讀 REST_DURING_GAP：WAIT 或 SLEEP

- DO｜只在 marked REST_DURING_GAP 選 WAIT 或 SLEEP；API / line EVIDENCE PLACEHOLDER
- WHY｜比較 awake-idle 與低功率休息的代價
- MECHANISM｜WAIT 保持醒著；SLEEP 可能新增 WAKE latency / energy
- EXPECT｜state-time、wake、delivery、deadline、endpoint J 出現可追溯差異
- INTERPRET｜若 action 非法或差異為零，恢復 marked block 並保留 failure
- EVIDENCE PLACEHOLDER｜released code、line、action API、run/browser receipt 未凍結

Authority｜C120 integration SDD 567–571, 711–737；action matrix A-REST

### Speaker Notes

這頁把 Lab A 的第二個 bounded choice 讀清楚：REST_DURING_GAP 只在 legal API 中選 WAIT 或 SLEEP。WAIT 是 awake idle，SLEEP 可能帶來較低休息功率但要付 wake latency 或 energy；因此 prediction 必須同時寫 state-time、wake、delivery、deadline 與 endpoint J。若 action 非法或 evidence 差異為零，保留 failure 並只恢復 marked block，不去改 runner。API、line 與 run/browser receipt 尚未凍結。

## Slide 34

Mechanism：節奏、休息、服務與 J

- SEND SPACING｜間隔改變 queue age 與 contact remaining
- REST CHOICE｜WAIT / SLEEP 改變 awake-idle、sleep、wake
- WINDOW｜剩餘 service 可能使同一 pace 產生不同結果
- STATE → PACKET｜mode sequence 影響 attempt / retry / delivery
- POWER × TIME｜state duration 累積 endpoint J
- 預測是方向性假說；replay ledger 才能判定

Authority｜C120 integration SDD 567–571, 711–737；full-deck outline 34

### Speaker Notes

在實際 run 前，用這條 state ribbon 把 Lab A 的 mechanism 說完整：gap 先改變 send spacing，rest choice 再把時間放到 awake-idle 或 sleep，window 的剩餘長度決定服務是否仍可完成。mode sequence 影響 attempt、retry、delivery，最後各 state duration 才累積成 endpoint J。這頁不承諾方向性 KPI，只提供 prediction 所需的因果鏈與觀察欄位。

## Slide 35

先預測 queue、service、state time、J

- DO｜在 run 前鎖定 queue / service / state time / attempt / delivery / endpoint J 預測
- WHY｜讓 Lab A 結果可確認、推翻或留下 null diff
- MECHANISM｜prediction 先於 result ID；固定同一 scenario / window / traffic / predecessor
- EXPECT｜PACE_GAP_STEPS 與 WAIT/SLEEP 會改變哪一段 evidence？
- INTERPRET｜支持、推翻或無差異；每種結果都保留 causal clause
- EVIDENCE PLACEHOLDER｜current workbook / result ID / KPI artifact 尚未凍結

Authority｜C120 integration SDD 297–320, 1039–1077；action matrix ACT-07

### Speaker Notes

Lab A 的 prediction lock 要在 baseline 或 candidate run 之前完成。DO 是先寫 queue、service、state time、attempt/delivery 與 endpoint J 的方向；WHY 是讓結果可以確認、推翻或留下 null diff；MECHANISM 是 prediction 先於 result ID，並固定 scenario、window、traffic 與 predecessor；EXPECT 要指出 PACE_GAP_STEPS 與 WAIT/SLEEP 可能改變哪一段 evidence；INTERPRET 必須保留支持、推翻或無差異的 causal clause。workbook、result ID 與 KPI artifact 尚未凍結，故本頁只示範欄位與解讀方式。

## Slide 36

先跑基準線

- 主視覺｜固定邊界的一張 baseline receipt
- DO｜在未改動 policy 前，啟動 Lab A baseline run
- WHY｜先建立同一 scenario、同一 job、同一 window 的控制
- MECHANISM｜runner 依固定 seed 記錄 queue、packet、state、endpoint energy
- EXPECT｜baseline identity 與可匯入 result artifact；EVIDENCE PLACEHOLDER｜command、receipt、artifact
- INTERPRET｜沒有 result 就沒有公平 A/B；失敗只走診斷或同場景 fallback

Authority｜ADR-004 42–71；C120 integration SDD §5.4、§9.3–9.5；action matrix ACT-08A

### Speaker Notes

保護時段是第 29–50 分鐘的 Lab A；這一頁的目的，是把未改動的 policy 變成後續比較的控制線。講師先指出 scenario、job、service window 與 energy boundary 都必須固定，再請學員說出如果少了其中一項，A/B 就不公平。學員只啟動 release 所提供的 baseline 流程，不修改任何 policy；預期看到一份可辨識的 receipt 與 result，但目前 command、receipt、artifact 和 KPI 都尚未 release-freeze，投影片只保留 EVIDENCE PLACEHOLDER。若 runner 失敗，將它分類為操作證據而非節能結果，轉入同場景 fallback，並保留這個 checkpoint 的 provenance。常見誤解是把 baseline 的數字當成最佳答案；講師要強調它只是控制線。快完成的學員可先寫下 candidate 可能改變的 queue、service、state time 與 endpoint J。來源：ADR-004 的 baseline/candidate 決策、C120 SDD §5.4、§9.3–9.5；最高 claim ceiling 仍是 simulated teaching data。

## Slide 37

只改一個區塊

- 主視覺｜一條只改 active block 的 source diff
- DO｜只改 Lab A 標記的 PACE_GAP_STEPS 或 REST_DURING_GAP
- WHY｜把 pacing、awake wait、sleep 的假設變成可測差異
- MECHANISM｜policy bytes 改變 send timing 與 state choice；engine、scenario、evidence 不變
- EXPECT｜candidate evidence diff 與 freeze receipt；EVIDENCE PLACEHOLDER｜released lines、command、hash、result
- INTERPRET｜若 queue、service、state、J 不變，先判定 fixture 無後果，不任意擴改

Authority｜C120 integration SDD §8、§8.3；action matrix ACT-09、ACT-10A

### Speaker Notes

這一頁落在 Lab A 的 edit-run 段落，保護目的不是教完整 Python，而是讓學員看見一個受界定的決策面。講師逐一讀出兩個標記名稱，說明只允許改 active block；學員先預測較大的間隔或 WAIT/SLEEP 選擇會怎樣改變 send timing 與 state time，再留下小幅 source diff。runner、scenario、energy equation 與 evidence writer 都不可動，否則比較失去因果隔離。預期交付 candidate evidence diff 與 freeze receipt，但 release line、command、hash、result 尚未凍結，因此正文顯示 EVIDENCE PLACEHOLDER，不能填入看似合理的行號或 KPI。若語法或合法 action 錯誤，恢復上一份 marked block，不要重寫整個檔案。常見誤解是把改常數當成調參競賽；這裡只測一個機制假設。快完成的學員可寫出 null diff 時的 falsifier。來源：C120 SDD §8.3、policy teaching map；action matrix ACT-09、ACT-10A。

## Slide 38

匯入同一邊界

- 主視覺｜baseline/candidate 同邊界 evidence split
- DO｜將 candidate result 以匯入流程送入 Leo
- WHY｜在不執行學員 Python 的前提下，把機器可讀證據交給視覺 replay
- MECHANISM｜importer 驗 schema、scenario/hash、seed、policy、units、events/provenance
- EXPECT｜all-or-nothing receipt 與 matching endpoint replay；EVIDENCE PLACEHOLDER｜browser、JSON、KPI
- INTERPRET｜mismatch 保持 session 不變；修正指定 artifact 或改走 fallback

Authority｜ADR-004 42–71；C120 integration SDD §6、§10；action matrix ACT-11

### Speaker Notes

這一頁是 Lab A 的 import checkpoint，保護目的在於把 runner 與 Leo 的 trust boundary 說清楚。學員交付的是 JSON artifact，不是上傳或執行 Python；Leo 只接受經過 schema、scenario identity、seed、policy、units、events 與 provenance 驗證的結果。講師先讓學員預測成功匯入後應出現 matching endpoint replay，再展示 fail-closed 的意義：任何 identity 或 unit mismatch 都不應留下半套 session。當前 browser pixel、JSON instance、receipt 與 KPI 都尚未凍結，正文與講義不得捏造畫面，僅放 EVIDENCE PLACEHOLDER。若匯入失敗，修正指定 artifact 或切換同場景 fallback，不要在瀏覽器補算。常見誤解是把匯入成功等同於科學真值；這裡只代表 contract 驗證通過。快完成的學員可指出 endpoint replay 與 canonical system replay 的分層。來源：ADR-004 §Decision 3–6、C120 SDD §6、§10；action matrix ACT-11。

## Slide 39

Lab A 因果回顧

- 主視覺｜baseline/candidate/hidden 三列 evidence ledger
- DO｜以同一 frozen policy 執行 hidden condition
- WHY｜檢驗 pace/rest 機制能否穿過未揭露的 cost/window
- MECHANISM｜same policy hash 加上 new case，暴露 service、state、energy trade-off
- EXPECT｜hidden replay 維持 identical policy identity；EVIDENCE PLACEHOLDER｜case、artifact、browser、KPI
- INTERPRET｜policy bytes 改變即是 retuning；null diff 不能稱為 causal success

Authority｜issue 11 Lab A；C120 integration SDD §4.2、§8；action matrix ACT-12A；DONOR-REWRITE｜BeamShift 19–21、36–39

### Speaker Notes

第 29–50 分鐘的 Lab A 在此收束；hidden condition 不是再給一個 slider，而是把相同 policy 放到未揭露的 cost 或 window 上。學員先確認 hidden replay 保持 identical policy identity，再比較三列 ledger 中的 queue、service、state time 與 endpoint J。講師要把『方向支持』、『counterexample』與『inconclusive』分開，不讓一個漂亮的數字取代因果敘述。當前 case 名、artifact、browser evidence 與 KPI 尚未凍結，所有欄位都只可標成 EVIDENCE PLACEHOLDER。若 policy bytes 變了，這次就不再是 withheld evidence，應回到 frozen receipt；若結果沒有 consequential diff，記錄 fixture 無後果並停止擴大結論。慢速學員可先完成一句「改變了什麼／犧牲了什麼」；快速學員可指定下一個可推翻假設的條件。來源：issue 11 Lab A evidence floor、C120 SDD §4.2、§8；action matrix ACT-12A；donor concepts 19–21、36–39 只作重寫提示。

## Slide 40

Lab B：現在送還是等？

- 主視覺｜一條起伏 quality trace 與兩個決策點
- 問題｜品質變動時，現在送還是等一下？
- 觀察｜同一 job 面對短窗口與不穩定 quality，決策時間不同
- 核心｜entry、hold、exit 不是三個 slider，而是一個 send-ready state
- 預測｜先寫下首次 entry、等待次數、service 與 endpoint J
- 界線｜LEO 只提供 changing-service-window；課程重點是可移轉節能決策

Authority｜issue 11 Lab B；ADR-004 Context；C120 integration SDD §4、§8

### Speaker Notes

第 50–71 分鐘進入 Lab B；第一句先把 LEO 降回 changing-service-window 的例子，避免課程變成衛星專題。講師用一條 quality trace 問學員：現在送或等一下，哪個決策可能守住 service 並少花 state energy？學員要把 entry、hold、exit 看成同一個 send-ready state 的三個條件，而非任意調整的三個 slider。這頁只建立問題與預測格式，不提前公布 Trace A 或 Trace B 的結果。可移轉的語言是 decision time、contact window、queue、service 與 endpoint J；canonical system energy 仍是另一層。慢速學員可先標示兩個可能的 decision points，快速學員可寫一個可能 counterexample。來源：issue 11 Lab B、ADR-004 的 changing-window framing；所有 live、measured 與 canonical-parity 宣稱仍被 claim ceiling 限制。

## Slide 41

Entry 何時成立？

- 主視覺｜entry band crossing
- DO｜閱讀並圈出 ENTER_QUALITY 的標記條件
- WHY｜界定何時讓 policy 進入 send-ready mode
- MECHANISM｜entry band 改變狀態轉換時機，不改 contact、traffic 或 energy equation
- EXPECT｜較高 entry 可能少進入卻錯過短窗口；EVIDENCE PLACEHOLDER｜released code、line、trace
- INTERPRET｜比較 first entry、wait、service；方向是待驗證假設

Authority｜C120 integration SDD §8、§8.3；action matrix B-ENTER

### Speaker Notes

這頁用一個 threshold crossing 作為主視覺，講師先讀條件再談數值，避免學員把門檻當成答案。學員只需圈出 ENTER_QUALITY 的標記區域，說出它決定的是進入 send-ready mode 的時刻，而不是 packet delivery 本身。較高 entry 的方向性只是一個可檢驗假設：它可能減少邊緣進入，也可能錯過短窗口。release code、line reference 與 trace 尚未穩定，故正文保留 EVIDENCE PLACEHOLDER，不寫行號、不寫畫面。預期的 observation 是 first entry、wait、service 與 endpoint J；若方向相反，應記錄 counterexample 而非把門檻改回去。慢速學員可用「進入太早／太晚」二選一，快速學員可指出接觸窗口如何使兩者都可能發生。來源：C120 SDD §8、§8.3、B-ENTER teaching map。

## Slide 42

Exit 為何要分開？

- 主視覺｜entry/exit band 之間的 hysteresis belt
- DO｜閱讀並圈出 EXIT_QUALITY 的維持條件
- WHY｜讓已啟動模式不因一個低點立刻退出
- MECHANISM｜分離進入與維持條件，降低 mode chatter
- EXPECT｜較低 exit 可能保持 active 更久；EVIDENCE PLACEHOLDER｜released code、line、trace
- INTERPRET｜比較 mode transitions、retries、service 與 state time；方向不保證

Authority｜C120 integration SDD §8；action matrix B-EXIT；DONOR-REWRITE｜BeamShift 12

### Speaker Notes

講師在這頁先畫兩條帶：entry band 和較低的 exit band，讓學員看見 hysteresis 的幾何意義。EXIT_QUALITY 不是第二個獨立目標，而是已進入 send-ready mode 後的維持條件；它可能減少 mode chatter，也可能讓 endpoint 在較弱 quality 下保持 active 更久。學員預測應鎖定 mode transitions、retries、service 與 state time，不能只看一張 final KPI 卡。release line 與 trace 尚未凍結，因此正文與 notes 都不提供假的行號或數值，只保留 EVIDENCE PLACEHOLDER。若結果和預測相反，這是值得保留的 evidence，不是需要掩蓋的錯誤。慢速學員可先找出一次「進入」和一次「退出」，快速學員可預測短暫 quality dip 對兩種門檻的不同影響。來源：C120 SDD §8、B-EXIT teaching map；donor hysteresis concept 只作改寫參考。

## Slide 43

Stable steps 擋住尖峰

- 主視覺｜stable-step counter
- DO｜閱讀並圈出 STABLE_STEPS 的連續觀測條件
- WHY｜讓短暫 quality spike 不足以觸發 send-ready
- MECHANISM｜只有連續多個合法步驟達到 entry condition 才能進入
- EXPECT｜hold 較長應減少短促 entry，卻可能延遲 service；EVIDENCE PLACEHOLDER｜released lines、trace
- INTERPRET｜對照 first entry、wait、missed window、service、endpoint J；不預設方向

Authority｜C120 integration SDD §8、§8.3；action matrix B-HOLD

### Speaker Notes

這頁把 stable-step counter 當成一個時間過濾器，而非品質分數。學員讀出連續觀測的條件後，先預測較長 hold 會如何改變 first entry 與短窗口中的 missed opportunity。講師提醒：它可能減少短促 entry，也可能讓 service 變差；這是 hypothesis，不能預填 KPI。release marked lines、Trace A 與 browser evidence 未凍結，正文的 EVIDENCE PLACEHOLDER 必須保持可見。結果要沿著 first entry → wait → contact remaining → service → endpoint J 解讀；不要只看 mode count。若語法錯誤，回到上一個合法 marked block，不要改 engine。慢速學員可在 trace 上數出連續步驟，快速學員可提出「剛好錯過窗口」的 held-out 條件。來源：C120 SDD §8、B-HOLD teaching map。

## Slide 44

先預測 Trace A

- 主視覺｜Trace A 上的 prediction overlay
- DO｜在看結果前，寫下 first entry、等待次數、service、endpoint J
- WHY｜讓 Trace A 能確認或推翻 threshold/hold 假設
- MECHANISM｜固定 scenario、trace、traffic 與 predecessor policy，綁定預測和結果
- EXPECT｜prediction 先進 workbook；EVIDENCE PLACEHOLDER｜Trace A data、artifact、KPI
- INTERPRET｜結果若改變 queue、mode、service、state、J，才支持或推翻假設

Authority｜C120 integration SDD §8.3、§10.3；action matrix ACT-07

### Speaker Notes

這頁是 Lab B 執行前的 prediction lock，保護時段仍是第 50–71 分鐘。學員要先寫 first entry、wait count、service 與 endpoint J 的預測，再看 Trace A 結果；這個順序避免用 outcome 反推看似合理的故事。講師固定 scenario、trace、traffic 與 predecessor policy，說明預測是可回溯的實驗前承諾。Trace A 的現行 data、artifact、KPI 和 workbook pixel 尚未凍結，正文標示 EVIDENCE PLACEHOLDER。若 observed mode 或 service 沒有任何 consequential change，就只能報告 null diff，不能稱為成功。慢速學員可用方向詞完成句子，快速學員可寫出一個會推翻預測的 quality segment。來源：action matrix ACT-07、C120 SDD §8.3、§10.3。

## Slide 45

Trace A：基準與候選

- 主視覺｜Trace A 的兩張 terminal receipt
- DO｜先跑 Trace A baseline，再跑只改 Lab B block 的 candidate
- WHY｜在同一 predecessor 與 boundary 下測 entry/hold/exit
- MECHANISM｜固定 scenario、seed、traffic；只讓 active policy block 改變 action sequence
- EXPECT｜兩份可比較 receipt 與 evidence diff；EVIDENCE PLACEHOLDER｜commands、results、hash、KPI
- INTERPRET｜沒有 service/state/energy diff 就先停下，不能用視覺差異補結論

Authority｜C120 integration SDD §8、§9.3–9.4；action matrix ACT-08B、ACT-10B

### Speaker Notes

這頁把 Lab B 的 baseline 與 candidate 並列，但不展示未凍結的 terminal screenshot。學員先執行 untouched Trace A baseline，再只改 Lab B marked block 執行 candidate；predecessor policy、scenario、seed、traffic 與 boundary 都必須相同。講師指出這個 sequence 是公平比較的機制，而不是盲目複製兩個 command。commands、results、hash、KPI 仍是 EVIDENCE PLACEHOLDER；正式 release API 後才可替換。若結果只改動畫或 label，視為未通過 consequential-fixture gate；若有 queue、mode、service、state 或 endpoint J 變化，才進下一頁 freeze。慢速學員可先在 ledger 標記固定與可變欄，快速學員可提前指出最可能的 trade-off。來源：C120 SDD §8、§9.3、§9.4；action matrix ACT-08B、ACT-10B。

## Slide 46

先凍結 policy

- 主視覺｜policy bytes 連到 freeze receipt
- DO｜用已接受的 Trace A candidate 建立 policy freeze
- WHY｜在 withheld trace 前固定決策規則，拒絕事後 retuning
- MECHANISM｜content-addressed receipt 綁定 scenario、predecessor、active block、policy identity
- EXPECT｜freeze receipt 與 policy hash；EVIDENCE PLACEHOLDER｜current receipt、schema、line
- INTERPRET｜任何 bytes 改變都使 withheld comparison 失效；恢復 last-known-good file

Authority｜C120 integration SDD §9.3、§10.3；action matrix ACT-10B、freeze dependencies

### Speaker Notes

這頁是 Lab B 的關鍵 gate，保護目的在於讓 Trace B 成為真正的 withheld test。學員以已接受的 Trace A candidate 建立 freeze，理解 receipt 綁定的是 policy bytes、scenario、predecessor 與 active block，而不是一個手寫標籤。講師要強調 freeze 不是宣稱 KPI 變好，而是宣稱比較條件已固定。current receipt、schema、line 與 browser evidence 尚未 release-freeze，正文必須保留 EVIDENCE PLACEHOLDER。若任何 bytes 改變，Trace B 只能重新走 Trace A candidate/freeze，不可把新結果冒充 held-out evidence。慢速學員可用 identity checklist，快速學員可說明為何 filename 不能取代 content hash。來源：C120 SDD §9.3 freeze receipt、§10.3；action matrix freeze dependency。

## Slide 47

Trace B 不准重調

- 主視覺｜frozen policy crossing a new trace
- DO｜用 frozen policy 執行 withheld Trace B，不再編輯
- WHY｜測試規則能否轉移到新的 quality/contact 條件
- MECHANISM｜同一 policy hash 跨過新 trace，暴露 entry、hold、exit 的邊界
- EXPECT｜Trace B replay 與 counterexample verdict；EVIDENCE PLACEHOLDER｜command、result、browser、KPI
- INTERPRET｜changed bytes 不算 withheld evidence；恢復 frozen file/receipt

Authority｜C120 integration SDD §4.2、§9.3、§10；action matrix ACT-12B

### Speaker Notes

講師先遮住 Trace B 的形狀，再請學員用已凍結的 policy 執行，不允許看見結果後調整門檻。目的不是追求每一條 trace 都變好，而是看規則在新 quality/contact 條件下是否仍有合理 causal explanation。預期輸出是 Trace B replay 與一個 qualified verdict；command、result、browser、KPI 尚未凍結，全部以 EVIDENCE PLACEHOLDER 標示。若 changed bytes 出現，這次結果只能算 retuning，應恢復 frozen file/receipt。常見誤解是把 held-out pass 當成普遍最優；講師應要求學員指出條件與 claim scope。慢速學員只需回答支持、推翻或無法判定，快速學員可寫出下一個 fair counterexample。來源：C120 SDD §4.2、§9.3、§10；action matrix ACT-12B。

## Slide 48

沿著 evidence 讀

- 主視覺｜Trace B 的 event-first timeline
- DO｜依序檢查 mode changes、attempts、retries、service、endpoint J
- WHY｜把 threshold 行為連回 packet 與能量後果
- MECHANISM｜validated event ledger 顯示 policy decision → packet/state → service/J
- EXPECT｜一條可追溯 trace；EVIDENCE PLACEHOLDER｜browser、result artifact、KPI
- INTERPRET｜counterexample 可以推翻方向；不要用 visual-only label 救回結論

Authority｜C120 integration SDD §9.5–9.6、§10.3；DONOR-REWRITE｜BeamShift 36–39、70–75

### Speaker Notes

這頁教學員如何讀 evidence，而不是只看最後一個數字。講師引導從 mode changes 到 attempts、retries、service，再到 endpoint J，讓每一個結論都有事件鏈。瀏覽器只呈現 validated artifact，不在 client 端新算科學結果；這也保留 endpoint 與 canonical system 的層級差異。現行 browser、result artifact 與 KPI 未凍結，正文只放 EVIDENCE PLACEHOLDER。若 Trace B 是 counterexample，應保留它並重寫 qualified claim，不能用顏色、動畫或 label 把它改成成功。慢速學員可沿箭頭讀一條事件，快速學員可指出哪一個事件最能推翻預測。來源：C120 SDD §9.5–9.6、§10.3；donor trace/evidence concepts 只作改寫。

## Slide 49

Lab B：承認反例

- 主視覺｜too-slow / ping-pong / qualified verdict 三格卡
- DO｜把 Trace B 分類為支持、counterexample 或 inconclusive
- WHY｜只有 frozen policy 下的 withheld result 才能測試轉移
- MECHANISM｜比較 entry/hold/exit 與 mode、attempt、service、J 的同場景鏈
- EXPECT｜三路 verdict ledger；EVIDENCE PLACEHOLDER｜artifacts、browser、KPI
- INTERPRET｜寫下一句 causal clause；若身份不符，回到 freeze/recovery，不補造結果

Authority｜issue 11 Lab B；C120 integration SDD §10.3；DONOR-REWRITE｜BeamShift 12、36–39

### Speaker Notes

第 50–71 分鐘的 Lab B 在此完成 debrief；主視覺的三格不是成績榜，而是三種證據狀態。學員要以 frozen policy 為前提，將 Trace B 歸為支持、counterexample 或 inconclusive，並寫一句「由於哪個機制，哪個 evidence 改變／沒有改變」。講師可用 too-slow 或 ping-pong 作為語言 scaffold，但不預先宣稱哪一格會出現。artifacts、browser、KPI 與 case identity 未凍結，故 EVIDENCE PLACEHOLDER 不可刪除。若身份或 freeze 不符，回到 recovery；不要偷偷改 policy 或填入缺失數字。快完成的學員可提出一個下一輪實驗，慢速學員只需完成 causal stem。來源：issue 11 Lab B evidence floor、C120 SDD §10.3；donor concepts 12、36–39。

## Slide 50

Recovery：保存再開

- 主視覺｜workbook checkpoint receipt
- DO｜保存並重新開啟 Energy Decision Workbook checkpoint
- WHY｜保留 scenario、prediction、receipt、artifact 與 recovery provenance
- MECHANISM｜reopen 重新驗 identity 與完成度，不重算或補造結果
- EXPECT｜同一 scenario 與可見 COMPLETE/INCOMPLETE；EVIDENCE PLACEHOLDER｜workbook receipt、pixel、artifact
- INTERPRET｜缺 evidence 就保持 INCOMPLETE；用同場景 fallback 續接，不偽造完成

Authority｜C120 integration SDD §4.1、§12、§14；action matrix ACT-13

### Speaker Notes

第 71–76 分鐘是 recovery reset，保護目的在於讓課程不因一次操作失敗而遺失因果鏈。學員保存 checkpoint 後重新開啟，確認 scenario identity、prediction、receipts、artifacts 與 recovery provenance 仍在；reopen 不應重算數值，也不應自動把缺欄補成完成。當前 workbook receipt、pixel、artifact 尚未 release-freeze，正文以 EVIDENCE PLACEHOLDER 呈現。講師展示 COMPLETE 與 INCOMPLETE 是兩種誠實狀態，不是失敗與成功的美化標籤。若 runner 或 import 仍阻塞，保留已存在的 evidence，切到 matching fallback，再回到 Lab C。慢速學員可照 identity checklist，快速學員可指出哪個缺失欄位必須維持 INCOMPLETE。來源：C120 SDD §4.1、§12、§14；action matrix ACT-13。

## Slide 51

同場景 fallback

- 主視覺｜normal path / same-scenario fallback fork
- DO｜遇到 setup、run 或 import block 時，切換 matching fallback artifact
- WHY｜保留 causal lesson，不因環境故障改變 mission identity
- MECHANISM｜fallback 重播固定 scenario 與 provenance，不接受任意替代 case
- EXPECT｜source、scenario identity、clock 對齊；EVIDENCE PLACEHOLDER｜artifact、browser、recovery clock
- INTERPRET｜把 operational recovery 與 energy result 分開；回到當前 lab debrief

Authority｜ADR-004 42–71；C120 integration SDD §4.1、§14；action matrix ACT-04、ACT-11

### Speaker Notes

這頁把 fallback 定義成同場景的保護路徑，而不是另一組資料或隱形捷徑。講師說明 setup、run、import 任一處卡住時，學員在保護時限內切換 matching artifact；它保留 scenario identity、clock 與 provenance，讓 causal lesson 可以繼續。fallback 不是 measured energy、live backend 或 canonical parity 證據。artifact、browser、recovery clock 與目前 UI 都尚未凍結，所以正文清楚標示 EVIDENCE PLACEHOLDER。學員要在 workbook 記錄「為何切換、回到哪一頁、哪些結果是 fallback」，不能刪除失敗歷史。慢速路徑是直接重建 queue → action → state → energy；快速路徑可比較 normal 與 fallback 的 claim boundary。來源：ADR-004 Decision 7、C120 SDD §4.1、§14；action matrix ACT-04、ACT-11。

## Slide 52

Lab C：佇列如何花 J？

- 主視覺｜queue cards meets a short service window
- 問題｜有限 budget 下，佇列要批次、休眠，還是提早送 urgent？
- 固定｜同一 scenario、traffic、service boundary、mission window
- 對照｜normal freshness/deadline 與 urgent deadline 不可混成一個分數
- 核心｜schedule 會改變 activation、queue age、service 與 endpoint J
- 先問｜少花 J 是否真的保住 required delivery？

Authority｜issue 11 Lab C；C120 integration SDD §8、§9.6；ADR-004 claim boundary

### Speaker Notes

第 76–99 分鐘進入 Lab C；主問題不是把節能定義成少送資料，而是在有限 service window 與 budget 下，怎麼安排 queue、batch、sleep 與 urgent send。講師固定 scenario、traffic、service boundary 與 mission window，再分開 normal freshness/deadline 和 urgent deadline。學員先說出「少花 J 但失去 required delivery」不算合格節能，之後才進入 policy edit。這頁不依賴未凍結的 browser 或 KPI，概念可以完整教學。慢速學員可先將 queue cards 排成 generated → send → delivered/expired，快速學員可提出 batch 與 urgent 互相衝突的窗口。來源：issue 11 Lab C storyboard、C120 SDD §8–§9.6；endpoint energy 只在 declared endpoint scope 內解讀。

## Slide 53

三件事不要混

- 主視覺｜queue、deadline、freshness 三張有序訊息卡
- Queue age｜等待多久，描述延遲與批次壓力
- Deadline｜最晚何時完成，描述任務成敗邊界
- Freshness｜資料還能否使用，描述過期風險
- 機制｜policy 只讀 decision-time 欄位，不偷看 future delivery/energy
- 結論｜先守 service gate，再談 J、bit/s 與 endpoint bit/J

Authority｜C120 integration SDD §8.1、§9.6；issue 11 Lab C

### Speaker Notes

講師在這頁讓三張卡各自站在不同時間軸：queue age 是等待歷史，deadline 是最晚完成，freshness 是資訊還有沒有用。學員要能指出三者不是同一個 score，也不能用一個漂亮的 endpoint bit/J 掩蓋 deadline 或 freshness 失敗。policy 只可看到 decision-time 的合法 observation；future delivery、future collision、final service 與 future energy 都是結果。這個概念是後面 batch/urgent edit 的護欄，不需要 current runtime evidence。慢速學員可用三個提問逐卡回答，快速學員可設計一張 urgent 卡和一張 bulk 卡比較。來源：C120 SDD §8.1、§9.6；issue 11 Lab C contract。

## Slide 54

Batch 換取等待

- 主視覺｜queue → flush sequence
- DO｜把 BATCH_SIZE 視為唯一可改的正整數
- WHY｜測試較少 activation 是否值得較長 queue age
- MECHANISM｜batch 門檻改變 flush 時機、wake/TX 次數與 packet age
- EXPECT｜較大 batch 可能少 activation 卻增加 delay；EVIDENCE PLACEHOLDER｜code、result、KPI
- INTERPRET｜檢查 queue age、delivered/expired、service、endpoint J；方向不保證

Authority｜C120 integration SDD §8；action matrix C-BATCH；issue 11 Lab C storyboard

### Speaker Notes

這頁把 BATCH_SIZE 當成一個 schedule mechanism，而不是「越大越省」的旋鈕。學員只圈出 marked positive integer，預測 flush 時機、activation、wake/TX 次數與 queue age 的變化。講師要同時放上 service gate：如果 expired 或 required delivery 變差，單看 J 下降不能算成功。現行 code、result、browser 與 KPI 未凍結，正文的 EVIDENCE PLACEHOLDER 必須保留；不要填入擬真的 batch count。預期解讀路徑是 queue age → delivered/expired → service → endpoint J。慢速學員可先比較小批次與大批次的時間線，快速學員可指定一個不值得等的 urgent deadline。來源：C120 SDD §8、C-BATCH teaching map；action matrix C-BATCH。

## Slide 55

Urgent 提前介入

- 主視覺｜urgent countdown crossing the margin
- DO｜把 URGENT_MARGIN_S 視為 urgent override 的唯一秒數門檻
- WHY｜決定 urgent deadline 何時打破 normal pacing/batching
- MECHANISM｜margin 改變 SEND_URGENT 的觸發時間與較早的 energy spend
- EXPECT｜較大 margin 可能較早送出；EVIDENCE PLACEHOLDER｜code、result、KPI
- INTERPRET｜檢查 urgent send time、deadline/freshness、TX/RX/wake、endpoint J

Authority｜C120 integration SDD §8；action matrix C-URGENT；issue 11 Lab C storyboard

### Speaker Notes

這頁以倒數線表示 URGENT_MARGIN_S：它是 deadline override 的時間判斷，不是能量預算本身。學員先說出較大 margin 可能提前送 urgent、也可能較早花掉 energy；方向必須由 evidence 決定。講師把 normal pacing/batching 與 urgent branch 分開，提醒 urgent 不應偷換成第二套 headline ratio。current code、result、KPI 未 release-freeze，投影片只標 EVIDENCE PLACEHOLDER。解讀要同時查看 urgent send time、deadline/freshness 與 TX/RX/wake，再看 endpoint J。慢速學員可在 countdown 上畫觸發點，快速學員可構造一個 urgent 與 bulk 同時到達的 case。來源：C120 SDD §8、C-URGENT teaching map；action matrix C-URGENT。

## Slide 56

讀 Lab C 標記線

- 主視覺｜BATCH_SIZE + URGENT_MARGIN_S code focus
- DO｜只讀 marked Lab C region，圈出兩個可改常數
- WHY｜隔離 batching/urgency policy，避免改到 engine 或 scenario
- MECHANISM｜branch 依 queue、urgent deadline 與固定 boundary 選擇 flush 或 urgent send
- EXPECT｜兩個 marked constants 與 legal action hints；EVIDENCE PLACEHOLDER｜released code、line、API
- INTERPRET｜只改 active Lab C block；syntax/legal-action failure 就恢復該區塊

Authority｜C120 integration SDD §8.1–§8.3；action matrix ACT-06、C-BATCH、C-URGENT

### Speaker Notes

這頁是 Lab C 的 code bridge，保護目的在於讓學員知道哪些線可以動、哪些線不能動。講師逐行說明 queue、urgent deadline 與 return action 的關係，再讓學員圈出 BATCH_SIZE 和 URGENT_MARGIN_S。runner、scenario、schema、energy model 與 browser logic 都不在 edit surface。因為 released code、line、API 未凍結，正文保留 EVIDENCE PLACEHOLDER，不能提供假的 screenshot 或行號。若 syntax 或 illegal action 失敗，只恢復 active block，並重新說出 mechanism；不要複製一份新的 policy。慢速學員可用 branch flow 圖，快速學員可指出哪個 future field 不能放進 condition。來源：C120 SDD §8.1–§8.3；action matrix ACT-06、C-BATCH、C-URGENT。

## Slide 57

先鎖 Lab C 預測

- 主視覺｜queue/service/state/J prediction lock
- DO｜先跑 baseline，並在結果前記錄 queue、service、state time、endpoint J 預測
- WHY｜建立公平 control，也讓 schedule 假設可被推翻
- MECHANISM｜default policy 產生 queue、packet、radio-state、energy ledger
- EXPECT｜prediction 先存入 workbook；EVIDENCE PLACEHOLDER｜baseline artifact、result、browser、KPI
- INTERPRET｜未先預測的 run 只能探索，不能滿足 causal checkpoint

Authority｜C120 integration SDD §8.3、§9.5–9.6；action matrix ACT-07、ACT-08C

### Speaker Notes

第 76–99 分鐘的 Lab C 從 baseline prediction 開始，而不是直接改 batch 或 urgent。學員先寫 queue、service、state time 與 endpoint J，再執行 untouched baseline，這樣結果才有 confirm/falsify 的對象。講師說明 default policy 只是 control，不是最佳排程；service gate 與 endpoint energy scope 必須同時保存。baseline artifact、result、browser 與 KPI 尚未凍結，正文標示 EVIDENCE PLACEHOLDER。若學員忘記預測，這次可以探索但不能宣稱完成 causal checkpoint。慢速學員可用四欄 workbook stem，快速學員可加寫 delivered/expired 的預測。來源：action matrix ACT-07、ACT-08C；C120 SDD §8.3、§9.5–9.6。

## Slide 58

只改一次再跑

- 主視覺｜one allowed code diff + candidate receipt
- DO｜只改一個 marked Lab C constant，再執行 candidate
- WHY｜測試一個 causal mechanism，不做隨機 retuning
- MECHANISM｜BATCH_SIZE 或 URGENT_MARGIN_S 改變 schedule 與 action time，boundary 不變
- EXPECT｜small diff 與 candidate result；EVIDENCE PLACEHOLDER｜command、hash、artifact、KPI
- INTERPRET｜queue、state、energy、service 無差異就未通過 consequential gate；恢復 active block

Authority｜C120 integration SDD §8.3、§9.3；action matrix ACT-09、ACT-10C1

### Speaker Notes

這頁把 Lab C 的第一次 candidate 限定為一個 marked constant，並要求在相同 boundary 下執行。學員先選擇要測 batching 或 urgency，寫出預測，再留下 small diff；不要同時改兩個常數。講師把 action time、queue、state、energy 與 service 綁在同一條 causal chain。command、hash、artifact、KPI 未凍結，正文維持 EVIDENCE PLACEHOLDER，不假造 result。若沒有 consequential diff，這不是「看起來差不多」而是 fixture gate 未通過；恢復 active block 或記錄 null result。慢速學員可用一條 mechanism stem，快速學員可設計一次 service trade-off 的比較。來源：C120 SDD §8.3、§9.3；action matrix ACT-09、ACT-10C1。

## Slide 59

先看 packet，不看總分

- 主視覺｜queue strip + packet lifecycle ledger
- DO｜檢查 queue age、attempt、delivered、expired 的事件順序
- WHY｜區分少做工作與少送有用資料
- MECHANISM｜event ledger 把 policy action 連到 packet lifecycle 與 service
- EXPECT｜queue strip 與 packet ledger；EVIDENCE PLACEHOLDER｜browser、artifact、KPI
- INTERPRET｜delivery 或 freshness 下降可否決表面的 saving；不補造缺失事件

Authority｜C120 integration SDD §7.2、§9.5–9.6、§10.3；action matrix ACT-11

### Speaker Notes

這頁要求學員先讀 packet lifecycle，再看任何總結數字。講師依 generated → attempt → retry/delivered/expired 的順序帶讀 queue strip，讓學員看見 batch 或 urgent choice 的實際後果。少做 activation 不等於完成任務；delivery、freshness、deadline 與 service 必須先過 boundary。current browser、artifact、KPI 尚未凍結，正文清楚標示 EVIDENCE PLACEHOLDER。若 event 缺失，保留缺失並回到 validator/fallback，不在 workbook 手填一個合理值。慢速學員可只追一張 urgent card，快速學員可比較 normal 與 urgent 的 queue age。來源：C120 SDD §7.2、§9.5–9.6、§10.3；action matrix ACT-11。

## Slide 60

再看 state 與 J

- 主視覺｜radio-state ribbon + endpoint energy breakdown
- DO｜檢查 sleep、awake-idle、wake、process、TX、RX 與 endpoint J
- WHY｜把 power-time mechanism 讀懂，再談效率
- MECHANISM｜endpoint energy breakdown 由 validated state intervals 組成
- LaTeX：J_{\mathrm{endpoint}}=\sum_s P_s\Delta t_s+\sum E_{\mathrm{wake}}
- EXPECT｜ribbon 與 breakdown；EVIDENCE PLACEHOLDER｜browser、artifact、KPI
- INTERPRET｜endpoint J 不是 canonical system consumed J；保留 layer label

Authority｜C120 integration SDD §7.1、§9.2.1、§9.6；ADR-004 Decision 5

### Speaker Notes

這頁把 Lab C 的 endpoint state ribbon 和能量分解放在同一條時間軸。學員依序找 sleep、awake-idle、wake、process、TX、RX，再理解每個狀態如何以 power × time 或 wake lump-sum 貢獻 J。公式只表達 endpoint layer 的 accounting，不能被拿去替換現有 C-120 canonical consumed J；講師要明說兩層 replay 不互相冒充。現行 browser、artifact、KPI 未凍結，正文只保留 EVIDENCE PLACEHOLDER。若 wake latency 使 contact 關閉，wake cost 仍可存在，但 send 不一定成功；這正是 service 與 energy 必須分欄的原因。慢速學員可先指 state，快速學員可比較同一送達量下不同 state time。來源：C120 SDD §7.1、§9.2.1、§9.6；ADR-004 two-layer replay boundary。

## Slide 61

只准一次修正

- 主視覺｜candidate → one revised constant
- DO｜讀 candidate evidence，只做一次 Lab C allowed revision，再 freeze
- WHY｜用 evidence 修正 mechanism，不用隨機調參
- MECHANISM｜只更新 BATCH_SIZE 或 URGENT_MARGIN_S，並保留 predecessor identity
- EXPECT｜一個 small diff、revised prediction、revision receipt；EVIDENCE PLACEHOLDER｜code、command、hash、result
- INTERPRET｜第二次 revision 或非 Lab C edit 都不算；syntax failure 只回到這一步

Authority｜C120 integration SDD §8.3、§9.3；action matrix ACT-10C2、ACT-10C3

### Speaker Notes

這頁是 Lab C 的唯一 revision gate。學員先讀 candidate queue、packet、state、service 與 endpoint J，再選一個 evidence-backed mechanism，只改 BATCH_SIZE 或 URGENT_MARGIN_S 其中之一，並更新 prediction。講師要保留 predecessor identity，讓 revision 仍可和 baseline/candidate 對照。code、command、hash、result、receipt 尚未凍結，正文保留 EVIDENCE PLACEHOLDER。第二次 revision、跨區塊修改或把結果改成 label 都不合格；syntax error 只回到同一 marked block。慢速學員可用「觀察→推理→一個改動」三格 scaffold，快速學員可指出 revision 可能使哪個 service 欄位惡化。來源：C120 SDD §8.3、§9.3；action matrix ACT-10C2、ACT-10C3。

## Slide 62

Surprise case 收束

- 主視覺｜candidate/revision/surprise 三列 final ledger
- DO｜以 unchanged revision policy 執行 surprise case，完成 Lab C debrief
- WHY｜測試 batching/urgency 假設遇到 surprise event 是否仍成立
- MECHANISM｜同一 policy identity 遇新 queue、deadline 或 short-window 條件
- EXPECT｜surprise replay、queue/packet/state/energy ledger；EVIDENCE PLACEHOLDER｜artifacts、KPI
- INTERPRET｜寫「省下哪段 power-time、犧牲哪項 service」；changed bytes 不算

Authority｜issue 11 Lab C storyboard；C120 integration SDD §4.2、§8.3、§10.3；action matrix ACT-12C

### Speaker Notes

第 76–99 分鐘的 Lab C 在 surprise case 收束；學員不能在看到 surprise 後再改 policy。講師並列 candidate、revision、surprise 三列 ledger，要求學員找出省下的 power-time 成本與可能犧牲的 service、freshness 或 deadline。surprise artifact、KPI、browser pixel 都尚未凍結，正文標示 EVIDENCE PLACEHOLDER。若 policy identity 改變，這次不是 held-out evidence；若 result null，保留 null 並檢查 fixture 是否 consequential。慢速學員可完成一句比較句，快速學員可提出跨 domain 的相同機制。來源：issue 11 Lab C storyboard、C120 SDD §4.2、§8.3、§10.3；action matrix ACT-12C。

## Slide 63

Evidence clinic：何時可知？

- 主視覺｜available-now / post-action sort
- DO｜把 input 分成 decision-time 可用與 post-action 才知道
- WHY｜避免把結果偷塞回 policy feature
- MECHANISM｜合法 observation 流入 choose_action；result fields 留在 replay/output
- EXPECT｜legal feature/action verdict；EVIDENCE PLACEHOLDER｜current UI、schema、validator
- INTERPRET｜future delivery、collision、final service、energy 作為 input 就是 leakage

Authority｜C120 integration SDD §8.1、§8.3、§19.2；issue 11 Evidence clinic

### Speaker Notes

第 99–109 分鐘是 evidence clinic；第一問是「在做決策的那一刻，學員真的知道什麼？」講師把 available-now 與 post-action 兩欄分開，讓學員把 elapsed、contact、quality、queue、urgent pending 與 previous action 放在合法欄，把 future delivery、collision、final service、energy 放在結果欄。這不是限制想像，而是確保 prediction 能被真正的 action test。current UI、schema、validator 未凍結，正文保留 EVIDENCE PLACEHOLDER。慢速學員可用卡片分類，快速學員可解釋 leakage 如何讓 offline score 看似變好卻不代表節能。來源：C120 SDD §8.1、§8.3、§19.2；issue 11 Evidence clinic。

## Slide 64

Prediction 不是 saving

- 主視覺｜legal feature vs leaky future result
- DO｜在 evidence card 上圈出合法 feature，劃掉 future result
- WHY｜防止 prediction score 冒充節能證據
- MECHANISM｜只有 decision-time input 能影響 policy；service/J 保留為 post-action evidence
- EXPECT｜legal feature/action verdict；EVIDENCE PLACEHOLDER｜released API、validator、browser
- INTERPRET｜accuracy 不等於 saving；回到 service、state、J 與 claim scope

Authority｜issue 11 Evidence clinic；C120 integration SDD §8.1、§9.6；DONOR-REWRITE｜BeamShift 70–75

### Speaker Notes

這頁要拆掉最常見的錯誤推論：prediction accuracy 高，不代表 energy saving 或 service pass 高。學員用 legal feature 與 leaky future result 做一次分類，理解 policy 的 input 與 replay 的 output 是不同角色。講師要求任何節能句子都回到 service、state、J 與 declared scope，而不是停在 score。released API、validator、browser evidence 未凍結，正文的 EVIDENCE PLACEHOLDER 是必要的誠實標記。慢速學員可只回答「現在知道／事後才知道」，快速學員可反駁一個把 future energy 放入 feature 的設計。來源：issue 11 Evidence clinic、C120 SDD §8.1、§9.6；donor evidence qualification 70–75 只作改寫。

## Slide 65

證據要帶 provenance

- 主視覺｜record with identity/hash/scope lineage spine
- 身份｜scenario_id、case、policy identity、seed、source mode
- 內容｜events、summary、energy scope、units、provenance
- 分類｜measured、derived、assumed、simulated 不互換
- 讀法｜claim 必須落在 record 可支撐的 boundary 內
- 證據界線｜EVIDENCE PLACEHOLDER｜current artifacts、hashes、browser not frozen

Authority｜C120 integration SDD §7、§9.5–9.6、§20；DONOR-REWRITE｜BeamShift 70–75、96–97、113

### Speaker Notes

講師把 evidence record 當成一條 lineage spine，而不是一張散落的結果表。學員要能找出 scenario_id、case、policy identity、seed、source mode、events、summary、energy scope 與 units，並把 measured、derived、assumed、simulated 分類保持分開。任何 claim 都必須回到這筆 record 能支持的 boundary；endpoint energy 不能被改名成 canonical system energy。current artifacts、hashes、browser evidence 尚未凍結，正文顯示 EVIDENCE PLACEHOLDER，避免填入假 receipt。慢速學員可完成 identity checklist，快速學員可判斷一個缺 provenance 的數值為何只能作 unverified。來源：C120 SDD §7.1–§7.2、§9.5–§9.6、§20；donor concepts 70–75、96–97、113。

## Slide 66

Claim 有上限

- 主視覺｜claim ladder with a hard ceiling
- 可說｜COURSE-PACKAGED SIMULATED LORA ENDPOINT-ENERGY LAB
- 不可說｜live、measured、canonical parity、whole-system/wall-plug、classroom-ready
- 邊界｜endpoint replay 只留在 endpoint layer；canonical system evidence 另行保存
- 證據｜每個 conclusion 連到 scenario、service、J、scope、provenance
- 提醒｜EVIDENCE PLACEHOLDER｜claim remains until release and human gates

Authority｜ADR-004 42–71；C120 integration SDD §9.6、§20；issue 11 Evidence and claim boundary

### Speaker Notes

這頁把 claim ceiling 放到 evidence clinic 的最後，讓學員知道誠實不是把課程說小，而是把證據說準。允許的方向是 course-packaged simulated LoRa endpoint-energy lab integrated with Leo for bounded novice validation；不可宣稱 live、measured、canonical parity、whole-system/wall-plug 或 classroom-ready。講師特別指出 endpoint replay 與現有 C-120 system evidence 是兩層，不可把 endpoint J 或 endpoint bit/J 改名成 canonical。release、browser、KPI 與 human gates 未完成前，正文保留 EVIDENCE PLACEHOLDER。慢速學員可用 claim ladder 判斷句子能否保留，快速學員可把一個過大的 claim 改寫成 bounded claim。來源：ADR-004 Decision 8、C120 SDD §9.6、§20；issue 11 claim boundary。

## Slide 67

把機制搬出去

- 主視覺｜mechanism token remap across four domains
- 智慧農場｜sensor alert：batch vs freshness
- HVAC｜comfort window：wait vs act
- Edge inference｜wake cost：idle vs sleep
- 物流｜deadline：urgent margin vs batch
- 共同骨架｜policy → queue/service → power×time → J → evidence；LEO 只是索引

Authority｜issue 11 Competition transfer；C120 integration SDD §1、§13.1

### Speaker Notes

第 109–120 分鐘開始 competition transfer；這頁先把機制 token 從 LEO 拆出來，再放入智慧農場、HVAC、edge inference 與物流。學員要看到可移轉的是 batch、freshness、wait/act、wake cost、urgent margin 與 deadline，不是 TLE 或衛星名稱。講師要求每個 domain 都保留同一條 policy → queue/service → power×time → J → evidence 骨架。這頁不需要 current browser 或 KPI，概念可以完整講；若學員想引用 LEO 數字，提醒 claim scope 仍是 simulated endpoint layer。慢速學員可挑一個 domain 完成機制替換，快速學員可指出其 held-out condition。來源：issue 11 Competition transfer、C120 SDD §1、§13.1。

## Slide 68

寫可推翻的假設

- 主視覺｜falsifiable hypothesis stem
- DO｜寫一個可被 hidden/withheld case 推翻的 hypothesis
- WHY｜讓 competition idea 從偏好變成可測的 energy decision
- MECHANISM｜指定一個 policy change，連到 queue/service/state/J 的觀察
- EXPECT｜先寫 direction、boundary、held-out condition；EVIDENCE PLACEHOLDER｜final workbook artifact
- INTERPRET｜結果支持、推翻或不確定都要保留，不能只挑好看的案例

Authority｜issue 11 Competition transfer；C120 integration SDD §1、§13.1；action matrix ACT-07

### Speaker Notes

學員在這頁把課程結果翻成 competition hypothesis，保護目的不是寫口號，而是留下可反駁的機制。講師可提供句型「在固定 mission 與 service boundary 下，若改變某個 decision rule，則哪個 evidence 會改變」，再要求寫 direction、boundary 與 held-out condition。hypothesis 必須連到 queue、service、state time 或 J，不能只說更聰明、更快或更省。final workbook artifact 尚未凍結，正文保留 EVIDENCE PLACEHOLDER。慢速學員可先完成一個 domain token remap，快速學員可加入可能的 counterexample。來源：issue 11 Competition transfer、C120 SDD §1、§13.1；claim ceiling 仍不可逾越。

## Slide 69

先寫 falsifier

- 主視覺｜falsifier card with held-out condition
- DO｜指定一個不改 policy 的 held-out condition
- WHY｜讓結果有機會推翻原本方向，而不是只尋找支持
- MECHANISM｜同一 policy hash 遇到新 window、trace 或 urgent event
- EXPECT｜counterexample 或 qualified support；EVIDENCE PLACEHOLDER｜withheld artifact、KPI
- INTERPRET｜改 policy 後才過關的結果不是 withheld evidence；回到 frozen receipt

Authority｜C120 integration SDD §4.2、§9.3、§10.3；issue 11 Evidence floor

### Speaker Notes

這頁在 exit 前把 falsifier 寫清楚：同一 policy、不改 bytes、換一個合理但未揭露的 window、trace 或 urgent event。學員先指定會讓假設失效的條件，再寫若它發生要看哪一個 service/state/J evidence。withheld artifact 與 KPI 未凍結，正文以 EVIDENCE PLACEHOLDER 呈現；不可用假數值保證支持。講師提醒：若為了通過 falsifier 而先改 policy，結果不再是 held-out evidence，必須回到 frozen receipt。慢速學員可選一張條件卡，快速學員可設計不只一個 counterexample 並說明哪個更公平。來源：C120 SDD §4.2、§9.3、§10.3；issue 11 evidence floor。

## Slide 70

Export，重開，再離場

- 主視覺｜workbook loop：export → close → reopen
- DO｜匯出、關閉，再重開 Energy Decision Workbook
- WHY｜保存 scenario、prediction、run/import/freeze/fallback provenance
- MECHANISM｜reopen 重新驗身份與完成度，不重算或補造結果
- EXPECT｜COMPLETE 或 INCOMPLETE；EVIDENCE PLACEHOLDER｜current workbook JSON、receipt、browser
- INTERPRET｜缺 evidence 就保持 INCOMPLETE；重綁同場景 fallback 後再回到 exit

Authority｜C120 integration SDD §12、§14、§19.4–19.5；action matrix ACT-13

### Speaker Notes

最後 109–120 分鐘的 exit gate 是 export、close、reopen，而不是投影片播完。學員要確認 workbook 保存 scenario、predictions、run/import/freeze/fallback provenance、hypothesis 與 falsifier，關閉後再開仍指向同一 identity。講師強調 reopen 不會重算或補造結果；缺 evidence 就保持 INCOMPLETE，這比假裝完成更有教學價值。current workbook JSON、receipt、browser pixel 未凍結，正文保留 EVIDENCE PLACEHOLDER，不能寫假的 COMPLETE 截圖或 KPI。若 session 中斷，先重綁同場景 fallback，再回到 exit；若證據完整，仍只作 bounded simulated teaching claim，等待 owner 與 human gates。慢速學員可依 export checklist 完成，快速學員可口頭說明一個 claim 的 provenance。來源：C120 SDD §12、§14、§19.4–19.5；action matrix ACT-13。

## Slide 71

Setup 分支：八分鐘時鐘

- 分支圖：05–08 正常安裝｜08 檢查｜10 提供備援｜13 切換
- DO｜依支援作業系統進入準備分支；現行啟動指令＝EVIDENCE PLACEHOLDER
- WHY｜把安裝摩擦限制在課堂時鐘內，不把等待當節能證據
- MECHANISM｜隔離環境與鎖定套件保護 runner、scenario 與 policy 邊界
- EXPECT｜08 分鐘出現 READY 或可讀錯誤；目前收據＝EVIDENCE PLACEHOLDER
- INTERPRET｜未在 13 分鐘前通過就選同 scenario fallback；保留 source_mode=fallback

Authority｜issue 11 §Exact 120-minute cadence；ADR-004 §Course-authority amendment；SDD §4.1

### Speaker Notes

這一頁是準備分支的時間契約，不是冷啟動已通過的證明。依 issue 11 的 exact-120 cadence，準備必須有明確的 05–08、08、10、13 分鐘節點；ADR-004／SDD 允許使用準備好的 runner，但仍保留同 scenario fallback。請引導學員先說出每個節點的目的，再看現行收據；命令、路徑與收據尚未凍結時，畫面只顯示 EVIDENCE PLACEHOLDER。若切換 fallback，明示這是保持課程因果鏈的 recovery，不是 runner、live 或 canonical parity 的通過。

## Slide 72

確認釋出根目錄

- 視覺：必需檔案｜混入檔案兩欄
- DO｜開啟 release root 與資料夾清單；路徑＝EVIDENCE PLACEHOLDER
- WHY｜先確認 reviewed package，避免把移動分支當成課程版本
- MECHANISM｜README、setup、lock、student_policy.py、runner、schemas 綁定同一 package identity
- EXPECT｜缺檔或混檔能被標記；完整清單＝EVIDENCE PLACEHOLDER
- INTERPRET｜不符合就回到 named release archive；不自行補檔或換 branch

Authority｜ADR-004 §Decision；SDD §3.1、§5.2；action-code-explanation-matrix.md ACT-01

### Speaker Notes

把根目錄當成第一個 provenance 檢查，而不是檔案尋寶。SDD 的課程套件包含說明、跨作業系統 setup、鎖定依賴、policy、runner 與 schemas；這些角色要來自同一個 reviewed release。不要在課堂中補上看似相近的檔案，也不要把任意 branch 當成釋出版本。真正路徑與檔名尚未由 controller freeze，因此畫面必須保留 placeholder；缺檔時回到 named archive，並在 workbook 留下 recovery provenance。

## Slide 73

診斷環境與 lock

- 視覺：環境 → lock → receipt 三段
- DO｜讀取 setup/verify 的失敗收據；目前收據＝EVIDENCE PLACEHOLDER
- WHY｜分辨作業環境故障與 energy result，避免錯把安裝狀態當實驗結果
- MECHANISM｜.venv 隔離 interpreter；hash-pinned lock 限定 dependency graph
- EXPECT｜錯誤定位到環境或 lock stage；實際欄位＝EVIDENCE PLACEHOLDER
- INTERPRET｜先依診斷或同 scenario fallback recovery；不得移除 pin

Authority｜ADR-004 §Course-authority amendment；SDD §4.1、§5.3；action-code-explanation-matrix.md ACT-02、ACT-03

### Speaker Notes

請先把故障放回它所屬的層次：環境、依賴 lock，或後續 runner。setup 失敗不是功率、能量或服務結果，也不應用來比較 policy。隔離 interpreter 的目的，是避免系統 Python 或另一個專案的套件污染課程 runner；hash-pinned lock 的目的，是保留 reviewed dependency graph。現行錯誤欄位與 hash 尚未凍結，不能填入猜測值；移除 pin 會破壞可追溯性，應改走診斷或同 scenario fallback。

## Slide 74

讀一則 setup 錯誤

- 視覺：error → meaning → smallest recovery
- DO｜挑一張可讀錯誤 receipt；原文＝EVIDENCE PLACEHOLDER
- WHY｜只修復阻塞 gate，不擴大到 framework debugging
- MECHANISM｜把錯誤詞對到 Python、lock、path 或 permission 類別
- EXPECT｜形成一個最小 recovery step；現行 error evidence＝EVIDENCE PLACEHOLDER
- INTERPRET｜若分類不明，保留 placeholder 並切 fallback；不假定 root cause

Authority｜SDD §4.1；action-code-explanation-matrix.md ACT-04；ADR-004 §Decision

### Speaker Notes

這一頁教的是錯誤閱讀的範圍控制。請讓學員指出錯誤發生在 runner 尚未開始之前，並用一個類別描述它；不要把課堂變成框架除錯課。最小 recovery step 可以是重新使用支援的啟動方式、確認釋出根目錄，或切到同 scenario artifact，但具體命令仍等待 release evidence。錯誤證據未凍結前不能寫出實際 traceback；若分類不明，保留不確定性並轉入 fallback。

## Slide 75

匯入同 scenario fallback

- 視覺：runner（未通過）→同 scenario fixture（可繼續）
- DO｜匯入 pinned fallback artifact；artifact ID＝EVIDENCE PLACEHOLDER
- WHY｜讓學員在 minute 13 後保留完整課程因果鏈
- MECHANISM｜保留同一 scenario_id、clock、後續 policy/replay identity，並標 source_mode=fallback
- EXPECT｜Leo 顯示可追溯 fallback provenance；目前 import receipt＝EVIDENCE PLACEHOLDER
- INTERPRET｜fallback 是 recovery path，不是 runner 通過或 live/backend 證據

Authority｜issue 11 §scenario_id 與 fallback；ADR-004 §Decision；SDD §4.1

### Speaker Notes

fallback 的關鍵是同一 scenario identity，而不是一張看起來相似的預設畫面。issue 11 要求後續 labs 消費學員產生的 scenario_id；若走 identical fallback，workbook 與全畫面都要標 source_mode=fallback。ADR-004 將 fixture 保留為 mandatory classroom recovery，且不把它冒充成 live backend。artifact ID、import receipt 與實際畫面目前都未凍結，請保留 placeholder 並讓 provenance 可在 reopen 時追溯。

## Slide 76

Python 復原：縮排

- 視覺：縮排階梯｜condition → action → return
- DO｜只修復標記區的縮排；釋出片段＝EVIDENCE PLACEHOLDER
- WHY｜讓合法分支真正回到 policy API，不改 runner 或公式
- MECHANISM｜Python block structure 決定條件、動作與 return 是否屬同一路徑
- EXPECT｜verify/run 指向同一 marked error；released line＝EVIDENCE PLACEHOLDER
- INTERPRET｜修復後才比較結果；若 syntax 仍紅，回到該行，不改其他區

Authority｜ADR-004 §Course-authority amendment；SDD §2.2；action-code-explanation-matrix.md ACT-09

### Speaker Notes

這不是要求學員重寫 Python，而是把一個標記區的結構讀清楚。用縮排階梯說明條件、合法 action 與 return 必須在預期 block 內；不要在頁面上偽造釋出行號或實際程式片段。修復目標是恢復 policy API 的可執行路徑，並讓後續 runner event 能被觀察，不是更動科學公式或 upstream engine。若 syntax gate 仍紅，回到同一標記區；不要藉機修改其他區域。

## Slide 77

比較式與合法 action

- 視覺：syntax split｜comparison → legal action
- DO｜讀 marked comparison 與 legal-action API；released text＝EVIDENCE PLACEHOLDER
- WHY｜語法正確不代表動作合法或能完成服務
- MECHANISM｜comparison 只看允許 observation；return 只發送 API 允許 action
- EXPECT｜非法 action 或版本差異由 receipt 指出；exact API＝EVIDENCE PLACEHOLDER
- INTERPRET｜先分 syntax／semantics；不可藉「能執行」宣稱公平或節能

Authority｜SDD §2.2、§5.3；action-code-explanation-matrix.md ACT-06、ACT-09

### Speaker Notes

請把 syntax 與 semantics 分成兩個判斷。比較式要使用當下允許的 observation，return 則只能選擇 pinned API 允許的 action；兩者都不能偷看未來結果或改寫 runner。實際 API 名稱、released text 與錯誤訊息尚未凍結，所以頁面只保留 EVIDENCE PLACEHOLDER。即使程式能執行，也只代表某個操作 gate 可能通過，不能直接推出公平比較或節能結果。

## Slide 78

只讀 traceback 標記區

- 視覺：traceback → line pointer → marked block
- DO｜只讀標記的 traceback 行；實際 traceback＝EVIDENCE PLACEHOLDER
- WHY｜定位最小的 learner-owned issue，不把課程變成 framework debugging
- MECHANISM｜line pointer 對回 policy contract 與預期 action path
- EXPECT｜只產生一個 repair target；行號與錯誤文字＝EVIDENCE PLACEHOLDER
- INTERPRET｜若錯誤超出標記面，停止修改並用 fallback／講師 recovery

Authority｜SDD §2.2、§4.1；action-code-explanation-matrix.md ACT-06、ACT-09

### Speaker Notes

traceback 閱讀的目的，是找到最小可控的修復點，而不是追查整個 framework。先找標記行，再將它對回 policy contract；不要從模糊的錯誤文字臆測行號。現行 traceback、line pointer 與 error message 都是未凍結證據，必須原樣以 placeholder 佔位。若錯誤不屬於標記面，保護來源與 workbook，改用講師 recovery 或同 scenario fixture。

## Slide 79

修一行，接回機制

- 視覺：one-line diff → policy action → evidence
- DO｜修改一個標記行並執行驗證；code／receipt＝EVIDENCE PLACEHOLDER
- WHY｜恢復 policy → action → evidence 的可追溯因果鏈
- MECHANISM｜單一 edit 改變 policy branch，再由 runner 留下事件與結果
- EXPECT｜出現小 diff、policy identity 與 consequential evidence；result＝EVIDENCE PLACEHOLDER
- INTERPRET｜null diff 代表 fixture gate 失敗，不代表成功；回到受影響 lab debrief

Authority｜ADR-004 §Decision；SDD §2.1、§4；action-code-explanation-matrix.md ACT-09、ACT-10A

### Speaker Notes

這一頁把程式修復重新接到課程的因果要求。學員只改一個標記行，然後確認 policy identity、runner event 與結果 artifact 是否仍能連起來；不要用畫面變色代替 consequential evidence。實際 code、receipt、hash 與 result 仍待 release freeze，因此畫面不能發明它們。若下游 queue、packet、state、service 或 endpoint energy 沒有變化，應判定 fixture gate 未成立，回到 lab debrief 或 recovery，而不是宣布成功。

## Slide 80

快速分支：凍結 policy

- 視覺：policy bytes → freeze receipt → withheld case
- DO｜凍結目前 accepted policy；freeze receipt＝EVIDENCE PLACEHOLDER
- WHY｜保護 withheld comparison 的公平性，不在看到新 trace 後調參
- MECHANISM｜policy bytes、scenario identity 與 receipt 綁定同一 replay
- EXPECT｜產生可重開的 frozen identity；schema／hash＝EVIDENCE PLACEHOLDER
- INTERPRET｜凍結後 bytes 改變即不算同一 policy；復原檔案與 receipt 或切 fallback

Authority｜issue 11 §Lab B；ADR-004 §Decision；action-code-explanation-matrix.md ACT-10B、ACT-12B

### Speaker Notes

freeze 是 Lab B 或快速分支進入 withheld case 前的公平性閘門。先把 policy bytes、scenario identity 與 receipt 綁在一起，再看新 trace；這樣 counterexample 才能說明機制，而不是反映事後調參。精確 freeze schema、hash preimage、artifact ID 都由 controller freeze 後才能放入教材。若凍結後檔案被改動，必須回復同一檔案與 receipt，或重新走同 scenario recovery；不能把新 policy 冒充 frozen policy。

## Slide 81

預測公平 counterexample

- 視覺：同一 policy｜新 trace｜同 boundary
- 提出｜先預測 service、state time、endpoint J、delivered bits 的可能方向
- 條件｜只改明示 trace／opportunity，不改 policy、job、window、boundary
- 機制｜counterexample 測試 policy 是否依賴單一品質趨勢
- 證據｜實際 trace／result＝EVIDENCE PLACEHOLDER
- 判讀｜這是可被 withheld case 推翻的假說，不是 KPI 保證

Authority｜issue 11 §Fast learner branch、§Lab B；SDD §4.2

### Speaker Notes

快速分支不是多一個任意 slider，而是對同一 policy 提供一個公平的新條件。先固定 job、window、boundary 與 policy，再預測 opportunity 或 quality trace 改變時，service、state time、endpoint J、delivered bits 可能怎樣走。這些方向是待檢驗假說，不是保證的 KPI。實際 trace 與 result 未凍結時只顯示 placeholder；下一頁才執行 frozen policy replay。

## Slide 82

不重調，直接跑新 case

- 視覺：freeze receipt → withheld case → replay
- DO｜用 frozen policy 跑新 case；command／result＝EVIDENCE PLACEHOLDER
- WHY｜測試公平泛化，不把 withheld evidence 偷換成再調參
- MECHANISM｜固定 policy bytes，只有明示 scenario sub-trace 改變
- EXPECT｜保留 policy identity 並產生可比較 service／state／energy evidence；artifact＝EVIDENCE PLACEHOLDER
- INTERPRET｜若 ranking 變化，回到條件／機制解釋；不稱全面最佳

Authority｜issue 11 §Lab B、§Fast learner branch；action-code-explanation-matrix.md ACT-12B

### Speaker Notes

本頁的操作前提是上一頁的 freeze receipt 已存在。學員不修改 policy，只對明示的 withheld sub-trace 執行 replay；因此觀察到的變化可以回到 opportunity、queue、state 或服務條件。命令、case name、artifact 與結果目前都未 release-freeze，不能在教材中虛構。若 ranking 改變，描述「在此條件下」的機制；不要將單一 withheld verdict 擴大成全面最佳。

## Slide 83

反思排名為何改變

- 視覺：evidence ledger 四格
- 問題｜何者改變：opportunity、queue、state time、service boundary？
- 假說｜policy mechanism 應造成哪一條 causal link？
- 證據｜baseline／candidate／withheld IDs 與數值＝EVIDENCE PLACEHOLDER
- 判讀｜ranking changed ≠ regression；ranking held ≠ universal winner
- 回點｜把一句機制解釋帶回受影響 lab；無 artifact 不宣稱結果

Authority｜issue 11 §Evidence and claim boundary、§Lab B；donor-inventory-dedup.md 36–39 概念重寫

### Speaker Notes

debrief 要把排名變化拆成可觀察的條件，而不是只問誰比較高。讓學員在 ledger 中標出 opportunity、queue、state time 或 service boundary 的差異，並說出 policy mechanism 期待改變哪條 causal link。baseline、candidate、withheld 的 ID 與數值仍是未凍結證據，所以這頁提供判讀框架而不提供答案。排名改變可能是公平反例；排名不變也不代表 policy 在所有條件都最好。

## Slide 84

Leo 匯入失敗：先看邊界

- 視覺：schema → identity → units → provenance → import
- DO｜讀取 fail-closed receipt；current UI／error＝EVIDENCE PLACEHOLDER
- WHY｜防止不相干 scenario、單位或來源靜默進入 session
- MECHANISM｜比對 schema version、scenario_id、seed、policy hash、units、provenance
- EXPECT｜全有或全無 receipt；失敗時 session 不變；actual receipt＝EVIDENCE PLACEHOLDER
- INTERPRET｜修復 named artifact 或切同 scenario fallback；不得把 endpoint 值改填 system 欄

Authority｜ADR-004 §Decision；SDD §2.1、§5.1；action-code-explanation-matrix.md ACT-11

### Speaker Notes

Leo importer 的核心行為是 fail closed：不相容 artifact 不應部分寫入 session。依 ADR-004／SDD，至少要保護 schema、scenario identity、seed、policy hash、units 與 provenance；這些欄位的實際名稱與 receipt 等待 contract freeze。請強調 endpoint replay 是自己的 evidence layer，不能把 endpoint energy 靜默改填既有 Leo/system consumed J。匯入失敗時 session 保持不變，修復命名 artifact 或切同 scenario fallback。

## Slide 85

用 rendered artifact 繼續

- 視覺：offline evidence packet → workbook checkpoint
- DO｜打開 rendered artifact evidence packet；目前 packet＝EVIDENCE PLACEHOLDER
- WHY｜runtime blocked 時維持 evidence clinic 的觀察，不捏造 browser PASS
- MECHANISM｜packet identity／source_mode 與 workbook checkpoint 綁定；不執行新 run
- EXPECT｜可讀 queue／packet／state／energy records；現行欄位＝EVIDENCE PLACEHOLDER
- INTERPRET｜offline packet 只支援 bounded discussion；未解 mismatch 路由至 fallback

Authority｜ADR-004 §Decision；SDD §4.1、§5.1；CURRENT-C120-HANDOFF.md §Remaining unknowns

### Speaker Notes

離線 artifact packet 是「繼續學習」的證據包，不是把缺失的 runtime 或 browser evidence 藏起來。學員可讀已產出的 queue、packet、state、energy records，並把它們和 workbook checkpoint 綁定；此頁不執行新的 policy 或 run。packet path、receipt、browser pixels 與欄位尚未凍結，因此只能標示 placeholder。若 packet identity 或 source mode 不一致，停止使用並回到同 scenario fallback。

## Slide 86

重建 queue 到 energy

- 視覺：queue → policy action → radio state → endpoint J
- DO｜用 workbook／packet receipt 排回 queue→action→state→energy
- WHY｜恢復因果順序，避免只記一個最後數字
- MECHANISM｜每一箭頭對應事件、時間、packet outcome 或 energy field
- EXPECT｜每個箭頭都有 identity／unit evidence；current IDs＝EVIDENCE PLACEHOLDER
- INTERPRET｜缺任何欄位就停在 fail-closed；回到 lab debrief 或同 scenario fallback

Authority｜ADR-004 §Decision；SDD §2.1、§5.1；issue 11 §Recovery reset

### Speaker Notes

復原時不要從最後的 J 值倒推故事；請沿著 queue、policy action、radio state、endpoint energy 的時間順序重建。每一條箭頭都需要對應事件、時間、packet outcome 或 energy field，並保留 scenario identity 與 units。若資料缺欄或 provenance 斷裂，不能以合理想像補足；停在 fail-closed，回到受影響 lab 或 fallback。這頁可作為 recovery reset 的口頭一句話骨架。

## Slide 87

低 W 不等於低 J

- 視覺：低峰值／短時間 ↔ 低功率／長時間的 power-time area
- 區分｜W 是瞬時功率；J 是 time-window 累積能量
- LaTeX：J = \sum_t P(t)\Delta t
- 問題｜只看低 W 能否判定低 J？還要看 service、deadline、boundary
- 證據｜實際 P(t)、J、服務資料＝EVIDENCE PLACEHOLDER
- 邊界｜DONOR-REWRITE：只取 W/J 概念；不沿用 donor KPI 或場景

DONOR-REWRITE｜donor-inventory-dedup.md 14、16/17；Authority｜issue 11 §Accepted decision、§Evidence and claim boundary

### Speaker Notes

這是從 donor W/J 概念重寫的 deepening，不是搬用舊數值或舊場景。用兩個 power-time area 讓學員看到低峰值但很久，可能累積更多 J；相反地，短暫高峰也要放回 service 與 deadline 檢查。公式只表達累積關係，不提供本課的實測或模擬數字。比較時固定 job、window、boundary；現行 P(t)、J 與服務 artifact 尚未凍結，請保留 placeholder。

## Slide 88

先定 service boundary

- 視覺：合格 service gate → energy ledger → bit/J
- 先問｜同一 job、time window、energy boundary 是否固定？
- LaTeX：EE_{\mathrm{endpoint}} = \frac{\mathrm{unique\ delivered\ bits}}{J_{\mathrm{endpoint}}}
- LaTeX：EE_{\mathrm{canonical}} = \frac{\mathrm{unique\ delivered\ bits}}{J_{\mathrm{system}}}
- 分欄｜service_pass、freshness、deadline、J、delivered bits、bit/J 不互換
- 判讀｜少做服務不算節能；endpoint bit/J 不得稱 canonical bit/J

DONOR-REWRITE｜donor-inventory-dedup.md 19–21；Authority｜issue 11 §Accepted decision；ADR-004 §Decision

### Speaker Notes

此頁採用 donor 的 service gate 論證，但完全按 current C-120 authority 重寫。先固定工作、時間窗與 energy boundary，再把 endpoint ratio 與 system canonical ratio 分開：兩者的分子都使用 unique delivered bits，但分母分別是 endpoint J 與 system consumed J。service_pass、freshness、deadline、J 與 delivered bits 是分開的服務、限制與證據欄位。公式是可編輯的 raw LaTeX 語義提示，不代表本課已取得 KPI。若少做服務而 bit/J 看似上升，不能稱節能；endpoint bit/J 也不可稱 canonical bit/J。

## Slide 89

兩層 energy authority

- 視覺：endpoint replay ↔（不等同）↔ Leo／system replay
- endpoint 層｜sleep、process、TX/RX、packet、queue、endpoint energy
- system 層｜現有 C-120 authoritative replay 與 canonical fields
- 規則｜兩層共享 scenario、clock、workbook；不把 endpoint J cast 成 system consumed J
- 主張｜只能在明示 layer 與 boundary 內解讀結果
- 證據｜current replay／adapter parity＝EVIDENCE PLACEHOLDER

Authority｜ADR-004 §Decision；SDD §2.1；CURRENT-C120-HANDOFF.md §Binding course contract

### Speaker Notes

這一頁是防止語義混用的 authority map。ADR-004 把 LoRa endpoint replay 與既有 C-120 Leo/system authoritative replay 分開；兩者可共享 scenario、clock 與 workbook，但 endpoint energy 不能自動變成 system consumed J。請要求學員先指出結果屬於哪一層，再描述 service 或 energy。adapter parity、current replay 與 browser evidence 尚未成立時，保留 placeholder，不以相似欄位宣稱等價。

## Slide 90

公平 baseline 與同窗口

- 視覺：A baseline｜same job／window／boundary｜B candidate
- 固定｜scenario_id、job、time window、service boundary、power model
- 改動｜只改一個 policy block；其餘 provenance 保持
- 觀察｜queue、packet、service、state time、J、delivered bits、bit/J 分列
- 邊界｜DONOR-REWRITE：重寫 fair A/B；不引用 legacy browser screenshot
- 判讀｜缺 identity／receipt 或超過一個 block，comparison 不成立

DONOR-REWRITE｜donor-inventory-dedup.md 36–39；Authority｜issue 11 §Lab A/B；action-code-explanation-matrix.md ACT-08、ACT-09

### Speaker Notes

公平 A/B 是 donor 概念的 current rewrite。請把 scenario_id、job、時間窗、service boundary 與 power model 放在同一條 contract，再只改一個 policy block；其餘 provenance 保持。觀察欄要分列 queue、packet、service、state time、J、delivered bits 與 bit/J，避免用一個讀數遮住服務代價。缺 identity、receipt 或多改一個 block 時，comparison 不成立，應回到 baseline 或 recovery。

## Slide 91

把機制移到非 LEO

- 視覺：LEO contact window → smart farm irrigation／HVAC occupancy
- 抽象｜機會在時間上變動；policy 決定 send、wait、sleep、urgent
- 不抽象｜場域的 service、deadline、power model 需重新定義
- 操作｜把同一 mechanism token 映到一個 domain；不可搬運數值
- 證據｜transfer card 與 falsifier＝EVIDENCE PLACEHOLDER
- 判讀｜可移轉的是 decision structure，不是衛星 KPI 或 live claim

Authority｜issue 11 §Accepted decision、§Competition transfer；CURRENT-C120-HANDOFF.md §1

### Speaker Notes

LEO 在本課只是清楚的 changing-opportunity 例子。轉移到智慧農場或 HVAC 時，可以保留「機會會變動、policy 選擇時機、能量與服務有取捨」這個 mechanism token，但必須重新定義場域的 service、deadline 與 power model。不要把 LEO 的數值、contact window 或 endpoint claim 直接搬過去。transfer card 與 falsifier 尚未有現行 artifact，請以 placeholder 讓學員提出可被推翻的競賽假說。

## Slide 92

四種 claim 分類

- 視覺：measured｜derived｜assumed｜simulated 四欄
- measured｜本課目前沒有可升級的 live／physical measurement
- derived｜由明示模型與輸入計算；需保留 lineage
- assumed｜course-added traffic／power／service boundary；必須標記
- simulated｜teaching fixture output；不成為 measured KPI
- 邊界｜DONOR-REWRITE：採分類框架，服從 current C-120 claim ceiling；不確定＝EVIDENCE PLACEHOLDER

DONOR-REWRITE｜donor-inventory-dedup.md 113；Authority｜issue 11 §Evidence and claim boundary；ADR-004 §Decision

### Speaker Notes

這頁沿用 donor 的四欄分類，但把 claim ceiling 改成 current C-120 語境。measured、derived、assumed、simulated 不是品質排序，而是不同的來源與可宣稱範圍。course-added traffic、power 與 service boundary 必須標為 assumption；fixture 或 runner output 必須標為 simulated，不可升格 measured KPI。若 lineage 或分類不清，claim 留在 placeholder／INCOMPLETE，不能用漂亮畫面補強。

## Slide 93

LoRaEnergySim 的邊界

- 視覺：C-120 scenario provider → endpoint model → JSON result
- 可提供｜sleep、process、TX/RX 狀態、packet attempt、delivery／expiry、endpoint energy
- 場景錨點｜frozen C-120 scenario anchor 由 provider 提供並驗證；runner 只回聲
- 課程 wrapper｜只加入 course inputs 與 Leo JSON seam；不得合成或改名 scenario_id
- 邊界｜endpoint replay 與 system replay 分層；不提供 live／canonical pass
- 證據｜實際 provider／wrapper／result schema＝EVIDENCE PLACEHOLDER

Authority｜ADR-004 §Context、§Decision；SDD §1、§2.1

### Speaker Notes

LoRaEnergySim 的價值在 endpoint state、packet outcome 與 energy consequence 能連到 IoT 節能問題；它不是現成的 C-120 system energy producer。frozen C-120 scenario anchor 必須由 provider 提供並驗證，runner 只能驗證後回聲，不能合成或重新命名 scenario_id；course wrapper 只加入課程輸入與 Leo JSON seam。ADR-004 要求 endpoint replay 與 system replay 分層，且沒有 live telemetry 或 classroom pass 的自動推論。這頁的實際 provider、wrapper 與 result schema 尚未 release-freeze，請保留 placeholder。

## Slide 94

上游 pin 與課程 wrapper

- 視覺：upstream pin｜course-owned wrapper｜Leo JSON seam
- 上游｜LoRaEnergySim pinned revision；精確 revision＝EVIDENCE PLACEHOLDER
- wrapper｜course-owned runner 綁定 scenario、seed、policy、result schema
- 固定｜依賴、locations、run duration、serialization 凍結後才可談 reproducibility
- 隔離｜Leo 以 versioned JSON 溝通，不 import／link Python modules
- 證據｜pin、lock SHA、wrapper release receipt＝EVIDENCE PLACEHOLDER

Authority｜ADR-004 §Decision、§Integration and licensing boundary；SDD §3.1、§5.2

### Speaker Notes

這個 appendix page 要讓 provenance 的所有權一眼可見。上游 revision 與 license 屬來源；course-owned wrapper 將固定 scenario、seed、policy 與 result schema；Leo 只透過 versioned JSON 溝通，不把 upstream Python 直接 import 進 React。locations、run duration、serialization 與 lock 也要先凍結，才能討論 reproducibility。精確 revision、lock SHA 與 release receipt 尚未確認，禁止自行填值。

## Slide 95

課程假設與未驗證主張

- 視覺：upstream model｜course assumption｜LEO mapping｜result
- 輸入類別｜state／packet model、traffic／energy assumptions、LEO window mapping 分欄
- assumption｜traffic、power parameter、service boundary、scenario sub-trace 都標來源
- unverified｜cold-start、browser import、fixture consequence、novice timing 仍待 gate
- 禁止｜把 assumed／simulated 值寫成 measured、live、canonical
- 證據｜source／version／assumption／result lineage＝EVIDENCE PLACEHOLDER

Authority｜ADR-004 §Costs and risks、§Required gates；SDD §2.2、§8；CURRENT-C120-HANDOFF.md §Remaining unknowns

### Speaker Notes

請把「上游提供什麼」和「課程新增什麼」拆開。traffic、power parameter、service boundary 與 scenario sub-trace 可能是課程假設；它們不是 upstream measurement。SDD 與 current handoff 都把 cold-start、browser import、fixture consequence、novice timing 列為尚待驗證的 gate。這頁不提供漂亮的通過數字；每個結果仍需帶 source、version、assumption 與 result lineage，否則只能降低 claim。

## Slide 96

student_policy.py 可用邊界

- 視覺：observation（只讀）→ bounded action（可選）
- DO｜只開啟標記區與 API card；released lines／API＝EVIDENCE PLACEHOLDER
- WHY｜把 learner agency 限在可教、可審、可重播的 policy surface
- MECHANISM｜observation → legal action → runner event → result evidence
- EXPECT｜合法 action 會留下 policy／provenance；exact API＝EVIDENCE PLACEHOLDER
- INTERPRET｜future outcome、engine／schema／formula 都禁止；差異就回復 pinned policy

Authority｜ADR-004 §Course-authority amendment；SDD §2.2、§5.3；action-code-explanation-matrix.md ACT-06

### Speaker Notes

這張 API card 是操作邊界，不是完整 Python 教科書。學員只閱讀允許的 observation，並從 bounded action 中做選擇；不可讀 future outcome、改 upstream engine、schema 或 scientific formula。實際 released line numbers、API version 與合法 action 名稱由 controller freeze 後才可放入頁面，因此目前只用 placeholder。每個合法 action 都要能在 runner event 與結果 evidence 中被追溯，否則不算 consequential policy surface。

## Slide 97

Scenario 到 result schema

- 視覺：scenario package → runner → result.json
- DO｜以 fixed scenario package 供 runner；schema instance／command＝EVIDENCE PLACEHOLDER
- WHY｜同一 scenario_id 貫穿 TLE、Lab A/B/C、withheld、Leo、workbook
- MECHANISM｜scenario identity＋seed＋units＋policy hash → deterministic events → validated JSON
- EXPECT｜result 含 packet／queue／state／energy／service／provenance；實際欄位＝EVIDENCE PLACEHOLDER
- INTERPRET｜schema／identity／unit mismatch fail closed；不手動拼接結果

Authority｜ADR-004 §Decision；SDD §2.1、§3.1；action-code-explanation-matrix.md ACT-04、ACT-11

### Speaker Notes

這頁是 contract flow：scenario package 先固定條件，runner 消費 policy，result writer 產生帶 provenance 的 JSON，Leo importer 再驗證。核心不是檔案格式本身，而是同一個 scenario_id、seed、units 與 policy hash 穿過 TLE、三個 labs、withheld、Leo 與 workbook。現行 schema instance、命令與欄位尚未凍結，不能自行命名或填入 hash。任何 mismatch 都必須 fail closed，不能靠手動拼接一個看似合理的 result。

## Slide 98

Fail-closed 驗證梯

- 視覺：schema → identity → units → provenance → import
- DO｜執行 validation／import gate；current receipts／UI＝EVIDENCE PLACEHOLDER
- WHY｜防止不相干 scenario、單位或來源靜默進入 session
- MECHANISM｜比對 schema version、scenario_id、seed、policy hash、units、provenance
- EXPECT｜全有或全無 receipt；失敗時 session 不變；actual receipt＝EVIDENCE PLACEHOLDER
- INTERPRET｜修復 named artifact 或切同 scenario fallback；不得把 endpoint 值改填 system 欄

Authority｜ADR-004 §Decision；SDD §2.1、§5.1；action-code-explanation-matrix.md ACT-11

### Speaker Notes

validation ladder 將資料信任拆成可教的幾個 gate。先看 schema，再看 identity、units、policy／seed 與 provenance；任何一項失敗都不能部分寫進 session。這個 fail-closed 行為同時保護 endpoint/system authority 邊界，避免把 endpoint 值轉寫成 system consumed J。現行 receipt 與 UI 尚未凍結，請在正式 release 前替換 placeholder，並保留 fallback 與 recovery provenance。

## Slide 99

Radio state 與能量帳

- 視覺：SLEEP → WAKE → PROCESS → TX／RX → WAIT 時間 ribbon
- 區分｜WAIT 是 awake idle；SLEEP 是低功率休息並可能付 wake latency／energy
- 事件｜PROCESS、TX、RX 各自留下 state time 與 packet context
- LaTeX：J_{\mathrm{endpoint}} = \sum_s P_s\,\Delta t_s + \sum_k E_{\mathrm{wake},k}
- 邊界｜狀態能量只屬 endpoint replay；不自動等於 Leo／system consumed J
- 證據｜state／energy event fields＝EVIDENCE PLACEHOLDER

Authority｜ADR-004 §Decision；SDD §1、§2.1；issue 11 §Lab A／Lab C

### Speaker Notes

這張 ribbon 讓學員把休眠、醒來、處理、傳送、接收與 awake idle 放回時間順序。WAIT 不是 SLEEP 的同義詞；WAIT 是醒著的 idle，SLEEP 可能降低功率但需要 wake latency 或 wake energy。公式把各狀態功率乘時間與每次 wake 的 lump-sum energy 一起列入帳，實際模型與欄位仍以 frozen contract 為準。所有 state energy 先標在 endpoint replay，不可自動改寫 Leo/system consumed J。

## Slide 100

W、J、bit/s 與 bit/J

- 視覺：W（瞬時功率）→ J（累積能量）＋ bit/s（資料率）→ unique delivered bits → bit/J
- LaTeX：J = \sum_t P(t)\Delta t
- LaTeX：EE_{\mathrm{endpoint}} = \frac{\mathrm{unique\ delivered\ bits}}{J_{\mathrm{endpoint}}}
- LaTeX：EE_{\mathrm{canonical}} = \frac{\mathrm{unique\ delivered\ bits}}{J_{\mathrm{system}}}
- 分欄｜完成時間、service_pass、freshness、deadline、budget remaining 不互換
- 判讀｜同 job／window／boundary 下才可比較；endpoint bit/J 不得稱 canonical bit/J

DONOR-REWRITE｜donor-inventory-dedup.md 14、16/17；Authority｜issue 11 §Accepted decision；SDD §2.1

### Speaker Notes

這一頁把 donor 的 W/J 與吞吐概念去重後放進同一條 unit ladder。W 是瞬時功率，J 是時間累積能量；bit/s 是資料率，unique delivered bits 是服務量。endpoint bit/J 使用 endpoint J，system canonical bit/J 使用 system consumed J，兩者不可互稱。完成時間、service_pass、freshness、deadline 與 budget remaining 仍是不同欄位，不能拿來互換。公式是語義視覺，不是新 metric；若 job、window 或 boundary 不同，先降低 claim。

## Slide 101

Endpoint 與 system energy

- 視覺：endpoint state／packet／J｜JSON seam｜Leo／system evidence
- endpoint｜sleep、process、TX/RX、queue、delivery 與 endpoint energy
- system｜既有 C-120 authoritative replay、service fields 與 canonical consumed J
- 共享｜scenario_id、clock、source_mode、workbook；不共享未宣告的數值語義
- 規則｜任何 adapter mapping 都需 owner freeze 與 parity evidence
- 證據｜current mapping／replay＝EVIDENCE PLACEHOLDER

Authority｜ADR-004 §Decision、§Costs and risks；SDD §2.1；CURRENT-C120-HANDOFF.md §Binding course contract

### Speaker Notes

這是 APP-09 對第 89 頁的 provenance 展開。endpoint layer 可以回答 packet、queue、radio state 與 endpoint energy 的問題；system layer 才承擔既有 C-120 authoritative replay 與 canonical fields。兩層共享 scenario、clock、source_mode 與 workbook，不代表所有 energy 欄位可互換。任何 adapter mapping 都需要 owner freeze 與 parity evidence；目前 mapping 與 replay 證據未凍結，保持 placeholder。

## Slide 102

TLE 只錨定變動窗口

- 視覺：pinned TLE → SGP4／model-derived position → NTPU service window
- 來源｜TLE 是 source anchor；SGP4／position 是 model-derived；window mapping 是 course output
- 不包含｜TLE 本身不含 traffic、power、handover policy、energy
- 課程用法｜每位學員完成 glass-box anchor，再讓同 scenario_id 被後續 labs 消費
- 證據｜source revision、position trace、window artifact＝EVIDENCE PLACEHOLDER
- 判讀｜無後續 consumption 就是 onboarding，不能當節能證據

DONOR-REWRITE｜donor-inventory-dedup.md 7–10、98–110；Authority｜issue 11 §LEO data anchor；CURRENT-C120-HANDOFF.md §Binding course contract

### Speaker Notes

TLE-to-NTPU 是每位學員必做的短 glass-box anchor，但它不是節能實驗。請把 TLE、SGP4／position 與 course-added window mapping 分成 source、model-derived 與 course output；TLE 不自帶 traffic、power、handover policy 或 energy。真正的學習價值在同一 scenario_id 被後續 labs 消費，否則 TLE 只會是裝飾性 onboarding。source revision、position trace 與 window artifact 未凍結前，不要填入外部檔名或數值。

## Slide 103

來源到結果的 lineage

- 視覺：source → model → assumption → result provenance spine
- source｜上游／檔案來源與版本＝EVIDENCE PLACEHOLDER
- model｜SGP4、endpoint state／packet 或 runner logic 的角色要分開
- assumption｜traffic、power、service boundary、fallback 等 course-owned inputs 明示
- result｜simulated endpoint replay／derived fields 帶 identity、units、provenance
- 判讀｜任何斷鏈都只能保留 bounded statement；不能升格 measured／canonical

DONOR-REWRITE｜donor-inventory-dedup.md 70–75；Authority｜ADR-004 §Decision；SDD §2.1

### Speaker Notes

lineage spine 的四個節點要在講解與 workbook 中保持一致。source 說明從哪裡來，model 說明如何轉換，assumption 說明課程加了什麼，result 說明產出屬於哪個 layer。donor 的 evidence clinic 概念在此重寫成 current provenance；不使用歷史 artifact、URL、hash 或 line number 代替現行證據。任何一節斷鏈時，主張只能維持 bounded teaching statement。

## Slide 104

SINR、dB 與 linear

- 視覺：dB（對數表達）↔ linear（計算量）→ quality decision
- LaTeX：x_{\mathrm{dB}} = 10\log_{10}(x_{\mathrm{linear}})
- 用途｜只用來讀 quality／trace 概念；不要求推導 link budget
- 邊界｜quality observation 不等於 delivered service、energy 或 bit/J
- 證據｜本課實際 quality field／unit＝EVIDENCE PLACEHOLDER
- 判讀｜source／model 未標單位就停止比較；不把 donor 公式移成 browser producer

DONOR-REWRITE｜donor-inventory-dedup.md 13、15、22–35、111–114；Authority｜SDD §2.1、§3.2

### Speaker Notes

這是 appendix vocabulary，不是要求非通訊背景學員推導 link budget。用一個 dB 與 linear 的轉換概念幫助閱讀 quality trace，但 quality observation 仍不等於 delivered service、energy 或 bit/J。公式是 donor 語義的最小重寫；不可把舊 donor 公式偷渡成 browser-side producer。實際 quality field 與 unit 尚未 release-freeze，未標單位就停止比較並保留 placeholder。

## Slide 105

Angle、range 與 power boundary

- 視覺：angle／range／RF quality → endpoint events → endpoint J（boundary mark）
- angle／range｜改變 opportunity／quality context；不直接給 traffic 或 power
- RF／model｜可形成 observation；producer、assumption、result 要分層
- consumed power｜須說明 endpoint 或 system boundary；不可混用
- 邊界｜DONOR-REWRITE：只取 appendix vocabulary；不移植 legacy EE／geometry claim
- 證據｜實際 field mapping／parity＝EVIDENCE PLACEHOLDER

DONOR-REWRITE｜donor-inventory-dedup.md appendix-only；Authority｜ADR-004 §Decision；SDD §2.1

### Speaker Notes

角度、距離與 RF quality 只能提供 opportunity 或 observation context，不能單獨決定 traffic、power 或服務。這頁保留 donor appendix 的詞彙，但刪除 legacy geometry 與 EE 主張；每個 producer、assumption、result 都要在 lineage 中分層。consumed power 必須先說明屬於 endpoint 還是 system boundary，不能因為名稱相近就合併。field mapping 與 parity 尚未凍結，故使用 placeholder。

## Slide 106

四欄 claim classifier

- 視覺：四欄 classification card｜measured／derived／assumed／simulated
- measured｜physical／instrument capture；本課未有升級條件
- derived｜由 frozen inputs／model 計算；保留 formula／lineage
- assumed｜課程設定 traffic／power／service／mission；需明示
- simulated｜fixture／runner／endpoint replay output；不可標 measured
- 邊界｜DONOR-REWRITE：沿用分類，服從 current claim ceiling；不確定＝EVIDENCE PLACEHOLDER

DONOR-REWRITE｜donor-inventory-dedup.md 113；Authority｜issue 11 §Evidence and claim boundary；ADR-004 §Decision

### Speaker Notes

請把 classifier 當成 claim 的護欄。measured 需要實體或儀器證據；derived 需要 frozen inputs、model 與 lineage；assumed 是課程設定；simulated 是 fixture、runner 或 endpoint replay output。current C-120 的 simulated teaching ceiling 不會因為欄位很詳細就變成 measured。donor 的分類概念已重寫，正式 workbook、notes 與 deck 必須使用同一分類；不確定時保留 placeholder。

## Slide 107

授權與修改邊界

- 視覺：upstream license／source ledger｜course wrapper｜Leo JSON seam
- 來源｜LoRaEnergySim GPL-3.0；upstream notices／citation＝EVIDENCE PLACEHOLDER
- 可改｜course-owned wrapper、scaffolded policy surface、versioned JSON contract（依 owner freeze）
- 不可改｜upstream internals、Leo scientific formulas、schema／produced artifacts
- 溝通｜Leo 只透過 documented JSON，不 import／link upstream Python
- 判讀｜license／provenance 未完成前不稱 release；contract 變更需重產 evidence

Authority｜ADR-004 §Integration and licensing boundary；SDD §3.2、§5.2

### Speaker Notes

這張 source ledger 將授權與技術邊界放在同一個視覺中。ADR-004 記錄 LoRaEnergySim 為 GPL-3.0，並要求課程 wrapper 以可分開釋出的方式處理；Leo 透過 documented JSON 溝通，不直接 import 或 link upstream Python。可修改範圍限於 course-owned wrapper、scaffolded policy surface 與已凍結的 versioned contract；upstream internals、Leo scientific formulas、schemas 與產出 artifact 不在 learner edit surface。正式 notices、citation、release provenance 尚未凍結，不能宣稱 release。

## Slide 108

Glossary、claim 與 reopen

- 視覺：glossary → claim ceiling → fallback → reopen
- DO｜用 glossary 對齊 scenario、source_mode、service_pass、consumed J、endpoint replay、workbook；artifact＝EVIDENCE PLACEHOLDER
- WHY｜讓 recovery 後仍保留同一 identity、boundary 與 evidence lineage
- MECHANISM｜missing／mismatch → fail closed → same-scenario fallback → export／reopen
- EXPECT｜workbook 標 COMPLETE 或 INCOMPLETE 並留下 provenance；reopen receipt＝EVIDENCE PLACEHOLDER
- INTERPRET｜最高 claim：SIMULATED TEACHING DATA / NOT LIVE / NOT MEASURED / NOT CANONICAL-PARITY-VERIFIED

Authority｜ADR-004 §Decision；SDD §2.1、§4.1；issue 11 §Competition transfer and exit

### Speaker Notes

最後一頁把 glossary、claim ceiling 與 recovery route 綁回同一個 reopenable workbook。請讓學員用固定詞彙說出 scenario、source_mode、service_pass、consumed J 與 endpoint replay 的邊界，再確認缺失或 mismatch 如何 fail closed、切同 scenario fallback、最後 export／reopen。COMPLETE 不是漂亮結果，而是 identity、prediction、receipt、result、recovery 與 provenance 都能重開；否則誠實標 INCOMPLETE。正式 artifact 與 reopen receipt 尚未凍結，且最高 claim 仍限於明示的 simulated teaching ceiling。
