#!/bin/zsh
# ─────────────────────────────────────────────────────────────────────────────
# Dieffe iPhone — rinnovo della firma e aggiornamenti automatici (sul Mac).
# Gestisce uno o più dispositivi (un UDID per riga in DieffeiOS/devices).
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

BUNDLE_ID="$(sed -n 's/^DIEFFE_BUNDLE_ID *= *//p' "$BASE/Signing.xcconfig" 2>/dev/null | tail -1)"
BUNDLE_ID="${BUNDLE_ID:-it.dieffe.preventivi}"

# Dispositivi: un UDID per riga (le versioni precedenti ne avevano uno in "device").
[[ ! -f "$BASE/devices" && -f "$BASE/device" ]] && cp "$BASE/device" "$BASE/devices"
if [[ -f "$STATE/commit" || -f "$STATE/expires" ]]; then
  OLD="$(head -1 "$BASE/devices")"
  mkdir -p "$STATE/$OLD"
  [[ -f "$STATE/commit" ]] && mv "$STATE/commit" "$STATE/$OLD/commit"
  [[ -f "$STATE/expires" ]] && mv "$STATE/expires" "$STATE/$OLD/expires"
fi
DEVICES=(${(f)"$(grep -v '^\s*$' "$BASE/devices" 2>/dev/null)"})
(( ${#DEVICES} )) || { log "Nessun iPhone configurato: esegui install.sh"; exit 1; }

FORCE=0
[[ "${1:-}" == "--force" ]] && FORCE=1

# 1. Novità su main?
if ! git -C "$REPO" fetch -q origin "$BRANCH" 2>>"$LOG"; then
  log "Aggiornamento del repository non riuscito (rete?)"
fi
REMOTE="$(git -C "$REPO" rev-parse "origin/$BRANCH")"

# Lo script stesso si aggiorna dal repository (vale dal giro successivo).
NEW_AGENT="$(git -C "$REPO" show "$REMOTE:ios/Tools/auto-update/agent.sh" 2>/dev/null)"
if [[ -n "$NEW_AGENT" && "$NEW_AGENT" != "$(cat "$BASE/agent.sh")" ]]; then
  print -r -- "$NEW_AGENT" > "$BASE/agent.sh"
  log "Script del servizio aggiornato"
fi

PREPARED=0      # repository e progetto pronti per questo giro
RENEWED=0       # profili vecchi già rimossi in questo giro
BUILT_COMMIT=""

prepare() {
  (( PREPARED )) && return 0
  git -C "$REPO" reset -q --hard "origin/$BRANCH"
  cp "$BASE/Signing.xcconfig" "$REPO/ios/Config/Signing.xcconfig"
  (cd "$REPO/ios" && xcodegen -q >>"$LOG" 2>&1) || { log "xcodegen non riuscito"; return 1; }
  PREPARED=1
}

# Per una firma nuova di 7 giorni si eliminano i profili in cache dell'app:
# Xcode (-allowProvisioningUpdates) ne chiede subito uno nuovo ad Apple.
remove_profiles() {
  (( RENEWED )) && return
  for dir in "$HOME/Library/Developer/Xcode/UserData/Provisioning Profiles" "$HOME/Library/MobileDevice/Provisioning Profiles"; do
    [[ -d "$dir" ]] || continue
    for f in "$dir"/*.mobileprovision(N); do
      appid="$(security cms -D -i "$f" 2>/dev/null | plutil -extract Entitlements.application-identifier raw -o - - 2>/dev/null)"
      [[ "$appid" == *".$BUNDLE_ID" ]] && rm -f "$f" && log "Profilo vecchio rimosso: ${f:t}"
    done
  done
  RENEWED=1
}

for DEVICE in $DEVICES; do
  DSTATE="$STATE/$DEVICE"
  mkdir -p "$DSTATE"
  BUILT="$(cat "$DSTATE/commit" 2>/dev/null)"
  NEED_UPDATE=0
  # Contano solo i file dell'app: README e script del servizio no.
  if [[ -z "$BUILT" ]] || ! git -C "$REPO" diff --quiet "$BUILT" "$REMOTE" -- ios ':!ios/README.md' ':!ios/Tools' 2>/dev/null; then
    NEED_UPDATE=1
  fi
  EXPIRES="$(cat "$DSTATE/expires" 2>/dev/null || echo 0)"
  NOW="$(date +%s)"
  NEED_RENEW=0
  (( EXPIRES - NOW < RENEW_BEFORE )) && NEED_RENEW=1
  (( !FORCE && !NEED_UPDATE && !NEED_RENEW )) && continue

  # 2. Dispositivo raggiungibile (cavo o stessa Wi‑Fi) e pronto?
  INFO="$(xcrun devicectl device info details --device "$DEVICE" 2>&1)"
  NAME="$(print -r -- "$INFO" | sed -n 's/.*Device Name: *//p' | head -1 | sed 's/ *$//')"
  NAME="${NAME:-$DEVICE}"
  if print -r -- "$INFO" | grep -q "Developer Mode is turned off"; then
    log "$NAME: Modalità sviluppatore spenta, salto"
    notify "$NAME: attiva la Modalità sviluppatore per ricevere Dieffe."
    continue
  fi
  if ! print -r -- "$INFO" | grep -q "Pairing State: paired" || print -r -- "$INFO" | grep -qi "error"; then
    log "$NAME non raggiungibile (aggiornamento=$NEED_UPDATE rinnovo=$NEED_RENEW): riprovo più tardi"
    if (( NEED_RENEW && EXPIRES > 0 && EXPIRES - NOW < 86400 )); then
      notify "$NAME: la firma scade entro un giorno. Tienilo sulla stessa Wi‑Fi del Mac o collegalo."
    fi
    continue
  fi

  log "$NAME: avvio (aggiornamento=$NEED_UPDATE rinnovo=$NEED_RENEW forzato=$FORCE, $REMOTE)"
  prepare || { notify "Aggiornamento non riuscito (xcodegen)"; exit 1; }
  (( NEED_RENEW || FORCE )) && remove_profiles

  cd "$REPO/ios" || exit 1
  COUNT="$(git rev-list --count HEAD)"
  SHORT="$(git rev-parse --short HEAD)"
  # Compilare con questo dispositivo come destinazione lo registra nel profilo.
  if ! xcodebuild -project Dieffe.xcodeproj -scheme Dieffe -configuration Release \
        -destination "id=$DEVICE" -derivedDataPath "$BUILD" \
        -allowProvisioningUpdates -allowProvisioningDeviceRegistration \
        CURRENT_PROJECT_VERSION="$COUNT" DIEFFE_COMMIT="$SHORT" \
        build >>"$LOG" 2>&1; then
    log "$NAME: compilazione non riuscita (vedi sopra)"
    notify "Aggiornamento non riuscito: controlla Xcode › Impostazioni › Account."
    continue
  fi

  APP="$BUILD/Build/Products/Release-iphoneos/Dieffe.app"
  EXP_TEXT="$(security cms -D -i "$APP/embedded.mobileprovision" 2>/dev/null | plutil -extract ExpirationDate raw -o - - 2>/dev/null)"
  NEW_EXPIRES="$(date -j -u -f '%Y-%m-%dT%H:%M:%SZ' "$EXP_TEXT" +%s 2>/dev/null || echo 0)"

  if ! xcrun devicectl device install app --device "$DEVICE" "$APP" >>"$LOG" 2>&1; then
    log "$NAME: installazione non riuscita"
    notify "$NAME: installazione non riuscita, riprovo più tardi."
    continue
  fi

  print -r -- "$REMOTE" > "$DSTATE/commit"
  print -r -- "$NEW_EXPIRES" > "$DSTATE/expires"
  WHEN="$(date -r "$NEW_EXPIRES" '+%d/%m alle %H:%M' 2>/dev/null)"
  log "$NAME: installata build $COUNT ($SHORT), firma valida fino al $WHEN"
  if (( NEED_UPDATE )); then
    notify "Dieffe aggiornata su $NAME (build $COUNT). Firma valida fino al $WHEN."
  else
    notify "Firma di Dieffe rinnovata su $NAME: valida fino al $WHEN."
  fi
done
