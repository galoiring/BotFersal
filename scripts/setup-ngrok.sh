#!/bin/bash

echo "🔧 Setting up Ngrok for BotFersal..."

# Check if ngrok is installed
if ! command -v ngrok &> /dev/null; then
    echo "Installing ngrok..."
    
    # Detect OS and install accordingly
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        curl -s https://ngrok-agent.s3.amazonaws.com/ngrok.asc | sudo tee /etc/apt/trusted.gpg.d/ngrok.asc >/dev/null
        echo "deb https://ngrok-agent.s3.amazonaws.com buster main" | sudo tee /etc/apt/sources.list.d/ngrok.list
        sudo apt update && sudo apt install ngrok
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        brew install ngrok/ngrok/ngrok
    else
        echo "Please install ngrok manually from https://ngrok.com/download"
        exit 1
    fi
fi

# Get auth token
if [ -z "$1" ]; then
    echo "Please provide your ngrok auth token:"
    echo "1. Go to https://dashboard.ngrok.com/get-started/your-authtoken"
    echo "2. Copy your authtoken"
    echo "3. Run: $0 YOUR_AUTH_TOKEN"
    exit 1
fi

AUTH_TOKEN=$1

# Create ngrok config
cat > ngrok.yml << EOF
version: "2"
authtoken: $AUTH_TOKEN

tunnels:
  botfersal:
    addr: localhost:8000
    proto: http
    schemes: [https, http]
    inspect: false
    
log_level: info
log_format: term
EOF

echo "✅ Ngrok configuration created!"
echo "🚀 You can now run: ./scripts/build-and-deploy.sh"
