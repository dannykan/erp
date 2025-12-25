"""add_payment_fields_to_sales_orders

Revision ID: j5k6l7m8n9o0
Revises: 9ada3ed70e7a
Create Date: 2025-12-23 14:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'j5k6l7m8n9o0'
down_revision: Union[str, Sequence[str], None] = '9ada3ed70e7a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column("sales_orders", sa.Column("is_paid", sa.Boolean(), nullable=False, server_default=sa.text("false")))
    op.add_column("sales_orders", sa.Column("paid_at", sa.DateTime(), nullable=True))
    op.add_column("sales_orders", sa.Column("paid_by_id", sa.Integer(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column("sales_orders", "paid_by_id")
    op.drop_column("sales_orders", "paid_at")
    op.drop_column("sales_orders", "is_paid")

