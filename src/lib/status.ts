export const ORDER_STATUSES = ["waiting", "ready", "served", "cancelled"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const STATUS_LABELS: Record<OrderStatus, string> = {
  waiting: "焼き待ち",
  ready: "呼び出し中",
  served: "受け渡し済み",
  cancelled: "取り消し",
};

const TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  waiting: ["ready", "cancelled"],
  ready: ["served", "waiting"],
  served: ["ready"],
  cancelled: [],
};

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return TRANSITIONS[from].includes(to);
}
