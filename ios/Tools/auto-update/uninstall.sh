#!/bin/zsh
# Toglie il servizio di rinnovo e aggiornamento automatico (vedi install.sh).
LABEL="it.dieffe.ios-agent"
launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
rm -f "$HOME/Library/LaunchAgents/$LABEL.plist"
rm -rf "$HOME/Library/Application Support/DieffeiOS"
echo "Servizio rimosso. L'app sull'iPhone resta installata fino alla scadenza della firma."
