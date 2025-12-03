# Proxying `/sysinfo` from your public domain to the Raspberry Pi

This is the recommended (best) approach for production: keep the Pi behind the LAN and let your public web server proxy the `/sysinfo` request to it. That avoids CORS, keeps the Pi private, and centralizes TLS/security on your domain.

1) Prepare

- Ensure your public web server (the one serving `https://lowimpactdesign.me`) can reach the Pi at `PI_IP:8000` (route on the same LAN or through a secure tunnel).
- Replace `PI_IP` in `deploy/nginx_sysinfo.conf` with your Pi's LAN IP.

2) Install the snippet

On the domain server (example paths shown for Debian/Ubuntu/nginx):

```bash
# Copy the snippet into your site config or include it from there.
# Example: add the contents of deploy/nginx_sysinfo.conf inside the server block
# for /etc/nginx/sites-available/lowimpactdesign, or create an include file.

sudo nano /etc/nginx/sites-available/lowimpactdesign
# (paste the location block replacing PI_IP)

sudo nginx -t
sudo systemctl reload nginx
```

3) Test from your Mac

```bash
curl -I https://lowimpactdesign.me/sysinfo
curl https://lowimpactdesign.me/sysinfo
```

If the proxy is working you should see JSON returned from the Pi.

4) Optional: secure the Pi access

- If the domain server and the Pi are on the same LAN, you can keep the Pi private and the proxy will reach it over the LAN.
- If they are not on the same LAN, consider creating an SSH reverse tunnel from the Pi to the domain host:

```bash
# Run on the Pi (example): forward a local port on the domain host to the Pi
# Replace DOMAIN_USER@DOMAIN_HOST and DOMAIN_PORT where appropriate.
ssh -R 127.0.0.1:9000:localhost:8000 DOMAIN_USER@DOMAIN_HOST

# Then set proxy_pass to http://127.0.0.1:9000/sysinfo on the domain host
```

5) Notes

- The snippet sets short timeouts to keep pages snappy. Adjust `proxy_read_timeout` if your Pi sometimes responds slowly.
- Because the domain server terminates TLS, there is no CORS needed and browsers will request `/sysinfo` from `https://lowimpactdesign.me` as usual.
- If you previously enabled CORS on the Pi (`SERVE_ALLOW_ORIGIN=*`), it's harmless but not required when proxying.
