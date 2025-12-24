#!/usr/bin/env python3
"""
批量導入產品腳本
從 CSV 文件導入產品到資料庫

CSV 格式（第一行為標題）：
貨號,產品名稱,報價單位,件入數(箱入數),包入數,型號,規格,品牌,尺寸,產地

使用方法：
1. 從 Google Sheets 導出為 CSV
2. 執行: python import_products.py products.csv
"""

import sys
import csv
import re
from typing import Optional
from datetime import datetime

# 直接導入資料庫相關模組
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.db import SessionLocal, engine, Base
from app.models import Product

def parse_pieces_per_case(value: str) -> Optional[int]:
    """解析件入數，例如 '27 包' -> 27"""
    if not value or value.strip() == '':
        return None
    try:
        # 提取數字部分
        match = re.search(r'(\d+)', str(value))
        if match:
            return int(match.group(1))
    except:
        pass
    return None

def parse_pack_quantity(value: str) -> Optional[str]:
    """解析包入數，例如 '100 雙' -> '100 雙'"""
    if not value or value.strip() == '':
        return None
    return str(value).strip()

def determine_product_type(name: str) -> str:
    """根據產品名稱判斷產品類型"""
    name_lower = name.lower()
    if '原物料' in name_lower or 'raw' in name_lower:
        return "RAW"
    elif '成品' in name_lower or 'fg' in name_lower:
        return "FG"
    else:
        return "TRADE"  # 預設為外購轉賣

def import_products(csv_file: str):
    """從 CSV 文件導入產品"""
    # 確保資料庫表存在
    Base.metadata.create_all(bind=engine)
    
    db = SessionLocal()
    created = []
    skipped = []
    errors = []
    
    try:
        products = []
        
        with open(csv_file, 'r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            
            for row in reader:
                sku = row.get('貨號', '').strip()
                name = row.get('產品名稱', '').strip()
                
                if not name:
                    print(f"跳過：產品名稱為空 (SKU: {sku})")
                    continue
                
                # 解析規格（可能從產品名稱中提取）
                spec = row.get('規格', '').strip()
                if not spec and '[' in name and ']' in name:
                    # 嘗試從名稱中提取規格，例如 "[竹筷] 5020 100X27" -> spec: "5020 100X27"
                    parts = name.split(']')
                    if len(parts) > 1:
                        spec = parts[1].strip()
                
                quotation_unit = row.get('報價單位', '').strip() or '件'
                # 尝试多种可能的列名（处理换行符问题）
                pieces_per_case_value = (row.get('件入數(箱入數)', '') or 
                                        row.get('件入數\n(箱入數)', '') or 
                                        row.get('件入數\r\n(箱入數)', '') or
                                        row.get('件入數\r(箱入數)', ''))
                pieces_per_case = parse_pieces_per_case(pieces_per_case_value)
                pack_quantity = parse_pack_quantity(row.get('包入數', ''))
                model = row.get('型號', '').strip() or None
                brand = row.get('品牌', '').strip() or None
                size = row.get('尺寸', '').strip() or None
                origin = row.get('產地', '').strip() or None
                
                # 判斷產品類型
                product_type = determine_product_type(name)
                
                products.append({
                    "sku": sku if sku else None,
                    "name": name,
                    "spec": spec if spec else None,
                    "unit": quotation_unit,  # 預設單位使用報價單位
                    "product_type": product_type,
                    "base_unit": "個",  # 預設主單位
                    "quotation_unit": quotation_unit if quotation_unit else None,
                    "pieces_per_case": pieces_per_case,
                    "pack_quantity": pack_quantity,
                    "model": model,
                    "brand": brand,
                    "size": size,
                    "origin": origin,
                    "safety_stock": 0,
                    "is_active": True
                })
        
        if not products:
            print("沒有找到可導入的產品")
            return
        
        print(f"準備導入 {len(products)} 個產品...")
        
        # 逐個處理產品
        for idx, product_data in enumerate(products, 1):
            try:
                # 檢查 SKU 是否已存在
                if product_data["sku"]:
                    exists = db.query(Product).filter(Product.sku == product_data["sku"]).first()
                    if exists:
                        skipped.append({
                            "index": idx,
                            "sku": product_data["sku"],
                            "name": product_data["name"],
                            "reason": "SKU already exists"
                        })
                        continue
                
                # 驗證 product_type
                if product_data["product_type"] not in ["RAW", "FG", "TRADE"]:
                    errors.append({
                        "index": idx,
                        "sku": product_data["sku"],
                        "name": product_data["name"],
                        "reason": f"Invalid product_type: {product_data['product_type']}"
                    })
                    continue
                
                # 創建產品
                p = Product(**product_data)
                db.add(p)
                created.append({
                    "sku": product_data["sku"],
                    "name": product_data["name"]
                })
                
                # 每 50 個提交一次
                if len(created) % 50 == 0:
                    db.commit()
                    print(f"  已處理 {len(created)} 個產品...")
            
            except Exception as e:
                db.rollback()
                errors.append({
                    "index": idx,
                    "sku": product_data.get("sku"),
                    "name": product_data.get("name"),
                    "reason": str(e)
                })
        
        # 最後提交
        db.commit()
        
        print(f"\n導入完成！")
        print(f"  成功: {len(created)}")
        print(f"  跳過: {len(skipped)}")
        print(f"  錯誤: {len(errors)}")
        
        if skipped:
            print(f"\n跳過的產品（已存在）:")
            for item in skipped[:10]:  # 只顯示前10個
                print(f"  - {item['name']} (SKU: {item['sku']})")
            if len(skipped) > 10:
                print(f"  ... 還有 {len(skipped) - 10} 個")
        
        if errors:
            print(f"\n錯誤的產品:")
            for err in errors[:10]:  # 只顯示前10個
                print(f"  - {err['name']} (SKU: {err['sku']}): {err['reason']}")
            if len(errors) > 10:
                print(f"  ... 還有 {len(errors) - 10} 個")
    
    except Exception as e:
        db.rollback()
        print(f"錯誤: {e}")
        import traceback
        traceback.print_exc()
        raise
    finally:
        db.close()

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("使用方法: python import_products.py <csv_file>")
        print("\nCSV 格式（第一行為標題）：")
        print("貨號,產品名稱,報價單位,件入數(箱入數),包入數,型號,規格,品牌,尺寸,產地")
        sys.exit(1)
    
    csv_file = sys.argv[1]
    try:
        import_products(csv_file)
    except Exception as e:
        print(f"錯誤: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
