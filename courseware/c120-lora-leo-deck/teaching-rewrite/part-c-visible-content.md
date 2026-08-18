# P064–P099｜Lab C、網站匯入、Workbook 與 transfer 可見內容

用途：接續 P063，把 Lab C 寫成投影、講解、操作均可直接使用的完整
visible-content 規格。核心操作只改 student_policy.py 的 Lab C marked block；
runner、scenario、schema、energy accounting 與網站程式都不在編輯範圍。

## 這一段的證據與呈現契約

- 所有數值參考都來自 experiment-operation-contract.md 的 packaged
  same-scenario deterministic fallback。現場執行後，以 stdout 印出的
  result_path 及其配對 endpoint-replay.json 為準；不可把投影片上的參考數
  字改寫成 fresh run 證據。
- 每一張結果頁都標示：
  SIMULATED TEACHING DATA / NOT LIVE / NOT MEASURED /
  NOT CANONICAL-PARITY-VERIFIED。
- 正文可在 24–28pt；命令與程式碼可在 20–22pt；必要的 identity、provenance
  與狀態標籤不得小於 18pt。標題依原生模板保持清楚的單一主句。
- 每頁各自選用 hero、annotated code、split terminal、prediction lock、
  result ledger、gate、timeline、workbook 或 transfer map；不把頁面排成
  固定問答橫列。深藍、米白、青綠與深紫可作底色和區塊色；文字不用亮橘。
- run 頁只負責把結果產出並保存 result_path，隨即回到證據解釋；不把命令
  本身當成填充內容。整段只有兩張 compact run/receipt 頁：第一輪
  baseline＋candidate，第二輪 revision＋surprise。
- 任何 recovery 都回到 release backup 或最後一個已知正確的 marked block，
  只用明確的 cp／copy 還原；不手改 JSON、不替換 scenario identity、不
  重新調整 surprise。

## P064｜Lab C：佇列要等批次，還是先保住 urgent deadline？

**主視覺：** queue cards 與短 service window 的 hero。左側是 normal 與 urgent
封包排隊，右側是 deadline gate；中間用一條粗線連到 endpoint state ribbon。

**投影主文（24–28pt）：**

> Lab C 研究對象為佇列、批次與 urgent deadline 要怎麼
> 在同一個服務窗口內取捨。policy 的安排會改變封包等待、送出時點、服務結果
> 與 endpoint J；判讀以 service gate 為起點，能量差異隨事件鏈解釋。

**完整句：**「一張卡是有期限的工作：可等待批次，但不可
無限期等待。今天只動一個 urgency 門檻，呈現 policy 如何把 deadline
讀成 SEND_URGENT，總分不構成原因判定。」

**三張可見卡：**

- Queue age：等待多久，表示批次壓力與延遲。
- Deadline／freshness：最晚何時完成，以及資料何時失去用途。
- Endpoint J：本次 endpoint scope 內的累積能量，不可取代 service verdict。

**具體問題：**「如果 bit/J 變高，但 urgent 封包逾期，這一輪是否稱為
成功節能？先指出要看的 gate。」預期回答：不可；先看 service 與 deadline。

**構成約束：**主句放在上方，三張卡各留一個完整句；正文維持 24–28pt，不用公式
堆滿 hero。

## P065｜先讀原始 student_policy.py：原本的門檻怎麼工作？

**主視覺：** annotated code。左側放 Lab C 原始區塊，右側用四段垂直箭頭標出
urgent、pacing、batch、wait 的順序；程式碼 20–22pt。

**投影程式（保持 package token）：**

~~~python
# Lab C: batching versus an urgent deadline
BATCH_SIZE = 3
URGENT_MARGIN_S = 20

if (
    observation.urgent_pending
    and observation.urgent_due_in_s <= URGENT_MARGIN_S
):
    return SEND_URGENT

if observation.steps_since_send < PACE_GAP_STEPS:
    return REST_DURING_GAP

if quality_ready:
    return FLUSH_BATCH if observation.queue_size >= BATCH_SIZE else SEND_ONE
return WAIT
~~~

**原始行為：**

1. 若窗口關閉，較前面的完整 function 先回傳 SLEEP。
2. urgent 仍在等待，且剩餘時間小於等於 20 秒時，先走 SEND_URGENT。
3. 若仍在 pacing gap，回傳 REST_DURING_GAP。
4. 品質可送時，佇列至少 3 張就 FLUSH_BATCH，否則 SEND_ONE。
5. 其他情況回傳 WAIT。

**完整句：**「原始門檻 20 使 urgent branch 在離期限還有較多時間
時就可能介入；這個分支優先於正常 pacing 與 batch，所以我們要觀察它改變
了哪個送出時點，並依 evidence 判定 J 的變化。」

**具體問題：**「當 observation.urgent_due_in_s 小於等於 20 時，原始程式會先
選哪個 action？若 queue_size 已經達到 BATCH_SIZE，還會先 flush 嗎？」預期
回答：先 SEND_URGENT；urgent branch 先返回，尚不會走 flush。

**構成約束：**程式、箭頭與完整中文句分開；不得縮小程式來塞入整個 policy。

## P066｜第一輪 compact run／receipt：baseline → candidate

**主視覺：**上下兩段 terminal ribbon。上段是 untouched baseline，下段預留
P067–P068 的 edit／prediction 後執行 candidate；兩段共用一張 result-path
收據卡，不另開四張命令頁。

**可復原的 release copy 與操作順序：**

POSIX／WSL：

~~~sh
cp student_policy.py student_policy.C-release.py
bash course.sh run --lab C --case baseline
# 完成 P067–P068 後，仍在同一個 package root
bash course.sh run --lab C --case candidate
~~~

Windows：

~~~bat
copy /Y student_policy.py student_policy.C-release.py
course.cmd run --lab C --case baseline
rem 完成 P067–P068 後，仍在同一個 package root
course.cmd run --lab C --case candidate
~~~

**操作句：**「先用 untouched policy 建立 control；完成下一頁的單一 edit
與 prediction 後，只跑同一個 Lab C candidate。每次只抄 stdout 新印出的
result_path，並開啟同一 run 目錄的配對 replay；不猜檔名、不追加測試 run。」

**預期看到：**runner 若通過，stdout 應提供本次 run 的 status、artifact
來源與 result_path；這是 artifact 產生訊號，分類為 coherent simulated result；live measurement 不在此資料類型
結果。baseline 與 candidate 的 deterministic fallback 參考放到 P069。

**遇到 policy 或操作錯誤：**用
cp student_policy.C-release.py student_policy.py；Windows 用
copy /Y student_policy.C-release.py student_policy.py，回到對應 marked
block；保留原始錯誤與已產生的 path，不手改產物。

**構成約束：**命令 20–22pt；兩個 result_path 卡片各只留 case、run identity、
status 與下一步。run 本身不佔教學敘事。

## P067｜第一次 exact edit：URGENT_MARGIN_S = 5

**主視覺：**before／after code zoom。左欄保留原始值，右欄只放唯一改動；下方
用一條因果箭頭接到 urgent send time、delivery 與 endpoint J。

**修改前（原始程式）：**

~~~python
BATCH_SIZE = 3
URGENT_MARGIN_S = 20
~~~

**修改後（exact edit）：**

