/**
 * Generates the installable app's icons from design/icon/good-shepherd.svg (see design/icon/README.md).
 * Run by hand (`npm run icons`) and commit the output; the build never runs it.
 */
import fs from "node:fs";
import sharp from "sharp";

const MASTER = "design/icon/good-shepherd.svg";
/** The parchment field around the disc. */
const FIELD = "#E8DCC3";
/** Corner radius of the `any` icons, as a share of the side. */
const CORNER = 0.22;
/** How much of the side the emblem takes in a maskable icon: its disc already lies inside Android's safe circle. */
const MASKABLE_SCALE = 1;
/** The master's side, in its own units. */
const SIDE = 1024;
/** The favicon's crop of the master: the disc with the shepherd and the lamb, without the field. */
const FAVICON_CROP = { left: 120, top: 120, width: 784, height: 784 };

const svg = fs.readFileSync(MASTER);
/** The master rendered as a square PNG of `size` pixels. */
const render = (size) => sharp(svg, { density: (72 * size) / SIDE }).resize(size, size).png().toBuffer();

async function anyIcon(size, out) {
  const r = Math.round(size * CORNER);
  const mask = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><rect width="${size}" height="${size}" rx="${r}" ry="${r}"/></svg>`);
  await sharp(await render(size)).composite([{ input: mask, blend: "dest-in" }]).png().toFile(out);
}

async function maskableIcon(size, out) {
  const inner = Math.round(size * MASKABLE_SCALE);
  const offset = Math.round((size - inner) / 2);
  await sharp({ create: { width: size, height: size, channels: 4, background: FIELD } })
    .composite([{ input: await render(inner), left: offset, top: offset }])
    .flatten({ background: FIELD })
    .png()
    .toFile(out);
}

async function faviconPng(size) {
  return sharp(await render(SIDE)).extract(FAVICON_CROP).resize(size, size).png().toBuffer();
}

/** An .ico holding PNG images (allowed since Windows Vista, read by every current browser). */
function ico(pngs) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(pngs.length, 4);
  let offset = 6 + 16 * pngs.length;
  const entries = pngs.map(({ size, data }) => {
    const e = Buffer.alloc(16);
    e.writeUInt8(size % 256, 0);
    e.writeUInt8(size % 256, 1);
    e.writeUInt16LE(1, 4);
    e.writeUInt16LE(32, 6);
    e.writeUInt32LE(data.length, 8);
    e.writeUInt32LE(offset, 12);
    offset += data.length;
    return e;
  });
  return Buffer.concat([header, ...entries, ...pngs.map((p) => p.data)]);
}

fs.mkdirSync("public/app-icons", { recursive: true });
await anyIcon(192, "public/app-icons/icon-192.png");
await anyIcon(512, "public/app-icons/icon-512.png");
await maskableIcon(192, "public/app-icons/maskable-192.png");
await maskableIcon(512, "public/app-icons/maskable-512.png");
await sharp(await render(180)).flatten({ background: FIELD }).png().toFile("app/apple-icon.png");
await sharp(await faviconPng(32)).toFile("app/icon.png");
fs.writeFileSync("app/favicon.ico", ico([{ size: 16, data: await faviconPng(16) }, { size: 32, data: await faviconPng(32) }]));
console.log("icons written");
