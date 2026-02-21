# cleanup_db.py
import os
from dotenv import load_dotenv
from sqlalchemy import create_engine, desc
from sqlalchemy.orm import sessionmaker
from app.database.models import Base, TradingHypothesis

# Load environment variables
load_dotenv()

# Database connection URL - Use pg8000 as seen in requirements.txt
DB_URL = f"postgresql+pg8000://{os.getenv('DB_USER')}:{os.getenv('DB_PASSWORD')}@{os.getenv('DB_HOST')}:{os.getenv('DB_PORT')}/{os.getenv('DATABASE_NAME')}"

def cleanup_failed_hypotheses():
    db = None
    try:
        engine = create_engine(DB_URL)
        SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
        db = SessionLocal()
        
        print(f"🧹 Scanning database for failed hypotheses...")
        
        # Find all hypotheses where title or thesis contains "Error running"
        failed = db.query(TradingHypothesis).filter(
            (TradingHypothesis.title.like("%Error running%")) | 
            (TradingHypothesis.thesis.like("%Error running%"))
        ).all()
        
        if not failed:
            print("✅ No failed hypotheses found.")
            return

        print(f"🗑️  Found {len(failed)} failed hypotheses. Deleting...")
        for hyp in failed:
            print(f"   - Deleting ID {hyp.id}: {hyp.title[:50]}...")
            db.delete(hyp)
        
        db.commit()
        print("✅ Cleanup complete.")
        
    except Exception as e:
        print(f"❌ Cleanup failed: {str(e)}")
    finally:
        if db:
            db.close()

if __name__ == "__main__":
    cleanup_failed_hypotheses()
