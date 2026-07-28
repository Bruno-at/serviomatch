import { describe, it, expect, beforeEach, vi } from "vitest";
import { likeUser, unlikeUser } from "@/lib/likes";

/**
 * End-to-end style tests for the like / unlike flows.
 *
 * A faithful in-memory fake of the backend (likes table + the
 * `create_match_if_mutual` RPC, including its "mutual interest required"
 * rule and stable user1/user2 ordering) is driven through the exact same
 * client surface the app uses. Covers happy paths, matching, undo,
 * unauthenticated callers, duplicate likes and network failures.
 */

type LikeRow = { id: string; liker_id: string; liked_id: string };
type MatchRow = { id: string; user1_id: string; user2_id: string };

function createFakeBackend(opts: { uid: string | null; failOn?: string }) {
  const state = {
    likes: [] as LikeRow[],
    superLikes: [] as LikeRow[],
    matches: [] as MatchRow[],
    rpcCalls: [] as { name: string; args: any }[],
  };

  let seq = 0;
  const nextId = () => `id-${++seq}`;
  const netFail = (op: string) => {
    if (opts.failOn === op) throw new Error("Network request failed");
  };

  function table(name: string) {
    const rows = () =>
      name === "likes" ? state.likes : name === "super_likes" ? state.superLikes : ([] as LikeRow[]);

    return {
      insert(values: any) {
        netFail(`insert:${name}`);
        if (!opts.uid) {
          return Promise.resolve({ error: { code: "42501", message: "Not authenticated" } });
        }
        const dupe = rows().some(
          (r) => r.liker_id === values.liker_id && r.liked_id === values.liked_id
        );
        if (dupe) {
          return Promise.resolve({
            error: { code: "23505", message: "duplicate key value violates unique constraint" },
          });
        }
        rows().push({ id: nextId(), ...values });
        return Promise.resolve({ error: null });
      },
      select() {
        const filters: Record<string, string> = {};
        const builder: any = {
          eq(col: string, val: string) {
            filters[col] = val;
            return builder;
          },
          maybeSingle() {
            try {
              netFail(`select:${name}`);
            } catch (e: any) {
              return Promise.resolve({ data: null, error: { message: e.message } });
            }
            const found = rows().find((r) =>
              Object.entries(filters).every(([k, v]) => (r as any)[k] === v)
            );
            return Promise.resolve({ data: found ?? null, error: null });
          },
        };
        return builder;
      },
      delete() {
        const filters: Record<string, string> = {};
        const builder: any = {
          eq(col: string, val: string) {
            filters[col] = val;
            return builder;
          },
          then(resolve: any) {
            let result;
            try {
              netFail(`delete:${name}`);
              const list = rows();
              for (let i = list.length - 1; i >= 0; i--) {
                const match = Object.entries(filters).every(
                  ([k, v]) => (list[i] as any)[k] === v
                );
                if (match) list.splice(i, 1);
              }
              result = { error: null };
            } catch (e: any) {
              result = { error: { message: e.message } };
            }
            return Promise.resolve(result).then(resolve);
          },
        };
        return builder;
      },
    };
  }

  async function rpc(name: string, args: any) {
    state.rpcCalls.push({ name, args });
    if (name !== "create_match_if_mutual") {
      return { data: null, error: { message: `Unknown RPC: ${name}` } };
    }
    const uid = opts.uid;
    if (!uid) return { data: null, error: { message: "Not authenticated" } };
    const other = args._other_user_id;
    if (!other || other === uid) return { data: null, error: { message: "Invalid target user" } };

    const a = state.likes.some((l) => l.liker_id === uid && l.liked_id === other);
    const b = state.likes.some((l) => l.liker_id === other && l.liked_id === uid);
    if (!(a && b)) return { data: null, error: { message: "Mutual interest required" } };

    const [u1, u2] = [uid, other].sort();
    const existing = state.matches.find((m) => m.user1_id === u1 && m.user2_id === u2);
    if (existing) return { data: existing.id, error: null };

    const row = { id: nextId(), user1_id: u1, user2_id: u2 };
    state.matches.push(row);
    return { data: row.id, error: null };
  }

  return { client: { from: table, rpc } as any, state };
}

const ME = "11111111-1111-1111-1111-111111111111";
const THEM = "22222222-2222-2222-2222-222222222222";

