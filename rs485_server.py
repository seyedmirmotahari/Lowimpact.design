#!/usr/bin/env python3
"""
Simple RS485 -> HTTP bridge for Raspberry Pi (Modbus RTU)

Provides a minimal Flask app that reads a Modbus register (panel voltage)
over an RS485 serial adapter and exposes the value at /sysinfo as JSON.

Features:
- Uses pymodbus to read registers (Modbus RTU)
- Optional mock mode for local development without hardware
- Optional CORS support (requires flask-cors)
- Can serve the static site from the same process to avoid CORS issues

Edit SERIAL_PORT, BAUDRATE, REGISTER_ADDR, SCALE to match your device.
"""

import os
import time
import threading
import argparse
from flask import Flask, jsonify, send_from_directory, abort

try:
    from pymodbus.client.sync import ModbusSerialClient as ModbusClient
except Exception:
    ModbusClient = None

try:
    from flask_cors import CORS
except Exception:
    CORS = None

app = Flask(__name__, static_folder='.')

# --------------------- Configuration ---------------------
SERIAL_PORT = os.environ.get('SERIAL_PORT', '/dev/ttyUSB0')
BAUDRATE = int(os.environ.get('BAUDRATE', '9600'))
MODBUS_UNIT = int(os.environ.get('MODBUS_UNIT', '1'))
REGISTER_ADDR = int(os.environ.get('REGISTER_ADDR', '0'))
REGISTER_COUNT = int(os.environ.get('REGISTER_COUNT', '1'))
SCALE = float(os.environ.get('SCALE', '100.0'))

# Optional addresses/scales for richer telemetry (panel and battery)
def _env_int(name, default=None):
    try:
        return int(os.environ.get(name)) if os.environ.get(name) is not None else default
    except Exception:
        return default

def _env_float(name, default=None):
    try:
        return float(os.environ.get(name)) if os.environ.get(name) is not None else default
    except Exception:
        return default

PANEL_V_ADDR = _env_int('PANEL_V_ADDR', REGISTER_ADDR)
PANEL_V_SCALE = _env_float('PANEL_V_SCALE', SCALE)
PANEL_A_ADDR = _env_int('PANEL_A_ADDR', None)
PANEL_A_SCALE = _env_float('PANEL_A_SCALE', 100.0)
PANEL_W_ADDR = _env_int('PANEL_W_ADDR', None)
PANEL_W_SCALE = _env_float('PANEL_W_SCALE', 100.0)

BATTERY_SOC_ADDR = _env_int('BATTERY_SOC_ADDR', None)
BATTERY_SOC_SCALE = _env_float('BATTERY_SOC_SCALE', 10.0)
BATTERY_V_ADDR = _env_int('BATTERY_V_ADDR', None)
BATTERY_V_SCALE = _env_float('BATTERY_V_SCALE', 10.0)
BATTERY_A_ADDR = _env_int('BATTERY_A_ADDR', None)
BATTERY_A_SCALE = _env_float('BATTERY_A_SCALE', 100.0)
BATTERY_W_ADDR = _env_int('BATTERY_W_ADDR', None)
BATTERY_W_SCALE = _env_float('BATTERY_W_SCALE', 10.0)
BATTERY_TEMP_ADDR = _env_int('BATTERY_TEMP_ADDR', None)
BATTERY_TEMP_SCALE = _env_float('BATTERY_TEMP_SCALE', 10.0)
BATTERY_STATUS_TEXT = os.environ.get('BATTERY_STATUS_TEXT')

POLL_INTERVAL = float(os.environ.get('POLL_INTERVAL', '2.0'))

# --------------------- Runtime state ---------------------
_client = None
_last_panel_voltage = None
_last_read_time = 0
_last_values = {}
_stop_flag = threading.Event()

# --------------------- Modbus functions ---------------------
def connect_modbus():
    global _client
    if ModbusClient is None:
        return None
    client = ModbusClient(method='rtu', port=SERIAL_PORT, baudrate=BAUDRATE, timeout=1)
    try:
        client.connect()
        return client
    except Exception:
        try:
            client.close()
        except Exception:
            pass
        return None

def read_panel_voltage_from_device():
    """Read configured Modbus registers and return a float (or None)."""
    global _client
    if ModbusClient is None:
        return None
    if _client is None:
        _client = connect_modbus()
        if _client is None:
            return None
    try:
        rr = _client.read_input_registers(address=REGISTER_ADDR, count=REGISTER_COUNT, unit=MODBUS_UNIT)
        if getattr(rr, 'isError', lambda: True)():
            rr = _client.read_holding_registers(address=REGISTER_ADDR, count=REGISTER_COUNT, unit=MODBUS_UNIT)
            if getattr(rr, 'isError', lambda: True)():
                return None
        if not hasattr(rr, 'registers') or not rr.registers:
            return None
        raw = rr.registers[0]
        if raw >= 0x8000:
            raw = raw - 0x10000
        return float(raw) / SCALE
    except Exception:
        try:
            _client.close()
        except Exception:
            pass
        _client = None
        return None

def read_register_scaled(addr, scale):
    """Generic helper to read a single register and scale it."""
    global _client
    if addr is None:
        return None
    if _client is None:
        _client = connect_modbus()
        if _client is None:
            return None
    try:
        rr = _client.read_input_registers(address=addr, count=1, unit=MODBUS_UNIT)
        if getattr(rr, 'isError', lambda: True)():
            rr = _client.read_holding_registers(address=addr, count=1, unit=MODBUS_UNIT)
            if getattr(rr, 'isError', lambda: True)():
                return None
        if not hasattr(rr, 'registers') or not rr.registers:
            return None
        raw = rr.registers[0]
        if raw >= 0x8000:
            raw = raw - 0x10000
        val = float(raw)
        if scale not in (None, 0):
            val = val / float(scale)
        return val
    except Exception:
        try:
            _client.close()
        except Exception:
            pass
        _client = None
        return None

