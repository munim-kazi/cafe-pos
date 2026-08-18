export class UnbalancedEntryError extends Error {
  constructor(
    public readonly debitTotal: number,
    public readonly creditTotal: number
  ) {
    super(
      `Unbalanced journal entry: Debit ৳${debitTotal} ≠ Credit ৳${creditTotal}`
    );
    this.name = "UnbalancedEntryError";
  }
}

export class InvalidAccountError extends Error {
  constructor(public readonly accountId: string) {
    super(`Invalid or inactive account: ${accountId}`);
    this.name = "InvalidAccountError";
  }
}

export class DuplicateEntryError extends Error {
  constructor(public readonly referenceType: string, public readonly referenceId: string) {
    super(
      `Journal entry already exists for ${referenceType}:${referenceId}`
    );
    this.name = "DuplicateEntryError";
  }
}

export class PeriodLockedError extends Error {
  constructor(public readonly year: number, public readonly month: number) {
    super(`Accounting period ${year}-${month} is locked`);
    this.name = "PeriodLockedError";
  }
}
