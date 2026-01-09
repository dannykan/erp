import enum
from datetime import datetime, date
from sqlalchemy import String, Integer, Date, DateTime, ForeignKey, Boolean, Text, Enum, REAL, Float
from sqlalchemy.orm import Mapped, mapped_column, relationship
from ..db import Base

class Role(str, enum.Enum):
    admin = "admin"
    office = "office"
    supervisor = "supervisor"
    worker = "worker"
    readonly = "readonly"

class OrderStatus(str, enum.Enum):
    draft = "draft"
    confirmed = "confirmed"
    converted = "converted"

class WorkOrderStatus(str, enum.Enum):
    pending = "pending"
    in_progress = "in_progress"
    completed = "completed"

class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    username: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    display_name: Mapped[str] = mapped_column(String(80), index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    role: Mapped[Role] = mapped_column(Enum(Role), default=Role.worker)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

class Order(Base):
    __tablename__ = "orders"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    order_no: Mapped[str] = mapped_column(String(32), unique=True, index=True)
    customer_name: Mapped[str] = mapped_column(String(120))
    due_date: Mapped[datetime | None] = mapped_column(Date, nullable=True)
    urgent: Mapped[bool] = mapped_column(Boolean, default=False)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[OrderStatus] = mapped_column(Enum(OrderStatus), default=OrderStatus.draft)
    created_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    items: Mapped[list["OrderItem"]] = relationship(back_populates="order", cascade="all, delete-orphan")

class OrderItem(Base):
    __tablename__ = "order_items"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    order_id: Mapped[int] = mapped_column(ForeignKey("orders.id"))
    product_name: Mapped[str] = mapped_column(String(200))
    spec: Mapped[str | None] = mapped_column(String(200), nullable=True)
    packaging: Mapped[str | None] = mapped_column(String(200), nullable=True)
    qty: Mapped[int] = mapped_column(Integer)
    unit: Mapped[str] = mapped_column(String(20), default="包")
    cartons: Mapped[int | None] = mapped_column(Integer, nullable=True)
    per_carton: Mapped[int | None] = mapped_column(Integer, nullable=True)
    note: Mapped[str | None] = mapped_column(String(300), nullable=True)
    order: Mapped["Order"] = relationship(back_populates="items")

class WorkOrder(Base):
    __tablename__ = "work_orders"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    wo_no: Mapped[str] = mapped_column(String(32), unique=True, index=True)
    source_order_id: Mapped[int] = mapped_column(ForeignKey("orders.id"))
    customer_name: Mapped[str] = mapped_column(String(120))
    due_date: Mapped[datetime | None] = mapped_column(Date, nullable=True)
    urgent: Mapped[bool] = mapped_column(Boolean, default=False)
    line: Mapped[str | None] = mapped_column(String(50), nullable=True)
    shift: Mapped[str | None] = mapped_column(String(50), nullable=True)
    assigned_to: Mapped[str | None] = mapped_column(String(80), nullable=True)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[WorkOrderStatus] = mapped_column(Enum(WorkOrderStatus), default=WorkOrderStatus.pending)
    started_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    good_qty: Mapped[int | None] = mapped_column(Integer, nullable=True)
    bad_qty: Mapped[int | None] = mapped_column(Integer, nullable=True)
    cartons_done: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    items: Mapped[list["WorkOrderItem"]] = relationship(back_populates="work_order", cascade="all, delete-orphan")
    logs: Mapped[list["WorkOrderLog"]] = relationship(back_populates="work_order", cascade="all, delete-orphan")

class WorkOrderItem(Base):
    __tablename__ = "work_order_items"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    work_order_id: Mapped[int] = mapped_column(ForeignKey("work_orders.id"))
    product_name: Mapped[str] = mapped_column(String(200))
    spec: Mapped[str | None] = mapped_column(String(200), nullable=True)
    packaging: Mapped[str | None] = mapped_column(String(200), nullable=True)
    qty: Mapped[int] = mapped_column(Integer)
    unit: Mapped[str] = mapped_column(String(20), default="包")
    cartons: Mapped[int | None] = mapped_column(Integer, nullable=True)
    per_carton: Mapped[int | None] = mapped_column(Integer, nullable=True)
    note: Mapped[str | None] = mapped_column(String(300), nullable=True)
    work_order: Mapped["WorkOrder"] = relationship(back_populates="items")

class WorkOrderLog(Base):
    __tablename__ = "work_order_logs"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    work_order_id: Mapped[int] = mapped_column(ForeignKey("work_orders.id"))
    action: Mapped[str] = mapped_column(String(30))
    actor: Mapped[str | None] = mapped_column(String(80), nullable=True)
    message: Mapped[str | None] = mapped_column(String(300), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    work_order: Mapped["WorkOrder"] = relationship(back_populates="logs")

class Product(Base):
    __tablename__ = "products"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)

    sku: Mapped[str | None] = mapped_column(String(50), unique=True, nullable=True, index=True)  # 品號
    name: Mapped[str] = mapped_column(String(200), index=True)
    spec: Mapped[str | None] = mapped_column(String(200), nullable=True)
    unit: Mapped[str] = mapped_column(String(20), default="包")

    # 新增字段
    product_type: Mapped[str] = mapped_column(String(20), nullable=False, default="TRADE")  # RAW | FG | TRADE
    base_unit: Mapped[str] = mapped_column(String(20), nullable=False, default="個")
    alt_unit: Mapped[str | None] = mapped_column(String(20), nullable=True)
    alt_ratio: Mapped[int | None] = mapped_column(Integer, nullable=True)

    safety_stock: Mapped[int] = mapped_column(Integer, default=0)  # 安全庫存
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    # 產品品項管理新增欄位
    quotation_unit: Mapped[str | None] = mapped_column(String(20), nullable=True)  # 報價單位
    pieces_per_case: Mapped[int | None] = mapped_column(Integer, nullable=True)  # 件入數(箱入數)
    pack_quantity: Mapped[str | None] = mapped_column(String(50), nullable=True)  # 包入數
    model: Mapped[str | None] = mapped_column(String(100), nullable=True)  # 型號
    brand: Mapped[str | None] = mapped_column(String(100), nullable=True)  # 品牌
    size: Mapped[str | None] = mapped_column(String(100), nullable=True)  # 尺寸
    origin: Mapped[str | None] = mapped_column(String(50), nullable=True)  # 產地

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

class Customer(Base):
    __tablename__ = "customers"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)

    name: Mapped[str] = mapped_column(String(120), unique=True, index=True)
    customer_code: Mapped[str | None] = mapped_column(String(20), nullable=True, index=True)  # 客戶代號
    short_name: Mapped[str | None] = mapped_column(String(100), nullable=True)  # 簡稱
    full_name: Mapped[str | None] = mapped_column(String(200), nullable=True)  # 長名稱
    tax_id: Mapped[str | None] = mapped_column(String(20), nullable=True)  # 統一編號
    contact: Mapped[str | None] = mapped_column(String(80), nullable=True)  # 聯絡窗口
    phone: Mapped[str | None] = mapped_column(String(50), nullable=True)  # 電話
    address: Mapped[str | None] = mapped_column(String(200), nullable=True)  # 送貨地址
    invoice_title: Mapped[str | None] = mapped_column(String(200), nullable=True)  # 發票抬頭
    sales_category: Mapped[str | None] = mapped_column(String(50), nullable=True)  # 銷貨類別
    filing_date: Mapped[date | None] = mapped_column(Date, nullable=True)  # 建檔日期
    email: Mapped[str | None] = mapped_column(String(200), nullable=True)  # E-mail
    note: Mapped[str | None] = mapped_column(Text, nullable=True)

    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

