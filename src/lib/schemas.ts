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

const capacityValue = z.number().int().min(0).max(9999);

export const putSettingsSchema = z
  .object({
    capacity: z
      .object({
        anko: capacityValue.optional(),
        custard: capacityValue.optional(),
        matcha: capacityValue.optional(),
        choco: capacityValue.optional(),
      })
      .optional(),
    targetQty: z.number().int().min(1).max(99999).optional(),
  })
  .refine((v) => v.capacity !== undefined || v.targetQty !== undefined, "変更する項目がありません");
