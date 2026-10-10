// Icona dell'app iPhone: la stessa icona Liquid Glass dell'app Mac
// (assets/icon.icon, formato Icon Composer, generata da
// scripts/desktop/gen-mac-icon.mjs). iOS ne ricava da solo le varianti
// chiara, scura, colorata e trasparente. Uso: node scripts/ios/gen-ios-icon.mjs
import { cpSync, rmSync } from "node:fs";
import { resolve } from "node:path";

const SRC = resolve("assets/icon.icon");
const OUT = resolve("ios/Dieffe/Resources/AppIcon.icon");

rmSync(OUT, { recursive: true, force: true });
cpSync(SRC, OUT, { recursive: true });
console.log(`Icona copiata in ${OUT}`);
