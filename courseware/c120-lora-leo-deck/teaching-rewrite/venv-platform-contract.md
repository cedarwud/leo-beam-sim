# Python 3.11 與 `.venv` 平台教學契約

本檔為簡報內容來源。實際 package script 與 `/home/u24/lora-energy-lab/README.zh-TW.md` 優先於本摘要。

## 必須區分的三件事

1. 安裝或取得 Python 3.11 interpreter。
2. 使用 Python 3.11 建立 package-local `.venv`。
3. 在 `.venv` 中安裝 lock requirements 並執行 package verify。

`.venv` 是目錄名稱；`venv` 是 Python 建立虛擬環境的標準模組。安裝 Python 與建立 `.venv` 不得合併成同一概念。

## Windows native

環境確認：

```bat
py -3.11 --version
```

Package 主流程：

```bat
set "PYTHON_BIN=py -3.11"
setup.cmd
course.cmd verify
```

`setup.cmd` 內部以 Python 3.11 建立 `.venv`：

```bat
py -3.11 -m venv .venv
```

啟用方式只用於手動診斷：

```bat
rem Command Prompt
.venv\Scripts\activate.bat
```

```powershell
# PowerShell
.\.venv\Scripts\Activate.ps1
```

正常 package 操作不要求 activation；`course.cmd` 直接呼叫 `.venv\Scripts\python.exe`。

## WSL／Linux

先確認 exact interpreter：

```sh
python3.11 --version
```

若套件庫提供 exact 3.11 packages，可安裝 interpreter 與 venv support：

```sh
sudo apt update
sudo apt install python3.11 python3.11-venv
```

`python3-venv` 會跟隨該發行版的預設 Python，未必是 3.11；本 package 需要 3.11.x，因此不得以 3.10、3.12 或 3.13 代替。

套件庫沒有 exact 3.11 時，使用 uv 取得 Python 3.11：

```sh
curl -LsSf https://astral.sh/uv/install.sh | sh
uv python install 3.11
PYTHON_BIN="$(uv python find 3.11)" bash setup.sh
bash course.sh verify
```

Package 主流程在已存在 `python3.11` 時為：

```sh
PYTHON_BIN=python3.11 bash setup.sh
bash course.sh verify
```

`setup.sh` 內部建立 `.venv` 的核心動作：

```sh
python3.11 -m venv .venv
```

啟用方式只用於手動診斷：

```sh
source .venv/bin/activate
```

正常 package 操作不要求 activation；`course.sh` 直接呼叫 `.venv/bin/python`。

## Windows 與 WSL 的差異

Windows native 的 Command Prompt 與 PowerShell 不直接執行 `.sh`。Windows native 使用 `.cmd`；`.sh` 必須在 WSL 等 POSIX shell 中執行。本課不以 Git Bash 作為主要 Windows 路徑，以免混用 shell、path 與 `.venv`。

| 項目 | Windows native | WSL／Linux |
|---|---|---|
| launcher | `py -3.11` | `python3.11` 或 uv 所定位的 interpreter |
| setup | `setup.cmd` | `bash setup.sh` |
| verify | `course.cmd verify` | `bash course.sh verify` |
| `.venv` Python | `.venv\Scripts\python.exe` | `.venv/bin/python` |
| activation | `.venv\Scripts\activate.bat` 或 `Activate.ps1` | `source .venv/bin/activate` |
| path separator | `\` | `/` |

Windows 與 WSL 是兩個獨立環境；同一個專案目錄中的 Windows `.venv` 不可作為 WSL `.venv` 使用，反向亦同。

## 投影片要求

- 安裝 interpreter、建立 `.venv`、安裝 dependencies、verify 分頁說明。
- 每條命令附作用、機制、預期輸出與失敗時的下一項檢查。
- 不以 activation 作為正常執行的必要條件。
- 不教授 checksum 或 ZIP test。
- 文字採正式技術敘述，並遵守 `formal-language-contract.md`。
