#!/usr/bin/env python3
"""
Small static file server that also exposes a /sysinfo JSON endpoint with CPU usage.
Run from the project directory:

    python3 serve_with_info.py

It serves files on http://127.0.0.1:8000 and a JSON endpoint at /sysinfo
"""
import json
import os
import sys
import time
from http.server import SimpleHTTPRequestHandler, HTTPServer
from socketserver import ThreadingMixIn
import multiprocessing
import threading
import glob
import subprocess
import shutil
import plistlib

# cached value updated by background sampler
_cached_cpu_percent = 0.0
_sampler_thread = None
_stop_sampler = threading.Event()

try:
    import psutil
except Exception:
    psutil = None

try:
    from pymodbus.client.sync import ModbusSerialClient as ModbusClient
except Exception:
    ModbusClient = None

# By default bind to localhost for development. Override via environment
# variables when running on a networked device (e.g. Raspberry Pi):
#   SERVE_HOST=0.0.0.0 SERVE_PORT=8000 python3 serve_with_info.py
HOST = os.environ.get('SERVE_HOST', '127.0.0.1')
try:
    PORT = int(os.environ.get('SERVE_PORT', '8000'))
except Exception:
    PORT = 8000

# --------- RS485 / Modbus Configuration ---------
# When running on Raspberry Pi with RS485 hardware, set these environment variables:
#   SERIAL_PORT=/dev/ttyUSB0 REGISTER_ADDR=0 SCALE=100 python3 serve_with_info.py
SERIAL_PORT = os.environ.get('SERIAL_PORT')  # e.g. /dev/ttyUSB0 (None = disabled)
BAUDRATE = int(os.environ.get('BAUDRATE', '9600'))
MODBUS_UNIT = int(os.environ.get('MODBUS_UNIT', '1'))
REGISTER_ADDR = int(os.environ.get('REGISTER_ADDR', '0'))
REGISTER_COUNT = int(os.environ.get('REGISTER_COUNT', '1'))
SCALE = float(os.environ.get('SCALE', '100.0'))

# Optional additional Modbus addresses for panel and battery
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

# Runtime state for Modbus
_modbus_client = None
_last_modbus_values = {}
_modbus_lock = threading.Lock()

# --------- Modbus Helper Functions ---------
def _connect_modbus():
    """Establish Modbus RTU connection if configured."""
    global _modbus_client
    if not SERIAL_PORT or ModbusClient is None:
        return None
    try:
        client = ModbusClient(method='rtu', port=SERIAL_PORT, baudrate=BAUDRATE, timeout=1)
        if client.connect():
            return client
    except Exception:
        pass
    return None

def _read_register_scaled(addr, scale):
    """Read a single Modbus register and apply scaling."""
    global _modbus_client
    if addr is None:
        return None
    try:
        if _modbus_client is None:
            _modbus_client = _connect_modbus()
        if _modbus_client is None:
            return None
        # Try input registers first, then holding registers
        rr = _modbus_client.read_input_registers(address=addr, count=1, unit=MODBUS_UNIT)
        if getattr(rr, 'isError', lambda: True)():
            rr = _modbus_client.read_holding_registers(address=addr, count=1, unit=MODBUS_UNIT)
            if getattr(rr, 'isError', lambda: True)():
                return None
        if not hasattr(rr, 'registers') or not rr.registers:
            return None
        raw = rr.registers[0]
        # Handle signed integers (two's complement for 16-bit)
        if raw >= 0x8000:
            raw = raw - 0x10000
        val = float(raw)
        if scale not in (None, 0):
            val = val / float(scale)
        return val
    except Exception:
        try:
            if _modbus_client:
                _modbus_client.close()
        except Exception:
            pass
        _modbus_client = None
        return None

