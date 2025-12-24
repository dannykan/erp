# MVP v2 架構瘦身 Smoke Test

## 概述
本測試文件用於驗證架構瘦身重構後的系統功能，確保：
1. 系統只保留 SalesOrder 作為唯一接單入口
2. 移除 Order/WorkOrder/Factory 分流相關功能
3. 庫存統一使用單一站點 WAREHOUSE
4. 生產回報 PR 維持：工人回報 → 主管核准 → 成品入庫（WAREHOUSE）+ BOM 扣料（WAREHOUSE）
5. 出貨流程維持：SO DRAFT -> PICKED -> SHIPPED，SHIPPED 時扣 WAREHOUSE 庫存

---

## 1. 資料庫遷移驗證

### 執行遷移
```bash
cd backend
alembic upgrade head
```

### 檢查項目
- [ ] Migration `f1a2b3c4d5e6_migrate_factory_to_warehouse_site` 執行成功
- [ ] 所有 `inventory_moves` 表中 `site='FACTORY'` 的記錄已更新為 `'WAREHOUSE'`
- [ ] 沒有遺留 `site='FACTORY'` 的記錄

### SQL 檢查命令
```sql
-- 檢查是否還有 FACTORY 記錄
SELECT COUNT(*) FROM inventory_moves WHERE site = 'FACTORY';
-- 應該返回 0

-- 檢查 WAREHOUSE 記錄
SELECT COUNT(*) FROM inventory_moves WHERE site = 'WAREHOUSE';
-- 應該有記錄（如果之前有 FACTORY 數據）

-- 檢查所有記錄的 site 值
SELECT DISTINCT site FROM inventory_moves;
-- 應該只有 WAREHOUSE 或 NULL（NULL 是舊數據，可接受）
```

---

## 2. 前端路由與菜單驗證

### 檢查項目
- [ ] 登入後預設跳轉到 `/sales-orders`（不再是 `/factory`）
- [ ] 菜單中**沒有**以下項目：
  - 工廠看板
  - 工單管理
  - 訂單管理
  - 倉庫庫存
  - 工廠庫存
- [ ] 菜單中**有**以下項目：
  - 商品管理
  - 客戶管理
  - 庫存查詢（單一）
  - 進貨入庫
  - 銷貨出庫
  - 銷貨單查詢
  - 銷售報表
  - 工廠端（生產回報相關）

### 路由測試
- [ ] 訪問 `/orders` 應返回 404 或重定向
- [ ] 訪問 `/work-orders` 應返回 404 或重定向
- [ ] 訪問 `/factory` 應返回 404 或重定向
- [ ] 訪問 `/warehouse/inventory` 應返回 404 或重定向
- [ ] 訪問 `/factory-inventory` 應返回 404 或重定向
- [ ] 訪問 `/inventory` 正常顯示（單一庫存頁面）

---

## 3. 庫存查詢統一使用 WAREHOUSE

### 測試步驟
1. 訪問 `/inventory` 頁面
2. 查看庫存列表
3. 手動調整庫存（新增一筆 ADJ 記錄）

### 預期結果
- [ ] 庫存查詢只顯示 WAREHOUSE 站點的庫存
- [ ] 調整庫存時自動使用 `site='WAREHOUSE'`
- [ ] 庫存流水顯示所有記錄（包括歷史 FACTORY 數據，但查詢時只計算 WAREHOUSE）

### 驗證 SQL
```sql
-- 檢查庫存查詢邏輯（應該只計算 WAREHOUSE）
SELECT 
    p.name,
    COALESCE(SUM(CASE WHEN im.site = 'WAREHOUSE' THEN im.qty_change ELSE 0 END), 0) as stock
FROM products p
LEFT JOIN inventory_moves im ON p.id = im.product_id
WHERE p.is_active = 1
GROUP BY p.id, p.name;
```

---

## 4. 生產回報核准流程（關鍵測試）

### 準備資料

1. **建立 RAW 商品：貼紙**
   - name: 貼紙
   - product_type: RAW
   - base_unit: 張
   - unit: 張

2. **建立 FG 商品：筷子包裝 A**
   - name: 筷子包裝 A
   - product_type: FG
   - base_unit: 件
   - alt_unit: 包
   - alt_ratio: 30
   - spec: 80雙/包

