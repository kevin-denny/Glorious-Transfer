#!/bin/bash

# SECURE Database Backup Script
# This script uses the new secure database credentials

# Database connection details (Secure)
DB_HOST="127.0.0.1"  # localhost only
DB_PORT="3306"
DB_USER="glorious_app"  # Non-root user
DB_PASSWORD=""  # Will be read from credentials file
DB_NAME="glorious_transfer"

# Backup configuration
BACKUP_DIR="/var/www/backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="$BACKUP_DIR/${DB_NAME}_backup_$TIMESTAMP.sql"
LOG_FILE="$BACKUP_DIR/backup.log"
RETENTION_DAYS=30  # Keep backups for 30 days
CREDENTIALS_FILE="/var/www/mysql_credentials.txt"

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

# Function to log messages
log_message() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $1" | tee -a "$LOG_FILE"
}

# Read password from credentials file
if [ -f "$CREDENTIALS_FILE" ]; then
    DB_PASSWORD=$(grep "Application Password:" "$CREDENTIALS_FILE" | cut -d' ' -f3)
    if [ -z "$DB_PASSWORD" ]; then
        log_message "ERROR: Could not read database password from $CREDENTIALS_FILE"
        exit 1
    fi
else
    log_message "ERROR: Credentials file not found: $CREDENTIALS_FILE"
    exit 1
fi

log_message "Starting SECURE database backup for $DB_NAME"

# Test database connection first
mysql -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" -p"$DB_PASSWORD" -e "SELECT 1;" > /dev/null 2>&1
if [ $? -ne 0 ]; then
    log_message "ERROR: Cannot connect to database with current credentials"
    exit 1
fi

# Build mysqldump command with options
MYSQLDUMP_CMD="mysqldump -h $DB_HOST -P $DB_PORT -u $DB_USER -p$DB_PASSWORD"
MYSQLDUMP_CMD="$MYSQLDUMP_CMD --single-transaction --routines --triggers"
MYSQLDUMP_CMD="$MYSQLDUMP_CMD --set-gtid-purged=OFF --no-tablespaces"

# Create main backup
$MYSQLDUMP_CMD "$DB_NAME" > "$BACKUP_FILE"

if [ $? -eq 0 ]; then
    # Compress the backup file
    gzip "$BACKUP_FILE"
    BACKUP_FILE="${BACKUP_FILE}.gz"
    
    BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
    log_message "SECURE backup completed successfully: $BACKUP_FILE (Size: $BACKUP_SIZE)"
    
    # Clean up old backups (keep only last RETENTION_DAYS days)
    log_message "Cleaning up backups older than $RETENTION_DAYS days..."
    find "$BACKUP_DIR" -name "${DB_NAME}_backup_*.sql.gz" -type f -mtime +$RETENTION_DAYS -delete
    
    OLD_LOGS=$(find "$BACKUP_DIR" -name "backup.log.*" -type f -mtime +$RETENTION_DAYS 2>/dev/null | wc -l)
    if [ $OLD_LOGS -gt 0 ]; then
        find "$BACKUP_DIR" -name "backup.log.*" -type f -mtime +$RETENTION_DAYS -delete
    fi
    
    log_message "SECURE database backup process completed successfully"
else
    log_message "ERROR: SECURE database backup failed!"
    # Remove incomplete backup file
    rm -f "$BACKUP_FILE"
    exit 1
fi

# Rotate log file if it gets too large (>10MB)
if [ -f "$LOG_FILE" ] && [ $(stat -c%s "$LOG_FILE" 2>/dev/null || stat -f%z "$LOG_FILE" 2>/dev/null) -gt 10485760 ]; then
    mv "$LOG_FILE" "${LOG_FILE}.$(date +%Y%m%d)"
    touch "$LOG_FILE"
fi