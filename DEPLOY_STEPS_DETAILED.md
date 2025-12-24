# 詳細部署步驟：Render + Vercel

本文件提供一步步的圖文說明，協助您完成部署。

---

## 📦 Part 1: Render 部署（Backend + Database）

### 步驟 1.1：註冊/登入 Render

1. 前往 https://render.com
2. 點選右上角 **"Get Started for Free"** 或 **"Sign In"**
3. 使用 GitHub 帳號登入（推薦）或 Email 註冊

### 步驟 1.2：建立 PostgreSQL 資料庫

1. 登入 Render Dashboard 後，點選左上角 **"New +"** 按鈕
2. 在下拉選單中選擇 **"PostgreSQL"**
3. 填寫資料庫設定：

   **基本設定：**
   - **Name**: `chopsticks-erp-db`
   - **Database**: `chopsticks_erp`
   - **User**: `chopsticks_erp_user`
   - **Region**: 選擇離您最近的區域（建議：`Singapore` 或 `Oregon (US West)`）
   - **PostgreSQL Version**: 選擇最新版本（通常預設即可）
   - **Plan**: 
     - 選擇 **Free**（測試用，有休眠限制）
     - 或 **Starter**（$7/月，無休眠，更穩定）

4. 點選下方藍色 **"Create Database"** 按鈕

5. **等待資料庫建立完成**（約 1-2 分鐘）
   - 狀態會從 "Provisioning" 變為 "Available"

6. **複製資料庫連線資訊：**
   - 進入資料庫頁面後，找到 **"Connections"** 區塊
   - 複製 **"Internal Database URL"**（格式：`postgresql://user:pass@host:port/dbname`）
   postgresql://chopsticks_erp_user:2Uaf2tapblxF7gDAK09UoX8F5jrv75sl@dpg-d55p4fh5pdvs73c9i780-a/chopsticks_erp
   - **⚠️ 重要**：這個 URL 稍後會用在 Web Service 的環境變數中

### 步驟 1.3：建立 Web Service（Backend）

有兩種方式，推薦使用 **方法一（Blueprint）**：

---

#### 方法一：使用 Blueprint（推薦 - 自動化設定）

1. 在 Render Dashboard 點選 **"New +"** → **"Blueprint"**

2. **連結 Repository：**
   - 如果是第一次使用，會要求授權 GitHub
   - 選擇 **"Connect account"** 或 **"Configure account"**
   - 授權 Render 存取您的 GitHub repository

3. **選擇 Repository：**
   - 在列表中選擇 `dannykan/erp`
   - 或直接在搜尋框輸入 `erp`

4. **Blueprint 設定：**
   - Render 會自動偵測 `render.yaml` 檔案
   - 預覽會顯示將要建立的服務（Web Service + Database）
   - 點選 **"Apply"** 確認

5. **等待部署完成：**
   - Render 會自動建立資料庫（如果 render.yaml 中有定義）
   - 建立 Web Service
   - 開始建置和部署

6. **設定環境變數：**
   - 進入 **"chopsticks-erp-backend"** Web Service 頁面
   - 點選左側選單的 **"Environment"**
   - 確認以下環境變數已自動設定：
     - ✅ `DATABASE_URL`（應該已從資料庫自動連結）
     - ✅ `SECRET_KEY`（應該已自動產生）
     - ✅ `ENV` = `production`
     - ✅ `ACCESS_TOKEN_EXPIRE_MINUTES` = `1440`

7. **手動設定 CORS_ORIGINS：**
   - 在 Environment 頁面，點選 **"Add Environment Variable"**
   - **Key**: `CORS_ORIGINS`
   - **Value**: `http://localhost:5173`（暫時先用這個，等 Vercel 部署完成後再更新）
   - 點選 **"Save Changes"**
   - ⚠️ **注意**：等 Vercel 部署完成後，需要回來更新這個值，加入 Vercel 網域

8. **設定 Migration（資料庫遷移）：**

   **⚠️ 重要：Render 免費方案中，Pre-Deploy Command 可能被鎖定無法編輯。**
   
   **選項 A：使用本地終端機執行 Migration（推薦，免費方案）**
   
   1. 在資料庫頁面（`chopsticks-erp-db`）複製 **"External Database URL"**
   2. 在本地終端機執行：
      ```bash
      cd /Users/dannykan/chopsticks-erp-mvp/backend
      export DATABASE_URL="postgresql://chopsticks_erp_user:2Uaf2tapblxF7gDAK09UoX8F5jrv75sl@dpg-d55p4fh5pdvs73c9i780-a/chopsticks_erp"
      alembic upgrade head
      ```
   3. 執行成功後會看到類似訊息：
      ```
      INFO  [alembic.runtime.migration] Running upgrade -> fe36ca03e134, init schema
      INFO  [alembic.runtime.migration] Running upgrade fe36ca03e134 -> ..., ...
      ...
      ```
   4. 這只需要執行一次，除非之後有新的 migration 檔案

   **選項 B：更新 render.yaml（如果使用 Blueprint）**
   - `render.yaml` 中已包含 `preDeployCommand: alembic upgrade head`
   - 如果 Pre-Deploy Command 被鎖定，可以：
     1. 確認 `render.yaml` 檔案在 GitHub 中有正確的 `preDeployCommand`
     2. 在 Render 頁面點選 **"Manual Deploy"** → **"Deploy latest commit"**
     3. 這會觸發重新部署，並執行 migration

