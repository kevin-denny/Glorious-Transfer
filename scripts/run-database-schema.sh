#!/bin/bash

# Glorious Transfer Database Schema Setup Script
# This script executes DATABASE_SCHEMA.sql on MySQL server

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
MODE=""
DB_NAME="glorious_transfer"
DB_HOST="localhost"
DB_PORT="3306"
DB_USER="root"
DB_PASSWORD="root"
CONTAINER_NAME="mysql"

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
SCHEMA_FILE="$PROJECT_ROOT/DATABASE_SCHEMA.sql"

# Function to print colored output
print_colored() {
    local color=$1
    local message=$2
    echo -e "${color}${message}${NC}"
}

# Function to show usage
show_usage() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Execute DATABASE_SCHEMA.sql on MySQL server"
    echo ""
    echo "Options:"
    echo "  -m, --mode MODE          Execution mode: 'local', 'docker', or 'remote'"
    echo "  -d, --database NAME      Database name (default: glorious_transfer)"
    echo "  -h, --host HOST          MySQL host (default: localhost)"
    echo "  -P, --port PORT          MySQL port (default: 3306)"
    echo "  -u, --user USERNAME      MySQL username (default: root)"
    echo "  -p, --password PASSWORD  MySQL password (will prompt if not provided)"
    echo "  -c, --container NAME     Docker container name (default: mysql)"
    echo "  --help                   Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 -m local"
    echo "  $0 -m docker -c glorious_transfer_mysql_1"
    echo "  $0 -m remote -h 192.168.1.100 -u myuser"
}

# Function to test MySQL connection
test_mysql_connection() {
    print_colored "$BLUE" "Testing MySQL connection..."
    
    if [ "$MODE" = "docker" ]; then
        docker exec "$CONTAINER_NAME" mysql -u "$DB_USER" -p"$DB_PASSWORD" -e "SELECT 1;" >/dev/null 2>&1
    else
        mysql -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" -p"$DB_PASSWORD" -e "SELECT 1;" >/dev/null 2>&1
    fi
    
    return $?
}

# Function to create database if not exists
create_database() {
    print_colored "$BLUE" "Creating database '$DB_NAME' if it doesn't exist..."
    
    local create_sql="CREATE DATABASE IF NOT EXISTS $DB_NAME CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
    
    if [ "$MODE" = "docker" ]; then
        docker exec "$CONTAINER_NAME" mysql -u "$DB_USER" -p"$DB_PASSWORD" -e "$create_sql"
    else
        mysql -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" -p"$DB_PASSWORD" -e "$create_sql"
    fi
    
    if [ $? -eq 0 ]; then
        print_colored "$GREEN" "✓ Database created/verified successfully"
    else
        print_colored "$RED" "✗ Failed to create database"
        exit 1
    fi
}

# Function to execute schema file
execute_schema() {
    print_colored "$BLUE" "Executing DATABASE_SCHEMA.sql..."
    
    if [ "$MODE" = "docker" ]; then
        # Copy schema file to container and execute
        docker cp "$SCHEMA_FILE" "$CONTAINER_NAME:/tmp/schema.sql"
        docker exec "$CONTAINER_NAME" mysql -u "$DB_USER" -p"$DB_PASSWORD" "$DB_NAME" -e "source /tmp/schema.sql"
        docker exec "$CONTAINER_NAME" rm /tmp/schema.sql
    else
        mysql -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" -p"$DB_PASSWORD" "$DB_NAME" < "$SCHEMA_FILE"
    fi
    
    if [ $? -eq 0 ]; then
        print_colored "$GREEN" "✓ Schema executed successfully"
    else
        print_colored "$RED" "✗ Failed to execute schema"
        exit 1
    fi
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -m|--mode)
            MODE="$2"
            shift 2
            ;;
        -d|--database)
            DB_NAME="$2"
            shift 2
            ;;
        -h|--host)
            DB_HOST="$2"
            shift 2
            ;;
        -P|--port)
            DB_PORT="$2"
            shift 2
            ;;
        -u|--user)
            DB_USER="$2"
            shift 2
            ;;
        -p|--password)
            DB_PASSWORD="$2"
            shift 2
            ;;
        -c|--container)
            CONTAINER_NAME="$2"
            shift 2
            ;;
        --help)
            show_usage
            exit 0
            ;;
        *)
            print_colored "$RED" "Unknown option: $1"
            show_usage
            exit 1
            ;;
    esac
