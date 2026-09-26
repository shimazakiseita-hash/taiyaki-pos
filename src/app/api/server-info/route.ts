import { handle } from "@/lib/api";
import { getServerInfo } from "@/lib/serverInfo";

export const dynamic = "force-dynamic";

export function GET() {
  return handle(() => Response.json(getServerInfo()));
}
