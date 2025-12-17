#!/usr/bin/env pwsh

<#
.SYNOPSIS
    Execute DATABASE_SCHEMA.sql on MySQL server
.DESCRIPTION
    This script runs the DATABASE_SCHEMA.sql file against a MySQL database.
    It can work with local MySQL, Docker containers, or remote MySQL servers.
.PARAMETER Mode
    Execution mode: 'local', 'docker', or 'remote'
.PARAMETER DatabaseName
    Name of the database (default: glorious_transfer)
.PARAMETER Host
    MySQL host (default: localhost for local/remote, mysql for docker)
.PARAMETER Port
    MySQL port (default: 3306)
.PARAMETER Username
    MySQL username (default: root)
.PARAMETER Password
    MySQL password (will prompt if not provided)
.PARAMETER ContainerName
    Docker container name (for docker mode, default: mysql)
.EXAMPLE
    .\run-database-schema.ps1 -Mode local
.EXAMPLE
    .\run-database-schema.ps1 -Mode docker -ContainerName glorious_transfer_mysql_1
.EXAMPLE
    .\run-database-schema.ps1 -Mode remote -Host 192.168.1.100 -Username myuser
#>

param(
    [Parameter(Mandatory=$true)]
    [ValidateSet("local", "docker", "remote")]
    [string]$Mode,
    
    [string]$DatabaseName = "glorious_transfer",
    [string]$Host = "localhost",
    [int]$Port = 3306,
    [string]$Username = "root",
    [string]$Password,
    [string]$ContainerName = "mysql"
)

# Script directory
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent $ScriptDir
$SchemaFile = Join-Path $ProjectRoot "DATABASE_SCHEMA.sql"

# Colors for output
$Red = "`e[31m"
$Green = "`e[32m"
$Yellow = "`e[33m"
$Blue = "`e[34m"
$Reset = "`e[0m"

function Write-ColoredOutput {
    param([string]$Message, [string]$Color = $Reset)
    Write-Host "${Color}${Message}${Reset}"
}

function Test-MySQLConnection {
    param($ConnectionString)
    
    try {
        if ($Mode -eq "docker") {
            $testResult = docker exec $ContainerName mysql -u $Username -p$Password -e "SELECT 1;" 2>&1
        } else {
            $testResult = mysql -h $Host -P $Port -u $Username -p$Password -e "SELECT 1;" 2>&1
        }
        
        if ($LASTEXITCODE -eq 0) {
            return $true
        }
        return $false
    }
    catch {
        return $false
    }
}

function Create-DatabaseIfNotExists {
    Write-ColoredOutput "Creating database '$DatabaseName' if it doesn't exist..." $Blue
    
    $createDbSql = "CREATE DATABASE IF NOT EXISTS $DatabaseName CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
    
    if ($Mode -eq "docker") {
        docker exec $ContainerName mysql -u $Username -p$Password -e $createDbSql
    } else {
        mysql -h $Host -P $Port -u $Username -p$Password -e $createDbSql
    }
    
    if ($LASTEXITCODE -eq 0) {
        Write-ColoredOutput "✓ Database created/verified successfully" $Green
    } else {
        Write-ColoredOutput "✗ Failed to create database" $Red
        exit 1
    }
}

function Execute-SchemaFile {
    Write-ColoredOutput "Executing DATABASE_SCHEMA.sql..." $Blue
    
    if ($Mode -eq "docker") {
        # Copy schema file to container and execute
        docker cp $SchemaFile "${ContainerName}:/tmp/schema.sql"
        docker exec $ContainerName mysql -u $Username -p$Password $DatabaseName -e "source /tmp/schema.sql"
        docker exec $ContainerName rm /tmp/schema.sql
    } else {
        mysql -h $Host -P $Port -u $Username -p$Password $DatabaseName < $SchemaFile
    }
    
    if ($LASTEXITCODE -eq 0) {
        Write-ColoredOutput "✓ Schema executed successfully" $Green
    } else {
        Write-ColoredOutput "✗ Failed to execute schema" $Red
        exit 1
    }
}

# Main execution
Write-ColoredOutput "=== Glorious Transfer Database Schema Setup ===" $Blue
Write-ColoredOutput "Mode: $Mode" $Yellow
Write-ColoredOutput "Database: $DatabaseName" $Yellow

# Check if schema file exists
if (-not (Test-Path $SchemaFile)) {
    Write-ColoredOutput "✗ DATABASE_SCHEMA.sql not found at: $SchemaFile" $Red
    exit 1
}

# Get password if not provided
if (-not $Password) {
    $SecurePassword = Read-Host "Enter MySQL password for user '$Username'" -AsSecureString
    $Password = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($SecurePassword))
}

# Validate environment based on mode
switch ($Mode) {
    "local" {
        Write-ColoredOutput "Checking local MySQL installation..." $Blue
        if (-not (Get-Command mysql -ErrorAction SilentlyContinue)) {
            Write-ColoredOutput "✗ MySQL client not found. Please install MySQL client." $Red
            exit 1
        }
    }
    "docker" {
        Write-ColoredOutput "Checking Docker and container '$ContainerName'..." $Blue
        if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
            Write-ColoredOutput "✗ Docker not found. Please install Docker." $Red
            exit 1
        }
        
        $containerExists = docker ps -a --format "table {{.Names}}" | Select-String $ContainerName
        if (-not $containerExists) {
            Write-ColoredOutput "✗ Container '$ContainerName' not found." $Red
            Write-ColoredOutput "Available containers:" $Yellow
            docker ps -a --format "table {{.Names}}\t{{.Status}}"
            exit 1
        }
        
        $containerRunning = docker ps --format "table {{.Names}}" | Select-String $ContainerName
        if (-not $containerRunning) {
            Write-ColoredOutput "Starting container '$ContainerName'..." $Blue
            docker start $ContainerName
            Start-Sleep 5
        }
    }
    "remote" {
        Write-ColoredOutput "Connecting to remote MySQL server at $Host:$Port..." $Blue
        if (-not (Get-Command mysql -ErrorAction SilentlyContinue)) {
            Write-ColoredOutput "✗ MySQL client not found. Please install MySQL client." $Red
            exit 1
        }
        $Host = $Host
    }
}

# Test connection
Write-ColoredOutput "Testing MySQL connection..." $Blue
if (-not (Test-MySQLConnection)) {
    Write-ColoredOutput "✗ Failed to connect to MySQL server" $Red
    Write-ColoredOutput "Please check your credentials and server status" $Yellow
    exit 1
}
Write-ColoredOutput "✓ MySQL connection successful" $Green

# Create database
Create-DatabaseIfNotExists

# Execute schema
Execute-SchemaFile

Write-ColoredOutput "=== Database Schema Setup Complete ===" $Green
Write-ColoredOutput "Database '$DatabaseName' is ready for use." $Blue

# Optional: Show tables created
Write-ColoredOutput "`nTables in database:" $Yellow
if ($Mode -eq "docker") {
    docker exec $ContainerName mysql -u $Username -p$Password $DatabaseName -e "SHOW TABLES;"
} else {
    mysql -h $Host -P $Port -u $Username -p$Password $DatabaseName -e "SHOW TABLES;"
}