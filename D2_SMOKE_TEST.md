# D2 上線確認清單

## 1. DB Migration 安全性

### 執行遷移
```bash
cd backend
alembic upgrade head
```

### 檢查項目
- [ ] `bom_items` 表存在
- [ ] `idx_bom_unique` 唯一索引存在
- [ ] `inventory_moves.qty_change` 類型為 REAL/NUMERIC
- [ ] 測試小數：手動 insert 或 UI 寫入 `qty_change = -0.5`，確認能存、能查、能加總

### SQL 檢查命令
```sql
-- 檢查表結構
.schema bom_items
.schema inventory_moves

-- 檢查索引
SELECT name FROM sqlite_master WHERE type='index' AND name='idx_bom_unique';

-- 測試小數
INSERT INTO inventory_moves (product_id, move_type, qty_change, site, created_at)
VALUES (1, 'ADJ', -0.5, 'FACTORY', datetime('now'));

SELECT product_id, SUM(qty_change) FROM inventory_moves WHERE product_id = 1 GROUP BY product_id;
```

---

## 2. 核准流程 Smoke Test（最關鍵）

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
- FG A 庫存 +3

✅ **FACTORY 庫存**
- 貼紙 庫存 -1.5（精準小數，不是 -1 或 -2）

✅ **ProductionReportAction**
- 有 `APPROVE` action
- 有 `APPROVE_BOM` action
- comment 包含：`FG_IN:1項/3件, RAW_OUT:1項/1.50`

✅ **inventory_moves 記錄**
- `ref_type=PR_APPROVE`, `ref_no={report_id}`, `qty_change=0` 的 marker
- `ref_type=PR`, `ref_no={pr_no}`, `qty_change=+3` 的 FG_IN
- `ref_type=PR`, `ref_no={pr_no}`, `qty_change=-1.5` 的 RAW_OUT

### 驗證 SQL
```sql
-- 檢查庫存
SELECT 
    p.name,
    p.product_type,
    COALESCE(SUM(CASE WHEN im.site = 'WAREHOUSE' THEN im.qty_change ELSE 0 END), 0) as warehouse_stock,
    COALESCE(SUM(CASE WHEN im.site = 'FACTORY' THEN im.qty_change ELSE 0 END), 0) as factory_stock
FROM products p
LEFT JOIN inventory_moves im ON p.id = im.product_id
WHERE p.name IN ('筷子包裝 A', '貼紙')
GROUP BY p.id, p.name, p.product_type;

-- 檢查 actions
SELECT action, comment FROM production_report_actions 
WHERE report_id = {report_id} ORDER BY created_at;

-- 檢查 inventory_moves
SELECT ref_type, ref_no, qty_change, site, stage, note 
FROM inventory_moves 
WHERE ref_type IN ('PR', 'PR_APPROVE') AND ref_no LIKE '%{pr_no}%'
ORDER BY created_at;
```

---

## 3. 重複核准防呆

### 測試步驟
1. 對同一張 report 再按一次核准
2. 預期：回傳 400 錯誤，訊息包含 "already approved"

### 驗證
- [ ] 第二次核准被擋下
- [ ] 不會新增第二次 FG_IN/RAW_OUT
- [ ] inventory_moves 中只有一組記錄

---

## 4. BOM 缺失防呆

### 測試步驟
1. 建立一個 FG 商品（沒有 BOM）
2. 建立 Production Report（使用該 FG）
3. 嘗試核准
4. 預期：回傳 400 錯誤，訊息包含 "has no BOM items"

### 驗證
- [ ] 報錯訊息明確
- [ ] **Transaction 原子性**：檢查 DB，確認沒有任何 inventory_move 被寫入
- [ ] ProductionReport status 仍為 SUBMITTED（未變為 APPROVED）

### 驗證 SQL
```sql
-- 確認沒有寫入任何 inventory_move
SELECT COUNT(*) FROM inventory_moves 
WHERE ref_type = 'PR' AND ref_no = '{pr_no}';

-- 確認 report status 未變
SELECT status FROM production_reports WHERE id = {report_id};
```

---

## 5. 負庫存顯示

### 測試步驟
1. 讓 RAW 扣到負數（例如：庫存 0，扣 1.5）
2. 查看 Inventory/FactoryInventory 頁面

### 驗證
- [ ] 負庫存以**紅色粗體**顯示
- [ ] 數值正確（例如：-1.5）

---

## 6. Idempotency 檢查確認

### 檢查條件
確認 idempotency 檢查使用三重條件：
- [ ] `ref_type == PR_APPROVE`
- [ ] `ref_no == report_id`（字串格式）
- [ ] `stage == PROD_RECEIVE`

### 程式碼位置
`backend/app/routes_production_reports.py` line 156-160

---

## 完成標準

✅ 所有測試通過
✅ 沒有 lint 錯誤
✅ 資料庫結構正確
✅ Transaction 原子性確認
✅ 負庫存顯示正確

**D2 完成！可以上線跑日常。**

