"""create print_jobs

Revision ID: dff47c4badf4
Revises: 3654823891f6
Create Date: 2026-01-09 11:58:33.885963

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'dff47c4badf4'
down_revision: Union[str, Sequence[str], None] = '3654823891f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        "print_jobs",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column("kind", sa.String(length=16), nullable=False, server_default="raw"),
        sa.Column("text", sa.Text(), nullable=False),
        sa.Column("encoding", sa.String(length=32), nullable=False, server_default="cp950"),
        sa.Column("copies", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("status", sa.String(length=16), nullable=False, server_default="queued"),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("locked_at", sa.DateTime(), nullable=True),
        sa.Column("locked_by", sa.String(length=128), nullable=True),
        sa.Column("ack_at", sa.DateTime(), nullable=True),
        sa.Column("ack_message", sa.Text(), nullable=True),
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_table("print_jobs")
