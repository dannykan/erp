#!/usr/bin/env python3
"""
批量設定竹筷產品的 BOM（物料消耗關係）

功能：
1. 查找所有 5020 系列成品（FG），設定消耗 [ 竹筷 ] 5020 白身
2. 查找所有 5520 系列成品（FG），設定消耗 [ 竹筷 ] 5520 白身
3. 查找所有 6020 系列成品（FG），設定消耗 [ 竹筷 ] 6020 白身

計算 qty_per_fg_unit：
- 從產品名稱的包裝中提取數字，例如 90X24 = 2160
- 每 1 件成品消耗 2160 個原物料單位
"""

import sys
import re

# 直接導入資料庫相關模組
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.db import SessionLocal
from app.models import Product, BomItem

def parse_product_name(name: str) -> tuple:
    """
    解析產品名稱，提取類別、規格、包裝、包裝膜
    
    返回：(category, spec, packaging, wrap)
    """
    match = re.match(r'\[([^\]]+)\]\s*(\S+)\s*(.+)?', name)
    if not match:
        return None, None, None, None
    
    category = match.group(1).strip()
    spec = match.group(2).strip()
    rest = match.group(3).strip() if match.group(3) else None
    
    if not rest:
        return category, spec, None, None
    
    # 包裝格式：數字X數字，後面可能跟著文字（包裝膜）
    pack_match = re.match(r'^(\d+X\d+)(?:\s+(.+))?$', rest)
    if pack_match:
        packaging = pack_match.group(1)
        wrap = pack_match.group(2).strip() if pack_match.group(2) else None
        return category, spec, packaging, wrap
    
    # 如果不符合包裝格式，可能是特殊情況（如"白身"）
    return category, spec, rest, None

def calculate_qty_per_fg_unit(packaging: str) -> float:
    """
    從包裝中計算每件成品消耗的原物料數量
    
    例如：90X24 = 90 * 24 = 2160
    """
    if not packaging:
        return 1.0  # 默認值
    
    match = re.match(r'^(\d+)X(\d+)$', packaging)
    if match:
        num1 = int(match.group(1))
        num2 = int(match.group(2))
        return float(num1 * num2)
    
    return 1.0  # 如果無法解析，使用默認值

def find_white_body_product(db, spec: str) -> Product | None:
    """查找對應規格的白身原物料"""
    white_body_name = f"[ 竹筷 ] {spec} 白身"
    return db.query(Product).filter(
        Product.name == white_body_name,
        Product.product_type == 'RAW'
    ).first()

