RS485 -> HTTP bridge (example) for Raspberry Pi Zero 2 W
======================================================

Overview
--------
This repository file `rs485_server.py` is a small example service that reads
panel voltage from an RS485 / Modbus RTU device and exposes it over HTTP at
`/sysinfo` as JSON. It also optionally serves the static files in the same
directory (so you can host the site and API from the Pi and avoid CORS).

Features
- Example using Python + Flask + pymodbus
- Mock mode for development without hardware (`--mock`)
- Optional CORS support (`--cors`) via `flask-cors`

Quick setup on the Pi Zero 2 W
-----------------------------
1. Update system and install Python3/pip if missing (on Raspberry Pi OS):

```bash
sudo apt update
sudo apt install python3 python3-venv python3-pip -y
```

2. Create a virtualenv and install dependencies:

```bash
python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install flask pymodbus pyserial
# Optional for CORS support when serving from a separate origin:
pip install flask-cors
```

3. Configure serial/modbus settings

Edit environment variables or the top of `rs485_server.py` to match your
hardware:

- `SERIAL_PORT` (e.g. `/dev/ttyUSB0` for a USB↔RS485 adapter)
- `BAUDRATE` (e.g. `9600`)
- `MODBUS_UNIT` (Modbus device ID)
- `REGISTER_ADDR` (register index to read)
- `SCALE` (e.g. `100.0` means raw register 1234 -> 12.34 V)

You can set these via environment variables too, for example:

```bash
export SERIAL_PORT=/dev/ttyUSB0
export BAUDRATE=9600
export MODBUS_UNIT=1
export REGISTER_ADDR=0
export SCALE=100
```

Running the server
------------------
From the project directory (where `index.html` lives) run:

```bash
# mock mode (no RS485 needed)
python3 rs485_server.py --mock --port 5000

# real hardware
python3 rs485_server.py --port 5000

# enable CORS if your web frontend is served from a different origin
python3 rs485_server.py --port 5000 --cors
```

The server will expose:

- `http://<pi-ip>:5000/` -> serves `index.html` and other files from the
  repository root (so you can open the web UI and the API without cross-origin issues)
- `http://<pi-ip>:5000/sysinfo` -> returns JSON with `panel_output` (volts)

Example `/sysinfo` response
---------------------------
```json
{
  "panel_output": 12.34,
  "power_watts": null,
  "uptime_seconds": 5
}
```

Modbus register notes
---------------------
- Many solar controllers expose panel voltage as a single 16-bit register. The
  value may be scaled (e.g. raw=1234 means 12.34 V). Adjust `SCALE` accordingly.
- If your device stores the voltage across two registers or uses a different
  format, you'll need to adapt the `read_panel_voltage_from_device()` function
  to decode it correctly.

Running as a systemd service (optional)
---------------------------------------
Create `/etc/systemd/system/rs485_server.service` with contents like:

```
[Unit]
Description=RS485 -> HTTP bridge
After=network.target

[Service]
User=pi
WorkingDirectory=/home/pi/your-project-folder
Environment=PYTHONUNBUFFERED=1
ExecStart=/home/pi/your-project-folder/venv/bin/python /home/pi/your-project-folder/rs485_server.py --port 5000
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

Then enable and start:

```bash
sudo systemctl daemon-reload
sudo systemctl enable rs485_server
sudo systemctl start rs485_server
sudo journalctl -u rs485_server -f
```

Security & production notes
--------------------------
- This example is intended for local networks and prototyping. For internet
  exposure use HTTPS and an authentication layer.
- Make sure serial device permissions are correct; add the running user to
  `dialout` or `tty` group as required.

If you want, I can also add a small systemd unit file to this repo or
implement a slightly more robust reader (retries, 32-bit values, etc.).
