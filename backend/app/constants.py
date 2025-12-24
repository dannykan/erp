"""系統常數定義"""

# 庫存站點
class Site:
    WAREHOUSE = "WAREHOUSE"  # 倉庫（MVP v2: 唯一支援的站點）
    # FACTORY = "FACTORY"    # 工廠（已移除，MVP v2 架構瘦身）

# 生產階段
class Stage:
    PROD_RECEIVE = "PROD_RECEIVE"  # 生產入庫
    PROD_CONSUME = "PROD_CONSUME"  # 生產扣料
    SHIP = "SHIP"                  # 出貨

# 單據類型
class RefType:
    PR = "PR"                    # 生產回報
    PR_APPROVE = "PR_APPROVE"    # 生產核准（用於 idempotency 檢查）
    PO = "PO"                    # 進貨單
    SO = "SO"                    # 銷貨單
    ADJ = "ADJ"                  # 調整

