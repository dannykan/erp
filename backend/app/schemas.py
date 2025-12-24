from pydantic import BaseModel, Field, field_validator
from datetime import date, datetime
from typing import List, Optional
from .models import OrderStatus, WorkOrderStatus, Role

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"

class LoginIn(BaseModel):
    username: str
    password: str

class UserIn(BaseModel):
    username: str
    display_name: str
    role: str = "worker"
    is_active: bool = True
    password: Optional[str] = None  # 新增或重設用

class UserOut(BaseModel):
    id: int
    username: str
    display_name: str
    role: str  # 从 Role enum 转为 str
    is_active: bool
    created_at: datetime
    class Config:
        from_attributes = True


# ===== 訂單 =====
class OrderItemIn(BaseModel):
    product_name: str
    spec: Optional[str] = None
    packaging: Optional[str] = None
    qty: int = Field(ge=1)
    unit: str = "包"
    cartons: Optional[int] = None
    per_carton: Optional[int] = None
    note: Optional[str] = None

class OrderCreate(BaseModel):
    customer_name: str
    due_date: Optional[date] = None
    urgent: bool = False
    note: Optional[str] = None
    items: List[OrderItemIn]

class OrderItemOut(OrderItemIn):
    id: int
    class Config:
        from_attributes = True

class OrderOut(BaseModel):
    id: int
    order_no: str
    customer_name: str
    due_date: Optional[date]
    urgent: bool
    note: Optional[str]
    status: OrderStatus
    created_at: datetime
    items: List[OrderItemOut]
    class Config:
        from_attributes = True


# ===== 工單 =====
class WorkOrderAssign(BaseModel):
    line: Optional[str] = None
    shift: Optional[str] = None
    assigned_to: Optional[str] = None
    note: Optional[str] = None

class WorkOrderComplete(BaseModel):
    good_qty: Optional[int] = None
    bad_qty: Optional[int] = None
    cartons_done: Optional[int] = None
    message: Optional[str] = None

class WorkOrderItemOut(BaseModel):
    id: int
    product_name: str
    spec: Optional[str]
    packaging: Optional[str]
    qty: int
    unit: str
    cartons: Optional[int]
    per_carton: Optional[int]
    note: Optional[str]
    class Config:
        from_attributes = True

class WorkOrderLogOut(BaseModel):
    id: int
    action: str
    actor: Optional[str]
    message: Optional[str]
    created_at: datetime
    class Config:
        from_attributes = True

class WorkOrderOut(BaseModel):
    id: int
    wo_no: str
    customer_name: str
    due_date: Optional[date]
    urgent: bool
    line: Optional[str]
    shift: Optional[str]
    assigned_to: Optional[str]
    note: Optional[str]
    status: WorkOrderStatus
    started_at: Optional[datetime]
    completed_at: Optional[datetime]
    good_qty: Optional[int]
    bad_qty: Optional[int]
    cartons_done: Optional[int]
    items: List[WorkOrderItemOut]
    logs: List[WorkOrderLogOut]
    class Config:
        from_attributes = True


# ===== 商品 =====
class ProductBase(BaseModel):
    sku: Optional[str] = None
    name: str
    spec: Optional[str] = None
    unit: str = "包"
    # 新增字段
    product_type: str = "TRADE"  # RAW | FG | TRADE
    base_unit: str = "個"
    alt_unit: Optional[str] = None
    alt_ratio: Optional[int] = None
    safety_stock: int = 0
    is_active: bool = True
    # 產品品項管理新增欄位
    quotation_unit: Optional[str] = None  # 報價單位
    pieces_per_case: Optional[int] = None  # 件入數(箱入數)
    pack_quantity: Optional[str] = None  # 包入數
    model: Optional[str] = None  # 型號
    brand: Optional[str] = None  # 品牌
    size: Optional[str] = None  # 尺寸
    origin: Optional[str] = None  # 產地

    @field_validator("alt_ratio")
    @classmethod
    def validate_alt_ratio(cls, v, info):
        alt_unit = info.data.get("alt_unit")
        if alt_unit and (v is None or v <= 0):
            raise ValueError("alt_ratio 必須 > 0（因為 alt_unit 有填）")
        return v

    @field_validator("product_type")
    @classmethod
    def validate_product_type(cls, v):
        if v not in ["RAW", "FG", "TRADE"]:
            raise ValueError("product_type 只能是 RAW | FG | TRADE")
        return v

class ProductIn(ProductBase):
    pass

class ProductOut(ProductBase):
    id: int
    created_at: datetime
    class Config:
        from_attributes = True


# ===== 庫存 =====
class InventoryRow(BaseModel):
    product_id: int
    sku: Optional[str] = None
    name: str
    unit: str  # 保留向后兼容
    base_unit: Optional[str] = None  # 主单位（优先使用）
    safety_stock: int
    current_stock: float  # 允許小數
    low_stock: bool

