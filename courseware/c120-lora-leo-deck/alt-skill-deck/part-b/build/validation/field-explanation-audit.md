# Part B 欄位與英文術語逐頁 audit

本表是 validation record；欄位解釋已寫入可見頁面，contract source 不嵌入簡報。

| page | unexplained terms before fix | fix / split |
|---|---|---|
| P028 | state、SLEEP、WAIT、WAKE、PROCESS、TX、RX | 每個 state 卡加入中文名稱與作用；補上 interval → power × duration → J 機制；不拆頁。 |
| P029 | scenario、seed、traffic、window、endpoint boundary | 改為 Lab A 機制總覽；固定條件、SLEEP／WAIT 成本與 service／energy 判讀集中於雙卡；不拆頁。 |
| P030 | generated、queue、attempt、retry、delivered、expired | 事件卡補中文名稱、packet outcome 與 service verdict；不拆頁。 |
| P031 | service gate、delivered、deadline、freshness、service_pass | 四段 gate 卡加入中文欄位定義與 endpoint J scope；不拆頁。 |
| P032 | power、W、time、s、state bucket | 座標軸補中文名稱與單位；band 說明 duration 與 bucket 組成 J；不拆頁。 |
| P033 | E_endpoint、P_s、t_s、Σ | 公式後補 P_s／t_s 的中文名稱、單位、scope 與 result artifact 來源；不拆頁。 |
| P034 | η_E、D_delivered、E_endpoint、bit/J | 公式後補分子／分母中文名稱、來源、單位與 service gate 限制；不拆頁。 |
| P035 | SOURCE、MODEL、COURSE、RESULT、provenance | 四層卡改為中文層名＋來源／作用；補 coherent simulated result 分類；不拆頁。 |
| P036 | scenario_id、RUN、REPLAY、WORKBOOK、run_id、units、provenance | 依正式契約重做三卡與一致性 band；分別定義物件、輸入、輸出與限制；不拆頁。 |
| P037 | baseline、control、marked block、policy identity | 三卡列固定條件、唯一修改與觀察輸出；改為正向 baseline 定義；不拆頁。 |
| P038 | changing-service-window、contact_open、quality_band、contact_remaining_s | lead 改為 trace 輸入定義；band 加中文名稱與 seconds 單位；不拆頁。 |
| P039 | REST_DURING_GAP、SLEEP、WAIT、WAKE、awake idle、PACE_GAP_STEPS | 依正式契約改 Lab A 總覽；雙卡列固定條件與唯一修改；不拆頁。 |
| P040 | contact_open、steps_since_send、PACE_GAP_STEPS、REST_DURING_GAP | baseline decision 卡補中文欄位定義、值與分支作用；不拆頁。 |
| P041 | PACE_GAP_STEPS、REST_DURING_GAP、py_compile | 程式卡改為中文名稱＋值；命令卡保留 exact edit／backup／syntax 用途；不拆頁。 |
| P042 | baseline、candidate、hidden、freeze、result_path、replay | 三欄標題加入中文用途；top rule 定義 stdout result_path 與同 run replay；不拆頁。 |
| P043 | identity、result_path、endpoint-replay、claim boundary | 比較卡列來源、數值／單位與 service；band 定義 identity／scope 比較條件；不拆頁。 |
| P044 | awake_idle、sleep、wake、process、tx、rx、energy_breakdown_j | 每個 bucket label 加中文名稱；數值保留 J 單位並連接 REST_DURING_GAP 機制；不拆頁。 |
| P045 | attempted、retransmissions、delivered_bits、expired_packets、service_pass | packet／service 卡改為中文名稱＋值／單位；不以 SEND 次數代替交付；不拆頁。 |
| P046 | freeze、checkpoint、predecessor、active_block_id、receipt | freeze fields 加中文名稱與識別碼性質；移除 identity digest 教學；不拆頁。 |
| P047 | withheld、frozen policy、counterexample、claim ceiling | 卡片補中文定義與 frozen policy 狀態；band 說明適用範圍；不拆頁。 |
| P048 | CONDITION、MECHANISM、EVIDENCE、CLAIM CEILING | 四個流程節點加中文名稱；結論句連接 state、packet／service、J、適用條件；不拆頁。 |
| P049 | quality trace、enter、hold、exit、service window | 改為 service-window transition 總覽；challenge visual 與 gate 卡提供中文定義；不拆頁。 |
| P050 | ENTER_QUALITY、STABLE_STEPS、send_mode_active、SEND_READY | 閾值卡加入中文名稱、值、單位／值域與切換作用；不拆頁。 |
| P051 | EXIT_QUALITY、hysteresis、send-ready | 雙閾值圖與卡片說明 enter／hold／exit 的條件與 mode 作用；不拆頁。 |
| P052 | quality band、STABLE_STEPS、send_mode_active、spike | 兩卡補品質等級、穩定步數與布林 mode 變化；不拆頁。 |
| P053 | Trace A、enter、hold、exit、MODE_CHANGE | prediction band 加中文欄位解釋與填寫來源；不拆頁。 |
| P054 | A predecessor、B hold、Trace A、result_path | baseline decision 卡補固定項與切換條件；evidence 卡保留值／單位／來源；不拆頁。 |
| P055 | ENTER_QUALITY、EXIT_QUALITY、STABLE_STEPS、marked block、py_compile | 程式卡補中文名稱與唯一修改；命令卡分列 backup／compile 用途；不拆頁。 |
| P056 | Trace A baseline、candidate、freeze、Trace B、result_path | 三欄標題加入中文用途；top rule 與 receipt 定義 stdout path／replay；不拆頁。 |
| P057 | quality band、MODE_CHANGE、PACKET_ATTEMPT、service_pass | 因果節點補中文名稱與作用；metrics 卡列值／單位／來源；不拆頁。 |
| P058 | A predecessor、B checkpoint、Trace B entry、receipt identity | 沿用 P046 定義；freeze lineage 卡只呈現三者關係與 entry 條件；不拆頁。 |
| P059 | Trace B、frozen policy、withheld、expired_packets | 卡片補 frozen policy 與 path 來源；result 卡列 expired／service／J 的值與單位；不拆頁。 |
| P060 | too-slow、ping-pong、MODE_CHANGE、retry、transition | 兩種 failure mode 以中文事件序列解釋；band 指定 evidence 欄位；不拆頁。 |
| P061 | hysteresis、Trace A、Trace B、claim ceiling | 流程節點加中文名稱；句型連接 transition、packet／service、J 與條件；不拆頁。 |
| P062 | policy lineage、checkpoint、py_compile、result_path、replay | 復原 lead 與四步 band 改為資料變化敘述；命令卡保留 exact operation；不拆頁。 |
| P063 | RUNNER、VALIDATOR、REPLAY、WORKBOOK、schema、provenance | 流程節點加中文名稱；import rule／band 說明輸入、驗證、回放、寫入與失敗不變資料；不拆頁。 |
