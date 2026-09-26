import { handle, parseBody } from "@/lib/api";
import { getDb, getSettings, putSettings } from "@/lib/db";
import { putSettingsSchema } from "@/lib/schemas";

export const dynamic = "force-dynamic";

export function GET() {
  return handle(() => Response.json(getSettings(getDb())));
}

export function PUT(request: Request) {
  return handle(async () => {
    const patch = await parseBody(request, putSettingsSchema);
    return Response.json(putSettings(getDb(), patch));
  });
}
