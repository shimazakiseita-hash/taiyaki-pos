import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { DomainError } from "./errors";
import { DEFAULT_TARGET_QTY, FLAVOR_IDS, type FlavorId } from "./menu";
import { normalizeItems } from "./order";
import { calcAmount, calcTickets } from "./pricing";
import { STATUS_LABELS, canTransition, type OrderStatus } from "./status";
import type { CreatedOrder, Order, OrderItem, Settings } from "./types";

export type DB = Database.Database;

export const DEFAULT_DB_PATH = path.join(process.cwd(), "data", "taiyaki.db");

const SCHEMA = `
CREATE TABLE IF NOT EXISTS orders (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  number       INTEGER NOT NULL UNIQUE,
  status       TEXT NOT NULL CHECK (status IN ('waiting','ready','served','cancelled')),
  total_qty    INTEGER NOT NULL,
  amount       INTEGER NOT NULL,
  created_at   TEXT NOT NULL,
  ready_at     TEXT,
  served_at    TEXT,
  cancelled_at TEXT
);
CREATE TABLE IF NOT EXISTS order_items (
  order_id INTEGER NOT NULL REFERENCES orders(id),
  flavor   TEXT NOT NULL CHECK (flavor IN ('anko','custard','matcha','choco')),
  qty      INTEGER NOT NULL CHECK (qty > 0),
  PRIMARY KEY (order_id, flavor)
);
CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
`;

/** DBを開いてスキーマと設定の初期値を用意する。テストでは ':memory:' を渡す */
export function openDb(file: string = DEFAULT_DB_PATH): DB {
  if (file !== ":memory:") fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new Database(file);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.pragma("busy_timeout = 5000");
  db.exec(SCHEMA);
  db.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)").run(
    "target_qty",
    JSON.stringify(DEFAULT_TARGET_QTY),
  );
  return db;
}

// 開発時のホットリロードで接続が増えないよう globalThis に保持する
const globalForDb = globalThis as unknown as { taiyakiDb?: DB };

export function getDb(): DB {
  globalForDb.taiyakiDb ??= openDb(process.env.TAIYAKI_DB_PATH ?? DEFAULT_DB_PATH);
  return globalForDb.taiyakiDb;
}

type OrderRow = {
  id: number;
  number: number;
  status: OrderStatus;
  total_qty: number;
  amount: number;
  created_at: string;
  ready_at: string | null;
  served_at: string | null;
  cancelled_at: string | null;
};

function toOrder(row: OrderRow, items: OrderItem[]): Order {
  return {
    id: row.id,
    number: row.number,
    status: row.status,
    totalQty: row.total_qty,
    amount: row.amount,
    createdAt: row.created_at,
    readyAt: row.ready_at,
    servedAt: row.served_at,
    cancelledAt: row.cancelled_at,
    items,
  };
}

export function createOrder(db: DB, rawItems: readonly OrderItem[], now: Date = new Date()): CreatedOrder {
  const { items, totalQty } = normalizeItems(rawItems);
  const amount = calcAmount(totalQty);

  const tx = db.transaction((): CreatedOrder => {
    const { next } = db.prepare("SELECT COALESCE(MAX(number), 0) + 1 AS next FROM orders").get() as { next: number };
    const result = db
      .prepare("INSERT INTO orders (number, status, total_qty, amount, created_at) VALUES (?, 'waiting', ?, ?, ?)")
      .run(next, totalQty, amount, now.toISOString());
    const id = Number(result.lastInsertRowid);
    const insertItem = db.prepare("INSERT INTO order_items (order_id, flavor, qty) VALUES (?, ?, ?)");
    for (const item of items) insertItem.run(id, item.flavor, item.qty);
    return { id, number: next, amount, tickets: calcTickets(amount) };
  });
  return tx.immediate();
}

export function listOrders(db: DB, statuses?: readonly OrderStatus[]): Order[] {
  const where = statuses && statuses.length > 0 ? `WHERE status IN (${statuses.map(() => "?").join(",")})` : "";
  const rows = db.prepare(`SELECT * FROM orders ${where} ORDER BY number`).all(...(statuses ?? [])) as OrderRow[];
  if (rows.length === 0) return [];

  const itemRows = db
    .prepare(
      `SELECT order_id, flavor, qty FROM order_items
        WHERE order_id IN (SELECT id FROM orders ${where})`,
    )
    .all(...(statuses ?? [])) as { order_id: number; flavor: FlavorId; qty: number }[];
  const itemsById = new Map<number, OrderItem[]>();
  for (const r of itemRows) {
    const list = itemsById.get(r.order_id) ?? [];
    list.push({ flavor: r.flavor, qty: r.qty });
    itemsById.set(r.order_id, list);
  }
  const order = (i: OrderItem) => FLAVOR_IDS.indexOf(i.flavor);
  return rows.map((row) => toOrder(row, (itemsById.get(row.id) ?? []).sort((a, b) => order(a) - order(b))));
}

export function getOrder(db: DB, id: number): Order | null {
  const row = db.prepare("SELECT * FROM orders WHERE id = ?").get(id) as OrderRow | undefined;
  if (!row) return null;
  const items = db.prepare("SELECT flavor, qty FROM order_items WHERE order_id = ?").all(id) as OrderItem[];
  return toOrder(row, items);
}

/** 状態に応じて更新するタイムスタンプ列。戻す操作では該当列を消す */
const TIMESTAMP_UPDATES: Record<OrderStatus, string> = {
  waiting: "ready_at = NULL",
  ready: "ready_at = @now",
  served: "served_at = @now",
  cancelled: "cancelled_at = @now",
};

export function updateStatus(db: DB, id: number, to: OrderStatus, now: Date = new Date()): Order {
  const tx = db.transaction((): Order => {
    const row = db.prepare("SELECT status, number FROM orders WHERE id = ?").get(id) as
      | { status: OrderStatus; number: number }
      | undefined;
    if (!row) throw new DomainError("NOT_FOUND", "注文が見つかりません");
    if (!canTransition(row.status, to)) {
      throw new DomainError(
        "INVALID_TRANSITION",
        `${row.number}番は「${STATUS_LABELS[row.status]}」のため「${STATUS_LABELS[to]}」にできません`,
      );
    }
    // ready → waiting、served → ready の「戻す」では served_at/ready_at を消す
    const stamp = row.status === "served" && to === "ready" ? "served_at = NULL" : TIMESTAMP_UPDATES[to];
    db.prepare(`UPDATE orders SET status = @to, ${stamp} WHERE id = @id`).run({ id, to, now: now.toISOString() });
    return getOrder(db, id)!;
  });
  return tx.immediate();
}

export function getSettings(db: DB): Settings {
  const rows = db.prepare("SELECT key, value FROM settings").all() as { key: string; value: string }[];
  const map = new Map(rows.map((r) => [r.key, JSON.parse(r.value) as unknown]));
  return {
    targetQty: (map.get("target_qty") as number | undefined) ?? DEFAULT_TARGET_QTY,
  };
}

export function putSettings(db: DB, patch: { targetQty?: number }): Settings {
  const upsert = db.prepare(
    "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
  );
  db.transaction(() => {
    if (patch.targetQty !== undefined) upsert.run("target_qty", JSON.stringify(patch.targetQty));
  })();
  return getSettings(db);
}
