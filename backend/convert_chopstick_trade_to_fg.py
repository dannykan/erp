#!/usr/bin/env python3
"""
將竹筷的 TRADE 產品轉換為 FG 產品

功能：
1. 查找所有竹筷的 TRADE 產品（排除白身原物料）
2. 將它們的 product_type 改為 FG
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
        # 查找所有竹筷的 TRADE 產品（排除白身原物料）
        trade_chopsticks = db.query(Product).filter(
            Product.name.like('[ 竹筷 ]%'),
            Product.product_type == 'TRADE',
            Product.is_active == True
        ).all()
        
        # 排除白身原物料，以及紙包公版雙生筷、紙包私版雙生筷（這些是轉賣的，保持 TRADE）
        products_to_update = []
        excluded_patterns = ['白身', '紙包公版雙生筷', '紙包私版雙生筷']
        
        for product in trade_chopsticks:
            should_exclude = any(pattern in product.name for pattern in excluded_patterns)
            if not should_exclude:
                products_to_update.append(product)
        
        print(f"找到 {len(products_to_update)} 個竹筷 TRADE 產品（排除白身）")
        
        # 按規格分組統計
        by_spec = {}
        for product in products_to_update:
            match = re.match(r'\[([^\]]+)\]\s*(\S+)\s*(.+)?', product.name)
            if match:
                spec = match.group(2).strip()
                if spec not in by_spec:
                    by_spec[spec] = []
                by_spec[spec].append(product)
        
        print("\n按規格分組：")
        for spec in sorted(by_spec.keys()):
            print(f"  {spec}: {len(by_spec[spec])} 個")
            if len(by_spec[spec]) <= 3:
                for p in by_spec[spec]:
                    print(f"    - {p.sku}: {p.name}")
        
        if len(products_to_update) == 0:
            print("\n沒有需要轉換的產品")
            return
        
        # 確認
        response = input("\n是否繼續執行？將把這些產品的 product_type 從 TRADE 改為 FG (yes/no): ")
        if response.lower() != 'yes':
            print("已取消")
            return
        
        # 更新 product_type
        for product in products_to_update:
            product.product_type = 'FG'
            print(f"更新: {product.sku} ({product.name}) - TRADE -> FG")
        
        db.commit()
        print(f"\n完成！已將 {len(products_to_update)} 個產品的 product_type 改為 FG")
        
    except Exception as e:
        db.rollback()
        print(f"錯誤: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    main()