def _poll_modbus_once():
    """Poll all configured Modbus registers once."""
    global _last_modbus_values
    if not SERIAL_PORT or ModbusClient is None:
        return
    try:
        with _modbus_lock:
            panel_v = _read_register_scaled(PANEL_V_ADDR, PANEL_V_SCALE)
            if panel_v is not None:
                _last_modbus_values['panel_v'] = round(panel_v, 2)
            panel_a = _read_register_scaled(PANEL_A_ADDR, PANEL_A_SCALE)
            if panel_a is not None:
                _last_modbus_values['panel_a'] = round(panel_a, 2)
            panel_w = _read_register_scaled(PANEL_W_ADDR, PANEL_W_SCALE)
            if panel_w is not None:
                _last_modbus_values['panel_w'] = round(panel_w, 2)
            battery_soc = _read_register_scaled(BATTERY_SOC_ADDR, BATTERY_SOC_SCALE)
            if battery_soc is not None:
                _last_modbus_values['battery_soc'] = round(battery_soc, 1)
            battery_v = _read_register_scaled(BATTERY_V_ADDR, BATTERY_V_SCALE)
            if battery_v is not None:
                _last_modbus_values['battery_v'] = round(battery_v, 2)
            battery_a = _read_register_scaled(BATTERY_A_ADDR, BATTERY_A_SCALE)
            if battery_a is not None:
                _last_modbus_values['battery_a'] = round(battery_a, 2)
            battery_w = _read_register_scaled(BATTERY_W_ADDR, BATTERY_W_SCALE)
            if battery_w is not None:
                _last_modbus_values['battery_w'] = round(battery_w, 2)
            battery_temp = _read_register_scaled(BATTERY_TEMP_ADDR, BATTERY_TEMP_SCALE)
            if battery_temp is not None:
                _last_modbus_values['battery_temp'] = round(battery_temp, 1)
    except Exception:
        pass

