#!/bin/bash

echo "🔄 Updating BotFersal PWA..."

# Pull latest changes
git pull origin main

# Rebuild frontend
echo "🔨 Rebuilding frontend..."
cd frontend
npm install
npm run build
cd ..

# Restart containers
echo "🔄 Restarting containers..."
docker-compose down
docker-compose up -d --build

echo "✅ Update complete!"