#!/bin/bash

CREDENTIALS_FILE="/var/www/mysql_credentials.txt"
BACKUP_DIR="/var/www/backups"

# Default database configuration
DB_HOST="localhost"
DB_PORT="3306"
DB_NAME="glorious_transfer"
DB_USER="glorious_app"
DB_PASSWORD=""

# Try to load credentials from file
if [ -f "$CREDENTIALS_FILE" ]; then
    log_info "Loading database credentials from $CREDENTIALS_FILE"
    
    # Extract database password from credentials file
    DB_PASSWORD=$(grep "Database Password:" "$CREDENTIALS_FILE" 2>/dev/null | cut -d':' -f2 | tr -d ' ' || echo "")
    
    # Extract database name if different
    CUSTOM_DB_NAME=$(grep "Application Database:" "$CREDENTIALS_FILE" 2>/dev/null | cut -d':' -f2 | tr -d ' ' || echo "")
    if [ -n "$CUSTOM_DB_NAME" ]; then
        DB_NAME="$CUSTOM_DB_NAME"
    fi
    
    # Extract database user if different
    CUSTOM_DB_USER=$(grep "Database User:" "$CREDENTIALS_FILE" 2>/dev/null | cut -d':' -f2 | tr -d ' ' || echo "")
    if [ -n "$CUSTOM_DB_USER" ]; then
        DB_USER="$CUSTOM_DB_USER"
    fi
fi

# If no password found, prompt for it
if [ -z "$DB_PASSWORD" ]; then
    echo "Database credentials not found in $CREDENTIALS_FILE"
    read -p "Enter database host [$DB_HOST]: " INPUT_HOST
    DB_HOST=${INPUT_HOST:-$DB_HOST}
    
    read -p "Enter database name [$DB_NAME]: " INPUT_DB_NAME
    DB_NAME=${INPUT_DB_NAME:-$DB_NAME}
    
    read -p "Enter database user [$DB_USER]: " INPUT_DB_USER
    DB_USER=${INPUT_DB_USER:-$DB_USER}
    
    read -s -p "Enter database password: " DB_PASSWORD
    echo ""
fi

# Create backup directory
mkdir -p "$BACKUP_DIR"

case "$1" in
    "backup")
        echo "Creating backup of $DB_NAME database..."
        TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
        BACKUP_FILE="$BACKUP_DIR/${DB_NAME}_backup_${TIMESTAMP}.sql"
        
        mysqldump -h "$DB_HOST" -P 3306 -u "$DB_USER" -p"$DB_PASSWORD" \
                  --routines --triggers --single-transaction \
                  "$DB_NAME" > "$BACKUP_FILE"
        
        if [ $? -eq 0 ]; then
            echo "✅ Backup created: $BACKUP_FILE"
            # Compress backup
            gzip "$BACKUP_FILE"
            echo "✅ Backup compressed: ${BACKUP_FILE}.gz"
        else
            echo "❌ Backup failed"
        fi
        ;;
        
    "restore")
        if [ -z "$2" ]; then
            echo "Available backups:"
            ls -la "$BACKUP_DIR"/*.sql* 2>/dev/null || echo "No backups found"
            echo ""
            echo "Usage: $0 restore <backup_file>"
            exit 1
        fi
        
        BACKUP_FILE="$2"
        if [ ! -f "$BACKUP_FILE" ]; then
            echo "❌ Backup file not found: $BACKUP_FILE"
            exit 1
        fi
        
        echo "Restoring database from: $BACKUP_FILE"
        
        # Check if file is compressed
        if [[ "$BACKUP_FILE" == *.gz ]]; then
            zcat "$BACKUP_FILE" | mysql -h "$DB_HOST" -P 3306 -u "$DB_USER" -p"$DB_PASSWORD" "$DB_NAME"
        else
            mysql -h "$DB_HOST" -P 3306 -u "$DB_USER" -p"$DB_PASSWORD" "$DB_NAME" < "$BACKUP_FILE"
        fi
        
        if [ $? -eq 0 ]; then
            echo "✅ Database restored successfully"
        else
            echo "❌ Restore failed"
        fi
        ;;

    "restore-latest")
        echo "Finding latest backup..."
        LATEST_BACKUP=$(ls -t "$BACKUP_DIR"/*.sql* 2>/dev/null | head -n 1)
        
        if [ -z "$LATEST_BACKUP" ]; then
            echo "❌ No backups found in $BACKUP_DIR"
            exit 1
        fi
        
        echo "Latest backup found: $LATEST_BACKUP"
        echo "Restoring database from: $LATEST_BACKUP"
        
        # Check if file is compressed
        if [[ "$LATEST_BACKUP" == *.gz ]]; then
            zcat "$LATEST_BACKUP" | mysql -h "$DB_HOST" -P 3306 -u "$DB_USER" -p"$DB_PASSWORD" "$DB_NAME"
        else
            mysql -h "$DB_HOST" -P 3306 -u "$DB_USER" -p"$DB_PASSWORD" "$DB_NAME" < "$LATEST_BACKUP"
        fi
        
        if [ $? -eq 0 ]; then
            echo "✅ Database restored successfully from latest backup"
        else
            echo "❌ Restore failed"
        fi
        ;;
        
    "auto-backup")
        echo "Setting up automatic daily backups..."
        CRON_JOB="0 2 * * * $PWD/mysql-backup-restore.sh backup"
        (crontab -l 2>/dev/null; echo "$CRON_JOB") | crontab -
        echo "✅ Daily backup scheduled at 2 AM"
        ;;
        
    *)
        echo "MySQL Backup & Restore Tool"
        echo ""
        echo "Usage:"
        echo "  $0 backup                    - Create database backup"
        echo "  $0 restore <backup_file>     - Restore from backup"
        echo "  $0 restore-latest            - Restore from latest backup"
        echo "  $0 auto-backup              - Setup automatic daily backups"
        echo ""
        echo "Examples:"
        echo "  $0 backup"
        echo "  $0 restore $BACKUP_DIR/glorious_transfer_backup_20240101_120000.sql.gz"
        echo "  $0 restore-latest"
        ;;
esac