class Handler(SimpleHTTPRequestHandler):
    def log_message(self, format, *args):
        # keep logs concise
        sys.stderr.write("%s - - [%s] %s\n" % (self.client_address[0], self.log_date_time_string(), format%args))

    def end_headers(self):
        # Add CORS header to allow cross-origin requests to /sysinfo
        try:
            allow_origin = os.environ.get('SERVE_ALLOW_ORIGIN', '*')
            # set permissive CORS by default for convenience; can be restricted
            self.send_header('Access-Control-Allow-Origin', allow_origin)
            self.send_header('Access-Control-Allow-Methods', 'GET, OPTIONS')
            self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        except Exception:
            pass
        return super().end_headers()

    def do_OPTIONS(self):
        # Respond to CORS preflight requests
        try:
            allow_origin = os.environ.get('SERVE_ALLOW_ORIGIN', '*')
            self.send_response(200)
            self.send_header('Access-Control-Allow-Origin', allow_origin)
            self.send_header('Access-Control-Allow-Methods', 'GET, OPTIONS')
            self.send_header('Access-Control-Allow-Headers', 'Content-Type')
            self.end_headers()
        except Exception:
            try:
                self.send_response(200)
                self.end_headers()
            except Exception:
                pass

    def do_GET(self):
        if self.path.startswith('/sysinfo'):
            try:
                # Log each /sysinfo request with client IP and timestamp
                ts = time.strftime('%Y-%m-%d %H:%M:%S', time.localtime())
                sys.stderr.write(f"[sysinfo] {ts} request from {self.client_address[0]}\n")
            except Exception:
                pass
            info = self.get_sysinfo()
            body = json.dumps(info).encode('utf-8')
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Content-Length', str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        # fallback to normal static file serving
        return super().do_GET()

    def get_sysinfo(self):
        # Prefer the cached sampler value (keeps requests instant and stable)
        try:
            info = {
                'cpu_percent': round(float(_cached_cpu_percent), 1),
                'timestamp': time.time(),
            }
            # Add memory info if psutil available
            try:
                if psutil:
                    vm = psutil.virtual_memory()
                    info.update({
                        'memory_percent': round(float(vm.percent), 1),
                        'memory_used': int(vm.used),
                        'memory_total': int(vm.total),
                        'ram_percent': round(float(vm.percent), 1),
                        'mem_percent': round(float(vm.percent), 1),
                    })
                else:
                    # no psutil -> leave memory keys out
                    pass
            except Exception:
                # on any psutil error, skip memory fields
                pass

            # Add disk/storage usage for root (/) so clients can show SSD/HDD usage
            try:
                disk_total = None
                disk_used = None
                disk_percent = None
                # macOS: try to match Disk Utility by using `diskutil info -plist /`
                if sys.platform == 'darwin':
                    try:
                        out = subprocess.check_output(['diskutil', 'info', '-plist', '/'], stderr=subprocess.DEVNULL, timeout=2)
                        try:
                            info_plist = plistlib.loads(out)
                        except Exception:
                            info_plist = None
                        if info_plist:
                            # Candidate keys for total/available (varies by macOS version)
                            total_keys = ['TotalSize', 'VolumeTotalSpace', 'DeviceSize', 'Size']
                            avail_keys = ['FreeSpace', 'AvailableSize', 'VolumeAvailableSpace']
                            total_val = None
                            avail_val = None
                            for k in total_keys:
                                if k in info_plist and isinstance(info_plist[k], int):
                                    total_val = int(info_plist[k]); break
                            for k in avail_keys:
                                if k in info_plist and isinstance(info_plist[k], int):
                                    avail_val = int(info_plist[k]); break
                            if total_val is not None:
                                disk_total = total_val
                                if avail_val is not None:
                                    disk_used = total_val - avail_val
                                    disk_percent = round((disk_used / total_val) * 100.0, 1) if total_val > 0 else None
                    except Exception:
                        # fall through to other methods
                        disk_total = disk_used = disk_percent = None
                if disk_total is None and psutil and hasattr(psutil, 'disk_usage'):
                    du = psutil.disk_usage('/')
                    disk_total = int(du.total)
                    disk_used = int(du.used)
                    disk_percent = round(float(du.percent), 1)
                else:
                    # fallback to shutil.disk_usage
                    try:
                        usage = shutil.disk_usage('/')
                        disk_total = int(usage.total)
                        disk_used = int(usage.used)
                        disk_percent = round((disk_used / disk_total) * 100.0, 1) if disk_total > 0 else None
                    except Exception:
                        disk_total = disk_used = disk_percent = None
                if disk_total is not None:
                    info.update({
                        'disk_total': disk_total,
                        'disk_used': disk_used,
                        'disk_percent': disk_percent,
                    })
                else:
                    # Ensure disk fields always present by falling back to shutil
                    try:
                        usage = shutil.disk_usage('/')
                        info.update({
                            'disk_total': int(usage.total),
                            'disk_used': int(usage.used),
                            'disk_percent': round((usage.used / usage.total) * 100.0, 1) if usage.total > 0 else None,
                        })
                    except Exception:
                        # As a last resort, set None values so client can handle gracefully
                        try:
                            info.setdefault('disk_total', None)
                            info.setdefault('disk_used', None)
                            info.setdefault('disk_percent', None)
                        except Exception:
                            pass
            except Exception:
                pass

            # Add CPU temperature if available via psutil.sensors_temperatures()
            try:
                if psutil and hasattr(psutil, 'sensors_temperatures'):
                    temps = psutil.sensors_temperatures()
                    cpu_temp_val = None
                    # temps is a dict of sensor_name -> list of shwtemp objects
                    if isinstance(temps, dict):
                        # Prefer common keys, otherwise pick the first numeric reading
                        prefer_keys = ['cpu-thermal', 'coretemp', 'acpitz', 'cpu_thermal', 'package-0', 'cpu']
                        for k in prefer_keys:
                            if k in temps and temps[k]:
                                for entry in temps[k]:
                                    try:
                                        if getattr(entry, 'current', None) is not None:
                                            cpu_temp_val = float(entry.current)
                                            break
                                    except Exception:
                                        continue
                            if cpu_temp_val is not None:
                                break
                        # fallback: iterate all entries
                        if cpu_temp_val is None:
                            for lst in temps.values():
                                if not lst:
                                    continue
                                for entry in lst:
                                    try:
                                        if getattr(entry, 'current', None) is not None:
                                            cpu_temp_val = float(entry.current)
                                            break
                                    except Exception:
                                        continue
                                if cpu_temp_val is not None:
                                    break
                    if cpu_temp_val is not None:
                        # round to one decimal
                        info['cpu_temp'] = round(cpu_temp_val, 1)
                        info['cpu_temp_c'] = round(cpu_temp_val, 1)
                    else:
                        # Try a macOS user-space helper if available (non-sudo)
                        cpu_temp_val2 = None
                        try:
                            if sys.platform == 'darwin':
                                cmd = shutil.which('osx-cpu-temp')
                                if cmd:
                                    out = subprocess.check_output([cmd], stderr=subprocess.DEVNULL, timeout=1)
                                    s = out.decode().strip()
                                    # typical output: "48.5°C" or "48.5C"
                                    s = s.replace('\u00b0', '').replace('C', '').replace('c', '').strip()
                                    try:
                                        cpu_temp_val2 = float(s)
                                    except Exception:
                                        cpu_temp_val2 = None
                        except Exception:
                            cpu_temp_val2 = None
                        if cpu_temp_val2 is not None:
                            info['cpu_temp'] = round(cpu_temp_val2, 1)
                            info['cpu_temp_c'] = round(cpu_temp_val2, 1)
                        else:
                            # If we're on Linux (Raspberry Pi), try reading thermal_zone files
                            cpu_temp_val3 = None
                            try:
                                if sys.platform.startswith('linux'):
                                    # common Pi thermal path: /sys/class/thermal/thermal_zone0/temp
                                    for path in glob.glob('/sys/class/thermal/thermal_zone*/temp'):
                                        try:
                                            with open(path, 'r') as f:
                                                txt = f.read().strip()
                                            if not txt:
                                                continue
                                            # value is usually millidegrees Celsius
                                            v = int(txt)
                                            # convert millidegree -> degree if value large
                                            if v > 1000:
                                                cpu_temp_val3 = v / 1000.0
                                            else:
                                                cpu_temp_val3 = float(v)
                                            break
                                        except Exception:
                                            continue
                            except Exception:
                                cpu_temp_val3 = None
                            if cpu_temp_val3 is not None:
                                info['cpu_temp'] = round(cpu_temp_val3, 1)
                                info['cpu_temp_c'] = round(cpu_temp_val3, 1)
                            else:
                                info['cpu_temp'] = None
                else:
                    info['cpu_temp'] = None
            except Exception:
                info['cpu_temp'] = None

            # Add measured power (watts) when available from common sysfs files
            try:
                power_watts = None
                # 1) Allow manual override via environment variable (useful for testing)
                try:
                    env_pw = os.environ.get('POWER_WATTS') or os.environ.get('POWER_WATTS_OVERRIDE')
                    if env_pw:
                        power_watts = float(env_pw)
                except Exception:
                    power_watts = None

                # 2) Allow a simple runtime file to be dropped for environments that
                # provide power info via a daemon (e.g. /var/run/power_watts.txt)
                if power_watts is None:
                    try:
                        if os.path.exists('/var/run/power_watts.txt'):
                            with open('/var/run/power_watts.txt', 'r') as f:
                                txt = f.read().strip()
                            if txt:
                                power_watts = float(txt)
                    except Exception:
                        power_watts = None

                # 3) Inspect common Linux sysfs locations for power/current/voltage
                if power_watts is None and sys.platform.startswith('linux'):
                    # Try power_now (usually in microwatts)
                    try:
                        for path in glob.glob('/sys/class/power_supply/*/power_now'):
                            try:
                                with open(path, 'r') as f:
                                    v = f.read().strip()
                                if not v:
                                    continue
                                val = float(v)
                                # many drivers report microwatts -> convert to watts
                                # If value looks very small (<0.001) treat as watts already
                                if val > 1000:  # >1000 uW -> convert
                                    power_watts = val / 1e6
                                else:
                                    power_watts = val
                                break
                            except Exception:
                                continue
                    except Exception:
                        pass

                # 4) Try current_now (uA) and voltage_now (uV) -> watts = (uA * uV) / 1e12
                if power_watts is None and sys.platform.startswith('linux'):
                    try:
                        for base in glob.glob('/sys/class/power_supply/*'):
                            curp = os.path.join(base, 'current_now')
                            voltp = os.path.join(base, 'voltage_now')
                            if os.path.exists(curp) and os.path.exists(voltp):
                                try:
                                    with open(curp, 'r') as f:
                                        cur = f.read().strip()
                                    with open(voltp, 'r') as f:
                                        volt = f.read().strip()
                                    if cur and volt:
                                        curv = float(cur)
                                        voltv = float(volt)
                                        # Compute watts: (uA * uV) / 1e12
                                        power_watts = (curv * voltv) / 1e12
                                        break
                                except Exception:
                                    continue
                    except Exception:
                        pass

                # 5) Try hwmon power inputs (e.g. /sys/class/hwmon/hwmon*/power1_input)
                if power_watts is None and sys.platform.startswith('linux'):
                    try:
                        for path in glob.glob('/sys/class/hwmon/*/power*_input'):
                            try:
                                with open(path, 'r') as f:
                                    v = f.read().strip()
                                if not v:
                                    continue
                                val = float(v)
                                # Many hwmon drivers report microwatts or milliwatts;
                                # attempt heuristics: if val > 1000 assume microwatts -> convert
                                if val > 1000:
                                    power_watts = val / 1e6
                                else:
                                    power_watts = val
                                break
                            except Exception:
                                continue
                    except Exception:
                        pass

                # Finalize value: normalize to float with sensible precision or None
                if power_watts is not None:
                    try:
                        pw = float(power_watts)
                        # discard negative or NaN
                        if pw != pw or pw < 0:
                            pw = None
                    except Exception:
                        pw = None
                    if pw is not None:
                        # round to 3 decimal places for display
                        info['power_watts'] = round(pw, 3)
                    else:
                        info['power_watts'] = None
                else:
                    info['power_watts'] = None
            except Exception:
                try:
                    info['power_watts'] = None
                except Exception:
                    pass

            # Add RS485 / Modbus data if available
            try:
                _poll_modbus_once()
                with _modbus_lock:
                    if 'panel_v' in _last_modbus_values:
                        info['panel_output'] = _last_modbus_values['panel_v']
                        info['panel_voltage'] = _last_modbus_values['panel_v']
                        info['panel_v'] = _last_modbus_values['panel_v']
                    if 'panel_a' in _last_modbus_values:
                        info['panel_a'] = _last_modbus_values['panel_a']
                    if 'panel_w' in _last_modbus_values:
                        info['panel_w'] = _last_modbus_values['panel_w']
                    if 'battery_soc' in _last_modbus_values:
                        info['battery_soc'] = _last_modbus_values['battery_soc']
                        info['battery_level'] = _last_modbus_values['battery_soc']
                        info['battery_percent'] = _last_modbus_values['battery_soc']
                    if 'battery_v' in _last_modbus_values:
                        info['battery_v'] = _last_modbus_values['battery_v']
                        info['battery_voltage'] = _last_modbus_values['battery_v']
                    if 'battery_a' in _last_modbus_values:
                        info['battery_a'] = _last_modbus_values['battery_a']
                        info['battery_current'] = _last_modbus_values['battery_a']
                    if 'battery_w' in _last_modbus_values:
                        info['battery_w'] = _last_modbus_values['battery_w']
                        info['battery_power'] = _last_modbus_values['battery_w']
                    if 'battery_temp' in _last_modbus_values:
                        info['battery_temp'] = _last_modbus_values['battery_temp']
                        info['battery_temp_c'] = _last_modbus_values['battery_temp']
            except Exception:
                # If Modbus fails, just skip it and return system info only
                pass

            return info
        except Exception:
            # Last-resort fallback: compute a quick percent or derive from load
            cpu_percent = 0.0
            try:
                if psutil:
                    cpu_percent = psutil.cpu_percent(interval=0.1)
                else:
                    load1, load5, load15 = os.getloadavg()
                    cpu_count = multiprocessing.cpu_count() or 1
                    cpu_percent = min(100.0, (load1 / cpu_count) * 100.0)
            except Exception:
                cpu_percent = 0.0
            return {
                'cpu_percent': round(float(cpu_percent), 1),
                'timestamp': time.time(),
            }

