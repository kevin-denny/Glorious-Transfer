#!/bin/bash

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKUP_SCRIPT="$SCRIPT_DIR/backup_db.sh"
CRON_TIME="0 23 * * *"  # Run daily at 11 PM (EOD)

echo "Setting up daily database backup..."

# Make backup script executable
chmod +x "$BACKUP_SCRIPT"

# Check if cron job already exists
if crontab -l 2>/dev/null | grep -q "$BACKUP_SCRIPT"; then
    echo "Cron job for database backup already exists."
else
    # Add cron job
    (crontab -l 2>/dev/null; echo "$CRON_TIME $BACKUP_SCRIPT") | crontab -
    echo "Daily backup cron job added successfully."
    echo "Backup will run daily at 11:00 PM"
fi

echo "Setup complete!"
echo ""
echo "To manually run backup: $BACKUP_SCRIPT"
echo "To view cron jobs: crontab -l"
echo "To remove cron job: crontab -e (then delete the line)"
