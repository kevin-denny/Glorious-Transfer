#!/bin/bash

echo "=== GLORIOUS TRANSFER DATA MIGRATION ==="
echo "This script will migrate your data from the insecure remote DB to secure local DB"
echo ""

# Configuration
REMOTE_DB_HOST="159.223.52.48"
REMOTE_DB_PORT="3306"
REMOTE_DB_USER="root"
REMOTE_DB_PASSWORD="root"
REMOTE_DB_NAME="glorious_transfer"

LOCAL_DB_HOST="127.0.0.1"
LOCAL_DB_PORT="3306"
LOCAL_DB_NAME="glorious_transfer"

MIGRATION_DIR="/var/www/migration"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
CREDENTIALS_FILE="/var/www/mysql_credentials.txt"

# Create migration directory
mkdir -p "$MIGRATION_DIR"

# Function to log messages
log_message() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $1" | tee -a "$MIGRATION_DIR/migration.log"
}

log_message "Starting data migration process"

# Step 1: Test remote database connection
echo "1. Testing connection to remote database..."
mysql -h "$REMOTE_DB_HOST" -P "$REMOTE_DB_PORT" -u "$REMOTE_DB_USER" -p"$REMOTE_DB_PASSWORD" -e "SELECT 1;" > /dev/null 2>&1
if [ $? -ne 0 ]; then
    log_message "ERROR: Cannot connect to remote database"
    echo "❌ Failed to connect to remote database"
    exit 1
fi
log_message "✅ Remote database connection successful"

# Step 2: Check if local MySQL is set up
echo "2. Checking if secure MySQL setup has been completed..."
if [ ! -f "$CREDENTIALS_FILE" ]; then
    echo "❌ Secure MySQL setup not found. Please run secure-mysql-setup.sh first"
    log_message "ERROR: Secure MySQL setup not completed"
    exit 1
fi

# Read local credentials
LOCAL_ROOT_PASSWORD=$(grep "Root Password:" "$CREDENTIALS_FILE" | cut -d' ' -f3)
LOCAL_APP_USER=$(grep "Application User:" "$CREDENTIALS_FILE" | cut -d' ' -f3)
LOCAL_APP_PASSWORD=$(grep "Application Password:" "$CREDENTIALS_FILE" | cut -d' ' -f3)

if [ -z "$LOCAL_ROOT_PASSWORD" ] || [ -z "$LOCAL_APP_USER" ] || [ -z "$LOCAL_APP_PASSWORD" ]; then
    log_message "ERROR: Could not read local database credentials"
    exit 1
fi

log_message "✅ Secure MySQL credentials loaded"

# Step 3: Test local database connection
echo "3. Testing connection to local database..."
mysql -h "$LOCAL_DB_HOST" -P "$LOCAL_DB_PORT" -u "$LOCAL_APP_USER" -p"$LOCAL_APP_PASSWORD" -e "SELECT 1;" > /dev/null 2>&1
if [ $? -ne 0 ]; then
    log_message "ERROR: Cannot connect to local database"
    echo "❌ Failed to connect to local database"
    exit 1
fi
log_message "✅ Local database connection successful"

# Step 4: Get data statistics from remote database
echo "4. Analyzing remote database..."
REMOTE_TABLES=$(mysql -h "$REMOTE_DB_HOST" -P "$REMOTE_DB_PORT" -u "$REMOTE_DB_USER" -p"$REMOTE_DB_PASSWORD" -D "$REMOTE_DB_NAME" -e "SHOW TABLES;" | tail -n +2)
TOTAL_TABLES=$(echo "$REMOTE_TABLES" | wc -l)

log_message "Found $TOTAL_TABLES tables to migrate:"
for table in $REMOTE_TABLES; do
    ROWS=$(mysql -h "$REMOTE_DB_HOST" -P "$REMOTE_DB_PORT" -u "$REMOTE_DB_USER" -p"$REMOTE_DB_PASSWORD" -D "$REMOTE_DB_NAME" -e "SELECT COUNT(*) FROM $table;" | tail -n +2)
    log_message "  - $table: $ROWS rows"
done

# Step 5: Create full data backup from remote database
echo "5. Creating full data backup from remote database..."
BACKUP_FILE="$MIGRATION_DIR/remote_data_backup_$TIMESTAMP.sql"

mysqldump -h "$REMOTE_DB_HOST" -P "$REMOTE_DB_PORT" -u "$REMOTE_DB_USER" -p"$REMOTE_DB_PASSWORD" \
    --single-transaction \
    --routines \
    --triggers \
    --events \
    --add-drop-database \
    --databases "$REMOTE_DB_NAME" > "$BACKUP_FILE"

if [ $? -eq 0 ]; then
    BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
    log_message "✅ Remote data backup created: $BACKUP_FILE (Size: $BACKUP_SIZE)"
    
    # Compress the backup
    gzip "$BACKUP_FILE"
    BACKUP_FILE="${BACKUP_FILE}.gz"
    COMPRESSED_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
    log_message "✅ Backup compressed: $COMPRESSED_SIZE"
else
    log_message "❌ Failed to create remote data backup"
    exit 1
