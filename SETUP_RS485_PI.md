# RS485 Setup for Raspberry Pi

The updated `serve_with_info.py` now includes RS485/Modbus support. Panel data from your MPPT charge controller will be automatically fetched and displayed on the website.

## Prerequisites

1. **RS485 Hardware**: Connect your RS485 USB adapter to the Raspberry Pi
2. **Python packages**:
   ```bash
   pip install --user psutil pymodbus
   ```

## Configuration

When running `serve_with_info.py`, set environment variables to configure Modbus:

### Basic Panel Voltage (MPPT)

```bash
cd ~/lowImpact.design
SERVE_HOST=0.0.0.0 SERVE_PORT=8000 \
SERIAL_PORT=/dev/ttyUSB0 \
REGISTER_ADDR=0 \
SCALE=100 \
python3 serve_with_info.py
```

This reads register 0 and divides by 100. Adjust `REGISTER_ADDR` and `SCALE` to match your MPPT controller's Modbus specification.

### Full Configuration (Panel + Battery)

```bash
cd ~/lowImpact.design
SERVE_HOST=0.0.0.0 SERVE_PORT=8000 \
SERIAL_PORT=/dev/ttyUSB0 \
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

## Testing

Once running, the `/sysinfo` endpoint will return panel and battery data:

```bash
curl http://192.168.1.101:8000/sysinfo | python3 -m json.tool
```

You should see fields like:
- `panel_output` (voltage in volts)
- `panel_v` (alternative name)
- `panel_a` (current in amps)
- `panel_w` (power in watts)
- `battery_soc` (state of charge in %)
- `battery_v`, `battery_a`, `battery_w` (voltage, current, power)
- `battery_temp` (temperature in °C)

## Finding Your MPPT Register Addresses

Use `modbus-cli` or the vendor's documentation:

```bash
# Example using pymodbus
python3 << 'EOF'
from pymodbus.client.sync import ModbusSerialClient
client = ModbusSerialClient(method='rtu', port='/dev/ttyUSB0', baudrate=9600)
if client.connect():
    rr = client.read_input_registers(address=0, count=10)
    print([r for r in rr.registers])
    client.close()
EOF
```

## Running as a Service (Optional)

Create `/etc/systemd/system/lowimpact.service`:

```ini
[Unit]
Description=LowImpact Design Website with RS485
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

Then enable and start:
```bash
sudo systemctl daemon-reload
sudo systemctl enable lowimpact
sudo systemctl start lowimpact
sudo systemctl status lowimpact
```

View logs:
```bash
sudo journalctl -u lowimpact -f
```

## Troubleshooting

- **No panel data in /sysinfo**: Check `SERIAL_PORT` exists and RS485 adapter is connected
- **Permission denied /dev/ttyUSB0**: Add user to dialout group: `sudo usermod -aG dialout pi`
- **pymodbus import error**: Run `pip install --user pymodbus`

For more details, see the embedded comments in `serve_with_info.py`.
