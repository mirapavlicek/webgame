#!/usr/bin/env bash
# NetTycoon — zpřístupnění hry přes Tailscale (tailnet).
#
# Spusť na Macu (dvojklik nebo v terminálu):
#   ./serve-tailnet.command            # port 8765 (nebo první volný)
#   ./serve-tailnet.command 9000       # vlastní port
#
# Hra pak poběží na:
#   http://<tvuj-stroj>.<tailnet>.ts.net:<port>/        (přímý HTTP na tailnetu)
#   https://<tvuj-stroj>.<tailnet>.ts.net/              (pokud se povede `tailscale serve`)
#
# Rozdíl proti start.command: binduje na 0.0.0.0, takže je hra dostupná
# i z ostatních zařízení v tailnetu (ne jen z localhostu).

set -e
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR"

PORT="${1:-8765}"
while lsof -i ":$PORT" >/dev/null 2>&1; do
  PORT=$((PORT + 1))
done

echo "===================================="
echo " NetTycoon — tailnet server"
echo "===================================="
echo "Adresář : $DIR"
echo "Port    : $PORT"

# Najdi tailscale CLI (macOS app bundle nebo PATH)
TS_BIN="$(command -v tailscale 2>/dev/null || true)"
if [ -z "$TS_BIN" ] && [ -x "/Applications/Tailscale.app/Contents/MacOS/Tailscale" ]; then
  TS_BIN="/Applications/Tailscale.app/Contents/MacOS/Tailscale"
fi

if [ -n "$TS_BIN" ]; then
  TS_DNS="$("$TS_BIN" status --json 2>/dev/null | python3 -c 'import json,sys; print(json.load(sys.stdin)["Self"]["DNSName"].rstrip("."))' 2>/dev/null || true)"
  if [ -n "$TS_DNS" ]; then
    echo "Tailnet : http://$TS_DNS:$PORT/"
    # Volitelně HTTPS reverse-proxy přes `tailscale serve` (novější i starší syntaxe).
    if "$TS_BIN" serve --bg "$PORT" >/dev/null 2>&1 \
       || "$TS_BIN" serve --bg "http://127.0.0.1:$PORT" >/dev/null 2>&1 \
       || "$TS_BIN" serve https / "http://127.0.0.1:$PORT" >/dev/null 2>&1; then
      echo "HTTPS   : https://$TS_DNS/   (tailscale serve; vypnutí: tailscale serve reset)"
    fi
  else
    echo "Tailscale běží? Nepodařilo se zjistit DNS jméno — hra bude dostupná přes IP/hostname stroje."
  fi
else
  echo "Tailscale CLI nenalezeno — hra bude dostupná na http://<hostname>:$PORT/ v LAN/tailnetu."
fi

echo "Lokálně : http://127.0.0.1:$PORT/index.html"
echo "Zastav  : Ctrl+C v tomto okně"
echo "===================================="

if command -v python3 >/dev/null 2>&1; then
  exec python3 -m http.server "$PORT" --bind 0.0.0.0
elif command -v python >/dev/null 2>&1; then
  exec python -m SimpleHTTPServer "$PORT"
else
  echo "Python není nainstalovaný. Nainstaluj Python 3 a zkus to znovu."
  read -n 1 -s -r -p "Stiskni libovolnou klávesu pro zavření..."
  exit 1
fi
