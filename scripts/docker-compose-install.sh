#!/bin/bash

echo "=== Docker Compose Installation Script ==="

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    exit 1
fi

# Function to get latest Docker Compose version
get_latest_version() {
    curl -s https://api.github.com/repos/docker/compose/releases/latest | grep '"tag_name"' | sed -E 's/.*"([^"]+)".*/\1/'
}

# Method 1: Try Docker Compose Plugin (recommended for newer Docker installations)
echo "Method 1: Checking Docker Compose Plugin..."
if docker compose version &> /dev/null; then
    echo "✅ Docker Compose Plugin is already installed and working"
    docker compose version
    exit 0
fi

# Method 2: Install Docker Compose Plugin
echo "Method 2: Installing Docker Compose Plugin..."
sudo apt update
if sudo apt install -y docker-compose-plugin; then
    echo "✅ Docker Compose Plugin installed successfully"
    docker compose version
    exit 0
else
    echo "⚠️ Docker Compose Plugin installation failed, trying standalone version..."
fi

# Method 3: Install standalone Docker Compose
echo "Method 3: Installing standalone Docker Compose..."

# Get latest version
COMPOSE_VERSION=$(get_latest_version)
if [ -z "$COMPOSE_VERSION" ]; then
    echo "Failed to get latest version, using fallback version v2.23.0"
    COMPOSE_VERSION="v2.23.0"
fi

echo "Installing Docker Compose $COMPOSE_VERSION..."

# Download and install
sudo curl -L "https://github.com/docker/compose/releases/download/${COMPOSE_VERSION}/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose

# Make it executable
sudo chmod +x /usr/local/bin/docker-compose

# Create symlink for easier access
sudo ln -sf /usr/local/bin/docker-compose /usr/bin/docker-compose

# Test standalone installation
if /usr/local/bin/docker-compose --version &> /dev/null; then
    echo "✅ Standalone Docker Compose installed successfully"
    /usr/local/bin/docker-compose --version
    docker-compose --version
    exit 0
fi

# Method 4: Install via pip (Python package manager)
echo "Method 4: Installing Docker Compose via pip..."
sudo apt install -y python3-pip
sudo pip3 install docker-compose

if docker-compose --version &> /dev/null; then
    echo "✅ Docker Compose installed via pip successfully"
    docker-compose --version
    exit 0
fi

# Method 5: Install from Ubuntu repository (older version but stable)
echo "Method 5: Installing Docker Compose from Ubuntu repository..."
sudo apt install -y docker-compose

if docker-compose --version &> /dev/null; then
    echo "✅ Docker Compose installed from repository successfully"
    docker-compose --version
    exit 0
fi

echo "❌ All installation methods failed. Please check your system and try manual installation."
exit 1
