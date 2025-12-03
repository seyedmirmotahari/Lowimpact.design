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

POLL_INTERVAL = float(os.environ.get('POLL_INTERVAL', '2.0'))

# --------------------- Runtime state ---------------------
_client = None
_last_panel_voltage = None
_last_read_time = 0
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

def poll_loop():
    global _last_panel_voltage, _last_read_time
    while not _stop_flag.is_set():
        v = read_panel_voltage_from_device()
        if v is not None:
            _last_panel_voltage = v
            _last_read_time = time.time()
        time.sleep(POLL_INTERVAL)

# --------------------- Flask routes ---------------------
@app.route('/sysinfo')
def sysinfo():
    """Return JSON with panel output and uptime."""
    resp = {
        'panel_output': None,
        'power_watts': None,
        'uptime_seconds': int(time.time() - _last_read_time) if _last_read_time else None,
    }
    if _last_panel_voltage is not None:
        resp['panel_output'] = round(float(_last_panel_voltage), 2)
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
            global _last_panel_voltage, _last_read_time
            v = 12.34
            while not _stop_flag.is_set():
                v = 11.5 + (time.time() % 10) * 0.18
                _last_panel_voltage = round(v, 2)
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