class ThreadingHTTPServer(ThreadingMixIn, HTTPServer):
    daemon_threads = True

if __name__ == '__main__':
    # Start background CPU sampler (if psutil available)
    def _sampler_loop():
        global _cached_cpu_percent
        try:
            if psutil:
                # initial call to establish internal psutil state
                psutil.cpu_percent(interval=None)
            while not _stop_sampler.is_set():
                try:
                    if psutil:
                        val = psutil.cpu_percent(interval=1)
                    else:
                        # fallback to load-average based estimate (not ideal)
                        load1, load5, load15 = os.getloadavg()
                        cpu_count = multiprocessing.cpu_count() or 1
                        val = min(100.0, (load1 / cpu_count) * 100.0)
                except Exception:
                    val = 0.0
                try:
                    _cached_cpu_percent = float(val)
                except Exception:
                    _cached_cpu_percent = 0.0
        except Exception:
            pass

    print(f"Serving HTTP on {HOST} port {PORT} (http://{HOST}:{PORT}/) ...")
    try:
        _sampler_thread = threading.Thread(target=_sampler_loop, daemon=True)
        _sampler_thread.start()
        httpd = ThreadingHTTPServer((HOST, PORT), Handler)
        httpd.serve_forever()
    except KeyboardInterrupt:
        print('\nShutting down server')
    except Exception as e:
        # Log unexpected exceptions to stderr to aid debugging on the Pi
        try:
            import traceback
            traceback.print_exc()
        except Exception:
            sys.stderr.write('Server exited with error: %s\n' % str(e))
        raise
        _stop_sampler.set()
        httpd.server_close()
