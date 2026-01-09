"""add_discount_amount_to_sales_orders

Revision ID: 3654823891f6
Revises: j5k6l7m8n9o0
Create Date: 2026-01-02 17:53:27.602272

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '3654823891f6'
down_revision: Union[str, Sequence[str], None] = 'j5k6l7m8n9o0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column("sales_orders", sa.Column("discount_amount", sa.REAL(), nullable=True, server_default=sa.text("0.0")))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column("sales_orders", "discount_amount")
