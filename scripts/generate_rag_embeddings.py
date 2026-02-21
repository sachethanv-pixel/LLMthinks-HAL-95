# scripts/generate_rag_embeddings.py
import os
import sys
from sqlalchemy import text
import vertexai
from vertexai.language_models import TextEmbeddingModel

# Add project root to path
project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, project_root)

def generate_embeddings():
    print("🧠 Generating embeddings for RAG documents...")
    
    # Configuration
    PROJECT_ID = "sdr-agent-486508"
    REGION = "us-central1"
    
    # Unset local DB_HOST to ensure Connector is used
    if "DB_HOST" in os.environ:
        del os.environ["DB_HOST"]
    if "DB_PORT" in os.environ:
        del os.environ["DB_PORT"]
    
    os.environ["USE_CLOUD_SQL"] = "true"
    
    # Initialize Vertex AI
    vertexai.init(project=PROJECT_ID, location=REGION)
    model = TextEmbeddingModel.from_pretrained("text-embedding-004")
    
    from app.database.database import engine
    
    try:
        with engine.connect() as conn:
            # Get documents without embeddings
            result = conn.execute(text("SELECT id, content FROM documents WHERE embedding IS NULL"))
            docs = result.fetchall()
            
            if not docs:
                print("✅ All documents already have embeddings.")
                return
            
            print(f"📊 Found {len(docs)} documents to process.")
            
            for doc_id, content in docs:
                print(f"   Processing document {doc_id}...")
                
                # Generate embedding
                embedding = model.get_embeddings([content])[0].values
                
                # Update database
                # pg8000 and SQLAlchemy text require a string representation like [1.0, 2.0, ...]
                embedding_str = str(list(embedding))
                
                update_sql = "UPDATE documents SET embedding = :emb WHERE id = :id"
                conn.execute(text(update_sql), {"emb": embedding_str, "id": doc_id})
                conn.commit()
                print(f"   ✅ Updated document {doc_id}")
            
            print("\n" + "="*50)
            print("🎉 RAG Embeddings generation complete!")
            print("="*50)
            
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    generate_embeddings()
