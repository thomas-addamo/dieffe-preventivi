// Prepara la cartella "desktop-app/" impacchettata da electron-builder.
//
// Contiene SOLO il wrapper compilato + un package.json minimo: niente
// node_modules della web app (prima finivano ~300 MB di dipendenze inutili,
// binari nativi compresi, dentro l'app). Il wrapper non ha dipendenze runtime.

import { execSync } from "node:child_process";
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const out = join(root, "desktop-app");
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));

rmSync(join(root, "electron-dist"), { recursive: true, force: true });
execSync("npx tsc --project electron/tsconfig.json", { cwd: root, stdio: "inherit" });

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
cpSync(join(root, "electron-dist"), out, { recursive: true });
cpSync(join(root, "electron", "offline.html"), join(out, "offline.html"));
cpSync(join(root, "assets", "icon.png"), join(out, "icon.png"));

writeFileSync(
  join(out, "package.json"),
  JSON.stringify(
    {
      name: "dieffe-preventivi-desktop",
      productName: "Dieffe Preventivi",
      version: pkg.version,
      description: "Dieffe Preventivi — app desktop",
      author: pkg.author,
      license: "UNLICENSED",
      main: "main.js",
    },
    null,
    2
  )
);

console.log(`✓ desktop-app pronta (v${pkg.version})`);
