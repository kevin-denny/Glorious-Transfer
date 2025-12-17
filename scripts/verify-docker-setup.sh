#!/bin/bash

echo "=== Docker Setup Verification ==="

# Check Docker installation
echo "1. Checking Docker installation..."
if command -v docker &> /dev/null; then
    echo "✅ Docker is installed: $(docker --version)"
else
    echo "❌ Docker is not installed"
    exit 1
fi

# Check Docker service
echo "2. Checking Docker service..."
if sudo systemctl is-active --quiet docker; then
    echo "✅ Docker service is running"
else
    echo "❌ Docker service is not running"
    echo "Starting Docker service..."
    sudo systemctl start docker
    sudo systemctl enable docker
fi

# Check Docker daemon
echo "3. Testing Docker daemon..."
if sudo docker run --rm hello-world &> /dev/null; then
    echo "✅ Docker daemon is working"
else
    echo "❌ Docker daemon test failed"
fi

# Check user permissions
echo "4. Checking Docker user permissions..."
if docker run --rm hello-world &> /dev/null; then
    echo "✅ Docker works without sudo"
else
    echo "⚠️ Docker requires sudo - checking group membership..."
    if groups $USER | grep -q docker; then
        echo "✅ User is in docker group (may need to log out/in)"
    else
        echo "❌ User is not in docker group, adding..."
        sudo usermod -aG docker $USER
        echo "✅ Added to docker group - please log out and back in"
    fi
fi

# Check Docker Compose
echo "5. Checking Docker Compose..."
COMPOSE_WORKING=false

# Test Docker Compose Plugin
if docker compose version &> /dev/null; then
    echo "✅ Docker Compose Plugin: $(docker compose version)"
    COMPOSE_WORKING=true
fi

# Test standalone Docker Compose
if docker-compose --version &> /dev/null; then
    echo "✅ Docker Compose Standalone: $(docker-compose --version)"
    COMPOSE_WORKING=true
fi

if [ "$COMPOSE_WORKING" = false ]; then
    echo "❌ Docker Compose is not installed or not working"
    echo "Run: ./scripts/docker-compose-install.sh"
fi

# Final test with a simple compose file
echo "6. Testing Docker Compose functionality..."
cat > /tmp/test-compose.yml << EOF
version: '3'
services:
  test:
    image: hello-world
EOF

if docker compose -f /tmp/test-compose.yml up --remove-orphans &> /dev/null || docker-compose -f /tmp/test-compose.yml up --remove-orphans &> /dev/null; then
    echo "✅ Docker Compose functionality test passed"
else
    echo "❌ Docker Compose functionality test failed"
fi

# Clean up
rm -f /tmp/test-compose.yml
docker system prune -f &> /dev/null

echo ""
echo "=== Verification Summary ==="
echo "Docker: $(docker --version 2>/dev/null || echo 'Not installed')"
echo "Docker Compose Plugin: $(docker compose version 2>/dev/null || echo 'Not available')"
echo "Docker Compose Standalone: $(docker-compose --version 2>/dev/null || echo 'Not available')"
echo ""
if [ "$COMPOSE_WORKING" = true ]; then
    echo "✅ Setup is ready for deployment!"
else
    echo "❌ Setup needs attention - run docker-compose-install.sh"
fi
