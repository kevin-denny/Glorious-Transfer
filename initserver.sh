#!/bin/bash

set -e  # Exit on any error

echo "=============================================="
echo "  🚀 GLORIOUS TRANSFER - Server Setup Script"
echo "=============================================="
echo ""
echo "This script will set up your server with:"
echo "- Essential packages and security updates"
echo "- Docker & Docker Compose"
echo "- Nginx web server"
echo "- MySQL database server"
echo "- Security configurations"
echo ""

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if running as root
if [ "$EUID" -eq 0 ]; then
    log_warning "Running as root. Some operations will be performed directly."
    SUDO=""
else
    log_info "Running as non-root user. Will use sudo for privileged operations."
    SUDO="sudo"
fi

# Get user inputs
echo ""
echo "📝 Configuration Setup"
echo "====================="

# Check current user
CURRENT_USER=$(whoami)
if [ "$CURRENT_USER" = "root" ]; then
    echo "Current user: root"
    read -p "Do you want to create a new non-root user? (recommended) [y/N]: " CREATE_USER
    if [ "$CREATE_USER" = "y" ] || [ "$CREATE_USER" = "Y" ]; then
        read -p "Enter new username: " NEW_USERNAME
        while [ -z "$NEW_USERNAME" ]; do
            read -p "Username cannot be empty. Enter new username: " NEW_USERNAME
        done
        
        read -s -p "Enter password for $NEW_USERNAME: " NEW_USER_PASSWORD
        echo ""
        read -s -p "Confirm password: " NEW_USER_PASSWORD_CONFIRM
        echo ""
        
        if [ "$NEW_USER_PASSWORD" != "$NEW_USER_PASSWORD_CONFIRM" ]; then
            log_error "Passwords don't match. Exiting."
            exit 1
        fi
        
        USE_EXISTING_USER=false
    else
        USE_EXISTING_USER=true
        NEW_USERNAME="root"
    fi
else
    echo "Current user: $CURRENT_USER"
    read -p "Use current user ($CURRENT_USER) for Docker setup? [Y/n]: " USE_CURRENT
    if [ "$USE_CURRENT" = "n" ] || [ "$USE_CURRENT" = "N" ]; then
        read -p "Enter username to use: " NEW_USERNAME
        USE_EXISTING_USER=true
    else
        NEW_USERNAME="$CURRENT_USER"
        USE_EXISTING_USER=true
    fi
fi

# MySQL Configuration
echo ""
echo "🗄️  MySQL Configuration"
echo "======================"
read -p "Set custom MySQL root password? [Y/n]: " SET_MYSQL_ROOT
if [ "$SET_MYSQL_ROOT" != "n" ] && [ "$SET_MYSQL_ROOT" != "N" ]; then
    read -s -p "Enter MySQL root password: " MYSQL_ROOT_PASSWORD
    echo ""
    read -s -p "Confirm MySQL root password: " MYSQL_ROOT_PASSWORD_CONFIRM
    echo ""
    
    if [ "$MYSQL_ROOT_PASSWORD" != "$MYSQL_ROOT_PASSWORD_CONFIRM" ]; then
        log_error "MySQL passwords don't match. Exiting."
        exit 1
    fi
else
    # Generate random password
    MYSQL_ROOT_PASSWORD=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-25)
    log_info "Auto-generated MySQL root password"
fi

# Application database setup
echo ""
read -p "Create application database and user? [Y/n]: " CREATE_APP_DB
if [ "$CREATE_APP_DB" != "n" ] && [ "$CREATE_APP_DB" != "N" ]; then
    read -p "Database name [glorious_transfer]: " DB_NAME
    DB_NAME=${DB_NAME:-glorious_transfer}
    
    read -p "Database username [glorious_app]: " DB_USER
    DB_USER=${DB_USER:-glorious_app}
    
    DB_PASSWORD=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-25)
    log_info "Auto-generated database password for $DB_USER"
fi

echo ""
read -p "Continue with server setup? [Y/n]: " CONTINUE_SETUP
if [ "$CONTINUE_SETUP" = "n" ] || [ "$CONTINUE_SETUP" = "N" ]; then
    log_info "Setup cancelled by user."
    exit 0
fi

