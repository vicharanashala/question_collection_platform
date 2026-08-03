#!/bin/sh
set -e

echo "[start.sh] Starting tailscaled in userspace mode..."

# Create dirs
mkdir -p /var/run/tailscale /var/lib/tailscale

# Start tailscaled with userspace networking (no TUN device needed on Cloud Run)
tailscaled \
  --tun=userspace-networking \
  --socks5-server=127.0.0.1:1055 \
  --outbound-http-proxy-listen=127.0.0.1:1056 &
DAEMON_PID=$!

echo "[start.sh] tailscaled started (PID $DAEMON_PID), waiting for socket..."

# Wait for socket file
WAIT_COUNT=0
until [ -S /var/run/tailscale/tailscaled.sock ]; do
  WAIT_COUNT=$((WAIT_COUNT + 1))
  echo "  waiting for tailscaled.sock... ($WAIT_COUNTs)"
  if [ $WAIT_COUNT -gt 15 ]; then
    echo "ERROR: tailscaled.sock was not created within 15 seconds!"
    exit 1
  fi
  sleep 1
done

echo "[start.sh] Socket ready — authenticating..."

# Authenticate using authkey (ephemeral client, not a subnet relay)
tailscale up \
  --reset \
  --authkey="${TAILSCALE_AUTHKEY}" \
  --hostname="${TS_HOSTNAME:-annadatha-cloudrun}" \
  --accept-routes 2>&1
UP_EXIT=$?

echo "[start.sh] tailscale up finished (exit code: $UP_EXIT)"

# Print status for debugging
tailscale status 2>&1 || true

echo "[start.sh] Starting NestJS application..."
exec node dist/main.js