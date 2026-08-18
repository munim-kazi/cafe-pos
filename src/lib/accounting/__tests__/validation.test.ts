import { validateEntryBalance } from "../validation";
import { UnbalancedEntryError } from "../errors";

describe("validateEntryBalance", () => {
  it("should pass for balanced entries", () => {
    expect(() =>
      validateEntryBalance([
        { accountId: "1000", debit: 100, credit: 0 },
        { accountId: "4000", debit: 0, credit: 100 },
      ])
    ).not.toThrow();
  });

  it("should pass for complex balanced entries", () => {
    expect(() =>
      validateEntryBalance([
        { accountId: "1000", debit: 525, credit: 0 },
        { accountId: "4000", debit: 0, credit: 500 },
        { accountId: "2100", debit: 0, credit: 25 },
      ])
    ).not.toThrow();
  });

  it("should throw UnbalancedEntryError for unbalanced entries", () => {
    expect(() =>
      validateEntryBalance([
        { accountId: "1000", debit: 100, credit: 0 },
        { accountId: "4000", debit: 0, credit: 90 },
      ])
    ).toThrow(UnbalancedEntryError);
  });

  it("should throw for zero amounts", () => {
    expect(() =>
      validateEntryBalance([
        { accountId: "1000", debit: 0, credit: 0 },
        { accountId: "4000", debit: 0, credit: 0 },
      ])
    ).toThrow("zero amounts");
  });

  it("should throw for negative amounts", () => {
    expect(() =>
      validateEntryBalance([
        { accountId: "1000", debit: -100, credit: 0 },
        { accountId: "4000", debit: 0, credit: -100 },
      ])
    ).toThrow("Negative amounts");
  });

  it("should throw for line with both debit and credit", () => {
    expect(() =>
      validateEntryBalance([
        { accountId: "1000", debit: 100, credit: 50 },
        { accountId: "4000", debit: 0, credit: 150 },
      ])
    ).toThrow("both debit and credit");
  });

  it("should handle decimal precision correctly", () => {
    expect(() =>
      validateEntryBalance([
        { accountId: "1000", debit: 33.33, credit: 0 },
        { accountId: "4000", debit: 0, credit: 33.33 },
      ])
    ).not.toThrow();
  });
});
