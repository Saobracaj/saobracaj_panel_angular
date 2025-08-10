#!/bin/bash

# Script to deploy the Angular application to Google Cloud Run
# Make sure you have gcloud CLI installed and configured

set -e

# Configuration
PROJECT_ID=$(gcloud config get-value project)
REGION="europe-west1"
SERVICE_NAME="saobracaj-panel"
IMAGE_NAME="gcr.io/$PROJECT_ID/$SERVICE_NAME"

echo "🚀 Deploying $SERVICE_NAME to Google Cloud Run..."
echo "Project ID: $PROJECT_ID"
echo "Region: $REGION"

# Build the Docker image
echo "📦 Building Docker image..."
docker build -t $IMAGE_NAME .

# Push the image to Google Container Registry
echo "⬆️  Pushing image to Container Registry..."
docker push $IMAGE_NAME

# Deploy to Cloud Run
echo "🌐 Deploying to Cloud Run..."
gcloud run deploy $SERVICE_NAME \
  --image $IMAGE_NAME \
  --region $REGION \
  --platform managed \
  --allow-unauthenticated \
  --port 8080 \
  --memory 512Mi \
  --cpu 1 \
  --max-instances 10 \
  --min-instances 0 \
  --timeout 300 \
  --set-env-vars NODE_ENV=production

echo "✅ Deployment completed successfully!"
echo "🌍 Your application is available at:"
gcloud run services describe $SERVICE_NAME --region=$REGION --format="value(status.url)"
