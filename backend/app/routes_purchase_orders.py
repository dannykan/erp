from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session
from sqlalchemy import desc
from .db import get_db, engine, Base
from .models import PurchaseOrder, PurchaseOrderItem, InventoryMove, MoveType, Product, Role
from .schemas import POCreate, POOut, POView
from .deps import get_current_user, require_roles
from .utils import make_no
from .pdf_docs import build_po_pdf
from .constants import Site

router = APIRouter(prefix="/purchase-orders", tags=["purchase-orders"])

def po_to_view(db: Session, po: PurchaseOrder) -> POView:
    prod_map = {p.id: p for p in db.query(Product).all()}
    items = []
    for it in po.items:
        p = prod_map.get(it.product_id)
        items.append({
            "id": it.id,
            "product_id": it.product_id,
            "product_sku": getattr(p, "sku", None) if p else None,
            "product_name": getattr(p, "name", f"#{it.product_id}") if p else f"#{it.product_id}",
            "product_spec": getattr(p, "spec", None) if p else None,
            "qty": it.qty,
            "unit": it.unit,
            "pieces_per_case": getattr(p, "pieces_per_case", None) if p else None,
            "price_unit": getattr(p, "quotation_unit", "件") if p else "件",
            "unit_price": 0.0,  # 進貨單目前沒有單價
            "mark": "",  # 進貨單目前沒有 MARK
            "note": it.note or "",
        })
    return POView(
        id=po.id,
        po_no=po.po_no,
        supplier_name=po.supplier_name,
        doc_date=po.doc_date,
        note=po.note,
        created_at=po.created_at,
        items=items,
    )

@router.get("", response_model=list[POView])
def list_pos(
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    Base.metadata.create_all(bind=engine)
    pos = db.query(PurchaseOrder).order_by(desc(PurchaseOrder.id)).all()
    return [po_to_view(db, po) for po in pos]

@router.post("", response_model=POView)
def create_po(
    payload: POCreate,
    db: Session = Depends(get_db),
    user=Depends(require_roles(Role.admin, Role.office, Role.supervisor)),
):
    Base.metadata.create_all(bind=engine)
    if not payload.items:
        raise HTTPException(400, "items required")

    prefix = make_no("PO")
    seq = db.query(PurchaseOrder).filter(PurchaseOrder.po_no.like(f"{prefix}-%")).count() + 1
    po_no = f"{prefix}-{seq:04d}"

    po = PurchaseOrder(
        po_no=po_no,
        supplier_name=payload.supplier_name,
        doc_date=payload.doc_date,
        note=payload.note,
    )

    # 建立 items + 寫入庫存 IN 流水
    for it in payload.items:
        # 檢查商品存在
        p = db.query(Product).filter(Product.id == it.product_id).first()
        if not p:
            raise HTTPException(400, f"product_id {it.product_id} not found")

        po.items.append(PurchaseOrderItem(
            product_id=it.product_id,
            qty=it.qty,
            unit=it.unit,
            note=it.note,
        ))

        db.add(InventoryMove(
            product_id=it.product_id,
            move_type=MoveType.IN,
            qty_change=+it.qty,
            site=Site.WAREHOUSE,
            stage="RECEIVE",
            ref_type="PO",
            ref_no=po_no,
            note=f"進貨入庫 {payload.supplier_name}",
        ))

    db.add(po)
    db.commit()
    db.refresh(po)
    return po_to_view(db, po)

@router.get("/{po_id}", response_model=POView)
def get_po(
    po_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    Base.metadata.create_all(bind=engine)
    po = db.query(PurchaseOrder).filter(PurchaseOrder.id == po_id).first()
    if not po:
        raise HTTPException(404, "PO not found")
    return po_to_view(db, po)

@router.get("/{po_id}/print")
def print_po(
    po_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    Base.metadata.create_all(bind=engine)
    po = db.query(PurchaseOrder).filter(PurchaseOrder.id == po_id).first()
    if not po:
        raise HTTPException(404, "PO not found")

    # 讓 PDF 顯示商品名稱：查 products
    prod_map = {p.id: p for p in db.query(Product).all()}
    items = []
    for it in po.items:
        p = prod_map.get(it.product_id)
        items.append({
            "product_name": (f"{p.sku} - {p.name}" if p and p.sku else (p.name if p else f"#{it.product_id}")),
            "qty": it.qty,
            "unit": it.unit,
            "note": it.note,
        })

    pdf = build_po_pdf(po.po_no, po.supplier_name, str(po.doc_date), items, po.note)
    return Response(content=pdf, media_type="application/pdf")

