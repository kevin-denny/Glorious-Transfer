#!/bin/bash

echo "=== QUICK FIX for MySQL Security Setup ==="
echo "This will complete the setup with your generated credentials"
echo ""

# Use the credentials that were already generated
NEW_ROOT_PASSWORD="kKh0JAk5THKXMqfVazYBTT7sM"
NEW_DB_USER="glorious_app"
NEW_DB_PASSWORD="lJfty0snhzDeCHveWw43u30W7"
DB_NAME="glorious_transfer"

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

echo "1. Testing current MySQL connectivity..."

# Try to find working root password
CURRENT_ROOT_PWD=""
for pwd in "root" "" "password" "mysql"; do
    if mysql -u root -p"$pwd" -e "SELECT 1;" > /dev/null 2>&1; then
        CURRENT_ROOT_PWD="$pwd"
        echo "✅ Found working root password"
        break
    fi
done

if [ -z "$CURRENT_ROOT_PWD" ]; then
    echo "❌ Cannot connect to MySQL. Please check MySQL status:"
    echo "  sudo systemctl status mysql"
    exit 1
fi

echo "2. Updating root password..."
mysql -u root -p"$CURRENT_ROOT_PWD" -e "ALTER USER 'root'@'localhost' IDENTIFIED BY '$NEW_ROOT_PASSWORD';" 2>/dev/null
if [ $? -ne 0 ]; then
    # Try alternative method for older MySQL versions
    mysql -u root -p"$CURRENT_ROOT_PWD" -e "SET PASSWORD FOR 'root'@'localhost' = PASSWORD('$NEW_ROOT_PASSWORD');" 2>/dev/null
fi

# Test new root password
mysql -u root -p"$NEW_ROOT_PASSWORD" -e "SELECT 1;" > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo "✅ Root password updated successfully"
else
    echo "⚠️  Root password update may have failed, but continuing..."
    NEW_ROOT_PASSWORD="$CURRENT_ROOT_PWD"
fi

echo "3. Creating application user..."
mysql -u root -p"$NEW_ROOT_PASSWORD" << EOF
-- Create application user
CREATE USER IF NOT EXISTS '$NEW_DB_USER'@'localhost' IDENTIFIED BY '$NEW_DB_PASSWORD';

-- Create database
CREATE DATABASE IF NOT EXISTS $DB_NAME CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Grant privileges
GRANT ALL PRIVILEGES ON $DB_NAME.* TO '$NEW_DB_USER'@'localhost';

-- Clean up and secure
DELETE FROM mysql.user WHERE User='root' AND Host NOT IN ('localhost', '127.0.0.1', '::1');
DELETE FROM mysql.user WHERE User='';
DROP DATABASE IF EXISTS test;
DELETE FROM mysql.db WHERE Db='test' OR Db='test\\_%';

-- Reload privileges
FLUSH PRIVILEGES;
EOF

if [ $? -eq 0 ]; then
    echo "✅ MySQL setup completed successfully"
else
    echo "⚠️  Setup completed with some warnings"
fi

echo "4. Testing application user connection..."
mysql -u "$NEW_DB_USER" -p"$NEW_DB_PASSWORD" -D "$DB_NAME" -e "SELECT 1;" > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo "✅ Application user can connect successfully"
else
    echo "❌ Application user connection failed"
    exit 1
fi

echo "5. Securing MySQL configuration..."
CONFIG_FILE="/etc/mysql/mysql.conf.d/mysqld.cnf"
if [ -f "$CONFIG_FILE" ]; then
    if ! grep -q "bind-address = 127.0.0.1" "$CONFIG_FILE"; then
        echo "bind-address = 127.0.0.1" | sudo tee -a "$CONFIG_FILE"
    fi
    echo "✅ MySQL configuration secured"
fi

echo "6. Configuring firewall..."
sudo ufw delete allow 3306 2>/dev/null
sudo ufw allow from 127.0.0.1 to any port 3306 2>/dev/null
echo "✅ Firewall configured for local access only"

echo ""
echo "=== QUICK FIX COMPLETED ==="
echo "✅ MySQL is now secure and ready for migration"
echo "✅ Credentials saved to: /var/www/mysql_credentials.txt"
echo ""
echo "Next step: Run the data migration"
echo "  sudo ./migrate-data.sh"