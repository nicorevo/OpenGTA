#!/usr/bin/env bash
#
# dev-vps.sh — avvia i due processi per lo sviluppo con VPS vision (Gemini)
# e stampa le istruzioni d'uso:
#
#   1. Servizio VPS  (node service/server.ts, legge .env)  -> http://localhost:8787
#   2. Client web    (vite)                                -> http://localhost:5173
#
# Uso:    bash scripts/dev-vps.sh
# Stop:   Ctrl+C (ferma entrambi i server)
#
set -euo pipefail
cd "$(dirname "$0")/.."

command -v node >/dev/null 2>&1 || { echo "ERRORE: serve Node.js (>= 23.6)"; exit 1; }
command -v curl >/dev/null 2>&1 || { echo "ERRORE: serve curl"; exit 1; }
[ -f .env ] || { echo "ERRORE: manca .env — copia .env.example in .env e compila le chiavi"; exit 1; }

# Legge una variabile: process env (vince, come nel servizio) poi .env.
env_get() {
  local v="${!1-}"
  if [ -z "$v" ]; then
    v=$(sed -n "s/^[[:space:]]*$1=//p" .env | tail -n 1 | sed -e 's/^["'\'']//' -e 's/["'\'']$//')
  fi
  echo "${v:-$2}"
}

VPS_PORT="$(env_get VPS_PORT 8787)"
VPS_URL="http://localhost:$VPS_PORT"
GEMINI_MODEL="$(env_get GEMINI_MODEL gemini-3.6-flash)"

LOG_DIR="$(mktemp -d "${TMPDIR:-/tmp}/opengta-dev.XXXXXX")"
VPS_PID=""
DEV_PID=""

# Ogni server parte con setsid in un proprio process group: il kill di gruppo
# ferma anche i figli (npm -> node), non solo il wrapper.
kill_group() {
  [ -n "$1" ] && kill -- -"$1" 2>/dev/null || true
}

cleanup() {
  trap - INT TERM EXIT
  kill_group "$VPS_PID"
  kill_group "$DEV_PID"
  wait 2>/dev/null || true
  echo
  echo "Server fermati. Log: $LOG_DIR"
}
trap cleanup INT TERM EXIT

echo "→ Avvio servizio VPS (Gemini $GEMINI_MODEL, porta $VPS_PORT)..."
setsid npm run service --silent >"$LOG_DIR/service.log" 2>&1 &
VPS_PID=$!

# Prontezza: una qualunque risposta HTTP (404 su path ignoto) = in ascolto,
# senza far girare la pipeline né toccare cache/fonti esterne.
code=""
for _ in $(seq 1 50); do
  code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 2 "$VPS_URL/__ready__" || true)
  [ "$code" != "000" ] && break
  kill -0 "$VPS_PID" 2>/dev/null || { echo "Il servizio VPS è uscito all'avvio:"; cat "$LOG_DIR/service.log"; exit 1; }
  sleep 0.2
done
[ "$code" != "000" ] || { echo "Il servizio VPS non parte entro 10 s:"; cat "$LOG_DIR/service.log"; exit 1; }

echo "→ Avvio client web (Vite)..."
setsid npm run dev --silent >"$LOG_DIR/client.log" 2>&1 &
DEV_PID=$!

DEV_URL=""
for _ in $(seq 1 100); do
  DEV_URL=$(grep -oE 'http://localhost:[0-9]+/' "$LOG_DIR/client.log" | head -n 1 || true)
  [ -n "$DEV_URL" ] && break
  kill -0 "$DEV_PID" 2>/dev/null || { echo "Vite è uscito all'avvio:"; cat "$LOG_DIR/client.log"; exit 1; }
  sleep 0.2
done
[ -n "$DEV_URL" ] || { echo "Vite non parte entro 20 s:"; cat "$LOG_DIR/client.log"; exit 1; }

OPEN_URL="${DEV_URL}?vpsService=$VPS_URL"
echo "=============================================================="
echo " OpenGTA + VPS (vision Gemini) è in esecuzione"
echo "--------------------------------------------------------------"
echo " 1) Apri nel browser:"
echo "      $OPEN_URL"
echo ""
echo " 2) Stato VPS in console (F12):"
echo "      __opengtaV0Debug.vps()   -> state/source/error"
echo ""
echo " 3) Prima visita a una cella: il profilo LVP è immediato;"
echo "    dopo ~20-40 s il client switcha al profilo generato"
echo "    da Gemini (le celle già generate sono da cache, ~ms)."
echo ""
echo " 4) Log: $LOG_DIR/{service,client}.log"
echo ""
echo "    Model: $GEMINI_MODEL — se le vision restano in errore"
echo "    (429) la quota giornaliera Gemini è esaurita:"
echo "    https://ai.dev/rate-limit"
echo "--------------------------------------------------------------"
echo " Ctrl+C ferma entrambi i server."
echo "=============================================================="

wait
