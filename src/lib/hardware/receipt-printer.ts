/**
 * Receipt Printer Utility
 * Uses browser's print() with CSS @media print for thermal printer support.
 * Works with any printer that accepts standard print jobs (thermal, inkjet, etc.)
 * No native drivers required — pure browser API.
 */

export interface ReceiptData {
  cafeName: string;
  cafeAddress?: string;
  cafePhone?: string;
  orderId: string;
  orderNumber: string;
  orderType: string;
  tableNumber?: string;
  cashierName: string;
  items: {
    name: string;
    quantity: number;
    unitPrice: number;
    total: number;
    variant?: string;
    addons?: string[];
  }[];
  subtotal: number;
  taxRate?: number;
  taxAmount?: number;
  discountAmount?: number;
  grandTotal: number;
  payments: {
    method: string;
    amount: number;
  }[];
  change?: number;
  date: string;
  footer?: string;
}

function padLine(
  left: string,
  right: string,
  width: number = 48
): string {
  const visibleLeft = left.replace(/<[^>]*>/g, "");
  const visibleRight = right.replace(/<[^>]*>/g, "");
  const dots = Math.max(1, width - visibleLeft.length - visibleRight.length);
  return left + ".".repeat(dots) + right;
}

function centerText(text: string, width: number = 48): string {
  const pad = Math.max(0, Math.floor((width - text.length) / 2));
  return " ".repeat(pad) + text;
}

function separator(width: number = 48): string {
  return "-".repeat(width);
}

function doubleSeparator(width: number = 48): string {
  return "=".repeat(width);
}

export function generateReceiptHTML(data: ReceiptData): string {
  const lines: string[] = [];

  lines.push(centerText(data.cafeName));
  lines.push(centerText("<b>" + data.cafeName + "</b>"));

  if (data.cafeAddress) {
    lines.push(centerText(data.cafeAddress));
  }
  if (data.cafePhone) {
    lines.push(centerText("Tel: " + data.cafePhone));
  }

  lines.push(separator());
  lines.push(centerText("<b>SALES RECEIPT</b>"));
  lines.push(separator());

  lines.push(padLine("Order #:", data.orderNumber));
  lines.push(padLine("Type:", data.orderType.replace("_", " ")));
  if (data.tableNumber) {
    lines.push(padLine("Table:", data.tableNumber));
  }
  lines.push(padLine("Cashier:", data.cashierName));
  lines.push(padLine("Date:", data.date));

  lines.push(separator());

  for (const item of data.items) {
    const qtyPrice = item.quantity + " x " + formatMoney(item.unitPrice);
    lines.push(padLine(item.name, formatMoney(item.total)));

    if (item.variant) {
      lines.push("  " + item.variant);
    }
    if (item.addons && item.addons.length > 0) {
      for (const addon of item.addons) {
        lines.push("  + " + addon);
      }
    }
    lines.push("  " + qtyPrice);
  }

  lines.push(separator());
  lines.push(padLine("Subtotal:", formatMoney(data.subtotal)));

  if (data.discountAmount && data.discountAmount > 0) {
    lines.push(padLine("Discount:", "-" + formatMoney(data.discountAmount)));
  }

  if (data.taxAmount && data.taxAmount > 0) {
    const taxLabel = data.taxRate
      ? "Tax (" + data.taxRate + "%):"
      : "Tax:";
    lines.push(padLine(taxLabel, formatMoney(data.taxAmount)));
  }

  lines.push(doubleSeparator());
  lines.push(
    padLine(
      "<b>TOTAL:</b>",
      "<b>" + formatMoney(data.grandTotal) + "</b>"
    )
  );
  lines.push(doubleSeparator());

  for (const payment of data.payments) {
    lines.push(padLine("Paid (" + payment.method + "):", formatMoney(payment.amount)));
  }

  if (data.change !== undefined && data.change > 0) {
    lines.push(padLine("Change:", formatMoney(data.change)));
  }

  lines.push(separator());

  if (data.footer) {
    lines.push(centerText(data.footer));
  } else {
    lines.push(centerText("Thank you for your visit!"));
    lines.push(centerText("Please come again"));
  }

  lines.push(centerText("Powered by CafePOS"));

  return buildHTMLDocument(lines);
}

export function printReceipt(data: ReceiptData): void {
  const html = generateReceiptHTML(data);
  const printWindow = window.open("", "_blank", "width=320,height=600");
  if (!printWindow) {
    console.error("Failed to open print window. Check popup blocker.");
    return;
  }
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => {
    printWindow.print();
    printWindow.close();
  }, 300);
}

export function generateKOTHTML(data: {
  orderNumber: string;
  tableNumber?: string;
  items: {
    name: string;
    quantity: number;
    variant?: string;
    addons?: string[];
    notes?: string;
  }[];
  priority?: boolean;
  timestamp: string;
}): string {
  const lines: string[] = [];

  if (data.priority) {
    lines.push(centerText("<b>*** PRIORITY ***</b>"));
  }

  lines.push(centerText("<b>KITCHEN ORDER</b>"));
  lines.push(separator());
  lines.push(padLine("Order:", data.orderNumber));
  if (data.tableNumber) {
    lines.push(padLine("Table:", data.tableNumber));
  }
  lines.push(padLine("Time:", data.timestamp));
  lines.push(separator());

  for (const item of data.items) {
    lines.push("<b>" + item.quantity + "x</b> " + item.name);

    if (item.variant) {
      lines.push("  (" + item.variant + ")");
    }
    if (item.addons && item.addons.length > 0) {
      lines.push("  + " + item.addons.join(", "));
    }
    if (item.notes) {
      lines.push("  NOTE: " + item.notes);
    }
  }

  lines.push(separator());
  lines.push(centerText(data.timestamp));

  return buildHTMLDocument(lines, data.priority);
}

export function printKOT(data: Parameters<typeof generateKOTHTML>[0]): void {
  const html = generateKOTHTML(data);
  const printWindow = window.open("", "_blank", "width=320,height=600");
  if (!printWindow) {
    console.error("Failed to open print window. Check popup blocker.");
    return;
  }
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => {
    printWindow.print();
    printWindow.close();
  }, 300);
}

function formatMoney(amount: number): string {
  return "\u09F3" + amount.toLocaleString("en-BD", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function buildHTMLDocument(
  contentLines: string[],
  priority: boolean = false
): string {
  const body = contentLines
    .map((line) => {
      const processed = line
        .replace(/<b>(.*?)<\/b>/g, '<strong style="font-weight:bold">$1</strong>')
        .replace(/\./g, '<span style="letter-spacing:-1px">.</span>');
      return '<div class="line">' + processed + "</div>";
    })
    .join("\n");

  const priorityStyle = priority
    ? "border: 3px solid #000; padding: 4px;"
    : "";

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Print</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: "Courier New", Consolas, monospace;
      font-size: 12px;
      line-height: 1.3;
      color: #000;
      background: #fff;
      width: 80mm;
      padding: 2mm;
      ${priorityStyle}
    }
    .line {
      white-space: pre-wrap;
      word-break: break-all;
      min-height: 1.2em;
    }
    @media print {
      @page {
        margin: 0;
        size: 80mm auto;
      }
      body {
        width: 80mm;
        padding: 0;
      }
    }
  </style>
</head>
<body>
${body}
</body>
</html>`;
}
