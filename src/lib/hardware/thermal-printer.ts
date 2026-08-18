/**
 * ESC/POS Thermal Printer Commands
 * For direct printing to ESC/POS-compatible thermal printers.
 * These generate the raw command bytes that can be sent via:
 * - WebSocket to a print server
 * - HTTP POST to a print server endpoint
 * - WebUSB (future browser support)
 *
 * This is a utility — actual transport is configurable.
 */

const ESC = "\x1B";
const GS = "\x1D";

export const Commands = {
  initialize: ESC + "@",
  cut: GS + "V" + "\x01",
  cutPartial: GS + "V" + "\x00",
  bold: ESC + "E" + "\x01",
  boldOff: ESC + "E" + "\x00",
  alignLeft: ESC + "a" + "\x00",
  alignCenter: ESC + "a" + "\x01",
  alignRight: ESC + "a" + "\x02",
  doubleHeight: GS + "!" + "\x10",
  doubleWidth: GS + "!" + "\x20",
  doubleBoth: GS + "!" + "\x30",
  normalSize: GS + "!" + "\x00",
  feedLine: "\n",
  feedLines: (n: number) => "\n".repeat(n),
};

export interface ESCPOSLine {
  text: string;
  align?: "left" | "center" | "right";
  bold?: boolean;
  large?: boolean;
}

export function buildESCPOSReceipt(data: {
  lines: ESCPOSLine[];
  cut?: boolean;
}): string {
  let output = Commands.initialize;

  for (const line of data.lines) {
    output += line.large ? Commands.doubleHeight : Commands.normalSize;
    output += line.bold ? Commands.bold : Commands.boldOff;

    switch (line.align) {
      case "center":
        output += Commands.alignCenter;
        break;
      case "right":
        output += Commands.alignRight;
        break;
      default:
        output += Commands.alignLeft;
    }

    output += line.text + Commands.feedLine;
  }

  if (data.cut !== false) {
    output += Commands.feedLines(3);
    output += Commands.cut;
  }

  return output;
}

export function buildESCPOSKOT(data: {
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
  const lines: ESCPOSLine[] = [];

  if (data.priority) {
    lines.push({ text: "*** PRIORITY ***", align: "center", bold: true, large: true });
  }

  lines.push({ text: "KITCHEN ORDER", align: "center", bold: true, large: true });
  lines.push({ text: "--------------------------------", align: "center" });
  lines.push({ text: "Order: " + data.orderNumber });

  if (data.tableNumber) {
    lines.push({ text: "Table: " + data.tableNumber });
  }

  lines.push({ text: "Time:  " + data.timestamp });
  lines.push({ text: "--------------------------------", align: "center" });

  for (const item of data.items) {
    lines.push({
      text: item.quantity + "x " + item.name,
      bold: true,
    });

    if (item.variant) {
      lines.push({ text: "  (" + item.variant + ")" });
    }
    if (item.addons && item.addons.length > 0) {
      lines.push({ text: "  + " + item.addons.join(", ") });
    }
    if (item.notes) {
      lines.push({ text: "  NOTE: " + item.notes });
    }
  }

  lines.push({ text: "--------------------------------", align: "center" });

  return buildESCPOSReceipt({ lines, cut: true });
}

export async function sendToPrintServer(
  commands: string,
  serverUrl: string
): Promise<boolean> {
  try {
    const response = await fetch(serverUrl, {
      method: "POST",
      headers: { "Content-Type": "text/plain; charset=utf-8" },
      body: commands,
    });
    return response.ok;
  } catch (err) {
    console.error("Failed to send to print server:", err);
    return false;
  }
}
