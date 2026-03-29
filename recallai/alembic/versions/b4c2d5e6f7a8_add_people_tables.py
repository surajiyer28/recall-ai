"""add people tables and person_id to tasks

Revision ID: b4c2d5e6f7a8
Revises: a3b1c2d4e5f6
Create Date: 2026-03-29 14:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'b4c2d5e6f7a8'
down_revision: Union[str, None] = 'a3b1c2d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create people table
    op.create_table(
        'people',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('name', sa.String(200), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.PrimaryKeyConstraint('id', name='pk_people'),
    )
    op.create_index('ix_people_created_at', 'people', ['created_at'])

    # Create people_highlights table
    op.create_table(
        'people_highlights',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('person_id', sa.String(), nullable=False),
        sa.Column('memory_id', sa.String(), nullable=False),
        sa.Column('highlight', sa.Text(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(['person_id'], ['people.id'], name='fk_people_highlights_person_id_people', ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['memory_id'], ['memories.id'], name='fk_people_highlights_memory_id_memories', ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id', name='pk_people_highlights'),
    )
    op.create_index('ix_people_highlights_created_at', 'people_highlights', ['created_at'])

    # Add person_id column to tasks table
    op.add_column('tasks', sa.Column('person_id', sa.String(), nullable=True))
    op.create_foreign_key(
        'fk_tasks_person_id_people',
        'tasks', 'people',
        ['person_id'], ['id'],
        ondelete='SET NULL',
    )


def downgrade() -> None:
    op.drop_constraint('fk_tasks_person_id_people', 'tasks', type_='foreignkey')
    op.drop_column('tasks', 'person_id')
    op.drop_index('ix_people_highlights_created_at', table_name='people_highlights')
    op.drop_table('people_highlights')
    op.drop_index('ix_people_created_at', table_name='people')
    op.drop_table('people')