class MoveType(str, enum.Enum):
    IN = "IN"
    OUT = "OUT"
    ADJ = "ADJ"

class InventoryMove(Base):
    __tablename__ = "inventory_moves"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)

    product_id: Mapped[int] = mapped_column(ForeignKey("products.id"), index=True)

    move_type: Mapped[MoveType] = mapped_column(Enum(MoveType), default=MoveType.ADJ)
    qty_change: Mapped[float] = mapped_column(REAL)  # 正負數：IN=+、OUT=-、ADJ可正可負（允許小數）

    # 🔽 新增（可先 nullable，完全不破壞舊資料）
    site: Mapped[str | None] = mapped_column(String(20), nullable=True)
    stage: Mapped[str | None] = mapped_column(String(20), nullable=True)

    ref_type: Mapped[str | None] = mapped_column(String(20), nullable=True)  # PO/SO/ADJ/WO...
    ref_no: Mapped[str | None] = mapped_column(String(50), nullable=True)    # 單號
    note: Mapped[str | None] = mapped_column(String(300), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

class PurchaseOrder(Base):
    __tablename__ = "purchase_orders"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)

    po_no: Mapped[str] = mapped_column(String(32), unique=True, index=True)
    supplier_name: Mapped[str] = mapped_column(String(120))  # MVP先用文字
    doc_date: Mapped[datetime | None] = mapped_column(Date, nullable=True)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    items: Mapped[list["PurchaseOrderItem"]] = relationship(
        back_populates="purchase_order", cascade="all, delete-orphan"
    )