9. **確認部署狀態：**
   - 點選 **"Events"** 或 **"Logs"** 查看部署進度
   - 等待部署完成（狀態變為 "Live"）
   - 記下您的 Backend URL（格式：`https://chopsticks-erp-backend.onrender.com`）

---

#### 方法二：手動建立 Web Service（不使用 Blueprint）

如果 Blueprint 無法使用，可以手動建立：

1. 在 Render Dashboard 點選 **"New +"** → **"Web Service"**

2. **連結 Repository：**
   - 選擇 **"Build and deploy from a Git repository"**
   - 如果是第一次使用，授權 GitHub 存取
   - 選擇 Repository：`dannykan/erp`

3. **設定服務資訊：**

   **基本設定：**
   - **Name**: `chopsticks-erp-backend`
   - **Region**: 選擇與資料庫相同的區域
   - **Branch**: `main`
   - **Root Directory**: `backend` ⚠️ **重要**：必須填寫 `backend`

   **建置設定：**
   - **Runtime**: `Python 3`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `gunicorn -k uvicorn.workers.UvicornWorker app.main:app --bind 0.0.0.0:$PORT`

4. **設定環境變數：**
   - 在 **"Environment Variables"** 區塊，點選 **"Add Environment Variable"**
   - 依序新增以下變數：

     | Key | Value | 說明 |
     |-----|-------|------|
     | `DATABASE_URL` | 貼上從步驟 1.2 複製的 Internal Database URL | PostgreSQL 連線字串 |
     | `SECRET_KEY` | 使用命令產生：`openssl rand -hex 32` | JWT 簽章密鑰 |
     | `CORS_ORIGINS` | `http://localhost:5173` | CORS 允許來源（之後會更新） |
     | `ENV` | `production` | 環境標識 |
     | `ACCESS_TOKEN_EXPIRE_MINUTES` | `1440` | Token 過期時間（分鐘） |

   - **產生 SECRET_KEY 的方法：**
     ```bash
     # 在本地終端機執行
     openssl rand -hex 32
     # 複製輸出的字串作為 SECRET_KEY
     ```

5. **點選 "Create Web Service"**

6. **等待首次部署完成**（約 3-5 分鐘）

7. **執行資料庫 Migration：**

   **方法 1：使用本地終端機執行（推薦，免費方案適用）**
   - 在資料庫頁面複製 **"External Database URL"**
   - 在本地終端機執行：
     ```bash
     cd backend
     export DATABASE_URL="postgresql://user:pass@host:port/dbname"  # 貼上 External URL
     alembic upgrade head
     ```
   - 執行成功後會看到 "INFO [alembic.runtime.migration] Running upgrade ..." 訊息

   **方法 2：更新 render.yaml 並重新部署**
   - 如果 `render.yaml` 中有 `preDeployCommand`，提交更新到 GitHub
   - 在 Render 點選 **"Manual Deploy"** → **"Deploy latest commit"**

---

### 步驟 1.4：執行資料庫 Migration（如果尚未執行）

**如果 render.yaml 中有 preDeployCommand：**
- Migration 會在每次部署前自動執行
- 檢查 **"Events"** 或 **"Logs"** 確認 migration 是否成功

**如果 Pre-Deploy Command 被鎖定（免費方案常見情況）：**

**使用本地終端機執行（最可靠的方法）：**

1. **在資料庫頁面複製 External Database URL**
   - 進入 `chopsticks-erp-db` 資料庫頁面
   - 找到 **"Connections"** 區塊
   - 複製 **"External Database URL"**

2. **在本地終端機執行 Migration：**
   ```bash
   # 切換到專案目錄
   cd /Users/dannykan/chopsticks-erp-mvp/backend
   
   # 設定環境變數（貼上 External Database URL）
   export DATABASE_URL="postgresql://chopsticks_erp_user:2Uaf2tapblxF7gDAK09UoX8F5jrv75sl@dpg-d55p4fh5pdvs73c9i780-a/chopsticks_erp"
   
   # 執行 migration
   alembic upgrade head
   ```

