# MVP v2 架構瘦身 - 最終補丁清單

## 補丁日期
2025-01-27

## 補丁內容

### 1. 新增 Migration：補全 NULL site 為 WAREHOUSE

#### 檔案
`backend/alembic/versions/g2h3i4j5k6l7_migrate_null_site_to_warehouse.py`

#### 內容
```python
def upgrade() -> None:
    """Upgrade schema: 将所有 NULL site 的库存记录补成 WAREHOUSE."""
    conn = op.get_bind()
    conn.execute(
        sa.text("UPDATE inventory_moves SET site = 'WAREHOUSE' WHERE site IS NULL")
    )
```

#### 說明
- 將所有 `inventory_moves.site IS NULL` 的舊資料補成 `'WAREHOUSE'`
- 這些是 site 字段添加之前創建的歷史記錄
- 確保所有記錄都有明確的 site 值，統一使用 WAREHOUSE

#### 執行
```bash
cd backend
alembic upgrade head
```

---

### 2. 統一 create_move() 策略：直接返回 400

#### 檔案
`backend/app/routes_inventory.py`

#### 修改前
```python
if payload.site and payload.site != Site.WAREHOUSE:
    logging.warning(f"Invalid site parameter in create_move: {payload.site}, forcing to WAREHOUSE")
    effective_site = Site.WAREHOUSE
    # 或者可以選擇拒絕：raise HTTPException(400, ...)
```

#### 修改後
```python
# 如果傳入 site 且不是 WAREHOUSE，直接拒絕請求（統一策略：與 inventory_list 和 stock_batch 一致）
if payload.site and payload.site != Site.WAREHOUSE:
    logging.warning(f"Invalid site parameter in create_move: {payload.site}, only WAREHOUSE is allowed")
    raise HTTPException(
        status_code=400,
        detail=f"Invalid site: {payload.site}. Only WAREHOUSE is supported in MVP v2. Please omit the site parameter or use 'WAREHOUSE'."
    )

effective_site = Site.WAREHOUSE  # 強制使用 WAREHOUSE（即使 payload.site 為 None）
```

#### 說明
- **統一策略**：與 `inventory_list()` 和 `stock_batch()` 保持一致，直接返回 400 錯誤
- **明確錯誤訊息**：提示用戶只能使用 WAREHOUSE 或省略 site 參數
- **日誌記錄**：記錄 warning log 以便追蹤

---

### 3. 修復 WarehouseInventory.tsx

#### 檔案
`frontend/src/pages/WarehouseInventory.tsx`

#### 修改
```diff
await api.createInventoryMove({
    product_id: selected.product_id,
    move_type: v.move_type,
    qty_change: Number(v.qty_change),
+   site: 'WAREHOUSE',  // 架構瘦身：統一使用 WAREHOUSE
    ref_type: v.ref_type,
    ref_no: v.ref_no,
    note: v.note,
});
```

#### 說明
- 確保所有 `createInventoryMove` 調用都明確傳入 `site: 'WAREHOUSE'`
- 與其他頁面（Inventory.tsx, FactoryInventory.tsx）保持一致

---

## site 參數使用檢查結果

### ✅ 前端所有 site 參數使用情況

#### `listInventory` 調用
1. `WarehouseInventory.tsx:104` - ✅ `site: 'WAREHOUSE'`
2. `FactoryInventory.tsx:105` - ✅ `site: 'WAREHOUSE'`
3. `Inventory.tsx` - ✅ 不傳 site（後端預設 WAREHOUSE）
4. `NewSalesOrder.tsx:54` - ✅ 不傳 site（後端預設 WAREHOUSE）

#### `stockBatch` 調用
1. `SalesOrderDetail.tsx:35` - ✅ `site: 'WAREHOUSE'`

#### `createInventoryMove` 調用
1. `WarehouseInventory.tsx:151` - ✅ `site: 'WAREHOUSE'`
2. `FactoryInventory.tsx:152` - ✅ `site: 'WAREHOUSE'`
3. `Inventory.tsx:151` - ✅ `site: 'WAREHOUSE'`

### ✅ 結論
- **所有前端調用都正確使用 WAREHOUSE 或不傳 site（後端預設 WAREHOUSE）**
- **沒有發現傳入非 WAREHOUSE 值的情況**

---

## 後端驗證策略統一

### 三個接口的驗證策略（已統一）

1. **`GET /inventory`** (`inventory_list`)
   - 如果 `site != WAREHOUSE` → 返回 400

2. **`POST /inventory/stock/batch`** (`stock_batch`)
   - 如果 `site != WAREHOUSE` → 返回 400

3. **`POST /inventory/moves`** (`create_move`)
   - 如果 `site != WAREHOUSE` → 返回 400（**已統一**）

### 錯誤訊息格式
```python
raise HTTPException(
    status_code=400,
    detail=f"Invalid site: {site}. Only WAREHOUSE is supported in MVP v2. Please omit the site parameter or use 'WAREHOUSE'."
)
```

---

## 測試建議

### 1. 測試 Migration
```bash
cd backend
alembic upgrade head

# 驗證 NULL site 已補全
sqlite3 app.db "SELECT COUNT(*) FROM inventory_moves WHERE site IS NULL;"
# 預期：0
```

### 2. 測試 create_move 驗證
```bash
# 測試傳入 FACTORY
curl -X POST -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"product_id": 1, "move_type": "ADJ", "qty_change": 1, "site": "FACTORY"}' \
  "http://localhost:8000/inventory/moves"
# 預期：400 錯誤，訊息包含 "Invalid site: FACTORY"

# 測試不傳 site（應該成功）
curl -X POST -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"product_id": 1, "move_type": "ADJ", "qty_change": 1}' \
  "http://localhost:8000/inventory/moves"
# 預期：成功，site 自動設為 WAREHOUSE
```

### 3. 測試前端調用
- 在 Inventory 頁面手動調整庫存 → 應該成功
- 在 WarehouseInventory 頁面手動調整庫存 → 應該成功
- 在 FactoryInventory 頁面手動調整庫存 → 應該成功（雖然路由已移除）

---

## 完成狀態

✅ **Migration 已建立**：補全 NULL site 為 WAREHOUSE
✅ **create_move() 策略已統一**：直接返回 400（與其他接口一致）
✅ **WarehouseInventory.tsx 已修復**：明確傳入 site: 'WAREHOUSE'
✅ **所有 site 參數使用檢查通過**：沒有發現傳入非 WAREHOUSE 值的情況
✅ **後端驗證策略統一**：三個接口都使用相同的驗證邏輯

**最終補丁完成！**

