import type { NextRequest } from "next/server";
import { handle, parseBody } from "@/lib/api";
import { createOrder, getDb, listOrders } from "@/lib/db";
import { DomainError } from "@/lib/errors";
import { createOrderSchema, statusListSchema } from "@/lib/schemas";

export const dynamic = "force-dynamic";

export function GET(request: NextRequest) {
  return handle(() => {
    const param = request.nextUrl.searchParams.get("status");
    let statuses;
    if (param) {
      const parsed = statusListSchema.safeParse(param.split(",").filter(Boolean));
      if (!parsed.success) throw new DomainError("INVALID_INPUT", "status の指定が不正です");
      statuses = parsed.data;
    }
    return Response.json(listOrders(getDb(), statuses));
  });
}

export function POST(request: Request) {
  return handle(async () => {
    const { items } = await parseBody(request, createOrderSchema);
    return Response.json(createOrder(getDb(), items), { status: 201 });
  });
}
