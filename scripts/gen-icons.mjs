// Genera le icone PNG dal logo SVG ufficiale.
// - apple-icon.png (180): icona web app Home iPhone (iOS NON usa SVG/favicon qui)
// - icon.png (favicon, percorso NUOVO → forza Safari a riscaricare il logo)
// - icon-192/512.png + maskable: manifest PWA (Android/desktop)
import sharp from "sharp";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const SVG = resolve("public/icona_dieffe.svg");
const svg = readFileSync(SVG);

// Logo su sfondo bianco con un po' di padding (più gradevole come tile iOS).
async function withBackground(size, { padding = 0.12, bg = "#ffffff" } = {}) {
  const inner = Math.round(size * (1 - padding * 2));
  const logo = await sharp(svg, { density: 96 })
    .resize(inner, inner, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
  const off = Math.round((size - inner) / 2);
  return sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: bg,
    },
  })
    .composite([{ input: logo, top: off, left: off }])
    .png();
}

// Favicon: trasparente, logo a tutta area (più nitido nelle tab piccole).
async function transparent(size) {
  return sharp(svg, { density: 96 })
    .resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png();
}

async function main() {
  // iOS home screen
  await (await withBackground(180)).toFile("src/app/apple-icon.png");
  // Favicon (nuovo percorso /icon.png)
  await (await transparent(256)).toFile("src/app/icon.png");
  // Manifest PWA
  await (await transparent(192)).toFile("public/icon-192.png");
  await (await transparent(512)).toFile("public/icon-512.png");
  // Maskable (con padding e sfondo, per le maschere Android)
  await (await withBackground(512, { padding: 0.18 })).toFile("public/icon-maskable-512.png");
  console.log("✅ Icone generate");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
