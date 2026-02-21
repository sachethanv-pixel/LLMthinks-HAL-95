#!/bash
# deploy_frontend.sh

PROJECT_ID="sdr-agent-486508"
REGION="us-central1"
BACKEND_URL="https://tradesage-ai-85008682519.us-central1.run.app"

echo "🚀 Building and Deploying TradeSage Frontend"
echo "Project: $PROJECT_ID"
echo "Backend URL: $BACKEND_URL"

# Build with REACT_APP_API_URL baked in
# Note: We run from the root, but the build context is the frontend folder
gcloud builds submit --tag gcr.io/$PROJECT_ID/tradesage-frontend \
    --build-arg "REACT_APP_API_URL=$BACKEND_URL" \
    frontend/

# Deploy to Cloud Run
gcloud run deploy tradesage-frontend \
    --image gcr.io/$PROJECT_ID/tradesage-frontend \
    --region $REGION \
    --allow-unauthenticated \
    --port 8080 \
    --memory 1Gi \
    --cpu 1

echo "✅ Frontend deployment complete!"
gcloud run services describe tradesage-frontend --region $REGION --format 'value(status.url)'
