import * as templates from "../templates";

describe("Accounting Templates", () => {
  const accounts = {
    cashOnHand: "1000",
    cashInBank: "1010",
    mobileWallet: "1020",
    accountsReceivable: "1100",
    accountsPayable: "2000",
    taxPayable: "2100",
    inventory: "1200",
    salesRevenue: "4000",
    salesDiscount: "4100",
    cogs: "5000",
    wasteLoss: "5500",
    purchaseDiscount: "5200",
  };

  function assertBalanced(lines: { debit: number; credit: number }[]) {
    const totalDebit = lines.reduce((s, l) => s + l.debit, 0);
    const totalCredit = lines.reduce((s, l) => s + l.credit, 0);
    expect(Math.round(totalDebit * 100)).toBe(Math.round(totalCredit * 100));
  }

  describe("cashSale", () => {
    it("should create balanced entry for cash sale", () => {
      const lines = templates.cashSale(500, "1000", accounts);
      assertBalanced(lines);
      expect(lines).toHaveLength(2);
      expect(lines[0].accountId).toBe("1000");
      expect(lines[0].debit).toBe(500);
      expect(lines[1].accountId).toBe("4000");
      expect(lines[1].credit).toBe(500);
    });
  });

  describe("cashSaleWithTax", () => {
    it("should create balanced entry with tax", () => {
      const lines = templates.cashSaleWithTax(500, 25, "1000", accounts);
      assertBalanced(lines);
      expect(lines).toHaveLength(3);
      expect(lines[0].debit).toBe(525);
      expect(lines[1].credit).toBe(500);
      expect(lines[2].credit).toBe(25);
    });

    it("should handle zero tax", () => {
      const lines = templates.cashSaleWithTax(500, 0, "1000", accounts);
      assertBalanced(lines);
    });
  });

  describe("saleWithDiscount", () => {
    it("should create balanced entry with discount", () => {
      const lines = templates.saleWithDiscount(500, 50, 450, "1000", accounts);
      assertBalanced(lines);
      expect(lines).toHaveLength(3);
      expect(lines[0].debit).toBe(450);
      expect(lines[1].debit).toBe(50);
      expect(lines[2].credit).toBe(500);
    });
  });

  describe("cardMobilePayment", () => {
    it("should create balanced entry", () => {
      const lines = templates.cardMobilePayment(300, "1010", accounts);
      assertBalanced(lines);
      expect(lines[0].accountId).toBe("1010");
    });
  });

  describe("creditSale", () => {
    it("should create balanced entry", () => {
      const lines = templates.creditSale(750, accounts);
      assertBalanced(lines);
      expect(lines[0].accountId).toBe("1100");
      expect(lines[1].accountId).toBe("4000");
    });
  });

  describe("customerPayment", () => {
    it("should create balanced entry", () => {
      const lines = templates.customerPayment(500, "1000", accounts);
      assertBalanced(lines);
      expect(lines[0].accountId).toBe("1000");
      expect(lines[1].accountId).toBe("1100");
    });
  });

  describe("cashPurchase", () => {
    it("should create balanced entry", () => {
      const lines = templates.cashPurchase(1000, accounts);
      assertBalanced(lines);
      expect(lines[0].accountId).toBe("1200");
      expect(lines[1].accountId).toBe("1000");
    });
  });

  describe("creditPurchase", () => {
    it("should create balanced entry", () => {
      const lines = templates.creditPurchase(1000, accounts);
      assertBalanced(lines);
      expect(lines[0].accountId).toBe("1200");
      expect(lines[1].accountId).toBe("2000");
    });
  });

  describe("paySupplier", () => {
    it("should create balanced entry", () => {
      const lines = templates.paySupplier(500, "1000", accounts);
      assertBalanced(lines);
      expect(lines[0].accountId).toBe("2000");
      expect(lines[1].accountId).toBe("1000");
    });
  });

  describe("expense", () => {
    it("should create balanced entry", () => {
      const lines = templates.expense(200, "1000", "6000", accounts);
      assertBalanced(lines);
      expect(lines[0].accountId).toBe("6000");
      expect(lines[1].accountId).toBe("1000");
    });
  });

  describe("cogsEntry", () => {
    it("should create balanced entry", () => {
      const lines = templates.cogsEntry(150, accounts);
      assertBalanced(lines);
      expect(lines[0].accountId).toBe("5000");
      expect(lines[1].accountId).toBe("1200");
    });
  });

  describe("fullRefund", () => {
    it("should create balanced entry with tax", () => {
      const lines = templates.fullRefund(500, 25, "1000", accounts);
      assertBalanced(lines);
      expect(lines).toHaveLength(3);
    });

    it("should create balanced entry without tax", () => {
      const lines = templates.fullRefund(500, 0, "1000", accounts);
      assertBalanced(lines);
      expect(lines).toHaveLength(2);
    });
  });

  describe("partialRefund", () => {
    it("should create balanced entry", () => {
      const lines = templates.partialRefund(200, "1000", 0, accounts);
      assertBalanced(lines);
      expect(lines).toHaveLength(2);
    });
  });

  describe("stockAdjustment", () => {
    it("should create balanced entry", () => {
      const lines = templates.stockAdjustment(50, accounts);
      assertBalanced(lines);
      expect(lines[0].accountId).toBe("5500");
      expect(lines[1].accountId).toBe("1200");
    });
  });

  describe("wasteEntry", () => {
    it("should create balanced entry", () => {
      const lines = templates.wasteEntry(30, accounts);
      assertBalanced(lines);
      expect(lines[0].accountId).toBe("5500");
    });
  });

  describe("stockReturn", () => {
    it("should create balanced entry", () => {
      const lines = templates.stockReturn(200, accounts);
      assertBalanced(lines);
      expect(lines[0].accountId).toBe("2000");
      expect(lines[1].accountId).toBe("1200");
    });
  });
});
