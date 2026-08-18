import { z } from "zod";

export const categorySchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  sortOrder: z.number().int().min(0).default(0),
  active: z.boolean().default(true),
});

export type CategoryInput = z.infer<typeof categorySchema>;

export const menuItemSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  description: z.string().max(500).optional(),
  categoryId: z.string().min(1, "Category is required"),
  basePrice: z.number().min(0, "Price must be positive"),
  image: z.string().url().optional().or(z.literal("")),
  available: z.boolean().default(true),
  prepTimeMin: z.number().int().min(0).optional(),
  variants: z
    .array(
      z.object({
        id: z.string().optional(),
        name: z.string().min(1, "Variant name is required"),
        priceAdjust: z.number().default(0),
        available: z.boolean().default(true),
        addonIds: z.array(z.string()).default([]),
      })
    )
    .default([]),
});

export type MenuItemInput = z.infer<typeof menuItemSchema>;

// ─── Order Validation ────────────────────────────────────────────────────────

export const orderItemSchema = z.object({
  menuItemId: z.string().min(1, "Menu item is required"),
  variantId: z.string().optional(),
  name: z.string().min(1),
  quantity: z.number().int().min(1, "Quantity must be at least 1"),
  unitPrice: z.number().min(0, "Price must be non-negative"),
  discount: z.number().min(0).default(0),
  addons: z
    .array(
      z.object({
        addonId: z.string().min(1),
        name: z.string().min(1),
        price: z.number().min(0),
      })
    )
    .default([]),
  notes: z.string().max(200).optional(),
});

export type OrderItemInput = z.infer<typeof orderItemSchema>;

export const createOrderSchema = z.object({
  type: z.enum(["DINE_IN", "TAKEAWAY", "DELIVERY"]),
  tableId: z.string().optional(),
  customerId: z.string().optional(),
  items: z.array(orderItemSchema).min(1, "At least one item is required"),
  discountAmount: z.number().min(0).default(0),
  taxRate: z.number().min(0).max(100).default(0),
  notes: z.string().max(500).optional(),
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;

export const paymentSchema = z.object({
  orderId: z.string().min(1),
  method: z.enum(["CASH", "CARD", "MOBILE", "BANK_TRANSFER"]),
  amount: z.number().positive("Amount must be positive"),
  reference: z.string().max(100).optional(),
});

export type PaymentInput = z.infer<typeof paymentSchema>;

export const addonSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  price: z.number().min(0).default(0),
  available: z.boolean().default(true),
});

export type AddonInput = z.infer<typeof addonSchema>;

export const tableSchema = z.object({
  number: z.number().int().min(1, "Table number is required"),
  capacity: z.number().int().min(1, "Capacity must be at least 1").default(4),
  section: z.string().max(50).optional(),
  status: z.enum(["AVAILABLE", "OCCUPIED", "RESERVED"]).default("AVAILABLE"),
});

export type TableInput = z.infer<typeof tableSchema>;

export const customerSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  phone: z.string().max(20).optional(),
  email: z.string().email().optional().or(z.literal("")),
  address: z.string().max(500).optional(),
});

export type CustomerInput = z.infer<typeof customerSchema>;

export const supplierSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  company: z.string().max(200).optional(),
  phone: z.string().max(20).optional(),
  email: z.string().email().optional().or(z.literal("")),
  address: z.string().max(500).optional(),
});

export type SupplierInput = z.infer<typeof supplierSchema>;
