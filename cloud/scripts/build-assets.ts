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

// ゲームと進み具合のバーで泳ぐたいやきくん：ロゴの絵から、たい焼きの形（はちまき・しっぽまで）だけを切り抜く
await cutoutTaiyaki(new URL("brand/taiyaki.webp", out).pathname);
console.log("brand/taiyaki.webp");

// 筆文字（Yuji Syuku, OFL）は見出しに使う文字だけを残す
const text = [...new Set(Object.values(BRUSH_TEXT).join(""))].join("");
const font = await subsetFont(await download(FONT_URL), text, { targetFormat: "woff2" });
await writeFile(new URL("fonts/yuji-syuku-subset.woff2", out), font);
await writeFile(new URL("fonts/OFL.txt", out), await download(LICENSE_URL));
console.log(`fonts/yuji-syuku-subset.woff2（${text.length}文字, ${Math.round(font.length / 1024)}KB）`);

/**
 * ロゴのたい焼き部分を切り抜く。きつね色〜こげ茶（本体と輪郭線）を拾い、いちばん大きなかたまりを取って、
 * その中の穴（目・ほっぺ・はちまき・汗）を埋める。浮き輪（赤）と波（紺）は背景とつながっているので残らない。
 * 隠れているしっぽの右下は、しっぽの上半分の鏡写しで補う
 */
async function cutoutTaiyaki(file: string) {
  const [left, top, w, h] = [140, 292, 600, 420]; // ロゴの中でたい焼きがいる範囲
  const src = new URL("../../public/brand/logo.png", import.meta.url).pathname;
  const data = await sharp(src).extract({ left, top, width: w, height: h }).ensureAlpha().raw().toBuffer();
  const n = w * h;
  const neighbors = (p: number) => {
    const x = p % w, y = (p - x) / w;
    return [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, y > 0 ? p - w : -1, y < h - 1 ? p + w : -1].filter((q) => q >= 0);
  };

  const fish = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const [r, g, b, a] = [data[i * 4], data[i * 4 + 1], data[i * 4 + 2], data[i * 4 + 3]];
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const v = max / 255, s = max ? (max - min) / max : 0;
    let hue = max === min ? 0 : max === r ? (60 * (g - b)) / (max - min) : max === g ? 120 + (60 * (b - r)) / (max - min) : 240 + (60 * (r - g)) / (max - min);
    if (hue < 0) hue += 360;
    const golden = hue >= 12 && hue <= 55 && s > 0.35 && v > 0.2;
    const outline = v < 0.3 && b <= r + 30; // こげ茶・黒の輪郭線（紺の波の線は除く）
    fish[i] = a > 0 && (golden || outline) ? 1 : 0;
  }

  // いちばん大きなかたまりだけ残す
  const label = new Int32Array(n).fill(-1);
  let bestLabel = -1, bestSize = 0;
  for (let start = 0, next = 0; start < n; start++) {
    if (!fish[start] || label[start] >= 0) continue;
    const queue = [start];
    label[start] = next;
    for (let i = 0; i < queue.length; i++) {
      for (const q of neighbors(queue[i])) if (fish[q] && label[q] < 0) { label[q] = next; queue.push(q); }
    }
    if (queue.length > bestSize) { bestSize = queue.length; bestLabel = next; }
    next++;
  }

  // 外側から塗って届かなかったところ（＝内側の穴）も、たい焼きに含める
  const outside = new Uint8Array(n);
  const queue: number[] = [];
  for (let p = 0; p < n; p++) {
    const x = p % w, y = (p - x) / w;
    if ((x === 0 || y === 0 || x === w - 1 || y === h - 1) && label[p] !== bestLabel) { outside[p] = 1; queue.push(p); }
  }
  for (let i = 0; i < queue.length; i++) {
    for (const q of neighbors(queue[i])) if (!outside[q] && label[q] !== bestLabel) { outside[q] = 1; queue.push(q); }
  }
  const alpha = Buffer.alloc(n);
  for (let p = 0; p < n; p++) alpha[p] = outside[p] ? 0 : 255;

  // ロゴではしっぽの右下が波と浮き輪に隠れているので、しっぽの上半分を鏡写しにして埋める。
  // 元の絵があるところは残し、欠けたところとちぎれた縁（3px以内）だけを置き換える
  const [tailLeft, tailAxis, edge] = [460, 223, 3]; // しっぽの付け根の x と、しっぽの上下の真ん中の y
  const rgba = Buffer.from(data);
  for (let p = 0; p < n; p++) rgba[p * 4 + 3] = alpha[p];
  const original = Buffer.from(rgba);
  for (let x = tailLeft; x < w; x++) {
    for (let y = tailAxis + 1; y < h; y++) {
      const sy = 2 * tailAxis - y;
      if (sy < 0) continue;
      const d = (y * w + x) * 4, s = (sy * w + x) * 4;
      let nearHole = false;
      for (let dy = -edge; dy <= edge && !nearHole; dy++) {
        for (let dx = -edge; dx <= edge && !nearHole; dx++) {
          const nx = x + dx, ny = y + dy;
          if (nx >= tailLeft && nx < w && ny > tailAxis && ny < h && original[(ny * w + nx) * 4 + 3] === 0) nearHole = true;
        }
      }
      if (!nearHole || (original[d + 3] > 0 && original[s + 3] === 0)) continue;
      original.copy(rgba, d, s, s + 4);
    }
  }
  for (let p = 0; p < n; p++) alpha[p] = rgba[p * 4 + 3];

  // ふちをほんの少しぼかしてギザギザを消し、余白を切って小さくする
  // blur は1チャンネルでも3チャンネルにして返すので、1つだけ取り出す
  const softAlpha = await sharp(alpha, { raw: { width: w, height: h, channels: 1 } }).blur(0.6).extractChannel(0).raw().toBuffer();
  const rgb = await sharp(rgba, { raw: { width: w, height: h, channels: 4 } }).removeAlpha().raw().toBuffer();
  await sharp(rgb, { raw: { width: w, height: h, channels: 3 } })
    .joinChannel(softAlpha, { raw: { width: w, height: h, channels: 1 } })
    .png()
    .toBuffer()
    .then((png) => sharp(png).trim().resize({ width: 240 }).webp({ quality: 85, alphaQuality: 90 }).toFile(file));
}

