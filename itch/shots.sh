#!/usr/bin/env bash
# Copertina itch (630x500) + screenshot (960x720), audio muto. Usa agent-browser sulla build locale.
# Uscita: itch/cover.png, itch/out/screenshots/*.png
set -euo pipefail
cd "$(dirname "$0")/.."
OUT="$PWD/itch/out/screenshots"
mkdir -p "$OUT"
bun run build >/dev/null
bunx serve dist -l 5183 >/dev/null 2>&1 &
SRV=$!
trap 'kill $SRV 2>/dev/null; agent-browser close >/dev/null 2>&1 || true' EXIT
until curl -s -o /dev/null localhost:5183/; do sleep 0.5; done

ab() { agent-browser "$@" >/dev/null; }
up() { ab eval "for (let i=0;i<$1;i++) setTimeout(()=>window.dispatchEvent(new KeyboardEvent('keydown',{code:'ArrowUp'})), i*260); 1"; }

# copertina: solo logo sopra la scena
ab set viewport 630 500
ab open http://localhost:5183/
ab eval 'localStorage.clear(); localStorage.setItem("am-muted","1"); 1'
ab open http://localhost:5183/
sleep 2
ab eval 'const s=document.createElement("style"); s.textContent="#hud,.tag,.picker,#char-lock,.cta,#title-board{display:none!important} .logo{margin-top:30px!important} .logo .a{font-size:46px!important} .logo .b{font-size:104px!important}"; document.head.append(s); document.activeElement.blur(); 1'
sleep 0.5
ab screenshot "$PWD/itch/cover.png"

ab set viewport 960 720
ab open http://localhost:5183/
sleep 2
ab eval 'document.activeElement.blur(); 1'
ab screenshot "$OUT/01-titolo.png"
up 3
sleep 1.6
ab screenshot "$OUT/02-strada.png"
up 3
sleep 1.4
ab screenshot "$OUT/03-milano.png"
ls "$OUT"