def main():
    db = SessionLocal()
    
    try:
        # 查找所有竹筷成品（FG）
        fg_products = db.query(Product).filter(
            Product.name.like('[ 竹筷 ]%'),
            Product.product_type == 'FG',
            Product.is_active == True
        ).all()
        
        print(f"找到 {len(fg_products)} 個竹筷成品（FG）")
        
        # 按規格分組
        spec_5020 = []
        spec_5520 = []
        spec_6020 = []
        other_specs = []
        
        for product in fg_products:
            _, spec, packaging, _ = parse_product_name(product.name)
            if spec == '5020':
                spec_5020.append(product)
            elif spec == '5520':
                spec_5520.append(product)
            elif spec == '6020':
                spec_6020.append(product)
            else:
                other_specs.append(product)
        
        print(f"\n規格分組：")
        print(f"  5020 系列: {len(spec_5020)} 個")
        print(f"  5520 系列: {len(spec_5520)} 個")
        print(f"  6020 系列: {len(spec_6020)} 個")
        if other_specs:
            print(f"  其他規格: {len(other_specs)} 個")
        
        # 查找白身原物料
        white_body_5020 = find_white_body_product(db, '5020')
        white_body_5520 = find_white_body_product(db, '5520')
        white_body_6020 = find_white_body_product(db, '6020')
        
        if not white_body_5020:
            print("\n⚠️  找不到 [ 竹筷 ] 5020 白身 原物料")
        if not white_body_5520:
            print("⚠️  找不到 [ 竹筷 ] 5520 白身 原物料")
        if not white_body_6020:
            print("⚠️  找不到 [ 竹筷 ] 6020 白身 原物料")
        
        if not white_body_5020 or not white_body_5520 or not white_body_6020:
            print("\n請先執行 restore_white_body_products.py 恢復白身原物料")
            return
        
        # 準備 BOM 設定
        bom_items_to_create = []
        
        # 5020 系列
        for product in spec_5020:
            _, spec, packaging, _ = parse_product_name(product.name)
            qty_per_fg_unit = calculate_qty_per_fg_unit(packaging)
            
            # 檢查是否已存在 BOM
            existing = db.query(BomItem).filter(
                BomItem.fg_product_id == product.id,
                BomItem.raw_product_id == white_body_5020.id,
                BomItem.is_active == True
            ).first()
            
            if existing:
                # 更新現有的 BOM
                if existing.qty_per_fg_unit != qty_per_fg_unit:
                    print(f"更新 BOM: {product.sku} ({product.name}) - qty_per_fg_unit: {existing.qty_per_fg_unit} -> {qty_per_fg_unit}")
                    existing.qty_per_fg_unit = qty_per_fg_unit
                else:
                    print(f"已存在: {product.sku} ({product.name}) - qty_per_fg_unit: {qty_per_fg_unit}")
            else:
                # 創建新的 BOM
                bom_item = BomItem(
                    fg_product_id=product.id,
                    raw_product_id=white_body_5020.id,
                    qty_per_fg_unit=qty_per_fg_unit,
                    note=None,
                    is_active=True,
                )
                db.add(bom_item)
                bom_items_to_create.append((product.sku, product.name, qty_per_fg_unit))
                print(f"創建 BOM: {product.sku} ({product.name}) - qty_per_fg_unit: {qty_per_fg_unit}")
        
        # 5520 系列
        for product in spec_5520:
            _, spec, packaging, _ = parse_product_name(product.name)
            qty_per_fg_unit = calculate_qty_per_fg_unit(packaging)
            
            existing = db.query(BomItem).filter(
                BomItem.fg_product_id == product.id,
                BomItem.raw_product_id == white_body_5520.id,
                BomItem.is_active == True
            ).first()
            
            if existing:
                if existing.qty_per_fg_unit != qty_per_fg_unit:
                    print(f"更新 BOM: {product.sku} ({product.name}) - qty_per_fg_unit: {existing.qty_per_fg_unit} -> {qty_per_fg_unit}")
                    existing.qty_per_fg_unit = qty_per_fg_unit
                else:
                    print(f"已存在: {product.sku} ({product.name}) - qty_per_fg_unit: {qty_per_fg_unit}")
            else:
                bom_item = BomItem(
                    fg_product_id=product.id,
                    raw_product_id=white_body_5520.id,
                    qty_per_fg_unit=qty_per_fg_unit,
                    note=None,
                    is_active=True,
                )
                db.add(bom_item)
                bom_items_to_create.append((product.sku, product.name, qty_per_fg_unit))
                print(f"創建 BOM: {product.sku} ({product.name}) - qty_per_fg_unit: {qty_per_fg_unit}")
        
        # 6020 系列
        for product in spec_6020:
            _, spec, packaging, _ = parse_product_name(product.name)
            qty_per_fg_unit = calculate_qty_per_fg_unit(packaging)
            
            existing = db.query(BomItem).filter(
                BomItem.fg_product_id == product.id,
                BomItem.raw_product_id == white_body_6020.id,
                BomItem.is_active == True
            ).first()
            
            if existing:
                if existing.qty_per_fg_unit != qty_per_fg_unit:
                    print(f"更新 BOM: {product.sku} ({product.name}) - qty_per_fg_unit: {existing.qty_per_fg_unit} -> {qty_per_fg_unit}")
                    existing.qty_per_fg_unit = qty_per_fg_unit
                else:
                    print(f"已存在: {product.sku} ({product.name}) - qty_per_fg_unit: {qty_per_fg_unit}")
            else:
                bom_item = BomItem(
                    fg_product_id=product.id,
                    raw_product_id=white_body_6020.id,
                    qty_per_fg_unit=qty_per_fg_unit,
                    note=None,
                    is_active=True,
                )
                db.add(bom_item)
                bom_items_to_create.append((product.sku, product.name, qty_per_fg_unit))
                print(f"創建 BOM: {product.sku} ({product.name}) - qty_per_fg_unit: {qty_per_fg_unit}")
        
        print(f"\n總結：")
        print(f"  將創建/更新 {len(bom_items_to_create)} 個 BOM 項目")
        
        if len(bom_items_to_create) == 0:
            print("\n沒有需要設定的 BOM")
            db.commit()
            return
        
        # 確認
        response = input("\n是否繼續執行？(yes/no): ")
        if response.lower() != 'yes':
            print("已取消")
            return
        
        db.commit()
        print(f"\n完成！已設定 {len(bom_items_to_create)} 個 BOM 項目")
        
    except Exception as e:
        db.rollback()
        print(f"錯誤: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    main()



