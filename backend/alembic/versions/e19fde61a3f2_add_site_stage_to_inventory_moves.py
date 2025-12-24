"""add_site_stage_to_inventory_moves

Revision ID: e19fde61a3f2
Revises: e5f6a7b8c9d0
Create Date: 2025-12-23 16:27:02.092557

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e19fde61a3f2'
down_revision: Union[str, Sequence[str], None] = 'e5f6a7b8c9d0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # SQLite supports ALTER TABLE ADD COLUMN, but we need to check if columns exist first
    # Since SQLite doesn't have a direct way to check, we'll use a try-except approach
    # or check the table schema
    
    # Get the connection to check if columns exist
    conn = op.get_bind()
    cursor = conn.execute("PRAGMA table_info(inventory_moves)")
    columns = [row[1] for row in cursor.fetchall()]
    
    # Add site column if it doesn't exist
    if 'site' not in columns:
        op.add_column('inventory_moves', sa.Column('site', sa.String(20), nullable=True))
    
    # Add stage column if it doesn't exist
    if 'stage' not in columns:
        op.add_column('inventory_moves', sa.Column('stage', sa.String(20), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    # SQLite doesn't support DROP COLUMN directly, so we'll skip the downgrade
    # In production, you'd need to recreate the table without these columns
    pass
