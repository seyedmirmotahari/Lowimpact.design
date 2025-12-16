# Quick Reference: RS485 Panel Data Integration

## What Was Fixed

Your website on Raspberry Pi was **missing RS485 panel data** in the footer because:
- The website (port 8000) served `serve_with_info.py` → no panel data
- The RS485 server (port 5000) was separate → frontend couldn't reach it due to CORS/port issues

## What's Fixed Now

**Single server, single port (8000), all data together:**
```
GET http://192.168.1.101:8000/sysinfo → Returns:
{
  "cpu_percent": 25.5,
  "panel_output": 48.32,     ← NEW: From RS485 MPPT
  "panel_a": 12.5,            ← NEW: Current
  "panel_w": 604.0,           ← NEW: Power
  "battery_soc": 85.0,        ← NEW: Battery %
  ...
}
```

## Deploy Steps

### On Raspberry Pi (5 minutes)

```bash
# 1. Install Python packages
python3 -m pip install --user psutil pymodbus

# 2. Copy project from Mac
rsync -av --delete /Users/mirmotahari/Desktop/lowImpact.design/ \
  pi@192.168.1.101:/home/pi/lowImpact.design/

# 3. Start server
cd /home/pi/lowImpact.design
SERVE_HOST=0.0.0.0 SERVE_PORT=8000 \
SERIAL_PORT=/dev/ttyUSB0 \
REGISTER_ADDR=0 \
SCALE=100 \
python3 serve_with_info.py

# 4. Open http://192.168.1.101:8000
#    → Scroll to footer
#    → See "Panel output: XX.XX V"
```

## Environment Variables

| Variable | Example | Purpose |
|----------|---------|---------|
| `SERIAL_PORT` | `/dev/ttyUSB0` | RS485 adapter device |
| `REGISTER_ADDR` | `0` | MPPT panel voltage register |
| `SCALE` | `100` | Divider for register value |
| `PANEL_A_ADDR` | `1` | Panel current register (optional) |
| `BATTERY_SOC_ADDR` | `3` | Battery % register (optional) |

Find your MPPT's register addresses in its Modbus documentation or spec sheet.

## Files Created

- **serve_with_info.py** ← Updated with Modbus support
- **DEPLOY_TO_PI.md** ← Full deployment guide
- **SETUP_RS485_PI.md** ← Technical RS485 setup
- **RS485_INTEGRATION_SUMMARY.md** ← This solution explained
- **QUICK_REF.md** ← Quick reference (this file)

## Verify It Works

```bash
# From Mac
curl http://192.168.1.101:8000/sysinfo | python3 -m json.tool

# Look for:
# "panel_output": 48.32,
# "panel_v": 48.32,
# "panel_a": 12.5,
# "panel_w": 604.0,
# ...
```

If you see `"panel_output": null`, the RS485 read failed. Check:
1. RS485 adapter plugged in: `ls /dev/ttyUSB*`
2. `SERIAL_PORT` matches device path
3. MPPT's Modbus is enabled
4. `REGISTER_ADDR` and `SCALE` are correct

## Optional: Run as Auto-Starting Service

See **DEPLOY_TO_PI.md** → "Option B: Run as Background Service"

Sets up systemd so the server starts automatically on Pi reboot.

---

**Your website is now solar-powered AND shows live solar data!** ☀️
