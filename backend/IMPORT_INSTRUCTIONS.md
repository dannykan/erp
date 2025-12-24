# 資料匯入說明

由於本地環境的依賴問題，建議使用以下方法之一將資料匯入到正式環境：

## 方法 1：使用 Docker（推薦，如果本地有 Docker）

如果您的本地環境有 Docker，可以使用以下方式：

```bash
# 建立一個臨時的 Docker container
docker run -it --rm \
  -v "$(pwd):/workspace" \
  -w /workspace \
  -e DATABASE_URL="postgresql://chopsticks_erp_user:2Uaf2tapblxF7gDAK09UoX8F5jrv75sl@dpg-d55p4fh5pdvs73c9i780-a.singapore-postgres.render.com/chopsticks_erp" \
  python:3.11-slim \
  bash -c "pip install -q psycopg2-binary sqlalchemy && python3 import_products.py '產品品項管理 - 工作表1.csv'"
```

## 方法 2：在 Render Shell 中執行（如果可用）

1. 進入 Render Dashboard → Web Service → Shell
2. 執行：
```bash
cd backend
python3 import_products.py "產品品項管理 - 工作表1.csv"
python3 import_customers.py "台悅出貨系統 2023_231024 - 客戶.csv"
```

## 方法 3：使用 Python Virtual Environment

```bash
cd backend
python3 -m venv venv
source venv/bin/activate  # 在 Windows 上使用: venv\Scripts\activate
pip install -r requirements.txt
export DATABASE_URL="postgresql://chopsticks_erp_user:2Uaf2tapblxF7gDAK09UoX8F5jrv75sl@dpg-d55p4fh5pdvs73c9i780-a.singapore-postgres.render.com/chopsticks_erp"
python3 import_products.py "產品品項管理 - 工作表1.csv"
python3 import_customers.py "台悅出貨系統 2023_231024 - 客戶.csv"
```

## 方法 4：透過 API 批量匯入（較慢，但不需要本地環境）

可以編寫一個 Python 腳本，讀取 CSV 並透過 API 批量匯入。

---

**注意**: 
- 使用 External Database URL 時，確保您的 IP 可以訪問 Render 的資料庫
- 如果遇到連線問題，可能需要將您的 IP 加入 Render 資料庫的允許清單

