"""migrate_factory_to_warehouse_site

Revision ID: f1a2b3c4d5e6
Revises: 2f518c67e11b
Create Date: 2025-01-27 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f1a2b3c4d5e6'
down_revision: Union[str, Sequence[str], None] = '2f518c67e11b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema: 将所有 FACTORY 站点的库存记录迁移到 WAREHOUSE."""
    # 更新所有 site='FACTORY' 的记录为 'WAREHOUSE'
    # 这是架构瘦身的一部分：统一使用单一站点 WAREHOUSE
    conn = op.get_bind()
    conn.execute(
        sa.text("UPDATE inventory_moves SET site = 'WAREHOUSE' WHERE site = 'FACTORY'")
    )


def downgrade() -> None:
    """Downgrade schema: 回滚时无法自动恢复 FACTORY 数据（数据已合并）."""
    # 注意：回滚时无法区分哪些记录原本是 FACTORY，哪些是 WAREHOUSE
    # 因此 downgrade 不做任何操作
    # 如果需要回滚，需要从备份恢复
    pass

