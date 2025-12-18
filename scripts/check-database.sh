#!/bin/bash

echo "=== Database Connection Check ==="

# Database configuration from your .env
DB_HOST="159.223.52.48"
DB_USER="root"
DB_PASSWORD="root"
DB_NAME="glorious_transfer"
DB_PORT="3306"

echo "Testing connection to MySQL database..."
echo "Host: $DB_HOST"
echo "Port: $DB_PORT"
echo "Database: $DB_NAME"
echo "User: $DB_USER"
echo ""

# Test 1: Check if MySQL port is reachable
echo "1. Testing network connectivity to MySQL port..."
if timeout 10 bash -c "</dev/tcp/$DB_HOST/$DB_PORT"; then
    echo "✅ Port $DB_PORT is reachable on $DB_HOST"
else
    echo "❌ Cannot reach port $DB_PORT on $DB_HOST"
    echo "Possible issues:"
    echo "   - MySQL server is not running"
    echo "   - Firewall blocking port $DB_PORT"
    echo "   - Incorrect IP address"
    exit 1
fi

# Test 2: Test MySQL connection
echo ""
echo "2. Testing MySQL authentication..."
if mysql -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" -p"$DB_PASSWORD" -e "SELECT 1;" 2>/dev/null; then
    echo "✅ MySQL connection successful"
else
    echo "❌ MySQL connection failed"
    echo "Possible issues:"
    echo "   - Incorrect username/password"
    echo "   - User doesn't have remote access permissions"
    echo "   - MySQL not configured for remote connections"
    
    # Try to get more detailed error
    echo ""
    echo "Detailed error output:"
    mysql -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" -p"$DB_PASSWORD" -e "SELECT 1;" 2>&1
    exit 1
fi

# Test 3: Check if database exists
echo ""
echo "3. Checking if database '$DB_NAME' exists..."
if mysql -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" -p"$DB_PASSWORD" -e "USE $DB_NAME; SELECT 1;" 2>/dev/null; then
    echo "✅ Database '$DB_NAME' exists and is accessible"
else
    echo "❌ Database '$DB_NAME' does not exist or is not accessible"
    echo ""
    echo "Available databases:"
    mysql -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" -p"$DB_PASSWORD" -e "SHOW DATABASES;" 2>/dev/null
    
    read -p "Do you want to create the database '$DB_NAME'? (y/n): " create_db
    if [ "$create_db" = "y" ] || [ "$create_db" = "Y" ]; then
        mysql -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" -p"$DB_PASSWORD" -e "CREATE DATABASE IF NOT EXISTS $DB_NAME;"
        echo "✅ Database '$DB_NAME' created successfully"
    fi
fi

# Test 4: Check MySQL user permissions
echo ""
echo "4. Checking user permissions..."
mysql -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" -p"$DB_PASSWORD" -e "SHOW GRANTS FOR CURRENT_USER();" 2>/dev/null

# Test 5: Test database operations
echo ""
echo "5. Testing basic database operations..."
mysql -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" -p"$DB_PASSWORD" "$DB_NAME" << EOF
CREATE TABLE IF NOT EXISTS connection_test (
    id INT AUTO_INCREMENT PRIMARY KEY,
    test_message VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO connection_test (test_message) VALUES ('Connection test successful');

SELECT * FROM connection_test ORDER BY created_at DESC LIMIT 1;

DROP TABLE connection_test;
EOF

if [ $? -eq 0 ]; then
    echo "✅ Database operations test successful"
else
    echo "❌ Database operations test failed"
fi

# Test 6: Test connection string format
echo ""
echo "6. Testing DATABASE_URL format..."
DATABASE_URL="mysql://$DB_USER:$DB_PASSWORD@$DB_HOST:$DB_PORT/$DB_NAME"
echo "DATABASE_URL: mysql://$DB_USER:****@$DB_HOST:$DB_PORT/$DB_NAME"

# Test with Node.js if available
if command -v node &> /dev/null; then
    echo ""
    echo "7. Testing Node.js MySQL connection..."
    node -e "
const mysql = require('mysql2/promise');
const config = {
    host: '$DB_HOST',
    port: $DB_PORT,
    user: '$DB_USER',
    password: '$DB_PASSWORD',
    database: '$DB_NAME'
};

mysql.createConnection(config)
    .then(connection => {
        console.log('✅ Node.js MySQL connection successful');
        return connection.execute('SELECT 1 as test');
    })
    .then(([rows]) => {
        console.log('✅ Query execution successful:', rows[0]);
        process.exit(0);
    })
    .catch(err => {
        console.log('❌ Node.js MySQL connection failed:', err.message);
        process.exit(1);
    });
" 2>/dev/null || echo "⚠️ Node.js mysql2 package not available for testing"
fi

echo ""
echo "=== Database Check Summary ==="
echo "Host: $DB_HOST:$DB_PORT"
echo "Database: $DB_NAME"
echo "User: $DB_USER"
echo ""
echo "If all tests passed, your database is ready for the application!"
echo "Make sure your .env.production file contains:"
echo "DATABASE_URL=\"mysql://$DB_USER:$DB_PASSWORD@$DB_HOST:$DB_PORT/$DB_NAME\""
