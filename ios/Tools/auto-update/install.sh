#!/bin/zsh
# Installa sul Mac il servizio che rinnova la firma dell'app iPhone e la
# aggiorna da solo (vedi agent.sh). Da eseguire una volta, dalla cartella ios/:
#   Tools/auto-update/install.sh [UDID-iPhone]
# Senza UDID usa il primo iPhone associato a questo Mac.
# Per toglierlo: Tools/auto-update/uninstall.sh
set -euo pipefail

HERE="${0:A:h}"
IOS="${HERE:h:h}"
BASE="$HOME/Library/Application Support/DieffeiOS"
LABEL="it.dieffe.ios-agent"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
export DEVELOPER_DIR="${DEVELOPER_DIR:-/Applications/Xcode.app/Contents/Developer}"
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"

command -v xcodegen >/dev/null || { echo "Manca xcodegen: brew install xcodegen"; exit 1; }
[[ -f "$IOS/Config/Signing.xcconfig" ]] || { echo "Manca ios/Config/Signing.xcconfig (vedi ios/README.md)"; exit 1; }

DEVICE="${1:-}"
if [[ -z "$DEVICE" ]]; then
  JSON="$(mktemp)"
  xcrun devicectl list devices --json-output "$JSON" >/dev/null
  DEVICE="$(plutil -convert json -o - "$JSON" | python3 -c '
import json, sys
for d in json.load(sys.stdin)["result"]["devices"]:
    if d.get("hardwareProperties", {}).get("reality") == "physical" and d.get("hardwareProperties", {}).get("platform") == "iOS":
        print(d["hardwareProperties"]["udid"]); break')"
  rm -f "$JSON"
fi
[[ -n "$DEVICE" ]] || { echo "Nessun iPhone associato: collegalo una volta con il cavo e autorizza il Mac."; exit 1; }

mkdir -p "$BASE" "$HOME/Library/LaunchAgents"
print -r -- "$DEVICE" > "$BASE/device"
cp "$IOS/Config/Signing.xcconfig" "$BASE/Signing.xcconfig"
cp "$HERE/agent.sh" "$BASE/agent.sh"
chmod +x "$BASE/agent.sh"

if [[ ! -d "$BASE/repo/.git" ]]; then
  ORIGIN="$(git -C "$IOS" remote get-url origin)"
  echo "Copia del repository in $BASE/repo…"
  git clone -q --branch main "$ORIGIN" "$BASE/repo"
fi

cat > "$PLIST" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$LABEL</string>
  <key>ProgramArguments</key>
  <array><string>/bin/zsh</string><string>$BASE/agent.sh</string></array>
  <key>StartInterval</key><integer>10800</integer>
  <key>RunAtLoad</key><true/>
  <key>ProcessType</key><string>Background</string>
  <key>LowPriorityIO</key><true/>
  <key>StandardOutPath</key><string>$BASE/launchd.log</string>
  <key>StandardErrorPath</key><string>$BASE/launchd.log</string>
</dict>
</plist>
PLIST

launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$PLIST"
echo "Servizio installato per l'iPhone $DEVICE."
echo "Controlla ogni 3 ore; registro: $BASE/agent.log"
