export const VALID_STATUS_FLOW = ["PENDING", "IN_PROGRESS", "READY", "SERVED"] as const;
export type KOTStatus = (typeof VALID_STATUS_FLOW)[number];

export function canTransition(from: string, to: string): boolean {
  const fromIdx = VALID_STATUS_FLOW.indexOf(from as KOTStatus);
  const toIdx = VALID_STATUS_FLOW.indexOf(to as KOTStatus);
  if (fromIdx === -1 || toIdx === -1) return false;
  return toIdx === fromIdx + 1;
}

export function isValidStatus(status: string): boolean {
  return VALID_STATUS_FLOW.includes(status as KOTStatus);
}
