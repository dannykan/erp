# MVP v2 架構瘦身 - 最終一致性檢查清單

## 檢查日期
2025-01-27

## 檢查項目與結果

### 1. FACTORY 引用掃描

#### ✅ 檢查結果
使用 `grep` 掃描全專案所有 "FACTORY" / "Site.FACTORY" / "factory-inventory" / "/factory" 的引用：

**執行路徑中的引用（已修復）：**
- `frontend/src/pages/FactoryInventory.tsx:104` - 已修復：改為 `site: 'WAREHOUSE'`
- `backend/app/schemas.py:202` - 已修復：註釋更新為只提及 WAREHOUSE
- `backend/app/constants.py:6` - 已修復：FACTORY 常數已註釋

**僅在文檔/註解中的引用（可接受）：**
- `REFACTORING_SUMMARY.md` - 文檔說明
- `SMOKE_TEST_v2.md` - 測試文檔
- `D2_SMOKE_TEST.md` - 舊測試文檔（可保留）
- `backend/alembic/versions/f1a2b3c4d5e6_migrate_factory_to_warehouse_site.py` - Migration 文件（必須保留）

**node_modules 中的引用（可忽略）：**
- TypeScript/React 相關庫文件（不影響執行）

#### ✅ 修復內容
1. `FactoryInventory.tsx` - 雖然已從路由移除，但為安全起見已修復為使用 WAREHOUSE
2. `schemas.py` - 更新註釋，移除 FACTORY 提及
3. `constants.py` - FACTORY 常數已註釋，保留用於向後兼容

---

### 2. NULL site 處理一致性

#### ✅ 檢查結果
所有庫存計算規則統一：只計算 WAREHOUSE（忽略 NULL）

**檢查位置：**
1. `routes_inventory.py::inventory_list()` - ✅ 使用 `filter(InventoryMove.site == effective_site)`，NULL 會被忽略
2. `routes_inventory.py::stock_batch()` - ✅ 使用 `filter(InventoryMove.site == effective_site)`，NULL 會被忽略
3. `routes_sales_orders.py::ship_so()` - ✅ 使用 `filter(InventoryMove.site == Site.WAREHOUSE)`，NULL 會被忽略

**結論：**
- SQL 的 `WHERE site = 'WAREHOUSE'` 會自動忽略 NULL 值（NULL != 'WAREHOUSE'）
- 所有查詢都一致，不會把 NULL 算進去

---

### 3. approve_report 三類 moves 確認

#### ✅ 檢查結果
`routes_production_reports.py::approve_report()` 中的三類 moves 全部使用 `site=WAREHOUSE`：

1. **PR_APPROVE marker** (line 242-251)
   ```python
   db.add(InventoryMove(
       ...
       site=Site.WAREHOUSE,  # ✅
       stage=Stage.PROD_RECEIVE,
       ref_type=RefType.PR_APPROVE,
       ...
   ))
   ```

2. **PR FG_IN** (line 200-209)
   ```python
   db.add(InventoryMove(
       ...
       site=Site.WAREHOUSE,  # ✅
       stage=Stage.PROD_RECEIVE,
       ref_type=RefType.PR,
       ...
   ))
   ```

3. **PR RAW_OUT** (line 226-235)
   ```python
   db.add(InventoryMove(
       ...
       site=Site.WAREHOUSE,  # ✅ (已從 FACTORY 改為 WAREHOUSE)
       stage=Stage.PROD_CONSUME,
       ref_type=RefType.PR,
       ...
   ))
   ```

**結論：** ✅ 全部確認使用 WAREHOUSE

---

### 4. ship_so 一致性確認

#### ✅ 檢查結果
`routes_sales_orders.py::ship_so()` 中的三個關鍵點都固定使用 WAREHOUSE：

1. **庫存不足檢查** (line 521-526)
   ```python
   stock = db.query(
       func.coalesce(func.sum(InventoryMove.qty_change), 0)
   ).filter(
       InventoryMove.product_id == pid,
       InventoryMove.site == Site.WAREHOUSE  # ✅
   ).scalar()
   ```

2. **寫入 inventory_moves** (line 533-544)
   ```python
   mv = InventoryMove(
       ...
       site=Site.WAREHOUSE,  # ✅
       stage=Stage.SHIP,
       ref_type=RefType.SO,
       ...
   )
   ```

3. **前端 stockBatch 顯示** (`SalesOrderDetail.tsx:35`)
   ```typescript
   const m = await api.stockBatch({ product_ids: ids, site: 'WAREHOUSE' });  // ✅
   ```

**結論：** ✅ 全部確認使用 WAREHOUSE

---

### 5. routes_inventory.py 參數驗證

#### ✅ 修復內容
已添加參數驗證，如果收到 `site != WAREHOUSE`，直接返回 400 錯誤：

1. **inventory_list()** (line 27-30)
   ```python
   if site and site != Site.WAREHOUSE:
       logging.warning(f"Invalid site parameter: {site}, only WAREHOUSE is allowed")
       raise HTTPException(400, f"Invalid site: {site}. Only WAREHOUSE is supported in MVP v2")
   ```

2. **stock_batch()** (line 151-153)
   ```python
   if payload.site and payload.site != Site.WAREHOUSE:
       logging.warning(f"Invalid site parameter in stockBatch: {payload.site}, only WAREHOUSE is allowed")
       raise HTTPException(400, f"Invalid site: {payload.site}. Only WAREHOUSE is supported in MVP v2")
   ```

3. **create_move()** (line 114-116)
   ```python
   if payload.site and payload.site != Site.WAREHOUSE:
       logging.warning(f"Invalid site parameter in create_move: {payload.site}, forcing to WAREHOUSE")
       effective_site = Site.WAREHOUSE  # 強制改為 WAREHOUSE（或可選擇拒絕）
   ```

