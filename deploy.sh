#!/bin/bash

echo "🚀 Starting deployment of Tourism Management System..."

# Install dependencies
echo "📦 Installing dependencies..."
npm ci --only=production

# Build the application
echo "🔨 Building application..."
npm run build

# Check if build was successful
if [ $? -eq 0 ]; then
    echo "✅ Build successful!"
    
    # Start the production server
    echo "🌟 Starting production server..."
    npm run start:server
else
    echo "❌ Build failed! Please check the errors above."
    exit 1
fi
