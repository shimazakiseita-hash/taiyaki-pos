/**
 * お客さん向け呼び出し状況ページ（Cloudflare Workers）。
 * レジPCの public-sync が番号だけを PUT し、お客さんのスマホが GET で読む
 */
import { DurableObject } from "cloudflare:workers";
import { lookupNumber, type PublicStatus } from "../../src/lib/publicStatus";
import { publicStatusSchema } from "../../src/lib/schemas";
import { PAGE_HTML } from "./page";

type Env = {
  STATUS: DurableObjectNamespace<StatusStore>;
  PUSH_TOKEN?: string;
};

type StoredStatus = PublicStatus & { updatedAt: string };

/** 最新の呼び出し状況を1件だけ持つ */
export class StatusStore extends DurableObject<Env> {
  async read(): Promise<StoredStatus | null> {
    return (await this.ctx.storage.get<StoredStatus>("status")) ?? null;
  }

  async write(status: PublicStatus): Promise<void> {
    await this.ctx.storage.put("status", { ...status, updatedAt: new Date().toISOString() });
  }
}

const NO_STORE = { "Cache-Control": "no-store" };

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: NO_STORE });
}

function authorized(request: Request, token: string | undefined): boolean {
  if (!token) return false;
  const given = new TextEncoder().encode(request.headers.get("Authorization") ?? "");
  const expected = new TextEncoder().encode(`Bearer ${token}`);
  return given.byteLength === expected.byteLength && crypto.subtle.timingSafeEqual(given, expected);
}

export default {
  async fetch(request, env): Promise<Response> {
    const url = new URL(request.url);
    const store = env.STATUS.get(env.STATUS.idFromName("main"));

    if (url.pathname === "/" && request.method === "GET") {
      return new Response(PAGE_HTML, { headers: { "Content-Type": "text/html; charset=utf-8", ...NO_STORE } });
    }

    if (url.pathname === "/api/status") {
      if (request.method === "GET") {
        const status = await store.read();
        const n = Number(url.searchParams.get("n"));
        const lookup = status && Number.isInteger(n) && n >= 1 ? lookupNumber(status, n) : null;
        return json({ status, lookup });
      }
      if (request.method === "PUT") {
        if (!authorized(request, env.PUSH_TOKEN)) return json({ error: "認証に失敗しました" }, 401);
        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return json({ error: "JSONが不正です" }, 400);
        }
        const parsed = publicStatusSchema.safeParse(body);
        if (!parsed.success) return json({ error: "形式が不正です" }, 400);
        await store.write(parsed.data);
        return new Response(null, { status: 204 });
      }
      return json({ error: "許可されていないメソッドです" }, 405);
    }

    return new Response("Not Found", { status: 404 });
  },
} satisfies ExportedHandler<Env>;
