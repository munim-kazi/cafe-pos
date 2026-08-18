import { categorySchema, menuItemSchema, createOrderSchema, paymentSchema, addonSchema, orderItemSchema } from "../schemas";

describe("categorySchema", () => {
  it("accepts valid category", () => {
    const result = categorySchema.safeParse({ name: "Beverages", sortOrder: 1, active: true });
    expect(result.success).toBe(true);
  });
  it("rejects empty name", () => {
    const result = categorySchema.safeParse({ name: "", sortOrder: 0 });
    expect(result.success).toBe(false);
  });
});

describe("menuItemSchema", () => {
  it("accepts valid menu item", () => {
    const result = menuItemSchema.safeParse({
      name: "Espresso",
      categoryId: "cat123",
      basePrice: 150,
      available: true,
    });
    expect(result.success).toBe(true);
  });
  it("rejects negative price", () => {
    const result = menuItemSchema.safeParse({
      name: "Espresso",
      categoryId: "cat123",
      basePrice: -50,
    });
    expect(result.success).toBe(false);
  });
  it("accepts item with variants", () => {
    const result = menuItemSchema.safeParse({
      name: "Latte",
      categoryId: "cat123",
      basePrice: 200,
      variants: [{ name: "Large", priceAdjust: 50, available: true, addonIds: [] }],
    });
    expect(result.success).toBe(true);
  });
});

describe("createOrderSchema", () => {
  it("accepts valid order", () => {
    const result = createOrderSchema.safeParse({
      type: "DINE_IN",
      items: [{ menuItemId: "item1", name: "Coffee", quantity: 2, unitPrice: 100, discount: 0, addons: [] }],
      discountAmount: 0,
      taxRate: 0,
    });
    expect(result.success).toBe(true);
  });
  it("rejects empty items", () => {
    const result = createOrderSchema.safeParse({
      type: "DINE_IN",
      items: [],
    });
    expect(result.success).toBe(false);
  });
  it("rejects negative quantity", () => {
    const result = createOrderSchema.safeParse({
      type: "TAKEAWAY",
      items: [{ menuItemId: "item1", name: "Tea", quantity: 0, unitPrice: 50, discount: 0, addons: [] }],
    });
    expect(result.success).toBe(false);
  });
  it("rejects invalid order type", () => {
    const result = createOrderSchema.safeParse({
      type: "INVALID",
      items: [{ menuItemId: "item1", name: "Tea", quantity: 1, unitPrice: 50, discount: 0, addons: [] }],
    });
    expect(result.success).toBe(false);
  });
});

describe("paymentSchema", () => {
  it("accepts valid payment", () => {
    const result = paymentSchema.safeParse({ orderId: "ord1", method: "CASH", amount: 500 });
    expect(result.success).toBe(true);
  });
  it("rejects zero amount", () => {
    const result = paymentSchema.safeParse({ orderId: "ord1", method: "CASH", amount: 0 });
    expect(result.success).toBe(false);
  });
  it("rejects negative amount", () => {
    const result = paymentSchema.safeParse({ orderId: "ord1", method: "CARD", amount: -100 });
    expect(result.success).toBe(false);
  });
  it("rejects invalid method", () => {
    const result = paymentSchema.safeParse({ orderId: "ord1", method: "BITCOIN", amount: 100 });
    expect(result.success).toBe(false);
  });
});

describe("orderItemSchema", () => {
  it("accepts valid order item", () => {
    const result = orderItemSchema.safeParse({
      menuItemId: "item1", name: "Coffee", quantity: 1, unitPrice: 100, discount: 0, addons: [],
    });
    expect(result.success).toBe(true);
  });
  it("rejects quantity of 0", () => {
    const result = orderItemSchema.safeParse({
      menuItemId: "item1", name: "Coffee", quantity: 0, unitPrice: 100, discount: 0, addons: [],
    });
    expect(result.success).toBe(false);
  });
  it("accepts item with addons", () => {
    const result = orderItemSchema.safeParse({
      menuItemId: "item1", name: "Coffee", quantity: 1, unitPrice: 100, discount: 0,
      addons: [{ addonId: "a1", name: "Extra Shot", price: 50 }],
    });
    expect(result.success).toBe(true);
  });
});

describe("addonSchema", () => {
  it("accepts valid addon", () => {
    const result = addonSchema.safeParse({ name: "Whipped Cream", price: 20, available: true });
    expect(result.success).toBe(true);
  });
  it("rejects empty name", () => {
    const result = addonSchema.safeParse({ name: "", price: 0 });
    expect(result.success).toBe(false);
  });
});
