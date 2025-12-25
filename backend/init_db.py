#!/usr/bin/env python3
"""Initialize database schema using SQLAlchemy models."""
import os
from app.db import engine, Base
from app import models  # Import all models

def init_db():
    """Create all database tables."""
    print("Creating database tables...")
    Base.metadata.create_all(bind=engine)
    print("Database tables created successfully!")

if __name__ == "__main__":
    init_db()

