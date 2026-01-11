#!/bin/bash

# Deploy all Cloud Functions to Google Cloud
# Make sure you have gcloud CLI installed and authenticated
# Run: chmod +x scripts/deploy.sh && ./scripts/deploy.sh

set -e

# Configuration
PROJECT_ID=${GCP_PROJECT_ID:-"your-project-id"}
REGION=${GCP_REGION:-"asia-northeast1"}
RUNTIME="nodejs20"
MEMORY="512MB"
TIMEOUT="60s"

echo "🚀 Deploying Cloud Functions to $PROJECT_ID in $REGION..."

# Build TypeScript
echo "📦 Building TypeScript..."
npm run build

# Deploy sync-vocabulary function
echo "📤 Deploying sync-vocabulary..."
gcloud functions deploy sync-vocabulary \
  --gen2 \
  --runtime=$RUNTIME \
  --region=$REGION \
  --source=. \
  --entry-point=syncVocabulary \
  --trigger-http \
  --allow-unauthenticated \
  --memory=$MEMORY \
  --timeout=$TIMEOUT \
  --env-vars-file=.env.yaml \
  --project=$PROJECT_ID

# Deploy create-test function
echo "📤 Deploying create-test..."
gcloud functions deploy create-test \
  --gen2 \
  --runtime=$RUNTIME \
  --region=$REGION \
  --source=. \
  --entry-point=createTest \
  --trigger-http \
  --allow-unauthenticated \
  --memory=$MEMORY \
  --timeout=$TIMEOUT \
  --env-vars-file=.env.yaml \
  --project=$PROJECT_ID

# Deploy slack-events function
echo "📤 Deploying slack-events..."
gcloud functions deploy slack-events \
  --gen2 \
  --runtime=$RUNTIME \
  --region=$REGION \
  --source=. \
  --entry-point=slackEvents \
  --trigger-http \
  --allow-unauthenticated \
  --memory=$MEMORY \
  --timeout=$TIMEOUT \
  --env-vars-file=.env.yaml \
  --project=$PROJECT_ID

# Deploy slack-interactions function
echo "📤 Deploying slack-interactions..."
gcloud functions deploy slack-interactions \
  --gen2 \
  --runtime=$RUNTIME \
  --region=$REGION \
  --source=. \
  --entry-point=slackInteractions \
  --trigger-http \
  --allow-unauthenticated \
  --memory=$MEMORY \
  --timeout=$TIMEOUT \
  --env-vars-file=.env.yaml \
  --project=$PROJECT_ID

echo "✅ All functions deployed successfully!"
echo ""
echo "📋 Function URLs:"
gcloud functions describe sync-vocabulary --region=$REGION --gen2 --project=$PROJECT_ID --format="value(serviceConfig.uri)"
gcloud functions describe create-test --region=$REGION --gen2 --project=$PROJECT_ID --format="value(serviceConfig.uri)"
gcloud functions describe slack-events --region=$REGION --gen2 --project=$PROJECT_ID --format="value(serviceConfig.uri)"
gcloud functions describe slack-interactions --region=$REGION --gen2 --project=$PROJECT_ID --format="value(serviceConfig.uri)"
