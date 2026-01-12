# Windows 列印 Agent 設定指南

## 概述

Windows Agent 是一個運行在 Windows 電腦上的程式，負責從後端拉取列印任務並發送到本地列印機。

## 重要：API URL 設定

**⚠️ 注意：`CLOUD_BASE` 必須指向後端 API，不是前端！**

- ✅ **正確**：`https://chopsticks-erp-backend.onrender.com`（後端 API）
- ❌ **錯誤**：`https://chopsticks-erp.vercel.app`（前端，這不會工作）

### 後端 URL 格式

根據 `render.yaml`，後端服務名稱是 `chopsticks-erp-backend`，在 Render 上部署後的 URL 格式通常是：

```
https://chopsticks-erp-backend.onrender.com
```

如果您的服務名稱不同，請查看 Render Dashboard 中的實際 URL。

## Windows Agent 啟動設定

### PowerShell 環境變數設定

在 PowerShell 中執行以下命令來設定環境變數並啟動 Agent：

```powershell
# 設定後端 API URL（必須是後端的 URL，不是前端！）
$env:CLOUD_BASE="https://chopsticks-erp-backend.onrender.com"

# 設定 Print Agent Token（必須與後端 config.py 中的值一致）
$env:PRINT_AGENT_TOKEN="26980288"

# 設定列印機名稱（根據您的實際列印機調整）
$env:PRINTER_NAME="EPSON LQ-690CIIN ESC/P2"

# 啟動 Agent
python C:\print_agent\agent.py
```

### 永久設定（系統環境變數）

如果您想永久設定這些環境變數，可以使用以下方式：

**方法一：透過系統設定（推薦）**

1. 按 `Win + R`，輸入 `sysdm.cpl`，按 Enter
2. 點選「進階」標籤
3. 點選「環境變數」
4. 在「系統變數」區塊點選「新增」
5. 新增以下變數：
   - `CLOUD_BASE` = `https://chopsticks-erp-backend.onrender.com`
   - `PRINT_AGENT_TOKEN` = `26980288`
   - `PRINTER_NAME` = `EPSON LQ-690CIIN ESC/P2`

**方法二：建立啟動腳本**

建立 `C:\print_agent\start_agent.ps1`：

```powershell
# start_agent.ps1
$env:CLOUD_BASE="https://chopsticks-erp-backend.onrender.com"
$env:PRINT_AGENT_TOKEN="26980288"
$env:PRINTER_NAME="EPSON LQ-690CIIN ESC/P2"

python C:\print_agent\agent.py
```

然後執行：
```powershell
.\start_agent.ps1
```

## Agent.py 程式碼範例

以下是一個基本的 Agent 實作範例，您可以根據需求調整：

