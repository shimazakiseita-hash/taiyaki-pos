import { describe, expect, it } from "vitest";
import { ORDER_STATUSES, canTransition, type OrderStatus } from "./status";

const ALLOWED: [OrderStatus, OrderStatus][] = [
  ["waiting", "ready"],
  ["waiting", "cancelled"],
  ["ready", "served"],
  ["ready", "waiting"],
  ["served", "ready"],
];

describe("canTransition", () => {
  const all = ORDER_STATUSES.flatMap((from) => ORDER_STATUSES.map((to) => [from, to] as const));
  it.each(all)("%s → %s", (from, to) => {
    const expected = ALLOWED.some(([f, t]) => f === from && t === to);
    expect(canTransition(from, to)).toBe(expected);
  });
});
