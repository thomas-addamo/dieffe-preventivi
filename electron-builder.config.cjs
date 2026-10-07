/* eslint-disable @typescript-eslint/no-require-imports -- file CommonJS letto da electron-builder */
// Configurazione electron-builder — app desktop Dieffe Preventivi.
// Build: `pnpm electron:build:mac` / `pnpm electron:build:win` (vedi README).

const { execFileSync } = require("node:child_process");
const electronVersion = require("electron/package.json").version;

// Icona macOS "Liquid Glass" (assets/icon.icon, formato Icon Composer — vedi
// scripts/desktop/gen-mac-icon.mjs). Si compila con actool di Xcode 26: se
// manca (o MAC_LEGACY_ICON=1) si usa la classica assets/icon.icns.
function canBuildGlassIcon() {
  if (process.platform !== "darwin" || process.env.MAC_LEGACY_ICON === "1") return false;
  try {
    const out = execFileSync("xcrun", ["actool", "--version"], { encoding: "utf8" });
    const m = /short-bundle-version<\/key>\s*<string>(\d+)/.exec(out);
    return !!m && Number(m[1]) >= 26;
  } catch {
    return false;
  }
}
const macIcon = canBuildGlassIcon() ? "assets/icon.icon" : "assets/icon.icns";

// Firma Apple ufficiale solo se è configurato un certificato Developer ID.
const hasAppleCert = Boolean(process.env.CSC_LINK || process.env.CSC_NAME);
const canNotarize = Boolean(
  process.env.APPLE_ID && process.env.APPLE_APP_SPECIFIC_PASSWORD && process.env.APPLE_TEAM_ID
);

/** @type {import("electron-builder").Configuration} */
module.exports = {
  appId: "it.impresadieffe.preventivi",
  productName: "Dieffe Preventivi",
  copyright: "Copyright © 2026 Dieffe Ristrutturazioni",
  electronVersion,

  directories: {
    app: "desktop-app", // generata da scripts/desktop/prepare.mjs
    output: "dist-electron",
    buildResources: "assets",
  },
  // Il wrapper non ha dipendenze runtime: nessun node_modules nel pacchetto.
  files: ["**/*", "!node_modules{,/**/*}"],
  asar: true,

  // Nomi stabili: il sito linka direttamente .../releases/latest/download/<nome>
  artifactName: "Dieffe-Preventivi-${os}-${arch}.${ext}",

  afterPack: "./scripts/desktop/after-pack.cjs",

  mac: {
    category: "public.app-category.business",
    icon: macIcon,
    minimumSystemVersion: "12.0",
    darkModeSupport: true,
    // dmg = prima installazione · zip = aggiornamento automatico dall'app
    target: [
      { target: "dmg", arch: ["arm64", "x64"] },
      { target: "zip", arch: ["arm64", "x64"] },
    ],
    identity: hasAppleCert ? undefined : null,
    hardenedRuntime: hasAppleCert,
    notarize: hasAppleCert && canNotarize,
    entitlements: "assets/entitlements.mac.plist",
    entitlementsInherit: "assets/entitlements.mac.plist",
    extendInfo: {
      NSHumanReadableCopyright: "© 2026 Dieffe Ristrutturazioni",
    },
  },

  dmg: {
    title: "Dieffe Preventivi",
    icon: "assets/icon.icns",
    window: { width: 540, height: 380 },
    contents: [
      { x: 130, y: 200 },
      { x: 410, y: 200, type: "link", path: "/Applications" },
    ],
  },

  win: {
    icon: "assets/icon.ico",
    target: [{ target: "nsis", arch: ["x64"] }],
  },

  nsis: {
    artifactName: "Dieffe-Preventivi-Setup-${arch}.${ext}",
    oneClick: false,
    perMachine: false,
    allowToChangeInstallationDirectory: true,
    installerIcon: "assets/icon.ico",
    uninstallerIcon: "assets/icon.ico",
    installerHeaderIcon: "assets/icon.ico",
    createDesktopShortcut: true,
    createStartMenuShortcut: true,
    shortcutName: "Dieffe Preventivi",
    license: "assets/license.txt",
  },

  // Le release le pubblica la GitHub Action (softprops/action-gh-release).
  publish: null,
};
