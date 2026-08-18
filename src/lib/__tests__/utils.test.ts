import { cn, formatCurrency, generateOrderNumber, generatePurchaseNumber, generateEntryNumber } from "../utils";

describe("cn", () => {
  it("joins class names", () => {
    expect(cn("a", "b", "c")).toBe("a b c");
  });
  it("filters falsy values", () => {
    expect(cn("a", null, undefined, false, "b")).toBe("a b");
  });
  it("returns empty string for no args", () => {
    expect(cn()).toBe("");
  });
});

describe("formatCurrency", () => {
  it("formats BDT amount", () => {
    const result = formatCurrency(1500);
    expect(result).toContain("1,500");
    expect(result).toContain("৳");
  });
  it("formats zero", () => {
    const result = formatCurrency(0);
    expect(result).toContain("0.00");
  });
  it("formats decimal amounts", () => {
    const result = formatCurrency(123.45);
    expect(result).toContain("123.45");
  });
});

describe("generateOrderNumber", () => {
  it("generates ORD-YYYYMMDD-NNNN format", () => {
    const result = generateOrderNumber(1);
    expect(result).toMatch(/^ORD-\d{8}-\d{4}$/);
  });
  it("pads sequence with zeros", () => {
    const result = generateOrderNumber(42);
    expect(result).toContain("0042");
  });
});

describe("generatePurchaseNumber", () => {
  it("generates PUR-YYYYMMDD-NNNN format", () => {
    const result = generatePurchaseNumber(1);
    expect(result).toMatch(/^PUR-\d{8}-\d{4}$/);
  });
});

describe("generateEntryNumber", () => {
  it("generates JE-YYYYMMDD-NNNN format", () => {
    const result = generateEntryNumber(1);
    expect(result).toMatch(/^JE-\d{8}-\d{4}$/);
  });
});
