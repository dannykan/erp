"""add_pick_ship_fields_to_sales_orders

Revision ID: d4e5f6a7b8c9
Revises: 1c6e6f7700bf
Create Date: 2025-01-27 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd4e5f6a7b8c9'
down_revision: Union[str, Sequence[str], None] = '1c6e6f7700bf'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column("sales_orders", sa.Column("picked_at", sa.DateTime(), nullable=True))
    op.add_column("sales_orders", sa.Column("picked_by_id", sa.Integer(), nullable=True))
    op.add_column("sales_orders", sa.Column("shipped_at", sa.DateTime(), nullable=True))
    op.add_column("sales_orders", sa.Column("shipped_by_id", sa.Integer(), nullable=True))
    op.add_column("sales_orders", sa.Column("ship_note", sa.Text(), nullable=True))
    op.add_column("sales_orders", sa.Column("logistics_no", sa.String(length=64), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column("sales_orders", "logistics_no")
    op.drop_column("sales_orders", "ship_note")
    op.drop_column("sales_orders", "shipped_by_id")
    op.drop_column("sales_orders", "shipped_at")
    op.drop_column("sales_orders", "picked_by_id")
    op.drop_column("sales_orders", "picked_at")

