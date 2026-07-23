from sqlalchemy.orm import declarative_base

# The single source of truth for the declarative base.
# Models import Base from here to avoid circular imports.
Base = declarative_base()
