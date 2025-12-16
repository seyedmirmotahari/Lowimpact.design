# Solution: RS485 Panel Data Now Integrated into serve_with_info.py

## The Problem

You had two separate servers:
1. **serve_with_info.py** (port 8000): Served the website + CPU/RAM/disk metrics
2. **rs485_server.py** (port 5000): Served RS485 MPPT panel voltage/current/power

When you deployed to Raspberry Pi, the website displayed correctly but showed `-` for "Panel output:" because the frontend JavaScript was fetching from `http://localhost:8000/sysinfo`, which didn't include panel data—only system stats.

## The Solution

**Integrated RS485/Modbus support directly into `serve_with_info.py`.**

Now a single server on port 8000 provides:
- Website files (HTML, CSS, JS)
- **System metrics**: CPU%, RAM%, Disk%, CPU temp
- **RS485 MPPT metrics**: Panel voltage, current, power, battery SOC, temp, etc.

All from the same `/sysinfo` endpoint.

## What Changed

### Updated Files

1. **serve_with_info.py** (main change)
   - Added Modbus client imports
   - Added RS485 configuration variables (SERIAL_PORT, REGISTER_ADDR, SCALE, etc.)
   - Added Modbus connection and register reading functions
   - Added `_poll_modbus_once()` to read panel/battery data
   - Updated `get_sysinfo()` to include Modbus data in the JSON response

2. **DEPLOY_TO_PI.md** (new)
   - Complete deployment guide with systemd service setup
   - Troubleshooting for RS485 on Raspberry Pi

3. **SETUP_RS485_PI.md** (new)
   - Technical reference for RS485 register configuration
   - Examples for different MPPT controllers

### Unchanged Files
- `index.html` — Already has the correct HTML element (`#server-panel-output`) and JavaScript handlers
- `script.js` — Already polls `/sysinfo` every 2 seconds and displays the data
- `rs485_server.py` — Can be retired or kept as reference

## How to Use on Raspberry Pi

### Quick Start (5 minutes)

```bash
# 1. SSH to Pi
ssh pi@192.168.1.101

# 2. Install dependencies
python3 -m pip install --user psutil pymodbus

# 3. Copy project from Mac (from Mac terminal)
rsync -av --delete /Users/mirmotahari/Desktop/lowImpact.design/ \
  pi@192.168.1.101:/home/pi/lowImpact.design/

# 4. Start server (back on Pi)
cd /home/pi/lowImpact.design
SERVE_HOST=0.0.0.0 SERVE_PORT=8000 \
SERIAL_PORT=/dev/ttyUSB0 \
REGISTER_ADDR=0 \
SCALE=100 \
python3 serve_with_info.py

# 5. Open browser
# http://192.168.1.101:8000
# → Panel Output should now show a voltage value!
```

### For Persistence (systemd service)

Follow the "Option B" instructions in `DEPLOY_TO_PI.md` to set up an auto-starting service.

## Configuration

Edit the environment variables when starting the server:

```bash
SERIAL_PORT=/dev/ttyUSB0    # RS485 adapter device path
REGISTER_ADDR=0              # Modbus register for panel voltage
SCALE=100                    # Divider for register value
BAUDRATE=9600                # RS485 baud rate
```

For additional registers (current, power, battery):

```bash
PANEL_A_ADDR=1 PANEL_A_SCALE=100   # Panel current
PANEL_W_ADDR=2 PANEL_W_SCALE=100   # Panel power
BATTERY_SOC_ADDR=3 BATTERY_SOC_SCALE=10   # Battery %
# ... etc
```

See `SETUP_RS485_PI.md` for full configuration examples.

## Verification

Once running, test the endpoint:

```bash
curl http://192.168.1.101:8000/sysinfo | python3 -m json.tool
```

You should see:
```json
{
  "cpu_percent": 15.2,
  "memory_percent": 42.1,
  "disk_percent": 65.3,
  "panel_output": 48.32,
  "panel_v": 48.32,
  "panel_a": 12.5,
  "panel_w": 604.0,
  "battery_soc": 85.0,
  ...
}
```

The frontend automatically displays this in the footer under "Server Stats":
- **Panel output:** 48.32 V
- **Battery SOC:** 85.0%
- etc.

## Troubleshooting

### Panel Output still shows "-"?

1. Check the API response: `curl http://192.168.1.101:8000/sysinfo`
2. If `panel_output` is `null`, RS485 read failed
3. Verify:
   - RS485 adapter is plugged in: `ls /dev/ttyUSB*`
   - `SERIAL_PORT` variable is correct
   - Your MPPT has Modbus enabled
   - `REGISTER_ADDR` and `SCALE` match your MPPT spec

### Permission denied on /dev/ttyUSB0?

```bash
sudo usermod -aG dialout pi
# Then log out and back in
```

### pymodbus import error?

```bash
python3 -m pip install --user pymodbus
```

## Next Steps

1. Find your MPPT's Modbus register addresses (check the manual or contact support)
2. Set the correct `REGISTER_ADDR` and `SCALE` values
3. (Optional) Configure additional registers for current, power, battery data
4. Deploy to Pi using the guides
5. Monitor your solar system in real-time!

---

**Questions?** Check the detailed setup guides (`DEPLOY_TO_PI.md`, `SETUP_RS485_PI.md`) or review the inline comments in `serve_with_info.py`.
