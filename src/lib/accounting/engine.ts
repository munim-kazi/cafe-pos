import { db } from "@/lib/db";
import { generateEntryNumber } from "@/lib/utils";
import {
  validateEntryBalance,
  type JournalLineInput,
  toDecimal,
} from "./validation";
import { DuplicateEntryError } from "./errors";

type TransactionClient = Parameters<Parameters<typeof db.$transaction>[0]>[0];

export interface CreateEntryInput {
  description: string;
  date?: Date;
  referenceType?: string;
  referenceId?: string;
  isReversal?: boolean;
  userId: string;
  lines: JournalLineInput[];
}

export async function createJournalEntry(input: CreateEntryInput) {
  validateEntryBalance(input.lines);

  if (input.referenceType && input.referenceId) {
    const existing = await db.journalEntry.findFirst({
      where: {
        referenceType: input.referenceType,
        referenceId: input.referenceId,
        isReversal: input.isReversal ?? false,
      },
    });
    if (existing) {
      throw new DuplicateEntryError(input.referenceType, input.referenceId);
    }
  }

  const lastEntry = await db.journalEntry.findFirst({
    orderBy: { createdAt: "desc" },
    select: { entryNumber: true },
  });

  const sequence = lastEntry
    ? parseInt(lastEntry.entryNumber.split("-").pop()!) + 1
    : 1;

  const entryNumber = generateEntryNumber(sequence);

  const result = await db.$transaction(async (tx: TransactionClient) => {
    const entry = await tx.journalEntry.create({
      data: {
        entryNumber,
        date: input.date ?? new Date(),
        description: input.description,
        referenceType: input.referenceType ?? null,
        referenceId: input.referenceId ?? null,
        isReversal: input.isReversal ?? false,
        createdById: input.userId,
        lines: {
          create: input.lines.map((line) => ({
            accountId: line.accountId,
            debit: toDecimal(line.debit),
            credit: toDecimal(line.credit),
            description: line.description ?? null,
          })),
        },
      },
      include: { lines: true },
    });

    for (const line of input.lines) {
      if (line.debit === 0 && line.credit === 0) continue;

      const now = new Date();
      const year = now.getFullYear();
      const month = now.getMonth() + 1;

      await tx.accountBalance.upsert({
        where: {
          accountId_year_month: {
            accountId: line.accountId,
            year,
            month,
          },
        },
        create: {
          accountId: line.accountId,
          year,
          month,
          debitTotal: toDecimal(line.debit),
          creditTotal: toDecimal(line.credit),
          netBalance: toDecimal(line.debit - line.credit),
        },
        update: {
          debitTotal: {
            increment: toDecimal(line.debit),
          },
          creditTotal: {
            increment: toDecimal(line.credit),
          },
          netBalance: {
            increment: toDecimal(line.debit - line.credit),
          },
        },
      });
    }

    return entry;
  });

  return result;
}

export async function reverseJournalEntry(
  entryId: string,
  reason: string,
  userId: string
) {
  const original = await db.journalEntry.findUnique({
    where: { id: entryId },
    include: { lines: true },
  });

  if (!original) throw new Error(`Journal entry not found: ${entryId}`);
  if (original.isReversal) throw new Error("Cannot reverse a reversal entry");

  const reversedLines: JournalLineInput[] = original.lines.map((line) => ({
    accountId: line.accountId,
    debit: Number(line.credit),
    credit: Number(line.debit),
    description: `Reversal: ${line.description ?? original.description}`,
  }));

  return createJournalEntry({
    description: `Reversal of ${original.entryNumber}: ${reason}`,
    referenceType: "REVERSAL",
    referenceId: entryId,
    isReversal: true,
    userId,
    lines: reversedLines,
  });
}
