#!/bin/bash

echo "=== Installing Required Software (Fixed Version) ==="

# Update package list
sudo apt update

# Install essential packages
echo "Installing essential packages..."
sudo apt install -y curl wget git vim htop unzip software-properties-common apt-transport-https ca-certificates gnupg lsb-release

# Install Node.js (using NodeSource repository for latest LTS)
echo "Installing Node.js..."
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Verify Node.js installation
echo "Node.js version: $(node --version)"
echo "NPM version: $(npm --version)"

# Remove any existing Docker packages
echo "Removing any existing Docker packages..."
sudo apt remove -y docker docker-engine docker.io containerd runc

# Install Docker - Fixed approach
echo "Installing Docker (fixed method)..."

# Add Docker's official GPG key
sudo mkdir -p /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg

# Set up the repository
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Update apt package index
sudo apt update

# Install Docker Engine
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Add user to docker group
sudo usermod -aG docker $USER

# Install Docker Compose (standalone version as backup)
echo "Installing Docker Compose standalone..."
DOCKER_COMPOSE_VERSION=$(curl -s https://api.github.com/repos/docker/compose/releases/latest | grep 'tag_name' | cut -d\" -f4)
sudo curl -L "https://github.com/docker/compose/releases/download/${DOCKER_COMPOSE_VERSION}/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Create symbolic link for docker compose plugin
sudo ln -sf /usr/local/bin/docker-compose /usr/bin/docker-compose

# Install Nginx
echo "Installing Nginx..."
sudo apt install -y nginx

# Start and enable services
echo "Starting and enabling services..."
sudo systemctl start docker
sudo systemctl enable docker
sudo systemctl start nginx
sudo systemctl enable nginx

# Install MySQL Server
echo "Installing MySQL Server..."
sudo apt install -y mysql-server

# Install additional utilities
echo "Installing additional utilities..."
sudo apt install -y certbot python3-certbot-nginx  # For SSL certificates
sudo apt install -y fail2ban  # For security

# Install PM2 globally
echo "Installing PM2..."
sudo npm install -g pm2

echo ""
echo "=== Installation completed successfully! ==="
echo ""
echo "Installed versions:"
echo "- Node.js: $(node --version)"
echo "- NPM: $(npm --version)"
echo "- Docker: $(docker --version)"
echo "- Docker Compose: $(docker-compose --version || docker compose version)"
echo "- Nginx: $(nginx -v 2>&1)"
echo "- MySQL: $(mysql --version)"
echo ""
echo "IMPORTANT: You need to log out and log back in for Docker group membership to take effect!"
echo ""
echo "Next steps:"
echo "1. Log out: exit"
echo "2. Log back in: ssh user@server"
echo "3. Test Docker: docker run hello-world"
echo "4. Configure MySQL: ./mysql-setup.sh"
echo "5. Deploy your application"
