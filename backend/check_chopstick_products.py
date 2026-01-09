#!/usr/bin/env python3
"""
檢查竹筷產品的狀態
"""

import sys
import re

# 直接導入資料庫相關模組
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.db import SessionLocal
from app.models import Product

def parse_product_name(name: str):
    """解析產品名稱"""
    match = re.match(r'\[([^\]]+)\]\s*(\S+)\s*(.+)?', name)
    if not match:
        return None, None, None, None
    
    category = match.group(1).strip()
    spec = match.group(2).strip()
    rest = match.group(3).strip() if match.group(3) else None
    
    if not rest:
        return category, spec, None, None
    
    pack_match = re.match(r'^(\d+X\d+)(?:\s+(.+))?$', rest)
    if pack_match:
        packaging = pack_match.group(1)
        wrap = pack_match.group(2).strip() if pack_match.group(2) else None
        return category, spec, packaging, wrap
    
    return category, spec, rest, None

def main():
    db = SessionLocal()
    
    try:
        # 查找所有竹筷產品
        all_chopsticks = db.query(Product).filter(
            Product.name.like('[ 竹筷 ]%')
        ).all()
        
        print(f"找到 {len(all_chopsticks)} 個竹筷產品\n")
        
        # 按規格和類型分組
        by_spec_type = {}
        
        for product in all_chopsticks:
            category, spec, packaging, wrap = parse_product_name(product.name)
            if not spec:
                continue
            
            key = f"{spec}_{product.product_type}"
            if key not in by_spec_type:
                by_spec_type[key] = []
            by_spec_type[key].append(product)
        
        # 顯示統計
        print("按規格和類型分組：")
        for key in sorted(by_spec_type.keys()):
            spec, ptype = key.split('_')
            count = len(by_spec_type[key])
            print(f"  {spec} ({ptype}): {count} 個")
            if count <= 5:
                for p in by_spec_type[key][:5]:
                    print(f"    - {p.sku}: {p.name} (is_active: {p.is_active})")
        
        # 特別檢查 5520 和 6020 的 FG 產品
        print("\n檢查 5520 和 6020 的 FG 產品：")
        for spec in ['5520', '6020']:
            fg_products = [p for p in all_chopsticks 
                          if parse_product_name(p.name)[1] == spec 
                          and p.product_type == 'FG'
                          and p.is_active == True]
            print(f"  {spec} (FG, active): {len(fg_products)} 個")
            if len(fg_products) == 0:
                # 檢查是否有非 FG 或非 active 的
                all_spec = [p for p in all_chopsticks if parse_product_name(p.name)[1] == spec]
                print(f"    (總共 {len(all_spec)} 個 {spec} 產品)")
                for p in all_spec[:10]:
                    print(f"      - {p.sku}: {p.name} (type: {p.product_type}, active: {p.is_active})")
        
    except Exception as e:
        print(f"錯誤: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    main()