3. **確認執行成功：**
   - 應該會看到類似訊息：
     ```
     INFO  [alembic.runtime.migration] Context impl PostgresqlImpl.
     INFO  [alembic.runtime.migration] Will assume transactional DDL.
     INFO  [alembic.runtime.migration] Running upgrade -> fe36ca03e134, init schema
     INFO  [alembic.runtime.migration] Running upgrade fe36ca03e134 -> ..., ...
     ...
     ```
   - 如果顯示 "Target database is not up to date" 或錯誤，檢查錯誤訊息並排除問題

4. **這只需要執行一次**
   - 除非之後有新的 migration 檔案，否則不需要重複執行
   - 每次新增 migration 檔案後，可以再次執行這個命令

### 步驟 1.5：初始化 Admin 帳號

1. 確認 Backend 已成功部署（狀態為 "Live"）
2. 在瀏覽器訪問：`https://your-backend-name.onrender.com/auth/bootstrap-admin`
   - 例如：`https://chopsticks-erp-backend.onrender.com/auth/bootstrap-admin`
3. 應該會看到回應：`{"ok":true}` 或類似訊息
4. 預設帳號密碼：`admin` / `admin1234`

### 步驟 1.6：測試 Backend API

1. 訪問健康檢查端點：`https://your-backend-name.onrender.com/health`
   - 應該看到：`{"ok":true}`

2. 測試登入 API：
   ```bash
   curl -X POST https://your-backend-name.onrender.com/auth/login \
     -H "Content-Type: application/json" \
     -d '{"username":"admin","password":"admin1234"}'
   ```
   - 應該會返回 token

---

## 🎨 Part 2: Vercel 部署（Frontend）

### 步驟 2.1：註冊/登入 Vercel

1. 前往 https://vercel.com
2. 點選右上角 **"Sign Up"** 或 **"Log In"**
3. 選擇 **"Continue with GitHub"**（推薦，因為程式碼在 GitHub 上）

### 步驟 2.2：建立新專案

1. 登入後，點選右上角 **"Add New..."** → **"Project"**

2. **連結 Repository：**
   - 如果是第一次使用，會要求授權 GitHub
   - 授權後，在 **"Import Git Repository"** 中選擇 `dannykan/erp`
   - 或直接在搜尋框輸入 `erp`

3. **專案設定：**

   **Configure Project：**
   - **Project Name**: `chopsticks-erp`（或您想要的名稱）
   - **Framework Preset**: 應該自動偵測為 `Vite`，如果沒有請手動選擇
   - **Root Directory**: 點選 **"Edit"**，輸入 `frontend` ⚠️ **重要**

   **Build and Output Settings：**
   - **Build Command**: `npm run build`（應該已自動填入）
   - **Output Directory**: `dist`（應該已自動填入）
   - **Install Command**: `npm install`（或 `npm ci`）

4. **環境變數設定：**

   - 在 **"Environment Variables"** 區塊，點選 **"Add"**
   - **Key**: `VITE_API_BASE_URL`
   - **Value**: 貼上您的 Render Backend URL
     - 例如：`https://chopsticks-erp-backend.onrender.com`
     - ⚠️ **重要**：不包含尾端斜線，也不包含 `/api` 路徑
   - 確認三個環境都勾選（Production、Preview、Development）
   - 點選 **"Add"**

5. **點選右下角藍色 "Deploy" 按鈕**

6. **等待部署完成**（約 1-2 分鐘）
   - 可以看到建置進度
   - 建置完成後會顯示 "Congratulations! Your deployment has been successfully created."

7. **記下 Vercel 提供的網域：**
   - 會顯示類似：`https://chopsticks-erp.vercel.app`
   - 或在專案頁面的 **"Domains"** 區塊可以看到

---

### 步驟 2.3：更新 Render CORS 設定

1. 回到 Render Dashboard
2. 進入 **"chopsticks-erp-backend"** Web Service
3. 點選 **"Environment"**
4. 找到 `CORS_ORIGINS` 環境變數，點選右側的編輯圖示（鉛筆圖示）
5. **更新 Value** 為：
   ```
   https://your-frontend.vercel.app,http://localhost:5173
   ```
   - 將 `your-frontend.vercel.app` 替換為您實際的 Vercel 網域
   - 例如：`https://chopsticks-erp.vercel.app,http://localhost:5173`
6. 點選 **"Save Changes"**
7. Render 會自動重啟服務（約 1 分鐘）

---

### 步驟 2.4：測試前端部署

1. 在瀏覽器訪問您的 Vercel 網域
   - 例如：`https://chopsticks-erp.vercel.app`

