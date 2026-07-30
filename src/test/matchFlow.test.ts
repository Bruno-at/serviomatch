import { describe, it, expect, beforeEach } from "vitest";
import { likeBackAndMatch, removeMatchedFromLikes, fetchMatchesFor } from "@/lib/matchFlow";

/**
 * End-to-end style tests for the mutual-like -> match flow:
 *  - the match is created through the secure RPC
 *  - BOTH users receive a "match" notification (matcher + matched)
 *  - the matched user disappears from the Likes page list
 *  - the match shows up on the Matches page for both users
 */

type Row = Record<string, any>;

const ME = "11111111-1111-1111-1111-111111111111";
const THEM = "22222222-2222-2222-2222-222222222222";
const OTHER = "33333333-3333-3333-3333-333333333333";

function createBackend(opts: { uid: string | null; failRpc?: string } = { uid: ME }) {
  const state = {
    likes: [] as Row[],
    super_likes: [] as Row[],
    matches: [] as Row[],
    notifications: [] as Row[],
  };
  let seq = 0;
  const nextId = () => `id-${++seq}`;

  const tableRows = (name: string): Row[] => {
    if (!(name in state)) (state as any)[name] = [];
    return (state as any)[name];
  };

  function from(name: string) {
    const rows = () => tableRows(name);
    return {
      insert(values: Row) {
        if (!opts.uid) return Promise.resolve({ error: { message: "Not authenticated" } });
        if (name === "notifications" && values.user_id !== opts.uid) {
          // RLS: users may only insert notifications for themselves
          return Promise.resolve({ error: { message: "new row violates row-level security policy" } });
        }
        const dupe =
          name === "likes" &&
          rows().some((r) => r.liker_id === values.liker_id && r.liked_id === values.liked_id);
        if (dupe) return Promise.resolve({ error: { code: "23505", message: "duplicate key" } });
        rows().push({ id: nextId(), created_at: new Date().toISOString(), ...values });
        return Promise.resolve({ error: null });
      },
      select() {
        const eqs: [string, string][] = [];
        let orExpr: string | null = null;
        const run = () => {
          let list = rows().filter((r) => eqs.every(([k, v]) => r[k] === v));
          if (orExpr) {
            const clauses = orExpr.split(",").map((c) => {
              const [col, , val] = [c.split(".")[0], c.split(".")[1], c.split(".").slice(2).join(".")];
              return [col, val] as [string, string];
            });
            list = list.filter((r) => clauses.some(([col, val]) => r[col] === val));
          }
          return list;
        };
        const builder: any = {
          eq(col: string, val: string) {
            eqs.push([col, val]);
            return builder;
          },
          or(expr: string) {
            orExpr = expr;
            return builder;
          },
          order() {
            return builder;
          },
          maybeSingle() {
            return Promise.resolve({ data: run()[0] ?? null, error: null });
          },
          then(resolve: any) {
            return Promise.resolve({ data: run(), error: null }).then(resolve);
          },
        };
        return builder;
      },
      delete() {
        const eqs: [string, string][] = [];
        const builder: any = {
          eq(col: string, val: string) {
            eqs.push([col, val]);
            return builder;
          },
          then(resolve: any) {
            const list = rows();
            for (let i = list.length - 1; i >= 0; i--) {
              if (eqs.every(([k, v]) => list[i][k] === v)) list.splice(i, 1);
            }
            return Promise.resolve({ error: null }).then(resolve);
          },
        };
        return builder;
      },
    };
  }

  async function rpc(name: string, args: Row) {
    if (opts.failRpc === name) return { data: null, error: { message: `${name} failed` } };
    const uid = opts.uid;
    if (!uid) return { data: null, error: { message: "Not authenticated" } };

    if (name === "create_match_if_mutual") {
      const other = args._other_user_id;
      const a = state.likes.some((l) => l.liker_id === uid && l.liked_id === other);
      const b = state.likes.some((l) => l.liker_id === other && l.liked_id === uid);
      if (!(a && b)) return { data: null, error: { message: "Mutual interest required" } };
      const [u1, u2] = [uid, other].sort();
      const existing = state.matches.find((m) => m.user1_id === u1 && m.user2_id === u2);
      if (existing) return { data: existing.id, error: null };
      const row = { id: nextId(), user1_id: u1, user2_id: u2, created_at: new Date().toISOString() };
      state.matches.push(row);
      return { data: row.id, error: null };
    }

    if (name === "send_notification") {
      state.notifications.push({
        id: nextId(),
        user_id: args._target_user_id,
        type: args._type,
        title: args._title,
        message: args._message,
        is_read: false,
        created_at: new Date().toISOString(),
      });
      return { data: state.notifications.at(-1)!.id, error: null };
    }

    return { data: null, error: { message: `Unknown RPC: ${name}` } };
  }

  return { client: { from, rpc } as any, state };
}

