"""add_missing_price_fields_to_sales_order_items

Revision ID: 2f518c67e11b
Revises: 3202368e5e86
Create Date: 2025-12-23 16:54:21.562301

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '2f518c67e11b'
down_revision: Union[str, Sequence[str], None] = '3202368e5e86'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Add unit_price and price_unit fields if they don't exist
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    columns = [col['name'] for col in inspector.get_columns('sales_order_items')]
    
    if 'unit_price' not in columns:
        op.add_column(
            "sales_order_items",
            sa.Column("unit_price", sa.Float(), nullable=False, server_default="0"),
        )
    
    if 'price_unit' not in columns:
        op.add_column(
            "sales_order_items",
            sa.Column("price_unit", sa.String(20), nullable=False, server_default="件"),
        )
        # Update existing rows to use '件' as default if unit is not set
        op.execute("UPDATE sales_order_items SET price_unit = COALESCE(unit, '件') WHERE price_unit = '' OR price_unit IS NULL")


def downgrade() -> None:
    """Downgrade schema."""
    # Only drop if they exist
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    columns = [col['name'] for col in inspector.get_columns('sales_order_items')]
    
    if 'price_unit' in columns:
        op.drop_column("sales_order_items", "price_unit")
    if 'unit_price' in columns:
        op.drop_column("sales_order_items", "unit_price")
