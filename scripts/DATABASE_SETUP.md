# Database Schema Execution Scripts

This directory contains scripts to execute the `DATABASE_SCHEMA.sql` file on your MySQL server.

## Available Scripts

### 1. PowerShell Script (Windows) - `run-database-schema.ps1`

**Usage:**
```powershell
# Local MySQL installation
.\scripts\run-database-schema.ps1 -Mode local

# Docker container (default container name 'mysql')
.\scripts\run-database-schema.ps1 -Mode docker

# Docker container with custom name
.\scripts\run-database-schema.ps1 -Mode docker -ContainerName "glorious_transfer_mysql_1"

# Remote MySQL server
.\scripts\run-database-schema.ps1 -Mode remote -Host "192.168.1.100" -Username "myuser"

# Full options
.\scripts\run-database-schema.ps1 -Mode local -DatabaseName "glorious_transfer" -Host "localhost" -Port 3306 -Username "root"
```

### 2. Bash Script (Linux/macOS) - `run-database-schema.sh`

**Make executable first:**
```bash
chmod +x scripts/run-database-schema.sh
```

**Usage:**
```bash
# Local MySQL installation
./scripts/run-database-schema.sh -m local

# Docker container (default container name 'mysql')
./scripts/run-database-schema.sh -m docker

# Docker container with custom name
./scripts/run-database-schema.sh -m docker -c "glorious_transfer_mysql_1"

# Remote MySQL server
./scripts/run-database-schema.sh -m remote -h "192.168.1.100" -u "myuser"

# Full options
./scripts/run-database-schema.sh -m local -d "glorious_transfer" -h "localhost" -P 3306 -u "root"
```

## Quick Setup Commands

### For Local MySQL:
```bash
# Create database and user
mysql -u root -p
CREATE DATABASE glorious_transfer CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'glorious_user'@'localhost' IDENTIFIED BY 'your_password';
GRANT ALL PRIVILEGES ON glorious_transfer.* TO 'glorious_user'@'localhost';
FLUSH PRIVILEGES;
EXIT;

# Run schema
./scripts/run-database-schema.sh -m local -u glorious_user
```

### For Docker:
```bash
# Start MySQL container
docker run --name mysql -e MYSQL_ROOT_PASSWORD=rootpassword -e MYSQL_DATABASE=glorious_transfer -p 3306:3306 -d mysql:8.0

# Run schema
./scripts/run-database-schema.sh -m docker -c mysql
```

### Using Docker Compose:
```bash
# If you have a docker-compose.yml with MySQL service
docker-compose up -d mysql

# Find container name
docker ps

# Run schema with the container name
./scripts/run-database-schema.sh -m docker -c "your_project_mysql_1"
```

## Script Features

- ✅ **Multi-environment support**: Works with local MySQL, Docker containers, and remote servers
- ✅ **Automatic database creation**: Creates the database if it doesn't exist
- ✅ **Connection testing**: Validates connection before executing schema
- ✅ **Error handling**: Clear error messages and proper exit codes
- ✅ **Security**: Prompts for password if not provided
- ✅ **Validation**: Checks for required tools (mysql client, docker)
- ✅ **Colored output**: Easy to read success/error messages
- ✅ **Table verification**: Shows created tables after successful execution

## Common Docker Container Names

If using Docker Compose, your container names might be:
- `glorious-transfer_mysql_1`
- `glorious_transfer_mysql_1`  
- `mysql`
- `db`

Find your container name with:
```bash
docker ps --format "table {{.Names}}\t{{.Status}}"
```

## Environment Variables

You can also set these environment variables instead of passing parameters:

```bash
export DB_HOST=localhost
export DB_PORT=3306
export DB_USER=root
export DB_PASSWORD=your_password
export DB_NAME=glorious_transfer
```

## Troubleshooting

### Connection Issues:
1. Check if MySQL is running: `systemctl status mysql` (Linux) or `docker ps` (Docker)
2. Verify credentials and permissions
3. Check firewall settings for remote connections
4. Ensure database exists or script has permission to create it

### Permission Issues:
```bash
# Make script executable
chmod +x scripts/run-database-schema.sh

# Grant database permissions
GRANT ALL PRIVILEGES ON glorious_transfer.* TO 'your_user'@'localhost';
```

### Docker Issues:
```bash
# Check if container exists and is running
docker ps -a

# Start stopped container
docker start container_name

# Check container logs
docker logs container_name
```