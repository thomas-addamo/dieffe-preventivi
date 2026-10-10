#!/bin/zsh
# ─────────────────────────────────────────────────────────────────────────────
# Dieffe iPhone — rinnovo della firma e aggiornamenti automatici (sul Mac).
#
# Con l'Apple ID gratuito la firma dell'app dura 7 giorni. Questo script, avviato
# da launchd ogni 3 ore (vedi install.sh), quando l'iPhone è raggiungibile dal
# Mac (cavo oppure stessa rete Wi‑Fi):
#   • rinnova la firma se mancano meno di 2 giorni alla scadenza;
#   • installa la nuova versione se su main è cambiata la cartella ios/.
# Lavora su una copia del repository tutta sua, in
# ~/Library/Application Support/DieffeiOS, e scrive il registro in agent.log.
#
# Uso manuale:  agent.sh            (fa solo ciò che serve)
#               agent.sh --force    (ricompila e reinstalla comunque)
# ─────────────────────────────────────────────────────────────────────────────
set -u

BASE="$HOME/Library/Application Support/DieffeiOS"
REPO="$BASE/repo"
BUILD="$BASE/build"
LOG="$BASE/agent.log"
STATE="$BASE/state"
BRANCH="main"
RENEW_BEFORE=$((2 * 86400))   # rinnova quando mancano meno di 2 giorni

export DEVELOPER_DIR="${DEVELOPER_DIR:-/Applications/Xcode.app/Contents/Developer}"
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"

mkdir -p "$STATE"
log() { print -r -- "$(date '+%Y-%m-%d %H:%M:%S') $*" >> "$LOG"; }
notify() { osascript -e "display notification \"$1\" with title \"Dieffe iPhone\"" >/dev/null 2>&1 || true; }

# Un solo giro alla volta.
if ! mkdir "$BASE/lock" 2>/dev/null; then
  # Lucchetto rimasto da un giro interrotto da più di 2 ore: si rimuove.
  if [[ -n "$(find "$BASE/lock" -maxdepth 0 -mmin +120 2>/dev/null)" ]]; then rmdir "$BASE/lock"; mkdir "$BASE/lock"; else exit 0; fi
fi
trap 'rmdir "$BASE/lock" 2>/dev/null' EXIT

DEVICE="$(cat "$BASE/device" 2>/dev/null)"
BUNDLE_ID="$(sed -n 's/^DIEFFE_BUNDLE_ID *= *//p' "$BASE/Signing.xcconfig" 2>/dev/null | tail -1)"
BUNDLE_ID="${BUNDLE_ID:-it.dieffe.preventivi}"
[[ -z "$DEVICE" ]] && { log "Nessun iPhone configurato: esegui install.sh"; exit 1; }

FORCE=0
[[ "${1:-}" == "--force" ]] && FORCE=1

# 1. Novità su main?
if ! git -C "$REPO" fetch -q origin "$BRANCH" 2>>"$LOG"; then
  log "Aggiornamento del repository non riuscito (rete?)"
fi
REMOTE="$(git -C "$REPO" rev-parse "origin/$BRANCH")"
BUILT="$(cat "$STATE/commit" 2>/dev/null)"
NEED_UPDATE=0
if [[ -z "$BUILT" ]] || ! git -C "$REPO" diff --quiet "$BUILT" "$REMOTE" -- ios 2>/dev/null; then
  NEED_UPDATE=1
fi

# 2. Firma in scadenza?
EXPIRES="$(cat "$STATE/expires" 2>/dev/null || echo 0)"
NOW="$(date +%s)"
NEED_RENEW=0
(( EXPIRES - NOW < RENEW_BEFORE )) && NEED_RENEW=1

if (( !FORCE && !NEED_UPDATE && !NEED_RENEW )); then
  exit 0
fi

# 3. iPhone raggiungibile?
if ! xcrun devicectl device info details --device "$DEVICE" >/dev/null 2>&1; then
  log "iPhone non raggiungibile (aggiornamento=$NEED_UPDATE rinnovo=$NEED_RENEW): riprovo più tardi"
  if (( NEED_RENEW && EXPIRES > 0 && EXPIRES - NOW < 86400 )); then
    notify "La firma scade entro un giorno: tieni l'iPhone sulla stessa Wi‑Fi del Mac o collegalo."
  fi
  exit 0
fi

log "Avvio: aggiornamento=$NEED_UPDATE rinnovo=$NEED_RENEW forzato=$FORCE ($REMOTE)"
git -C "$REPO" reset -q --hard "origin/$BRANCH"
cp "$BASE/Signing.xcconfig" "$REPO/ios/Config/Signing.xcconfig"

# Per una firma nuova di 7 giorni si eliminano i profili in cache dell'app:
# Xcode (-allowProvisioningUpdates) ne chiede subito uno nuovo ad Apple.
if (( NEED_RENEW || FORCE )); then
  for dir in "$HOME/Library/Developer/Xcode/UserData/Provisioning Profiles" "$HOME/Library/MobileDevice/Provisioning Profiles"; do
    [[ -d "$dir" ]] || continue
    for f in "$dir"/*.mobileprovision(N); do
      appid="$(security cms -D -i "$f" 2>/dev/null | plutil -extract Entitlements.application-identifier raw -o - - 2>/dev/null)"
      [[ "$appid" == *".$BUNDLE_ID" ]] && rm -f "$f" && log "Profilo vecchio rimosso: ${f:t}"
    done
  done
fi

cd "$REPO/ios" || exit 1
COUNT="$(git rev-list --count HEAD)"
SHORT="$(git rev-parse --short HEAD)"
if ! xcodegen -q >>"$LOG" 2>&1; then log "xcodegen non riuscito"; notify "Aggiornamento non riuscito (xcodegen)"; exit 1; fi
if ! xcodebuild -project Dieffe.xcodeproj -scheme Dieffe -configuration Release \
      -destination "id=$DEVICE" -derivedDataPath "$BUILD" \
      -allowProvisioningUpdates -allowProvisioningDeviceRegistration \
      CURRENT_PROJECT_VERSION="$COUNT" DIEFFE_COMMIT="$SHORT" \
      build >>"$LOG" 2>&1; then
  log "Compilazione non riuscita (vedi sopra)"
  notify "Aggiornamento non riuscito: controlla Xcode › Impostazioni › Account."
  exit 1
fi

APP="$BUILD/Build/Products/Release-iphoneos/Dieffe.app"
EXP_TEXT="$(security cms -D -i "$APP/embedded.mobileprovision" 2>/dev/null | plutil -extract ExpirationDate raw -o - - 2>/dev/null)"
NEW_EXPIRES="$(date -j -u -f '%Y-%m-%dT%H:%M:%SZ' "$EXP_TEXT" +%s 2>/dev/null || echo 0)"

if ! xcrun devicectl device install app --device "$DEVICE" "$APP" >>"$LOG" 2>&1; then
  log "Installazione non riuscita"
  notify "Installazione sull'iPhone non riuscita: riprovo più tardi."
  exit 1
fi

print -r -- "$REMOTE" > "$STATE/commit"
print -r -- "$NEW_EXPIRES" > "$STATE/expires"
WHEN="$(date -r "$NEW_EXPIRES" '+%d/%m alle %H:%M' 2>/dev/null)"
log "Installata build $COUNT ($SHORT), firma valida fino al $WHEN"
if (( NEED_UPDATE )); then
  notify "Dieffe aggiornata sull'iPhone (build $COUNT). Firma valida fino al $WHEN."
else
  notify "Firma di Dieffe rinnovata: valida fino al $WHEN."
fi
