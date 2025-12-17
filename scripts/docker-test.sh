#!/bin/bash

echo "=== Testing Docker Installation ==="

# Test Docker daemon
echo "Testing Docker daemon..."
if sudo docker run hello-world; then
    echo "✅ Docker daemon is working with sudo"
else
    echo "❌ Docker daemon test failed"
    exit 1
fi

# Test Docker without sudo (after group membership)
echo "Testing Docker without sudo..."
if docker run hello-world 2>/dev/null; then
    echo "✅ Docker is working without sudo"
else
    echo "⚠️  Docker requires sudo (you may need to log out and back in)"
    echo "Current user groups: $(groups)"
fi

# Test Docker Compose
echo "Testing Docker Compose..."
if docker-compose --version; then
    echo "✅ Docker Compose (standalone) is working"
elif docker compose version; then
    echo "✅ Docker Compose (plugin) is working"
else
    echo "❌ Docker Compose not found"
fi

# Check service status
echo "Docker service status:"
sudo systemctl status docker --no-pager -l

echo ""
echo "If Docker requires sudo, run: newgrp docker"
echo "Or log out and back in to refresh group membership"
