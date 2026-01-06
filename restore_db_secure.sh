#!/bin/bash

set -e  # Exit on any error

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

echo "=============================================="
echo "  🔄 GLORIOUS TRANSFER - Database Restore"
echo "=============================================="
echo ""

# Configuration - Load from credentials file or use defaults
CREDENTIALS_FILE="/var/www/server_credentials.txt"
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

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

# Function to test database connection
test_connection() {
    log_info "Testing database connection..."
    mysql -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" -p"$DB_PASSWORD" -e "SELECT 1;" > /dev/null 2>&1
    if [ $? -eq 0 ]; then
        log_success "Database connection successful"
        return 0
    else
        log_error "Database connection failed"
        return 1
    fi
}

# Function to restore from backup file
restore_from_file() {
    local backup_file="$1"
    
    if [ ! -f "$backup_file" ]; then
        log_error "Backup file not found: $backup_file"
        exit 1
    fi
    
    log_info "Restoring database from: $backup_file"
    log_warning "This will OVERWRITE all data in database: $DB_NAME"
    
    # Get file size for progress indication
    file_size=$(du -h "$backup_file" | cut -f1)
    log_info "Backup file size: $file_size"
    
    read -p "Are you sure you want to continue? [y/N]: " CONFIRM
    if [ "$CONFIRM" != "y" ] && [ "$CONFIRM" != "Y" ]; then
        log_info "Restore cancelled by user"
        exit 0
    fi
    
    # Test connection before proceeding
    if ! test_connection; then
        exit 1
    fi
    
    # Create a backup of current data before restore
    log_info "Creating backup of current data before restore..."
    current_backup="$BACKUP_DIR/pre_restore_backup_$(date +%Y%m%d_%H%M%S).sql"
    mysqldump -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" -p"$DB_PASSWORD" \
              --routines --triggers --single-transaction \
              "$DB_NAME" > "$current_backup" 2>/dev/null
    
    if [ $? -eq 0 ]; then
        log_success "Current data backed up to: $current_backup"
        gzip "$current_backup"
        log_info "Backup compressed: ${current_backup}.gz"
    else
        log_warning "Failed to create current data backup, continuing anyway..."
    fi
    
    # Start restore process
    log_info "Starting database restore..."
    
    # Check if file is compressed and restore accordingly
    if [[ "$backup_file" == *.gz ]]; then
        log_info "Detected compressed backup file"
        zcat "$backup_file" | mysql -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" -p"$DB_PASSWORD" "$DB_NAME"
    elif [[ "$backup_file" == *.sql ]]; then
        log_info "Detected SQL backup file"
        mysql -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" -p"$DB_PASSWORD" "$DB_NAME" < "$backup_file"
    else
        log_warning "Unknown file type, attempting to restore as SQL..."
        mysql -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" -p"$DB_PASSWORD" "$DB_NAME" < "$backup_file"
    fi
    
    if [ $? -eq 0 ]; then
        log_success "Database restored successfully!"
        
        # Verify restore by checking table count
        table_count=$(mysql -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" -p"$DB_PASSWORD" -e "USE $DB_NAME; SHOW TABLES;" 2>/dev/null | wc -l)
        if [ "$table_count" -gt 1 ]; then
            log_success "Verification: $((table_count-1)) tables found in restored database"
        fi
        
        log_info "Restore completed at: $(date)"
    else
        log_error "Database restore failed!"
        if [ -f "${current_backup}.gz" ]; then
            log_info "You can restore the previous backup using:"
            log_info "$0 restore ${current_backup}.gz"
        fi
        exit 1
    fi
}

# Function to find and restore latest backup
restore_latest() {
    log_info "Searching for latest backup in $BACKUP_DIR..."
    
    # Find latest backup file
    latest_backup=$(find "$BACKUP_DIR" -name "*.sql*" -type f -printf '%T@ %p\n' 2>/dev/null | sort -nr | head -1 | cut -d' ' -f2-)
    
    if [ -z "$latest_backup" ]; then
        log_error "No backup files found in $BACKUP_DIR"
        log_info "Available files:"
        ls -la "$BACKUP_DIR" 2>/dev/null || echo "Directory is empty"
        exit 1
    fi
    
    log_success "Latest backup found: $latest_backup"
    
    # Get backup file info
    backup_date=$(stat -c %y "$latest_backup" | cut -d' ' -f1,2)
    log_info "Backup date: $backup_date"
    
    # Restore from latest backup
    restore_from_file "$latest_backup"
}

# Function to list available backups
list_backups() {
    echo ""
    log_info "Available backup files in $BACKUP_DIR:"
    echo "----------------------------------------"
    
    if [ -d "$BACKUP_DIR" ]; then
        find "$BACKUP_DIR" -name "*.sql*" -type f -printf '%TY-%Tm-%Td %TH:%TM  %s bytes  %p\n' 2>/dev/null | sort -r
        
        echo ""
        backup_count=$(find "$BACKUP_DIR" -name "*.sql*" -type f 2>/dev/null | wc -l)
        log_info "Total backups found: $backup_count"
        
        if [ "$backup_count" -eq 0 ]; then
            log_warning "No backup files found"
            echo "To create a backup, use the backup_db_secure.sh script"
        fi
    else
        log_warning "Backup directory does not exist: $BACKUP_DIR"
    fi
    echo ""
}

# Main script logic
case "$1" in
    "restore")
        if [ -z "$2" ]; then
            log_error "Backup file path required"
            echo ""
            echo "Usage: $0 restore <backup_file>"
            echo "Example: $0 restore $BACKUP_DIR/glorious_transfer_backup_20240101_120000.sql.gz"
            echo ""
            list_backups
            exit 1
        fi
        
        restore_from_file "$2"
        ;;
        
    "restore-latest")
        restore_latest
        ;;
        
    "list")
        list_backups
        ;;
        
    "test-connection")
        test_connection
        ;;
        
    *)
        echo "🔄 GLORIOUS TRANSFER - Database Restore Tool"
        echo ""
        echo "Usage:"
        echo "  $0 restore <backup_file>     - Restore from specific backup file"
        echo "  $0 restore-latest            - Restore from latest backup"
        echo "  $0 list                      - List available backup files"
        echo "  $0 test-connection          - Test database connection"
        echo ""
        echo "Examples:"
        echo "  $0 restore $BACKUP_DIR/glorious_transfer_backup_20240101_120000.sql.gz"
        echo "  $0 restore-latest"
        echo "  $0 list"
        echo ""
        echo "Configuration:"
        echo "  Database Host: $DB_HOST:$DB_PORT"
        echo "  Database Name: $DB_NAME"
        echo "  Database User: $DB_USER"
        echo "  Backup Directory: $BACKUP_DIR"
        echo "  Credentials File: $CREDENTIALS_FILE"
        echo ""
        
        list_backups
        ;;
esac
