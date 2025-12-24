"""add_price_unit_to_so_items

Revision ID: 1c6e6f7700bf
Revises: c3d4e5f6a7b8
Create Date: 2025-01-27 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '1c6e6f7700bf'
down_revision: Union[str, Sequence[str], None] = 'c3d4e5f6a7b8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column(
        "sales_order_items",
        sa.Column("price_unit", sa.String(20), nullable=False, server_default=""),
    )
    # 先用 unit 回填（最安全），避免 unit != price_unit 造成混亂
    op.execute("UPDATE sales_order_items SET price_unit = unit WHERE price_unit = '' OR price_unit IS NULL")
    # 設定 default 為 '件'
    op.alter_column("sales_order_items", "price_unit", server_default="件")


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column("sales_order_items", "price_unit")

