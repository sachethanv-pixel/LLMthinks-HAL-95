# app/database/database.py
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.database.models import Base
import os
from dotenv import load_dotenv
from google.cloud.sql.connector import Connector

# Load environment variables
load_dotenv()

# Cloud SQL Configuration
PROJECT_ID = os.getenv("PROJECT_ID", "tradesage-mvp")
REGION = os.getenv("REGION", "us-central1")
INSTANCE_NAME = os.getenv("INSTANCE_NAME", "agentic-db")
DATABASE_NAME = os.getenv("DATABASE_NAME", "tradesage_db")
DB_USER = os.getenv("DB_USER", "postgres")
DB_PASSWORD = os.getenv("DB_PASSWORD")
DB_HOST = os.getenv("DB_HOST")  # New: for local connection
DB_PORT = os.getenv("DB_PORT", "5432")  # New: for local connection

def create_db_engine():
    """Create engine for either Cloud SQL or Local PostgreSQL"""
    if not DB_PASSWORD:
        raise ValueError("DB_PASSWORD environment variable must be set")

    # Option 1: Local / Direct Connection (if DB_HOST is provided)
    if DB_HOST:
        print(f"[LOCAL] Connecting to Local/Direct PostgreSQL at {DB_HOST}:{DB_PORT}...")
        connection_url = f"postgresql+pg8000://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DATABASE_NAME}"
        engine = create_engine(
            connection_url,
            pool_pre_ping=True,
            pool_recycle=300,
            echo=False
        )
        return engine, None

    # Option 2: Cloud SQL Connector
    print("[CLOUD] Connecting to Cloud SQL PostgreSQL via Connector...")
    try:
        connector = Connector()
        
        def getconn():
            return connector.connect(
                f"{PROJECT_ID}:{REGION}:{INSTANCE_NAME}",
                "pg8000",
                user=DB_USER,
                password=DB_PASSWORD,
                db=DATABASE_NAME
            )
        
        engine = create_engine(
            "postgresql+pg8000://",
            creator=getconn,
            pool_pre_ping=True,
            pool_recycle=300,
            echo=False
        )
        return engine, connector
    except Exception as e:
        print(f"[ERROR] Failed to initialize Cloud SQL Connector: {e}")
        print("💡 TIP: If you are running locally without GCP credentials, set DB_HOST and DB_PORT in your .env file.")
        raise

# Create the engine
engine, connector = create_db_engine()
print("[OK] Database engine created")

# Create session maker
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def create_tables():
    """Create all tables in the database."""
    try:
        Base.metadata.create_all(bind=engine)
        print("[OK] Database tables created successfully")
    except Exception as e:
        print(f"[ERROR] Error creating tables: {e}")
        raise

def get_db():
    """Dependency to get database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def close_connections():
    """Close database connections (important for Cloud SQL)"""
    if connector:
        connector.close()

# Initialize database on module import
create_tables()
