export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(" ");
}

export function formatCurrency(amount: number): string {
  return `৳${amount.toLocaleString("en-BD", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString("en-BD", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function generateOrderNumber(sequence: number): string {
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, "");
  return `ORD-${dateStr}-${String(sequence).padStart(4, "0")}`;
}

export function generatePurchaseNumber(sequence: number): string {
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, "");
  return `PUR-${dateStr}-${String(sequence).padStart(4, "0")}`;
}

export function generateEntryNumber(sequence: number): string {
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, "");
  return `JE-${dateStr}-${String(sequence).padStart(4, "0")}`;
}
