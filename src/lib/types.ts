import type { FlavorCounts, FlavorId } from "./menu";
import type { OrderStatus } from "./status";

export type OrderItem = { flavor: FlavorId; qty: number };

export type Order = {
  id: number;
  number: number;
  status: OrderStatus;
  totalQty: number;
  amount: number;
  createdAt: string;
  readyAt: string | null;
  servedAt: string | null;
  cancelledAt: string | null;
  items: OrderItem[];
};

export type Settings = {
  capacity: FlavorCounts;
  targetQty: number;
};

export type CreatedOrder = {
  id: number;
  number: number;
  amount: number;
  tickets: number;
};