```python
# C:\print_agent\agent.py
import os
import time
import base64
import requests
from datetime import datetime
from PIL import Image
import io

CLOUD_BASE = os.getenv("CLOUD_BASE", "http://localhost:8000")
PRINT_AGENT_TOKEN = os.getenv("PRINT_AGENT_TOKEN", "")
PRINTER_NAME = os.getenv("PRINTER_NAME", "")

def get_next_job():
    """從後端拉取下一個列印任務"""
    url = f"{CLOUD_BASE}/print-jobs/next"
    headers = {
        "Authorization": f"Bearer {PRINT_AGENT_TOKEN}",
        "X-Agent-Id": "win-agent-001"
    }
    
    try:
        response = requests.get(url, headers=headers, timeout=10)
        if response.status_code == 204:
            # 沒有任務
            return None
        if response.status_code == 200:
            return response.json()
        else:
            print(f"錯誤：HTTP {response.status_code} - {response.text}")
            return None
    except Exception as e:
        print(f"請求失敗：{e}")
        return None

def ack_job(job_id, ok, message=""):
    """回報任務執行結果"""
    url = f"{CLOUD_BASE}/print-jobs/{job_id}/ack"
    headers = {
        "Authorization": f"Bearer {PRINT_AGENT_TOKEN}",
        "Content-Type": "application/json"
    }
    payload = {
        "ok": ok,
        "message": message
    }
    
    try:
        response = requests.post(url, json=payload, headers=headers, timeout=10)
        if response.status_code == 200:
            print(f"✓ 任務 {job_id} 回報成功")
            return True
        else:
            print(f"回報失敗：HTTP {response.status_code} - {response.text}")
            return False
    except Exception as e:
        print(f"回報請求失敗：{e}")
        return False

def print_pdf(base64_pdf, copies=1):
    """將 Base64 編碼的 PDF 發送到列印機"""
    try:
        # 解碼 Base64
        pdf_bytes = base64.b64decode(base64_pdf)
        
        # 儲存為臨時檔案
        temp_file = f"C:\\temp\\print_{datetime.now().strftime('%Y%m%d_%H%M%S')}.pdf"
        os.makedirs(os.path.dirname(temp_file), exist_ok=True)
        
        with open(temp_file, 'wb') as f:
            f.write(pdf_bytes)
        
        # 使用 Windows 預設列印指令列印
        import subprocess
        for _ in range(copies):
            subprocess.run([
                "powershell",
                "-Command",
                f"Start-Process -FilePath '{temp_file}' -Verb Print -WindowStyle Hidden"
            ], check=True)
            if copies > 1:
                time.sleep(1)  # 多份列印間隔
        
        # 清理臨時檔案（可選，延遲刪除）
        time.sleep(5)
        if os.path.exists(temp_file):
            os.remove(temp_file)
        
        return True
    except Exception as e:
        print(f"列印失敗：{e}")
        return False

def print_image(base64_image, copies=1):
    """將 Base64 編碼的圖片（PNG）發送到列印機"""
    try:
        from PIL import Image
        import io
        
        # 解碼 Base64
        image_bytes = base64.b64decode(base64_image)
        
        # 使用 PIL 打開圖片
        img = Image.open(io.BytesIO(image_bytes))
        
        # 轉換為 BMP 格式（Windows 點陣印表機更支持 BMP）
        bmp_buffer = io.BytesIO()
        img.save(bmp_buffer, format='BMP')
        bmp_bytes = bmp_buffer.getvalue()
        
        # 儲存為臨時檔案
        temp_file = f"C:\\temp\\print_{datetime.now().strftime('%Y%m%d_%H%M%S')}.bmp"
        os.makedirs(os.path.dirname(temp_file), exist_ok=True)
        
        with open(temp_file, 'wb') as f:
            f.write(bmp_bytes)
        
        # 使用 Windows 預設列印指令列印
        import subprocess
        for _ in range(copies):
            subprocess.run([
                "powershell",
                "-Command",
                f"Start-Process -FilePath '{temp_file}' -Verb Print -WindowStyle Hidden"
            ], check=True)
            if copies > 1:
                time.sleep(1)  # 多份列印間隔
        
        # 清理臨時檔案（可選，延遲刪除）
        time.sleep(5)
        if os.path.exists(temp_file):
            os.remove(temp_file)
        
        return True
    except Exception as e:
        print(f"列印圖片失敗：{e}")
        return False

def main():
    """主迴圈"""
    print(f"列印 Agent 啟動")
    print(f"後端 URL: {CLOUD_BASE}")
    print(f"列印機: {PRINTER_NAME}")
    print(f"Token: {PRINT_AGENT_TOKEN[:8]}...")
    print("-" * 50)
    
    while True:
        try:
            # 拉取任務
            job = get_next_job()
            
            if job:
                job_id = job["id"]
                job_kind = job.get("kind", "raw")
                job_text = job["text"]
                copies = job.get("copies", 1)
                
                print(f"[{datetime.now()}] 收到任務: {job_id} (類型: {job_kind}, 份數: {copies})")
                
                # 根據任務類型選擇列印方式
                if job_kind == "image_text":
                    print(f"列印 IMG job={job_id} rotate={os.getenv('ROTATE_DEG', '0')}")
                    success = print_image(job_text, copies)
                else:
                    print(f"列印 RAW job={job_id}")
                    success = print_pdf(job_text, copies)
                
                # 回報結果
                if success:
                    ack_job(job_id, True, "列印成功")
                    print(f"✓ 任務 {job_id} 完成")
                else:
                    ack_job(job_id, False, "列印失敗")
                    print(f"✗ 任務 {job_id} 失敗")
            else:
                # 沒有任務，等待 5 秒後再試
                time.sleep(5)
                
        except KeyboardInterrupt:
            print("\n收到停止訊號，正在退出...")
            break
        except Exception as e:
            print(f"發生錯誤：{e}")
            time.sleep(5)

if __name__ == "__main__":
    main()
```

