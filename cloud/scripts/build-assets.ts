/**
 * お客さん向けページの画像とフォントを作る（モバイル回線向けに軽くする）。
 * 使い方: cd cloud && npm run assets（見出しの文字やロゴを変えたら実行し、cloud/public をコミットする）
 */
import { mkdir, writeFile } from "node:fs/promises";
import sharp from "sharp";
import subsetFont from "subset-font";
import { BRUSH_TEXT } from "../src/brushText.ts";

const FONT_URL = "https://github.com/google/fonts/raw/main/ofl/yujisyuku/YujiSyuku-Regular.ttf";
const LICENSE_URL = "https://github.com/google/fonts/raw/main/ofl/yujisyuku/OFL.txt";
const out = new URL("../public/", import.meta.url);

async function download(url: string): Promise<Buffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

await mkdir(new URL("brand/", out), { recursive: true });
await mkdir(new URL("fonts/", out), { recursive: true });

// 画面幅の2倍まであれば十分なので縮めて WebP にする
for (const [name, width] of [["logo", 560], ["character", 320]] as const) {
  const src = new URL(`../../public/brand/${name}.png`, import.meta.url);
  const file = new URL(`brand/${name}.webp`, out);
  await sharp(src.pathname).resize({ width }).webp({ quality: 82 }).toFile(file.pathname);
  console.log(`brand/${name}.webp`);
}

// 筆文字（Yuji Syuku, OFL）は見出しに使う文字だけを残す
const text = [...new Set(Object.values(BRUSH_TEXT).join(""))].join("");
const font = await subsetFont(await download(FONT_URL), text, { targetFormat: "woff2" });
await writeFile(new URL("fonts/yuji-syuku-subset.woff2", out), font);
await writeFile(new URL("fonts/OFL.txt", out), await download(LICENSE_URL));
console.log(`fonts/yuji-syuku-subset.woff2（${text.length}文字, ${Math.round(font.length / 1024)}KB）`);
