"""add_display_name_to_users

Revision ID: 72f3eed95ecc
Revises: fe36ca03e134
Create Date: 2025-12-23 11:51:27.649876

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '72f3eed95ecc'
down_revision: Union[str, Sequence[str], None] = 'fe36ca03e134'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # 添加 display_name 字段（SQLite 支持添加列）
    op.add_column('users', sa.Column('display_name', sa.String(length=80), nullable=True))
    # 为现有用户设置 display_name = username
    op.execute("UPDATE users SET display_name = username WHERE display_name IS NULL")
    # 创建索引
    op.create_index(op.f('ix_users_display_name'), 'users', ['display_name'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f('ix_users_display_name'), table_name='users')
    op.drop_column('users', 'display_name')
