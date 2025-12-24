#!/usr/bin/env python3
"""
批量導入客戶腳本
從 CSV 文件導入客戶到資料庫

CSV 格式（第一行為標題）：
客戶代號,簡稱,長名稱,統編,聯絡窗口,電話,送貨地址,發票抬頭,銷貨類別,建檔日期,E-mail

使用方法：
python import_customers.py "台悅出貨系統 2023_231024 - 客戶.csv"
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
from app.models import Customer

def parse_date(date_str: str) -> Optional[datetime.date]:
    """解析日期，例如 '2023/10/5' -> date"""
    if not date_str or date_str.strip() == '':
        return None
    try:
        # 處理多種日期格式
        date_str = date_str.strip()
        # 2023/10/5 格式
        if '/' in date_str:
            parts = date_str.split('/')
            if len(parts) == 3:
                year = int(parts[0])
                month = int(parts[1])
                day = int(parts[2])
                return datetime(year, month, day).date()
    except:
        pass
    return None

def clean_phone(phone: str) -> str:
    """清理電話號碼，移除特殊符號"""
    if not phone:
        return ''
    # 移除 ┃ 符號，保留其他內容
    return phone.replace('┃', ' / ').strip()

def import_customers(csv_file: str):
    """從 CSV 文件導入客戶"""
    # 確保資料庫表存在
    Base.metadata.create_all(bind=engine)
    
    db = SessionLocal()
    created = []
    skipped = []
    errors = []
    
    try:
        customers = []
        
        with open(csv_file, 'r', encoding='utf-8-sig') as f:
            lines = f.readlines()
            # 跳過第一行（"公司名稱" 標題行）
            # 第二行是真正的欄位標題
            if len(lines) > 1:
                # 從第二行開始讀取
                reader = csv.DictReader(lines[1:])
            else:
                print("CSV 文件格式錯誤：缺少標題行")
                return
            
            for row in reader:
                customer_code = row.get('客戶代號', '').strip()
                short_name = row.get('簡稱', '').strip()
                full_name = row.get('長名稱', '').strip()
                
                # 如果客戶代號和簡稱都為空，跳過
                if not customer_code and not short_name:
                    continue
                
                # 使用簡稱或長名稱作為 name（必須有唯一值）
                name = short_name or full_name or customer_code
                if not name:
                    continue
                
                tax_id = row.get('統編', '').strip() or None
                contact = row.get('聯絡窗口', '').strip() or None
                phone = clean_phone(row.get('電話', '').strip()) or None
                address = row.get('送貨地址', '').strip() or None
                invoice_title = row.get('發票抬頭', '').strip() or None
                sales_category = row.get('銷貨類別', '').strip() or None
                filing_date = parse_date(row.get('建檔日期', '').strip())
                email = row.get('E-mail', '').strip() or None
                
                customers.append({
                    "name": name,
                    "customer_code": customer_code if customer_code else None,
                    "short_name": short_name if short_name else None,
                    "full_name": full_name if full_name else None,
                    "tax_id": tax_id,
                    "contact": contact,
                    "phone": phone,
                    "address": address,
                    "invoice_title": invoice_title,
                    "sales_category": sales_category,
                    "filing_date": filing_date,
                    "email": email,
                    "is_active": True
                })
        
        if not customers:
            print("沒有找到可導入的客戶")
            return
        
        print(f"準備導入 {len(customers)} 個客戶...")
        
        # 逐個處理客戶
        for idx, customer_data in enumerate(customers, 1):
            try:
                # 檢查客戶名稱是否已存在
                exists = db.query(Customer).filter(Customer.name == customer_data["name"]).first()
                if exists:
                    skipped.append({
                        "index": idx,
                        "name": customer_data["name"],
                        "customer_code": customer_data.get("customer_code"),
                        "reason": "客戶名稱已存在"
                    })
                    continue
                
                # 創建客戶
                c = Customer(**customer_data)
                db.add(c)
                created.append({
                    "name": customer_data["name"],
                    "customer_code": customer_data.get("customer_code")
                })
                
                # 每 50 個提交一次
                if len(created) % 50 == 0:
                    db.commit()
                    print(f"  已處理 {len(created)} 個客戶...")
            
            except Exception as e:
                db.rollback()
                errors.append({
                    "index": idx,
                    "name": customer_data.get("name"),
                    "customer_code": customer_data.get("customer_code"),
                    "reason": str(e)
                })
        
        # 最後提交
        db.commit()
        
        print(f"\n導入完成！")
        print(f"  成功: {len(created)}")
        print(f"  跳過: {len(skipped)}")
        print(f"  錯誤: {len(errors)}")
        
        if skipped:
            print(f"\n跳過的客戶（已存在）:")
            for item in skipped[:10]:  # 只顯示前10個
                print(f"  - {item['name']} (代號: {item['customer_code']})")
            if len(skipped) > 10:
                print(f"  ... 還有 {len(skipped) - 10} 個")
        
        if errors:
            print(f"\n錯誤的客戶:")
            for err in errors[:10]:  # 只顯示前10個
                print(f"  - {err['name']} (代號: {err['customer_code']}): {err['reason']}")
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
        print("使用方法: python import_customers.py <csv_file>")
        print("\nCSV 格式（第一行為標題）：")
        print("客戶代號,簡稱,長名稱,統編,聯絡窗口,電話,送貨地址,發票抬頭,銷貨類別,建檔日期,E-mail")
        sys.exit(1)
    
    csv_file = sys.argv[1]
    try:
        import_customers(csv_file)
    except Exception as e:
        print(f"錯誤: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

