# `/course` 欄位解讀契約

> Browser evidence captured from `http://120.126.151.102:4191/course` on
> 2026-08-11 (Asia/Taipei). This file freezes the teaching interpretation for
> the direct-teaching deck. Values shown by the site are simulated teaching
> evidence, not live or measured data.

## 教學順序

匯入或 fallback 後，不先比較 `bit/J`。固定順序是：

1. 先確認來源、實驗、案例與 SHA-256 身分。
2. 再看 `服務` 是否 PASS；Lab C 另看 deadline gate。
3. 服務條件成立後，才比較端點能量、已送達資料與端點 `bit/J`。
4. 用 replay frame、佇列、封包事件與時間軸解釋差異如何形成。
5. 最後把結果放回執行紀錄，與基準、候選、修訂、保留情境公平比較。

低能量或高 `bit/J` 不能自行推導為較好的策略。若服務失敗、資料未送達、
封包逾期或比較對象不同，效率數字不能單獨決定結論。

## 0. 全站導覽與 Prepare 按鈕

### 共用導覽

| 按鈕／連結 | 功能 | 不會做什麼 |
|---|---|---|
| `直接前往操作區` | 跳過頁首，將焦點移到目前頁面的結果工作台 | 不會完成任何 gate，也不會載入結果 |
| `返回 Leo 首頁` | 離開課程操作區，回到 Leo 首頁 | 不會清除本機進度 |
| `繁中`／`EN` | 切換畫面語言 | 不會改變 runner artifact、數值或 workbook 內容 |
| `準備` | 開啟套件取得與 runner 狀態記錄頁 | 不會執行 setup／verify |
| `實驗 A／B／C` | 開啟各實驗的匯入、fallback 與 endpoint replay 工作台 | 切頁不等於完成該實驗 |
| `證據` | 查看 Leo provider 脈絡與已匯入 endpoint result 的證據邊界 | 不會在瀏覽器重新計算 runner 或波束幾何 |
| `學習單` | 開啟 checkpoint、匯出／重開、任務紀錄與 provider replay | 不會自動替操作者填入因果解釋 |

### Prepare 頁

| 欄位／按鈕 | 按之前 | 按下後 | 目的與限制 |
|---|---|---|---|
| `開啟 GitHub 課程套件` | 尚未取得或要核對指定 release | 開啟套件 repository | 取得 runner 與 README；網站本身不下載、不安裝 Python |
| `目前狀態：尚未記錄` | 還沒有在此 browser session 宣告 runner 路徑 | 只是一個初始狀態 | 不代表 setup 失敗，也不代表 fallback 已啟用 |
| `記錄 READY` | 已在自己的終端完成 setup／verify，且真的看見 machine-readable `READY` | 狀態變為 `已就緒`；頁首明示「Leo 沒有執行或驗證 Python」 | 把環境路徑寫入本機進度，讓後續知道應使用實際 runner。它不是安裝、verify、run 或結果上傳按鈕，也不是實驗完成證據 |
| `記錄備用環境` | setup／verify 無法完成，或課堂明確改走 same-scenario fallback | 狀態變為 `備用環境`，後續仍須通過相同嚴格 gate | 記錄替代路徑，使課程能繼續練習解讀；不可冒充本機 runner 已成功，也不會自動載入 A／B／C 結果 |

`記錄 READY` 與 `記錄備用環境` 目前可互相改寫 runner 狀態；教學上只能按符合
實際情況的一個。若誤按，先改回正確狀態並在 workbook 說明，不把狀態切換當成
新的實驗證據。

## 1. 匯入區與 gate

