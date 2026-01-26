#!/bin/bash
# Deploy LowImpact.design to Raspberry Pi
# Run: ./deploy-to-pi.sh

set -e  # Exit on error

PI_USER="pi"
PI_HOST="192.168.1.101"
PI_PATH="/home/pi/lowImpact.design"

echo "🚀 Deploying LowImpact.design to Raspberry Pi..."
echo "Target: $PI_USER@$PI_HOST:$PI_PATH"

# 1. Sync all website files
echo "📁 Syncing website files..."
rsync -av --delete \
    --exclude='.git' \
    --exclude='.DS_Store' \
    --exclude='*.pyc' \
    --exclude='__pycache__' \
    /Users/mirmotahari/Desktop/lowImpact.design/ \
    "$PI_USER@$PI_HOST:$PI_PATH/"

# 2. Deploy nginx config
echo "🔧 Deploying nginx config..."
scp /Users/mirmotahari/Desktop/lowImpact.design/nginx-lowimpact-https.conf \
    "$PI_USER@$PI_HOST:/tmp/nginx-lowimpact-https.conf"

# 3. Apply nginx config and reload
echo "♻️  Applying nginx config and reloading..."
ssh "$PI_USER@$PI_HOST" <<'SSH_COMMANDS'
    # Copy nginx config to proper location
    sudo cp /tmp/nginx-lowimpact-https.conf /etc/nginx/sites-available/lowimpact
    
    # Test nginx syntax
    echo "Testing nginx config..."
    sudo nginx -t
    
    # Reload nginx
    echo "Reloading nginx..."
    sudo systemctl reload nginx
    
    # Verify status
    echo "Checking nginx status..."
    sudo systemctl status nginx --no-pager
    
    echo "✅ Nginx reloaded successfully!"
SSH_COMMANDS

echo ""
echo "✅ Deployment complete!"
echo ""
echo "Next steps:"
echo "1. Test from your Mac with a different network"
echo "2. Visit: https://lowimpactdesign.me"
echo "3. Open browser console (F12) to check for errors"
echo "4. Verify /sysinfo loads in all browsers (Chrome, Firefox, Safari, Edge)"
echo ""
