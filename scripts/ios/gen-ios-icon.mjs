// Genera l'icona dell'app iPhone (1024×1024, a tutto quadro: gli angoli li
// arrotonda iOS) dal logo ufficiale public/icona_dieffe.svg, su fondo bianco
// come l'icona del Mac. Uso: node scripts/ios/gen-ios-icon.mjs
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import sharp from "sharp";

const OUT = resolve("ios/Dieffe/Resources/Assets.xcassets/AppIcon.appiconset");
const CANVAS = 1024;
const LOGO = Math.round(CANVAS * 0.7);

const logo = await sharp(readFileSync(resolve("public/icona_dieffe.svg")), { density: 24 })
  .resize(LOGO, LOGO, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .png()
  .toBuffer();

mkdirSync(OUT, { recursive: true });
await sharp({ create: { width: CANVAS, height: CANVAS, channels: 3, background: "#ffffff" } })
  .composite([{ input: logo, gravity: "center" }])
  .flatten({ background: "#ffffff" })
  .removeAlpha()
  .png()
  .toFile(resolve(OUT, "AppIcon.png"));

writeFileSync(
  resolve(OUT, "Contents.json"),
  JSON.stringify(
    {
      images: [{ filename: "AppIcon.png", idiom: "universal", platform: "ios", size: "1024x1024" }],
      info: { author: "xcode", version: 1 },
    },
    null,
    2
  ) + "\n"
);
console.log("Icona iOS generata in", OUT);
