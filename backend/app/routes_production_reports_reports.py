from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func, text, literal_column
from datetime import date
from .db import get_db, engine, Base
from .deps import get_current_user
from .models import ProductionReport, ProductionReportItem, Product
from .schemas import PRSummaryRow
from .report_utils import bucket_expr_sqlite

router = APIRouter(prefix="/production-reports", tags=["production-reports-reports"])

def status_filter(q, status: str):
    if status == "ALL":
        return q
    return q.filter(ProductionReport.status == status)

@router.get("/summary/by-employee", response_model=list[PRSummaryRow])
def summary_by_employee(
    from_date: date,
    to_date: date,
    bucket: str = "day",
    status: str = "APPROVED",
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    Base.metadata.create_all(bind=engine)

    bucket_sql_template = bucket_expr_sqlite(bucket)
    # 替換 report_date 為 production_reports.report_date 以避免歧義
    bucket_sql = bucket_sql_template.replace("report_date", "production_reports.report_date")
    # 使用 literal_column 代替 text，因為 literal_column 支持 .label()
    bucket_expr = literal_column(bucket_sql).label("bucket")
    # APPROVED 才算正式生產（你也可讓 status=ALL）
    q = (
        db.query(
            bucket_expr,
            ProductionReport.reported_by_user_id.label("emp_id"),
            func.sum(ProductionReportItem.qty).label("total_qty"),
        )
        .join(ProductionReportItem, ProductionReportItem.report_id == ProductionReport.id)
        .filter(ProductionReport.report_date >= from_date, ProductionReport.report_date <= to_date)
    )
    q = status_filter(q, status)
    # 在 group_by 和 order_by 中使用相同的 literal_column 表達式
    bucket_expr_for_group = literal_column(bucket_sql)
    q = q.group_by(bucket_expr_for_group, ProductionReport.reported_by_user_id).order_by(bucket_expr_for_group)

    rows = []
    for r in q.all():
        rows.append(PRSummaryRow(
            bucket=str(r.bucket),
            key=f"employee:{r.emp_id}",
            label=f"員工ID {r.emp_id}",
            total_qty=int(r.total_qty or 0),
        ))
    return rows

@router.get("/summary/by-product", response_model=list[PRSummaryRow])
def summary_by_product(
    from_date: date,
    to_date: date,
    bucket: str = "day",
    status: str = "APPROVED",
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    Base.metadata.create_all(bind=engine)
    bucket_sql_template = bucket_expr_sqlite(bucket)
    # 替換 report_date 為 production_reports.report_date 以避免歧義
    bucket_sql = bucket_sql_template.replace("report_date", "production_reports.report_date")
    # 使用 literal_column 代替 text，因為 literal_column 支持 .label()
    bucket_expr = literal_column(bucket_sql).label("bucket")

    q = (
        db.query(
            bucket_expr,
            ProductionReportItem.product_id.label("product_id"),
            func.sum(ProductionReportItem.qty).label("total_qty"),
        )
        .join(ProductionReport, ProductionReport.id == ProductionReportItem.report_id)
        .filter(ProductionReport.report_date >= from_date, ProductionReport.report_date <= to_date)
    )
    q = status_filter(q, status)
    # 在 group_by 和 order_by 中使用相同的 literal_column 表達式
    bucket_expr_for_group = literal_column(bucket_sql)
    q = q.group_by(bucket_expr_for_group, ProductionReportItem.product_id).order_by(bucket_expr_for_group)

    prod_map = {p.id: p for p in db.query(Product).all()}
    rows = []
    for r in q.all():
        p = prod_map.get(int(r.product_id))
        label = f"{p.sku+' - ' if p and p.sku else ''}{p.name if p else ('#'+str(r.product_id))}"
        rows.append(PRSummaryRow(
            bucket=str(r.bucket),
            key=f"product:{r.product_id}",
            label=label,
            total_qty=int(r.total_qty or 0),
        ))
    return rows

@router.get("/summary/by-product-spec", response_model=list[PRSummaryRow])
def summary_by_product_spec(
    from_date: date,
    to_date: date,
    bucket: str = "day",
    status: str = "APPROVED",
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    Base.metadata.create_all(bind=engine)
    bucket_sql_template = bucket_expr_sqlite(bucket)
    # 替換 report_date 為 production_reports.report_date 以避免歧義
    bucket_sql = bucket_sql_template.replace("report_date", "production_reports.report_date")
    # 使用 literal_column 代替 text，因為 literal_column 支持 .label()
    bucket_expr = literal_column(bucket_sql).label("bucket")

    # spec_key = item.spec_text 若空，fallback product.spec
    # SQLite: 用 COALESCE
    spec_key_expr = func.coalesce(ProductionReportItem.spec_text, Product.spec, text("''"))
    q = (
        db.query(
            bucket_expr,
            ProductionReportItem.product_id.label("product_id"),
            spec_key_expr.label("spec_key"),
            func.sum(ProductionReportItem.qty).label("total_qty"),
        )
        .join(ProductionReport, ProductionReport.id == ProductionReportItem.report_id)
        .join(Product, Product.id == ProductionReportItem.product_id)
        .filter(ProductionReport.report_date >= from_date, ProductionReport.report_date <= to_date)
    )
    q = status_filter(q, status)
    # 在 group_by 和 order_by 中使用相同的 literal_column 表達式
    bucket_expr_for_group = literal_column(bucket_sql)
    q = q.group_by(bucket_expr_for_group, ProductionReportItem.product_id, spec_key_expr).order_by(bucket_expr_for_group)

    rows = []
    for r in q.all():
        spec = (r.spec_key or "").strip() or "-"
        rows.append(PRSummaryRow(
            bucket=str(r.bucket),
            key=f"spec:{r.product_id}:{spec}",
            label=f"#{r.product_id} | {spec}",
            total_qty=int(r.total_qty or 0),
        ))
    return rows

