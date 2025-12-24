#!/usr/bin/env python3
"""
匯入資料到正式環境
執行方式：
export DATABASE_URL="postgresql://user:pass@host:port/dbname"
python3 import_to_production.py
"""

import os
import sys

# 檢查 DATABASE_URL
if not os.getenv("DATABASE_URL"):
    print("錯誤: 請設定 DATABASE_URL 環境變數")
    print("例如: export DATABASE_URL='postgresql://user:pass@host:port/dbname'")
    sys.exit(1)

# 執行產品匯入
print("=" * 60)
print("開始匯入產品資料...")
print("=" * 60)
try:
    from import_products import import_products
    import_products("產品品項管理 - 工作表1.csv")
except Exception as e:
    print(f"產品匯入失敗: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

# 執行客戶匯入
print("\n" + "=" * 60)
print("開始匯入客戶資料...")
print("=" * 60)
try:
    from import_customers import import_customers
    import_customers("台悅出貨系統 2023_231024 - 客戶.csv")
except Exception as e:
    print(f"客戶匯入失敗: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

print("\n" + "=" * 60)
print("所有資料匯入完成！")
print("=" * 60)