~~~python
BATCH_SIZE = 3
URGENT_MARGIN_S = 5
~~~

**修改前完整句：**「原始值 20 使 deadline 尚未逼近時就可能打斷 normal
pacing／batch；它是 urgent override 門檻；能量由 state ledger 定義。」

**修改前的具體問題：**「如果門檻保持 20，哪一個 observation 會使 urgent
branch 先於 batch branch 返回？把條件說完整。」

**修改後完整句：**「現在只把 urgent 門檻從 20 改成 5；只有期限更逼近時
才會走 SEND_URGENT，因此我預期 normal pacing／batch 可能多等一段，但是否
因此失去 service 要由 packet 與 deadline evidence 決定。」

**修改後的具體問題：**「改成 5 後，若 urgent 仍然 pending，policy 會立刻
送出，還是先使它等待到剩餘時間進入門檻？接著要看哪兩個 gate？」

**編輯邊界：**BATCH_SIZE、A／B marked block、runner、scenario、schema 與
energy model 都保持原樣；不輸入字串 action，不重排 branch。

**復原卡：**若誤改欄位、縮排或合法 action，POSIX 執行
cp student_policy.C-release.py student_policy.py；Windows 執行
copy /Y student_policy.C-release.py student_policy.py，再只重做本頁
的 exact edit。此操作屬 recovery；實驗案例維持不變。

**構成約束：**before／after 各最多三行程式碼；完整句與問題放在程式碼下方，正文
24–28pt。

## P068｜candidate run 前的 prediction lock

**主視覺：**prediction lock。中央是一個 margin 5 門檻，四周放 queue、
urgent timing、service／deadline、state／J 四個可觀察證據卡。

**先寫在 workbook 的完整句：**

> 我把 URGENT_MARGIN_S 從 20 改成 5，預測 urgent override 會較晚觸發；這
> 可能減少較早的 wake／TX energy，卻可能使 urgent packet 更接近 deadline，
> 甚至失去 delivery。candidate run 要用 packet、service、deadline 與 state
> ledger 逐段檢驗這個預測。

**完整句：**「預測以 mechanism 與 evidence 欄位定義，非 KPI 押注；先寫出門檻改動，接著指出它
可能改變哪個 action，並指定事件 evidence 的位置。若結果相反，保留該 record 並解釋
中間狀態，不為了使答案好看而改預測。」

**預測欄位：**

- urgent send time：可能較晚或不再在早期 override。
- queue／packet：可能有較長等待、較少早期送出或更多期限壓力。
- service／deadline：可能維持，也可能因晚送而失敗；不可事先宣稱。
- state／endpoint J：可能少一段早期 TX／wake，也可能因重試或逾期改變。

**具體問題：**「哪一個結果會直接推翻『margin 5 只是省能量』的說法？」
預期回答：required delivery、service 或 deadline 任一 gate 失敗，或事件鏈
顯示差異來源待依事件鏈判定。

**構成約束：**四張證據卡不做四問表；用箭頭把 prediction 接到 P069 的 result
path。

## P069｜第一次 before／after：candidate 的 bit/J 不可跳過 gate

**主視覺：**two-column result ledger。左欄是 baseline（margin 20），右欄是
candidate（margin 5）；中央窄欄固定 scenario、seed、endpoint boundary，
下方放一條 causal sentence。

**packaged same-scenario deterministic fallback 參考：**

| 角色 | URGENT_MARGIN_S | delivered bits | endpoint J | endpoint bit/J | service | deadline |
|---|---:|---:|---:|---:|---|---|
| baseline | 20 | 10,400 | 10.66 J | 975.609756 | PASS | PASS |
| candidate | 5 | 9,600 | 9.74 J | 985.626283 | FAIL | FAIL |

**結果邊界：**「以上是 operation contract 的 deterministic fallback 參考，
屬於 fallback reference；本次 fresh run 的數字；本次必須回到 P066 stdout 指出的 result_path。
兩筆都標示 SIMULATED TEACHING DATA / NOT LIVE / NOT MEASURED。」

**完整因果句：**「在相同 scenario 與 endpoint boundary 下，margin 5
使 urgent override 更晚，參考結果少交付 800 bit、service／deadline 都失敗，
雖然 endpoint J 較低且 bit/J 數字較高；因此成功條件由 service gate 定義；差異來源為晚送造成的
服務 trade-off。」

**具體問題：**「candidate 的 985.626283 bit/J 高於 baseline 的 975.609756，
為什麼仍不可先宣布它比較好？指出被 gate 否決的 evidence。」

**讀法：**依序核對 scenario／policy lineage、packet delivery 與兩個 gate，
最後才讀 endpoint J 和 bit/J。若 result identity 不一致，停止比較，用 release
backup/cp/copy 恢復後重跑同一 case。

**構成約束：**數字表只留七欄；正文與因果句維持 24–28pt，參考標籤可用 18pt。

## P070｜第二次 exact edit：URGENT_MARGIN_S = 30

**主視覺：**revision edit zoom。左邊是 candidate 已凍結前的值 5，右邊是
revision 值 30；右下角以「只准一次 revision」印章收束。

**修改前：**

~~~python
BATCH_SIZE = 3
URGENT_MARGIN_S = 5
~~~

**修改後（exact revision）：**

~~~python
BATCH_SIZE = 3
URGENT_MARGIN_S = 30
~~~

**修改前完整句：**「candidate 的 5 把 urgent override 留到期限更近才
觸發；第一次比較顯示少交付且兩個 gate 失敗，所以這次 revision 只針對
『是否太晚介入』提出修正，不改 batch 或 runner。」

**修改前的具體問題：**「若不改回較早的 urgent 介入，哪一個 packet／deadline
證據最可能繼續暴露服務風險？」

**修改後完整句：**「把 5 改成 30，表示在期限還有較多餘裕時就允許
SEND_URGENT；我預測它可能較早花能量，但有機會使 required packet 在期限前
完成，最後仍須由 revision artifact 驗證。」

**修改後的具體問題：**「較早 SEND_URGENT 如果保住期限，是否自動稱為
最省電？說出還要一起讀的 state／J evidence。」

**復原卡：**若 revision edit 出錯，POSIX 執行
cp student_policy.C-release.py student_policy.py；Windows 執行
copy /Y student_policy.C-release.py student_policy.py，再依 P067 的 exact
edit 重新形成 margin 5，或依本頁重新形成 margin 30。不得直接改 surprise
結果，也不得修改 A／B block。

**構成約束：**同一個 code zoom 不複製 P067 的圖形；用版本標籤與 revision 印章
形成新的閱讀焦點。

## P071｜revision run 前：把「較早介入」寫成條件式預測

**主視覺：**countdown timeline。左側是 margin 5 的晚介入，右側是 margin 30
的早介入；下方以三張 evidence card 連回 packet、service、energy。

**Workbook prediction：**

> 我把 URGENT_MARGIN_S 從 5 改成 30，預測 urgent action 會更早出現，可能
> 增加 TX／wake 或其他 endpoint energy，但也可能使 required packet 在期限前
> 完成。這個預測只有在 delivery、deadline、state ledger 與 endpoint J 一起
> 對得上時才成立。