2. **測試登入功能：**
   - 應該能看到登入頁面
   - 輸入帳號：`admin`
   - 輸入密碼：`admin1234`
   - 點選登入
   - 應該能成功登入並進入系統

3. **檢查瀏覽器 Console：**
   - 按 `F12` 開啟開發者工具
   - 查看 **Console** 和 **Network** 分頁
   - 確認沒有 CORS 錯誤或連線錯誤

---

## ✅ Part 3: 驗收測試

完成部署後，請依序測試以下功能：

### 測試 1：前端登入
- [ ] 訪問前端網址
- [ ] 使用 `admin` / `admin1234` 登入
- [ ] 確認登入成功，能看到主畫面

### 測試 2：建立銷貨單（Sales Order）
- [ ] 進入「銷貨單」頁面
- [ ] 建立新的銷貨單（SO）
- [ ] 確認建立成功，能看到新建立的銷貨單

### 測試 3：PR 核准入庫 + BOM 扣料
- [ ] 進入「生產記錄」或相關頁面
- [ ] 核准生產記錄（PR）入庫
- [ ] 確認 BOM 扣料成功，庫存正確減少

### 測試 4：出貨 SHIP 扣庫存
- [ ] 進入「銷貨單」詳情頁
- [ ] 執行出貨（SHIP）動作
- [ ] 確認庫存正確扣除

### 測試 5：PDF/Excel 匯出
- [ ] 測試 PDF 匯出功能（例如：銷貨單 PDF）
- [ ] 測試 Excel 匯出功能（例如：報表匯出）
- [ ] 確認檔案可以正常下載

---

## 🐛 常見問題排除

### 問題 1：Render 部署失敗

**可能原因：**
- Build Command 或 Start Command 錯誤
- 缺少依賴

**解決方法：**
1. 檢查 **"Logs"** 頁面的錯誤訊息
2. 確認 `backend/requirements.txt` 存在且正確
3. 確認 Root Directory 設定為 `backend`

### 問題 2：CORS 錯誤

**症狀：** 瀏覽器 Console 出現 `Access-Control-Allow-Origin` 錯誤

**解決方法：**
1. 確認 Render 的 `CORS_ORIGINS` 包含完整的前端 Vercel 網域（含 `https://`）
2. 確認沒有尾端斜線
3. 更新後等待 Render 自動重啟（約 1-2 分鐘）

### 問題 3：資料庫連線錯誤

**症狀：** Backend logs 出現 `could not connect to server`

**解決方法：**
1. 確認 `DATABASE_URL` 環境變數正確設定
2. 確認使用的是 PostgreSQL connection string（格式：`postgresql://...`）
3. 確認資料庫服務狀態為 "Available"

### 問題 4：Migration 未執行 / Pre-Deploy Command 被鎖定

**症狀：** API 返回錯誤，資料表不存在

**解決方法：**

1. **如果 Pre-Deploy Command 被鎖定（免費方案常見）：**
   - 使用本地終端機連接外部資料庫執行 migration（見下方步驟）
   - 或確認 `render.yaml` 檔案在 GitHub 中有正確的 `preDeployCommand`

2. **手動執行 Migration（免費方案推薦）：**
   - 在資料庫頁面複製 **"External Database URL"**
   - 在本地終端機執行：
     ```bash
     cd backend
     export DATABASE_URL="postgresql://user:pass@host:port/dbname"  # 貼上 External URL
     alembic upgrade head
     ```

3. **檢查 Migration 狀態：**
   - 檢查 **"Events"** 或 **"Logs"** 確認 migration 有執行（如果使用 preDeployCommand）
   - 或檢查資料庫中是否有 alembic_version 資料表

### 問題 5：前端無法連接到 Backend

**症狀：** 前端顯示連線錯誤或 404

**解決方法：**
1. 確認 `VITE_API_BASE_URL` 環境變數正確設定
2. 確認 URL 格式正確（不含尾端斜線，不含 `/api`）
3. 在瀏覽器訪問 Backend URL + `/health` 確認 Backend 正常運行
4. 檢查 Vercel 的 Environment Variables 是否正確設定

---

## 📝 重要 URL 整理

部署完成後，記下以下 URL：

- **Frontend (Vercel)**: `https://your-frontend.vercel.app`
- **Backend (Render)**: `https://your-backend.onrender.com`
- **Database (Render)**: 在 Render Dashboard 查看

---

## 🎉 完成！

完成以上步驟後，您的 ERP 系統應該已經成功部署並運行在生產環境！

如果遇到任何問題，請參考 `README_DEPLOY.md` 中的詳細說明，或檢查 Render/Vercel 的 Logs 查看錯誤訊息。
