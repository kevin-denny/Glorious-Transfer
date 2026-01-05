# 🚨 EMERGENCY DATABASE SECURITY MIGRATION

Your database is being dropped due to severe security vulnerabilities. Follow these steps immediately to secure your system.

## Critical Issues Identified:

1. ❌ **Public MySQL exposure** on `159.223.52.48:3306`
2. ❌ **Weak credentials** (`root/root`)
3. ❌ **Full privileges to `root@'%'`** (anyone can connect)
4. ❌ **`DROP DATABASE IF EXISTS`** in schema file
5. ❌ **Firewall allows global MySQL access**

## Migration Steps (Execute in Order):

### Step 1: Backup Current Database
```bash
# Emergency backup before migration
mkdir -p /var/www/emergency_backup
mysqldump -h 159.223.52.48 -P 3306 -u root -proot glorious_transfer > /var/www/emergency_backup/final_backup_$(date +%Y%m%d_%H%M%S).sql
gzip /var/www/emergency_backup/final_backup_*.sql
```

### Step 2: Upload and Run Security Setup
```bash
# Upload the secure setup script to your server
cd /var/www/Glorious-Transfer

# Make scripts executable
chmod +x secure-mysql-setup.sh
chmod +x backup_db_secure.sh
chmod +x migrate-data.sh

# Run the security setup (IMPORTANT: Save the generated passwords!)
sudo ./secure-mysql-setup.sh
```

### Step 3: Migrate Your Existing Data
```bash
# Run the automated data migration (preserves all your data)
sudo ./migrate-data.sh

# This script will:
# - Connect to your remote database (159.223.52.48)
# - Create a full backup of all your data
# - Import it into the new secure local database
# - Verify data integrity
# - Create the updated environment file

# Check migration results
cat /var/www/migration/migration.log
```

### Step 4: Update Environment Configuration
```bash
# Use the migrated environment file (created by migrate-data.sh)
cp /var/www/migration/.env.production.migrated .env.production.new

# Verify the configuration
cat .env.production.new
```

### Step 5: Update Crontab for Secure Backup
```bash
# Edit crontab
crontab -e

# Replace the backup line with:
30 23 * * * /bin/bash /var/www/Glorious-Transfer/backup_db_secure.sh >> /var/www/backups/backup_cron.log 2>&1
```

### Step 6: Deploy with Secure Configuration
```bash
# Stop current containers
docker-compose down

# Backup current env file
cp .env.production .env.production.backup

# Use the new secure configuration
mv .env.production.new .env.production

# Use the secure docker-compose file
cp docker-compose.yml docker-compose.yml.backup
cp docker-compose.secure.yml docker-compose.yml

# Rebuild and deploy
docker-compose build --no-cache
docker-compose up -d
```

### Step 7: Verify Data Migration (Optional)
```bash
# If you want to double-check your data migrated correctly:
mysql -u NEW_APP_USER -p NEW_DATABASE_NAME

# Run some queries to verify your data is intact:
# SELECT COUNT(*) FROM your_main_tables;
# SELECT * FROM important_table LIMIT 5;
```

### Step 8: Verify Security
```bash
# Test that MySQL is no longer publicly accessible
nmap -p 3306 159.223.52.48
# Should show: 3306/tcp filtered mysql

# Test local connection works
mysql -h localhost -u glorious_app -p glorious_transfer

# Check app connectivity
docker logs glorious-transfer-app-1
```

## Key Changes Made:

### Database Security:
- ✅ MySQL now only accepts local connections (`127.0.0.1`)
- ✅ Strong generated passwords (25+ characters)
- ✅ Dedicated app user with limited privileges
- ✅ Root access restricted to localhost only
- ✅ Public port 3306 access removed

### Docker Configuration:
- ✅ Uses `host.docker.internal` to connect to host MySQL
- ✅ Added health checks
- ✅ Proper service dependencies

### Backup Security:
- ✅ Uses non-root database user
- ✅ Passwords stored in secure credentials file
- ✅ Local connections only

## Important Notes:

1. **Save Credentials**: The generated passwords are in `/var/www/mysql_credentials.txt`
2. **Test Thoroughly**: Verify app functionality after migration
3. **Monitor Logs**: Check for any connection issues
4. **Remove Old Files**: Delete old insecure configuration files

## Emergency Contact:
If you encounter issues during migration, the old configuration files are backed up with `.backup` extension.

## Post-Migration Verification:

```bash
# 1. Verify MySQL is not publicly accessible
telnet 159.223.52.48 3306
# Should fail to connect

# 2. Verify app is working
curl https://app.shemsilvatech.com/api/auth/status

# 3. Check backup job
tail -f /var/www/backups/backup_cron.log
```

**CRITICAL**: Do not skip any steps. Your database security depends on following this migration exactly.