**完整句：**「revision 保留 candidate 的 failure，並提出
一個有理由的修正，再用同一個 scenario 做第二次受控比較。若 revision 仍失敗，
我們保留它；若 fallback 顯示 gate 通過，也只能說在這個固定條件下通過。」

**具體問題：**「如果 margin 30 的 J 上升，但 deadline 從 FAIL 變 PASS，這
個結果是在否定 revision，還是在顯示 policy 有 service／energy 取捨？」
預期回答：是 trade-off；service gate 具有第一判讀順位，多花的 endpoint J 隨後描述。

**構成約束：**時間線只畫觸發關係，不放任何未由 result_path 支持的時間數值；正文
24–28pt。

## P072｜第二輪 compact run／receipt：revision freeze → surprise

**主視覺：**一條 horizontal lineage ribbon。左端是 margin 30 的 revision
freeze receipt，右端是 policy bytes 不變的 surprise withheld；中間只放兩個
exact command 卡。

POSIX／WSL：

~~~sh
bash course.sh run --lab C --case revision --freeze
bash course.sh run --lab C --case surprise
~~~

Windows：

~~~bat
course.cmd run --lab C --case revision --freeze
course.cmd run --lab C --case surprise
~~~

**完整句：**「先用 margin 30 跑 revision 並 freeze；確認 stdout 的
result_path 與 freeze receipt 後，原封不動沿用這份 policy 跑 surprise。第二
個 case 只做 withheld 檢驗，不新增 edit、不重新調參、不用另一個結果補洞。」

**成功訊號：**兩次 stdout 都應提供各自新的 result_path；revision 應留下
可核對的 freeze lineage，surprise 應回應同一份 policy identity。實際 receipt、
path 與欄位以 package 輸出為準，不在投影片預填檔名。

**快速 run 規則：**命令完成後立刻保存 result_path、開啟配對 replay，接著
跳到 P073–P075 讀證據；命令於本頁完成 receipt，證據解釋接續 P073–P075。

**恢復：**若 revision gate 失敗，用 release backup/cp/copy 回到已知正確
marked block，重新只做 margin 30 的 revision；若 surprise gate 失敗，保留
失敗資訊，不可再改 policy 來洗掉 withheld 結果。

**構成約束：**兩張 command card 各只放一行 run；freeze 與 withheld 以不同節點形
成 lineage，不做上下四欄。

## P073｜before／after／revision：三筆結果要沿同一條因果鏈讀

**主視覺：**三欄 evidence ledger。每欄上方放 policy 值，中間放 service／deadline
徽章，下方放 delivered／J／bit/J；三欄底部共用一個「先 gate、後 J」底座。

**packaged same-scenario deterministic fallback 參考：**

| 階段 | policy | delivered bits | endpoint J | endpoint bit/J | service／deadline |
|---|---|---:|---:|---:|---|
| before／baseline | 20 | 10,400 | 10.66 J | 975.609756 | PASS／PASS |
| after／candidate | 5 | 9,600 | 9.74 J | 985.626283 | FAIL／FAIL |
| revision | 30 | 10,400 | 10.66 J | 975.609756 | PASS／PASS |

**完整句：**「candidate 的 bit/J 雖然數字較高，卻用較少 endpoint
J 交付較少資料並失去兩個 gate；revision 把 urgent margin 拉回 30，在這個
deterministic fallback 中恢復 baseline 的交付與 gate，因此我們解釋的是
『較早介入保住服務』；結論不延伸為『30 永遠最省』。」

**具體問題：**「如果只看三欄的 bit/J，會把 candidate 排在前面；哪一個
service／deadline evidence 必須先把它排除？」

**因果提示：**threshold 只改變 policy branch 的觸發時機；J 的差異要從
urgent send、wake／TX／RX、retry、delivery 與 expiry 事件讀出，不可說常數
直接寫入 J。

**證據標籤：**三欄都是 SIMULATED TEACHING DATA / NOT LIVE / NOT MEASURED /
NOT CANONICAL-PARITY-VERIFIED；本次現場值仍以 P066／P072 result_path 為準。

**構成約束：**三欄數字留白足夠，因果句放在底部長條；不把四階段命令重印。

## P074｜surprise withheld：不重調，使邊界條件資料留下來

**主視覺：** frozen revision card 對上新條件的 withheld card。左側 policy hash
鎖定，右側用紅紫色 gate 表達結果邊界；底部保留一個條件判讀問題。

**surprise 的 deterministic fallback 參考：**

- service：FAIL；deadline：FAIL。
- delivered bits：2,400。
- endpoint J：5.41 J。
- endpoint bit/J：443.622921 bit/J。
- retransmissions：3；expired packets：3。

**完整句：**「surprise 沿用 frozen policy；第三次調參不在規格內；它用同一份
frozen policy 顯示新的 service condition 下只交付 2,400 bit、出現 3 次重傳
與 3 張逾期封包，所以它是在界定 margin 30 的適用邊界。」

**具體問題：**「看到 5.41 J 比 revision 參考值小時，我們要不要再把 margin
改成另一個數字？」預期回答：不要；因為 service／deadline 都 FAIL，先把
withheld 作為適用邊界資料，保存它的 result_path 與 provenance。

**不可下的結論：**不可說 margin 30 在所有窗口都有效，不可說低 J 就等於
成功，不可把 surprise 變成新的 candidate。

**構成約束：**一張 frozen policy 卡與一張 withheld 卡形成對照；條件句用 24–28pt，
數值標籤最低 18pt。

## P075｜Lab C debrief：service／deadline gate 永遠先於 J

**主視覺：** gate-first claim ladder。最上層是 service、deadline、freshness，
中層是 delivered／expired／retry，最下層才是 endpoint J 與 bit/J。

**收束句：**

> margin 5 的 candidate 用較少 endpoint J 卻失去 service 與 deadline；margin
> 30 的 revision 在同一個 deterministic fallback 中恢復交付與兩個 gate，但
> surprise 又暴露新的窗口限制。因此本實驗支持的是「urgent margin 會改變
> deadline／energy trade-off，且效果依 service condition 而定」；結論不延伸為「30
> 永遠最佳」。

**完整句：**「gate 描述工作是否被保住；endpoint J 的變化再由事件鏈
改變。這個順序保護我們不把一個高 bit/J、低 delivery 的結果稱為成功。」

**具體問題：**「哪一筆 withheld evidence 使結論縮小適用範圍？應說出
它的 service、deadline、delivery 或 expiry 欄位；J 單值不足以完成判讀。」

**可見 claim footer：**

SIMULATED TEACHING DATA / NOT LIVE / NOT MEASURED /
NOT CANONICAL-PARITY-VERIFIED

**構成約束：**階梯圖不使用固定提問欄；每層一個完整句，呈現判斷順序。

## P076｜上傳 result.json：網站只驗證、重播、保存比較

**主視覺：**三站 bridge。左：本機 runner 與 stdout result_path；中：Leo
validator／replay；右：Energy Decision Workbook。三站用單向箭頭連接，不
把網站畫成第二個 runner。

**投影主文：**

> 本機 runner 負責產生結果；網站負責驗證、重播與保存比較。上傳屬 artifact import，
> 也不會執行本機 Python 程式。

