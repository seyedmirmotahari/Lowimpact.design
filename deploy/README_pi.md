# Deploying `serve_with_info.py` as a systemd service on the Raspberry Pi

This file describes a quick, repeatable way to run the static server on a Raspberry Pi and have it start on boot.

1) Copy the unit file to the Pi

Replace `PI_IP` and `pi` with your Pi address/user if different.

```bash
scp deploy/lowimpact.service pi@PI_IP:/tmp/
```

2) Move the unit into place and start it

```bash
ssh pi@PI_IP
sudo mv /tmp/lowimpact.service /etc/systemd/system/lowimpact.service
sudo systemctl daemon-reload
sudo systemctl enable --now lowimpact.service
sudo journalctl -u lowimpact.service -f
```

3) Notes / configuration
- If your project is not stored at `/home/pi/lowImpact.design`, edit the `WorkingDirectory` field in `/etc/systemd/system/lowimpact.service` to the correct path and run `sudo systemctl daemon-reload`.
- If Python 3 is not at `/usr/bin/python3` on your Pi, adjust the `ExecStart` path (you can locate it with `which python3`).
- If you use a virtualenv, set `ExecStart` to the full path of the venv python, and make sure the `WorkingDirectory` is the project root.
- The unit sets environment variables `SERVE_HOST=0.0.0.0` and `SERVE_PORT=8000` so the server listens on all interfaces.

4) Quick tests from your Mac

```bash
# Replace PI_IP below with your Pi's LAN IP
curl -I http://PI_IP:8000
curl http://PI_IP:8000/sysinfo
```

5) Firewall (optional)

If you want to restrict access to your LAN, on the Pi you can allow only your local subnet (example `192.168.1.0/24`):

```bash
sudo apt-get install ufw
sudo ufw allow from 192.168.1.0/24 to any port 8000
sudo ufw enable
```

Security reminder: exposing unencrypted HTTP to the public internet is not recommended. Use an SSH tunnel or reverse proxy with TLS for public access.
