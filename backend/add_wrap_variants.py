#!/usr/bin/env python3
"""
為竹筷產品添加包裝膜變體腳本

功能：
1. 查找所有竹筷產品（產品名稱以 [ 竹筷 ] 開頭）
2. 對於沒有包裝膜的產品：刪除原產品，創建8個包裝膜變體
3. 對於已有包裝膜的產品：保留原產品，創建其他7個包裝膜變體

包裝膜選項（按順序）：
1. 招財貓
2. 御箸
3. 花開富貴
4. OPP
5. 白膜
6. V版
7. 禾田
8. 台鐵

SKU格式：原SKU-1, 原SKU-2, ... 原SKU-8
"""

import sys
import re
from typing import Optional, List, Tuple

# 直接導入資料庫相關模組
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.db import SessionLocal
from app.models import Product

# 包裝膜選項（按順序）
WRAP_OPTIONS = [
    "招財貓",
    "御箸",
    "花開富貴",
    "OPP",
    "白膜",
    "V版",
    "禾田",
    "台鐵"
]

def parse_product_name(name: str) -> Tuple[Optional[str], Optional[str], Optional[str], Optional[str]]:
    """
    解析產品名稱，提取類別、規格、包裝、包裝膜
    
    格式：[ 類別 ] 規格 包裝 包裝膜
    例如：[ 竹筷 ] 5520 90X24 招財貓
    
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

def has_wrap(name: str, brand: Optional[str]) -> Tuple[bool, Optional[str]]:
    """
    檢查產品是否已有包裝膜
    
    返回：(has_wrap, wrap_name)
    """
    _, _, _, wrap_in_name = parse_product_name(name)
    
    # 優先檢查產品名稱中的包裝膜
    if wrap_in_name and wrap_in_name in WRAP_OPTIONS:
        return True, wrap_in_name
    
    # 其次檢查brand字段
    if brand and brand in WRAP_OPTIONS:
        return True, brand
    
    return False, None

def generate_new_products(original: Product, existing_wrap: Optional[str] = None) -> List[dict]:
    """
    為原產品生成包裝膜變體
    
    Args:
        original: 原產品
        existing_wrap: 如果原產品已有包裝膜，傳入包裝膜名稱
    
    Returns:
        新產品數據列表
    """
    category, spec, packaging, _ = parse_product_name(original.name)
    
    if not category or category != "竹筷":
        return []
    
    # 跳過「白身」產品（這些是原物料，不需要包裝膜變體）
    if "白身" in original.name:
        return []
    
    # 構建基礎產品名稱（不含包裝膜）
    # 檢查packaging是否是標準格式（數字X數字）
    is_standard_packaging = packaging and re.match(r'^\d+X\d+$', packaging)
    
    if is_standard_packaging:
        # 標準格式：[ 竹筷 ] 規格 包裝
        base_name = f"[ {category} ] {spec} {packaging}"
    elif packaging:
        # 特殊情況（注意：如果包含「白身」，應該已經在上面被跳過了）
        base_name = f"[ {category} ] {spec} {packaging}"
    else:
        # 沒有packaging的情況（理論上不應該發生）
        base_name = f"[ {category} ] {spec}"
    
    new_products = []
    wrap_index = 1
    
    for wrap in WRAP_OPTIONS:
        # 如果原產品已有此包裝膜，跳過
        if existing_wrap == wrap:
            continue
        
        # 生成新SKU
        if original.sku:
            new_sku = f"{original.sku}-{wrap_index}"
        else:
            new_sku = None
        
        # 生成新產品名稱
        new_name = f"{base_name} {wrap}"
        
        # 複製原產品的所有字段
        new_product = {
            "sku": new_sku,
            "name": new_name,
            "spec": original.spec,
            "unit": original.unit,
            "product_type": original.product_type,
            "base_unit": original.base_unit,
            "alt_unit": original.alt_unit,
            "alt_ratio": original.alt_ratio,
            "safety_stock": original.safety_stock,
            "is_active": original.is_active,
            "quotation_unit": original.quotation_unit,
            "pieces_per_case": original.pieces_per_case,
            "pack_quantity": original.pack_quantity,
            "model": original.model,
            "brand": wrap,  # 將包裝膜存儲在brand字段
            "size": original.size,
            "origin": original.origin,
        }
        
        new_products.append(new_product)
        wrap_index += 1
    
    return new_products

def main():
    db = SessionLocal()
    
    try:
        # 查找所有竹筷產品
        chopstick_products = db.query(Product).filter(
            Product.name.like('[ 竹筷 ]%')
        ).all()
        
        print(f"找到 {len(chopstick_products)} 個竹筷產品")
        
        products_to_delete = []
        products_to_create = []
        
        for product in chopstick_products:
            # 跳過「白身」產品（這些是原物料，不需要包裝膜變體）
            if "白身" in product.name:
                print(f"跳過「白身」產品: {product.sku} ({product.name})")
                continue
            
            has_wrap_flag, existing_wrap = has_wrap(product.name, product.brand)
            
            if has_wrap_flag:
                # 已有包裝膜：保留原產品，創建其他7個變體
                print(f"產品 {product.sku} ({product.name}) 已有包裝膜: {existing_wrap}")
                new_products = generate_new_products(product, existing_wrap)
                products_to_create.extend(new_products)
                print(f"  將創建 {len(new_products)} 個新變體")
            else:
                # 沒有包裝膜：刪除原產品，創建8個變體
                print(f"產品 {product.sku} ({product.name}) 沒有包裝膜，將刪除並創建8個變體")
                products_to_delete.append(product)
                new_products = generate_new_products(product)
                products_to_create.extend(new_products)
                print(f"  將創建 {len(new_products)} 個新變體")
        
        print(f"\n總結：")
        print(f"  將刪除 {len(products_to_delete)} 個產品")
        print(f"  將創建 {len(products_to_create)} 個新產品")
        
        # 確認
        response = input("\n是否繼續執行？(yes/no): ")
        if response.lower() != 'yes':
            print("已取消")
            return
        
        # 刪除產品
        for product in products_to_delete:
            print(f"刪除產品: {product.sku} ({product.name})")
            db.delete(product)
        
        # 創建新產品
        for product_data in products_to_create:
            new_product = Product(**product_data)
            db.add(new_product)
            print(f"創建產品: {product_data['sku']} ({product_data['name']})")
        
        db.commit()
        print(f"\n完成！已刪除 {len(products_to_delete)} 個產品，創建 {len(products_to_create)} 個新產品")
        
    except Exception as e:
        db.rollback()
        print(f"錯誤: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    main()

