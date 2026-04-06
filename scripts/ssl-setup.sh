#!/bin/bash

echo "=== SSL Certificate Setup ==="

#DOMAIN="app.shemsilvatech.com"
DOMAIN="fierryranger.me"
echo "Setting up SSL for domain: $DOMAIN"

read -p "Do you want to use Let's Encrypt SSL (free) or create self-signed certificate? (letsencrypt/self-signed): " ssl_type

if [ "$ssl_type" = "letsencrypt" ] || [ "$ssl_type" = "le" ]; then
    echo "Setting up Let's Encrypt SSL certificate for $DOMAIN..."
    
    # Install certbot if not already installed
    sudo apt update
    sudo apt install -y certbot python3-certbot-nginx
    
    # Stop nginx and docker containers temporarily
    echo "Stopping services for certificate generation..."
    sudo systemctl stop nginx
    docker-compose down 2>/dev/null || true
    
    # Obtain certificate using standalone mode
    echo "Obtaining SSL certificate from Let's Encrypt..."
    # sudo certbot certonly --standalone --agree-tos --no-eff-email --email admin@$DOMAIN -d $DOMAIN -d www.$DOMAIN
    sudo certbot certonly --standalone --agree-tos --no-eff-email --email admin@$DOMAIN -d $DOMAIN
    
    if [ $? -eq 0 ]; then
        # Create ssl directory and copy certificates
        echo "Creating SSL directory and copying certificates..."
        mkdir -p ssl
        sudo cp /etc/letsencrypt/live/$DOMAIN/fullchain.pem ssl/cert.pem
        sudo cp /etc/letsencrypt/live/$DOMAIN/privkey.pem ssl/key.pem
        sudo chown $USER:$USER ssl/*.pem
        sudo chmod 644 ssl/cert.pem
        sudo chmod 600 ssl/key.pem
        
        # Setup auto-renewal cron job
        echo "Setting up auto-renewal..."
        echo "0 12 * * * /usr/bin/certbot renew --quiet && /usr/bin/docker-compose -f $(pwd)/docker-compose.yml restart nginx" | sudo crontab -
        
        echo "✅ Let's Encrypt SSL certificate installed successfully!"
    else
        echo "❌ Failed to obtain Let's Encrypt certificate"
        echo "Falling back to self-signed certificate..."
        ssl_type="self-signed"
    fi
fi

if [ "$ssl_type" = "self-signed" ] || [ "$ssl_type" = "self" ]; then
    echo "Creating self-signed SSL certificate for $DOMAIN..."
    
    mkdir -p ssl
    
    # Generate self-signed certificate
    sudo openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
        -keyout ssl/key.pem \
        -out ssl/cert.pem \
        -subj "/C=US/ST=State/L=City/O=Organization/CN=$DOMAIN"
    
    # Set proper permissions
    sudo chown $USER:$USER ssl/*.pem
    sudo chmod 644 ssl/cert.pem
    sudo chmod 600 ssl/key.pem
    
    echo "✅ Self-signed SSL certificate created"
    echo "⚠️  Warning: Browsers will show a security warning for self-signed certificates"
fi

# Update nginx.conf with the correct domain
echo "Updating nginx configuration..."
if [ -f nginx.conf ]; then
    sed -i "s/your-domain.com/$DOMAIN/g" nginx.conf
    echo "✅ Updated nginx.conf with domain: $DOMAIN"
else
    echo "⚠️  nginx.conf not found in current directory"
fi

# Update .env.production.example with correct domain
if [ -f .env.production.example ]; then
    sed -i "s/https:\/\/yourdomain.com/https:\/\/$DOMAIN/g" .env.production.example
    echo "✅ Updated .env.production.example with domain: $DOMAIN"
fi

# Verify SSL files
echo "Verifying SSL certificate files..."
if [ -f ssl/cert.pem ] && [ -f ssl/key.pem ]; then
    echo "✅ SSL certificate files are present:"
    echo "   - Certificate: ssl/cert.pem"
    echo "   - Private Key: ssl/key.pem"
    
    # Test certificate validity
    if openssl x509 -in ssl/cert.pem -text -noout &>/dev/null; then
        echo "✅ Certificate file is valid"
        echo "Certificate details:"
        openssl x509 -in ssl/cert.pem -subject -dates -noout
    else
        echo "❌ Certificate file appears to be invalid"
    fi
else
    echo "❌ SSL certificate files are missing"
    exit 1
fi

echo ""
echo "=== SSL Setup Completed ==="
echo "Domain: $DOMAIN"
echo "Certificate type: $ssl_type"
echo "Certificate location: $(pwd)/ssl/"
echo ""
echo "Next steps:"
echo "1. Make sure your domain DNS points to this server IP: $(curl -s ifconfig.me)"
echo "2. Start your application: ./deploy.sh"
echo "3. Test HTTPS: https://$DOMAIN"
echo ""
if [ "$ssl_type" = "letsencrypt" ]; then
    echo "Let's Encrypt certificate will auto-renew every 60 days"
else
    echo "Self-signed certificate is valid for 365 days"
fi