**完整句：**「在匯入控制項選擇 stdout 印出的 result_path；若畫面
要求 replay，再選同一個 generated run 目錄裡的 endpoint-replay.json。不要
選 policy source，也不要把另一個 case 的 fallback 檔案改名來冒充這次 run。」

**網站的三個 classroom job：**

1. 驗證 schema、scenario identity、units、policy lineage 與 provenance。
2. 把已驗證 events materialize 成 endpoint 時間線 replay。
3. 把 baseline、candidate、revision、surprise 放進可保存、可重開的 workbook。

**具體問題：**「如果把 student_policy.py 直接交給網站，網站是否執行
Python 來判斷結果？」預期回答：不可；Python 只在本機 runner 邊界執行，網站
只接受已產生且可驗證的 result／replay。

**構成約束：**三站各只有一個動詞；主句 24–28pt，identity 小標最低 18pt。

## P077｜匯入先驗證：identity 或 units 不對就 fail closed

**主視覺：**垂直 validation ladder。每一層是一個檢查卡，右側有「通過後才
往下」的青綠閘門；失敗路徑落到原 workbook 不變的深紫卡。

**可見檢查順序：**

1. JSON／檔案大小與 schema、unknown field。
2. scenario ID、scenario hash 與目前 C-120 anchor。
3. runner、upstream、wrapper、lock provenance。
4. lab／case／seed、policy hash、predecessor 與 freeze receipt。
5. units、有限數值、energy breakdown sum consistency。
6. event 時序、packet identity、contact window 與 action legality。
7. claim boundary、endpoint energy scope、replay 與 workbook record。

**完整句：**「網站先證明這筆結果屬於目前 scenario、目前 policy
lineage 與合法 units，才 materialize replay；任何一層失敗，session 與原有
workbook 都保持不變。」

**成功畫面預期：**顯示同一 scenario、case、run identity 與 endpoint replay；
這是 contract validation 結果；資料類型為 coherent simulated result，不承擔 scientific measurement claim。

**具體問題：**「錯誤 scenario 的 result 為什麼不可使網站『猜』它屬於哪個
lab？」預期回答：猜測會破壞 identity 與因果配對，應拒絕並指出 actionable
mismatch。

**恢復：**保留網站錯誤與原始 stdout path；回到 release backup/cp/copy 或
最後一個正確 checkpoint，重新產生合法 pair。不可在瀏覽器補欄位。

**構成約束：**七層梯子比表格更容易投影；錯誤卡用深紅／紫紅底，文字仍保持高
對比與至少 18pt。

## P078｜Replay：使 queue → action → state → packet 回到同一條時間線

**主視覺：**horizontal replay timeline。上排是 queue card，第二排是 policy
action，第三排是 sleep／wake／awake idle／process／TX／RX ribbon，最下排是
attempt、retry、delivered、expired 與 service gate。

**投影主文：**

> replay 不重新執行 policy，也不在瀏覽器推導新的科學數值；它把已驗證的
> event ledger 放回共享 scenario clock，呈現一個 action 如何造成
> state、packet、service 與 endpoint J 的連鎖。

**完整句：**「沿時間線指出 urgent card 何時生成、何時 attempt，接續尋找
它是否 delivered 或 expired；接著對照同一時間帶的 wake／TX／RX 與 endpoint
energy。畫面上的箭頭是讀法；網站不重新計算結果。」

**replay 可看見：**

- queue age、normal／urgent class、deadline 與 freshness。
- policy decision、mode change、state interval、WAKE。
- packet attempt、collision／retry、delivery、expiry。
- service／deadline verdict 與 endpoint energy scope。

**具體問題：**「如果畫面只顯示一個較低的 J，卻沒有 packet delivery 與 service
欄位，是否可把它當成 Lab C 結論？」不可；缺少中間事件就無法完成因果
解釋。

**構成約束：**用一條時間線取代卡片網格；每個事件 token 至少 18pt，主句 24–28pt。

## P079｜Energy Decision Workbook：保存四個角色，不只保存最後一個數字

**主視覺：**workbook spread。左頁是 prediction／edit／run／interpret 欄，右頁
是四筆 endpoint record 的 lineage；使用 tab 色區分 baseline、candidate、
revision、surprise。

**每筆 record 要保留：**

- scenario／result hash、case、seed role、run ID 與 endpoint replay ID。
- policy API、目前與 predecessor policy hash、active block、freeze receipt。
- changed marked line、run result_path、配對 replay 與 fallback／hint provenance。
- units、endpoint energy scope、delivered／expired／retry、service／deadline。
- run 前 prediction、run 後 interpretation、recovery note 與 claim boundary。

**完整句：**「Workbook 把 baseline、candidate、revision 與 surprise
放在同一條 provenance 鏈，使每一筆結果均回到它的 prediction、policy bytes
與 result_path；它保存比較，不替缺失的 evidence 補一個答案。」

**具體問題：**「如果 surprise 沒有通過 service，Workbook 應該刪掉它、改成
成功，還是保留這筆 withheld record？」預期回答：保留原 record，使適用邊界成為
適用範圍的一部分。

**狀態提示：**只有必要 receipt、prediction、result、replay、interpretation
與 recovery 都齊全時，才可能顯示 COMPLETE；缺件就顯示 INCOMPLETE。

**構成約束：**用左右頁的閱讀方向呈現 lineage，不把所有欄位壓成小表格；欄位名
可用 18pt，解釋句維持 24–28pt。

## P080｜保存、關閉、重新開啟：不補造結果

**主視覺：**reopen loop。左側是 Save checkpoint，中央是 Close，右側是
Open／rebind；下方放「same scenario identity」鎖與 COMPLETE／INCOMPLETE
兩個狀態卡。

**操作順序：**

1. 保存 workbook，確認四個 case 的 lineage、prediction、result／replay
   與 claim boundary 都在。
2. 關閉目前頁面，再重新開啟 Energy Decision Workbook。
3. 重新核對 scenario、anchor、policy／predecessor hash 與 endpoint scope。
4. 缺少任何必要 evidence 時，保留 INCOMPLETE；不要手動切成 COMPLETE。

**完整句：**「reopen 重新驗證的是身份與完成度，不會重新執行
student_policy.py，也不會把失敗的 surprise 轉成成功；保存的用途是使分析
能從同一條 evidence chain 繼續解釋。」

**具體問題：**「若重新開啟後只剩 revision result，baseline 或 surprise
的配對 replay 不見了，應該補填數字還是標記缺件並走 recovery？」預期回答：
標記缺件並走 recovery；不可補造數字。

**構成約束：**三站 loop 加兩個狀態卡；不重印命令、不把 reopen 做成下一頁按鈕教學。

## P081｜Transfer 1：智慧農場把 changing window 換成閘道可用時段

**主視覺：**transfer map。左側保留 Lab C 的 queue／urgent／service／J 四個
機制 token，右側映射到田區感測、閘道可用、告警資料與批次上傳。

**可見 mapping：**

| Lab C 機制 | 智慧農場的對應問題 | 要觀察的 evidence |
|---|---|---|
| queue age | 多筆環境資料是否值得等到閘道可用時再送 | 送出時點、交付、過期 |
| BATCH_SIZE | 批次上傳是否減少啟用次數卻造成資料變舊 | queue age、state time、endpoint J |
| urgent margin | 灌溉告警或異常資料離 deadline 多近才優先送 | urgent delivery、deadline、retry |
| service gate | 田區任務是否在規則內完成 | required delivery 與 freshness |

