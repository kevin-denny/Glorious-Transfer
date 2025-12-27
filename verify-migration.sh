#!/bin/bash

echo "=== DATA MIGRATION VERIFICATION ==="
echo "This script helps verify your data migration was successful"
echo ""

CREDENTIALS_FILE="/var/www/mysql_credentials.txt"

# Check if credentials exist
if [ ! -f "$CREDENTIALS_FILE" ]; then
    echo "❌ Credentials file not found. Run secure-mysql-setup.sh first."
    exit 1
fi

# Read credentials
LOCAL_APP_USER=$(grep "Application User:" "$CREDENTIALS_FILE" | cut -d' ' -f3)
LOCAL_APP_PASSWORD=$(grep "Application Password:" "$CREDENTIALS_FILE" | cut -d' ' -f3)
LOCAL_DB_NAME="glorious_transfer"

echo "1. Testing database connection..."
mysql -h 127.0.0.1 -u "$LOCAL_APP_USER" -p"$LOCAL_APP_PASSWORD" -e "SELECT 1;" > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo "✅ Database connection successful"
else
    echo "❌ Database connection failed"
    exit 1
fi

echo ""
echo "2. Checking database structure..."
TABLES=$(mysql -h 127.0.0.1 -u "$LOCAL_APP_USER" -p"$LOCAL_APP_PASSWORD" -D "$LOCAL_DB_NAME" -e "SHOW TABLES;" | tail -n +2)

echo "Found tables:"
for table in $TABLES; do
    ROWS=$(mysql -h 127.0.0.1 -u "$LOCAL_APP_USER" -p"$LOCAL_APP_PASSWORD" -D "$LOCAL_DB_NAME" -e "SELECT COUNT(*) FROM $table;" | tail -n +2)
    echo "  ✅ $table: $ROWS rows"
done

echo ""
echo "3. Checking critical tables..."

# Check auth_users table
AUTH_USERS=$(mysql -h 127.0.0.1 -u "$LOCAL_APP_USER" -p"$LOCAL_APP_PASSWORD" -D "$LOCAL_DB_NAME" -e "SELECT COUNT(*) FROM auth_users;" 2>/dev/null | tail -n +2)
if [ -n "$AUTH_USERS" ] && [ "$AUTH_USERS" -gt 0 ]; then
    echo "✅ Users table: $AUTH_USERS users"
else
    echo "⚠️  Users table: No users found or table missing"
fi

# Check drivers table
DRIVERS=$(mysql -h 127.0.0.1 -u "$LOCAL_APP_USER" -p"$LOCAL_APP_PASSWORD" -D "$LOCAL_DB_NAME" -e "SELECT COUNT(*) FROM drivers;" 2>/dev/null | tail -n +2)
if [ -n "$DRIVERS" ]; then
    echo "✅ Drivers table: $DRIVERS drivers"
else
    echo "⚠️  Drivers table: No data or table missing"
fi

echo ""
echo "4. Testing Docker connectivity..."
if docker ps | grep -q glorious-transfer; then
    echo "✅ Docker containers are running"
    
    # Test app health
    curl -s http://localhost:3000/api/auth/status > /dev/null 2>&1
    if [ $? -eq 0 ]; then
        echo "✅ Application is responding"
    else
        echo "⚠️  Application not responding (may be starting up)"
    fi
else
    echo "⚠️  Docker containers not running"
fi

echo ""
echo "5. Security check..."
# Test that remote MySQL is no longer accessible
timeout 5 telnet 159.223.52.48 3306 > /dev/null 2>&1
if [ $? -ne 0 ]; then
    echo "✅ Remote MySQL is no longer publicly accessible"
else
    echo "⚠️  Remote MySQL still appears accessible - check firewall"
fi

echo ""
echo "=== VERIFICATION COMPLETE ==="
echo ""
echo "If all checks show ✅, your migration was successful!"
echo ""
echo "Next steps if needed:"
echo "- Check application logs: docker logs glorious-transfer-app-1"
echo "- Monitor backup job: tail -f /var/www/backups/backup_cron.log"
echo "- Test app functionality: https://fierryranger.me"