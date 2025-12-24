from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import desc
from datetime import datetime, date as _date
from typing import Optional
from pydantic import BaseModel
from .db import get_db, engine, Base
from .deps import get_current_user, require_roles
from .models import (
    ProductionReport, ProductionReportItem,
    Product, InventoryMove, MoveType, Role,
    ProductionReportAction, BomItem
)
from .constants import Site, Stage, RefType
from .schemas import PRCreate, PRView, PRCloneIn
from .utils import make_no

class PRReject(BaseModel):
    reason: Optional[str] = None

router = APIRouter(prefix="/production-reports", tags=["production-reports"])

def log_action(db: Session, report_id: int, action: str, user, comment: str | None = None):
    db.add(ProductionReportAction(
        report_id=report_id,
        action=action,
        actor_user_id=user.id,
        actor_role=user.role.value if user.role else None,
        comment=comment,
    ))

def pr_to_view(db: Session, pr: ProductionReport) -> PRView:
    prod_map = {p.id: p for p in db.query(Product).all()}
    items = []
    for it in pr.items:
        p = prod_map.get(it.product_id)
        items.append({
            "id": it.id,
            "product_id": it.product_id,
            "product_sku": getattr(p, "sku", None) if p else None,
            "product_name": getattr(p, "name", f"#{it.product_id}") if p else f"#{it.product_id}",
            "product_spec": getattr(p, "spec", None) if p else None,
            "spec_text": it.spec_text,
            "qty": it.qty,
            "unit": it.unit,
            "note": it.note,
        })
    return PRView(
        id=pr.id,
        pr_no=pr.pr_no,
        report_date=pr.report_date,
        status=pr.status,
        note=pr.note,
        reported_by_user_id=pr.reported_by_user_id,
        approved_by_user_id=pr.approved_by_user_id,
        approved_at=pr.approved_at,
        created_at=pr.created_at,
        items=items,
    )

