import { handle } from "@/lib/api";
import { formatLocal, ordersToCsv } from "@/lib/csv";
import { getDb, listOrders } from "@/lib/db";

export const dynamic = "force-dynamic";

export function GET() {
  return handle(() => {
    const stamp = formatLocal(new Date().toISOString()).replace(/[-: ]/g, "").slice(0, 12);
    return new Response(ordersToCsv(listOrders(getDb())), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="taiyaki-orders-${stamp}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  });
}
