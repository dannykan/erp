"""add_status_to_sales_orders

Revision ID: b2cec9eb8178
Revises: d95d2f1c58b3
Create Date: 2025-12-23 16:50:10.095640

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b2cec9eb8178'
down_revision: Union[str, Sequence[str], None] = 'd95d2f1c58b3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column("sales_orders", sa.Column("status", sa.String(length=20), nullable=False, server_default="DRAFT"))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column("sales_orders", "status")
