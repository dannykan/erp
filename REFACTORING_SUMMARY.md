# MVP v2 架構瘦身重構總結

## 概述
本次重構目標是將系統簡化為單一站點（WAREHOUSE）運作，移除 Order/WorkOrder/Factory 分流相關功能，只保留 SalesOrder 作為唯一接單入口。

## 改動檔案清單

### 1. 資料庫遷移
- **新增**: `backend/alembic/versions/f1a2b3c4d5e6_migrate_factory_to_warehouse_site.py`
  - 將所有 `inventory_moves` 表中 `site='FACTORY'` 的記錄更新為 `'WAREHOUSE'`
  - 執行命令：`cd backend && alembic upgrade head`

### 2. 後端改動

#### `backend/app/main.py`
- 移除 `routes_orders` 和 `routes_work_orders` 的 import 和註冊
- 註釋掉相關 router 的 include

#### `backend/app/routes_production_reports.py`
- 修改 `approve_report` 函數：
  - 將 RAW 扣料的 `site` 從 `Site.FACTORY` 改為 `Site.WAREHOUSE`
  - 現在 FG 入庫和 RAW 扣料都在 WAREHOUSE 進行

#### `backend/app/routes_inventory.py`
- 修改 `inventory_list` 函數：
  - 預設使用 `Site.WAREHOUSE`（如果沒有傳入 site 參數）
  - 統一庫存查詢邏輯
- 修改 `stock_batch` 函數：
  - 預設使用 `Site.WAREHOUSE`

### 3. 前端改動

#### `frontend/src/app/App.tsx`
- 移除 Order/WorkOrder/Factory 相關頁面的 import（註釋掉）
- 移除以下路由：
  - `/orders`
  - `/orders/new`
  - `/work-orders`
  - `/work-orders/:id`
  - `/factory`
  - `/warehouse/inventory`
  - `/factory-inventory`
- 更新預設路由：從 `/factory` 改為 `/sales-orders`

#### `frontend/src/app/layout.tsx`
- 移除以下菜單項：
  - 工廠看板
  - 工單管理
  - 訂單管理
  - 倉庫庫存
  - 工廠庫存

#### `frontend/src/pages/Login.tsx`
- 更新登入後預設跳轉：從 `/factory` 改為 `/sales-orders`

#### `frontend/src/pages/Inventory.tsx`
- 修改調整庫存功能：自動使用 `site='WAREHOUSE'`

### 4. 測試文件
- **新增**: `SMOKE_TEST_v2.md` - 完整的測試驗收清單

## 功能變更

### 保留的功能
✅ SalesOrder 完整流程（建立 → 揀貨 → 出貨）
✅ 生產回報流程（工人回報 → 主管核准 → 成品入庫 + BOM 扣料）
✅ 庫存查詢（單一站點 WAREHOUSE）
✅ 銷貨單查詢/匯出 Excel
✅ 銷售報表（品項排行、品項→客戶）
✅ KPI 匯出
✅ PDF 功能（揀貨/出貨/銷貨單）

### 移除的功能
❌ 訂單管理（Order）
❌ 工單管理（WorkOrder）
❌ 工廠看板（FactoryBoard）
❌ 工廠庫存/倉庫庫存分流（統一為單一庫存頁面）

## 庫存站點統一規則

### 統一使用 WAREHOUSE
- 所有庫存查詢預設使用 `Site.WAREHOUSE`
- 生產回報核准：
  - FG 入庫：`site=WAREHOUSE`
  - RAW 扣料：`site=WAREHOUSE`（**從 FACTORY 改為 WAREHOUSE**）
- 銷貨單出貨：扣 `site=WAREHOUSE` 庫存
- 進貨入庫：入 `site=WAREHOUSE` 庫存
- 手動調整庫存：使用 `site=WAREHOUSE`

### 允許負庫存
- RAW 扣料允許負庫存（顯示紅色粗體）
- 出貨時庫存不足會返回 400 錯誤

## 資料庫遷移注意事項

### 執行遷移
```bash
cd backend
alembic upgrade head
```

### 回滾警告
⚠️ **重要**：回滾 migration 時，無法自動恢復 FACTORY 數據，因為數據已合併到 WAREHOUSE。如果需要回滾，建議：
1. 在執行 migration 前備份資料庫
2. 回滾時從備份恢復

## 驗收標準

請參考 `SMOKE_TEST_v2.md` 進行完整測試，重點驗證：
1. ✅ 資料庫遷移成功
2. ✅ 前端路由與菜單正確移除
3. ✅ 庫存查詢統一使用 WAREHOUSE
4. ✅ 生產回報扣料在 WAREHOUSE
5. ✅ 銷貨單出貨扣庫存正常
6. ✅ 負庫存顯示正確
7. ✅ 所有報表與匯出功能正常

## 如何回滾

如果需要回滾到 v1：

1. **資料庫回滾**（需手動恢復 FACTORY 數據）
   ```bash
   cd backend
   alembic downgrade -1
   ```

2. **代碼回滾**
   ```bash
   git revert <commit-hash>
   ```

3. **恢復前端路由**
   - 取消註釋 `App.tsx` 中的 Order/WorkOrder/Factory 路由
   - 取消註釋 `layout.tsx` 中的相關菜單項
   - 恢復 `Login.tsx` 的跳轉路徑

4. **恢復後端路由**
   - 取消註釋 `main.py` 中的 orders_router 和 wo_router

## 注意事項

1. **最小破壞原則**：本次重構採用 migration + 小幅改動，不做大重寫
2. **資料保留**：所有歷史數據都保留，只是統一使用 WAREHOUSE 站點
3. **向後兼容**：舊的 FACTORY 數據會自動遷移到 WAREHOUSE
4. **頁面文件**：`FactoryBoard.tsx`、`FactoryInventory.tsx` 等文件仍然存在，但已從路由中移除，不會被訪問

## 完成狀態

✅ 所有改動已完成
✅ 沒有 lint 錯誤
✅ 測試文件已建立
✅ 回滾方案已說明

**MVP v2 架構瘦身重構完成！**

