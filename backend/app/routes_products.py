from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import desc
from typing import List
from pydantic import BaseModel
from .db import get_db, engine, Base
from .models import Product, Role
from .schemas import ProductIn, ProductOut
from .deps import get_current_user, require_roles

router = APIRouter(prefix="/products", tags=["products"])

class BulkProductCreate(BaseModel):
    products: List[ProductIn]

@router.get("", response_model=list[ProductOut])
def list_products(
    q: str | None = None,
    active: bool | None = None,
    limit: int = 200,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    Base.metadata.create_all(bind=engine)
    qry = db.query(Product).order_by(desc(Product.id))
    if q:
        qry = qry.filter((Product.name.contains(q)) | (Product.sku.contains(q)))
    if active is not None:
        qry = qry.filter(Product.is_active == active)
    return qry.limit(min(limit, 500)).all()

@router.post("", response_model=ProductOut)
def create_product(
    payload: ProductIn,
    db: Session = Depends(get_db),
    user=Depends(require_roles(Role.admin, Role.office, Role.supervisor)),
):
    Base.metadata.create_all(bind=engine)

    # sku 若有填，檢查唯一
    if payload.sku:
        exists = db.query(Product).filter(Product.sku == payload.sku).first()
        if exists:
            raise HTTPException(400, "SKU already exists")

    # 驗證 product_type
    if payload.product_type not in ["RAW", "FG", "TRADE"]:
        raise HTTPException(400, "product_type 只能是 RAW | FG | TRADE")
    
    # 驗證單位換算：若 alt_unit 有值，alt_ratio 必須 > 0
    if payload.alt_unit and (payload.alt_ratio is None or payload.alt_ratio <= 0):
        raise HTTPException(400, "alt_ratio 必須 > 0（因為 alt_unit 有填）")
    
    # 驗證單位換算：若 alt_ratio 有值，alt_unit 不可空
    if payload.alt_ratio is not None and payload.alt_ratio > 0 and not payload.alt_unit:
        raise HTTPException(400, "alt_unit 不可空（因為 alt_ratio 有填）")

    p = Product(**payload.model_dump())
    db.add(p)
    db.commit()
    db.refresh(p)
    return p

@router.put("/{product_id}", response_model=ProductOut)
def update_product(
    product_id: int,
    payload: ProductIn,
    db: Session = Depends(get_db),
    user=Depends(require_roles(Role.admin, Role.office, Role.supervisor)),
):
    Base.metadata.create_all(bind=engine)
    p = db.query(Product).filter(Product.id == product_id).first()
    if not p:
        raise HTTPException(404, "Product not found")

    # sku 若改了，檢查唯一
    if payload.sku and payload.sku != p.sku:
        exists = db.query(Product).filter(Product.sku == payload.sku).first()
        if exists:
            raise HTTPException(400, "SKU already exists")

    # 驗證 product_type
    if payload.product_type not in ["RAW", "FG", "TRADE"]:
        raise HTTPException(400, "product_type 只能是 RAW | FG | TRADE")
    
    # 驗證單位換算：若 alt_unit 有值，alt_ratio 必須 > 0
    if payload.alt_unit and (payload.alt_ratio is None or payload.alt_ratio <= 0):
        raise HTTPException(400, "alt_ratio 必須 > 0（因為 alt_unit 有填）")
    
    # 驗證單位換算：若 alt_ratio 有值，alt_unit 不可空
    if payload.alt_ratio is not None and payload.alt_ratio > 0 and not payload.alt_unit:
        raise HTTPException(400, "alt_unit 不可空（因為 alt_ratio 有填）")

    for k, v in payload.model_dump().items():
        setattr(p, k, v)

    db.commit()
    db.refresh(p)
    return p

@router.post("/bulk", response_model=dict)
def bulk_create_products(
    payload: BulkProductCreate,
    db: Session = Depends(get_db),
    user=Depends(require_roles(Role.admin, Role.office, Role.supervisor)),
):
    """批量創建產品"""
    Base.metadata.create_all(bind=engine)
    
    created = []
    skipped = []
    errors = []
    
    for idx, product_data in enumerate(payload.products):
        try:
            # 檢查 SKU 是否已存在
            if product_data.sku:
                exists = db.query(Product).filter(Product.sku == product_data.sku).first()
                if exists:
                    skipped.append({
                        "index": idx + 1,
                        "sku": product_data.sku,
                        "name": product_data.name,
                        "reason": "SKU already exists"
                    })
                    continue
            
            # 驗證 product_type
            if product_data.product_type not in ["RAW", "FG", "TRADE"]:
                errors.append({
                    "index": idx + 1,
                    "sku": product_data.sku,
                    "name": product_data.name,
                    "reason": f"Invalid product_type: {product_data.product_type}"
                })
                continue
            
            # 驗證單位換算
            if product_data.alt_unit and (product_data.alt_ratio is None or product_data.alt_ratio <= 0):
                errors.append({
                    "index": idx + 1,
                    "sku": product_data.sku,
                    "name": product_data.name,
                    "reason": "alt_ratio 必須 > 0（因為 alt_unit 有填）"
                })
                continue
            
            if product_data.alt_ratio is not None and product_data.alt_ratio > 0 and not product_data.alt_unit:
                errors.append({
                    "index": idx + 1,
                    "sku": product_data.sku,
                    "name": product_data.name,
                    "reason": "alt_unit 不可空（因為 alt_ratio 有填）"
                })
                continue
            
            # 創建產品
            p = Product(**product_data.model_dump())
            db.add(p)
            created.append({
                "sku": product_data.sku,
                "name": product_data.name
            })
        except Exception as e:
            errors.append({
                "index": idx + 1,
                "sku": product_data.sku if product_data else None,
                "name": product_data.name if product_data else None,
                "reason": str(e)
            })
    
    db.commit()
    
    return {
        "created_count": len(created),
        "skipped_count": len(skipped),
        "error_count": len(errors),
        "created": created,
        "skipped": skipped,
        "errors": errors
    }