class PurchaseOrderItem(Base):
    __tablename__ = "purchase_order_items"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)

    purchase_order_id: Mapped[int] = mapped_column(ForeignKey("purchase_orders.id"))
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id"), index=True)

    qty: Mapped[int] = mapped_column(Integer)
    unit: Mapped[str] = mapped_column(String(20), default="包")
    note: Mapped[str | None] = mapped_column(String(300), nullable=True)

    purchase_order: Mapped["PurchaseOrder"] = relationship(back_populates="items")


class SalesOrder(Base):
    __tablename__ = "sales_orders"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)

    so_no: Mapped[str] = mapped_column(String(32), unique=True, index=True)
    customer_name: Mapped[str] = mapped_column(String(120))  # MVP先用文字
    doc_date: Mapped[datetime | None] = mapped_column(Date, nullable=True)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(
        String(20),
        default="DRAFT"  # DRAFT / PICKED / SHIPPED
    )

    # 揀貨/出貨紀錄
    picked_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    picked_by_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    shipped_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    shipped_by_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    ship_note: Mapped[str | None] = mapped_column(Text, nullable=True)
    logistics_no: Mapped[str | None] = mapped_column(String(64), nullable=True)

    # 付款紀錄
    is_paid: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    paid_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    paid_by_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    discount_amount: Mapped[float | None] = mapped_column(REAL, nullable=True, default=0.0)  # 折讓金額

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    items: Mapped[list["SalesOrderItem"]] = relationship(
        back_populates="sales_order", cascade="all, delete-orphan"
    )


class SalesOrderItem(Base):
    __tablename__ = "sales_order_items"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)

    sales_order_id: Mapped[int] = mapped_column(ForeignKey("sales_orders.id"))
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id"), index=True)

    qty: Mapped[int] = mapped_column(Integer)
    unit: Mapped[str] = mapped_column(String(20), default="包")
    unit_price: Mapped[float] = mapped_column(Float, nullable=False, default=0)
    price_unit: Mapped[str] = mapped_column(String(20), nullable=False, default="件")
    note: Mapped[str | None] = mapped_column(String(300), nullable=True)
    mark: Mapped[str | None] = mapped_column(String(100), nullable=True)

    sales_order: Mapped["SalesOrder"] = relationship(back_populates="items")


class ProductionReport(Base):
    __tablename__ = "production_reports"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)

    pr_no: Mapped[str] = mapped_column(String(32), unique=True, index=True)
    report_date: Mapped[date] = mapped_column(Date, index=True)

    status: Mapped[str] = mapped_column(String(20), default="SUBMITTED")  
    # SUBMITTED / APPROVED / REJECTED

    note: Mapped[str | None] = mapped_column(Text, nullable=True)

    reported_by_user_id: Mapped[int] = mapped_column(Integer, index=True)
    approved_by_user_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    approved_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    items: Mapped[list["ProductionReportItem"]] = relationship(
        back_populates="report", cascade="all, delete-orphan"
    )


