"""change_qty_change_to_real

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2025-01-15 11:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b2c3d4e5f6a7'
down_revision: Union[str, Sequence[str], None] = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # SQLite 需要重新建立表來改變欄位類型
    # 但為了安全，我們先檢查是否有資料
    # 這裡使用更安全的方式：先備份，再修改
    op.execute("""
        CREATE TABLE inventory_moves_new (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            product_id INTEGER NOT NULL,
            move_type VARCHAR(20) NOT NULL,
            qty_change REAL NOT NULL,
            site VARCHAR(20),
            stage VARCHAR(20),
            ref_type VARCHAR(20),
            ref_no VARCHAR(50),
            note VARCHAR(300),
            created_at DATETIME NOT NULL,
            FOREIGN KEY(product_id) REFERENCES products(id)
        )
    """)
    op.execute("""
        INSERT INTO inventory_moves_new 
        SELECT * FROM inventory_moves
    """)
    op.execute("DROP TABLE inventory_moves")
    op.execute("ALTER TABLE inventory_moves_new RENAME TO inventory_moves")
    op.create_index('ix_inventory_moves_product_id', 'inventory_moves', ['product_id'])


def downgrade() -> None:
    """Downgrade schema."""
    # 改回 Integer（會丟失小數部分）
    op.execute("""
        CREATE TABLE inventory_moves_old (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            product_id INTEGER NOT NULL,
            move_type VARCHAR(20) NOT NULL,
            qty_change INTEGER NOT NULL,
            site VARCHAR(20),
            stage VARCHAR(20),
            ref_type VARCHAR(20),
            ref_no VARCHAR(50),
            note VARCHAR(300),
            created_at DATETIME NOT NULL,
            FOREIGN KEY(product_id) REFERENCES products(id)
        )
    """)
    op.execute("""
        INSERT INTO inventory_moves_old 
        SELECT id, product_id, move_type, CAST(qty_change AS INTEGER), site, stage, ref_type, ref_no, note, created_at
        FROM inventory_moves
    """)
    op.execute("DROP TABLE inventory_moves")
    op.execute("ALTER TABLE inventory_moves_old RENAME TO inventory_moves")
    op.create_index('ix_inventory_moves_product_id', 'inventory_moves', ['product_id'])

