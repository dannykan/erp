#!/usr/bin/env python3
"""
恢復原始「白身」產品腳本

功能：
1. 刪除所有「白身」包裝膜變體
2. 恢復原始的「白身」產品（B50014、B55017、B60015），product_type 設為 RAW
"""

import sys
import re

# 直接導入資料庫相關模組
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.db import SessionLocal
from app.models import Product

# 需要恢復的原始「白身」產品
ORIGINAL_WHITE_BODY_PRODUCTS = [
    {
        'sku': 'B50014',
        'name': '[ 竹筷 ] 5020 白身',
        'quotation_unit': '件',
        'pieces_per_case': 1,
        'pack_quantity': '1 件',
        'origin': 'CN',
    },
    {
        'sku': 'B55017',
        'name': '[ 竹筷 ] 5520 白身',
        'quotation_unit': '件',
        'pieces_per_case': 1,
        'pack_quantity': '1 件',
        'origin': 'CN',
    },
    {
        'sku': 'B60015',
        'name': '[ 竹筷 ] 6020 白身',
        'quotation_unit': '件',
        'pieces_per_case': 1,
        'pack_quantity': '1 件',
        'origin': 'CN',
    },
]

def main():
    db = SessionLocal()
    
    try:
        # 1. 查找所有「白身」產品
        white_body_products = db.query(Product).filter(
            Product.name.like('%白身%')
        ).all()
        
        print(f"找到 {len(white_body_products)} 個「白身」產品")
        
        products_to_delete = []  # 需要刪除的包裝膜變體
        
        for product in white_body_products:
            # 檢查是否是包裝膜變體（名稱包含「白身」且後面還有其他文字）
            match = re.match(r'\[([^\]]+)\]\s*(\S+)\s+白身\s+(.+)', product.name)
            if match:
                # 這是包裝膜變體，需要刪除
                print(f"刪除包裝膜變體: {product.sku} ({product.name})")
                products_to_delete.append(product)
            else:
                # 這是原始的「白身」產品，檢查是否需要更新 product_type
                print(f"檢查「白身」產品: {product.sku} ({product.name}) - product_type: {product.product_type}")
                if product.product_type != 'RAW':
                    print(f"  將更新 product_type: {product.product_type} -> RAW")
                    product.product_type = 'RAW'
        
        # 2. 檢查需要恢復的原始「白身」產品
        products_to_create = []
        for orig_data in ORIGINAL_WHITE_BODY_PRODUCTS:
            existing = db.query(Product).filter(Product.sku == orig_data['sku']).first()
            if not existing:
                print(f"需要恢復原始產品: {orig_data['sku']} ({orig_data['name']})")
                products_to_create.append(orig_data)
            else:
                print(f"原始產品已存在: {orig_data['sku']} ({orig_data['name']})")
        
        print(f"\n總結：")
        print(f"  將刪除 {len(products_to_delete)} 個包裝膜變體")
        print(f"  將恢復 {len(products_to_create)} 個原始「白身」產品")
        
        if len(products_to_delete) == 0 and len(products_to_create) == 0:
            print("\n沒有需要修正的產品")
            # 但還是要提交 product_type 的更新
            if any(p.product_type != 'RAW' for p in white_body_products if '白身' in p.name and not re.match(r'\[([^\]]+)\]\s*(\S+)\s+白身\s+(.+)', p.name)):
                db.commit()
                print("已更新現有「白身」產品的 product_type")
            return
        
        # 確認
        response = input("\n是否繼續執行？(yes/no): ")
        if response.lower() != 'yes':
            print("已取消")
            return
        
        # 刪除包裝膜變體
        for product in products_to_delete:
            db.delete(product)
        
        # 恢復原始「白身」產品
        for orig_data in products_to_create:
            new_product = Product(
                sku=orig_data['sku'],
                name=orig_data['name'],
                spec=None,
                unit='件',
                product_type='RAW',  # 設為 RAW
                base_unit='個',
                alt_unit=None,
                alt_ratio=None,
                safety_stock=0,
                is_active=True,
                quotation_unit=orig_data['quotation_unit'],
                pieces_per_case=orig_data['pieces_per_case'],
                pack_quantity=orig_data['pack_quantity'],
                model=None,
                brand=None,
                size=None,
                origin=orig_data['origin'],
            )
            db.add(new_product)
            print(f"恢復產品: {orig_data['sku']} ({orig_data['name']})")
        
        db.commit()
        print(f"\n完成！已刪除 {len(products_to_delete)} 個包裝膜變體，恢復 {len(products_to_create)} 個原始「白身」產品")
        
    except Exception as e:
        db.rollback()
        print(f"錯誤: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    main()



