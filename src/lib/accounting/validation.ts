import { Decimal } from "@prisma/client/runtime/client";
import { UnbalancedEntryError } from "./errors";

export interface JournalLineInput {
  accountId: string;
  debit: number;
  credit: number;
  description?: string;
}

export function validateEntryBalance(lines: JournalLineInput[]): void {
  const totalDebit = lines.reduce(
    (sum, line) => sum + (line.debit || 0),
    0
  );
  const totalCredit = lines.reduce(
    (sum, line) => sum + (line.credit || 0),
    0
  );

  for (const line of lines) {
    if (line.debit < 0 || line.credit < 0) {
      throw new Error(
        `Negative amounts not allowed: debit=${line.debit}, credit=${line.credit}`
      );
    }
    if (line.debit > 0 && line.credit > 0) {
      throw new Error(
        `Line cannot have both debit and credit: debit=${line.debit}, credit=${line.credit}`
      );
    }
  }

  const roundedDebit = Math.round(totalDebit * 100) / 100;
  const roundedCredit = Math.round(totalCredit * 100) / 100;

  if (roundedDebit !== roundedCredit) {
    throw new UnbalancedEntryError(roundedDebit, roundedCredit);
  }

  if (roundedDebit === 0 && roundedCredit === 0) {
    throw new Error("Journal entry has zero amounts");
  }
}

export function toDecimal(value: number): Decimal {
  return new Decimal(value.toFixed(2));
}
