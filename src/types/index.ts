import type { Role } from "@/generated/prisma/enums";

export interface SessionUser {
  id: string;
  name: string | null;
  email: string | null;
  role: Role;
}

export interface ActionResponse<T = void> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export type OrderType = "DINE_IN" | "TAKEAWAY" | "DELIVERY";
export type OrderStatus =
  | "PENDING"
  | "CONFIRMED"
  | "IN_PROGRESS"
  | "READY"
  | "SERVED"
  | "COMPLETED"
  | "CANCELLED";
export type PaymentMethod = "CASH" | "CARD" | "MOBILE" | "BANK_TRANSFER";
export type PaymentStatus =
  | "UNPAID"
  | "PARTIAL"
  | "PAID"
  | "REFUNDED"
  | "PARTIALLY_REFUNDED";