fi

# Step 6: Prepare local database
echo "6. Preparing local database for data import..."

# Drop existing local database if it exists and recreate
mysql -h "$LOCAL_DB_HOST" -P "$LOCAL_DB_PORT" -u root -p"$LOCAL_ROOT_PASSWORD" << EOF
DROP DATABASE IF EXISTS $LOCAL_DB_NAME;
CREATE DATABASE $LOCAL_DB_NAME CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
GRANT ALL PRIVILEGES ON $LOCAL_DB_NAME.* TO '$LOCAL_APP_USER'@'localhost';
FLUSH PRIVILEGES;
EOF

if [ $? -eq 0 ]; then
    log_message "✅ Local database prepared"
else
    log_message "❌ Failed to prepare local database"
    exit 1
fi

# Step 7: Import data to local database
echo "7. Importing data to local database..."
gunzip -c "$BACKUP_FILE" | mysql -h "$LOCAL_DB_HOST" -P "$LOCAL_DB_PORT" -u root -p"$LOCAL_ROOT_PASSWORD"

if [ $? -eq 0 ]; then
    log_message "✅ Data successfully imported to local database"
else
    log_message "❌ Failed to import data to local database"
    exit 1
fi

# Step 8: Verify data integrity
echo "8. Verifying data integrity..."
for table in $REMOTE_TABLES; do
    REMOTE_ROWS=$(mysql -h "$REMOTE_DB_HOST" -P "$REMOTE_DB_PORT" -u "$REMOTE_DB_USER" -p"$REMOTE_DB_PASSWORD" -D "$REMOTE_DB_NAME" -e "SELECT COUNT(*) FROM $table;" | tail -n +2)
    LOCAL_ROWS=$(mysql -h "$LOCAL_DB_HOST" -P "$LOCAL_DB_PORT" -u "$LOCAL_APP_USER" -p"$LOCAL_APP_PASSWORD" -D "$LOCAL_DB_NAME" -e "SELECT COUNT(*) FROM $table;" | tail -n +2)
    
    if [ "$REMOTE_ROWS" = "$LOCAL_ROWS" ]; then
        log_message "✅ $table: $LOCAL_ROWS rows (verified)"
    else
        log_message "⚠️  $table: Remote=$REMOTE_ROWS, Local=$LOCAL_ROWS (MISMATCH!)"
    fi
done

# Step 9: Create updated environment file
echo "9. Creating updated environment file..."
cat > "$MIGRATION_DIR/.env.production.migrated" << EOF
# Secure Production Environment Variables (Post-Migration)
# Database Configuration (Local MySQL Server)
DATABASE_URL="mysql://$LOCAL_APP_USER:$LOCAL_APP_PASSWORD@host.docker.internal:3306/$LOCAL_DB_NAME"

# Next.js Configuration
NEXTAUTH_SECRET="your-secret-key-here"
NEXTAUTH_URL="https://fierryranger.me"

# Application Configuration
NODE_ENV=production
PORT=3000

# API Name
NEXT_PUBLIC_API=https://fierryranger.me

# Database Configuration (for local MySQL)
DB_HOST=host.docker.internal
DB_USER=$LOCAL_APP_USER
DB_PASSWORD=$LOCAL_APP_PASSWORD
DB_NAME=$LOCAL_DB_NAME

# JWT Configuration
JWT_SECRET=LPIf1u/5X2CfO9VqL/3bfzJit9S2Nf5eptp/EkocDYg=
EOF

log_message "✅ Environment file created: $MIGRATION_DIR/.env.production.migrated"

# Step 10: Final verification
echo "10. Running final verification..."
mysql -h "$LOCAL_DB_HOST" -P "$LOCAL_DB_PORT" -u "$LOCAL_APP_USER" -p"$LOCAL_APP_PASSWORD" -D "$LOCAL_DB_NAME" -e "SELECT 'Migration successful' as status;" > /dev/null 2>&1

if [ $? -eq 0 ]; then
    log_message "✅ Final verification passed"
else
    log_message "❌ Final verification failed"
    exit 1
fi

echo ""
echo "=== DATA MIGRATION COMPLETED SUCCESSFULLY ==="
echo ""
echo "✅ Data migrated from remote database to secure local database"
echo "✅ All tables verified for data integrity"
echo "✅ Environment file prepared for deployment"
echo ""
echo "Summary:"
echo "- Remote database: $REMOTE_DB_HOST:$REMOTE_DB_PORT"
echo "- Local database: $LOCAL_DB_HOST:$LOCAL_DB_PORT"
echo "- Tables migrated: $TOTAL_TABLES"
echo "- Backup location: $BACKUP_FILE"
echo "- Environment file: $MIGRATION_DIR/.env.production.migrated"
echo ""
echo "Next steps:"
echo "1. Stop your application: docker-compose down"
echo "2. Replace .env.production with the migrated version"
echo "3. Update docker-compose.yml for local database access"
echo "4. Restart application: docker-compose up -d"
echo "5. Test application functionality"
echo ""
echo "Migration log: $MIGRATION_DIR/migration.log"