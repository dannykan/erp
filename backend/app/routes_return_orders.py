from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc
from datetime import datetime, date
from typing import Optional
from .db import get_db, engine, Base
from .models import ReturnOrder, ReturnOrderItem, RefundRecord, SalesOrder, SalesOrderItem, InventoryMove, MoveType, Product, Role
from .schemas import ReturnOrderCreate, ReturnOrderView, ReturnOrderItemView
from .deps import get_current_user, require_roles
from .utils import make_no
from .constants import Site, Stage, RefType

router = APIRouter(prefix="/return-orders", tags=["return-orders"])

def return_order_to_view(db: Session, ro: ReturnOrder) -> ReturnOrderView:
    """Convert ReturnOrder to ReturnOrderView"""
    items = []
    for it in ro.items:
        p = db.query(Product).filter(Product.id == it.product_id).first()
        items.append({
            "id": it.id,
            "product_id": it.product_id,
            "product_sku": p.sku if p else None,
            "product_name": p.name if p else f"#{it.product_id}",
            "qty": float(it.qty),
            "unit": it.unit,
            "unit_price": float(it.unit_price),
            "note": it.note or "",
        })
    
    return ReturnOrderView(
        id=ro.id,
        return_no=ro.return_no,
        customer_name=ro.customer_name,
        source_so_id=ro.source_so_id,
        doc_date=ro.doc_date,
        note=ro.note,
        status=ro.status,
        is_stocked=ro.is_stocked,
        created_at=ro.created_at,
        created_by_id=ro.created_by_id,
        items=items,
    )

@router.get("", response_model=list[ReturnOrderView])
def list_return_orders(
    customer_name: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """取得退貨單列表"""
    Base.metadata.create_all(bind=engine)
    
    qry = db.query(ReturnOrder)
    
    if customer_name:
        qry = qry.filter(ReturnOrder.customer_name.ilike(f"%{customer_name}%"))
    if status:
        qry = qry.filter(ReturnOrder.status == status)
    
    return [return_order_to_view(db, ro) for ro in qry.order_by(desc(ReturnOrder.id)).all()]

@router.get("/{ro_id}", response_model=ReturnOrderView)
def get_return_order(
    ro_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """取得退貨單詳情"""
    Base.metadata.create_all(bind=engine)
    ro = db.query(ReturnOrder).filter(ReturnOrder.id == ro_id).first()
    if not ro:
        raise HTTPException(404, "Return order not found")
    return return_order_to_view(db, ro)

@router.post("", response_model=ReturnOrderView)
def create_return_order(
    payload: ReturnOrderCreate,
    db: Session = Depends(get_db),
    user=Depends(require_roles(Role.admin, Role.office, Role.supervisor)),
):
    """建立退貨單"""
    Base.metadata.create_all(bind=engine)
    
    # 檢查來源銷貨單是否存在且已出貨
    source_so = db.query(SalesOrder).filter(SalesOrder.id == payload.source_so_id).first()
    if not source_so:
        raise HTTPException(404, "Source sales order not found")
    if source_so.status != "SHIPPED":
        raise HTTPException(400, "Source sales order must be SHIPPED")
    if source_so.customer_name != payload.customer_name:
        raise HTTPException(400, "Customer name mismatch")
    
    # 檢查退貨明細是否都來自該銷貨單
    so_item_ids = {it.id for it in source_so.items}
    for item in payload.items:
        if item.source_so_item_id not in so_item_ids:
            raise HTTPException(400, f"Item {item.source_so_item_id} not found in source sales order")
        
        # 檢查退貨數量不超過原訂單數量
        so_item = db.query(SalesOrderItem).filter(SalesOrderItem.id == item.source_so_item_id).first()
        if so_item and item.qty > float(so_item.qty):
            raise HTTPException(400, f"Return qty {item.qty} exceeds order qty {so_item.qty}")
    
    # 生成退貨單號
    prefix = make_no("RET")
    seq = db.query(ReturnOrder).filter(ReturnOrder.return_no.like(f"{prefix}-%")).count() + 1
    return_no = f"{prefix}-{seq:04d}"
    
    # 建立退貨單
    ro = ReturnOrder(
        return_no=return_no,
        customer_name=payload.customer_name,
        source_so_id=payload.source_so_id,
        doc_date=payload.doc_date,
        note=payload.note,
        status="confirmed",  # 直接確認
        is_stocked=payload.is_stocked,
        created_by_id=user.id,
    )
    
    # 建立退貨明細
    total_refund = 0.0
    for item in payload.items:
        so_item = db.query(SalesOrderItem).filter(SalesOrderItem.id == item.source_so_item_id).first()
        if not so_item:
            continue
        
        ro_item = ReturnOrderItem(
            return_order_id=None,  # 稍後會設置
            product_id=so_item.product_id,
            qty=item.qty,
            unit=item.unit,
            unit_price=item.unit_price,
            note=item.note,
        )
        ro.items.append(ro_item)
        total_refund += item.qty * item.unit_price
    
    db.add(ro)
    db.flush()  # 獲取 ro.id
    
    # 如果選擇入倉，增加庫存
    if payload.is_stocked:
        ro.status = "stocked"
        for item in ro.items:
            db.add(InventoryMove(
                product_id=item.product_id,
                move_type=MoveType.IN,
                qty_change=+item.qty,
                site=Site.WAREHOUSE,
                stage=Stage.RETURN,
                ref_type=RefType.RETURN_ORDER,
                ref_no=return_no,
                note=f"退貨入倉 {payload.customer_name}",
            ))
    
    # 建立退款記錄
    refund_record = RefundRecord(
        return_order_id=ro.id,
        sales_order_id=payload.source_so_id,
        refund_amount=total_refund,
        note=payload.note,
        created_by_id=user.id,
    )
    db.add(refund_record)
    
    db.commit()
    db.refresh(ro)
    return return_order_to_view(db, ro)

@router.post("/{ro_id}/stock", response_model=ReturnOrderView)
def stock_return_order(
    ro_id: int,
    db: Session = Depends(get_db),
    user=Depends(require_roles(Role.admin, Role.office, Role.supervisor)),
):
    """將退貨單入倉"""
    Base.metadata.create_all(bind=engine)
    ro = db.query(ReturnOrder).filter(ReturnOrder.id == ro_id).first()
    if not ro:
        raise HTTPException(404, "Return order not found")
    if ro.is_stocked:
        raise HTTPException(400, "Return order already stocked")
    
    # 增加庫存
    for item in ro.items:
        db.add(InventoryMove(
            product_id=item.product_id,
            move_type=MoveType.IN,
            qty_change=+item.qty,
            site=Site.WAREHOUSE,
            stage=Stage.RETURN,
            ref_type=RefType.RETURN_ORDER,
            ref_no=ro.return_no,
            note=f"退貨入倉 {ro.customer_name}",
        ))
    
    ro.is_stocked = True
    ro.status = "stocked"
    db.commit()
    db.refresh(ro)
    return return_order_to_view(db, ro)