echo ""
log_info "Starting server initialization..."

# 1. Update package list
log_info "Updating package list..."
$SUDO apt update

# 2. Install essential packages
log_info "Installing essential packages..."
$SUDO apt install -y \
    curl \
    wget \
    git \
    unzip \
    software-properties-common \
    apt-transport-https \
    ca-certificates \
    gnupg \
    lsb-release \
    ufw \
    fail2ban \
    htop \
    nano \
    openssl

log_success "Essential packages installed"

# 3. Create new user if requested
if [ "$USE_EXISTING_USER" = false ]; then
    log_info "Creating new user: $NEW_USERNAME"
    $SUDO adduser --gecos "" --disabled-password $NEW_USERNAME
    echo "$NEW_USERNAME:$NEW_USER_PASSWORD" | $SUDO chpasswd
    $SUDO usermod -aG sudo $NEW_USERNAME
    log_success "User $NEW_USERNAME created and added to sudo group"
fi

# 4. Install Docker
log_info "Installing Docker..."
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | $SUDO gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg
echo "deb [arch=amd64 signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | $SUDO tee /etc/apt/sources.list.d/docker.list > /dev/null
$SUDO apt update
$SUDO apt install -y docker-ce docker-ce-cli containerd.io

log_success "Docker installed"

# 5. Add user to docker group
log_info "Adding $NEW_USERNAME to docker group..."
$SUDO usermod -aG docker $NEW_USERNAME
log_success "User added to docker group"

