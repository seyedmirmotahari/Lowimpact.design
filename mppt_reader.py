#!/usr/bin/env python3
"""
Read MPPT data via minimalmodbus and write to JSON file for serve_with_info.py to use.
Runs in background and updates /tmp/mppt_data.json every second.
"""
import json
import time
import sys
import os
from pathlib import Path

try:
    import minimalmodbus
    import serial
except ImportError:
    print("Error: minimalmodbus or serial not installed")
    sys.exit(1)

# MPPT Configuration
PORT = '/dev/ttyACM0'
SLAVE_ID = 1
BAUDRATE = 115200
OUTPUT_FILE = '/tmp/mppt_data.json'

# MPPT Register addresses
PANEL_V_REG = 12546      # Panel voltage (scale 100)
PANEL_A_REG = 12553      # Panel current (scale 100)
BATTERY_V_REG = 12544    # Battery voltage (scale 100)
BATTERY_SOC_REG = 12550  # Battery SOC % (scale 10)
BATTERY_TEMP_REG = 12547 # Battery temperature (scale 1 or 10?)
LOAD_V_REG = 12548       # Load voltage (scale 100)
LOAD_A_REG = 12549       # Load current (scale 100)

# Try to connect to MPPT
try:
    instrument = minimalmodbus.Instrument(PORT, SLAVE_ID)
    instrument.serial.baudrate = BAUDRATE
    instrument.serial.bytesize = 8
    instrument.serial.parity = serial.PARITY_NONE
    instrument.serial.stopbits = 1
    instrument.serial.timeout = 1
    instrument.mode = minimalmodbus.MODE_RTU
    print(f"Connected to MPPT on {PORT}")
except Exception as e:
    print(f"Error: Could not open {PORT}: {e}")
    sys.exit(1)

def read_register(register, number_of_decimals=2):
    """Read a register from MPPT with error handling."""
    try:
        value = instrument.read_register(register, number_of_decimals=number_of_decimals, functioncode=4)
        return float(value)
    except Exception as e:
        print(f"Error reading register {register}: {e}")
        return None

# Main loop
while True:
    try:
        # Read all MPPT values
        data = {
            'timestamp': time.time(),
            'panel_voltage': read_register(PANEL_V_REG, 2),
            'panel_current': read_register(PANEL_A_REG, 2),
            'panel_power': None,
            'battery_voltage': read_register(BATTERY_V_REG, 2),
            'battery_soc': read_register(BATTERY_SOC_REG, 1),
            'battery_temperature': read_register(BATTERY_TEMP_REG, 1),
            'load_voltage': read_register(LOAD_V_REG, 2),
            'load_current': read_register(LOAD_A_REG, 2),
        }
        
        # Calculate panel power if we have V and A
        if data['panel_voltage'] is not None and data['panel_current'] is not None:
            data['panel_power'] = round(data['panel_voltage'] * data['panel_current'], 2)
        
        # Write to JSON file
        with open(OUTPUT_FILE, 'w') as f:
            json.dump(data, f)
        
        # Print for debugging
        print(f"[{time.strftime('%H:%M:%S')}] Panel: {data['panel_voltage']}V, Batt: {data['battery_soc']}% {data['battery_temperature']}°C")
        
    except Exception as e:
        print(f"Error in main loop: {e}")
    
    time.sleep(1)
