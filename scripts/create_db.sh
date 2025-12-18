#!/bin/bash

# Database connection details
DB_HOST="159.223.52.48"
DB_PORT="3306"
DB_USER="root"
DB_PASSWORD="root"
DB_NAME="glorious_transfer"
SCHEMA_FILE="../DATABASE_SCHEMA.sql"

echo "Creating database: $DB_NAME"

# Check if schema file exists
if [ ! -f "$SCHEMA_FILE" ]; then
    echo "Error: Schema file $SCHEMA_FILE not found!"
    exit 1
fi

# Create database if it doesn't exist
echo "Creating database if it doesn't exist..."
mysql -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" -p"$DB_PASSWORD" -e "CREATE DATABASE IF NOT EXISTS $DB_NAME;"

if [ $? -eq 0 ]; then
    echo "Database created successfully or already exists."
else
    echo "Error: Failed to create database."
    exit 1
fi

# Execute schema file
echo "Executing schema file: $SCHEMA_FILE"
mysql -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" -p"$DB_PASSWORD" "$DB_NAME" < "$SCHEMA_FILE"

if [ $? -eq 0 ]; then
    echo "Schema executed successfully!"
    echo "Database $DB_NAME is ready to use."
else
    echo "Error: Failed to execute schema file."
    exit 1
fi

echo "Database setup complete!"
