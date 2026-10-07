// Genera l'icona macOS "Liquid Glass" (formato Icon Composer, .icon) dal logo
// ufficiale public/icona_dieffe.svg. Il logo non cambia: le sue tre famiglie
// di forme diventano tre strati di vetro sovrapposti, come le app di sistema.
//
//   assets/icon.icon/
//     icon.json            descrizione per Icon Composer / actool
//     Assets/rombi.svg     5 rombi blu scuro      (strato anteriore)
//     Assets/azzurro.svg   2 quadrati azzurri     (strato centrale)
//     Assets/grigio.svg    2 quadrati grigi       (strato posteriore)
//
// electron-builder compila il .icon con actool (Xcode 26): ne ricava
// Assets.car (Liquid Glass su macOS 26, varianti chiara/scura/trasparente
// generate dal sistema) e Icon.icns per i macOS precedenti.
//
// Uso: node scripts/desktop/gen-mac-icon.mjs
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const SRC = resolve("public/icona_dieffe.svg");
const OUT = resolve("assets/icon.icon");

// Tela Icon Composer: 1024×1024 pt. Il logo (≈4080 unità su 4725, già
// centrato nel suo viewBox) occupa il 62% del lato: margine come le icone Apple.
const CANVAS = 1024;
const LOGO_SHARE = 0.62;
const LOGO_EXTENT = 4080;
const VIEWBOX = 4725;
const size = (CANVAS * LOGO_SHARE * VIEWBOX) / LOGO_EXTENT;
const offset = (CANVAS - size) / 2;
const scale = size / VIEWBOX;

const svg = readFileSync(SRC, "utf8");
const groups = [...svg.matchAll(/<g transform="[^"]+">\s*<path [^>]+\/>\s*<\/g>/g)].map((m) => m[0]);

const byColor = (rgb) => groups.filter((g) => g.includes(`fill:rgb(${rgb})`));
const LAYERS = [
  { file: "rombi.svg", name: "Rombi", shapes: byColor("39,73,146") },
  { file: "azzurro.svg", name: "Azzurro", shapes: byColor("0,183,233") },
  { file: "grigio.svg", name: "Grigio", shapes: byColor("178,180,179") },
];

for (const l of LAYERS) {
  if (l.shapes.length === 0) throw new Error(`Nessuna forma per lo strato ${l.name}: il logo è cambiato?`);
}

const layerSvg = (shapes) =>
  `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${CANVAS}" height="${CANVAS}" viewBox="0 0 ${CANVAS} ${CANVAS}">
  <g transform="translate(${offset.toFixed(3)} ${offset.toFixed(3)}) scale(${scale.toFixed(6)})" style="fill-rule:evenodd;clip-rule:evenodd;stroke-linejoin:round;stroke-miterlimit:2;">
    ${shapes.join("\n    ")}
  </g>
</svg>
`;

rmSync(OUT, { recursive: true, force: true });
mkdirSync(join(OUT, "Assets"), { recursive: true });
for (const l of LAYERS) writeFileSync(join(OUT, "Assets", l.file), layerSvg(l.shapes));

// Il primo gruppo è quello in primo piano. Sfondo chiaro con gradiente
// automatico (come le app Apple con fondo bianco); ogni strato è vetro.
const icon = {
  fill: { "automatic-gradient": "extended-srgb:0.95000,0.96500,0.98500,1.00000" },
  groups: LAYERS.map((l, i) => ({
    layers: [
      {
        glass: true,
        "image-name": l.file,
        name: l.name,
      },
    ],
    shadow: { kind: "neutral", opacity: 0.5 },
    translucency: { enabled: true, value: i === 0 ? 0.2 : 0.4 },
  })),
  "supported-platforms": { squares: "shared" },
};
writeFileSync(join(OUT, "icon.json"), JSON.stringify(icon, null, 2) + "\n");

console.log(`✅ ${OUT} (${LAYERS.map((l) => `${l.name}: ${l.shapes.length}`).join(", ")})`);
