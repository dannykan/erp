"""add_bom_items_table

Revision ID: a1b2c3d4e5f6
Revises: 72f3eed95ecc
Create Date: 2025-01-15 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, Sequence[str], None] = '72f3eed95ecc'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        'bom_items',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('fg_product_id', sa.Integer(), nullable=False),
        sa.Column('raw_product_id', sa.Integer(), nullable=False),
        sa.Column('qty_per_fg_unit', sa.REAL(), nullable=False),
        sa.Column('note', sa.Text(), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='1'),
        sa.Column('created_at', sa.DateTime(), nullable=True, server_default=sa.text("(datetime('now'))")),
        sa.ForeignKeyConstraint(['fg_product_id'], ['products.id'], ),
        sa.ForeignKeyConstraint(['raw_product_id'], ['products.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('idx_bom_unique', 'bom_items', ['fg_product_id', 'raw_product_id'], unique=True)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index('idx_bom_unique', table_name='bom_items')
    op.drop_table('bom_items')

