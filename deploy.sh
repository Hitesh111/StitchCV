#!/bin/bash
set -e

echo "Running Frontend test suite..."
cd frontend && npm run test && cd ..

echo "Running Backend test suite..."
source .venv/bin/activate && pytest tests/

echo "Tests passed! Syncing repository to EC2 instance (stichcv-server)..."
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

echo "Configuring production environment variables on EC2..."
ssh stichcv-server "cd ~/stitchcv-deployment && \
    grep -q '^APP_BASE_URL=' .env || echo 'APP_BASE_URL=https://stitchcv.in' >> .env && \
    grep -q '^FRONTEND_BASE_URL=' .env || echo 'FRONTEND_BASE_URL=https://stitchcv.in' >> .env && \
    sed -i -e 's|^APP_BASE_URL=.*|APP_BASE_URL=https://stitchcv.in|' .env && \
    sed -i -e 's|^FRONTEND_BASE_URL=.*|FRONTEND_BASE_URL=https://stitchcv.in|' .env"

echo "Building and starting Docker containers on EC2..."
ssh stichcv-server "cd ~/stitchcv-deployment && \
    docker system prune -af && \
    docker-compose -f docker-compose.prod.yml down && \
    docker-compose -f docker-compose.prod.yml up --build -d"

echo "Deployment finished! Checkout your application on the EC2 server."