#!/usr/bin/env bash
# NetTycoon v2 launcher pro macOS.
# Dvojklikem spustí lokální HTTP server a otevře hru v prohlížeči.
# ES moduly a WebGL vyžadují http:// původ, proto NEJDE otevírat index.html přímo (file://).

set -e
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR"

PORT=8765

# Najdi volný port, kdyby 8765 byl obsazen
while lsof -i ":$PORT" >/dev/null 2>&1; do
  PORT=$((PORT + 1))
done

URL="http://127.0.0.1:$PORT/index.html"

echo "===================================="
echo " NetTycoon v2 — lokální server"
echo "===================================="
echo "Adresář : $DIR"
echo "URL     : $URL"
echo "Zastav  : Ctrl+C v tomto okně"
echo "===================================="

# Otevři prohlížeč po krátkém zpoždění, aby server stihl naběhnout
( sleep 1 && open "$URL" ) &

# Python3 bývá na macOS předinstalovaný; fallback na python
if command -v python3 >/dev/null 2>&1; then
  exec python3 -m http.server "$PORT" --bind 127.0.0.1
elif command -v python >/dev/null 2>&1; then
  exec python -m SimpleHTTPServer "$PORT"
else
  echo "Python není nainstalovaný. Nainstaluj Python 3 a zkus to znovu."
  read -n 1 -s -r -p "Stiskni libovolnou klávesu pro zavření..."
  exit 1
fi
