from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session
from sqlalchemy import desc
from datetime import datetime
from .db import get_db, engine, Base
from .models import WorkOrder, WorkOrderStatus, WorkOrderLog, Role
from .schemas import WorkOrderOut, WorkOrderAssign, WorkOrderComplete
from .deps import get_current_user, require_roles
from .pdf import build_work_order_pdf
from .config import settings

router = APIRouter(prefix="/work-orders", tags=["work-orders"])

@router.get("", response_model=list[WorkOrderOut])
def list_work_orders(
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    Base.metadata.create_all(bind=engine)
    return db.query(WorkOrder).order_by(desc(WorkOrder.id)).all()

@router.get("/{wo_id}", response_model=WorkOrderOut)
def get_work_order(
    wo_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    Base.metadata.create_all(bind=engine)
    wo = db.query(WorkOrder).filter(WorkOrder.id == wo_id).first()
    if not wo:
        raise HTTPException(404, "Not found")
    return wo

@router.post("/{wo_id}/start", response_model=WorkOrderOut)
def start_work(
    wo_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    Base.metadata.create_all(bind=engine)
    wo = db.query(WorkOrder).filter(WorkOrder.id == wo_id).first()
    if not wo:
        raise HTTPException(404, "Not found")
    wo.status = WorkOrderStatus.in_progress
    wo.started_at = datetime.utcnow()
    wo.logs.append(WorkOrderLog(action="start", actor=user.username))
    db.commit()
    db.refresh(wo)
    return wo

@router.post("/{wo_id}/complete", response_model=WorkOrderOut)
def complete_work(
    wo_id: int,
    payload: WorkOrderComplete,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    Base.metadata.create_all(bind=engine)
    wo = db.query(WorkOrder).filter(WorkOrder.id == wo_id).first()
    if not wo:
        raise HTTPException(404, "Not found")
    wo.status = WorkOrderStatus.completed
    wo.completed_at = datetime.utcnow()
    wo.good_qty = payload.good_qty
    wo.bad_qty = payload.bad_qty
    wo.cartons_done = payload.cartons_done
    wo.logs.append(
        WorkOrderLog(action="complete", actor=user.username, message=payload.message)
    )
    db.commit()
    db.refresh(wo)
    return wo

@router.get("/{wo_id}/print")
def print_work_order(
    wo_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    Base.metadata.create_all(bind=engine)
    wo = db.query(WorkOrder).filter(WorkOrder.id == wo_id).first()
    if not wo:
        raise HTTPException(404, "Not found")
    pdf = build_work_order_pdf(
        wo_no=wo.wo_no,
        customer_name=wo.customer_name,
        due_date=str(wo.due_date),
        urgent=wo.urgent,
        line=wo.line,
        shift=wo.shift,
        assigned_to=wo.assigned_to,
        items=[it.__dict__ for it in wo.items],
        note=wo.note,
        qr_url=f"{settings.PUBLIC_BASE_URL}/work-orders/{wo.id}",
    )
    return Response(content=pdf, media_type="application/pdf")

