# Print Agent 設定說明

## 概述

Print Agent 是一個 Windows 服務，用於從後端拉取列印任務並發送到本地列印機。

## 環境變數設定

### 後端設定

在 `backend/.env` 檔案中設定以下環境變數：

```env
PRINT_AGENT_TOKEN=26980288
```

**注意：**
- `.env` 檔案已被 `.gitignore` 忽略，不會提交到 Git
- `.env.example` 是範本檔案，可以提交到 Git 作為參考
- 生產環境建議使用更複雜的 token

### 設定優先順序

環境變數的載入優先順序：
1. `.env` 檔案中的設定（最高優先）
2. `config.py` 中的預設值

## Windows Agent 設定

### 驗證方式

Windows Agent 在呼叫後端 API 時，需要在 HTTP Header 中帶上 Bearer Token：

```
Authorization: Bearer 26980288
```

### API 端點

Windows Agent 需要呼叫以下端點：

1. **拉取任務**：`GET /print-jobs/next`
   - 需要 Header: `Authorization: Bearer 26980288`
   - 返回：列印任務資訊（包含 PDF Base64 編碼）
   - 如果沒有任務，返回 204 No Content

2. **回報結果**：`POST /print-jobs/{job_id}/ack`
   - 需要 Header: `Authorization: Bearer 26980288`
   - Body: `{"ok": true, "message": "列印成功"}`
   - 或: `{"ok": false, "message": "錯誤訊息"}`

### 範例請求

#### 拉取任務

```http
GET /print-jobs/next HTTP/1.1
Host: your-backend-url.com
Authorization: Bearer 26980288
X-Agent-Id: win-agent-001
```

**成功回應** (200):
```json
{
  "id": "job_abc123...",
  "kind": "raw",
  "text": "JVBERi0xLjQKJeLjz9MKMSAwIG9iago8PC...",
  "encoding": "cp950",
  "copies": 1
}
```

**無任務** (204):
```
(無內容)
```

#### 回報結果

```http
POST /print-jobs/job_abc123.../ack HTTP/1.1
Host: your-backend-url.com
Authorization: Bearer 26980288
Content-Type: application/json

{
  "ok": true,
  "message": "列印成功"
}
```

## 資料格式說明

### Print Job 格式

- `id`: 任務 ID（格式：`job_<uuid>`）
- `kind`: 任務類型（目前只支援 `"raw"`）
- `text`: PDF 內容（Base64 編碼的字串）
- `encoding`: 編碼方式（預設：`"cp950"`，適合繁體中文 Windows）
- `copies`: 列印份數（1-20）

### PDF 處理流程

1. 前端將 PDF Blob 轉換為 Base64 字串
2. 後端將 Base64 字串存儲在 `print_jobs` 表的 `text` 欄位
3. Windows Agent 拉取任務時獲得 Base64 字串
4. Agent 將 Base64 解碼為原始 PDF 字節
5. Agent 將 PDF 發送到列印機列印

## 安全建議

1. **Token 強度**：生產環境建議使用更長的隨機字串作為 token
2. **HTTPS**：生產環境務必使用 HTTPS 傳輸
3. **Token 輪換**：定期更換 token 以提高安全性
4. **IP 白名單**：如果可能，限制 Agent 的來源 IP

## 故障排除

### Agent 無法拉取任務

1. 檢查 token 是否正確
2. 檢查 Authorization Header 格式：`Bearer <token>`
3. 檢查後端日誌是否有錯誤訊息

### 列印失敗

1. 檢查 PDF Base64 解碼是否正確
2. 檢查列印機連接狀態
3. 檢查編碼設定（cp950）是否適合您的系統

## 測試

可以使用以下命令測試 API：

```bash
# 測試拉取任務（需要正確的 token）
curl -H "Authorization: Bearer 26980288" \
     -H "X-Agent-Id: test-agent" \
     http://localhost:8000/print-jobs/next
```