| 畫面欄位 | 如何讀 | 不能推論什麼 | 操作後續 |
|---|---|---|---|
| `選擇執行器產生的 result.json` | 選擇本機 runner 產生的單次結果檔 | 選到檔案不等於已通過驗證 | 看下方匯入狀態，不要直接跳到數值卡 |
| `格式、識別與前後關聯驗證` | schema、實驗／案例身分與 lineage 都要通過 | 只符合 JSON 語法不代表可匯入 | 失敗時保留原工作簿，不用錯誤檔覆蓋既有紀錄 |
| `匯入狀態` | 顯示尚未匯入、成功或拒絕原因 | 不代表策略優劣 | 成功後逐項核對實驗、案例、來源與 hash |
| `已接受：實驗／案例` | 這一筆結果被歸到哪個實驗與案例 | 不能只靠檔名判斷內容 | 與剛執行的命令及預期案例交叉核對 |
| `實際執行` | 來源是上傳且通過驗證的 runner 結果 | 不等於 live、measured 或全系統資料 | 把它當本次 endpoint run 的證據 |
| `同情境備用資料` | 來源是網站內建、同一教學情境的 fallback | 不可冒充本機 runner 已成功執行 | 可先練習解讀；之後要用實際 run 重做驗證 |
| `sha256:…` | 此次匯入內容的不可混淆 run identity | 相同案例名稱不代表內容相同 | 報告與 workbook 引用 hash，避免拿錯 run |
| `載入此實驗的下一筆備用資料` | 依實驗既定順序載入下一個角色／案例 | 不代表自動挑出最佳結果 | 每載入一筆就核對角色與服務 gate |

### 已驗證的上傳行為

- `courseware/lora-energy-lab-fresh-run-A-baseline-result.json` 在本次乾淨的
  browser session 中通過驗證，顯示為 `實驗 A／baseline · 實際執行`。
- 畫面 run identity 為
  `sha256:e0c3827c2a2479962e5a97aa6f86b00ad1795634f951a2c02a6aa57007bb3bf4`。
- 匯入後顯示 `服務 FAIL`、`6.92 J`、`4800 bit`、
  `693.641618 bit/J`。這四個值描述同一個 endpoint run。
- 同一 session 內對已匯入的 immutable 實驗／案例重複匯入時，網站會拒絕，
  且不修改既有 session。恢復方式是確認正確 workbook／session 與 lineage，
  不是持續重按上傳。

## 2. 結果摘要

| 畫面欄位 | 定義與讀法 | 教學判斷 |
|---|---|---|
| `服務` | 此 run 是否滿足該案例的服務條件 | 第一個 gate。FAIL 時先找未送達、逾期或接觸窗原因 |
| `端點能量` | endpoint radio／processing 邊界內的累積能量，單位 J | 不是衛星、波束或全系統能量 |
| `已送達資料` | 在此 run 中成功送達的資料量，單位 bit | 能量很低但 0 bit 不構成節能成功 |
| `端點 bit/J` | 已送達資料除以端點能量 | 服務條件成立後才用來比較；不是唯一評分 |

建議口語順序：

> 這一筆先看服務是否成立；再看送達多少資料、用了多少端點能量；最後才問每焦耳
> 換到多少 bit。若服務失敗，bit/J 只能描述這次 run，不能宣告策略較好。

## 3. Replay 畫面選擇器

`端點重播 · 選取畫面` 的每個選項包含 frame 編號、總 frame 數與 endpoint
經過時間，例如 `1 / 56 · 0s`。

- 同一秒可能有多個 frame，因為一個時間點可以依序發生佇列、策略、radio 或
  封包事件。
- frame 是事件重播索引，不是固定取樣率的連續功率曲線。
- 改變 frame 後，下面八個狀態欄、目前佇列與目前封包事件都要一起讀。

## 4. Replay 的八個狀態欄

| 欄位 | 如何讀 | 常見誤讀 |
|---|---|---|
| `無線電` | 當下 radio state；可見 `SLEEP`、`AWAKE_IDLE`、`PROCESS`、`TX`、`RX`，模型亦可能產生 `WAKE` | 不是策略動作名稱，也不是平均功率 |
| `動作` | policy 在該事件選擇的 action，如 `SLEEP`、`WAIT`、`SEND_ONE`、`SEND_URGENT`、`FLUSH_BATCH`；`—` 表示該 frame 沒有新的 policy action | `—` 不等於模擬停止 |
| `佇列數` | 該 frame 尚待處理／傳送的封包數 | 不能只看最終值推回中間是否塞車 |
| `累積端點能量 J` | 從 run 開始累積到該 frame 的 endpoint 能量 | 不是當下瞬時功率，也不是全系統能量 |
| `經過時間` | endpoint trace 的 elapsed time | 不一定與 Leo provider 畫面的播放時間同步 |
| `接觸識別碼` | 目前相關的 contact id，例如 `contact-a`；`—` 表示沒有 contact | 不是衛星或波束 ID |
| `接觸狀態` | 接觸窗為開啟或關閉 | 開啟不保證品質足夠，也不保證已送達 |
| `連線品質` | runner 的 ordinal `quality_band` | 不是 dB；在契約凍結前不得自行宣告數值範圍 |

