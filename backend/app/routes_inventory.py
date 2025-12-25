from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func, desc, nullslast
from .db import get_db, engine, Base
from .deps import get_current_user, require_roles
from .models import Product, InventoryMove, Role, MoveType
from .schemas import InventoryRow, InventoryMoveOut, InventoryMoveIn, StockBatchIn

router = APIRouter(prefix="/inventory", tags=["inventory"])

@router.get("", response_model=list[InventoryRow])
def inventory_list(
    q: str | None = None,
    site: str | None = None,
    low_only: bool = False,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    Base.metadata.create_all(bind=engine)

    # current_stock = sum(inventory_moves.qty_change)
    # 統一使用 WAREHOUSE 站點（架構瘦身：只保留單一站點）
    from .constants import Site
    from fastapi import HTTPException
    import logging
    
    # 如果傳入 site 且不是 WAREHOUSE，拒絕請求（避免舊前端傳參造成錯誤）
    if site and site != Site.WAREHOUSE:
        logging.warning(f"Invalid site parameter: {site}, only WAREHOUSE is allowed")
        raise HTTPException(
            status_code=400,
            detail=f"Invalid site: {site}. Only WAREHOUSE is supported in MVP v2. Please omit the site parameter or use 'WAREHOUSE'."
        )
    
    effective_site = Site.WAREHOUSE  # 強制使用 WAREHOUSE
    
    sub_q = db.query(
        InventoryMove.product_id.label("pid"),
        func.coalesce(func.sum(InventoryMove.qty_change), 0).label("stock"),
    )

    sub_q = sub_q.filter(InventoryMove.site == effective_site)

    sub = sub_q.group_by(InventoryMove.product_id).subquery()

    qry = (
        db.query(
            Product.id.label("product_id"),
            Product.sku,
            Product.name,
            Product.unit,
            Product.base_unit,
            Product.safety_stock,
            func.coalesce(sub.c.stock, 0).label("current_stock"),
        )
        .outerjoin(sub, sub.c.pid == Product.id)
        .filter(Product.is_active == True)
        .order_by(nullslast(Product.sku), Product.id)
    )

    if q:
        qry = qry.filter((Product.name.contains(q)) | (Product.sku.contains(q)))

    rows = []
    for r in qry.all():
        current = float(r.current_stock or 0)
        safety = int(r.safety_stock or 0)
        low = current < safety
        if low_only and not low:
            continue
        rows.append(
            InventoryRow(
                product_id=r.product_id,
                sku=r.sku,
                name=r.name,
                unit=r.unit,
                base_unit=r.base_unit,
                safety_stock=safety,
                current_stock=current,
                low_stock=low,
            )
        )
    return rows

@router.get("/moves", response_model=list[InventoryMoveOut])
def inventory_moves(
    product_id: int,
    limit: int = 200,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    Base.metadata.create_all(bind=engine)
    return (
        db.query(InventoryMove)
        .filter(InventoryMove.product_id == product_id)
        .order_by(desc(InventoryMove.id))
        .limit(min(limit, 500))
        .all()
    )

# MVP 先給一個「手動調整庫存」接口（未來進貨/銷貨會自動寫入 moves）
@router.post("/moves", response_model=InventoryMoveOut)
def create_move(
    payload: InventoryMoveIn,
    db: Session = Depends(get_db),
    user=Depends(require_roles(Role.admin, Role.office, Role.supervisor)),
):
    Base.metadata.create_all(bind=engine)
    
    # 統一使用 WAREHOUSE 站點（架構瘦身：只保留單一站點）
    from .constants import Site
    from fastapi import HTTPException
    import logging
    
    # 如果傳入 site 且不是 WAREHOUSE，直接拒絕請求（統一策略：與 inventory_list 和 stock_batch 一致）
    if payload.site and payload.site != Site.WAREHOUSE:
        logging.warning(f"Invalid site parameter in create_move: {payload.site}, only WAREHOUSE is allowed")
        raise HTTPException(
            status_code=400,
            detail=f"Invalid site: {payload.site}. Only WAREHOUSE is supported in MVP v2. Please omit the site parameter or use 'WAREHOUSE'."
        )
    
    effective_site = Site.WAREHOUSE  # 強制使用 WAREHOUSE（即使 payload.site 為 None）

    mv = InventoryMove(
        product_id=payload.product_id,
        move_type=MoveType(payload.move_type),
        qty_change=payload.qty_change,
        site=effective_site,  # 強制使用 WAREHOUSE
        stage=payload.stage,
        ref_type=payload.ref_type,
        ref_no=payload.ref_no,
        note=payload.note,
    )
    db.add(mv)
    db.commit()
    db.refresh(mv)
    return mv

@router.post("/stock/batch")
def stock_batch(
    payload: StockBatchIn,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    # 回 { "1": 120, "2": 0 }
    ids = list({int(x) for x in (payload.product_ids or [])})
    if not ids:
        return {}

    # 統一使用 WAREHOUSE 站點（架構瘦身：只保留單一站點）
    from .constants import Site
    from fastapi import HTTPException
    import logging
    
    # 如果傳入 site 且不是 WAREHOUSE，拒絕請求
    if payload.site and payload.site != Site.WAREHOUSE:
        logging.warning(f"Invalid site parameter in stockBatch: {payload.site}, only WAREHOUSE is allowed")
        raise HTTPException(
            status_code=400,
            detail=f"Invalid site: {payload.site}. Only WAREHOUSE is supported in MVP v2. Please omit the site parameter or use 'WAREHOUSE'."
        )
    
    effective_site = Site.WAREHOUSE  # 強制使用 WAREHOUSE
    
    q = db.query(
        InventoryMove.product_id,
        func.coalesce(func.sum(InventoryMove.qty_change), 0).label("stock")
    ).filter(InventoryMove.product_id.in_(ids))

    q = q.filter(InventoryMove.site == effective_site)

    q = q.group_by(InventoryMove.product_id)

    out = {str(pid): 0 for pid in ids}
    for pid, stock in q.all():
        out[str(pid)] = int(stock or 0)
    return out