describe("like flow (end to end)", () => {
  let backend: ReturnType<typeof createFakeBackend>;

  beforeEach(() => {
    backend = createFakeBackend({ uid: ME });
  });

  it("records a one-sided like without creating a match", async () => {
    const res = await likeUser(ME, THEM, backend.client);

    expect(res).toEqual({ ok: true, matched: false, matchId: null });
    expect(backend.state.likes).toHaveLength(1);
    expect(backend.state.matches).toHaveLength(0);
    expect(backend.state.rpcCalls).toHaveLength(0);
  });

  it("creates a match when the like is mutual", async () => {
    backend.state.likes.push({ id: "seed", liker_id: THEM, liked_id: ME });

    const res = await likeUser(ME, THEM, backend.client);

    expect(res.ok).toBe(true);
    expect(res.matched).toBe(true);
    expect(res.matchId).toBeTruthy();
    expect(backend.state.matches).toHaveLength(1);
    // Stable ordering: user1_id is always the lower uuid
    const [u1, u2] = [ME, THEM].sort();
    expect(backend.state.matches[0]).toMatchObject({ user1_id: u1, user2_id: u2 });
  });

  it("always creates matches through the create_match_if_mutual RPC", async () => {
    backend.state.likes.push({ id: "seed", liker_id: THEM, liked_id: ME });
    await likeUser(ME, THEM, backend.client);

    expect(backend.state.rpcCalls).toEqual([
      { name: "create_match_if_mutual", args: { _other_user_id: THEM } },
    ]);
  });

  it("is idempotent — liking twice yields one like and one match", async () => {
    backend.state.likes.push({ id: "seed", liker_id: THEM, liked_id: ME });

    const first = await likeUser(ME, THEM, backend.client);
    const second = await likeUser(ME, THEM, backend.client);

    expect(first.matchId).toBe(second.matchId);
    expect(backend.state.likes.filter((l) => l.liker_id === ME)).toHaveLength(1);
    expect(backend.state.matches).toHaveLength(1);
  });

  it("rejects unauthenticated users without touching the backend", async () => {
    const anon = createFakeBackend({ uid: null });
    const res = await likeUser(null, THEM, anon.client);

    expect(res).toEqual({ ok: false, error: "Not authenticated" });
    expect(anon.state.likes).toHaveLength(0);
    expect(anon.state.rpcCalls).toHaveLength(0);
  });

  it("rejects self-likes and missing targets", async () => {
    expect(await likeUser(ME, ME, backend.client)).toEqual({
      ok: false,
      error: "Invalid target user",
    });
    expect(await likeUser(ME, null, backend.client)).toEqual({
      ok: false,
      error: "Invalid target user",
    });
    expect(backend.state.likes).toHaveLength(0);
  });

  it("surfaces a network failure while inserting the like", async () => {
    const flaky = createFakeBackend({ uid: ME, failOn: "insert:likes" });
    const res = await likeUser(ME, THEM, flaky.client);

    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/network/i);
    expect(flaky.state.matches).toHaveLength(0);
  });

  it("surfaces a network failure while checking for a reciprocal like", async () => {
    const flaky = createFakeBackend({ uid: ME, failOn: "select:likes" });
    const res = await likeUser(ME, THEM, flaky.client);

    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/network/i);
    expect(flaky.state.matches).toHaveLength(0);
  });

  it("reports an error when the match RPC fails", async () => {
    backend.state.likes.push({ id: "seed", liker_id: THEM, liked_id: ME });
    const failing = {
      ...backend.client,
      rpc: vi.fn(async () => ({ data: null, error: { message: "Mutual interest required" } })),
    };

    const res = await likeUser(ME, THEM, failing as any);

    expect(res).toEqual({ ok: false, error: "Mutual interest required" });
  });
});

describe("unlike flow (undo)", () => {
  it("removes the like and any super like", async () => {
    const backend = createFakeBackend({ uid: ME });
    await likeUser(ME, THEM, backend.client);
    backend.state.superLikes.push({ id: "s1", liker_id: ME, liked_id: THEM });

    const res = await unlikeUser(ME, THEM, backend.client);

    expect(res).toEqual({ ok: true });
    expect(backend.state.likes).toHaveLength(0);
    expect(backend.state.superLikes).toHaveLength(0);
  });

  it("leaves other users' likes untouched", async () => {
    const backend = createFakeBackend({ uid: ME });
    backend.state.likes.push({ id: "other", liker_id: THEM, liked_id: ME });
    await likeUser(ME, THEM, backend.client);

    await unlikeUser(ME, THEM, backend.client);

    expect(backend.state.likes).toEqual([{ id: "other", liker_id: THEM, liked_id: ME }]);
  });

  it("re-liking after an undo works and can still produce a match", async () => {
    const backend = createFakeBackend({ uid: ME });
    backend.state.likes.push({ id: "seed", liker_id: THEM, liked_id: ME });

    await likeUser(ME, THEM, backend.client);
    await unlikeUser(ME, THEM, backend.client);
    const again = await likeUser(ME, THEM, backend.client);

    expect(again.matched).toBe(true);
    expect(backend.state.matches).toHaveLength(1);
  });

  it("rejects unauthenticated undo", async () => {
    const anon = createFakeBackend({ uid: null });
    expect(await unlikeUser(null, THEM, anon.client)).toEqual({
      ok: false,
      error: "Not authenticated",
    });
  });

  it("surfaces network failures during undo", async () => {
    const flaky = createFakeBackend({ uid: ME, failOn: "delete:likes" });
    flaky.state.likes.push({ id: "l1", liker_id: ME, liked_id: THEM });

    const res = await unlikeUser(ME, THEM, flaky.client);

    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/network/i);
    expect(flaky.state.likes).toHaveLength(1);
  });
});
