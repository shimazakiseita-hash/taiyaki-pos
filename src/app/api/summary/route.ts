import { handle } from "@/lib/api";
import { getDb, getSettings, listOrders } from "@/lib/db";
import { computeSummary } from "@/lib/summary";

export const dynamic = "force-dynamic";

export function GET() {
  return handle(() => {
    const db = getDb();
    return Response.json(computeSummary(listOrders(db), getSettings(db)));
  });
}
