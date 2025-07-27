#!/bin/bash

echo "🚀 Building and Deploying BotFersal PWA..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if required files exist
if [ ! -f "docker-compose.yml" ]; then
    print_error "docker-compose.yml not found!"
    exit 1
fi

if [ ! -f "ngrok.yml" ]; then
    print_warning "ngrok.yml not found. Please create it with your auth token."
fi

# Build React app
print_status "Building React PWA..."
cd frontend
if [ ! -f "package.json" ]; then
    print_error "package.json not found in frontend directory!"
    exit 1
fi

npm install
npm run build

if [ $? -eq 0 ]; then
    print_success "React app built successfully"
else
    print_error "React build failed"
    exit 1
fi

cd ..

# Stop existing containers
print_status "Stopping existing containers..."
docker compose down

# Build and start containers
print_status "Building Docker images..."
docker compose build --no-cache

if [ $? -eq 0 ]; then
    print_success "Docker images built successfully"
else
    print_error "Docker build failed"
    exit 1
fi

print_status "Starting containers..."
docker compose up -d

# Wait for services to be ready
print_status "Waiting for services to be ready..."
sleep 10

# Check container status
print_status "Checking container status..."
docker compose ps

# Check if main app is healthy
print_status "Waiting for health check..."
for i in {1..30}; do
    if curl -s http://localhost:8000/api/health > /dev/null; then
        print_success "BotFersal app is healthy!"
        break
    else
        echo -n "."
        sleep 2
    fi
    
    if [ $i -eq 30 ]; then
        print_error "App failed to become healthy"
        docker-compose logs botfersal
        exit 1
    fi
done

# Get Ngrok URL
print_status "Getting public URL..."
sleep 5
PUBLIC_URL=$(curl -s http://localhost:4040/api/tunnels | jq -r '.tunnels[0].public_url' 2>/dev/null)

echo ""
print_success "🎉 Deployment Complete!"
echo ""
echo "📱 Local Access:"
echo "   Web App: http://localhost:8000"
echo "   API Docs: http://localhost:8000/api/docs"
echo "   Ngrok Dashboard: http://localhost:4040"
echo ""

if [ "$PUBLIC_URL" != "null" ] && [ ! -z "$PUBLIC_URL" ]; then
    echo "🌐 Public Access:"
    echo "   Public URL: $PUBLIC_URL"
    echo "   Share this URL with your wife!"
    echo ""
    
    # Generate QR code if qrencode is available
    if command -v qrencode &> /dev/null; then
        echo "📱 QR Code for easy mobile access:"
        qrencode -t ansiutf8 "$PUBLIC_URL"
        echo ""
    fi
else
    print_warning "Could not retrieve public URL. Check ngrok configuration."
fi

echo "💡 Tips:"
echo "   • Add the PWA to your phone's home screen"
echo "   • Use 'Add to Home Screen' in your browser"
echo "   • The app works offline after first load"
echo ""

print_success "Ready to use! 🚀"
