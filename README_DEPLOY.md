# 部署指南 - Chopsticks ERP MVP

本指南將協助您將專案部署到生產環境：
- **Frontend**: Vercel (Vite/React)
- **Backend**: Render Web Service (FastAPI)
- **Database**: PostgreSQL (Render PostgreSQL)

---

## 📋 前置需求

1. GitHub/GitLab/Bitbucket 帳號（用於連結 Render 和 Vercel）
2. Render 帳號：https://render.com
3. Vercel 帳號：https://vercel.com
4. 本專案已推送到 Git repository

---

## 🗄️ Part A: 部署 PostgreSQL 資料庫（Render）

### 方法一：使用 Render Blueprint（推薦）

1. 登入 Render Dashboard
2. 點選 **"New +"** → **"Blueprint"**
3. 連結您的 Git repository
4. Render 會自動偵測 `render.yaml` 並建立資料庫
5. 記下資料庫的 **Connection String**（格式：`postgresql://user:password@host:port/dbname`）

### 方法二：手動建立資料庫

1. 登入 Render Dashboard
2. 點選 **"New +"** → **"PostgreSQL"**
3. 設定：
   - **Name**: `chopsticks-erp-db`
   - **Database**: `chopsticks_erp`
   - **User**: `chopsticks_erp_user`
   - **Region**: 選擇離你最近的區域（建議 `singapore` 或 `asia`）
   - **Plan**: 選擇適合的方案（free/starter/standard）
4. 點選 **"Create Database"**
5. 等待資料庫建立完成
6. 進入資料庫頁面，複製 **"Internal Database URL"** 或 **"External Database URL"**（用於環境變數）

---

## 🔧 Part B: 部署 Backend（Render Web Service）

### 方法一：使用 Render Blueprint（推薦）

如果您已經使用 Blueprint 建立資料庫，Web Service 會一併建立。只需確認環境變數設定。

### 方法二：手動建立 Web Service

1. 登入 Render Dashboard
2. 點選 **"New +"** → **"Web Service"**
3. 連結您的 Git repository
4. 設定服務資訊：
   - **Name**: `chopsticks-erp-backend`
   - **Region**: 與資料庫相同的區域
   - **Branch**: `main` 或您的主分支
   - **Root Directory**: `backend`（指定 backend 目錄）
   - **Runtime**: `Python 3`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `gunicorn -k uvicorn.workers.UvicornWorker app.main:app --bind 0.0.0.0:$PORT`

### 環境變數設定（Render）

進入 Web Service 的 **"Environment"** 頁籤，新增以下環境變數：

#### 必要環境變數

| Key | Value | 說明 |
|-----|-------|------|
| `DATABASE_URL` | `postgresql://user:pass@host:port/dbname` | 從 PostgreSQL 服務複製的 Connection String |
| `SECRET_KEY` | `your-secret-key-here` | JWT 簽章用的密鑰（建議用長隨機字串，例如：`openssl rand -hex 32`） |
| `CORS_ORIGINS` | `https://your-frontend.vercel.app,http://localhost:5173` | 前端網域，多個用逗號分隔（**記得包含 Vercel 網域**） |
| `ENV` | `production` | 環境標識 |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `1440` | Token 過期時間（分鐘，1440 = 24小時） |

#### 選用環境變數

| Key | Value | 說明 |
|-----|-------|------|
| `PUBLIC_BASE_URL` | `https://your-backend.onrender.com` | Backend 公開 URL（如需要） |

**重要**：
- `DATABASE_URL` 必須是完整的 PostgreSQL connection string（不是 SQLite）
- `CORS_ORIGINS` 必須包含前端 Vercel 網域（例如：`https://chopsticks-erp.vercel.app`）
- 如果尚未知道前端網域，可以部署後再更新（Render 支援環境變數更新後自動重啟）

### 資料庫 Migration（自動執行）

#### 選項 1：使用 Render Pre-Deploy Command（推薦）

在 Render Web Service 的設定中：

1. 進入 **"Settings"** → **"Build & Deploy"**
2. 找到 **"Pre-Deploy Command (Optional)"** 區塊
3. 點選右側的 **"Edit"** 按鈕
4. 在輸入欄位中輸入：
   ```
   alembic upgrade head
   ```
5. 點選 **"Save Changes"**
6. ⚠️ **說明**：這個命令會在每次部署前自動執行，確保資料庫 schema 是最新的

#### 選項 2：手動執行 Migration

如果 Release Command 不可用，可以手動執行：

1. 進入 Render Web Service 的 **"Shell"** 頁籤
2. 執行以下命令：
   ```bash
   cd backend
   alembic upgrade head
   ```

