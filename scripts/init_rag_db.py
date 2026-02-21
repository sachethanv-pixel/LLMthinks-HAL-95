# scripts/init_rag_db.py
import os
import sys
from sqlalchemy import text

# Add project root to path
project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, project_root)

def init_rag_db():
    print("🚀 Initializing RAG Database for TradeSage...")
    
    # Unset local DB_HOST to ensure Connector is used
    if "DB_HOST" in os.environ:
        del os.environ["DB_HOST"]
    if "DB_PORT" in os.environ:
        del os.environ["DB_PORT"]
    
    # Import after setting environment
    import app.database.database
    import importlib
    importlib.reload(app.database.database)
    from app.database.database import engine
    
    try:
        # 1. Enable vector extension (New connection for each attempt to avoid transaction aborts)
        print("🔌 Enabling pgvector extension...")
        try:
            with engine.connect() as conn:
                conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector;"))
                conn.commit()
            print("✅ pgvector extension enabled")
        except Exception as e:
            print(f"⚠️ Could not enable pgvector: {e}")
            print("   Continuing anyway (might already exist or permission issue)")
        
        with engine.connect() as conn:
            # 2. Create documents table
            print("📋 Creating 'documents' table...")
            create_table_sql = """
            CREATE TABLE IF NOT EXISTS documents (
                id SERIAL PRIMARY KEY,
                title VARCHAR(500),
                content TEXT,
                instrument VARCHAR(50),
                source_type VARCHAR(50),
                date_published TIMESTAMP,
                embedding vector(768),
                metadata JSONB,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            """
            conn.execute(text(create_table_sql))
            conn.commit()
            print("✅ 'documents' table created")
            
            # 3. Create vector index for IVFFlat or HNSW (optional but recommended)
            print("🚀 Creating vector index...")
            index_sql = "CREATE INDEX IF NOT EXISTS idx_documents_embedding ON documents USING hnsw (embedding vector_cosine_ops);"
            try:
                conn.execute(text(index_sql))
                conn.commit()
                print("✅ Vector index created")
            except Exception as e:
                print(f"⚠️ Could not create vector index: {e}")
            
            # 4. Add some sample RAG data (without embeddings for now, or use zeroes)
            print("📝 Adding sample RAG document...")
            sample_docs = [
                {
                    "title": "Fed Policy Outlook 2025",
                    "content": "The Federal Reserve is expected to maintain interest rates through Q1 2025 as inflation cools but remains above the 2% target. Market participants are watching for signals of a June pivot.",
                    "instrument": "SPY",
                    "source_type": "Market Analysis",
                },
                {
                    "title": "Global Oil Supply Trends",
                    "content": "OPEC+ production cuts are projected to keep Brent prices between $80-$90 throughout the first half of 2025, despite slowing demand from major industrial economies.",
                    "instrument": "BRENT",
                    "source_type": "Energy Research",
                }
            ]
            
            for doc in sample_docs:
                check_sql = f"SELECT count(*) FROM documents WHERE title = '{doc['title']}'"
                if conn.execute(text(check_sql)).fetchone()[0] == 0:
                    insert_sql = """
                    INSERT INTO documents (title, content, instrument, source_type)
                    VALUES (:title, :content, :instrument, :source_type)
                    """
                    conn.execute(text(insert_sql), doc)
                    conn.commit()
                    print(f"   Added: {doc['title']}")
            
            print("\n" + "="*50)
            print("🎉 RAG Database initialization complete!")
            print("="*50)
            
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    init_rag_db()
