"""add_product_fields

Revision ID: h3i4j5k6l7m8
Revises: g2h3i4j5k6l7
Create Date: 2025-12-23 20:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'h3i4j5k6l7m8'
down_revision: Union[str, Sequence[str], None] = 'g2h3i4j5k6l7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('products', sa.Column('quotation_unit', sa.String(length=20), nullable=True))
    op.add_column('products', sa.Column('pieces_per_case', sa.Integer(), nullable=True))
    op.add_column('products', sa.Column('pack_quantity', sa.String(length=50), nullable=True))
    op.add_column('products', sa.Column('model', sa.String(length=100), nullable=True))
    op.add_column('products', sa.Column('brand', sa.String(length=100), nullable=True))
    op.add_column('products', sa.Column('size', sa.String(length=100), nullable=True))
    op.add_column('products', sa.Column('origin', sa.String(length=50), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('products', 'origin')
    op.drop_column('products', 'size')
    op.drop_column('products', 'brand')
    op.drop_column('products', 'model')
    op.drop_column('products', 'pack_quantity')
    op.drop_column('products', 'pieces_per_case')
    op.drop_column('products', 'quotation_unit')