或者在本地執行（使用外部資料庫 URL）：

```bash
cd backend
export DATABASE_URL="postgresql://user:pass@host:port/dbname"  # 從 Render 複製 External Database URL
alembic upgrade head
```

### 初始化 Admin 帳號

部署完成後，執行以下步驟初始化管理員帳號：

1. 開啟瀏覽器，訪問：`https://your-backend.onrender.com/auth/bootstrap-admin`
2. 或使用 curl：
   ```bash
   curl -X POST https://your-backend.onrender.com/auth/bootstrap-admin
   ```
3. 預設帳號密碼：`admin` / `admin1234`

---

## 🎨 Part C: 部署 Frontend（Vercel）

### 步驟 1：連結 Repository

1. 登入 Vercel Dashboard
2. 點選 **"Add New..."** → **"Project"**
3. 選擇您的 Git repository
4. 選擇專案後，進入設定頁面

### 步驟 2：設定專案

在專案設定頁面：

- **Framework Preset**: `Vite`（應該會自動偵測）
- **Root Directory**: `frontend`
- **Build Command**: `npm run build`（或 `npm ci && npm run build`）
- **Output Directory**: `dist`
- **Install Command**: `npm install`（或 `npm ci`）

### 步驟 3：設定環境變數

在 **"Environment Variables"** 區塊，新增：

| Key | Value | 說明 |
|-----|-------|------|
| `VITE_API_BASE_URL` | `https://your-backend.onrender.com` | Backend API 的完整 URL（**不包含尾端斜線**） |

**範例**：
```
VITE_API_BASE_URL=https://chopsticks-erp-backend.onrender.com
```

### 步驟 4：部署

1. 點選 **"Deploy"**
2. 等待建置完成
3. 記下 Vercel 提供的網域（例如：`https://chopsticks-erp.vercel.app`）

### 步驟 5：更新 Backend CORS 設定

部署完成後，回到 Render Backend 的環境變數設定：

1. 更新 `CORS_ORIGINS`，加入 Vercel 網域：
   ```
   https://your-frontend.vercel.app,http://localhost:5173
   ```
2. Render 會自動重啟服務

### Vercel.json（選用）

通常 Vercel 會自動識別 Vite 專案，不需要額外的 `vercel.json`。如果需要自訂設定，可以在 `frontend/` 目錄建立：

```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "devCommand": "npm run dev",
  "installCommand": "npm install",
  "framework": "vite"
}
```

---

## ✅ Part D: 驗收測試清單

部署完成後，請逐一測試以下功能：

### 1. 前端登入
- [ ] 訪問前端網址
- [ ] 輸入 `admin` / `admin1234` 登入
- [ ] 確認登入成功，Token 正常儲存

### 2. 建立銷貨單（Sales Order）
- [ ] 進入「銷貨單」頁面
- [ ] 建立新的銷貨單（SO）
- [ ] 確認建立成功，能看到新建立的銷貨單

### 3. PR 核准入庫 + BOM 扣料
- [ ] 進入「生產記錄」或相關頁面
- [ ] 核准生產記錄（PR）入庫
- [ ] 確認 BOM 扣料成功，庫存正確減少

### 4. 出貨 SHIP 扣庫存
- [ ] 進入「銷貨單」詳情頁
- [ ] 執行出貨（SHIP）動作
- [ ] 確認庫存正確扣除

### 5. PDF/Excel 匯出
- [ ] 測試 PDF 匯出功能（例如：銷貨單 PDF）
- [ ] 測試 Excel 匯出功能（例如：報表匯出）
- [ ] 確認檔案可以正常下載

---

## 🐛 常見錯誤排除

### 1. CORS 錯誤

**症狀**：瀏覽器 Console 出現 `Access-Control-Allow-Origin` 錯誤

**解決方法**：
1. 確認 Render Backend 的 `CORS_ORIGINS` 環境變數包含完整的前端網域（包含 `https://`）
2. 確認網域沒有尾端斜線
3. 多個網域用逗號分隔，不要有空格
4. 更新環境變數後，等待 Render 自動重啟（約 1-2 分鐘）

**檢查方式**：
```bash
# 在瀏覽器 Console 執行
fetch('https://your-backend.onrender.com/health')
  .then(r => r.json())
  .then(console.log)
```

### 2. 資料庫連線錯誤

**症狀**：Backend logs 出現 `could not connect to server` 或 `FATAL: database does not exist`

**解決方法**：
1. 確認 `DATABASE_URL` 環境變數正確設定
2. 確認使用的是 PostgreSQL connection string（格式：`postgresql://...`），不是 SQLite
3. 如果是使用 External Database URL，確認網路可以訪問（某些環境可能只允許 Internal URL）
4. 檢查資料庫服務是否正常運行（Render Dashboard 顯示狀態為 "Available"）

