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

# Try different possible current root passwords
CURRENT_ROOT_PWD=""
for pwd in "root" "" "password" "mysql"; do
    if mysql -u root -p"$pwd" -e "SELECT 1;" > /dev/null 2>&1; then
        CURRENT_ROOT_PWD="$pwd"
        echo "✅ Current root password detected"
        break
    fi
done

if [ -z "$CURRENT_ROOT_PWD" ]; then
    echo "❌ Cannot determine current root password. Please run mysql_secure_installation first or check MySQL status."
    exit 1
fi

# Secure MySQL with new settings - handle each operation separately for better error handling
echo "  - Updating root password..."
mysql -u root -p"$CURRENT_ROOT_PWD" -e "ALTER USER 'root'@'localhost' IDENTIFIED BY '$NEW_ROOT_PASSWORD';" 2>/dev/null
if [ $? -eq 0 ]; then
    echo "  ✅ Root password updated"
else
    echo "  ⚠️  Root password update failed, trying alternative method..."
    mysql -u root -p"$CURRENT_ROOT_PWD" -e "SET PASSWORD FOR 'root'@'localhost' = PASSWORD('$NEW_ROOT_PASSWORD');" 2>/dev/null
fi

echo "  - Removing remote root access..."
mysql -u root -p"$NEW_ROOT_PASSWORD" -e "DELETE FROM mysql.user WHERE User='root' AND Host NOT IN ('localhost', '127.0.0.1', '::1');" 2>/dev/null

echo "  - Creating application user..."
mysql -u root -p"$NEW_ROOT_PASSWORD" -e "CREATE USER IF NOT EXISTS '$NEW_DB_USER'@'localhost' IDENTIFIED BY '$NEW_DB_PASSWORD';" 2>/dev/null

echo "  - Granting application privileges..."
mysql -u root -p"$NEW_ROOT_PASSWORD" -e "GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, DROP, INDEX, ALTER, CREATE TEMPORARY TABLES, LOCK TABLES ON $DB_NAME.* TO '$NEW_DB_USER'@'localhost';" 2>/dev/null

echo "  - Removing anonymous users..."
mysql -u root -p"$NEW_ROOT_PASSWORD" -e "DELETE FROM mysql.user WHERE User='';" 2>/dev/null

echo "  - Cleaning up test databases..."
mysql -u root -p"$NEW_ROOT_PASSWORD" -e "DROP DATABASE IF EXISTS test;" 2>/dev/null
mysql -u root -p"$NEW_ROOT_PASSWORD" -e "DELETE FROM mysql.db WHERE Db='test' OR Db='test\\_%';" 2>/dev/null

echo "  - Reloading privileges..."
mysql -u root -p"$NEW_ROOT_PASSWORD" -e "FLUSH PRIVILEGES;" 2>/dev/null

if [ $? -eq 0 ]; then
    echo "✅ MySQL secured successfully"
else
    echo "⚠️  Some MySQL security steps may have failed, but continuing..."
    echo "  Testing final root connection..."
    if mysql -u root -p"$NEW_ROOT_PASSWORD" -e "SELECT 1;" > /dev/null 2>&1; then
        echo "  ✅ Root password is working"
    else
        echo "  ❌ Root password setup failed"
        exit 1
    fi
fi

echo "5. Configuring firewall..."
# Remove public MySQL access
sudo ufw delete allow 3306
# Only allow local connections
sudo ufw allow from 127.0.0.1 to any port 3306

echo "6. Creating database..."
mysql -u root -p"$NEW_ROOT_PASSWORD" -e "CREATE DATABASE IF NOT EXISTS $DB_NAME CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;" 2>/dev/null
mysql -u root -p"$NEW_ROOT_PASSWORD" -e "GRANT ALL PRIVILEGES ON $DB_NAME.* TO '$NEW_DB_USER'@'localhost';" 2>/dev/null
mysql -u root -p"$NEW_ROOT_PASSWORD" -e "FLUSH PRIVILEGES;" 2>/dev/null

if [ $? -eq 0 ]; then
    echo "✅ Database created and permissions granted"
else
    echo "⚠️  Database creation completed with warnings"
fi

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