"""add_customer_fields

Revision ID: i4j5k6l7m8n9
Revises: h3i4j5k6l7m8
Create Date: 2025-12-23 21:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'i4j5k6l7m8n9'
down_revision: Union[str, Sequence[str], None] = 'h3i4j5k6l7m8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('customers', sa.Column('customer_code', sa.String(length=20), nullable=True))
    op.create_index(op.f('ix_customers_customer_code'), 'customers', ['customer_code'], unique=False)
    op.add_column('customers', sa.Column('short_name', sa.String(length=100), nullable=True))
    op.add_column('customers', sa.Column('full_name', sa.String(length=200), nullable=True))
    op.add_column('customers', sa.Column('invoice_title', sa.String(length=200), nullable=True))
    op.add_column('customers', sa.Column('sales_category', sa.String(length=50), nullable=True))
    op.add_column('customers', sa.Column('filing_date', sa.Date(), nullable=True))
    op.add_column('customers', sa.Column('email', sa.String(length=200), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f('ix_customers_customer_code'), table_name='customers')
    op.drop_column('customers', 'email')
    op.drop_column('customers', 'filing_date')
    op.drop_column('customers', 'sales_category')
    op.drop_column('customers', 'invoice_title')
    op.drop_column('customers', 'full_name')
    op.drop_column('customers', 'short_name')
    op.drop_column('customers', 'customer_code')
