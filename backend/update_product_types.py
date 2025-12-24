#!/usr/bin/env python3
"""
一次性資料補齊腳本：根據商品名稱自動設定 product_type

使用方式：
    python update_product_types.py

規則：
    - 名稱含「筷」「包裝」「成品」→ FG
    - 名稱含「袋」「貼紙」「裸筷」「原料」→ RAW
    - 其餘預設 TRADE
"""
import sqlite3
import sys
from pathlib import Path

DB_PATH = Path(__file__).parent / "app.db"

def update_product_types():
    if not DB_PATH.exists():
        print(f"錯誤：找不到資料庫 {DB_PATH}")
        sys.exit(1)

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    # 取得所有商品
    cursor.execute("SELECT id, name FROM products")
    products = cursor.fetchall()

    updates = []
    for product_id, name in products:
        name_lower = (name or "").lower()
        
        # 判斷規則
        if any(kw in name_lower for kw in ["筷", "包裝", "成品"]):
            new_type = "FG"
        elif any(kw in name_lower for kw in ["袋", "貼紙", "裸筷", "原料"]):
            new_type = "RAW"
        else:
            new_type = "TRADE"
        
        updates.append((new_type, product_id))
        print(f"商品 #{product_id} ({name}) → {new_type}")

    # 批量更新
    cursor.executemany(
        "UPDATE products SET product_type = ? WHERE id = ?",
        updates
    )

    conn.commit()
    print(f"\n已更新 {len(updates)} 筆商品")
    conn.close()

if __name__ == "__main__":
    update_product_types()

