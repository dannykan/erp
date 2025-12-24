from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import desc
from .db import get_db, engine, Base
from .models import Customer, Role
from .schemas import CustomerIn, CustomerOut
from .deps import get_current_user, require_roles

router = APIRouter(prefix="/customers", tags=["customers"])

@router.get("", response_model=list[CustomerOut])
def list_customers(
    q: str | None = None,
    active: bool | None = None,
    limit: int = 200,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    Base.metadata.create_all(bind=engine)
    qry = db.query(Customer).order_by(desc(Customer.id))
    if q:
        qry = qry.filter(Customer.name.contains(q))
    if active is not None:
        qry = qry.filter(Customer.is_active == active)
    return qry.limit(min(limit, 500)).all()

@router.post("", response_model=CustomerOut)
def create_customer(
    payload: CustomerIn,
    db: Session = Depends(get_db),
    user=Depends(require_roles(Role.admin, Role.office, Role.supervisor)),
):
    Base.metadata.create_all(bind=engine)
    exists = db.query(Customer).filter(Customer.name == payload.name).first()
    if exists:
        raise HTTPException(400, "Customer name already exists")
    c = Customer(**payload.model_dump())
    db.add(c)
    db.commit()
    db.refresh(c)
    return c

@router.put("/{customer_id}", response_model=CustomerOut)
def update_customer(
    customer_id: int,
    payload: CustomerIn,
    db: Session = Depends(get_db),
    user=Depends(require_roles(Role.admin, Role.office, Role.supervisor)),
):
    Base.metadata.create_all(bind=engine)
    c = db.query(Customer).filter(Customer.id == customer_id).first()
    if not c:
        raise HTTPException(404, "Customer not found")

    # name 若改了檢查唯一
    if payload.name != c.name:
        exists = db.query(Customer).filter(Customer.name == payload.name).first()
        if exists:
            raise HTTPException(400, "Customer name already exists")

    for k, v in payload.model_dump().items():
        setattr(c, k, v)
    db.commit()
    db.refresh(c)
    return c

