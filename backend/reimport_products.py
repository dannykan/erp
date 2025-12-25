#!/usr/bin/env python3
"""
重新导入产品脚本
删除所有现有产品数据后，重新从CSV导入所有产品

⚠️ 警告：此脚本会删除所有产品数据及相关记录（库存移动、订单项、BOM等）

使用方法：
  python reimport_products.py [--yes] [csv_file]
  
参数：
  --yes    跳过确认提示，直接执行删除和导入
  csv_file CSV文件路径（默认：產品品項管理 - 工作表1.csv）
"""

import sys
import os
import argparse
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.db import SessionLocal, engine, Base
from app.models import (
    Product, 
    InventoryMove, 
    PurchaseOrderItem, 
    SalesOrderItem,
    BomItem,
    ProductionReportItem
)
from import_products import import_products

def delete_all_products(skip_confirm=False):
    """删除所有产品及相关数据"""
    db = SessionLocal()
    try:
        # 统计当前数据
        product_count = db.query(Product).count()
        inventory_move_count = db.query(InventoryMove).count()
        po_item_count = db.query(PurchaseOrderItem).count()
        so_item_count = db.query(SalesOrderItem).count()
        bom_item_count = db.query(BomItem).count()
        pr_item_count = db.query(ProductionReportItem).count()
        
        print("=" * 60)
        print("当前数据库统计：")
        print(f"  产品数量: {product_count}")
        print(f"  库存移动记录: {inventory_move_count}")
        print(f"  采购订单项: {po_item_count}")
        print(f"  销售订单项: {so_item_count}")
        print(f"  BOM物料清单项: {bom_item_count}")
        print(f"  生产报表项: {pr_item_count}")
        print("=" * 60)
        
        if product_count == 0:
            print("\n数据库中没有产品数据，跳过删除步骤。")
            return
        
        print("\n⚠️  警告：即将删除所有产品及相关数据！")
        print("这将删除：")
        print("  - 所有产品记录")
        print("  - 所有库存移动记录")
        print("  - 所有采购订单项")
        print("  - 所有销售订单项")
        print("  - 所有BOM物料清单项")
        print("  - 所有生产报表项")
        
        # 询问确认
        if not skip_confirm:
            confirm = input("\n确认删除？输入 'YES' 继续: ")
            if confirm != 'YES':
                print("已取消操作。")
                return
        else:
            print("\n使用 --yes 参数，跳过确认直接执行...")
        
        print("\n开始删除数据...")
        
        # 删除顺序：先删除依赖表，再删除产品表
        # 1. 删除库存移动记录
        deleted_moves = db.query(InventoryMove).delete()
        print(f"  已删除 {deleted_moves} 条库存移动记录")
        
        # 2. 删除采购订单项
        deleted_po_items = db.query(PurchaseOrderItem).delete()
        print(f"  已删除 {deleted_po_items} 条采购订单项")
        
        # 3. 删除销售订单项
        deleted_so_items = db.query(SalesOrderItem).delete()
        print(f"  已删除 {deleted_so_items} 条销售订单项")
        
        # 4. 删除BOM物料清单项
        deleted_bom_items = db.query(BomItem).delete()
        print(f"  已删除 {deleted_bom_items} 条BOM物料清单项")
        
        # 5. 删除生产报表项
        deleted_pr_items = db.query(ProductionReportItem).delete()
        print(f"  已删除 {deleted_pr_items} 条生产报表项")
        
        # 6. 最后删除产品
        deleted_products = db.query(Product).delete()
        print(f"  已删除 {deleted_products} 条产品记录")
        
        db.commit()
        print("\n✅ 所有数据已删除！")
        
    except Exception as e:
        db.rollback()
        print(f"\n❌ 删除数据时出错: {e}")
        import traceback
        traceback.print_exc()
        raise
    finally:
        db.close()

def main():
    """主函数"""
    parser = argparse.ArgumentParser(description='重新导入产品数据')
    parser.add_argument('--yes', action='store_true', help='跳过确认提示，直接执行')
    parser.add_argument('csv_file', nargs='?', default='產品品項管理 - 工作表1.csv', 
                        help='CSV文件路径（默认：產品品項管理 - 工作表1.csv）')
    args = parser.parse_args()
    
    csv_file = args.csv_file
    skip_confirm = args.yes
    
    if not os.path.exists(csv_file):
        print(f"❌ 错误：找不到CSV文件: {csv_file}")
        print(f"   当前目录: {os.getcwd()}")
        sys.exit(1)
    
    print("=" * 60)
    print("产品重新导入脚本")
    print("=" * 60)
    
    # 步骤1：删除现有数据
    try:
        delete_all_products(skip_confirm=skip_confirm)
    except KeyboardInterrupt:
        print("\n\n操作已取消。")
        sys.exit(0)
    except Exception as e:
        print(f"\n❌ 删除数据失败: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
    
    # 步骤2：重新导入
    print("\n" + "=" * 60)
    print("开始重新导入产品...")
    print("=" * 60)
    
    try:
        import_products(csv_file)
    except Exception as e:
        print(f"\n❌ 导入产品失败: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
    
    # 步骤3：验证导入结果
    print("\n" + "=" * 60)
    print("验证导入结果...")
    print("=" * 60)
    
    db = SessionLocal()
    try:
        total = db.query(Product).count()
        bamboo_count = db.query(Product).filter(Product.name.contains('竹筷')).count()
        other_count = total - bamboo_count
        
        print(f"\n导入统计：")
        print(f"  总产品数: {total}")
        print(f"  竹筷产品: {bamboo_count}")
        print(f"  其他产品: {other_count}")
        
        # 检查CSV中的预期数量
        import csv
        csv_count = 0
        with open(csv_file, 'r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            for row in reader:
                if row.get('產品名稱', '').strip():
                    csv_count += 1
        
        print(f"\nCSV文件中的产品数: {csv_count}")
        
        if total == csv_count:
            print("\n✅ 验证通过：所有产品都已成功导入！")
        else:
            print(f"\n⚠️  警告：导入数量 ({total}) 与CSV数量 ({csv_count}) 不一致")
            print("   可能原因：")
            print("   - CSV中有空的产品名称被跳过")
            print("   - 导入过程中出现错误")
        
        # 显示一些样本产品
        print("\n样本产品（前10个）：")
        samples = db.query(Product).limit(10).all()
        for p in samples:
            print(f"  {p.sku or '(无SKU)'}: {p.name[:60]}")
            
    finally:
        db.close()
    
    print("\n" + "=" * 60)
    print("✅ 重新导入完成！")
    print("=" * 60)

if __name__ == "__main__":
    main()

