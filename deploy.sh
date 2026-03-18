#!/bin/bash
set -e

echo "Syncing repository to EC2 instance (hireflow-server)..."
# Create deployment directory on remote first
ssh hireflow-server "mkdir -p ~/hireflow-deployment"

# Rsync files to remote (excluding local dev environments and caches)
rsync -avz --exclude 'node_modules' \
           --exclude '.venv' \
           --exclude '.git' \
           --exclude '__pycache__' \
           --exclude 'frontend/dist' \
           --exclude 'chroma_db' \
           --exclude '.pytest_cache' \
           ./ hireflow-server:~/hireflow-deployment/

echo "Building and starting Docker containers on EC2..."
ssh hireflow-server "cd ~/hireflow-deployment && docker-compose -f docker-compose.prod.yml up --build -d"

echo "Deployment finished! Checkout your application on the EC2 server."
