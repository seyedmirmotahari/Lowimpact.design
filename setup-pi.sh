#!/bin/bash
# Setup script for LowImpact.design on Raspberry Pi
# Run as: bash setup-pi.sh

echo "=== LowImpact.design Pi Setup ==="

# 1. Install Python dependencies
echo "Installing Python dependencies..."
pip3 install psutil

# 2. Copy systemd service
echo "Installing systemd service..."
sudo cp lowimpact-sysinfo.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable lowimpact-sysinfo
sudo systemctl start lowimpact-sysinfo

# 3. Setup nginx reverse proxy
echo "Configuring nginx..."
sudo cp nginx-lowimpact.conf /etc/nginx/sites-available/lowimpact
sudo rm -f /etc/nginx/sites-enabled/default
sudo ln -sf /etc/nginx/sites-available/lowimpact /etc/nginx/sites-enabled/lowimpact
sudo nginx -t
sudo systemctl reload nginx

# 4. Verify services
echo ""
echo "=== Service Status ==="
sudo systemctl status lowimpact-sysinfo --no-pager
sudo systemctl status nginx --no-pager

echo ""
echo "=== Testing /sysinfo endpoint ==="
sleep 2
curl http://127.0.0.1:8001/sysinfo | python3 -m json.tool || echo "Error: /sysinfo not responding"

echo ""
echo "=== Setup Complete ==="
echo "Visit: http://<pi-ip> to access the website"
echo "Logs: sudo journalctl -u lowimpact-sysinfo -f"
