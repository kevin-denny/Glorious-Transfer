#!/bin/bash

echo "=== Fixing Docker Permissions ==="

# Add user to docker group
echo "Adding $USER to docker group..."
sudo usermod -aG docker $USER

# Apply group changes without logout
echo "Applying group changes..."
newgrp docker << EOF
echo "Testing Docker without sudo..."
if docker run --rm hello-world; then
    echo "✅ Docker is now working without sudo!"
else
    echo "❌ Still having issues. You may need to:"
    echo "1. Log out completely: exit"
    echo "2. Log back in via SSH"
    echo "3. Test again: docker run hello-world"
fi
EOF

echo ""
echo "If the test above failed, please:"
echo "1. Log out: exit"
echo "2. Log back in: ssh user@server"
echo "3. Test Docker: docker run hello-world"
