"""migrate_null_site_to_warehouse

Revision ID: g2h3i4j5k6l7
Revises: f1a2b3c4d5e6
Create Date: 2025-01-27 13:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'g2h3i4j5k6l7'
down_revision: Union[str, Sequence[str], None] = 'f1a2b3c4d5e6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema: 将所有 NULL site 的库存记录补成 WAREHOUSE."""
    # 更新所有 site IS NULL 的记录为 'WAREHOUSE'
    # 这是架构瘦身的一部分：统一使用单一站点 WAREHOUSE
    # 旧数据（在 site 字段添加之前创建的记录）会被统一补成 WAREHOUSE
    conn = op.get_bind()
    conn.execute(
        sa.text("UPDATE inventory_moves SET site = 'WAREHOUSE' WHERE site IS NULL")
    )


def downgrade() -> None:
    """Downgrade schema: 回滚时无法自动恢复 NULL 数据（数据已补全）."""
    # 注意：回滚时无法区分哪些记录原本是 NULL，哪些是 WAREHOUSE
    # 因此 downgrade 不做任何操作
    # 如果需要回滚，需要从备份恢复
    pass