## 依賴套件安裝

在執行 Agent 之前，需要安裝 Python 依賴：

```powershell
pip install requests pillow
```

**注意：** `pillow` 用於處理 `image_text` 類型的列印任務（將 PNG 轉換為 BMP 格式）。

## 驗證設定

### 1. 檢查環境變數

```powershell
Write-Host "CLOUD_BASE: $env:CLOUD_BASE"
Write-Host "PRINT_AGENT_TOKEN: $env:PRINT_AGENT_TOKEN"
Write-Host "PRINTER_NAME: $env:PRINTER_NAME"
```

### 2. 測試後端連接

```powershell
# 測試後端健康檢查
Invoke-WebRequest -Uri "$env:CLOUD_BASE/health" -Method GET

# 測試拉取任務（需要正確的 Token）
$headers = @{
    "Authorization" = "Bearer $env:PRINT_AGENT_TOKEN"
    "X-Agent-Id" = "test-agent"
}
Invoke-WebRequest -Uri "$env:CLOUD_BASE/print-jobs/next" -Method GET -Headers $headers
```

## 常見問題

### Q: Agent 無法連接到後端

**A:** 檢查以下項目：
1. `CLOUD_BASE` 是否指向後端的 URL（不是前端）
2. 後端是否正常運行（訪問 `https://your-backend-url.onrender.com/health`）
3. 防火牆是否阻擋連接

### Q: 收到 401 或 403 錯誤

**A:** 檢查：
1. `PRINT_AGENT_TOKEN` 是否與後端 `config.py` 中的值一致
2. Authorization Header 格式是否正確：`Bearer <token>`

### Q: 收到 204 No Content

**A:** 這是正常的，表示目前沒有列印任務。Agent 會繼續輪詢。

### Q: 列印機沒有反應

**A:** 檢查：
1. `PRINTER_NAME` 是否正確（在 Windows 中查看實際的列印機名稱）
2. 列印機是否已安裝並設為預設列印機
3. 檢查 Windows 列印佇列是否有錯誤

## 作為 Windows 服務運行（進階）

如果您想將 Agent 作為 Windows 服務運行，可以使用 `pywin32` 或 `NSSM`（Non-Sucking Service Manager）：

**使用 NSSM：**

1. 下載 NSSM：https://nssm.cc/download
2. 建立服務：

```powershell
nssm install PrintAgent "C:\Python\python.exe" "C:\print_agent\agent.py"
nssm set PrintAgent AppEnvironmentExtra CLOUD_BASE=https://chopsticks-erp-backend.onrender.com PRINT_AGENT_TOKEN=26980288 PRINTER_NAME="EPSON LQ-690CIIN ESC/P2"
nssm start PrintAgent
```

## 監控和日誌

建議在 Agent 中添加日誌記錄功能，以便追蹤問題：

```python
import logging

logging.basicConfig(
    filename='C:\\print_agent\\agent.log',
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
```

這樣可以更容易地追蹤 Agent 的運行狀況。

