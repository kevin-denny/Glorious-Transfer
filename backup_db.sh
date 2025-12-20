#!/bin/bash

# Database connection details
DB_HOST="159.223.52.48"
DB_PORT="3306"
DB_USER="root"
DB_PASSWORD="root"
DB_NAME="glorious_transfer"

# Backup configuration
BACKUP_DIR="/var/www/backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="$BACKUP_DIR/${DB_NAME}_backup_$TIMESTAMP.sql"
LOG_FILE="$BACKUP_DIR/backup.log"
RETENTION_DAYS=30  # Keep backups for 30 days

# Advanced backup options (uncomment and modify as needed)
# EXCLUDE_TABLES="temp_table1 temp_table2"  # Tables to exclude completely
# STRUCTURE_ONLY_TABLES="large_log_table"   # Tables to backup structure only (no data)
# DATA_ONLY_TABLES=""                       # Tables to backup data only (no structure)

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

# Function to log messages
log_message() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $1" | tee -a "$LOG_FILE"
}

log_message "Starting database backup for $DB_NAME"

# Build mysqldump command with options
MYSQLDUMP_CMD="mysqldump -h $DB_HOST -P $DB_PORT -u $DB_USER -p$DB_PASSWORD"
MYSQLDUMP_CMD="$MYSQLDUMP_CMD --single-transaction --routines --triggers"

# Add table exclusions if specified
if [ ! -z "$EXCLUDE_TABLES" ]; then
    for table in $EXCLUDE_TABLES; do
        MYSQLDUMP_CMD="$MYSQLDUMP_CMD --ignore-table=$DB_NAME.$table"
    done
    log_message "Excluding tables: $EXCLUDE_TABLES"
fi

# Create main backup
$MYSQLDUMP_CMD "$DB_NAME" > "$BACKUP_FILE"

# Handle structure-only tables if specified
if [ ! -z "$STRUCTURE_ONLY_TABLES" ]; then
    log_message "Adding structure-only tables: $STRUCTURE_ONLY_TABLES"
    mysqldump -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" -p"$DB_PASSWORD" \
        --no-data --routines --triggers "$DB_NAME" $STRUCTURE_ONLY_TABLES >> "$BACKUP_FILE"
fi

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
