#!/bin/bash
set -e

echo "Starting StichCV services on server..."

# Check if .env exists, if not use example
if [ ! -f ".env" ]; then
    echo "Warning: .env file not found. Falling back to .env.example..."
    cp .env.example .env
fi

# Stop existing containers
echo "Stopping existing containers..."
# Determine if docker-compose or docker compose is used
if command -v docker-compose &> /dev/null; then
    DOCKER_CMD="docker-compose"
else
    DOCKER_CMD="docker compose"
fi

$DOCKER_CMD -f docker-compose.prod.yml down

# Build and start containers detached
echo "Building and starting containers in detached mode..."
$DOCKER_CMD -f docker-compose.prod.yml up --build -d

echo "----------------------------------------"
echo "StichCV services started successfully!"
echo "Backend API is running on port 8000"
echo "Frontend is running on port 80"
echo "----------------------------------------"
echo "To view logs, run: $DOCKER_CMD -f docker-compose.prod.yml logs -f"
