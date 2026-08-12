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

echo "[start.sh] ✅ TAILSCALE_AUTHKEY received (length: ${#TAILSCALE_AUTHKEY})"
echo "[start.sh] Starting tailscaled in userspace mode..."

# ---------------------------------------------------------------------------
# Tailscale (optional)
#
# The tailnet is only needed to reach the AI / agent / GDB servers (100.x CGNAT
# addresses). The HTTP server itself does not depend on it, so a Tailscale failure must
# NOT stop the app from booting: Cloud Run kills any container that fails to listen on
# $PORT and reports it as "failed to start and listen on the port", which buries the
# real cause.
#
# Everything below therefore tolerates failure and always falls through to Node.
# ---------------------------------------------------------------------------
start_tailscale() {
  # --state=mem: — Cloud Run instances are ephemeral, so an on-disk state dir only ever
  # holds a stale identity from a previous container.
  #
  # Userspace networking means there is NO interface for 100.x, so the app can only reach
  # the tailnet through these proxies (see src/bootstrap/tailnetProxy.ts). Both listen on
  # the same port: SOCKS5 for node's http agents (axios), HTTP CONNECT for undici (fetch).
  /app/tailscaled \
    --tun=userspace-networking \
    --state=mem: \
    --socks5-server=localhost:1055 \
    --outbound-http-proxy-listen=localhost:1055 &

  DAEMON_PID=$!
  echo "[start.sh] tailscaled started (PID $DAEMON_PID)..."

  # Wait for the daemon to be ready
  i=0
  while [ $i -lt 30 ]; do
    if /app/tailscale status >/dev/null 2>&1; then break; fi
    i=$((i + 1))
    sleep 1
  done

  echo "[start.sh] Running tailscale up..."

  # The auth key must be REUSABLE and EPHEMERAL: every cold start is a new machine, so a
  # single-use key authenticates the first instance and fails on every one after it, and
  # non-ephemeral nodes accumulate in the tailnet as gcp-1, gcp-2, ...
  if /app/tailscale up \
    --auth-key="${TAILSCALE_AUTHKEY}" \
    --hostname="${TS_HOSTNAME:-annadatha-cloudrun}"; then
    echo "[start.sh] ✅ Tailscale connected: $(/app/tailscale ip -4 2>/dev/null | head -1)"
  else
    echo "[start.sh] ⚠️  'tailscale up' FAILED — continuing without the tailnet."
    echo "[start.sh] ⚠️  Usual causes: auth key expired, single-use, or revoked."
  fi
}

# `|| true` so a non-zero return can never abort the script under `set -e`.
start_tailscale || true

echo ""
echo "[start.sh] Starting NestJS application..."
echo "[start.sh] VM_PROXY_SOCKS_URL=socks5h://localhost:1055"
echo "[start.sh] VM_PROXY_HTTP_URL=http://localhost:1055"

exec dumb-init node dist/main.js