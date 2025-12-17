#!/bin/bash

echo "Starting deployment..."

# Pull latest code
git pull origin main

# Build and restart containers
docker-compose down
docker-compose build --no-cache
docker-compose up -d

echo "Deployment completed!"
echo "App should be running on port 3000"
echo "Don't forget to:"
echo "1. Configure your .env.production file"
echo "2. Set up SSL certificates in ./ssl/ directory"
echo "3. Update nginx.conf with your domain"
echo "4. Ensure your MySQL server is accessible"
