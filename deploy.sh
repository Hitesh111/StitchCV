#!/bin/bash
set -e

echo "Syncing repository to EC2 instance (stichcv-server)..."
# Create deployment directory on remote first
ssh stichcv-server "mkdir -p ~/stitchcv-deployment"

# Rsync files to remote (excluding local dev environments and caches)
rsync -avz --exclude 'node_modules' \
           --exclude '.venv' \
           --exclude '.git' \
           --exclude '__pycache__' \
           --exclude 'frontend/dist' \
           --exclude 'chroma_db' \
           --exclude '.pytest_cache' \
           ./ stichcv-server:~/stitchcv-deployment/

echo "Building and starting Docker containers on EC2..."
ssh stichcv-server "cd ~/stitchcv-deployment && \
    docker-compose -f docker-compose.prod.yml down && \
    docker-compose -f docker-compose.prod.yml up --build -d"

echo "Deployment finished! Checkout your application on the EC2 server."