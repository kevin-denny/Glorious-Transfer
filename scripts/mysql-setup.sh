#!/bin/bash

echo "=== MySQL Database Setup ==="

# Start MySQL service
sudo systemctl start mysql
sudo systemctl enable mysql

echo "Setting up MySQL database for your application..."

# Prompt for database details
read -p "Enter database name: " db_name
read -p "Enter database username: " db_user
read -s -p "Enter database password: " db_password
echo ""
read -p "Allow remote connections? (y/n): " allow_remote

# Create database and user
mysql -u root -p <<EOF
CREATE DATABASE IF NOT EXISTS $db_name;
CREATE USER IF NOT EXISTS '$db_user'@'localhost' IDENTIFIED BY '$db_password';
GRANT ALL PRIVILEGES ON $db_name.* TO '$db_user'@'localhost';
EOF

if [ "$allow_remote" = "y" ] || [ "$allow_remote" = "Y" ]; then
    echo "Configuring MySQL for remote connections..."
    
    # Create user for remote access
    mysql -u root -p <<EOF
CREATE USER IF NOT EXISTS '$db_user'@'%' IDENTIFIED BY '$db_password';
GRANT ALL PRIVILEGES ON $db_name.* TO '$db_user'@'%';
FLUSH PRIVILEGES;
EOF

    # Configure MySQL to accept remote connections
    sudo sed -i 's/bind-address.*127.0.0.1/bind-address = 0.0.0.0/' /etc/mysql/mysql.conf.d/mysqld.cnf
    
    # Add firewall rule for MySQL (port 3306)
    sudo ufw allow 3306
    
    # Restart MySQL
    sudo systemctl restart mysql
    
    echo "MySQL configured for remote connections."
    echo "Database URL: mysql://$db_user:$db_password@$(curl -s ifconfig.me):3306/$db_name"
else
    echo "MySQL configured for local connections only."
    echo "Database URL: mysql://$db_user:$db_password@localhost:3306/$db_name"
fi

echo ""
echo "Database setup completed!"
echo "Database: $db_name"
echo "Username: $db_user"
echo "Don't forget to update your .env.production file with the DATABASE_URL"