@router.get("", response_model=list[PRView])
def list_reports(
    mine: bool = False,
    status: str | None = None,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    Base.metadata.create_all(bind=engine)
    q = db.query(ProductionReport).order_by(desc(ProductionReport.id))
    if mine:
        q = q.filter(ProductionReport.reported_by_user_id == user.id)
    if status:
        q = q.filter(ProductionReport.status == status)
    prs = q.all()
    return [pr_to_view(db, pr) for pr in prs]

@router.get("/{pr_id}", response_model=PRView)
def get_report(
    pr_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    Base.metadata.create_all(bind=engine)
    pr = db.query(ProductionReport).filter(ProductionReport.id == pr_id).first()
    if not pr:
        raise HTTPException(404, "PR not found")

    # 只有自己或廠長/管理層可看
    if pr.reported_by_user_id != user.id and user.role not in [Role.admin, Role.supervisor, Role.office]:
        raise HTTPException(403, "Forbidden")

    return pr_to_view(db, pr)

@router.post("", response_model=PRView)
def create_report(
    payload: PRCreate,
    db: Session = Depends(get_db),
    user=Depends(require_roles(Role.admin, Role.supervisor, Role.office, Role.worker)),
):
    Base.metadata.create_all(bind=engine)
    if not payload.items:
        raise HTTPException(400, "items required")

    prefix = make_no("PR")
    seq = db.query(ProductionReport).filter(ProductionReport.pr_no.like(f"{prefix}-%")).count() + 1
    pr_no = f"{prefix}-{seq:04d}"

    pr = ProductionReport(
        pr_no=pr_no,
        report_date=payload.report_date,
        note=payload.note,
        status="SUBMITTED",
        reported_by_user_id=user.id,
    )

    for it in payload.items:
        p = db.query(Product).filter(Product.id == it.product_id).first()
        if not p:
            raise HTTPException(400, f"product_id {it.product_id} not found")

        pr.items.append(ProductionReportItem(
            product_id=it.product_id,
            spec_text=it.spec_text,
            qty=it.qty,
            unit=it.unit,
            note=it.note,
        ))

    db.add(pr)
    db.commit()
    db.refresh(pr)

    log_action(db, pr.id, "SUBMIT", user)
    db.commit()

    return pr_to_view(db, pr)

@router.post("/{pr_id}/approve")
def approve_report(
    pr_id: int,
    db: Session = Depends(get_db),
    user=Depends(require_roles(Role.admin, Role.supervisor)),  # 廠長
):
    Base.metadata.create_all(bind=engine)
    pr = db.query(ProductionReport).filter(ProductionReport.id == pr_id).first()
    if not pr:
        raise HTTPException(404, "PR not found")
    if pr.status != "SUBMITTED":
        raise HTTPException(400, "Only SUBMITTED can be approved")
    
    if not pr.items:
        raise HTTPException(400, "Production report has no items")

    # 防止重複核准：使用精確標記檢查
    # 使用 ref_type + ref_no + stage 三重條件確保唯一性
    existing_moves = db.query(InventoryMove).filter(
        InventoryMove.ref_type == RefType.PR_APPROVE,
        InventoryMove.ref_no == str(pr.id),  # 使用 report_id 而非 pr_no
        InventoryMove.stage == Stage.PROD_RECEIVE  # 加上 stage 條件
    ).first()
    if existing_moves:
        raise HTTPException(400, "Report already approved (inventory moves exist)")

    # 先驗證所有 FG 都有 BOM（確保 transaction 原子性）
    # 在寫入任何 inventory_move 之前先檢查，避免部分寫入
    fg_product_ids = [it.product_id for it in pr.items]
    fg_products = db.query(Product).filter(Product.id.in_(fg_product_ids)).all()
    fg_product_map = {p.id: p for p in fg_products}
    
    for it in pr.items:
        fg_product = fg_product_map.get(it.product_id)
        if not fg_product:
            raise HTTPException(400, f"Product {it.product_id} not found")
        
        # 檢查是否為 FG 類型（後端保底驗證）
        if fg_product.product_type != "FG":
            raise HTTPException(400, f"Product {it.product_id} is not FG type")
        
        # 檢查 BOM 是否存在
        bom_items = db.query(BomItem).filter(
            BomItem.fg_product_id == it.product_id,
            BomItem.is_active == True
        ).all()
        
        if not bom_items:
            raise HTTPException(400, f"FG product {it.product_id} ({fg_product.name}) has no BOM items")

    # 統計用
    fg_in_count = 0
    fg_in_total_qty = 0
    raw_out_count = 0
    raw_out_total_qty = 0.0

    # Step A: FG 入庫（件）
    # 依 PR items 的 product_id（都是 FG），qty（件）累加進 inventory_moves
    for it in pr.items:
        fg_product = fg_product_map[it.product_id]
        
        # FG 入庫（件）
        db.add(InventoryMove(
            product_id=it.product_id,
            move_type=MoveType.IN,
            qty_change=+it.qty,  # qty 已經是件數
            site=Site.WAREHOUSE,
            stage=Stage.PROD_RECEIVE,
            ref_type=RefType.PR,  # 一般 PR 記錄
            ref_no=pr.pr_no,
            note=f"工廠生產核准入庫（report_date={pr.report_date}）",
        ))
        fg_in_count += 1
        fg_in_total_qty += it.qty

        # Step B: RAW 扣料（允許負）
        # 找到該 FG 的 BOM（已在前面驗證存在）
        bom_items = db.query(BomItem).filter(
            BomItem.fg_product_id == it.product_id,
            BomItem.is_active == True
        ).all()
        
        for bom_item in bom_items:
            # raw_qty_change = - (FG_qty * qty_per_fg_unit)
            # 允許小數，不 round（直接扣小數）
            raw_qty_change = -(it.qty * bom_item.qty_per_fg_unit)
            
            # 寫入 inventory_moves（site = WAREHOUSE，統一使用單一站點）
            db.add(InventoryMove(
                product_id=bom_item.raw_product_id,
                move_type=MoveType.OUT,
                qty_change=raw_qty_change,  # 負數表示扣料（允許小數）
                site=Site.WAREHOUSE,
                stage=Stage.PROD_CONSUME,
                ref_type=RefType.PR,  # 一般 PR 記錄
                ref_no=pr.pr_no,
                note=f"生產扣料（FG={fg_product.name}, {it.qty}件 × {bom_item.qty_per_fg_unit} = {abs(raw_qty_change):.2f}）",
            ))
            raw_out_count += 1
            raw_out_total_qty += abs(raw_qty_change)

    # 寫入核准標記（用於 idempotency 檢查）
    # 使用第一個 FG 的 product_id，如果沒有 items 則用 0（理論上不會發生，因為前面已檢查）
    marker_product_id = pr.items[0].product_id if pr.items else 0
    db.add(InventoryMove(
        product_id=marker_product_id,
        move_type=MoveType.ADJ,
        qty_change=0.0,  # 標記用，不影響庫存
        site=Site.WAREHOUSE,
        stage=Stage.PROD_RECEIVE,
        ref_type=RefType.PR_APPROVE,  # 核准標記
        ref_no=str(pr.id),  # 使用 report_id
        note=f"核准標記（PR#{pr.id}）",
    ))

    pr.status = "APPROVED"
    pr.approved_by_user_id = user.id
    pr.approved_at = datetime.utcnow()

    # 記錄詳細的核准資訊
    comment = f"FG_IN:{fg_in_count}項/{fg_in_total_qty}件, RAW_OUT:{raw_out_count}項/{raw_out_total_qty:.2f}"
    log_action(db, pr.id, "APPROVE", user, comment=comment)
    log_action(db, pr.id, "APPROVE_BOM", user, comment=comment)
    db.commit()
    return {"ok": True}

@router.post("/{pr_id}/reject")
def reject_report(
    pr_id: int,
    payload: PRReject = PRReject(),
    db: Session = Depends(get_db),
    user=Depends(require_roles(Role.admin, Role.supervisor)),
):
    Base.metadata.create_all(bind=engine)
    pr = db.query(ProductionReport).filter(ProductionReport.id == pr_id).first()
    if not pr:
        raise HTTPException(404, "PR not found")
    if pr.status != "SUBMITTED":
        raise HTTPException(400, "Only SUBMITTED can be rejected")

    pr.status = "REJECTED"
    pr.approved_by_user_id = user.id
    pr.approved_at = datetime.utcnow()
    if payload.reason:
        pr.note = (pr.note or "") + f"\n[REJECT] {payload.reason}"

    log_action(db, pr.id, "REJECT", user, payload.reason)
    db.commit()
    return {"ok": True}

@router.get("/last", response_model=PRView)
def last_report(
    mine: bool = True,
    before: _date | None = None,
    db: Session = Depends(get_db),
    user=Depends(require_roles(Role.admin, Role.supervisor, Role.office, Role.worker)),
):
    Base.metadata.create_all(bind=engine)
    before = before or _date.today()

    q = db.query(ProductionReport).filter(ProductionReport.report_date <= before)
    if mine:
        q = q.filter(ProductionReport.reported_by_user_id == user.id)

    pr = q.order_by(desc(ProductionReport.report_date), desc(ProductionReport.id)).first()
    if not pr:
        raise HTTPException(404, "No previous report")
    return pr_to_view(db, pr)

@router.post("/{pr_id}/clone", response_model=PRView)
def clone_report(
    pr_id: int,
    payload: PRCloneIn,
    db: Session = Depends(get_db),
    user=Depends(require_roles(Role.admin, Role.supervisor, Role.office, Role.worker)),
):
    Base.metadata.create_all(bind=engine)

    src = db.query(ProductionReport).filter(ProductionReport.id == pr_id).first()
    if not src:
        raise HTTPException(404, "PR not found")

    # worker 只能 clone 自己的（主管/管理可 clone 全部）
    if user.role not in [Role.admin, Role.supervisor, Role.office] and src.reported_by_user_id != user.id:
        raise HTTPException(403, "Forbidden")

    prefix = make_no("PR")
    seq = db.query(ProductionReport).filter(ProductionReport.pr_no.like(f"{prefix}-%")).count() + 1
    pr_no = f"{prefix}-{seq:04d}"

    new_date = payload.report_date or _date.today()
    qty_zero = (payload.qty_mode or "keep").lower() == "zero"

    pr = ProductionReport(
        pr_no=pr_no,
        report_date=new_date,
        note=payload.note if payload.note is not None else src.note,
        status="SUBMITTED",
        reported_by_user_id=user.id,
    )

    for it in src.items:
        pr.items.append(ProductionReportItem(
            product_id=it.product_id,
            spec_text=it.spec_text,
            qty=(0 if qty_zero else it.qty),
            unit=it.unit,
            note=it.note,
        ))

    db.add(pr)
    db.commit()
    db.refresh(pr)

    log_action(db, pr.id, "SUBMIT", user, comment=f"CLONE from {src.pr_no} qty_mode={payload.qty_mode}")
    db.commit()

    return pr_to_view(db, pr)

