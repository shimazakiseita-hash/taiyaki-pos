export const UNIT_PRICE = 200;
export const SET_SIZE = 3;
export const SET_PRICE = 500;
export const TICKET_VALUE = 100;

export const MIN_ORDER_QTY = 1;
export const MAX_ORDER_QTY = 20;

/** 合計金額（円）。味を問わず3個で500円、端数は1個200円 */
export function calcAmount(totalQty: number): number {
  if (!Number.isInteger(totalQty) || totalQty < 0) {
    throw new RangeError(`個数が不正です: ${totalQty}`);
  }
  return Math.floor(totalQty / SET_SIZE) * SET_PRICE + (totalQty % SET_SIZE) * UNIT_PRICE;
}

/** 金券（100円券）の枚数 */
export function calcTickets(amount: number): number {
  return amount / TICKET_VALUE;
}
