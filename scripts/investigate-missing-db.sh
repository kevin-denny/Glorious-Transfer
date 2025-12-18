#!/bin/bash

echo "=== Missing Database Investigation ==="
echo "Investigating missing 'glorious_transfer' database..."
echo ""

DB_HOST="159.223.52.48"
DB_USER="root"
DB_PASSWORD="root"
MISSING_DB="glorious_transfer"

echo "1. Checking current databases..."
mysql -h "$DB_HOST" -P 3306 -u "$DB_USER" -p"$DB_PASSWORD" -e "SHOW DATABASES;" 2>/dev/null || {
    echo "❌ Cannot connect to MySQL server"
    exit 1
}

echo ""
echo "2. Checking MySQL error logs for clues..."
mysql -h "$DB_HOST" -P 3306 -u "$DB_USER" -p"$DB_PASSWORD" -e "SHOW VARIABLES LIKE 'log_error';" 2>/dev/null

echo ""
echo "3. Checking MySQL process list for any DROP operations..."
mysql -h "$DB_HOST" -P 3306 -u "$DB_USER" -p"$DB_PASSWORD" -e "SHOW PROCESSLIST;" 2>/dev/null

echo ""
echo "4. Checking binary logs (if enabled) for DROP DATABASE commands..."
mysql -h "$DB_HOST" -P 3306 -u "$DB_USER" -p"$DB_PASSWORD" -e "SHOW BINARY LOGS;" 2>/dev/null || echo "Binary logging not enabled"

echo ""
echo "5. Checking MySQL uptime and restart history..."
mysql -h "$DB_HOST" -P 3306 -u "$DB_USER" -p"$DB_PASSWORD" -e "SHOW STATUS LIKE 'Uptime';" 2>/dev/null

echo ""
echo "6. Checking data directory permissions and space..."
mysql -h "$DB_HOST" -P 3306 -u "$DB_USER" -p"$DB_PASSWORD" -e "SHOW VARIABLES LIKE 'datadir';" 2>/dev/null

echo ""
echo "7. Looking for recent backup files..."
mysql -h "$DB_HOST" -P 3306 -u "$DB_USER" -p"$DB_PASSWORD" -e "SELECT SCHEMA_NAME FROM INFORMATION_SCHEMA.SCHEMATA WHERE SCHEMA_NAME LIKE '%glorious%' OR SCHEMA_NAME LIKE '%backup%';" 2>/dev/null

echo ""
echo "=== Common Causes Analysis ==="
echo ""
echo "Possible reasons for missing database:"
echo ""
echo "🔍 ACCIDENTAL DELETION:"
echo "   - Someone ran DROP DATABASE glorious_transfer"
echo "   - Automated cleanup script removed it"
echo "   - Application migration/reset script"
echo ""
echo "🔍 SERVER ISSUES:"
echo "   - MySQL server crashed during write operation"
echo "   - Disk space full causing corruption"
echo "   - Hardware failure affecting data directory"
echo "   - Server restart lost temporary databases"
echo ""
echo "🔍 CONFIGURATION ISSUES:"
echo "   - Wrong MySQL instance (different port/server)"
echo "   - MySQL configuration changed data directory"
echo "   - Permission issues preventing database access"
echo ""
echo "🔍 SECURITY ISSUES:"
echo "   - Unauthorized access and deletion"
echo "   - Malicious script or attack"
echo "   - Compromised root credentials"
echo ""
echo "=== Recovery Options ==="
echo ""
echo "1. Check if you have recent backups"
echo "2. Look for mysqldump files"
echo "3. Check application deployment scripts"
echo "4. Review server logs around the time it disappeared"
echo "5. Recreate database and restore from backup if available"
echo ""

read -p "Do you want to recreate the database now? (y/n): " recreate_db
if [ "$recreate_db" = "y" ] || [ "$recreate_db" = "Y" ]; then
    echo ""
    echo "Recreating glorious_transfer database..."
    mysql -h "$DB_HOST" -P 3306 -u "$DB_USER" -p"$DB_PASSWORD" -e "CREATE DATABASE IF NOT EXISTS glorious_transfer CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;" 2>/dev/null
    
    if [ $? -eq 0 ]; then
        echo "✅ Database 'glorious_transfer' recreated successfully"
        echo "⚠️ Remember to run your application migrations to recreate tables"
    else
        echo "❌ Failed to recreate database"
    fi
fi