describe("mutual like → match notification UI", () => {
  let backend: ReturnType<typeof createBackend>;

  beforeEach(() => {
    backend = createBackend({ uid: ME });
    // THEM already liked ME — this like is what shows on my Likes page
    backend.state.likes.push({ id: "seed", liker_id: THEM, liked_id: ME });
  });

  it("creates the match and notifies BOTH users", async () => {
    const res = await likeBackAndMatch(ME, { id: THEM, name: "Ada" }, "Bruno", backend.client);

    expect(res.ok).toBe(true);
    expect(res.matchId).toBeTruthy();
    expect(res.notifiedOther).toBe(true);
    expect(res.notifiedSelf).toBe(true);

    const forThem = backend.state.notifications.filter((n) => n.user_id === THEM);
    const forMe = backend.state.notifications.filter((n) => n.user_id === ME);

    expect(forThem).toHaveLength(1);
    expect(forMe).toHaveLength(1);
    expect(forThem[0]).toMatchObject({ type: "match" });
    expect(forThem[0].message).toContain("Bruno");
    expect(forMe[0].message).toContain("Ada");
  });

  it("removes the matched user from the Likes page list", async () => {
    let likesUi = [{ id: "seed", liker_id: THEM }, { id: "l2", liker_id: OTHER }];

    const res = await likeBackAndMatch(ME, { id: THEM, name: "Ada" }, "Bruno", backend.client);
    expect(res.ok).toBe(true);

    likesUi = removeMatchedFromLikes(likesUi, THEM);

    expect(likesUi.map((l) => l.liker_id)).toEqual([OTHER]);
    expect(likesUi.some((l) => l.liker_id === THEM)).toBe(false);
  });

  it("does not resurface the matched user even after a Likes page refetch", async () => {
    await likeBackAndMatch(ME, { id: THEM, name: "Ada" }, "Bruno", backend.client);

    const { matches } = await fetchMatchesFor(ME, backend.client);
    const matchedIds = new Set(
      matches.map((m: any) => (m.user1_id === ME ? m.user2_id : m.user1_id))
    );

    const { data: rawLikes } = await (backend.client
      .from("likes")
      .select("*")
      .eq("liked_id", ME) as any);
    const visible = (rawLikes as Row[]).filter((l) => !matchedIds.has(l.liker_id));

    expect(rawLikes.length).toBeGreaterThan(0);
    expect(visible).toHaveLength(0);
  });

  it("shows the new match on the Matches page for both users", async () => {
    const res = await likeBackAndMatch(ME, { id: THEM, name: "Ada" }, "Bruno", backend.client);

    const mine = await fetchMatchesFor(ME, backend.client);
    const theirs = await fetchMatchesFor(THEM, backend.client);

    expect(mine.matches.map((m: any) => m.id)).toContain(res.matchId);
    expect(theirs.matches.map((m: any) => m.id)).toContain(res.matchId);
    const [u1, u2] = [ME, THEM].sort();
    expect(mine.matches[0]).toMatchObject({ user1_id: u1, user2_id: u2 });
  });

  it("is idempotent — liking back twice keeps a single match", async () => {
    const a = await likeBackAndMatch(ME, { id: THEM, name: "Ada" }, "Bruno", backend.client);
    const b = await likeBackAndMatch(ME, { id: THEM, name: "Ada" }, "Bruno", backend.client);

    expect(a.matchId).toBe(b.matchId);
    expect(backend.state.matches).toHaveLength(1);
    const { matches } = await fetchMatchesFor(ME, backend.client);
    expect(matches).toHaveLength(1);
  });

  it("does not remove the like or notify when match creation fails", async () => {
    const failing = createBackend({ uid: ME, failRpc: "create_match_if_mutual" });
    failing.state.likes.push({ id: "seed", liker_id: THEM, liked_id: ME });

    const res = await likeBackAndMatch(ME, { id: THEM, name: "Ada" }, "Bruno", failing.client);

    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/create_match_if_mutual failed/);
    expect(failing.state.matches).toHaveLength(0);
    expect(failing.state.notifications).toHaveLength(0);

    const likesUi = removeMatchedFromLikes([{ id: "seed", liker_id: THEM }], "nobody");
    expect(likesUi).toHaveLength(1);
  });

  it("still matches when the other user's notification fails to send", async () => {
    const partial = createBackend({ uid: ME, failRpc: "send_notification" });
    partial.state.likes.push({ id: "seed", liker_id: THEM, liked_id: ME });

    const res = await likeBackAndMatch(ME, { id: THEM, name: "Ada" }, "Bruno", partial.client);

    expect(res.ok).toBe(true);
    expect(res.notifiedOther).toBe(false);
    expect(res.notifiedSelf).toBe(true);
    expect(partial.state.matches).toHaveLength(1);
  });

  it("rejects unauthenticated like-backs", async () => {
    const anon = createBackend({ uid: null });
    const res = await likeBackAndMatch(null, { id: THEM }, "Bruno", anon.client);

    expect(res.ok).toBe(false);
    expect(anon.state.matches).toHaveLength(0);
    expect(anon.state.notifications).toHaveLength(0);
  });
});
