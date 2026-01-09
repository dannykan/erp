# 本地開發環境啟動指南

## 📋 前置準備

### Backend 準備
1. 確認 Python 版本 >= 3.10
2. 進入 backend 目錄並啟動虛擬環境
3. 確認依賴已安裝

### Frontend 準備
1. 確認已安裝 Node.js (建議 >= 18)
2. 進入 frontend 目錄並安裝依賴

---

## 🚀 啟動步驟

### 方法一：使用兩個終端視窗（推薦）

#### 終端 1：啟動 Backend

```bash
# 進入 backend 目錄
cd backend

# 啟動虛擬環境（如果還沒啟動）
source venv/bin/activate  # macOS/Linux
# 或 Windows: venv\Scripts\activate

# 確認依賴已安裝（如果還沒安裝）
pip install -r requirements.txt

# 套用資料庫 migration（如果需要）
alembic upgrade head

# 啟動 FastAPI 伺服器
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Backend 會運行在：**http://localhost:8000**

API 文檔可訪問：**http://localhost:8000/docs**

#### 終端 2：啟動 Frontend

```bash
# 進入 frontend 目錄
cd frontend

# 安裝依賴（如果還沒安裝）
npm install

# 啟動開發伺服器
npm run dev
```

Frontend 會運行在：**http://localhost:5173**

---

### 方法二：使用背景執行（單一終端）

#### 啟動 Backend（背景執行）

```bash
cd backend
source venv/bin/activate  # macOS/Linux
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000 &
```

#### 啟動 Frontend（前景執行）

```bash
cd frontend
npm run dev
```

---

## 📝 快速指令（已安裝依賴後）

### Backend
```bash
cd backend && source venv/bin/activate && uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Frontend
```bash
cd frontend && npm run dev
```

---

## 🔧 環境變數設定（可選）

如果需要自訂設定，可在 `backend` 目錄下建立 `.env` 檔案：

```env
DATABASE_URL=sqlite:///./app.db
SECRET_KEY=your-secret-key-here
CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
PRINT_AGENT_TOKEN=your-print-agent-token-here
```

---

## ✅ 驗證啟動成功

1. **Backend 健康檢查**：
   - 訪問 http://localhost:8000/health
   - 應該看到：`{"ok": true}`

2. **Backend API 文檔**：
   - 訪問 http://localhost:8000/docs
   - 應該看到 Swagger UI 介面

3. **Frontend**：
   - 訪問 http://localhost:5173
   - 應該看到應用程式首頁

---

## 🛑 停止服務

### 方法一：使用 Ctrl+C
在運行服務的終端視窗按 `Ctrl+C` 停止

### 方法二：找出並終止程序

```bash
# 找出 uvicorn 程序
lsof -ti:8000 | xargs kill -9  # macOS/Linux

# 找出 vite 程序
lsof -ti:5173 | xargs kill -9  # macOS/Linux
```

---

## ⚠️ 常見問題

### Backend 問題

**問題：ModuleNotFoundError**
```bash
# 解決：確認虛擬環境已啟動並重新安裝依賴
source venv/bin/activate
pip install -r requirements.txt
```

**問題：資料庫 migration 錯誤**
```bash
# 解決：檢查 migration 狀態
alembic current
alembic upgrade head
```

### Frontend 問題

**問題：Port 5173 已被佔用**
```bash
# 解決：使用不同 port
npm run dev -- --port 5174
```

**問題：node_modules 損壞**
```bash
# 解決：重新安裝依賴
rm -rf node_modules package-lock.json
npm install
```

---

## 📚 相關文件

- Backend API 文檔：http://localhost:8000/docs
- 部署指南：`README_DEPLOY.md`

