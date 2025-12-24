from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import desc
from .db import get_db, engine, Base
from .models import Order, OrderItem, OrderStatus, WorkOrder, WorkOrderItem, WorkOrderLog, WorkOrderStatus, Role
from .schemas import OrderCreate, OrderOut, WorkOrderOut
from .deps import get_current_user, require_roles
from .utils import make_no

router = APIRouter(prefix="/orders", tags=["orders"])

@router.post("", response_model=OrderOut)
def create_order(
    payload: OrderCreate,
    db: Session = Depends(get_db),
    user=Depends(require_roles(Role.admin, Role.office, Role.supervisor)),
):
    Base.metadata.create_all(bind=engine)

    prefix = make_no("SO")
    seq = db.query(Order).filter(Order.order_no.like(f"{prefix}-%")).count() + 1
    order_no = f"{prefix}-{seq:04d}"

    o = Order(
        order_no=order_no,
        customer_name=payload.customer_name,
        due_date=payload.due_date,
        urgent=payload.urgent,
        note=payload.note,
        status=OrderStatus.confirmed,
        created_by_id=user.id,
    )
    for it in payload.items:
        o.items.append(OrderItem(**it.model_dump()))
    db.add(o)
    db.commit()
    db.refresh(o)
    return o

@router.get("", response_model=list[OrderOut])
def list_orders(
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    Base.metadata.create_all(bind=engine)
    return db.query(Order).order_by(desc(Order.id)).all()

@router.post("/{order_id}/to-work-order", response_model=WorkOrderOut)
def to_work_order(
    order_id: int,
    db: Session = Depends(get_db),
    user=Depends(require_roles(Role.admin, Role.office, Role.supervisor)),
):
    Base.metadata.create_all(bind=engine)
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(404, "Order not found")

    prefix = make_no("WO")
    seq = db.query(WorkOrder).filter(WorkOrder.wo_no.like(f"{prefix}-%")).count() + 1
    wo_no = f"{prefix}-{seq:04d}"

    wo = WorkOrder(
        wo_no=wo_no,
        source_order_id=order.id,
        customer_name=order.customer_name,
        due_date=order.due_date,
        urgent=order.urgent,
        note=order.note,
        status=WorkOrderStatus.pending,
    )
    for it in order.items:
        wo.items.append(
            WorkOrderItem(
                product_name=it.product_name,
                spec=it.spec,
                packaging=it.packaging,
                qty=it.qty,
                unit=it.unit,
                cartons=it.cartons,
                per_carton=it.per_carton,
                note=it.note,
            )
        )
    wo.logs.append(
        WorkOrderLog(action="create", actor=user.username, message=order.order_no)
    )

    order.status = OrderStatus.converted
    db.add(wo)
    db.commit()
    db.refresh(wo)
    return wo