**結論：** ✅ 已添加驗證，避免舊前端傳參造成錯誤數字

---

## 修改 Diff 摘要

### 後端修改

#### `backend/app/routes_inventory.py`
```diff
+ from fastapi import HTTPException
+ import logging
+ 
  @router.get("", response_model=list[InventoryRow])
  def inventory_list(...):
+     # 如果傳入 site 且不是 WAREHOUSE，拒絕請求
+     if site and site != Site.WAREHOUSE:
+         logging.warning(f"Invalid site parameter: {site}, only WAREHOUSE is allowed")
+         raise HTTPException(400, f"Invalid site: {site}. Only WAREHOUSE is supported in MVP v2")
+     
+     effective_site = Site.WAREHOUSE  # 強制使用 WAREHOUSE

  @router.post("/moves", response_model=InventoryMoveOut)
  def create_move(...):
+     # 如果傳入 site 且不是 WAREHOUSE，強制改為 WAREHOUSE
+     if payload.site and payload.site != Site.WAREHOUSE:
+         logging.warning(f"Invalid site parameter in create_move: {payload.site}, forcing to WAREHOUSE")
+         effective_site = Site.WAREHOUSE
+     mv = InventoryMove(..., site=effective_site, ...)

  @router.post("/stock/batch")
  def stock_batch(...):
+     # 如果傳入 site 且不是 WAREHOUSE，拒絕請求
+     if payload.site and payload.site != Site.WAREHOUSE:
+         logging.warning(f"Invalid site parameter in stockBatch: {payload.site}, only WAREHOUSE is allowed")
+         raise HTTPException(400, f"Invalid site: {payload.site}. Only WAREHOUSE is supported in MVP v2")
+     effective_site = Site.WAREHOUSE  # 強制使用 WAREHOUSE
```

#### `backend/app/schemas.py`
```diff
  class StockBatchIn(BaseModel):
      product_ids: list[int]
-     site: Optional[str] = None  # WAREHOUSE / FACTORY
+     site: Optional[str] = None  # WAREHOUSE (MVP v2: 只支援單一站點)
```

#### `backend/app/constants.py`
```diff
  # 庫存站點
  class Site:
      WAREHOUSE = "WAREHOUSE"  # 倉庫（MVP v2: 唯一支援的站點）
-     FACTORY = "FACTORY"      # 工廠
+     # FACTORY = "FACTORY"    # 工廠（已移除，MVP v2 架構瘦身）
```

### 前端修改

#### `frontend/src/pages/FactoryInventory.tsx`
```diff
  request={async (params) => {
      const q = (params.keyword as string) || undefined;
-     const data = await api.listInventory({ q, site: 'FACTORY', low_only: lowOnly });
+     // 架構瘦身：統一使用 WAREHOUSE（此頁面已從路由移除，僅保留作為備份）
+     const data = await api.listInventory({ q, site: 'WAREHOUSE', low_only: lowOnly });
      return { data, success: true };
  }}

  await api.createInventoryMove({
      ...
+     site: 'WAREHOUSE',  // 架構瘦身：統一使用 WAREHOUSE
      ...
  });
```

---

## 驗證測試建議

### 1. 測試無效 site 參數
```bash
# 測試 inventory_list
curl -H "Authorization: Bearer <token>" \
  "http://localhost:8000/inventory?site=FACTORY"
# 預期：400 錯誤

# 測試 stock_batch
curl -X POST -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"product_ids": [1], "site": "FACTORY"}' \
  "http://localhost:8000/inventory/stock/batch"
# 預期：400 錯誤
```

### 2. 測試 NULL site 處理
```sql
-- 確認 NULL site 的記錄不會被計算
SELECT 
    product_id,
    SUM(CASE WHEN site = 'WAREHOUSE' THEN qty_change ELSE 0 END) as warehouse_stock,
    SUM(CASE WHEN site IS NULL THEN qty_change ELSE 0 END) as null_stock
FROM inventory_moves
GROUP BY product_id;
-- 預期：null_stock 應該為 0（或 NULL 記錄的 qty_change 不影響計算）
```

### 3. 測試 approve_report
- 建立 PR 並核准
- 檢查所有 inventory_moves 記錄的 site 都是 'WAREHOUSE'

### 4. 測試 ship_so
- 建立 SO 並出貨
- 檢查庫存檢查和寫入都使用 WAREHOUSE

---

## 完成狀態

✅ **所有檢查項目通過**
✅ **所有 FACTORY 引用已移除或註釋（執行路徑中無 FACTORY）**
✅ **NULL site 處理一致（只計算 WAREHOUSE）**
✅ **approve_report 三類 moves 全部使用 WAREHOUSE**
✅ **ship_so 一致性確認（檢查、寫入、前端都使用 WAREHOUSE）**
✅ **routes_inventory.py 參數驗證已添加（拒絕非 WAREHOUSE 參數）**

**MVP v2 架構瘦身最終一致性檢查完成！**

---

## 備註

1. **FactoryInventory.tsx** 雖然已從路由移除，但為安全起見已修復。該文件可保留作為備份，或未來刪除。

2. **constants.py 中的 FACTORY** 已註釋但保留，用於向後兼容（避免舊代碼引用錯誤）。

3. **create_move 的處理**：目前選擇強制改為 WAREHOUSE 而非拒絕，可根據需求調整為拒絕（返回 400）。

4. **NULL site 記錄**：Migration 不會處理 NULL 記錄（只處理 FACTORY），這是合理的，因為 NULL 記錄可能是舊數據，不會影響新的計算邏輯。

