from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func

from .db import get_db
from .deps import require_roles
from .models import Role, Product, BomItem
from .schemas import FGKitCreateIn
from .constants import RefType  # 若你想未來加 audit

router = APIRouter(tags=["fg-kit"])

@router.post("/fg-kit")
def create_fg_with_bom(
    payload: FGKitCreateIn,
    db: Session = Depends(get_db),
    user=Depends(require_roles(Role.admin, Role.supervisor)),
):
    # ---- validate ----
    if payload.alt_ratio is None or payload.alt_ratio <= 0:
        raise HTTPException(400, "alt_ratio 必須 > 0（每件幾包）")

    if not payload.bom_items or len(payload.bom_items) == 0:
        raise HTTPException(400, "bom_items 至少要有 1 個 RAW")

    # raw ids unique
    raw_ids = [it.raw_product_id for it in payload.bom_items]
    if len(set(raw_ids)) != len(raw_ids):
        raise HTTPException(400, "bom_items 含重複 raw_product_id")

    # validate all raws are RAW and active
    raws = db.query(Product).filter(Product.id.in_(raw_ids)).all()
    raw_map = {p.id: p for p in raws}
    for rid in raw_ids:
        p = raw_map.get(rid)
        if not p:
            raise HTTPException(400, f"RAW 不存在: {rid}")
        if p.product_type != "RAW":
            raise HTTPException(400, f"raw_product_id={rid} 不是 RAW")
        if hasattr(p, "is_active") and p.is_active is False:
            raise HTTPException(400, f"raw_product_id={rid} 已停用")

    # sku unique check (if provided)
    if payload.sku:
        exists = db.query(func.count(Product.id)).filter(Product.sku == payload.sku).scalar() or 0
        if exists:
            raise HTTPException(400, f"SKU 已存在: {payload.sku}")

    # ---- transaction: create product + bom ----
    try:
        fg = Product(
            sku=payload.sku,
            name=payload.name,
            spec=payload.spec,
            product_type="FG",
            base_unit=payload.base_unit or "件",
            alt_unit=payload.alt_unit or "包",
            alt_ratio=payload.alt_ratio,
            safety_stock=payload.safety_stock,
            unit=payload.base_unit or "件",  # 向後兼容
            is_active=True,
        )
        db.add(fg)
        db.flush()  # get fg.id

        # soft-deactivate any existing bom for this fg (should be none for new fg)
        # but safe if sku reused by mistake (won't happen due to unique check)
        old = db.query(BomItem).filter(BomItem.fg_product_id == fg.id, BomItem.is_active == True).all()
        for x in old:
            x.is_active = False

        for it in payload.bom_items:
            if it.qty_per_fg_unit is None or it.qty_per_fg_unit <= 0:
                raise HTTPException(400, "qty_per_fg_unit 必須 > 0")
            db.add(BomItem(
                fg_product_id=fg.id,
                raw_product_id=it.raw_product_id,
                qty_per_fg_unit=float(it.qty_per_fg_unit),
                note=it.note,
                is_active=True,
            ))

        db.commit()
        return {"product_id": fg.id}
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(500, f"建立 FG+ BOM 失敗: {str(e)}")

