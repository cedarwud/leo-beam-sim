P064｜Lab C：資料等待、期限與耗能的取捨
Lab C 以同一個服務窗口串起佇列、批次、急件、完成期限與端點能量。判讀順序由工作是否完成、期限是否通過、送達資料與端點 J 組成。

P065｜原始程式：門檻與分支的判斷順序
原始 student_policy.py 由窗口、急件、節奏、批次與等待分支組成。每個分支的中文作用、輸入條件與返回 action 都在頁面上對應。

P066｜第一輪 run：baseline 與 candidate 的檔案收據
baseline 使用原始 policy 建立比較 control，candidate 使用 margin 5 的 policy 產生第二筆 result。每條命令都關聯 result.json、事件 replay 與下一階段的判讀位置。

P067｜exact edit 1：急件門檻由 20 秒改為 5 秒
URGENT_MARGIN_S 定義急件距離期限的剩餘秒數門檻；唯一修改由 20 改為 5。修改前後的完整句、具體問題、action timing 與 service 欄位形成同一條因果鏈。

P068｜margin 5：四個可觀察欄位的預測
margin 5 的預測連接 action 時點、佇列與封包、服務／期限以及端點 J。每個欄位都標出來源、值型態或單位、作用與 run 後判讀。

P069｜baseline 與 candidate：gate-first 的比較
兩筆 deterministic fallback 來自同一情境與固定 operation contract。服務、期限、送達資料、端點能量與效率都有中文欄名、單位、來源類型與判讀。

P070｜exact edit 2：急件門檻由 5 秒修訂為 30 秒
revision 將門檻由 5 改為 30，保留 candidate 的失敗紀錄並改變 urgent action 的觸發時點。修改前後的完整句與問題連接 deadline、送達資料與端點 J。

P071｜margin 30：修訂後的受控預測
margin 30 的預測描述較早 urgent action、required packet、deadline 與端點能量的方向。結果判讀以 service、delivery、state ledger 與 endpoint J 的共同 evidence 定義。