**完整句：**「把 LEO 的 moving service window 換成智慧農場閘道
可用時段，policy 仍然要在資料新鮮度、批次等待、urgent alert 與 endpoint
energy 之間做受控取捨；Lab C 的機制可轉移，這些 transfer 數字尚未量測。」

**具體問題：**「如果批次上傳使 endpoint J 下降，但告警封包過期，應先改
batch，還是先記錄 service gate 失敗？寫出 falsifier。」

**證據邊界：**這一頁是可轉移的機制假說；智慧農場現場量測資料待取得。

**構成約束：**四列 mapping 使用短句；右側另放一張 alert card，避免整頁變成
純表格。

## P082｜Transfer 2：HVAC 的低負載時段也有 queue 與 urgent

**主視覺：**HVAC cycle 圖。上方是低負載／可連線窗口，下方是 normal telemetry
批次與 urgent alarm 兩條路徑；用不同線型而非新增數字。

**完整句：**「HVAC 邊緣感測資料可在低負載或網路較合適的窗口
批次傳送，但溫度異常或設備告警不可因等待 batch 而逾期；因此 urgent margin
是服務規則的旋鈕；energy trade-off 由 endpoint ledger 定義。」

**對應操作語言：**

- normal telemetry：queue → batch → flush。
- urgent alarm：deadline 接近 → SEND_URGENT。
- endpoint ledger：awake idle、wake、process、TX、RX、sleep。
- gate：告警完成與 freshness 先於 bit/J。

**具體問題：**「若把 margin 拉大，告警較早送出但 endpoint J 增加，應如何
寫出不誇大的結論？」預期句型：「在固定的教學條件下，較早介入換取較好的
服務邊界；能量代價仍要以 endpoint ledger 說明。」

**證據標籤：**只有 Lab C packaged fallback 有具體參考數值；HVAC 轉移是
SIMULATED TEACHING DATA 的機制假說；live／measured KPI 待取得。

**構成約束：**兩條路徑與一張 gate 卡；不複製智慧農場的表格版型。

## P083｜Transfer 3：edge device 把同一條因果鏈帶到別的 service window

**主視覺：**edge transfer canvas。中央是一條可重用的因果句，四周放
observation、policy、packet/service、power × time 四個節點；右下角放
可推翻條件。

**可見因果句：**

> 當 edge device 看見 queue、deadline、quality 與可用窗口時，它選擇
> WAIT、SLEEP、SEND_URGENT 或 FLUSH_BATCH；這個 action 改變 state、packet
> 與 service，最後才在宣告的 endpoint scope 內累積 J。

**可轉移場景：**

- 邊緣影像摘要：一般摘要可 batch，安全告警走 urgent。
- 物流追蹤：位置卡可等待連線窗口，異常卡受 deadline 保護。
- 工業 edge：低負載時可休眠，故障事件不可被 batch 門檻吞掉。

**完整句：**「轉移內容為『觀察可用欄位 → 受控
action → 可回放事件 → service gate → endpoint J』這條可檢驗機制。」

**具體問題：**「在該 edge 場景，哪個 held-out condition 會推翻『較大
urgent margin 比較好』？指出窗口、traffic 或 deadline 的一個變化。」

**構成約束：**中央因果句配四個節點，不用 domain comparison table；正文 24–28pt。

## P084｜Transfer／exit：帶走假說與 falsifier，不帶走誇大的 KPI

**主視覺：**exit board。左側是 workbook export／reopen 圖示，中央是
hypothesis card，右側是 falsifier card；底部放一條 claim boundary。

**完整句：**「今天可帶走的是一個可重跑、可回放、可保存的
policy hypothesis：urgent margin 會改變服務與 endpoint energy 的取捨；不可
帶走的是 live 網路、真實裝置或 canonical system energy 的測量宣稱。」

**離場前保存：**

- Lab C baseline、margin 5 candidate、margin 30 revision、surprise 的
  result／replay lineage。
- 每次 edit 前後的完整 prediction、具體問題與 causal interpretation。
- service／deadline 優先的三筆比較、surprise counterexample 與 recovery note。
- website validation、replay、workbook save／reopen 的 provenance。
- 一個 transfer hypothesis 與一個會推翻它的 held-out condition。

**具體問題：**「若下次課程只能多做一件事，應補一個 fresh run，還是先保留
目前 result／replay／workbook 的 identity？為什麼？」預期回答：先保留可追溯
identity，再決定是否另開經核准的實驗。

**可見 claim footer：**

SIMULATED TEACHING DATA / NOT LIVE / NOT MEASURED /
NOT CANONICAL-PARITY-VERIFIED

**構成約束：**三張 exit card 與一條 footer；不使用下一步按鈕或固定問答列。

## P085｜匯入先問來源：actual upload 與 same-scenario fallback 要分開

**主視覺：**雙來源 evidence split。左側是截圖 08 的 accepted upload header，
右側是截圖 03 的 C／surprise same-scenario fallback；中間用一條 identity
gate 連接，兩側都保留 source label。

**投影主文：**

> 這次 browser session 已接受 experiment A／baseline 的實際上傳；接受只表示
> result.json 通過匯入契約。網站內建 fallback 亦用於練習同一套欄位，但不可冒充
> 本機 runner 已經成功執行。

**可見來源卡：**

- 實際上傳：experiment A／baseline；source 顯示「實際執行」；run identity
  是 sha256:e0c3827c2a2479962e5a97aa6f86b00ad1795634f951a2c02a6aa57007bb3bf4。
- 同情境備用資料：Lab C／surprise；source 顯示 same-scenario-fallback；
  可用來練習 replay 與 claim boundary，不改寫本機執行紀錄。
- 兩者都保留 SIMULATED TEACHING DATA / NOT LIVE / NOT MEASURED /
  NOT CANONICAL-PARITY-VERIFIED；browser accepted 不等於 live measurement。

**完整句：**「來源、run identity 與服務依序讀取；檔名相似、案例名稱相同，都不
不取代這個 identity gate。」

**具體問題：**「如果畫面寫著 accepted，這一列是否就能代表全系統量測？」
預期回答：不可；它只代表這個 endpoint result 由網站接受並可回放。

**構成約束：**兩張來源截圖各佔半頁；hash 與 source label 用 18pt 以上，說明句
用 24–28pt。

## P086｜服務先讀：四個摘要欄位的正確順序

**主視覺：**service-first summary。左側放截圖 08 的摘要欄位 crop，右側是由
四個可編輯數字框排成的閱讀順序：服務 → 送達 → endpoint J → endpoint bit/J。

**accepted upload 的可見值：**

- 服務：FAIL。
- 端點能量：6.92 J。
- 已送達資料：4,800 bit。
- 端點 bit/J：693.641618。

**完整句：**「這一筆先以服務 FAIL 作為第一個 gate；接著讀送達
4,800 bit 與 endpoint scope 的 6.92 J，最後才描述 693.641618 bit/J。效率
數字可描述這次 run，不可單獨把失敗改成成功。」

**具體問題：**「如果另一筆只有 3.61 J，但送達資料是 0 bit，哪一個欄位先
否決『省電成功』？」預期回答：服務與已送達資料先否決。

