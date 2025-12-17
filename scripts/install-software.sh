#!/bin/bash

echo "=== Installing Required Software ==="

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

# Install Docker
echo "Installing Docker..."
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io

# Add user to docker group
sudo usermod -aG docker $USER

# Install Docker Compose
echo "Installing Docker Compose..."
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

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

# Secure MySQL installation
echo "Securing MySQL installation..."
sudo mysql_secure_installation

# Install additional utilities
echo "Installing additional utilities..."
sudo apt install -y certbot python3-certbot-nginx  # For SSL certificates
sudo apt install -y fail2ban  # For security
sudo npm install -g pm2  # For process management (alternative to Docker)

echo "All software installed successfully!"
echo ""
echo "Installed versions:"
echo "- Node.js: $(node --version)"
echo "- NPM: $(npm --version)"
echo "- Docker: $(docker --version)"
echo "- Docker Compose: $(docker-compose --version)"
echo "- Nginx: $(nginx -v 2>&1)"
echo "- MySQL: $(mysql --version)"
echo ""
echo "Next steps:"
echo "1. Log out and log back in to apply Docker group membership"
echo "2. Configure MySQL database"
echo "3. Setup SSL certificates"
echo "4. Deploy your application"
