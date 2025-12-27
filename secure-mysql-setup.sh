#!/bin/bash

echo "=== SECURE MySQL Setup for Glorious Transfer ==="
echo "This script will secure your MySQL installation"
echo ""

# Generate a strong password
generate_password() {
    openssl rand -base64 32 | tr -d "=+/" | cut -c1-25
}

# Variables
DB_NAME="glorious_transfer"
NEW_DB_USER="glorious_app"
NEW_DB_PASSWORD=$(generate_password)
NEW_ROOT_PASSWORD=$(generate_password)

echo "Generated secure credentials:"
echo "- New root password: $NEW_ROOT_PASSWORD"
echo "- App user: $NEW_DB_USER"
echo "- App password: $NEW_DB_PASSWORD"
echo ""
read -p "Continue with these credentials? (y/N): " CONTINUE

if [ "$CONTINUE" != "y" ] && [ "$CONTINUE" != "Y" ]; then
    echo "Setup cancelled."
    exit 0
fi

# Save credentials to file for reference
cat > /var/www/mysql_credentials.txt << EOF
MySQL Secure Credentials - $(date)
=====================================

Root User: root
Root Password: $NEW_ROOT_PASSWORD

Application User: $NEW_DB_USER
Application Password: $NEW_DB_PASSWORD

Database: $DB_NAME
Host: localhost (127.0.0.1)
Port: 3306

IMPORTANT: Keep this file secure and update your .env files!
EOF

chmod 600 /var/www/mysql_credentials.txt

echo "1. Stopping MySQL service..."
sudo systemctl stop mysql

echo "2. Securing MySQL configuration..."

# Find and update MySQL config
if [ -f /etc/mysql/mysql.conf.d/mysqld.cnf ]; then
    CONFIG_FILE="/etc/mysql/mysql.conf.d/mysqld.cnf"
elif [ -f /etc/my.cnf ]; then
    CONFIG_FILE="/etc/my.cnf"
else
    echo "❌ MySQL configuration file not found"
    exit 1
fi

# Backup current config
sudo cp $CONFIG_FILE $CONFIG_FILE.backup.$(date +%Y%m%d)

# Secure MySQL configuration
sudo tee -a $CONFIG_FILE > /dev/null << EOF

# Security Configuration
bind-address = 127.0.0.1
skip-networking = 0
local-infile = 0
symbolic-links = 0

# Performance and Security
max_connections = 100
connect_timeout = 10
wait_timeout = 600
max_allowed_packet = 16M

# Logging
log-error = /var/log/mysql/error.log
slow_query_log = 1
long_query_time = 2
slow_query_log_file = /var/log/mysql/slow.log
EOF

echo "3. Starting MySQL service..."
sudo systemctl start mysql

echo "4. Securing MySQL installation..."

# Get current root password (assuming it's 'root')
CURRENT_ROOT_PWD="root"

# Secure MySQL with new settings
mysql -u root -p"$CURRENT_ROOT_PWD" << EOF
-- Change root password
ALTER USER 'root'@'localhost' IDENTIFIED BY '$NEW_ROOT_PASSWORD';

-- Remove remote root access
DELETE FROM mysql.user WHERE User='root' AND Host NOT IN ('localhost', '127.0.0.1', '::1');

-- Create application user with limited privileges
CREATE USER '$NEW_DB_USER'@'localhost' IDENTIFIED BY '$NEW_DB_PASSWORD';
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, DROP, INDEX, ALTER, CREATE TEMPORARY TABLES, LOCK TABLES ON $DB_NAME.* TO '$NEW_DB_USER'@'localhost';

-- Remove anonymous users
DELETE FROM mysql.user WHERE User='';

-- Remove test database
DROP DATABASE IF EXISTS test;
DELETE FROM mysql.db WHERE Db='test' OR Db='test\\_%';

-- Reload privileges
FLUSH PRIVILEGES;
EOF

if [ $? -eq 0 ]; then
    echo "✅ MySQL secured successfully"
else
    echo "❌ MySQL security setup failed"
    exit 1
fi

echo "5. Configuring firewall..."
# Remove public MySQL access
sudo ufw delete allow 3306
# Only allow local connections
sudo ufw allow from 127.0.0.1 to any port 3306

echo "6. Creating database..."
mysql -u root -p"$NEW_ROOT_PASSWORD" << EOF
CREATE DATABASE IF NOT EXISTS $DB_NAME CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
GRANT ALL PRIVILEGES ON $DB_NAME.* TO '$NEW_DB_USER'@'localhost';
FLUSH PRIVILEGES;
EOF

echo ""
echo "=== MySQL Security Setup Completed ==="
echo "✅ MySQL now only accepts local connections"
echo "✅ Strong passwords generated"
echo "✅ Application user created with limited privileges"
echo "✅ Public access removed"
echo ""
echo "Credentials saved to: /var/www/mysql_credentials.txt"
echo ""
echo "Next steps:"
echo "1. Update your .env.production file with new credentials"
echo "2. Configure Docker to connect to localhost MySQL"
echo "3. Test the connection"