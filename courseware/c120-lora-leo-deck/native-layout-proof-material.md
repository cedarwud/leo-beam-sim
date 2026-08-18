# C-120 native-layout proof content

## 1. LoRaEnergySim × 智慧節能與物聯網應用

從 policy 變更，看見 service 與 endpoint energy 的因果。

## 2. 節能不是只看功率變小

主因果鏈：policy 選擇 → radio state → power × time → endpoint J → service 結果。

- 傳送、等待、批次與休眠會改變 radio state 的停留時間。
- 功率乘上時間才累積為能量；只比較瞬時功率不足以判斷節能。
- service、deadline 或 freshness 沒有守住時，較低能量不能直接稱為較好。

## 3. LEO 只提供會改變的服務窗口

課程核心是 LoRa endpoint 的 policy、queue、radio state 與 energy evidence。
LEO 只把「現在可傳、稍後變差、窗口關閉」具體化，讓等待或立即行動產生可見後果。
同一套因果語言可以移轉到智慧農場、HVAC、edge inference 與物流感測。

## 4. 先跑基準，再只改一個 policy block

1. 驗證環境：`bash course.sh verify`
2. 執行基準：`bash course.sh run --lab A --case baseline`
3. 只修改 `student_policy.py` 的 `lab-a-pace-rest` marked block
4. 執行並凍結 candidate：`bash course.sh run --lab A --case candidate --freeze`

每次執行前先留下對 queue、service、state duration 與 endpoint energy 的預測；執行後再用 result 驗證或反駁。

## 5. 公式把操作連到證據

LaTeX source：

`E_{\mathrm{endpoint}} = \sum_s P_s t_s`

`\eta_E = \frac{D_{\mathrm{delivered}}}{E_{\mathrm{endpoint}}}`

第一式把每個 radio state 的功率與停留時間累積成 endpoint energy；第二式只在 delivered-data 與 energy boundary 相同時才可比較。

## 6. 一筆 result，先看證據鏈

- Identity：scenario、run、policy lineage 是否一致？
- Service：必要傳輸、deadline、freshness 是否守住？
- Mechanism：queue、packet/retry、radio-state duration 如何改變？
- Energy：哪一段 power × time 造成 endpoint J 的差異？
- Interpretation：結果支持、反駁，還是證據不足？

此 proof 不放未凍結 KPI。第六頁使用 2026-08-11 已驗證的 server preview 匯入畫面；它不是 Windows 原生執行證據。
