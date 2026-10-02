/**
 * お客さん向け呼び出し状況ページ（Cloudflare Workers）。
 * レジPCの public-sync が番号だけを PUT し、お客さんのスマホが GET で読む。
 * ミニゲームの今日のランキングもここに置く
 */
import { DurableObject } from "cloudflare:workers";
import { lookupNumber, type PublicStatus } from "../../src/lib/publicStatus";
import {
  RANKING_SIZE,
  containsNgWord,
  isPlausibleScore,
  jstDateKey,
  normalizeName,
  sortRanking,
  upsertBest,
  type RankingEntry,
} from "../../src/lib/ranking";
import { publicStatusSchema, rankingSubmitSchema } from "../../src/lib/schemas";
import { PAGE_HTML } from "./page";

type Env = {
  STATUS: DurableObjectNamespace<StatusStore>;
  PUSH_TOKEN?: string;
};

type StoredStatus = PublicStatus & { updatedAt: string };

export type RankingRow = { rank: number; name: string; number: number; score: number };
export type SubmitResult = { ok: true; rank: number; top: RankingRow[] } | { ok: false; error: string };

function toRows(entries: readonly RankingEntry[]): RankingRow[] {
  return sortRanking(entries).map((e, i) => ({ rank: i + 1, name: e.name, number: e.number, score: e.score }));
}

/** 最新の呼び出し状況と、今日のランキングを持つ */
export class StatusStore extends DurableObject<Env> {
  async read(): Promise<StoredStatus | null> {
    return (await this.ctx.storage.get<StoredStatus>("status")) ?? null;
  }

  async write(status: PublicStatus): Promise<void> {
    // ランキングに参加できるのは、これまでに出た番号まで
    const max = Math.max((await this.ctx.storage.get<number>("maxNumber")) ?? 0, ...status.ready, ...status.waiting);
    await this.ctx.storage.put({ status: { ...status, updatedAt: new Date().toISOString() }, maxNumber: max });
  }

  private async board(): Promise<RankingEntry[]> {
    return (await this.ctx.storage.get<RankingEntry[]>(`ranking:${jstDateKey()}`)) ?? [];
  }

  async ranking(): Promise<RankingRow[]> {
    return toRows(await this.board()).slice(0, RANKING_SIZE);
  }

  async submit(entry: RankingEntry): Promise<SubmitResult> {
    const max = (await this.ctx.storage.get<number>("maxNumber")) ?? 0;
    if (entry.number > max) return { ok: false, error: "その ばんごうの せいりけんは まだ でていないよ" };
    const board = upsertBest(await this.board(), entry);
    await this.ctx.storage.put(`ranking:${jstDateKey()}`, board);
    const rows = toRows(board);
    return { ok: true, rank: rows.find((r) => r.number === entry.number)!.rank, top: rows.slice(0, RANKING_SIZE) };
  }

  async remove(number: number): Promise<boolean> {
    const board = await this.board();
    const next = board.filter((e) => e.number !== number);
    await this.ctx.storage.put(`ranking:${jstDateKey()}`, next);
    return next.length < board.length;
  }

  async all(): Promise<RankingRow[]> {
    return toRows(await this.board());
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

async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return undefined;
  }
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
        const parsed = publicStatusSchema.safeParse(await readJson(request));
        if (!parsed.success) return json({ error: "形式が不正です" }, 400);
        await store.write(parsed.data);
        return new Response(null, { status: 204 });
      }
      return json({ error: "許可されていないメソッドです" }, 405);
    }

    if (url.pathname === "/api/ranking") {
      if (request.method === "GET") {
        // スタッフ用（?all=1 は認証つき）：全員分を見る
        if (url.searchParams.has("all")) {
          if (!authorized(request, env.PUSH_TOKEN)) return json({ error: "認証に失敗しました" }, 401);
          return json({ rows: await store.all() });
        }
        return json({ top: await store.ranking() });
      }
      if (request.method === "POST") {
        // お客さん（子どもも）に見せるメッセージなので、ひらがなでやさしく
        const parsed = rankingSubmitSchema.safeParse(await readJson(request));
        if (!parsed.success) return json({ error: "形式が不正です" }, 400);
        const { number, score, playMs } = parsed.data;
        const name = normalizeName(parsed.data.name);
        if (!name) return json({ error: "なまえは 1〜10もじに してね" }, 400);
        if (containsNgWord(name)) return json({ error: "その なまえは つかえないよ。べつの なまえに してね" }, 400);
        if (!isPlausibleScore(score, playMs)) return json({ error: "きろくを たしかめられなかったよ" }, 400);
        const result = await store.submit({ number, name, score, at: new Date().toISOString() });
        return result.ok ? json(result) : json({ error: result.error }, 400);
      }
      if (request.method === "DELETE") {
        if (!authorized(request, env.PUSH_TOKEN)) return json({ error: "認証に失敗しました" }, 401);
        const n = Number(url.searchParams.get("number"));
        if (!Number.isInteger(n) || n < 1) return json({ error: "number を指定してください" }, 400);
        return json({ removed: await store.remove(n) });
      }
      return json({ error: "許可されていないメソッドです" }, 405);
    }

    return new Response("Not Found", { status: 404 });
  },
} satisfies ExportedHandler<Env>;
