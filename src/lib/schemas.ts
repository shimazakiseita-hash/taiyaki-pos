import { z } from "zod";
import { FLAVOR_IDS } from "./menu";
import { MAX_ORDER_QTY } from "./pricing";
import { ORDER_STATUSES } from "./status";

z.config(z.locales.ja());

export const createOrderSchema = z.object({
  items: z
    .array(
      z.object({
        flavor: z.enum(FLAVOR_IDS),
        qty: z.number().int().min(1).max(MAX_ORDER_QTY),
      }),
    )
    .min(1)
    .max(FLAVOR_IDS.length * 2),
});

export const updateStatusSchema = z.object({
  status: z.enum(ORDER_STATUSES),
});

export const statusListSchema = z.array(z.enum(ORDER_STATUSES));

export const putSettingsSchema = z.object({
  targetQty: z.number().int().min(1).max(99999),
});

const orderNumbersSchema = z.array(z.number().int().min(1)).max(1000);

export const publicStatusSchema = z.object({
  ready: orderNumbersSchema,
  waiting: orderNumbersSchema,
  avgWaitSeconds: z.number().int().min(0).max(86400).nullable(),
  // 古い public-sync（目安を送らない）からでも受け付ける
  secondsPerOrder: z.number().int().min(0).max(86400).nullable().default(null),
});

export const rankingSubmitSchema = z.object({
  number: z.number().int().min(1).max(9999),
  name: z.string().max(40), // 長さの本当の上限は normalizeName（10文字）で見る
  score: z.number().int().min(0).max(100000),
  playMs: z.number().int().min(0).max(60 * 60 * 1000),
});
