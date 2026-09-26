import { describe, expect, it } from "vitest";
import { calcAmount, calcTickets } from "./pricing";

describe("calcAmount", () => {
  it.each([
    [1, 200],
    [2, 400],
    [3, 500],
    [4, 700],
    [5, 900],
    [6, 1000],
    [7, 1200],
    [20, 3400],
  ])("%i個 → %i円", (qty, amount) => {
    expect(calcAmount(qty)).toBe(amount);
  });

  it("不正な個数は例外", () => {
    expect(() => calcAmount(-1)).toThrow();
    expect(() => calcAmount(1.5)).toThrow();
  });
});

describe("calcTickets", () => {
  it("100円券の枚数", () => {
    expect(calcTickets(200)).toBe(2);
    expect(calcTickets(500)).toBe(5);
    expect(calcTickets(3400)).toBe(34);
  });
});
