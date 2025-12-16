# Production Deployment Guide

## Quick Deployment

### Option 1: Direct Node.js Server
```bash
# Install dependencies
npm ci --only=production

# Build the application
npm run build

# Start production server
npm run start:server
```

### Option 2: Using PM2 (Recommended)
```bash
# Install PM2 globally
npm install -g pm2

# Build and start with PM2
npm run build
pm2 start ecosystem.config.js --env production

# Save PM2 configuration
pm2 save
pm2 startup
```

### Option 3: Using Deploy Script
```bash
# Make script executable
chmod +x deploy.sh

# Run deployment
./deploy.sh
```

## Environment Setup

1. Copy `.env.production` and update with your values:
   - Database connection details
   - JWT secret key
   - Production URLs

2. Ensure your database is set up with the schema from `DATABASE_SCHEMA.sql`

## Server Requirements

- Node.js 18+
- MySQL 8.0+
- Minimum 512MB RAM
- 10GB disk space

## Security Checklist

- [ ] Environment variables are secure
- [ ] Database credentials are protected
- [ ] JWT secret is strong and unique
- [ ] HTTPS is enabled
- [ ] Firewall is configured
- [ ] Regular backups are scheduled

## Monitoring

Use PM2 for process management:
```bash
# View logs
pm2 logs glorious-transfer

# Monitor processes
pm2 monit

# Restart application
pm2 restart glorious-transfer
```

## Troubleshooting

### Build Issues
- Check Node.js version (18+)
- Ensure all dependencies are installed
- Verify environment variables

### Runtime Issues
- Check database connectivity
- Verify JWT secret is set
- Review application logs

### Performance Issues
- Enable PM2 cluster mode
- Configure nginx reverse proxy
- Optimize database queries