**證據標籤：**這組數值是 08 的 accepted endpoint teaching evidence；資料範圍為
Leo provider 的全系統 consumed energy，現場量測資料待取得。

**構成約束：**左圖、右側四步讀法，不使用一排重複小卡；數值 28pt，欄位標題
18–20pt。

## P087｜選 frame，再同時讀八個 replay 欄位

**主視覺：**frame selector＋八欄 replay field map。上方放截圖 08 的 frame
selector crop；下方以 2×4 的八個可編輯欄位框重畫實際欄位，不把整頁網站截圖
縮成一張。

**八個欄位：**

1. 無線電 Radio：SLEEP、AWAKE_IDLE、PROCESS、TX、RX 或 WAKE。
2. 動作 Action：SLEEP、WAIT、SEND_ONE、SEND_URGENT、FLUSH_BATCH 或 —。
3. 佇列數 Queue count：此 frame 尚待處理的封包數。
4. 累積端點能量 J：run 開始至此 frame 的 endpoint 累積值。
5. 經過時間 Elapsed：endpoint trace 的 elapsed time。
6. 接觸 ID Contact ID：目前相關的 contact identifier。
7. 接觸狀態 Contact：窗口開啟或關閉。
8. 連線品質 Quality：runner 的 ordinal quality_band，不自行換成 dB。

**完整句：**「選擇器改變的是 replay frame；同一個 frame 的八個欄位
要一起讀，因為 action、radio、queue、contact 與累積 J 是同一事件脈絡。」

**具體問題：**「Action 顯示 — 時，是否代表 runner 停止或沒有 radio state？」
預期回答：Action 為「—」表示此 frame 沒有新的 policy action，仍要讀其餘七欄。

**構成約束：**上方一個 selector crop，下方八個短欄位；每欄只留一句用途，正文
可維持 24pt，欄位標籤不小於 18pt。

## P088｜queue 與 packet event：回到摘要的讀法

**主視覺：**queue／event dual trace。左側放截圖 08 的目前佇列與目前封包事件
crop，右側畫 frame n → frame n+1 的兩步追查；用 event id 與 packet id 作
可見錨點。

**可見讀法：**

- 目前佇列：例如 normal-1；空白只表示該 frame 沒有排隊封包。
- 目前封包事件：例如 evt-0000；要和前後 frame 一起切換。
- 追查順序：生成／進 queue → attempt → retry／collision → delivered 或
  expired → service／deadline。

**完整句：**「queue 告訴我們當下還有什麼工作，packet event 告訴
我們這個 frame 發生了什麼；兩者對齊後，摘要中的摘要裡的 delivery 或 expiry
是怎麼形成的。」

**具體問題：**「看到 queue 變空，是否直接判定 packet delivered？」
預期回答：不可；還要找 delivered event 或確認它是否 expired／未送出。

**下一步：**把目前 event 的 frame index 記下，再展開 radio／contact timeline；
不在網站上重新計算 packet 統計。

**構成約束：**左右兩條 trace 取代四欄 card，右側用兩個 frame node 表現前後差異。

## P089｜把 radio／contact timeline 對回 student_policy.py 分支

**主視覺：**上方使用截圖 06 的 timeline strip，下方是 policy branch tree；
每個分支只連到一個 action，箭頭在文字框前停止。

**分支對照：**

~~~text
contact_open = false                         → SLEEP
urgent_pending 且 due_in_s <= URGENT_MARGIN_S → SEND_URGENT
steps_since_send < PACE_GAP_STEPS            → REST_DURING_GAP
quality_ready 且 queue_size >= BATCH_SIZE    → FLUSH_BATCH
quality_ready 但 queue 未達 batch            → SEND_ONE
其餘                                         → WAIT
~~~

**完整句：**「timeline 描述 frame transition；它是把每個 frame 的 contact、
quality、radio state 與 action 排在共享時間軸上，逐條對回
student_policy.py 的 decision branch。」

**具體問題：**「如果畫面現在是 AWAKE_IDLE，是否只看 radio state 就知道
policy 回傳 WAIT？」預期回答：不可；要同時看該 frame 的 Action 欄與前後事件。

**注意：**timeline 的格子長度不代表功率，也不等於 Leo provider 的播放時間；
只用它找 transition、queue、packet 與 service 的因果順序。

**構成約束：**timeline＋branch tree 是一個上下主視覺；程式碼 20–22pt，解釋句
24–28pt。

## P090｜執行紀錄：目前選取狀態；best strategy 另由 gate 定義，source 不可混寫

**主視覺：**ledger focus。左側放截圖 08 的 execution-record crop，右側把一列
放大成六個解讀欄：實驗／案例、顯示、角色、服務、端點能量 J、來源。

**可見欄位解讀：**

- 實驗／案例：這筆屬於哪個 lab／case。
- 顯示：目前只表示畫面選到這一列，不表示最佳策略。
- 角色：基準、候選、修訂或保留情境。
- 服務：每一列都要保留 gate。
- 端點能量 J：同一 endpoint boundary 下比較。
- 來源：實際執行與同情境備用資料分開陳述。

**完整句：**「公平比較至少同時核對實驗、case、role、service、source
與 run identity；目前標記屬選取狀態；排行榜不由此欄位定義。」

**具體問題：**「若同一個 case 的 source 一列是實際執行、另一列是 fallback，
是否只比較 J 而略過來源？」預期回答：不可；來源不同要分開陳述。

**構成約束：**左側證據 crop、右側一列欄位放大；避免把整張 execution table 縮成
不可讀的背景。

## P091｜Leo provider 與 endpoint result：兩層證據不互相冒充

**主視覺：**two-layer boundary。左側使用截圖 04 的 LEO／NTPU provider crop，
右側重畫 imported endpoint result panel；中間用「各自有身份」的分隔線。

**左側 provider 層：**

- LEO／NTPU scenario、TLE source、provider time、contact status、cell／
  frequency／dB 標示。
- 這是場景脈絡；匯入 result.json 不會重新計算或移動波束幾何。

**右側 endpoint 層：**

- source、run identity、summary、replay、ledger 與 endpoint scope。
- 這是本次 runner artifact 的 teaching evidence；不升格為 canonical system
  replay。

**完整句：**「同一頁看見 provider 與 endpoint，不代表兩邊已完成時間
同步或 canonical parity；左邊解釋 opportunity，右邊解釋已產生的 endpoint
result。」

**具體問題：**「Evidence view 的 console 有 503 MODQN bundle request 與
WebGL／GLTF warning，我們是否仍宣稱 provider browser PASS？」預期回答：
不可；保留 provider warning，僅使用已顯示的 endpoint 教學證據。

**構成約束：**左右兩層各一個主視覺，警示使用深紅或深紫，不使用亮橘文字。

## P092｜Workbook：保存 checkpoint、匯出，再重新開啟

**主視覺：**workbook control map。左側使用截圖 05 的 workbook control crop，
右側畫 Save／Export／Reopen／Recover 四個節點，底部放 COMPLETE／
INCOMPLETE 狀態門。

**可見控制：**