## 5. 目前佇列與目前封包事件

- `目前佇列` 列出當下仍排隊的 packet id，例如 `normal-1`。空白狀態代表該
  frame 沒有排隊封包。
- `目前封包事件` 列出該 frame 對應的 event id，例如 `evt-0000`。應配合
  frame 前後切換，確認封包何時進入佇列、何時嘗試送出，以及是否送達或逾期。
- 這兩區的用途是回答「摘要數字如何形成」，不是再做一次排名。

## 6. 無線電／接觸時間軸

展開後，每一格對應一個 replay frame，並顯示 frame、elapsed time、contact
id、接觸開關、品質與 radio state。

- 用它找出 `SLEEP → AWAKE_IDLE → PROCESS → TX → RX` 等狀態轉移。
- 將 `student_policy.py` 的條件分支與實際狀態轉移對上：何時等、何時睡、何時
  傳送、何時批次 flush。
- 它不是連續功率圖，也不能從格子的長度推算功率。

## 7. 執行紀錄

| 欄位 | 如何讀 |
|---|---|
| `實驗／案例` | 這一列屬於 A、B 或 C 的哪個 case |
| `顯示` | `目前` 只表示畫面選到這一列，不表示最佳策略 |
| `角色` | `基準`、`候選`、`修訂` 或 `保留情境` |
| `服務` | 各 run 的服務 gate；比較時不能略過 |
| `端點能量 J` | 相同 endpoint 邊界下的累積能量 |
| `來源` | `實際執行` 或 `同情境備用資料`，兩者要分開陳述 |

公平比較最少要同時核對：實驗、case、role、service、source 與 run identity。

## 8. 證據頁的兩層邊界

頁面呈現的因果鏈是：

`LEO 波束情境 → 接觸／品質 → action → queue／radio → service／endpoint J`

- 左側 Leo provider 是獨立運作的場景脈絡。匯入 `result.json` 不會重新計算
  或移動波束幾何。
- provider 可見 scenario、TLE source、provider time、contact status，以及場景內
  的 cell／frequency／dB 標示；這些不等於匯入的 endpoint 結果。
- 右側 imported result 才是本次 source、run identity、摘要、replay 與 ledger。
- 兩邊都存在不代表已完成時間同步或 canonical parity 驗證。

本次檢查時，Evidence view console 有 MODQN provider bundle 的 `503` request
錯誤，另有 WebGL／GLTF warnings。因此目前只能使用已顯示的 endpoint 教學證據，
不可把 provider view 宣告為 console-clean 或 browser PASS。

## 9. Workbook 控制與狀態

| 控制／欄位 | 用途 | 注意事項 |
|---|---|---|
| checkpoint 編號與百分比 | 顯示目前保存位置與完成度 | 不是策略分數 |
| 建立 checkpoint | 保存目前可恢復狀態 | 重要比較後再建立，並記錄 run hash |
| 恢復 checkpoint | 回到先前保存狀態 | 先確認要保留的新結果是否已匯出 |
| 重設本機進度 | 清除這台裝置的 local progress | 屬於恢復手段，不是一般下一步 |
| 匯出 workbook | 下載可保存／轉移的學習紀錄 | 匯出後核對檔名與完成區段 |
| 重新開啟 workbook | 將先前匯出的紀錄載回 | 載入後仍要核對 run identity 與來源 |
| `已匯出`／完成區段 | 顯示 workbook 保存與段落完成狀態 | `0/10` 等計數不代表實驗表現 |

### Workbook 內的其餘按鈕

