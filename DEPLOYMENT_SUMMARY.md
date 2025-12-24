# 部署準備完成總結

## 📦 新增/修改的檔案

### 新增檔案

1. **`backend/requirements.txt`**
   - 包含所有 Python 依賴
   - 新增：`gunicorn`（生產環境 WSGI 伺服器）
   - 新增：`psycopg2-binary`（PostgreSQL 驅動）

2. **`render.yaml`**（專案根目錄）
   - Render Blueprint 配置檔
   - 定義 Web Service 和 PostgreSQL 資料庫
   - 自動連結資料庫和服務

3. **`README_DEPLOY.md`**（專案根目錄）
   - 完整的部署指南
   - 包含步驟說明、環境變數設定、常見錯誤排除

4. **`frontend/vercel.json`**
   - Vercel 部署配置（選用，Vercel 通常會自動偵測 Vite）

5. **`DEPLOYMENT_SUMMARY.md`**（本檔案）
   - 部署準備總結

### 修改檔案

1. **`frontend/src/app/api.ts`**
   - 更新環境變數名稱，支援 `VITE_API_BASE_URL`
   - 保留向後相容（仍支援 `VITE_API_BASE`）

### 不需要修改的檔案（已確認可正常運作）

- `backend/app/config.py` - 已支援從環境變數讀取所有設定
- `backend/app/db.py` - 已自動偵測 SQLite/PostgreSQL
- `backend/alembic/env.py` - 已從 `settings.DATABASE_URL` 讀取
- `backend/app/main.py` - CORS 設定已正確配置

---

## 🔧 各平台需要設定的內容

### Render（Backend + Database）

#### 使用 Blueprint 部署（推薦）

1. 登入 Render Dashboard
2. 點選 "New +" → "Blueprint"
3. 連結 Git repository
4. Render 會自動偵測 `render.yaml` 並建立服務
5. 在 Web Service 的 Environment 頁籤設定：
   - `CORS_ORIGINS` = `https://your-frontend.vercel.app,http://localhost:5173`
   - （其他環境變數會在 Blueprint 中自動設定）

#### 手動建立（如不使用 Blueprint）

**PostgreSQL 資料庫：**
- Name: `chopsticks-erp-db`
- Database: `chopsticks_erp`
- User: `chopsticks_erp_user`
- 複製 Connection String 作為 `DATABASE_URL`

**Web Service：**
- Name: `chopsticks-erp-backend`
- Root Directory: `backend`
- Build Command: `pip install -r requirements.txt`
- Start Command: `gunicorn -k uvicorn.workers.UvicornWorker app.main:app --bind 0.0.0.0:$PORT`

**環境變數（手動建立時）：**
- `DATABASE_URL` = PostgreSQL connection string
- `SECRET_KEY` = 隨機字串（例如：`openssl rand -hex 32`）
- `CORS_ORIGINS` = `https://your-frontend.vercel.app,http://localhost:5173`
- `ENV` = `production`
- `ACCESS_TOKEN_EXPIRE_MINUTES` = `1440`

**Release Command（Migration）：**
- 在 Settings → Deploy → Release Command 輸入：
  ```
  alembic upgrade head
  ```

### Vercel（Frontend）

1. 連結 Git repository
2. 設定專案：
   - Framework Preset: `Vite`（自動偵測）
   - Root Directory: `frontend`
   - Build Command: `npm run build`
   - Output Directory: `dist`

3. 環境變數：
   - `VITE_API_BASE_URL` = `https://your-backend.onrender.com`
   - （**注意**：不包含尾端斜線，也不包含 `/api` 路徑）

4. 部署後記下 Vercel 網域，回到 Render 更新 `CORS_ORIGINS`

---

## ⚠️ 重要注意事項

### 1. API 路徑結構

- **Backend API 沒有 `/api` 前綴**
- 路由直接掛在根路徑下：`/auth`, `/products`, `/sales-orders` 等
- 前端 `VITE_API_BASE_URL` 應該設為：`https://backend.onrender.com`（不含 `/api`）

### 2. 資料庫 Migration

- 首次部署後必須執行 `alembic upgrade head`
- 建議使用 Render 的 Release Command 自動執行
- 如果自動執行失敗，可以：
  - 使用 Render Shell 手動執行
  - 或在本地使用 External Database URL 執行

### 3. CORS 設定

- `CORS_ORIGINS` 必須包含完整的前端網域（含 `https://`）
- 多個網域用逗號分隔，不要有空格
- 記得包含開發環境：`http://localhost:5173`

### 4. 環境變數優先順序

- **Backend**: 環境變數會覆蓋 `config.py` 中的預設值
- **Frontend**: Vite 環境變數必須以 `VITE_` 開頭
- 更新環境變數後需要重新部署/重啟服務

### 5. PostgreSQL vs SQLite

- **開發環境**：可以使用 SQLite（`sqlite:///./app.db`）
- **生產環境**：必須使用 PostgreSQL（`postgresql://...`）
- `db.py` 會自動偵測並使用正確的連接參數

---

## 🐛 常見錯誤排除

### CORS 錯誤

**症狀**：瀏覽器 Console 出現 `Access-Control-Allow-Origin` 錯誤

**解決**：
1. 確認 `CORS_ORIGINS` 包含完整前端網域（含 `https://`）
2. 確認沒有尾端斜線
3. 更新後等待 Render 自動重啟（約 1-2 分鐘）

### 資料庫連線錯誤

**症狀**：`could not connect to server` 或 `FATAL: database does not exist`

**解決**：
1. 確認 `DATABASE_URL` 是 PostgreSQL 格式（`postgresql://...`）
2. 確認資料庫服務狀態為 "Available"
3. 檢查是否使用正確的 Internal/External URL

### Migration 錯誤

**症狀**：資料表不存在或 migration 失敗

**解決**：
1. 確認已執行 `alembic upgrade head`
2. 檢查 Render Logs 確認 Release Command 有執行
3. 手動執行 migration（使用 Render Shell 或本地執行）

### 環境變數未生效

**症狀**：前端仍使用舊 URL 或後端使用預設值

**解決**：
1. Frontend：確認變數名稱是 `VITE_API_BASE_URL`（不是 `VITE_API_BASE`）
2. Backend：確認環境變數在 Render Dashboard 正確設定
3. 清除瀏覽器快取和 Vercel 建置快取

### 502 Bad Gateway

**症狀**：訪問 Backend URL 返回 502

**解決**：
1. 檢查 Render Logs 錯誤訊息
2. 確認 Start Command 正確（特別是 `$PORT` 變數）
3. 確認 `requirements.txt` 包含所有依賴

---

## ✅ 驗收測試清單

部署完成後，請逐一測試：

- [ ] 前端登入（`admin` / `admin1234`）
- [ ] 建立銷貨單（SO）
- [ ] PR 核准入庫 + BOM 扣料
- [ ] 出貨 SHIP 扣庫存
- [ ] PDF/Excel 匯出

詳細測試步驟請參考 `README_DEPLOY.md` 的「Part D: 驗收測試清單」章節。

---

## 📚 相關文件

- 詳細部署指南：`README_DEPLOY.md`
- Render 文件：https://render.com/docs
- Vercel 文件：https://vercel.com/docs

---

## 🎯 下一步

1. 將所有修改推送到 Git repository
2. 按照 `README_DEPLOY.md` 的步驟進行部署
3. 完成驗收測試
4. 如遇到問題，參考「常見錯誤排除」章節

祝部署順利！🚀