class InventoryMoveIn(BaseModel):
    product_id: int
    move_type: str = "ADJ"   # IN / OUT / ADJ
    qty_change: float  # 允許小數
    site: Optional[str] = None
    stage: Optional[str] = None
    ref_type: Optional[str] = None
    ref_no: Optional[str] = None
    note: Optional[str] = None

class InventoryMoveOut(BaseModel):
    id: int
    product_id: int
    move_type: str
    qty_change: float  # 允許小數
    site: Optional[str]
    stage: Optional[str]
    ref_type: Optional[str]
    ref_no: Optional[str]
    note: Optional[str]
    created_at: datetime
    class Config:
        from_attributes = True

class StockBatchIn(BaseModel):
    product_ids: list[int]
    site: Optional[str] = None  # WAREHOUSE (MVP v2: 只支援單一站點)


# ===== 進貨入庫（PO）=====
class POItemIn(BaseModel):
    product_id: int
    qty: int = Field(ge=1)
    unit: str = "包"
    note: Optional[str] = None

class POCreate(BaseModel):
    supplier_name: str
    doc_date: Optional[date] = None
    note: Optional[str] = None
    items: List[POItemIn]

class POItemOut(POItemIn):
    id: int
    class Config:
        from_attributes = True

class POOut(BaseModel):
    id: int
    po_no: str
    supplier_name: str
    doc_date: Optional[date]
    note: Optional[str]
    created_at: datetime
    items: List[POItemOut]
    class Config:
        from_attributes = True


# ===== 銷貨出庫（SO）=====
class SOItemIn(BaseModel):
    product_id: int
    qty: float = Field(ge=0)
    unit: str | None = None
    unit_price: float = 0
    price_unit: str | None = None
    note: Optional[str] = None
    mark: Optional[str] = None

class SOCreate(BaseModel):
    customer_name: str
    doc_date: Optional[date] = None
    note: Optional[str] = None
    items: List[SOItemIn]

class SOItemOut(SOItemIn):
    id: int
    class Config:
        from_attributes = True

class SOOut(BaseModel):
    id: int
    so_no: str
    customer_name: str
    doc_date: Optional[date]
    note: Optional[str]
    created_at: datetime
    items: List[SOItemOut]
    class Config:
        from_attributes = True


# ===== 單據明細（帶商品資訊 View）=====
class POItemView(BaseModel):
    id: int
    product_id: int
    product_sku: Optional[str] = None
    product_name: str
    product_spec: Optional[str] = None
    qty: int
    unit: str
    pieces_per_case: Optional[int] = None
    price_unit: Optional[str] = None
    unit_price: Optional[float] = None
    mark: Optional[str] = None
    note: Optional[str] = None

class POView(BaseModel):
    id: int
    po_no: str
    supplier_name: str
    doc_date: Optional[date]
    note: Optional[str]
    created_at: datetime
    items: List[POItemView]

class SOItemView(BaseModel):
    id: int
    product_id: int
    product_sku: Optional[str] = None
    product_name: str
    product_spec: Optional[str] = None
    qty: float
    unit: str
    unit_price: float
    price_unit: str
    pieces_per_case: Optional[int] = None
    mark: Optional[str] = None
    note: Optional[str] = None

class SOView(BaseModel):
    id: int
    so_no: str
    customer_name: str
    customer_address: Optional[str] = None
    customer_phone: Optional[str] = None
    doc_date: Optional[date]
    note: Optional[str]
    status: str
    created_at: datetime
    # 揀貨/出貨紀錄
    picked_at: Optional[datetime] = None
    picked_by_id: Optional[int] = None
    shipped_at: Optional[datetime] = None
    shipped_by_id: Optional[int] = None
    ship_note: Optional[str] = None
    logistics_no: Optional[str] = None
    items: List[SOItemView]

class SOPaged(BaseModel):
    rows: List["SOView"]
    total: int

class SOCommonItemRow(BaseModel):
    product_id: int
    sku: str | None = None
    name: str
    last_unit_price: float
    last_price_unit: str | None = None
    last_qty: float
    last_order_date: date | None
    freq: int


# ===== 銷售報表 =====
class SRProductCustomerRow(BaseModel):
    customer_name: str
    order_count: int
    total_qty: float
    total_amount: float
    last_unit_price: float
    last_price_unit: str
    last_order_date: Optional[date] = None

class SRProductRankRow(BaseModel):
    product_id: int
    sku: Optional[str] = None
    name: str
    order_count: int
    customer_count: int
    total_qty: float
    total_amount: float

class SRProductCustomersOut(BaseModel):
    product_id: int
    date_from: Optional[date] = None
    date_to: Optional[date] = None
    rows: List[SRProductCustomerRow]

