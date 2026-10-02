/* eslint-disable @typescript-eslint/no-require-imports -- file CommonJS letto da electron-builder */
// Hook electron-builder (afterPack): firma ad-hoc del bundle macOS.
//
// PERCHÉ: senza certificato Apple, electron-builder lascia l'eseguibile con la
// firma "linker" originale di Electron. Quell'hash è identico per chiunque usi
// la stessa versione di Electron senza firmare, e Apple lo ha REVOCATO dopo
// che è stato usato da malware: macOS mostrava "contiene malware" e spostava
// l'app nel Cestino. Una firma ad-hoc propria dell'intero bundle genera hash
// unici per la nostra app: Gatekeeper la tratta come normale app non
// notarizzata (apribile da Impostazioni → Privacy e sicurezza → Apri comunque).
//
// Con un certificato Developer ID (CSC_LINK/CSC_NAME) questo hook non fa nulla
// e firma + notarizzazione le gestisce electron-builder.

const { execFileSync } = require("node:child_process");
const { join } = require("node:path");

exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== "darwin") return;
  if (process.env.CSC_LINK || process.env.CSC_NAME) return;

  const app = join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`);
  execFileSync("codesign", ["--force", "--deep", "--sign", "-", app], { stdio: "inherit" });
  execFileSync("codesign", ["--verify", "--deep", "--strict", app], { stdio: "inherit" });
  console.log(`  • firma ad-hoc applicata: ${app}`);
};