done

# Validate mode
if [ -z "$MODE" ]; then
    print_colored "$RED" "Mode is required. Use -m or --mode option."
    show_usage
    exit 1
fi

if [[ ! "$MODE" =~ ^(local|docker|remote)$ ]]; then
    print_colored "$RED" "Invalid mode. Use 'local', 'docker', or 'remote'."
    exit 1
fi

# Main execution
print_colored "$BLUE" "=== Glorious Transfer Database Schema Setup ==="
print_colored "$YELLOW" "Mode: $MODE"
print_colored "$YELLOW" "Database: $DB_NAME"

# Check if schema file exists
if [ ! -f "$SCHEMA_FILE" ]; then
    print_colored "$RED" "✗ DATABASE_SCHEMA.sql not found at: $SCHEMA_FILE"
    exit 1
fi

# Get password if not provided
if [ -z "$DB_PASSWORD" ]; then
    read -s -p "Enter MySQL password for user '$DB_USER': " DB_PASSWORD
    echo ""
fi

# Validate environment based on mode
case $MODE in
    local)
        print_colored "$BLUE" "Checking local MySQL installation..."
        if ! command -v mysql &> /dev/null; then
            print_colored "$RED" "✗ MySQL client not found. Please install MySQL client."
            exit 1
        fi
        ;;
    docker)
        print_colored "$BLUE" "Checking Docker and container '$CONTAINER_NAME'..."
        if ! command -v docker &> /dev/null; then
            print_colored "$RED" "✗ Docker not found. Please install Docker."
            exit 1
        fi
        
        if ! docker ps -a --format "table {{.Names}}" | grep -q "^$CONTAINER_NAME$"; then
            print_colored "$RED" "✗ Container '$CONTAINER_NAME' not found."
            print_colored "$YELLOW" "Available containers:"
            docker ps -a --format "table {{.Names}}\t{{.Status}}"
            exit 1
        fi
        
        if ! docker ps --format "table {{.Names}}" | grep -q "^$CONTAINER_NAME$"; then
            print_colored "$BLUE" "Starting container '$CONTAINER_NAME'..."
            docker start "$CONTAINER_NAME"
            sleep 5
        fi
        ;;
    remote)
        print_colored "$BLUE" "Connecting to remote MySQL server at $DB_HOST:$DB_PORT..."
        if ! command -v mysql &> /dev/null; then
            print_colored "$RED" "✗ MySQL client not found. Please install MySQL client."
            exit 1
        fi
        ;;
esac

# Test connection
if ! test_mysql_connection; then
    print_colored "$RED" "✗ Failed to connect to MySQL server"
    print_colored "$YELLOW" "Please check your credentials and server status"
    exit 1
fi
print_colored "$GREEN" "✓ MySQL connection successful"

# Create database
create_database

# Execute schema
execute_schema

print_colored "$GREEN" "=== Database Schema Setup Complete ==="
print_colored "$BLUE" "Database '$DB_NAME' is ready for use."

# Optional: Show tables created
print_colored "$YELLOW" "\nTables in database:"
if [ "$MODE" = "docker" ]; then
    docker exec "$CONTAINER_NAME" mysql -u "$DB_USER" -p"$DB_PASSWORD" "$DB_NAME" -e "SHOW TABLES;"
else
    mysql -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" -p"$DB_PASSWORD" "$DB_NAME" -e "SHOW TABLES;"
fi