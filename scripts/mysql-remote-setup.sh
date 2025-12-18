#!/bin/bash

echo "=== MySQL Remote Access Configuration ==="
echo "Run this script on the MySQL server (159.223.52.48)"
echo ""

# Check if MySQL is installed
if ! command -v mysql &> /dev/null; then
    echo "❌ MySQL is not installed on this server"
    exit 1
fi

# Check MySQL service status
echo "1. Checking MySQL service status..."
if systemctl is-active --quiet mysql || systemctl is-active --quiet mysqld; then
    echo "✅ MySQL service is running"
else
    echo "❌ MySQL service is not running"
    echo "Starting MySQL service..."
    sudo systemctl start mysql || sudo systemctl start mysqld
fi

# Check current MySQL configuration
echo ""
echo "2. Checking current MySQL bind-address..."
BIND_ADDRESS=$(sudo grep -E "^bind-address" /etc/mysql/mysql.conf.d/mysqld.cnf 2>/dev/null || sudo grep -E "^bind-address" /etc/my.cnf 2>/dev/null)
echo "Current bind-address: $BIND_ADDRESS"

# Configure MySQL for remote connections
echo ""
echo "3. Configuring MySQL for remote connections..."

# Find MySQL config file
if [ -f /etc/mysql/mysql.conf.d/mysqld.cnf ]; then
    CONFIG_FILE="/etc/mysql/mysql.conf.d/mysqld.cnf"
elif [ -f /etc/my.cnf ]; then
    CONFIG_FILE="/etc/my.cnf"
else
    echo "❌ MySQL configuration file not found"
    exit 1
fi

echo "Using config file: $CONFIG_FILE"

# Backup config file
sudo cp $CONFIG_FILE $CONFIG_FILE.backup

# Update bind-address to allow remote connections
sudo sed -i 's/^bind-address.*/bind-address = 0.0.0.0/' $CONFIG_FILE

# If bind-address doesn't exist, add it
if ! grep -q "bind-address" $CONFIG_FILE; then
    sudo bash -c "echo 'bind-address = 0.0.0.0' >> $CONFIG_FILE"
fi

echo "✅ Updated bind-address to 0.0.0.0"

# Configure firewall
echo ""
echo "4. Configuring firewall for MySQL (port 3306)..."
if command -v ufw &> /dev/null; then
    sudo ufw allow 3306
    echo "✅ UFW rule added for port 3306"
elif command -v firewall-cmd &> /dev/null; then
    sudo firewall-cmd --permanent --add-port=3306/tcp
    sudo firewall-cmd --reload
    echo "✅ Firewall rule added for port 3306"
else
    echo "⚠️ No known firewall detected. Please manually open port 3306"
fi

# Create database and user
echo ""
echo "5. Setting up database and user..."
read -s -p "Enter MySQL root password: " MYSQL_ROOT_PASSWORD
echo ""

DB_NAME="glorious_transfer"
DB_USER="root"
CLIENT_IP="167.172.232.215"  # Your application server IP

mysql -u root -p"$MYSQL_ROOT_PASSWORD" << EOF
-- Create database if it doesn't exist
CREATE DATABASE IF NOT EXISTS $DB_NAME;

-- Grant privileges to root user from specific IP
GRANT ALL PRIVILEGES ON *.* TO 'root'@'$CLIENT_IP' IDENTIFIED BY 'root';

-- Grant privileges to root user from any IP (less secure but simpler)
GRANT ALL PRIVILEGES ON *.* TO 'root'@'%' IDENTIFIED BY 'root';

-- Grant specific privileges to database
GRANT ALL PRIVILEGES ON $DB_NAME.* TO 'root'@'%';
GRANT ALL PRIVILEGES ON $DB_NAME.* TO 'root'@'$CLIENT_IP';

-- Flush privileges
FLUSH PRIVILEGES;

-- Show current users
SELECT User, Host FROM mysql.user WHERE User = 'root';
EOF

if [ $? -eq 0 ]; then
    echo "✅ Database and user configured successfully"
else
    echo "❌ Database configuration failed"
    exit 1
fi

# Restart MySQL service
echo ""
echo "6. Restarting MySQL service..."
sudo systemctl restart mysql || sudo systemctl restart mysqld

if [ $? -eq 0 ]; then
    echo "✅ MySQL service restarted successfully"
else
    echo "❌ Failed to restart MySQL service"
    exit 1
fi

# Test local connection
echo ""
echo "7. Testing local MySQL connection..."
if mysql -u root -p"root" -e "SELECT 1;" 2>/dev/null; then
    echo "✅ Local MySQL connection successful"
else
    echo "❌ Local MySQL connection failed"
fi

echo ""
echo "=== MySQL Remote Setup Completed ==="
echo "Database: $DB_NAME"
echo "User: root (with password 'root')"
echo "Accessible from: $CLIENT_IP and any IP (%)"
echo "Port: 3306"
echo ""
echo "Test the connection from your application server with:"
echo "mysql -h 159.223.52.48 -P 3306 -u root -proot -e 'SELECT 1;'"
