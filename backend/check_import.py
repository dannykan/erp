#!/usr/bin/env python3
"""
检查产品导入状态的脚本
用于验证CSV中的产品是否已正确导入到数据库
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.db import SessionLocal
from app.models import Product

def check_import():
    """检查导入状态"""
    db = SessionLocal()
    try:
        # 统计所有产品
        total = db.query(Product).count()
        print(f"数据库中的总产品数: {total}")
        
        # 检查竹筷产品
        bamboo_products = db.query(Product).filter(Product.name.contains('竹筷')).all()
        print(f"\n竹筷产品数量: {len(bamboo_products)}")
        
        if bamboo_products:
            print("\n前10个竹筷产品:")
            for p in bamboo_products[:10]:
                print(f"  {p.sku or '(无SKU)'}: {p.name[:50]} (类型: {p.product_type}, 状态: {'启用' if p.is_active else '停用'})")
        else:
            print("\n未找到竹筷产品！")
            print("\n数据库中现有的产品类型分布:")
            types = db.query(Product.product_type, db.func.count(Product.id)).group_by(Product.product_type).all()
            for ptype, count in types:
                print(f"  {ptype}: {count}")
            
            print("\n前10个产品样本:")
            samples = db.query(Product).limit(10).all()
            for p in samples:
                print(f"  {p.sku or '(无SKU)'}: {p.name[:50]} (类型: {p.product_type})")
        
        # 检查按产品类型分组
        print("\n产品类型分布:")
        types = db.query(Product.product_type, db.func.count(Product.id)).group_by(Product.product_type).all()
        for ptype, count in types:
            print(f"  {ptype}: {count}")
        
    finally:
        db.close()

if __name__ == "__main__":
    check_import()

