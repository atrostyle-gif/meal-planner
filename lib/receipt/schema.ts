import { z } from "zod";

export const receiptItemDraftSchema = z.object({
  rawName: z.string(),
  quantity: z.number().nullable(),
  unit: z.string().nullable(),
  packageCount: z.number().nullable(),
  packageQuantity: z.number().nullable(),
  packageUnit: z.string().nullable(),
  gramsEquivalent: z.number().nullable(),
  unitPriceYen: z.number().nullable(),
  totalPriceYen: z.number().nullable(),
  discountYen: z.number().nullable(),
  taxIncluded: z.boolean().nullable(),
  confidence: z.number().nullable(),
  warnings: z.array(z.string()).optional().default([]),
});

export const receiptDraftSchema = z.object({
  storeRawName: z.string().nullable().optional(),
  storeName: z.string().nullable().optional(),
  storeBrandName: z.string().nullable().optional(),
  storeBranchName: z.string().nullable().optional(),
  purchasedAt: z.string().nullable(),
  subtotalYen: z.number().nullable().optional(),
  discountYen: z.number().nullable().optional(),
  taxYen: z.number().nullable().optional(),
  totalAmountYen: z.number().nullable(),
  paymentMethod: z.string().nullable().optional(),
  items: z.array(receiptItemDraftSchema),
  rawText: z.string().nullable(),
  confidence: z.number().nullable(),
  warnings: z.array(z.string()),
});

export type ReceiptDraftParsed = z.infer<typeof receiptDraftSchema>;
