"""add_missing_pick_ship_fields_to_sales_orders

Revision ID: 3202368e5e86
Revises: b2cec9eb8178
Create Date: 2025-12-23 16:51:15.794145

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '3202368e5e86'
down_revision: Union[str, Sequence[str], None] = 'b2cec9eb8178'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Add pick/ship fields if they don't exist
    # Using try/except since SQLite doesn't support IF NOT EXISTS for columns
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    columns = [col['name'] for col in inspector.get_columns('sales_orders')]
    
    if 'picked_at' not in columns:
        op.add_column("sales_orders", sa.Column("picked_at", sa.DateTime(), nullable=True))
    if 'picked_by_id' not in columns:
        op.add_column("sales_orders", sa.Column("picked_by_id", sa.Integer(), nullable=True))
    if 'shipped_at' not in columns:
        op.add_column("sales_orders", sa.Column("shipped_at", sa.DateTime(), nullable=True))
    if 'shipped_by_id' not in columns:
        op.add_column("sales_orders", sa.Column("shipped_by_id", sa.Integer(), nullable=True))
    if 'ship_note' not in columns:
        op.add_column("sales_orders", sa.Column("ship_note", sa.Text(), nullable=True))
    if 'logistics_no' not in columns:
        op.add_column("sales_orders", sa.Column("logistics_no", sa.String(length=64), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    # Only drop if they exist
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    columns = [col['name'] for col in inspector.get_columns('sales_orders')]
    
    if 'logistics_no' in columns:
        op.drop_column("sales_orders", "logistics_no")
    if 'ship_note' in columns:
        op.drop_column("sales_orders", "ship_note")
    if 'shipped_by_id' in columns:
        op.drop_column("sales_orders", "shipped_by_id")
    if 'shipped_at' in columns:
        op.drop_column("sales_orders", "shipped_at")
    if 'picked_by_id' in columns:
        op.drop_column("sales_orders", "picked_by_id")
    if 'picked_at' in columns:
        op.drop_column("sales_orders", "picked_at")