def poll_loop():
    global _last_panel_voltage, _last_read_time, _last_values
    while not _stop_flag.is_set():
        try:
            updated = False
            panel_v = read_panel_voltage_from_device()
            if panel_v is None:
                panel_v = read_register_scaled(PANEL_V_ADDR, PANEL_V_SCALE)
            if panel_v is not None:
                _last_panel_voltage = panel_v
                _last_values['panel_v'] = panel_v
                updated = True

            panel_a = read_register_scaled(PANEL_A_ADDR, PANEL_A_SCALE)
            if panel_a is not None:
                _last_values['panel_a'] = panel_a
                updated = True

            panel_w = read_register_scaled(PANEL_W_ADDR, PANEL_W_SCALE)
            if panel_w is not None:
                _last_values['panel_w'] = panel_w
                updated = True

            soc = read_register_scaled(BATTERY_SOC_ADDR, BATTERY_SOC_SCALE)
            if soc is not None:
                _last_values['battery_soc'] = soc
                updated = True

            batt_v = read_register_scaled(BATTERY_V_ADDR, BATTERY_V_SCALE)
            if batt_v is not None:
                _last_values['battery_v'] = batt_v
                updated = True

            batt_a = read_register_scaled(BATTERY_A_ADDR, BATTERY_A_SCALE)
            if batt_a is not None:
                _last_values['battery_a'] = batt_a
                updated = True

            batt_w = read_register_scaled(BATTERY_W_ADDR, BATTERY_W_SCALE)
            if batt_w is not None:
                _last_values['battery_w'] = batt_w
                updated = True

            batt_temp = read_register_scaled(BATTERY_TEMP_ADDR, BATTERY_TEMP_SCALE)
            if batt_temp is not None:
                _last_values['battery_temp_c'] = batt_temp
                updated = True

            if updated:
                _last_read_time = time.time()
        except Exception:
            # Swallow exceptions to keep the loop alive
            pass
        time.sleep(POLL_INTERVAL)

# --------------------- Flask routes ---------------------
@app.route('/sysinfo')
def sysinfo():
    """Return JSON with panel output and uptime."""
    panel_v = _last_values.get('panel_v', _last_panel_voltage)
    battery_status_text = _last_values.get('battery_status_text') or BATTERY_STATUS_TEXT
    if not battery_status_text:
        try:
            curr = _last_values.get('battery_a')
            if curr is not None:
                battery_status_text = 'Charging' if curr > 0 else 'Discharging'
        except Exception:
            battery_status_text = None
    resp = {
        'panel_output': round(float(panel_v), 2) if panel_v is not None else None,
        'panel_v': panel_v,
        'panel_a': _last_values.get('panel_a'),
        'panel_w': _last_values.get('panel_w'),
        'power_watts': _last_values.get('panel_w') or _last_values.get('battery_w'),
        'uptime_seconds': int(time.time() - _last_read_time) if _last_read_time else None,
        'battery_soc': _last_values.get('battery_soc'),
        'battery_status_text': battery_status_text,
        'battery_v': _last_values.get('battery_v'),
        'battery_a': _last_values.get('battery_a'),
        'battery_w': _last_values.get('battery_w'),
        'battery_temp_c': _last_values.get('battery_temp_c'),
    }
    return jsonify(resp)

@app.route('/', defaults={'path': 'index.html'})
@app.route('/<path:path>')
def static_proxy(path):
    """Serve files from app folder to host the web UI from Flask."""
    if os.path.isfile(path):
        return send_from_directory('.', path)
    abort(404)

# --------------------- Main ---------------------
def main():
    parser = argparse.ArgumentParser(description='RS485 -> HTTP bridge')
    parser.add_argument('--host', default='0.0.0.0')
    parser.add_argument('--port', type=int, default=5000)
    parser.add_argument('--mock', action='store_true', help='Run in mock mode (no hardware)')
    parser.add_argument('--cors', action='store_true', help='Enable CORS (requires flask-cors)')
    args = parser.parse_args()

    if args.mock:
        def mock_loop():
            global _last_panel_voltage, _last_read_time, _last_values
            v = 12.34
            while not _stop_flag.is_set():
                v = 11.5 + (time.time() % 10) * 0.18
                _last_panel_voltage = round(v, 2)
                _last_values.update({
                    'panel_v': _last_panel_voltage,
                    'panel_a': 0.31,
                    'panel_w': round(_last_panel_voltage * 0.3, 2),
                    'battery_soc': 88.0,
                    'battery_status_text': 'Charging',
                    'battery_v': 88.7,
                    'battery_a': 99.7,
                    'battery_w': 0.0,
                    'battery_temp_c': 23.0,
                })
                _last_read_time = time.time()
                time.sleep(POLL_INTERVAL)
        t = threading.Thread(target=mock_loop, daemon=True)
        t.start()
    else:
        t = threading.Thread(target=poll_loop, daemon=True)
        t.start()

    if args.cors and CORS is not None:
        CORS(app)

    try:
        app.run(host=args.host, port=args.port)
    finally:
        _stop_flag.set()

if __name__ == '__main__':
    main()
