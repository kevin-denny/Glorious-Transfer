#!/bin/bash

DB_HOST="159.223.52.48"
DB_USER="root"
DB_PASSWORD="root"
DB_NAME="glorious_transfer"
BACKUP_DIR="/e:/Other_projects/GLORIOUS_TRANSFER/Glorious-Transfer/backups"

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
        echo "  $0 auto-backup              - Setup automatic daily backups"
        echo ""
        echo "Examples:"
        echo "  $0 backup"
        echo "  $0 restore $BACKUP_DIR/glorious_transfer_backup_20240101_120000.sql.gz"
        ;;
esac