- checkpoint 編號與完成度：保存位置；策略分數由 service／J 欄位定義。
- 建立 checkpoint：保存目前可恢復狀態，並記錄 run hash。
- 恢復 checkpoint：回到先前狀態前，先確認新結果是否已匯出。
- 重設本機進度：恢復手段；流程位置由課程 gate 定義。
- 匯出／重新開啟 workbook：保存並重新核對 run identity、source 與完成區段。

**完整句：**「Workbook 保存的是 prediction、result／replay lineage、
source、hash 與恢復狀態；重新開啟要重新核對身份，不會替缺失 evidence 補成
COMPLETE。」

**具體問題：**「畫面顯示 0/10，這代表 policy 表現是零分嗎？」預期回答：
0/10 表示 workbook 完成段落計數；不可替代 service、J 或 bit/J。

**構成約束：**左 crop、右 workflow；控制項文字 18–20pt，解釋句 24pt。

## P093｜拒絕與恢復：session 不變，回 matching evidence

**主視覺：**rejection／recovery fork。左側是格式／identity／immutable duplicate
三種拒絕入口，中央是「原 workbook 保持不變」閘門，右側是 matching
fallback／release backup／重新產生 result path 三條恢復路徑；可放截圖 00 的
備用環境 crop 作為 fallback visual anchor。

**可見失敗與恢復：**

- 格式／schema 拒絕：保留錯誤，回 runner／schema 對照，不改網站紀錄。
- identity／lineage 拒絕：核對實驗、case、scenario、policy、workbook 與 hash。
- 同一 session 的 immutable 重複匯入：停止重按，切回正確 session／workbook。
- fallback 可用：練習欄位與因果鏈，但明示 source；不宣稱本機 runner 已完成。
- provider 503：不影響已接受 endpoint run 的欄位解讀，但不宣稱 provider
  browser PASS。

**完整句：**「fail closed 保護既有 session；錯誤資訊維持可追溯；
保留錯誤與原始 path，回到 matching artifact 或 release backup，用新的
result path 重新建立合法 lineage。」

**具體問題：**「錯誤檔已被拒絕後，最安全的下一步是手改 JSON、換另一個 case
檔名，還是回 matching fallback 並保存 recovery note？」預期回答：回 matching
fallback 或 release backup，保存錯誤與 recovery note。

**構成約束：**三入口 → 一個 fail-closed gate → 三條復原路徑；文字 24–28pt，命令
不在本頁重印。

## P094｜Prepare 的 READY：只記錄看過 terminal receipt

**主視覺：**Prepare state split。左側放截圖 09 的「已就緒」畫面，右側放
READY／fallback 的語義分界；下方用一條 Leo 不執行 Python 的 boundary line
收束。

**可見控制：**

- 開啟 GitHub 課程套件：開啟 repository 取得 runner 與 README；網站不下載、
  不安裝 Python。
- 記錄 READY：只有在自己的 terminal 已完成 setup／verify 且看見
  machine-readable READY 後，才把路徑記到 browser-local progress。
- 記錄備用環境：setup／verify 無法完成，或明確改走 same-scenario fallback
  時，記錄替代路徑。
- 兩個狀態可互相改寫；只能按符合實際情況的一個，並在 workbook 說明誤按
  的修正。

**完整句：**「記錄 READY 只表示操作者已在自己的 terminal 看見
machine-readable READY；Leo 沒有執行或驗證 Python，這個按鈕不會安裝、verify、
run、upload，實驗完成證據由 runner／import／service gate 定義。」

**具體問題：**「按下記錄 READY 後，網站是否已替我們產生 result.json？」
預期回答：沒有；下一步仍要由本機 runner 產生 result，再用匯入 gate 驗證。

**構成約束：**截圖只佔左半，右半放兩個狀態語義；READY 與 fallback 使用不同色帶，
不得用橘色警示字。

## P095｜全站導覽與 fallback loader：按鈕只改畫面狀態

**主視覺：**navigation map。上方是共用導覽列，下方是 fallback loader 入口與
各頁的責任範圍；用短連接線，不做按鈕密集截圖。

**全站可見按鈕：**

- 直接前往操作區：把焦點跳到目前結果工作台；不完成任何 gate。
- 返回 Leo 首頁：離開課程區；不清除本機進度。
- 繁中／EN：只切換畫面語言；不改 artifact、數值或 workbook。
- 準備：開啟套件與 runner 狀態頁；不執行 setup／verify。
- 實驗 A／B／C：切換各自匯入、fallback 與 endpoint replay 工作台；切頁不等於
  完成。
- 證據：查看 provider 脈絡與 endpoint result 邊界；不在瀏覽器重算 runner。
- 學習單：開啟 checkpoint、匯出／重開與 task record；不替操作者填因果解釋。
- 載入此實驗的下一筆備用資料：依實驗順序載入下一個角色／案例；不自動挑
  最佳結果，每次載入都要重核 role 與 service gate。

**完整句：**「這些按鈕改變的是頁面焦點、語言或資料來源選擇，不會
把 runner、provider 與 workbook 的責任混在一起；fallback loader 也只是載入
同情境練習資料。」

**具體問題：**「按實驗 C 之後，是否可跳過 C 的 identity／service gate？」
預期回答：不可；切頁只把工作台帶過來，仍要按來源、hash、服務順序讀。

**構成約束：**導覽列與 fallback loader 分成上下兩段；每個按鈕只留一個動詞與一個
限制句，正文維持 24pt。

## P096｜Task lock 與證據按鈕：檢查課程段落，不代替 runner

**主視覺：**task staircase。左側是「依課程簡報填寫完整證據學習單」與
「開啟 Leo 任務紀錄」，中央是任務 1–10 的解鎖階梯，右側是
「檢查證據並繼續」與「證據已鎖定」兩個 gate。

**可見控制與限制：**

- 依課程簡報填寫完整證據學習單：展開／收合 workbook 主體；不驗證答案。
- 開啟 Leo 任務紀錄：展開／收合十段 task 導覽；未解鎖段落維持 disabled。
- 任務 1–10：回到已解鎖或已完成段落；✓ 表示保存完成，不表示策略 PASS。
- 檢查證據並繼續：檢查目前段落要求，通過後保存並解鎖下一段；不替代
  runner、upload 或人工因果解讀。
- 證據已鎖定：顯示完成段落已保存；不等於 scientific 或 canonical parity
  verification。

**完整句：**「task lock 只控制課程段落是否繼續，檢查證據並繼續
也只檢查該段需要的紀錄；它不會替我們執行 Python、重算 replay 或宣布策略
成功。」

**具體問題：**「某個 task 出現 ✓ 時，是否跳過 service／deadline 的解釋？」
預期回答：不可；✓ 是保存狀態，仍要回到 result、replay 與 workbook 的因果
句。

**構成約束：**階梯、兩個控制按鈕與一條鎖定 gate；不把十個 task 文字縮成一張小表。

## P097｜Provider replay controls：provider frames 與 endpoint result 分層

**主視覺：**replay control strip。上方畫播放／暫停、slider、上一畫面／下一畫面，
下方對照 endpoint frame selector 與 system replay timeline toggle；兩條時間軸
用不同色線。

**可見控制：**

- 播放結果／暫停重播：播放或暫停 provider system replay；瀏覽器不重算系統。
- system replay slider：直接選 provider replay frame；endpoint replay 具有獨立 frame identity
  selector。
