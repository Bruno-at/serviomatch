import { supabase } from "@/integrations/supabase/client";

export type LikeResult =
  | { ok: true; matched: boolean; matchId: string | null }
  | { ok: false; error: string };

export type UnlikeResult = { ok: true } | { ok: false; error: string };

type Client = Pick<typeof supabase, "from" | "rpc">;

/**
 * Likes a user and creates a match when the interest is mutual.
 * Matches are always created through the `create_match_if_mutual` RPC —
 * direct inserts into `matches` are blocked by RLS.
 */
export async function likeUser(
  userId: string | null | undefined,
  targetId: string | null | undefined,
  client: Client = supabase
): Promise<LikeResult> {
  if (!userId) return { ok: false, error: "Not authenticated" };
  if (!targetId || targetId === userId) return { ok: false, error: "Invalid target user" };

  try {
    const { error: insertError } = await client
      .from("likes")
      .insert({ liker_id: userId, liked_id: targetId });

    // Duplicate likes are fine (idempotent); anything else is a real failure.
    if (insertError && !isDuplicate(insertError)) {
      return { ok: false, error: insertError.message || "Could not save like" };
    }

    const { data: reciprocal, error: reciprocalError } = await client
      .from("likes")
      .select("id")
      .eq("liker_id", targetId)
      .eq("liked_id", userId)
      .maybeSingle();

    if (reciprocalError) {
      return { ok: false, error: reciprocalError.message || "Could not check for a match" };
    }
    if (!reciprocal) return { ok: true, matched: false, matchId: null };

    const { data: matchId, error: rpcError } = await client.rpc(
      "create_match_if_mutual" as any,
      { _other_user_id: targetId } as any
    );

    if (rpcError || !matchId) {
      return { ok: false, error: rpcError?.message || "Could not create match" };
    }

    return { ok: true, matched: true, matchId: matchId as unknown as string };
  } catch (e: any) {
    return { ok: false, error: e?.message || "Network error" };
  }
}

/** Removes a like (and any super like) — used by Undo. */
export async function unlikeUser(
  userId: string | null | undefined,
  targetId: string | null | undefined,
  client: Client = supabase
): Promise<UnlikeResult> {
  if (!userId) return { ok: false, error: "Not authenticated" };
  if (!targetId) return { ok: false, error: "Invalid target user" };

  try {
    const results = await Promise.all([
      client.from("likes").delete().eq("liker_id", userId).eq("liked_id", targetId),
      client.from("super_likes").delete().eq("liker_id", userId).eq("liked_id", targetId),
    ]);
    const failed = results.find((r: any) => r?.error);
    if (failed) return { ok: false, error: (failed as any).error.message || "Could not undo like" };
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message || "Network error" };
  }
}

function isDuplicate(error: { code?: string | null; message?: string | null }) {
  return error?.code === "23505" || /duplicate key/i.test(error?.message || "");
}
