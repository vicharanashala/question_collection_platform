#!/bin/sh
set -e

# Change to /app — the working directory where dist/ lives
cd /app

echo "[start.sh] Checking TAILSCALE_AUTHKEY..."
if [ -z "${TAILSCALE_AUTHKEY:-}" ]; then
  echo "[start.sh] WARNING: TAILSCALE_AUTHKEY is not set. Skipping Tailscale, running without VM proxy."
  echo "[start.sh] To enable VM proxy, set TAILSCALE_AUTHKEY in Cloud Run env vars."
  echo "[start.sh] Starting NestJS application..."
  exec node dist/main.js
fi

echo "[start.sh] Starting tailscaled in userspace mode..."

# Create runtime dirs
mkdir -p /var/run/tailscale /var/lib/tailscale

# Start tailscaled in background — userspace networking (no TUN device needed on Cloud Run)
# --outbound-http-proxy-listen must be different from --socks5-server (Cloud Run default healthcheck probes 8080)
tailscaled \
  --tun=userspace-networking \
  --socket=/var/run/tailscale/tailscaled.sock \
  --socks5-server=127.0.0.1:1055 \
  --outbound-http-proxy-listen=127.0.0.1:1056 &
DAEMON_PID=$!

echo "[start.sh] tailscaled started (PID $DAEMON_PID), waiting for socket..."

# Wait for socket file (max 15s)
WAIT_COUNT=0
until [ -S /var/run/tailscale/tailscaled.sock ]; do
  WAIT_COUNT=$((WAIT_COUNT + 1))
  echo "  waiting for tailscaled.sock... (${WAIT_COUNT}s)"
  if [ $WAIT_COUNT -gt 15 ]; then
    echo "[start.sh] ERROR: tailscaled.sock not created within 15 seconds — starting app without Tailscale"
    exec node dist/main.js
  fi
  sleep 1
done

echo "[start.sh] Socket ready — authenticating with Tailscale..."

# Authenticate using authkey
# --accept-routes not strictly needed for client-only (no subnet routing needed)
tailscale up \
  --socket=/var/run/tailscale/tailscaled.sock \
  --reset \
  --authkey="${TAILSCALE_AUTHKEY}" \
  --hostname="${TS_HOSTNAME:-annadatha-cloudrun}" \
  --accept-routes 2>&1 || {
  echo "[start.sh] WARNING: tailscale up failed — starting app without Tailscale proxy"
  echo "[start.sh] VM services (Gemma/GDB/Embed) will be unreachable"
  exec node dist/main.js
}

UP_EXIT=$?
echo "[start.sh] tailscale up finished (exit code: $UP_EXIT)"

# Print status for debugging
tailscale --socket=/var/run/tailscale/tailscaled.sock status 2>&1 || true

echo "[start.sh] Tailscale ready. Starting NestJS application..."
echo "[start.sh] VM_PROXY_SOCKS_URL=socks5h://localhost:1055"
echo "[start.sh] VM_PROXY_HTTP_URL=http://localhost:1056"

exec node dist/main.js