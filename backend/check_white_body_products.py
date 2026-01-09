#!/usr/bin/env python3
"""
檢查「白身」產品狀態
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
        # 查找所有「白身」產品
        white_body_products = db.query(Product).filter(
            Product.name.like('%白身%')
        ).all()
        
        print(f"找到 {len(white_body_products)} 個「白身」產品\n")
        
        variants = []  # 包裝膜變體
        originals = []  # 原始「白身」產品
        
        for product in white_body_products:
            # 檢查是否是包裝膜變體（名稱包含「白身」且後面還有其他文字）
            match = re.match(r'\[([^\]]+)\]\s*(\S+)\s+白身\s+(.+)', product.name)
            if match:
                variants.append(product)
            else:
                originals.append(product)
        
        print(f"包裝膜變體: {len(variants)} 個")
        for p in variants:
            print(f"  - {p.sku}: {p.name} (product_type: {p.product_type})")
        
        print(f"\n原始「白身」產品: {len(originals)} 個")
        for p in originals:
            print(f"  - {p.sku}: {p.name} (product_type: {p.product_type})")
        
        # 檢查是否有應該存在但缺失的原始「白身」產品
        expected_originals = ['B50014', 'B55017', 'B60015']
        missing = []
        for sku in expected_originals:
            found = any(p.sku == sku for p in originals)
            if not found:
                missing.append(sku)
        
        if missing:
            print(f"\n⚠️  缺失的原始「白身」產品 SKU: {missing}")
            print("這些產品可能在之前的腳本執行中被誤刪除了")
        
    except Exception as e:
        print(f"錯誤: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    main()