class ProductionReportItem(Base):
    __tablename__ = "production_report_items"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)

    report_id: Mapped[int] = mapped_column(ForeignKey("production_reports.id"), index=True)
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id"), index=True)

    # 允許員工填「今日實際規格」：有些工廠會跟商品 spec 不完全一致
    spec_text: Mapped[str | None] = mapped_column(String(200), nullable=True)

    qty: Mapped[int] = mapped_column(Integer)
    unit: Mapped[str] = mapped_column(String(20), default="包")
    note: Mapped[str | None] = mapped_column(String(300), nullable=True)

    report: Mapped["ProductionReport"] = relationship(back_populates="items")


class ProductionReportAction(Base):
    __tablename__ = "production_report_actions"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)

    report_id: Mapped[int] = mapped_column(ForeignKey("production_reports.id"), index=True)
    action: Mapped[str] = mapped_column(String(20))  # SUBMIT / APPROVE / REJECT / EDIT / CANCEL
    actor_user_id: Mapped[int] = mapped_column(Integer, index=True)
    actor_role: Mapped[str | None] = mapped_column(String(30), nullable=True)
    comment: Mapped[str | None] = mapped_column(String(500), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class BomItem(Base):
    __tablename__ = "bom_items"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)

    fg_product_id: Mapped[int] = mapped_column(ForeignKey("products.id"), index=True)
    raw_product_id: Mapped[int] = mapped_column(ForeignKey("products.id"), index=True)
    qty_per_fg_unit: Mapped[float] = mapped_column(REAL)  # 每 1 件成品需消耗多少 raw（以 raw 的 base_unit）
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class ReturnOrderStatus(str, enum.Enum):
    pending = "pending"  # 待確認
    confirmed = "confirmed"  # 已確認
    stocked = "stocked"  # 已入倉


class ReturnOrder(Base):
    __tablename__ = "return_orders"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)

    return_no: Mapped[str] = mapped_column(String(32), unique=True, index=True)
    customer_name: Mapped[str] = mapped_column(String(120))
    source_so_id: Mapped[int] = mapped_column(ForeignKey("sales_orders.id"), index=True)  # 來源銷貨單ID
    doc_date: Mapped[datetime | None] = mapped_column(Date, nullable=True)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(
        String(20),
        default="pending"  # pending / confirmed / stocked
    )
    is_stocked: Mapped[bool] = mapped_column(Boolean, default=False)  # 是否已入倉
    
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    created_by_id: Mapped[int | None] = mapped_column(Integer, nullable=True)

    items: Mapped[list["ReturnOrderItem"]] = relationship(
        back_populates="return_order", cascade="all, delete-orphan"
    )


class ReturnOrderItem(Base):
    __tablename__ = "return_order_items"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)

    return_order_id: Mapped[int] = mapped_column(ForeignKey("return_orders.id"), index=True)
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id"), index=True)
    qty: Mapped[float] = mapped_column(REAL)
    unit: Mapped[str] = mapped_column(String(20))
    unit_price: Mapped[float] = mapped_column(REAL)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)

    return_order: Mapped["ReturnOrder"] = relationship(back_populates="items")


class RefundRecord(Base):
    __tablename__ = "refund_records"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)

    return_order_id: Mapped[int] = mapped_column(ForeignKey("return_orders.id"), index=True)
    sales_order_id: Mapped[int] = mapped_column(ForeignKey("sales_orders.id"), index=True)
    refund_amount: Mapped[float] = mapped_column(REAL)  # 退款金額
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    created_by_id: Mapped[int | None] = mapped_column(Integer, nullable=True)

# 導入新的 PrintJob model
from .print_job import PrintJob
