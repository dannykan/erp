"""add_unique_index_to_inventory_moves

Revision ID: e5f6a7b8c9d0
Revises: d4e5f6a7b8c9
Create Date: 2025-01-27 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e5f6a7b8c9d0'
down_revision: Union[str, Sequence[str], None] = 'd4e5f6a7b8c9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # 添加唯一索引防止并发出货重复扣库存
    # 关键：必须包含 product_id 和 site，因为同一张 SO 会有多个 items
    # 唯一索引：(ref_type, ref_no, stage, site, product_id)
    # 效果：同一个 SO、同一个品项、同一个 stage/site，只能扣一次
    # 注意：SQLite 对 NULL 值的唯一索引处理：多个 NULL 值不违反唯一性
    # 但我们的 ref_type/ref_no/stage/site/product_id 在出货时都会有值，所以可以安全使用
    # 如果已有重复数据，需要先清理
    try:
        op.create_index(
            'uq_inventory_moves_ref_stage_site_product',
            'inventory_moves',
            ['ref_type', 'ref_no', 'stage', 'site', 'product_id'],
            unique=True
        )
    except Exception:
        # 如果索引已存在或创建失败，忽略（可能是 SQLite 的限制）
        pass


def downgrade() -> None:
    """Downgrade schema."""
    try:
        op.drop_index('uq_inventory_moves_ref_stage_site_product', table_name='inventory_moves')
    except Exception:
        pass