# 6. Install Docker Compose
log_info "Installing Docker Compose..."
DOCKER_COMPOSE_VERSION=$(curl -s https://api.github.com/repos/docker/compose/releases/latest | grep 'tag_name' | cut -d\" -f4)
$SUDO curl -L "https://github.com/docker/compose/releases/download/${DOCKER_COMPOSE_VERSION}/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
$SUDO chmod +x /usr/local/bin/docker-compose

log_success "Docker Compose installed (version: $DOCKER_COMPOSE_VERSION)"

# 7. Install Nginx
log_info "Installing Nginx..."
$SUDO apt install -y nginx

# Create basic security configuration for Nginx
$SUDO tee /etc/nginx/conf.d/security.conf > /dev/null << 'EOF'
# Security headers
add_header X-Frame-Options "SAMEORIGIN" always;
add_header X-XSS-Protection "1; mode=block" always;
add_header X-Content-Type-Options "nosniff" always;
add_header Referrer-Policy "no-referrer-when-downgrade" always;
add_header Content-Security-Policy "default-src 'self' http: https: data: blob: 'unsafe-inline'" always;

# Hide Nginx version
server_tokens off;

# Gzip compression
gzip on;
gzip_vary on;
gzip_min_length 1024;
gzip_proxied expired no-cache no-store private auth;
gzip_types text/plain text/css text/xml text/javascript application/javascript application/xml+rss application/json;
EOF

log_success "Nginx installed with security configuration"

# 8. Install MySQL Server
log_info "Installing MySQL Server..."
export DEBIAN_FRONTEND=noninteractive
$SUDO apt install -y mysql-server

log_success "MySQL Server installed"

# 9. Start and enable services
log_info "Starting and enabling services..."
$SUDO systemctl start docker
$SUDO systemctl enable docker
$SUDO systemctl start nginx
$SUDO systemctl enable nginx
$SUDO systemctl start mysql
$SUDO systemctl enable mysql

log_success "Services started and enabled"

# 10. Configure firewall
log_info "Configuring UFW firewall..."
$SUDO ufw --force enable
$SUDO ufw default deny incoming
$SUDO ufw default allow outgoing
$SUDO ufw allow ssh
$SUDO ufw allow 'Nginx Full'
$SUDO ufw allow from 127.0.0.1 to any port 3306  # MySQL local only

log_success "Firewall configured"

# 11. Configure fail2ban
log_info "Configuring fail2ban..."
$SUDO systemctl enable fail2ban
$SUDO systemctl start fail2ban

# 12. Secure MySQL installation
log_info "Securing MySQL installation..."

# Set root password
$SUDO mysql -e "ALTER USER 'root'@'localhost' IDENTIFIED WITH mysql_native_password BY '$MYSQL_ROOT_PASSWORD';"

# Remove anonymous users
$SUDO mysql -u root -p"$MYSQL_ROOT_PASSWORD" -e "DELETE FROM mysql.user WHERE User='';"

# Remove remote root login
$SUDO mysql -u root -p"$MYSQL_ROOT_PASSWORD" -e "DELETE FROM mysql.user WHERE User='root' AND Host NOT IN ('localhost', '127.0.0.1', '::1');"

# Drop test database
$SUDO mysql -u root -p"$MYSQL_ROOT_PASSWORD" -e "DROP DATABASE IF EXISTS test;"
$SUDO mysql -u root -p"$MYSQL_ROOT_PASSWORD" -e "DELETE FROM mysql.db WHERE Db='test' OR Db='test\\_%';"

# Reload privileges
$SUDO mysql -u root -p"$MYSQL_ROOT_PASSWORD" -e "FLUSH PRIVILEGES;"

log_success "MySQL secured"

# 13. Create application database and user
if [ "$CREATE_APP_DB" != "n" ] && [ "$CREATE_APP_DB" != "N" ]; then
    log_info "Creating application database and user..."
    
    $SUDO mysql -u root -p"$MYSQL_ROOT_PASSWORD" -e "CREATE DATABASE IF NOT EXISTS $DB_NAME CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
    $SUDO mysql -u root -p"$MYSQL_ROOT_PASSWORD" -e "CREATE USER IF NOT EXISTS '$DB_USER'@'localhost' IDENTIFIED BY '$DB_PASSWORD';"
    $SUDO mysql -u root -p"$MYSQL_ROOT_PASSWORD" -e "GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, DROP, INDEX, ALTER, CREATE TEMPORARY TABLES, LOCK TABLES ON $DB_NAME.* TO '$DB_USER'@'localhost';"
    $SUDO mysql -u root -p"$MYSQL_ROOT_PASSWORD" -e "FLUSH PRIVILEGES;"
    
    log_success "Application database and user created"
fi

# 14. Save credentials
log_info "Saving credentials..."
CREDENTIALS_FILE="/var/server_credentials.txt"
$SUDO tee $CREDENTIALS_FILE > /dev/null << EOF
🚀 GLORIOUS TRANSFER - Server Credentials
Generated on: $(date)
==========================================

System User: $NEW_USERNAME
$([ "$USE_EXISTING_USER" = false ] && echo "User Password: $NEW_USER_PASSWORD")

MySQL Root User: root
MySQL Root Password: $MYSQL_ROOT_PASSWORD

$([ "$CREATE_APP_DB" != "n" ] && [ "$CREATE_APP_DB" != "N" ] && cat << DBINFO
Application Database: $DB_NAME
Database User: $DB_USER
Database Password: $DB_PASSWORD
Database Host: localhost
Database Port: 3306
DBINFO
)

Services Status:
- Docker: $(systemctl is-active docker)
- Nginx: $(systemctl is-active nginx)
- MySQL: $(systemctl is-active mysql)
- UFW: $(ufw status | head -1)
- Fail2ban: $(systemctl is-active fail2ban)

Important Notes:
- MySQL only accepts local connections (127.0.0.1)
- Firewall is enabled with SSH and HTTP/HTTPS access
- Docker is configured for user: $NEW_USERNAME
- All services are set to start automatically

Next Steps:
1. Logout and login again to apply docker group changes
2. Test Docker: docker run hello-world
3. Configure your application
4. Set up SSL certificates (Let's Encrypt recommended)

⚠️  SECURITY: Keep this file secure and delete it after noting the credentials!
EOF

$SUDO chmod 600 $CREDENTIALS_FILE

echo ""
echo "=============================================="
log_success "🎉 SERVER SETUP COMPLETED SUCCESSFULLY!"
echo "=============================================="
echo ""
echo "📋 Summary:"
echo "  ✅ System packages updated and installed"
echo "  ✅ Docker and Docker Compose installed"
echo "  ✅ Nginx web server configured"
echo "  ✅ MySQL database server secured"
echo "  ✅ Firewall and fail2ban configured"
echo "  ✅ User permissions set up"
echo ""
echo "📁 Credentials saved to: $CREDENTIALS_FILE"
echo ""
echo "🔄 Required Actions:"
echo "  1. Logout and login again (or run: newgrp docker)"
echo "  2. Test Docker: docker run hello-world"
echo "  3. View credentials: sudo cat $CREDENTIALS_FILE"
echo ""
echo "🚀 Your server is ready for Glorious Transfer deployment!"
echo ""

# Test Docker installation
if [ "$NEW_USERNAME" != "root" ]; then
    echo "💡 To test Docker immediately, run:"
    echo "   sudo -u $NEW_USERNAME docker run hello-world"
fi

log_warning "Remember to delete $CREDENTIALS_FILE after noting the credentials!"

# 15. Set up cronjobs
log_info "Setting up automated tasks (cronjobs)..."

# Create backup directory
$SUDO mkdir -p /var/www/backups
$SUDO chown $NEW_USERNAME:$NEW_USERNAME /var/www/backups

# Create application directory structure
$SUDO mkdir -p /var/www/Glorious-Transfer
$SUDO chown $NEW_USERNAME:$NEW_USERNAME /var/www/Glorious-Transfer

# Add cronjobs to the user's crontab
TEMP_CRON="/tmp/glorious_crontab"

# Get existing crontab (if any) and add new jobs
(crontab -u $NEW_USERNAME -l 2>/dev/null || echo "") > $TEMP_CRON

# Add SSL certificate renewal (daily at 12:00 PM)
echo "0 12 * * * /usr/bin/certbot renew --quiet && /usr/bin/docker-compose -f /var/www/Glorious-Transfer/docker-compose.yml restart nginx" >> $TEMP_CRON

# Add database backup (daily at 11:30 PM)  
echo "30 23 * * * /bin/bash /var/www/Glorious-Transfer/backup_db_secure.sh >> /var/www/backups/backup_cron.log 2>&1" >> $TEMP_CRON

# Install the new crontab
$SUDO crontab -u $NEW_USERNAME $TEMP_CRON
rm $TEMP_CRON

# Install certbot for SSL
log_info "Installing Certbot for SSL certificates..."
$SUDO apt install -y certbot python3-certbot-nginx

log_success "Cronjobs configured:"
log_info "  - SSL renewal: Daily at 12:00 PM"
log_info "  - DB backup: Daily at 11:30 PM"
log_info "  - Certbot installed for SSL setup"

echo ""
echo "=============================================="
log_success "🎉 SERVER SETUP COMPLETED SUCCESSFULLY!"
echo "=============================================="
echo ""
echo "📋 Summary:"
echo "  ✅ System packages updated and installed"
echo "  ✅ Docker and Docker Compose installed"
echo "  ✅ Nginx web server configured"
echo "  ✅ MySQL database server secured"
echo "  ✅ Firewall and fail2ban configured"
echo "  ✅ User permissions set up"
echo "  ✅ SSL renewal cronjob configured"
echo "  ✅ Database backup cronjob configured"
echo ""
echo "📁 Credentials saved to: $CREDENTIALS_FILE"
echo ""
echo "🔄 Required Actions:"
echo "  1. Logout and login again (or run: newgrp docker)"
echo "  2. Test Docker: docker run hello-world"
echo "  3. View credentials: sudo cat $CREDENTIALS_FILE"
echo "  4. Deploy your application to /var/www/Glorious-Transfer/"
echo "  5. Set up SSL: sudo certbot --nginx -d yourdomain.com"
echo ""
echo "🚀 Your server is ready for Glorious Transfer deployment!"
echo ""

# Test Docker installation
if [ "$NEW_USERNAME" != "root" ]; then
    echo "💡 To test Docker immediately, run:"
    echo "   sudo -u $NEW_USERNAME docker run hello-world"
fi

echo ""
echo "📅 Scheduled Tasks:"
echo "  - SSL Certificate Renewal: Daily at 12:00 PM"
echo "  - Database Backup: Daily at 11:30 PM"
echo "  - Logs: /var/www/backups/backup_cron.log"
echo ""

log_warning "Remember to delete $CREDENTIALS_FILE after noting the credentials!"
log_warning "Create backup_db_secure.sh script before the first backup runs!"
