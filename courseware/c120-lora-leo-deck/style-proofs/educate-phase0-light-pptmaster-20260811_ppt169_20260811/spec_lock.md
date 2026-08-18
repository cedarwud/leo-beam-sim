<!-- ppt-master-schema: spec-lock/v1 -->
# Execution Lock

## canvas
- viewBox: 0 0 1280 720
- format: PPT 16:9

## communication
- primary_language: zh-Hant-TW
- audience: C-120 course instructors, novice learners, and the deck owner reviewing visual feasibility
- objective: Demonstrate a polished light Educate-template deck while enabling learners to trace one policy choice through mechanism, service, endpoint energy, and a bounded claim.
- core_message: A policy is valuable only when its service and endpoint-energy evidence survive the stated gate.
- consumption_mode: presentation

## mode
- mode: custom
- mode_behavior: Advance in three proof acts—mechanism, conditional decision, and interpretation—so each page answers one question and hands a visible evidence chain to the next.

## visual_style
- visual_style: custom
- visual_style_behavior: Preserve the inherited Educate identity and generous white field; use one oversized editable relationship, asymmetric scale contrast, pale overlapping semantic fields, thin navy connectors, and small saturated focal marks. Navy is ink/hairline/compact index only; no large dark fill, dashboard sidebar, equal-weight card grid, full-width filled rail, or decorative shadow stack.

## colors
- background: #FFFFFF
- secondary_background: #F4F7FB
- primary: #35377F
- deep_ink: #17223B
- accent: #28B8C7
- secondary_accent: #9B79D0
- energy: #F4B942
- risk: #EA6A5A
- service: #4EA978
- body_text: #17223B
- light_cyan_field: #E9F7F8
- light_violet_field: #F2ECFA
- light_energy_field: #FFF5D6
- light_risk_field: #FCE9E6
- light_service_field: #E9F6EF
- outline: #C7D1E3

## typography
- font_family: Times New Roman, DFKai-SB, 標楷體, serif
- title_family: Times New Roman, DFKai-SB, 標楷體, serif
- body_family: Times New Roman, DFKai-SB, 標楷體, serif
- body: 32
- title: 37.33
- subtitle: 32
- annotation: 20
- footnote: 14

## icons
- library: none
- inventory: none

## images
- image1: images/image1.png | source=user | pattern=Full-canvas inherited Master field | crop=adaptive
- image2: images/image2.png | source=user | pattern=Full-width inherited Master and Layout footer strip | crop=adaptive
- image3: images/image3.png | source=user | pattern=Top-right inherited Master logo | crop=adaptive

## page_rhythm
- P01: dense
- P02: dense
- P03: breathing

## pptx_structure
- mode: structured
- template_reuse_scope: layout
- template_adherence: strict

## pptx_masters
- master_01: slideMaster1

## pptx_layouts
- layout_01: master_01 | 標題投影片 | template:001_cover
- layout_02: master_01 | 標題及物件 | template:002_ending
- layout_03: master_01 | 兩項物件 | template:layout_layout_03
- layout_04: master_01 | 比對 | template:layout_layout_04
- layout_05: master_01 | 只有標題 | template:layout_layout_05
- layout_06: master_01 | 空白 | template:layout_layout_06
- layout_07: master_01 | 含標題的內容 | template:layout_layout_07
- layout_08: master_01 | 含標題的圖片 | template:layout_layout_08
- layout_09: master_01 | 標題及直排文字 | template:layout_layout_09
- layout_10: master_01 | 直排標題及文字 | template:layout_layout_10

## page_pptx_layouts
- P01: layout_05
- P02: layout_05
- P03: layout_05

## page_layouts
- P01: layout_layout_05
- P02: layout_layout_05
- P03: layout_layout_05

## forbidden
- `mask`, `<style>`, `class`, external CSS, `<foreignObject>`, `textPath`, `@font-face`, `<animate*>`, `<set>`, `<script>` / event attributes, `<iframe>`
- HTML named entities in text; write typography as raw Unicode and escape XML reserved characters
