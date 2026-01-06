#!/bin/bash

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKUP_SCRIPT="$SCRIPT_DIR/backup_db_secure.sh"
CRON_TIME="30 23 * * *"  # Run daily at 11 PM (23:00)

echo "Setting up daily database backup..."

# Make backup script executable
chmod +x "$BACKUP_SCRIPT"

# Check if cron job already exists
if crontab -l 2>/dev/null | grep -q "$BACKUP_SCRIPT"; then
    echo "Cron job for database backup already exists."
    echo "Current cron jobs:"
    crontab -l | grep "$BACKUP_SCRIPT"
    echo ""
    read -p "Do you want to update the existing cron job? (y/n): " update_cron
    if [ "$update_cron" = "y" ] || [ "$update_cron" = "Y" ]; then
        # Remove old cron job and add new one
        (crontab -l | grep -v "$BACKUP_SCRIPT"; echo "$CRON_TIME /bin/bash $BACKUP_SCRIPT >> /var/www/backups/backup_cron.log 2>&1") | crontab -
        echo "Cron job updated successfully."
    fi
else
    # Add cron job
    (crontab -l 2>/dev/null; echo "$CRON_TIME /bin/bash $BACKUP_SCRIPT >> /var/www/backups/backup_cron.log 2>&1") | crontab -
    echo "Daily backup cron job added successfully."
fi

echo "Backup will run daily at 11:00 PM (23:00)"
echo ""
echo "Current cron schedule:"
crontab -l | grep "$BACKUP_SCRIPT"
echo ""
echo "To manually run backup: $BACKUP_SCRIPT"
echo "To view all cron jobs: crontab -l"
echo "To edit cron jobs: crontab -e"