**測試連線**：
```bash
# 在 Render Shell 執行
cd backend
python -c "from app.db import engine; engine.connect(); print('DB connected!')"
```

### 3. Migration 錯誤

**症狀**：部署後資料表不存在，或出現 migration 錯誤

**解決方法**：
1. 確認已執行 `alembic upgrade head`
2. 如果使用 Release Command，檢查 Logs 確認是否有執行
3. 手動執行 migration（參考上方「資料庫 Migration」章節）
4. 檢查 `alembic/versions/` 目錄是否有所有 migration 檔案

**檢查 Migration 狀態**：
```bash
cd backend
alembic current  # 查看目前版本
alembic history  # 查看所有版本
```

### 4. 環境變數未生效

**症狀**：前端仍然使用舊的 API URL 或後端使用預設值

**解決方法**：
1. **Frontend**：Vite 環境變數必須以 `VITE_` 開頭，並且需要重新建置才會生效
2. **Backend**：確認環境變數在 Render Dashboard 正確設定，並且服務已重啟
3. 清除瀏覽器快取和 Vercel 建置快取

**檢查環境變數**：
```bash
# Frontend: 在瀏覽器 Console
console.log(import.meta.env.VITE_API_BASE_URL)

# Backend: 在 Render Shell
cd backend
python -c "from app.config import settings; print(settings.DATABASE_URL[:20] + '...')"
```

### 5. 502 Bad Gateway / Service Unavailable

**症狀**：訪問 Backend URL 返回 502 或 503

**解決方法**：
1. 檢查 Render Logs，查看錯誤訊息
2. 確認 Start Command 正確（特別是 `$PORT` 變數）
3. 確認 `requirements.txt` 包含所有依賴
4. 檢查是否有語法錯誤或 import 錯誤

**查看 Logs**：
- 進入 Render Web Service → **"Logs"** 頁籤
- 查看最近的錯誤訊息

### 6. Frontend Build 失敗

**症狀**：Vercel 建置失敗

**解決方法**：
1. 確認 Root Directory 設定為 `frontend`
2. 確認 Build Command 和 Output Directory 正確
3. 檢查 Vercel Build Logs 的錯誤訊息
4. 確認 `package.json` 中的 `build` script 存在

### 7. Token 認證失敗

**症狀**：登入後 API 請求返回 401 Unauthorized

**解決方法**：
1. 確認 `SECRET_KEY` 環境變數已設定且不會變動（變動會導致已發出的 token 失效）
2. 檢查前端是否有正確發送 `Authorization: Bearer <token>` header
3. 檢查 token 是否過期（`ACCESS_TOKEN_EXPIRE_MINUTES`）

---

## 📝 檔案清單

### 新增/修改的檔案

1. **`backend/requirements.txt`**（新增）
   - 包含所有 Python 依賴，包括 `gunicorn` 和 `psycopg2-binary`

2. **`render.yaml`**（新增）
   - Render Blueprint 配置檔
   - 定義 Web Service 和 PostgreSQL 資料庫

3. **`README_DEPLOY.md`**（新增）
   - 本部署指南

4. **`frontend/src/app/api.ts`**（修改）
   - 更新環境變數名稱支援 `VITE_API_BASE_URL`

### 不需要修改但需要確認的檔案

- `backend/app/config.py` - 已支援從環境變數讀取 `DATABASE_URL`（預設 SQLite，生產環境會覆蓋）
- `backend/app/db.py` - 已支援 PostgreSQL（自動偵測 SQLite/PostgreSQL）
- `backend/alembic/env.py` - 已從 `settings.DATABASE_URL` 讀取，無需修改

---

## 🔒 安全建議

1. **SECRET_KEY**：使用強隨機字串（例如：`openssl rand -hex 32`）
2. **資料庫密碼**：使用 Render 自動產生的強密碼
3. **CORS_ORIGINS**：只包含需要的網域，不要使用 `*`
4. **環境變數**：不要在程式碼中硬編碼敏感資訊
5. **HTTPS**：Render 和 Vercel 預設提供 HTTPS，請使用 HTTPS URL

---

## 📞 取得幫助

如果遇到問題：

1. 查看 Render Logs（Web Service → Logs）
2. 查看 Vercel Build Logs（專案 → Deployments → 選擇部署 → Logs）
3. 檢查瀏覽器 Console 錯誤訊息
4. 確認所有環境變數正確設定
5. 參考 Render 和 Vercel 官方文件

---

## 🎉 完成

完成以上步驟後，您的 ERP 系統應該已經成功部署並運行在生產環境！

