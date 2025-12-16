# Deploying lowImpact.design to Raspberry Pi with RS485 MPPT Support

## Quick Summary

The **website now serves both the frontend AND RS485 panel data from a single port (8000)**. 

Previously:
- `serve_with_info.py` → Port 8000 (website + CPU/RAM/Disk, NO panel data)
- `rs485_server.py` → Port 5000 (panel data from RS485, but separate)

**Now**: Both are integrated into `serve_with_info.py` on port 8000.

## Step 1: Install Dependencies on Raspberry Pi

```bash
# SSH into your Pi
ssh pi@192.168.1.101

# Install Python packages
python3 -m pip install --user psutil pymodbus

# Verify installations
python3 -c "import psutil; import pymodbus; print('OK')"
```

## Step 2: Copy Project to Raspberry Pi

From your Mac:

```bash
rsync -av --delete /Users/mirmotahari/Desktop/lowImpact.design/ \
  pi@192.168.1.101:/home/pi/lowImpact.design/
```

This copies all files including the updated `serve_with_info.py`.

## Step 3: Configure RS485 on Raspberry Pi

### Find the RS485 Device

Plug in your RS485 USB adapter and identify it:

```bash
ls /dev/ttyUSB*
```

You should see `/dev/ttyUSB0` or similar.

### Test Modbus Connection (Optional)

```bash
cd /home/pi/lowImpact.design
python3 << 'EOF'
from pymodbus.client.sync import ModbusSerialClient as ModbusClient
client = ModbusClient(method='rtu', port='/dev/ttyUSB0', baudrate=9600)
if client.connect():
    print("✓ Connected to MPPT")
    # Read registers 0-5
    rr = client.read_input_registers(address=0, count=5)
    if not rr.isError():
        print(f"Registers: {rr.registers}")
    client.close()
else:
    print("✗ Connection failed")
EOF
```

## Step 4: Start the Server

### Option A: Quick Start (Terminal Session)

```bash
cd /home/pi/lowImpact.design

# With RS485 enabled (adjust REGISTER_ADDR, SCALE for your MPPT)
SERVE_HOST=0.0.0.0 SERVE_PORT=8000 \
SERIAL_PORT=/dev/ttyUSB0 \
REGISTER_ADDR=0 \
SCALE=100 \
python3 serve_with_info.py
```

Then open http://192.168.1.101:8000 in your browser. You should see the Panel Output value in the footer.

### Option B: Run as Background Service (Recommended for Persistence)

```bash
# Create systemd service file
sudo nano /etc/systemd/system/lowimpact.service
```

Paste this content:

```ini
[Unit]
Description=LowImpact Design Website with RS485 MPPT Support
After=network.target

[Service]
Type=simple
User=pi
WorkingDirectory=/home/pi/lowImpact.design
Environment="SERVE_HOST=0.0.0.0"
Environment="SERVE_PORT=8000"
Environment="SERIAL_PORT=/dev/ttyUSB0"
Environment="REGISTER_ADDR=0"
Environment="SCALE=100"
ExecStart=/usr/bin/python3 serve_with_info.py
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Save (Ctrl+X, Y, Enter), then:

```bash
# Enable and start the service
sudo systemctl daemon-reload
sudo systemctl enable lowimpact
sudo systemctl start lowimpact

# Check status
sudo systemctl status lowimpact

# View logs (live)
sudo journalctl -u lowimpact -f
```

## Step 5: Verify on Raspberry Pi

```bash
# Test the API
curl http://localhost:8000/sysinfo | python3 -m json.tool

# Should return JSON with panel_output, panel_v, etc.:
# {
#   "cpu_percent": 25.5,
#   "panel_output": 48.32,
#   "panel_v": 48.32,
#   "panel_a": 12.5,
#   "panel_w": 604.0,
#   "battery_soc": 85.0,
#   ...
# }
```

## Step 6: Verify from Your Mac

```bash
# Open in browser
open http://192.168.1.101:8000

# Or test the API
curl http://192.168.1.101:8000/sysinfo | python3 -m json.tool
```

Look at the footer—you should see "Panel output:" with a voltage value.

## Troubleshooting

### Problem: Panel Output shows "-" or is missing

**Solution**: Check the `/sysinfo` response:
```bash
curl http://192.168.1.101:8000/sysinfo | python3 -m json.tool | grep panel
```

If `panel_output` is `null`, the RS485 read failed. Verify:
1. RS485 adapter is plugged in: `ls /dev/ttyUSB*`
2. `SERIAL_PORT` env var matches the device
3. `REGISTER_ADDR` and `SCALE` match your MPPT controller spec
4. Modbus is enabled on your MPPT (not all charge controllers have it)

### Problem: "Permission denied /dev/ttyUSB0"

```bash
# Add pi user to dialout group
sudo usermod -aG dialout pi

# Log out and back in, then try again
```

### Problem: "pymodbus: No module named"

```bash
python3 -m pip install --user pymodbus
```

### Problem: Service won't start

```bash
# Check logs
sudo journalctl -u lowimpact -n 50

# Edit service if needed
sudo systemctl edit lowimpact
```

## Customization: Panel and Battery Data

If your MPPT reports voltage, current, power, battery SOC, temperature, etc. on different registers:

```bash
# Full config example
SERVE_HOST=0.0.0.0 SERVE_PORT=8000 \
SERIAL_PORT=/dev/ttyUSB0 \
BAUDRATE=9600 \
PANEL_V_ADDR=0 PANEL_V_SCALE=100 \
PANEL_A_ADDR=1 PANEL_A_SCALE=100 \
PANEL_W_ADDR=2 PANEL_W_SCALE=100 \
BATTERY_SOC_ADDR=3 BATTERY_SOC_SCALE=10 \
BATTERY_V_ADDR=4 BATTERY_V_SCALE=100 \
BATTERY_A_ADDR=5 BATTERY_A_SCALE=100 \
BATTERY_W_ADDR=6 BATTERY_W_SCALE=100 \
BATTERY_TEMP_ADDR=7 BATTERY_TEMP_SCALE=100 \
python3 serve_with_info.py
```

Update the systemd service `Environment=` lines similarly.

## Website Features

Once deployed, you'll see in the footer:

- **System Usage**: CPU, RAM, Storage (from the Pi)
- **Server Stats** (if present): Panel Output, Battery SOC, etc. (from RS485 MPPT)
- **Display Energy**: Estimated energy used by the OLED screen

All data is fetched every 2 seconds and displayed live.

## Next Steps

- Configure your MPPT's Modbus registers
- Adjust `REGISTER_ADDR`, `SCALE`, and address/scale pairs for your specific controller
- Monitor the web interface as your solar system operates
- Use systemd service to ensure it auto-starts on Pi reboot

For technical details on register addresses, consult your MPPT controller's Modbus specification or contact the manufacturer.
