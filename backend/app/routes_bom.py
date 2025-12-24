from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import desc
from .db import get_db, engine, Base
from .deps import get_current_user, require_roles
from .models import BomItem, Product, Role
from .schemas import BomItemOut, BomUpsertIn

router = APIRouter(prefix="/bom", tags=["bom"])

def bom_item_to_out(db: Session, item: BomItem) -> BomItemOut:
    """Convert BomItem to BomItemOut with product info"""
    raw_product = db.query(Product).filter(Product.id == item.raw_product_id).first()
    return BomItemOut(
        id=item.id,
        fg_product_id=item.fg_product_id,
        raw_product_id=item.raw_product_id,
        raw_product_name=raw_product.name if raw_product else f"#{item.raw_product_id}",
        raw_product_sku=raw_product.sku if raw_product else None,
        qty_per_fg_unit=item.qty_per_fg_unit,
        note=item.note,
        is_active=item.is_active,
        created_at=item.created_at,
    )

@router.get("/{fg_product_id}", response_model=list[BomItemOut])
def get_bom(
    fg_product_id: int,
    include_inactive: bool = False,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """取得該成品 BOM 列表"""
    Base.metadata.create_all(bind=engine)
    
    # 檢查 FG 商品存在且為 FG 類型
    fg_product = db.query(Product).filter(Product.id == fg_product_id).first()
    if not fg_product:
        raise HTTPException(404, "FG product not found")
    if fg_product.product_type != "FG":
        raise HTTPException(400, f"Product {fg_product_id} is not FG type")
    
    qry = db.query(BomItem).filter(BomItem.fg_product_id == fg_product_id)
    if not include_inactive:
        qry = qry.filter(BomItem.is_active == True)
    items = qry.order_by(BomItem.id).all()
    
    return [bom_item_to_out(db, item) for item in items]

@router.put("/{fg_product_id}", response_model=list[BomItemOut])
def upsert_bom(
    fg_product_id: int,
    payload: BomUpsertIn,
    db: Session = Depends(get_db),
    user=Depends(require_roles(Role.admin, Role.supervisor)),
):
    """用整包覆蓋 BOM（最簡單、最不容易亂）"""
    Base.metadata.create_all(bind=engine)
    
    # 檢查 FG 商品存在且為 FG 類型
    fg_product = db.query(Product).filter(Product.id == fg_product_id).first()
    if not fg_product:
        raise HTTPException(404, "FG product not found")
    if fg_product.product_type != "FG":
        raise HTTPException(400, f"Product {fg_product_id} is not FG type")
    
    # 驗證：至少要有 1 個 RAW
    if not payload.items:
        raise HTTPException(400, "BOM must have at least 1 raw material")
    
    # 驗證所有 raw_product_id 存在且為 RAW 類型
    raw_product_ids = [it.raw_product_id for it in payload.items]
    if raw_product_ids:
        raw_products = db.query(Product).filter(Product.id.in_(raw_product_ids)).all()
        raw_product_map = {p.id: p for p in raw_products}
        
        for it in payload.items:
            if it.raw_product_id not in raw_product_map:
                raise HTTPException(400, f"Raw product {it.raw_product_id} not found")
            raw_p = raw_product_map[it.raw_product_id]
            if raw_p.product_type != "RAW":
                raise HTTPException(400, f"Product {it.raw_product_id} is not RAW type")
    
    # 檢查是否有重複的 raw_product_id
    seen = set()
    for it in payload.items:
        if it.raw_product_id in seen:
            raise HTTPException(400, f"Duplicate raw_product_id {it.raw_product_id}")
        seen.add(it.raw_product_id)
    
    # 驗證 qty_per_fg_unit > 0
    for it in payload.items:
        if it.qty_per_fg_unit <= 0:
            raise HTTPException(400, f"qty_per_fg_unit must be > 0 (got {it.qty_per_fg_unit})")
    
    # 先將舊的 BOM items 標記為 inactive（軟刪除）
    old_items = db.query(BomItem).filter(
        BomItem.fg_product_id == fg_product_id,
        BomItem.is_active == True
    ).all()
    for old_item in old_items:
        old_item.is_active = False
    
    # 建立新的 BOM items
    new_items = []
    for it in payload.items:
        bom_item = BomItem(
            fg_product_id=fg_product_id,
            raw_product_id=it.raw_product_id,
            qty_per_fg_unit=it.qty_per_fg_unit,
            note=it.note,
            is_active=True,
        )
        db.add(bom_item)
        new_items.append(bom_item)
    
    db.commit()
    
    # 重新查詢以取得完整資料
    for item in new_items:
        db.refresh(item)
    
    return [bom_item_to_out(db, item) for item in new_items]


