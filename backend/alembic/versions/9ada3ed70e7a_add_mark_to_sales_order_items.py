"""add_mark_to_sales_order_items

Revision ID: 9ada3ed70e7a
Revises: i4j5k6l7m8n9
Create Date: 2025-12-23 22:06:42.037424

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '9ada3ed70e7a'
down_revision: Union[str, Sequence[str], None] = 'i4j5k6l7m8n9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('sales_order_items', sa.Column('mark', sa.String(length=100), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('sales_order_items', 'mark')
