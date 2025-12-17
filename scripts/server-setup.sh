#!/bin/bash

echo "=== Digital Ocean Droplet Initial Setup ==="

# Update system packages
echo "Updating system packages..."
sudo apt update && sudo apt upgrade -y

# Create a new user (replace 'deploy' with your preferred username)
echo "Creating deploy user..."
read -p "Enter username for deployment (default: deploy): " username
username=${username:-deploy}

sudo adduser $username
sudo usermod -aG sudo $username

# Setup SSH key authentication for new user
echo "Setting up SSH keys for $username..."
sudo mkdir -p /home/$username/.ssh
sudo cp ~/.ssh/authorized_keys /home/$username/.ssh/
sudo chown -R $username:$username /home/$username/.ssh
sudo chmod 700 /home/$username/.ssh
sudo chmod 600 /home/$username/.ssh/authorized_keys

# Configure firewall
echo "Configuring UFW firewall..."
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow 80
sudo ufw allow 443
sudo ufw --force enable

# Disable password authentication (optional but recommended)
echo "Configuring SSH security..."
sudo sed -i 's/#PasswordAuthentication yes/PasswordAuthentication no/' /etc/ssh/sshd_config
sudo sed -i 's/#PubkeyAuthentication yes/PubkeyAuthentication yes/' /etc/ssh/sshd_config
sudo systemctl restart ssh

echo "Initial server setup completed!"
echo "Please log out and log back in as user: $username"
