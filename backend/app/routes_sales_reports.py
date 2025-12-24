from fastapi import APIRouter, Depends, Query, Response, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func, desc
from datetime import date
from typing import Optional
import io

from .db import get_db
from .models import SalesOrder, SalesOrderItem, Product
from .deps import get_current_user
from .schemas import (
    SRProductCustomersOut, SRProductCustomerRow,
    SRProductRankOut, SRProductRankRow,
)
from openpyxl import Workbook
from openpyxl.utils import get_column_letter

router = APIRouter(prefix="/sales-reports", tags=["sales-reports"])

def _autosize(ws):
    for col in ws.columns:
        max_len = 0
        col_letter = get_column_letter(col[0].column)
        for cell in col:
            v = "" if cell.value is None else str(cell.value)
            if len(v) > max_len:
                max_len = len(v)
        ws.column_dimensions[col_letter].width = min(max_len + 2, 60)

def _apply_date_filter(q, date_from: Optional[date], date_to: Optional[date]):
    # 以 doc_date 為主（你們 ERP 用這個最直覺）
    if date_from:
        q = q.filter(SalesOrder.doc_date >= date_from)
    if date_to:
        q = q.filter(SalesOrder.doc_date <= date_to)
    return q

@router.get("/product-customers", response_model=SRProductCustomersOut)
def product_customers(
    product_id: int = Query(..., ge=1),
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    # 確認商品存在
    p = db.query(Product).filter(Product.id == product_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="product not found")

    # per-customer aggregates
    rows_q = (
        db.query(
            SalesOrder.customer_name.label("customer_name"),
            func.count(func.distinct(SalesOrder.id)).label("order_count"),
            func.coalesce(func.sum(SalesOrderItem.qty), 0).label("total_qty"),
            func.coalesce(func.sum(SalesOrderItem.qty * SalesOrderItem.unit_price), 0).label("total_amount"),
            func.max(SalesOrder.doc_date).label("last_order_date"),
        )
        .select_from(SalesOrderItem)
        .join(SalesOrder, SalesOrder.id == SalesOrderItem.sales_order_id)
        .filter(SalesOrderItem.product_id == product_id)
    )
    rows_q = _apply_date_filter(rows_q, date_from, date_to)
    rows_q = rows_q.group_by(SalesOrder.customer_name).order_by(desc("total_amount"))

    agg = rows_q.all()

    # 找每個客戶「最近一次」成交的 unit_price / price_unit（用 doc_date + id 作 tie-break）
    result_rows: list[SRProductCustomerRow] = []
    for r in agg:
        cname = (r.customer_name or "").strip()

        last_item = (
            db.query(SalesOrderItem, SalesOrder)
            .join(SalesOrder, SalesOrder.id == SalesOrderItem.sales_order_id)
            .filter(SalesOrderItem.product_id == product_id)
            .filter(SalesOrder.customer_name == cname)
        )
        last_item = _apply_date_filter(last_item, date_from, date_to)
        last_item = last_item.order_by(desc(SalesOrder.doc_date), desc(SalesOrder.id), desc(SalesOrderItem.id)).first()

        last_unit_price = 0.0
        last_price_unit = "件"
        if last_item:
            it, so = last_item
            last_unit_price = float(it.unit_price or 0)
            last_price_unit = (getattr(it, "price_unit", None) or it.unit or "件").strip() or "件"

        result_rows.append(
            SRProductCustomerRow(
                customer_name=cname,
                order_count=int(r.order_count or 0),
                total_qty=float(r.total_qty or 0),
                total_amount=float(r.total_amount or 0),
                last_unit_price=last_unit_price,
                last_price_unit=last_price_unit,
                last_order_date=r.last_order_date,
            )
        )

    return {
        "product_id": product_id,
        "date_from": date_from,
        "date_to": date_to,
        "rows": result_rows,
    }

@router.get("/product-customers/export.xlsx")
def product_customers_export_xlsx(
    product_id: int = Query(..., ge=1),
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    data = product_customers(product_id, date_from, date_to, db, user)

    wb = Workbook()
    ws = wb.active
    ws.title = "ProductCustomers"
    ws.append(["product_id", "date_from", "date_to"])
    ws.append([data["product_id"], str(data["date_from"] or ""), str(data["date_to"] or "")])
    ws.append([])
    ws.append(["customer_name", "order_count", "total_qty", "total_amount", "last_unit_price", "last_price_unit", "last_order_date"])

    for r in data["rows"]:
        ws.append([
            r.customer_name,
            r.order_count,
            r.total_qty,
            r.total_amount,
            r.last_unit_price,
            r.last_price_unit,
            str(r.last_order_date or ""),
        ])

    _autosize(ws)
    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)

    filename = f"product_customers_{product_id}.xlsx"
    return Response(
        content=buf.getvalue(),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )

@router.get("/products-rank", response_model=SRProductRankOut)
def products_rank(
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    top_n: int = Query(50, ge=1, le=500),
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    q = (
        db.query(
            Product.id.label("product_id"),
            Product.sku.label("sku"),
            Product.name.label("name"),
            func.count(func.distinct(SalesOrder.id)).label("order_count"),
            func.count(func.distinct(SalesOrder.customer_name)).label("customer_count"),
            func.coalesce(func.sum(SalesOrderItem.qty), 0).label("total_qty"),
            func.coalesce(func.sum(SalesOrderItem.qty * SalesOrderItem.unit_price), 0).label("total_amount"),
        )
        .join(SalesOrderItem, SalesOrderItem.product_id == Product.id)
        .join(SalesOrder, SalesOrder.id == SalesOrderItem.sales_order_id)
    )
    q = _apply_date_filter(q, date_from, date_to)
    q = q.group_by(Product.id, Product.sku, Product.name).order_by(desc("total_amount")).limit(top_n)

    rows = []
    for r in q.all():
        rows.append(
            SRProductRankRow(
                product_id=int(r.product_id),
                sku=r.sku,
                name=r.name,
                order_count=int(r.order_count or 0),
                customer_count=int(r.customer_count or 0),
                total_qty=float(r.total_qty or 0),
                total_amount=float(r.total_amount or 0),
            )
        )

    return {"date_from": date_from, "date_to": date_to, "top_n": top_n, "rows": rows}

@router.get("/products-rank/export.xlsx")
def products_rank_export_xlsx(
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    top_n: int = Query(50, ge=1, le=500),
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    data = products_rank(date_from, date_to, top_n, db, user)

    wb = Workbook()
    ws = wb.active
    ws.title = "ProductsRank"
    ws.append(["date_from", "date_to", "top_n"])
    ws.append([str(data["date_from"] or ""), str(data["date_to"] or ""), data["top_n"]])
    ws.append([])
    ws.append(["product_id", "sku", "name", "order_count", "customer_count", "total_qty", "total_amount"])

    for r in data["rows"]:
        ws.append([
            r.product_id,
            r.sku or "",
            r.name,
            r.order_count,
            r.customer_count,
            r.total_qty,
            r.total_amount,
        ])

    _autosize(ws)
    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)

    filename = "products_rank.xlsx"
    return Response(
        content=buf.getvalue(),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )

