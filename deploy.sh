#!/bin/bash
# Exit immediately if a command exits with a non-zero status.
# This ensures that if tests fail, the script stops and DOES NOT deploy broken code to production.
set -e

# ==========================================
# 1. LOCAL QA & TESTING GATES
# ==========================================
# Why: We never want to sync broken code to the live server. By running these locally first,
# we ensure that the deployment aborts immediately if any critical workflows are failing.

echo "Running Frontend test suite..."
# Runs vitest/jest to verify React components render correctly.
cd frontend && npm run test && cd ..

echo "Running Backend test suite..."
# Runs pytest on the Python API endpoints and agents (with mocked LLM calls).
source .venv/bin/activate && pytest tests/

echo "Tests passed! Syncing repository to EC2 instance (stichcv-server)..."

# ==========================================
# 2. SERVER SYNC & FILE TRANSFER
# ==========================================
# Why: rsync securely transfers only the changed files over SSH.
# We exclude node_modules, .venv, and caches because those must be built natively 
# inside the Docker engine on the Linux EC2 server, not copied from your Mac.

# Create deployment directory on remote first just in case it doesn't exist
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

# ==========================================
# 3. PRODUCTION ENVIRONMENT INJECTION
# ==========================================
# Why: The rsync command above copies your local `.env` file to the production server.
# Because your local `.env` doesn't explicitly define the production domain (it defaults to localhost),
# OAuth callbacks (Google/LinkedIn) would break on live by bouncing users to 127.0.0.1.
# This block programmatically forces the production URLs into the remote .env to ensure OAuth binds to stitchcv.in.

echo "Configuring production environment variables on EC2..."
ssh stichcv-server "cd ~/stitchcv-deployment && \
    grep -q '^APP_BASE_URL=' .env || echo 'APP_BASE_URL=https://stitchcv.in' >> .env && \
    grep -q '^FRONTEND_BASE_URL=' .env || echo 'FRONTEND_BASE_URL=https://stitchcv.in' >> .env && \
    sed -i -e 's|^APP_BASE_URL=.*|APP_BASE_URL=https://stitchcv.in|' .env && \
    sed -i -e 's|^FRONTEND_BASE_URL=.*|FRONTEND_BASE_URL=https://stitchcv.in|' .env"

# ==========================================
# 4. REMOTE BUILD & DEPLOYMENT
# ==========================================
# Why: Now that the files and URLs are securely on the server, we need to rebuild the Docker images.
# Note: `docker system prune -af` is absolutely critical because EC2 storage is limited. Hand-building 
# images creates gigabytes of dangling cache layers that will eventually crash the server with [Errno 28: No space left on device].

echo "Building and starting Docker containers on EC2..."
ssh stichcv-server "cd ~/stitchcv-deployment && \
    docker system prune -af && \
    docker-compose -f docker-compose.prod.yml down && \
    docker-compose -f docker-compose.prod.yml up --build -d"

echo "Deployment finished! Checkout your application on the EC2 server."