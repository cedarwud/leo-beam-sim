# Omni Scope

Interactive 3D Spatial Visualization — 以國立臺北大學校園為場景的 3D 互動式空間視覺化平台。

---

## 目錄 / Table of Contents

- [繁體中文](#繁體中文)
- [English](#english)

---

# 繁體中文

## 簡介

Omni Scope 是一個基於 Three.js 的 3D 互動場景視覺化專案，以國立臺北大學（NTPU）校園為場景，搭配 UAV（無人機）模型，提供即時的 3D 場景瀏覽與互動控制。

技術架構採用 **React + TypeScript + Vite**，透過 **React Three Fiber** 將 Three.js 整合進 React 生態系，實現宣告式的 3D 場景管理。

## 快速開始

### 環境需求

- **Git LFS** — 本專案使用 Git LFS 管理 3D 模型檔案（`.glb`），必須先安裝才能正確 clone
- **Node.js** >= 18
- **npm** >= 9

### 安裝 Git LFS

3D 模型檔案（共約 17.7 MB）透過 Git LFS 儲存，未安裝 LFS 直接 clone 只會拿到 pointer 檔案，場景將無法載入。

```bash
# macOS
brew install git-lfs

# Ubuntu / Debian
sudo apt install git-lfs

# Windows（已內建於 Git for Windows，若未啟用則執行）
git lfs install
```

安裝後執行一次 `git lfs install` 啟用，之後 clone 即會自動下載 LFS 檔案：

```bash
git clone <repo-url>
```

若已經 clone 但缺少 LFS 檔案，可補拉：

```bash
git lfs pull
```

### 安裝與執行

```bash
# 1. 安裝依賴
npm install

# 2. 啟動開發伺服器（預設 http://localhost:3000）
npm run dev

# 3. 建置生產版本
npm run build

# 4. 預覽生產版本
npm run preview
```

開發伺服器啟動後會自動開啟瀏覽器，伺服器綁定 `0.0.0.0:3000`，同網路的裝置也可透過區域 IP 存取。

### 可用指令

| 指令 | 說明 |
|---|---|
| `npm run dev` | 啟動 Vite 開發伺服器（HMR 熱更新） |
| `npm run build` | TypeScript 型別檢查 + Vite 生產建置 |
| `npm run preview` | 本地預覽 `dist/` 建置產物 |
| `npm run lint` | 執行 TypeScript 型別檢查（不輸出檔案） |

## 專案結構

```
omni-scope/
├── index.html                  # HTML 入口，載入 /src/main.tsx
├── package.json                # 專案設定與依賴管理
├── tsconfig.json               # TypeScript 設定（noEmit，僅型別檢查）
├── vite.config.ts              # Vite 建置設定（alias、dev server、sourcemap）
│
├── public/                     # 靜態資源（Vite 直接複製到 dist/）
│   ├── models/
│   │   └── uav.glb             # UAV 無人機 3D 模型（9.9 MB）
│   └── scenes/
│       └── NTPU.glb            # 國立臺北大學校園 3D 場景模型（7.8 MB）
│
├── src/
│   ├── main.tsx                # 應用程式入口：掛載 React 到 DOM
│   ├── App.tsx                 # 根元件（未來擴充 routing / provider 的掛載點）
│   │
│   ├── config/
│   │   └── ntpu.config.ts      # 集中管理場景設定（觀測站座標、模型路徑、相機參數）
│   │
│   ├── styles/
│   │   └── main.scss           # 全域樣式（CSS reset、全螢幕佈局）
│   │
│   └── components/
│       ├── scene/              # 3D 場景元件
│       │   ├── MainScene.tsx   # 主場景容器：Canvas、相機、燈光、場景組合
│       │   ├── NTPUScene.tsx   # NTPU 校園模型載入與材質處理
│       │   └── UAV.tsx         # UAV 無人機模型載入
│       │
│       └── ui/                 # UI 元件
│           └── Starfield.tsx   # CSS 星空背景動畫
│
└── dist/                       # 建置輸出（.gitignore 忽略）
```

## 技術架構

### 渲染管線

```
index.html
  → src/main.tsx          React 掛載點
    → App.tsx             根元件
      → MainScene.tsx     Canvas + 相機 + 燈光 + 場景組合
        ├── Starfield     CSS 星空背景（純 CSS animation，零 JS 開銷）
        ├── NTPUScene     校園 3D 模型（GLB → MeshStandardMaterial）
        └── UAV           無人機 3D 模型（GLB + SkeletonUtils clone）
```

### 核心技術棧

| 技術 | 版本 | 用途 |
|---|---|---|
| **React** | 19.2 | UI 框架 |
| **TypeScript** | 5.9 | 型別安全 |
| **Vite** | 7.1 | 開發伺服器與建置工具 |
| **Three.js** | 0.180 | WebGL 3D 渲染引擎 |
| **React Three Fiber** | 9.4 | Three.js 的 React 宣告式封裝 |
| **Drei** | 10.7 | R3F 常用工具集（OrbitControls、PerspectiveCamera、useGLTF 等） |
| **Sass** | 1.93 | CSS 預處理器 |

### Three.js 如何運作

本專案透過 **React Three Fiber (R3F)** 將 Three.js 整合進 React：

1. **Canvas** (`MainScene.tsx`) — R3F 的 `<Canvas>` 元件建立 WebGL 渲染器，設定 ACES Filmic 色調映射、抗鋸齒、陰影等。

2. **相機** — 使用 Drei 的 `<PerspectiveCamera>`，初始位置從上方俯瞰（Y=400, Z=500），FOV 60 度，可視範圍 0.1 ~ 10000。

3. **軌道控制** — `<OrbitControls>` 提供滑鼠拖曳旋轉、滾輪縮放、阻尼效果，限制仰角不超過水平面。

4. **燈光系統**：
   - `hemisphereLight` — 天空/地面環境光
   - `ambientLight` — 全域環境補光
   - `directionalLight` — 主方向光（正上方），啟用 4096x4096 陰影貼圖

5. **模型載入** — 使用 Drei 的 `useGLTF` hook 載入 `.glb` 模型，搭配 `<Suspense>` 處理非同步載入狀態。

### 3D 模型

#### 校園場景 — `public/scenes/NTPU.glb`（7.8 MB）

- 國立臺北大學三峽校區的 3D 場景模型
- 載入後自動將 `MeshBasicMaterial` 轉換為 `MeshStandardMaterial`，使其能接受光照與陰影
- 透過 `useGLTF.preload()` 預載入，減少初次渲染延遲
- 設定由 `ntpu.config.ts` 集中管理（路徑、位置、縮放、旋轉）

#### UAV 無人機 — `public/models/uav.glb`（9.9 MB）

- 無人機 3D 模型，使用 `SkeletonUtils.clone()` 處理骨骼動畫的正確複製
- 自帶 `pointLight` 模擬機身燈光
- 同樣透過 `useGLTF.preload()` 預載入

### 設定檔 — `ntpu.config.ts`

所有場景相關參數集中在 `src/config/ntpu.config.ts`：

```typescript
{
  observer: { name, latitude, longitude, altitude },  // 觀測站地理座標
  scene:    { modelPath, position, scale, rotation },  // 校園模型設定
  uav:      { modelPath },                             // UAV 模型路徑
  camera:   { initialPosition, fov, near, far },       // 相機參數
}
```

修改此檔即可調整場景行為，不需要改動元件程式碼。

### 星空背景 — `Starfield.tsx`

- 生成 180 顆隨機分布的星星
- 使用純 **CSS `@keyframes` animation** 處理閃爍效果
- 不使用任何 JS 計時器或 React state 更新，零效能開銷
- 置於 Canvas 後方，透過 `pointer-events: none` 不影響 3D 互動

## 互動操作

| 操作 | 說明 |
|---|---|
| 滑鼠左鍵拖曳 | 旋轉場景 |
| 滑鼠右鍵拖曳 | 平移場景 |
| 滾輪 | 縮放（距離限制 10 ~ 2000） |

## 開發注意事項

- `tsconfig.json` 設定 `"noEmit": true`，TypeScript 僅做型別檢查，實際轉譯由 Vite 處理
- `vite.config.ts` 設定 `@` 別名指向 `src/`，import 時可用 `@/config/...` 等路徑
- `.glb` 模型放在 `public/` 目錄下，Vite 會在建置時直接複製，不經過打包處理

---

# English

## Introduction

Omni Scope is a Three.js-based interactive 3D spatial visualization project featuring the National Taipei University (NTPU) campus as its scene, along with a UAV (drone) model for real-time 3D scene exploration and interactive controls.

The tech stack uses **React + TypeScript + Vite**, with **React Three Fiber** integrating Three.js into the React ecosystem for declarative 3D scene management.

## Quick Start

### Prerequisites

- **Git LFS** — This project uses Git LFS to manage 3D model files (`.glb`). It must be installed before cloning.
- **Node.js** >= 18
- **npm** >= 9

### Installing Git LFS

The 3D model files (~17.7 MB total) are stored via Git LFS. Without LFS installed, cloning will only download pointer files and the 3D scene will fail to load.

```bash
# macOS
brew install git-lfs

# Ubuntu / Debian
sudo apt install git-lfs

# Windows (bundled with Git for Windows; if not enabled, run:)
git lfs install
```

After installation, run `git lfs install` once to activate, then clone as usual:

```bash
git clone <repo-url>
```

If you already cloned without LFS, pull the missing files:

```bash
git lfs pull
```

### Installation & Running

```bash
# 1. Install dependencies
npm install

# 2. Start dev server (default: http://localhost:3000)
npm run dev

# 3. Build for production
npm run build

# 4. Preview production build
npm run preview
```

The dev server auto-opens the browser and binds to `0.0.0.0:3000`, making it accessible from other devices on the same network.

### Available Scripts

| Script | Description |
|---|---|
| `npm run dev` | Start Vite dev server (HMR enabled) |
| `npm run build` | TypeScript type check + Vite production build |
| `npm run preview` | Preview the `dist/` build output locally |
| `npm run lint` | Run TypeScript type checking (no file output) |

## Project Structure

```
omni-scope/
├── index.html                  # HTML entry, loads /src/main.tsx
├── package.json                # Project config & dependency management
├── tsconfig.json               # TypeScript config (noEmit, type-check only)
├── vite.config.ts              # Vite build config (alias, dev server, sourcemap)
│
├── public/                     # Static assets (copied directly to dist/ by Vite)
│   ├── models/
│   │   └── uav.glb             # UAV drone 3D model (9.9 MB)
│   └── scenes/
│       └── NTPU.glb            # NTPU campus 3D scene model (7.8 MB)
│
├── src/
│   ├── main.tsx                # App entry: mounts React to DOM
│   ├── App.tsx                 # Root component (future mount point for routing/providers)
│   │
│   ├── config/
│   │   └── ntpu.config.ts      # Centralized scene config (coordinates, model paths, camera)
│   │
│   ├── styles/
│   │   └── main.scss           # Global styles (CSS reset, fullscreen layout)
│   │
│   └── components/
│       ├── scene/              # 3D scene components
│       │   ├── MainScene.tsx   # Main scene container: Canvas, camera, lights, composition
│       │   ├── NTPUScene.tsx   # NTPU campus model loading & material processing
│       │   └── UAV.tsx         # UAV drone model loading
│       │
│       └── ui/                 # UI components
│           └── Starfield.tsx   # CSS starfield background animation
│
└── dist/                       # Build output (gitignored)
```

## Technical Architecture

### Rendering Pipeline

```
index.html
  → src/main.tsx          React mount point
    → App.tsx             Root component
      → MainScene.tsx     Canvas + camera + lights + scene composition
        ├── Starfield     CSS starfield background (pure CSS animation, zero JS overhead)
        ├── NTPUScene     Campus 3D model (GLB → MeshStandardMaterial)
        └── UAV           Drone 3D model (GLB + SkeletonUtils clone)
```

### Core Tech Stack

| Technology | Version | Purpose |
|---|---|---|
| **React** | 19.2 | UI framework |
| **TypeScript** | 5.9 | Type safety |
| **Vite** | 7.1 | Dev server & build tool |
| **Three.js** | 0.180 | WebGL 3D rendering engine |
| **React Three Fiber** | 9.4 | Declarative React wrapper for Three.js |
| **Drei** | 10.7 | R3F utility collection (OrbitControls, PerspectiveCamera, useGLTF, etc.) |
| **Sass** | 1.93 | CSS preprocessor |

### How Three.js Works in This Project

This project integrates Three.js into React via **React Three Fiber (R3F)**:

1. **Canvas** (`MainScene.tsx`) — R3F's `<Canvas>` component creates a WebGL renderer with ACES Filmic tone mapping, anti-aliasing, and shadow support.

2. **Camera** — Drei's `<PerspectiveCamera>` starts with an overhead view (Y=400, Z=500), 60-degree FOV, with a visible range of 0.1 to 10,000 units.

3. **Orbit Controls** — `<OrbitControls>` provides mouse-drag rotation, scroll zoom, and damping effects, with the polar angle clamped to prevent looking below the horizon.

4. **Lighting System**:
   - `hemisphereLight` — Sky/ground ambient lighting
   - `ambientLight` — Global ambient fill light
   - `directionalLight` — Main directional light (directly above), with 4096x4096 shadow maps

5. **Model Loading** — Drei's `useGLTF` hook loads `.glb` models, paired with `<Suspense>` for async loading states.

### 3D Models

#### Campus Scene — `public/scenes/NTPU.glb` (7.8 MB)

- 3D scene model of the National Taipei University Sanxia campus
- Automatically converts `MeshBasicMaterial` to `MeshStandardMaterial` on load, enabling proper lighting and shadows
- Pre-loaded via `useGLTF.preload()` to reduce initial render delay
- Configuration managed centrally in `ntpu.config.ts` (path, position, scale, rotation)

#### UAV Drone — `public/models/uav.glb` (9.9 MB)

- Drone 3D model, cloned using `SkeletonUtils.clone()` for correct skeleton/bone animation handling
- Includes a `pointLight` to simulate onboard lighting
- Also pre-loaded via `useGLTF.preload()`

### Configuration — `ntpu.config.ts`

All scene-related parameters are centralized in `src/config/ntpu.config.ts`:

```typescript
{
  observer: { name, latitude, longitude, altitude },  // Observer geographic coordinates
  scene:    { modelPath, position, scale, rotation },  // Campus model settings
  uav:      { modelPath },                             // UAV model path
  camera:   { initialPosition, fov, near, far },       // Camera parameters
}
```

Modify this file to adjust scene behavior without changing component code.

### Starfield Background — `Starfield.tsx`

- Generates 180 randomly distributed stars
- Uses pure **CSS `@keyframes` animation** for twinkling effects
- No JS timers or React state updates — zero performance overhead
- Positioned behind the Canvas with `pointer-events: none` to avoid interfering with 3D interactions

## Controls

| Input | Action |
|---|---|
| Left-click drag | Rotate the scene |
| Right-click drag | Pan the scene |
| Scroll wheel | Zoom in/out (distance clamped to 10–2000) |

## Development Notes

- `tsconfig.json` sets `"noEmit": true` — TypeScript only type-checks; actual transpilation is handled by Vite
- `vite.config.ts` configures the `@` alias to point to `src/`, allowing imports like `@/config/...`
- `.glb` models are placed in `public/` — Vite copies them directly to the build output without bundling