- ←／下一個畫面 →：移動一個 provider frame；不改 policy、result 或 workbook。
- 展開無線電／接觸時間軸：展開每個 endpoint frame 的 elapsed、contact、quality
  與 radio state；用於 frame transition，不表達連續功率。
- 端點重播選取畫面：選 endpoint frame；八個 replay 欄位、queue 與 packet event
  要跟著一起更新。

**完整句：**「provider replay 與 endpoint replay 都可前後移動，
但它們的時間軸不保證同步；標記目前正在播放的層級，再把相應的欄位接回
policy branch。」

**具體問題：**「按 provider 的下一個畫面後，endpoint 的 Action 是否一定同步
改變？」預期回答：不一定；兩層 replay 有各自 frame identity，不可假設同步。

**構成約束：**上方是可操作控制 strip，下方是兩條時間軸邊界；不使用密集網站截圖。

## P098｜current /course：八個 replay 欄位的後四欄

**主視覺：**同一 frame selector 的延續欄位圖；左側保留 frame identity，右側用四個大欄位呈現來源、值型態、作用、成功變化與失敗不變項。

**欄位解釋：**

- Elapsed／經過時間：來源為 endpoint trace；值是時間；作用是排序 frame 與事件；成功切換 frame 後更新，selector validation failure 時維持原 frame。
- Contact ID／接觸識別碼：來源為 contact trace；值是字串識別碼；作用是對齊服務窗口；成功切換 contact 後更新，identity failure 時維持原 contact。
- Contact／接觸狀態：來源為 contact event；值是開啟／關閉布林狀態；作用是判讀 action legality；成功切換 frame 後更新，event failure 時維持原窗口狀態。
- Quality／連線品質：來源為 runner quality trace；值是 ordinal quality_band 分類；作用是判讀 quality_ready；成功切換 frame 後更新，field validation failure 時維持原 quality 分類。

**完整句：**「Elapsed、Contact ID、Contact 與 Quality 屬於 endpoint frame context；它們共同界定事件順序、窗口身份、合法 action 與 quality_ready。」

**具體問題：**「Quality 欄位顯示 ordinal quality_band 時，資料單位與判讀限制為何？」預期回答：它是分類值，不換算 dB；來源或 frame identity 不成立時，原 frame 與 workbook 維持。

**構成約束：**四個欄位各以中文名稱、來源、值／單位、作用、成功變化與失敗不變項呈現；英文欄位不單獨形成欄位牆。

## P099｜current /course：控制項的讀寫、成功變化與失敗不變項

**主視覺：**四組控制語義圖：Prepare、導覽／fallback、Workbook、Replay／Task；每組同時標記動作、讀取／寫入資料、成功後畫面狀態與驗證失敗時維持的資料。

**Prepare：**

- 開啟 GitHub 課程套件：讀 repository／README，寫 browser focus；成功開啟套件，失敗維持 Prepare 狀態。
- 記錄 READY：讀 terminal machine-readable READY receipt，寫 browser-local status；成功顯示已就緒，失敗維持原 status。
- 記錄備用環境：讀 fallback choice，寫 browser-local source；驗證失敗時維持原 source。

**導覽與 fallback：**

- 直接前往操作區、返回 Leo 首頁、繁中／EN：讀 navigation state，寫 focus／language；成功更新畫面，失敗維持目前頁。
- 準備、實驗 A／B／C、證據、學習單：讀 section state，寫 route；成功切換工作台，失敗維持 current section。
- 載入下一筆備用資料：讀 experiment order，寫 selected fallback；identity 不符時維持原 result。

**Workbook：**建立存檔點與恢復存檔點讀寫 prediction、hash、role、source 與 checkpoint；成功更新 checkpoint #，驗證失敗維持原 workbook。重設本機進度與復原重設讀寫 local progress；成功改變本機紀錄，失敗維持原 progress。匯出學習單與重新開啟學習單讀寫 workbook lineage；identity 不符時維持原 workbook。

**Replay 與 Task：**播放結果、暫停重播、slider、上一畫面、下一個畫面讀 provider frame sequence，寫 playback cursor；成功更新 provider frame，失敗維持原 cursor。endpoint selector 與無線電／接觸時間軸讀 endpoint frames，寫 selected frame／toggle；成功更新八欄、queue、event，失敗維持原 frame。任務 1–10、檢查證據並繼續、證據已鎖定讀 task evidence，寫 completion／lock；條件不足時維持原 task 與 workbook。

**完整句：**「每個控制項均有明確的 read／write boundary；畫面狀態更新不改寫 runner artifact、provider identity、endpoint result 或既有 workbook。」

**具體問題：**「檢查證據並繼續的成功變化與失敗不變項為何？」預期回答：成功保存目前段落並解鎖下一段；條件不足時，原 task、原 evidence 與原 workbook 維持。

**構成約束：**每個控制項保留中文名稱、動作、讀寫資料、成功變化與失敗不變項；控制項狀態不升格為 scientific parity 或策略 verdict。

## 編寫自檢（不投影）

- 頁數：P064–P099，共 36 頁；兩張 compact run／receipt，沒有用四張命令頁
  延長內容。
- 禁字：正文使用「學員」；唯一保留的指定檔名 token 是 student_policy.py。
- 時間標籤：沒有 clock 標籤；run 頁只說「一頁快速 run」與下一個
  evidence checkpoint。
- 命令：只列 Lab C contract 的四個 exact case 命令與 release backup 的
  cp／copy；沒有新增 runner、網站執行或資料加工命令。
- recovery：所有復原都回到 release backup 或明確 marked block；不手改 JSON、
  不替換 identity、不為 surprise 重調。
- 視覺：每頁都有主視覺標註且版型輪替；正文 24–28pt、命令 20–22pt、最小
  18pt；沒有亮橘文字。
- 證據：所有數值均明示為 operation contract 的 deterministic fallback
  reference，現場結果一律要求回到 stdout result_path，並保留 simulated／
  not-live／not-measured claim ceiling。
- current controls：09 的 READY 只表示 browser-local operator record；備用
  環境、全站導覽、fallback loader、task lock、證據按鈕、provider replay
  controls、checkpoint／reset／undo／export／reopen 均分頁解釋；P098／P099
  補上欄位與控制項的 read／write、值型態、成功變化與失敗不變項。

## 來源（給 builder／審查者，不直接當頁腳）

- teaching-rewrite/course-story-contract.md：Lab C 三段 mission、result.json
  匯入邊界、網站驗證／重播／保存與 visible-slide rule。
- teaching-rewrite/experiment-operation-contract.md：Lab C exact edit、兩輪
  case 順序、exact commands，以及 baseline／candidate／revision／surprise 的
  deterministic fallback 結果。
- docs/sdd/C120-LORA-LEO-COURSE-INTEGRATION-SDD.md：Lab C policy API 與
  urgent branch、freeze／withheld、import validation、endpoint replay、
  workbook v3 與 smart-farm／HVAC／edge transfer 方向。
- evidence/browser-field-inventory-20260811/field-interpretation.md 與
  screenshots 00–09：current /course source／gate／hash、READY、service-first、
  八欄 replay、queue／event、timeline、ledger、provider boundary、workbook
  與拒絕／恢復可見欄位。