3. **建立 BOM**
   - FG: 筷子包裝 A
   - RAW: 貼紙
   - qty_per_fg_unit: 0.5（每件 0.5 張）

### 測試步驟

1. **工人回報生產**
   - 建立 Production Report
   - FG: 筷子包裝 A
   - qty: 3 件
   - status: SUBMITTED

2. **廠長核准**
   - 呼叫 `POST /production-reports/{pr_id}/approve`

### 預期結果

✅ **WAREHOUSE 庫存**
- FG A 庫存 +3（入庫到 WAREHOUSE）
- 貼紙 庫存 -1.5（扣料在 WAREHOUSE，允許負庫存）

✅ **ProductionReportAction**
- 有 `APPROVE` action
- 有 `APPROVE_BOM` action
- comment 包含：`FG_IN:1項/3件, RAW_OUT:1項/1.50`

✅ **inventory_moves 記錄**
- `ref_type=PR_APPROVE`, `ref_no={report_id}`, `qty_change=0` 的 marker（site=WAREHOUSE）
- `ref_type=PR`, `ref_no={pr_no}`, `qty_change=+3` 的 FG_IN（site=WAREHOUSE）
- `ref_type=PR`, `ref_no={pr_no}`, `qty_change=-1.5` 的 RAW_OUT（site=WAREHOUSE，**不再是 FACTORY**）

### 驗證 SQL
```sql
-- 檢查庫存（應該都在 WAREHOUSE）
SELECT 
    p.name,
    p.product_type,
    COALESCE(SUM(CASE WHEN im.site = 'WAREHOUSE' THEN im.qty_change ELSE 0 END), 0) as warehouse_stock
FROM products p
LEFT JOIN inventory_moves im ON p.id = im.product_id
WHERE p.name IN ('筷子包裝 A', '貼紙')
GROUP BY p.id, p.name, p.product_type;

-- 檢查 inventory_moves（應該都是 WAREHOUSE）
SELECT ref_type, ref_no, qty_change, site, stage, note 
FROM inventory_moves 
WHERE ref_type IN ('PR', 'PR_APPROVE') AND ref_no LIKE '%{pr_no}%'
ORDER BY created_at;
-- 所有記錄的 site 應該都是 'WAREHOUSE'
```

---

## 5. 銷貨單流程測試（關鍵測試）

### 準備資料
- 確保有足夠的 FG 庫存在 WAREHOUSE（例如：筷子包裝 A 庫存 >= 5）

### 測試步驟

1. **建立銷貨單**
   - 建立 SalesOrder（2 個品項）
   - status: DRAFT
   - 不扣庫存

2. **揀貨**
   - 呼叫 `POST /sales-orders/{so_id}/pick`
   - status: PICKED
   - 仍不扣庫存

3. **出貨**
   - 呼叫 `POST /sales-orders/{so_id}/ship`
   - status: SHIPPED
   - **此時扣 WAREHOUSE 庫存**

### 預期結果

✅ **庫存扣減**
- 出貨時扣 WAREHOUSE 庫存
- 庫存正確扣減（不會扣兩次，unique index 保護）
- 如果庫存不足，返回 400 錯誤

✅ **inventory_moves 記錄**
- `ref_type=SO`, `ref_no={so_id}`, `stage=SHIP`, `site=WAREHOUSE`
- `qty_change` 為負數（出庫）

✅ **重複出貨防呆**
- 再次呼叫 ship 應被 unique index 擋下（idempotency）
- 不會重複扣庫存

### 驗證 SQL
```sql
-- 檢查出貨記錄
SELECT ref_type, ref_no, qty_change, site, stage, product_id
FROM inventory_moves 
WHERE ref_type = 'SO' AND ref_no = '{so_id}' AND stage = 'SHIP';
-- site 應該都是 'WAREHOUSE'

-- 檢查庫存（應該已扣減）
SELECT 
    p.name,
    COALESCE(SUM(CASE WHEN im.site = 'WAREHOUSE' THEN im.qty_change ELSE 0 END), 0) as stock
FROM products p
LEFT JOIN inventory_moves im ON p.id = im.product_id
WHERE p.id IN (SELECT product_id FROM sales_order_items WHERE sales_order_id = {so_id})
GROUP BY p.id, p.name;
```

