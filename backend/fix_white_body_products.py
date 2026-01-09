#!/usr/bin/env python3
"""
修正「白身」產品腳本

功能：
1. 刪除所有「白身」包裝膜變體（名稱包含「白身」且後面還有包裝膜的產品）
2. 將所有「白身」產品的 product_type 改為 RAW
3. 確保「白身」產品的名稱格式正確（不包含包裝膜）
"""

import sys
import re

# 直接導入資料庫相關模組
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.db import SessionLocal
from app.models import Product

def main():
    db = SessionLocal()
    
    try:
        # 1. 查找所有「白身」產品
        white_body_products = db.query(Product).filter(
            Product.name.like('%白身%')
        ).all()
        
        print(f"找到 {len(white_body_products)} 個「白身」產品")
        
        products_to_delete = []  # 需要刪除的包裝膜變體
        products_to_update = []  # 需要更新 product_type 的產品
        
        for product in white_body_products:
            # 檢查是否是包裝膜變體（名稱包含「白身」且後面還有其他文字）
            # 例如：[ 竹筷 ] 5020 白身 招財貓
            match = re.match(r'\[([^\]]+)\]\s*(\S+)\s+白身\s+(.+)', product.name)
            if match:
                # 這是包裝膜變體，需要刪除
                print(f"刪除包裝膜變體: {product.sku} ({product.name})")
                products_to_delete.append(product)
            else:
                # 這是正常的「白身」產品（名稱格式： [ 竹筷 ] 5020 白身）
                print(f"檢查「白身」產品: {product.sku} ({product.name}) - product_type: {product.product_type}")
                if product.product_type != 'RAW':
                    print(f"  更新 product_type: {product.product_type} -> RAW")
                    products_to_update.append(product)
                else:
                    print(f"  已正確 (product_type: RAW)")
        
        print(f"\n總結：")
        print(f"  將刪除 {len(products_to_delete)} 個包裝膜變體")
        print(f"  將更新 {len(products_to_update)} 個產品的 product_type 為 RAW")
        
        if len(products_to_delete) == 0 and len(products_to_update) == 0:
            print("\n沒有需要修正的產品")
            return
        
        # 確認
        response = input("\n是否繼續執行？(yes/no): ")
        if response.lower() != 'yes':
            print("已取消")
            return
        
        # 刪除包裝膜變體
        for product in products_to_delete:
            db.delete(product)
        
        # 更新 product_type
        for product in products_to_update:
            product.product_type = 'RAW'
        
        db.commit()
        print(f"\n完成！已刪除 {len(products_to_delete)} 個包裝膜變體，更新 {len(products_to_update)} 個產品的 product_type")
        
    except Exception as e:
        db.rollback()
        print(f"錯誤: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    main()