| 按鈕／控制 | 功能 | 使用時機與限制 |
|---|---|---|
| `依課程簡報填寫完整證據學習單` | 展開／收合 workbook 主體 | 只控制顯示，不會驗證答案 |
| `開啟 Leo 任務紀錄` | 展開／收合十段任務導覽 | 未解鎖段落會維持 disabled；不能跳過前置 evidence |
| 任務 1–10 按鈕 | 回到已解鎖或已完成的任務 | `✓` 表示該段保存完成，不表示策略 PASS |
| `檢查證據並繼續` | 檢查目前段落要求並在通過後保存、解鎖下一段 | 它檢查課程段落條件，不會替代 runner、upload 或人工因果解讀 |
| `證據已鎖定` | 顯示完成段落已被保存 | 不是 scientific／canonical parity 驗證 |
| `播放結果`／`暫停重播` | 播放或暫停 provider system replay | 只播放 provider 提供的 frames，browser 不重算系統 |
| system replay slider | 直接選擇 provider replay frame | 不是 endpoint replay selector，兩個時間軸不可假設同步 |
| `←`／`下一個畫面 →` | 前後移動一個 provider replay frame | 不會改變 policy、result 或 workbook 判斷 |
| `查看系統層數值證據與試驗紀錄` | 展開／收合 provider 數值與歷次選擇區 | 空白時表示尚無 task replay result，不可自行補數字 |

### 保存與恢復按鈕的精確行為

| 按鈕 | 精確目的 | 風險控制 |
|---|---|---|
| `建立存檔點` | 保存目前可恢復的 browser-local 課程狀態，並增加 checkpoint ordinal | 建議在完成一個可解釋的比較後建立；不能取代外部匯出備份 |
| `恢復存檔點` | 將畫面回到最近一個相符 provider／scenario 的存檔點 | 沒有存檔點時 disabled；identity 不相符時應 fail closed |
| `重設本機進度` | 啟動重設流程，清掉這台裝置的課程進度 | 課程資料本身不被修改；先匯出要保留的 workbook |
| `復原重設` | 在可復原期間取回重設前的 browser-local snapshot | 只在重設後出現；不是長期備份 |
| `匯出學習單` | 下載可重新開啟的 workbook JSON | 匯出後核對 session、provider、scenario、完成段與 run identity |
| `重新開啟學習單` | 選擇先前匯出的 workbook JSON 並驗證後載回 | 不相符檔案應拒絕；不得用手改 JSON 繞過 gate |

Workbook 的 system replay panel 是 provider-only；瀏覽器不會由匯入結果重新計算
Leo 系統。`結果的數值證據` 與 `歷次選擇比較` 要在對應 task replay 有內容後才有
可解讀資料。

## 10. 錯誤與恢復

| 畫面情況 | 解讀 | 恢復動作 |
|---|---|---|
| 格式／schema 拒絕 | result contract 不符 | 保留錯誤文字，回 runner／schema 對照修正，不改網站紀錄 |
| identity／lineage 拒絕 | 實驗、案例、scenario 或前後關聯不一致 | 核對命令、case、workbook 與檔案 hash |
| immutable 重複匯入 | 同一 session 的該實驗／案例已被固定 | 停止重複上傳，切回正確 session／workbook 或依課堂流程重設 |
| fallback 可用 | 可以先演練欄位與因果鏈 | 清楚標記來源；不得聲稱本機 runner 已完成 |
| provider `503` | Leo provider bundle 目前不可完整取用 | 不影響已接受 endpoint run 的欄位解讀，但不可宣告 provider browser PASS |

## 投影片拆分要求

Part C 不得用一張縮小的全頁截圖帶過。至少拆成以下九個教學主視覺：

1. 實際上傳與 fallback 的來源差異。
2. 匯入 gate、accepted identity 與 hash。
3. 服務優先的四項摘要讀法。
4. frame selector 與八個 replay 欄位。
5. queue／packet event 的前後 frame 追查。
6. radio／contact timeline 與 `student_policy.py` 分支對照。
7. ledger 的公平比較與 `目前` 標籤誤讀。
8. Leo provider 與 endpoint result 的證據邊界。
9. workbook 保存、拒絕錯誤與恢復流程。

每張投影片都要直接寫出「這個欄位回答哪個問題」與「下一個操作」，並在 speaker
notes 補上 2–5 句可直接照讀的銜接稿。
