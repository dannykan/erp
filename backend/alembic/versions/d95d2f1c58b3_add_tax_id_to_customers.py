"""add_tax_id_to_customers

Revision ID: d95d2f1c58b3
Revises: e19fde61a3f2
Create Date: 2025-12-23 16:30:13.694109

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd95d2f1c58b3'
down_revision: Union[str, Sequence[str], None] = 'e19fde61a3f2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('customers', sa.Column('tax_id', sa.String(length=20), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('customers', 'tax_id')