---

## 6. 負庫存顯示

### 測試步驟
1. 讓 RAW 扣到負數（例如：庫存 0，扣 1.5）
2. 查看 Inventory 頁面

### 預期結果
- [ ] 負庫存以**紅色粗體**顯示
- [ ] 數值正確（例如：-1.5）
- [ ] 庫存查詢正常（不會因為負數而報錯）

---

## 7. 銷貨單查詢與匯出

### 測試步驟
1. 訪問 `/sales-orders/list` 頁面
2. 測試 Tabs：DRAFT / PICKED / SHIPPED
3. 測試匯出 Excel

### 預期結果
- [ ] Tabs 切換正常
- [ ] 篩選功能正常（日期、客戶、狀態、品項）
- [ ] 匯出 Excel 功能正常
- [ ] Excel 內容正確（包含所有欄位）

---

## 8. PDF 功能測試

### 測試步驟
1. 建立銷貨單並出貨
2. 下載以下 PDF：
   - 銷貨單 PDF：`GET /sales-orders/{so_id}/print`
   - 揀貨單 PDF：`GET /sales-orders/{so_id}/picklist.pdf`
   - 出貨單 PDF：`GET /sales-orders/{so_id}/shipping.pdf`

### 預期結果
- [ ] 所有 PDF 都能正常下載
- [ ] PDF 內容正確（品項、數量、客戶等）
- [ ] 出貨後自動下載出貨單 PDF 可用（如果前端有實作）

---

## 9. 銷售報表與 KPI 匯出

### 測試步驟
1. 訪問 `/sales-reports/products-rank`
2. 訪問 `/sales-reports/product-customers`
3. 訪問 `/production/kpi`
4. 測試匯出 Excel 功能

### 預期結果
- [ ] 所有報表頁面正常顯示
- [ ] 匯出 Excel 功能正常
- [ ] Excel 內容正確

---

## 10. 後端 API 驗證

### 檢查項目
- [ ] `GET /orders` 應返回 404（路由已移除）
- [ ] `GET /work-orders` 應返回 404（路由已移除）
- [ ] `GET /inventory` 預設使用 WAREHOUSE（不傳 site 參數時）
- [ ] `POST /production-reports/{pr_id}/approve` 扣料使用 WAREHOUSE
- [ ] `POST /sales-orders/{so_id}/ship` 扣庫存使用 WAREHOUSE

---

## 完成標準

✅ 所有測試通過
✅ 沒有 lint 錯誤
✅ 資料庫遷移成功
✅ 庫存統一使用 WAREHOUSE
✅ 生產回報扣料在 WAREHOUSE
✅ 銷貨單出貨扣庫存正常
✅ 負庫存顯示正確（紅色粗體）
✅ 所有報表與匯出功能正常
✅ 前端路由與菜單正確移除不需要的功能

**MVP v2 架構瘦身完成！系統已簡化為單一站點（WAREHOUSE）運作。**

---

## 回滾方案

如果需要回滾到 v1：

1. **資料庫回滾**（注意：無法自動恢復 FACTORY 數據）
   ```bash
   cd backend
   alembic downgrade -1
   ```
   ⚠️ 警告：回滾後，原本 FACTORY 的數據已合併到 WAREHOUSE，無法自動分離。

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

---

## 改動檔案清單

### 資料庫遷移
- `backend/alembic/versions/f1a2b3c4d5e6_migrate_factory_to_warehouse_site.py`

### 後端改動
- `backend/app/main.py` - 移除 Order/WorkOrder routes
- `backend/app/routes_production_reports.py` - 扣料改為 WAREHOUSE
- `backend/app/routes_inventory.py` - 預設使用 WAREHOUSE

### 前端改動
- `frontend/src/app/App.tsx` - 移除 Order/WorkOrder/Factory 路由
- `frontend/src/app/layout.tsx` - 移除相關菜單項
- `frontend/src/pages/Login.tsx` - 更新預設跳轉路徑
- `frontend/src/pages/Inventory.tsx` - 調整庫存使用 WAREHOUSE

### 測試文件
- `SMOKE_TEST_v2.md` - 本文件

