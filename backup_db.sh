#!/bin/bash

# Database connection details
DB_HOST="159.223.52.48"
DB_PORT="3306"
DB_USER="root"
DB_PASSWORD="root"
DB_NAME="glorious_transfer"

# Backup configuration
BACKUP_DIR="./backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="$BACKUP_DIR/${DB_NAME}_backup_$TIMESTAMP.sql"
LOG_FILE="$BACKUP_DIR/backup.log"
RETENTION_DAYS=30  # Keep backups for 30 days

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

# Function to log messages
log_message() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $1" | tee -a "$LOG_FILE"
}

log_message "Starting database backup for $DB_NAME"

# Create database backup
mysqldump -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" -p"$DB_PASSWORD" \
    --single-transaction \
    --routines \
    --triggers \
    "$DB_NAME" > "$BACKUP_FILE"

if [ $? -eq 0 ]; then
    # Compress the backup file
    gzip "$BACKUP_FILE"
    BACKUP_FILE="${BACKUP_FILE}.gz"
    
    BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
    log_message "Backup completed successfully: $BACKUP_FILE (Size: $BACKUP_SIZE)"
    
    # Clean up old backups (keep only last RETENTION_DAYS days)
    log_message "Cleaning up backups older than $RETENTION_DAYS days..."
    find "$BACKUP_DIR" -name "${DB_NAME}_backup_*.sql.gz" -type f -mtime +$RETENTION_DAYS -delete
    
    OLD_LOGS=$(find "$BACKUP_DIR" -name "backup.log.*" -type f -mtime +$RETENTION_DAYS 2>/dev/null | wc -l)
    if [ $OLD_LOGS -gt 0 ]; then
        find "$BACKUP_DIR" -name "backup.log.*" -type f -mtime +$RETENTION_DAYS -delete
    fi
    
    log_message "Database backup process completed successfully"
else
    log_message "ERROR: Database backup failed!"
    # Remove incomplete backup file
    rm -f "$BACKUP_FILE"
    exit 1
fi

# Rotate log file if it gets too large (>10MB)
if [ -f "$LOG_FILE" ] && [ $(stat -f%z "$LOG_FILE" 2>/dev/null || stat -c%s "$LOG_FILE" 2>/dev/null) -gt 10485760 ]; then
    mv "$LOG_FILE" "${LOG_FILE}.$(date +%Y%m%d)"
    touch "$LOG_FILE"
fi
