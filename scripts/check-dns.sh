#!/bin/bash

echo "=== DNS Configuration Check ==="

DOMAIN="app.shemsilvatech.com"
SERVER_IP=$(curl -s ifconfig.me)

echo "Domain: $DOMAIN"
echo "Server IP: $SERVER_IP"
echo ""

# Check A record
echo "Checking A record for $DOMAIN..."
DNS_IP=$(dig +short $DOMAIN)
if [ "$DNS_IP" = "$SERVER_IP" ]; then
    echo "✅ DNS A record is correctly pointing to this server"
else
    echo "❌ DNS A record mismatch:"
    echo "   DNS points to: $DNS_IP"
    echo "   Server IP is: $SERVER_IP"
    echo ""
    echo "Please update your DNS A record to point to: $SERVER_IP"
fi

# Check WWW record
echo ""
echo "Checking A record for www.$DOMAIN..."
WWW_DNS_IP=$(dig +short www.$DOMAIN)
if [ "$WWW_DNS_IP" = "$SERVER_IP" ]; then
    echo "✅ DNS A record for www subdomain is correctly configured"
elif [ -z "$WWW_DNS_IP" ]; then
    echo "⚠️  No A record found for www.$DOMAIN"
    echo "   Consider adding: www.$DOMAIN -> $SERVER_IP"
else
    echo "❌ DNS A record for www subdomain mismatch:"
    echo "   DNS points to: $WWW_DNS_IP"
    echo "   Should point to: $SERVER_IP"
fi

# Test HTTP connectivity
echo ""
echo "Testing HTTP connectivity..."
if curl -s --max-time 10 http://$DOMAIN >/dev/null; then
    echo "✅ HTTP connection to $DOMAIN successful"
else
    echo "❌ HTTP connection to $DOMAIN failed"
    echo "   Make sure port 80 is open and nginx is running"
fi

echo ""
echo "DNS propagation can take up to 48 hours to complete worldwide."