class SRProductRankOut(BaseModel):
    date_from: Optional[date] = None
    date_to: Optional[date] = None
    top_n: int
    rows: List[SRProductRankRow]


# ===== 客戶 =====
class CustomerIn(BaseModel):
    name: str
    customer_code: Optional[str] = None  # 客戶代號
    short_name: Optional[str] = None  # 簡稱
    full_name: Optional[str] = None  # 長名稱
    tax_id: Optional[str] = None  # 統一編號
    contact: Optional[str] = None  # 聯絡窗口
    phone: Optional[str] = None  # 電話
    address: Optional[str] = None  # 送貨地址
    invoice_title: Optional[str] = None  # 發票抬頭
    sales_category: Optional[str] = None  # 銷貨類別
    filing_date: Optional[date] = None  # 建檔日期
    email: Optional[str] = None  # E-mail
    note: Optional[str] = None
    is_active: bool = True

class CustomerOut(CustomerIn):
    id: int
    created_at: datetime
    class Config:
        from_attributes = True


# ===== 生產回報 =====
class PRItemIn(BaseModel):
    product_id: int
    spec_text: Optional[str] = None
    qty: int = Field(ge=1)
    unit: str = "包"
    note: Optional[str] = None

class PRCreate(BaseModel):
    report_date: date
    note: Optional[str] = None
    items: List[PRItemIn]

class PRItemView(BaseModel):
    id: int
    product_id: int
    product_sku: Optional[str] = None
    product_name: str
    product_spec: Optional[str] = None
    spec_text: Optional[str] = None
    qty: int
    unit: str
    note: Optional[str] = None

class PRView(BaseModel):
    id: int
    pr_no: str
    report_date: date
    status: str
    note: Optional[str]
    reported_by_user_id: int
    approved_by_user_id: Optional[int]
    approved_at: Optional[datetime]
    created_at: datetime
    items: List[PRItemView]

class PRCloneIn(BaseModel):
    report_date: Optional[date] = None          # 不給就用今天
    qty_mode: str = "keep"                      # keep | zero
    note: Optional[str] = None                  # 可覆寫 note（可空）


# ===== 生產報表 =====
class PRSummaryRow(BaseModel):
    bucket: str                 # day/week/month/year 的 key
    key: str                    # employee:{id} / product:{id} / spec:{text}
    label: str                  # 顯示名稱
    total_qty: int

class PRExportQuery(BaseModel):
    from_date: date
    to_date: date
    status: str = "APPROVED"    # APPROVED / SUBMITTED / REJECTED / ALL
    group: str = "employee"     # employee / product / product_spec
    bucket: str = "day"         # day / week / month / year


# ===== 生產 KPI =====
class KPIBlock(BaseModel):
    title: str
    value: float | int
    unit: str = ""
    note: str | None = None

class KPIRankRow(BaseModel):
    key: str
    label: str
    total_qty: int

class ProductionKPIOut(BaseModel):
    range_from: date
    range_to: date
    totals: list[KPIBlock]
    employee_rank: list[KPIRankRow]
    product_rank: list[KPIRankRow]
    reject_reasons: list[KPIRankRow]


# ===== BOM =====
class BomItemIn(BaseModel):
    raw_product_id: int
    qty_per_fg_unit: float = Field(gt=0)  # 必須 > 0（允許小數）
    note: Optional[str] = None

class BomItemOut(BaseModel):
    id: int
    fg_product_id: int
    raw_product_id: int
    raw_product_name: Optional[str] = None
    raw_product_sku: Optional[str] = None
    qty_per_fg_unit: float
    note: Optional[str]
    is_active: bool
    created_at: datetime
    class Config:
        from_attributes = True

class BomUpsertIn(BaseModel):
    items: List[BomItemIn]  # 整包覆蓋 BOM

class FGKitBomItemIn(BaseModel):
    raw_product_id: int
    qty_per_fg_unit: float
    note: str | None = None

class FGKitCreateIn(BaseModel):
    sku: str | None = None
    name: str
    spec: str | None = None
    base_unit: str = "件"
    alt_unit: str = "包"
    alt_ratio: int
    safety_stock: float | int = 0
    bom_items: list[FGKitBomItemIn]

class FgKitCreateIn(BaseModel):
    """一鍵建立 FG + BOM"""
    sku: Optional[str] = None
    name: str
    spec: Optional[str] = None
    base_unit: str = "個"
    alt_unit: Optional[str] = None
    alt_ratio: Optional[int] = None
    safety_stock: int = 0
    bom_items: List[BomItemIn]  # BOM 項目列表

class FgKitCreateOut(BaseModel):
    product_id: int


# Forward references rebuild for Pydantic v2
SOPaged.model_rebuild()

