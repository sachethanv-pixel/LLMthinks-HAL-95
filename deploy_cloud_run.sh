#!/bin/bash
# deploy_cloud_run.sh

# Configuration from .env
PROJECT_ID="sdr-agent-486508"
REGION="us-central1"
INSTANCE_NAME="agentic-db"
DATABASE_NAME="tradesage_db"
DB_USER="sachet_dev"
DB_PASSWORD="sachet_pass"
ALPHA_VANTAGE_API_KEY="AOZJ1UX282LQ5Z4Q"
NEWS_API_KEY="fcb0f287b9af4b698812a5172e49bb9d"
FMP_API_KEY="edqR4Tua2TtTK2BCA0BPLAaKMZcclxFO"

echo "🚀 Deploying TradeSage AI to Cloud Run"
echo "Project: $PROJECT_ID"
echo "Region: $REGION"

# Set project
gcloud config set project $PROJECT_ID

# Build the container image
echo "📦 Building container image..."
gcloud builds submit --tag gcr.io/$PROJECT_ID/tradesage-ai .

# Deploy to Cloud Run
echo "🚢 Deploying to Cloud Run..."
gcloud run deploy tradesage-ai \
    --image gcr.io/$PROJECT_ID/tradesage-ai \
    --region $REGION \
    --allow-unauthenticated \
    --port 8080 \
    --memory 4Gi \
    --cpu 2 \
    --timeout 300 \
    --set-env-vars "PROJECT_ID=$PROJECT_ID,REGION=$REGION,INSTANCE_NAME=$INSTANCE_NAME,DATABASE_NAME=$DATABASE_NAME,DB_USER=$DB_USER,DB_PASSWORD=$DB_PASSWORD,ALPHA_VANTAGE_API_KEY=$ALPHA_VANTAGE_API_KEY,NEWS_API_KEY=$NEWS_API_KEY,FMP_API_KEY=$FMP_API_KEY,GOOGLE_CLOUD_PROJECT=$PROJECT_ID,GOOGLE_CLOUD_LOCATION=$REGION,GOOGLE_GENAI_USE_VERTEXAI=True"

echo "✅ Deployment complete!"
gcloud run services describe tradesage-ai --region $REGION --format 'value(status.url)'
