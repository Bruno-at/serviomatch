import { supabase } from "@/integrations/supabase/client";
import { likeUser } from "@/lib/likes";

type Client = Pick<typeof supabase, "from" | "rpc">;

export type MatchFlowResult = {
  ok: boolean;
  matchId?: string | null;
  error?: string;
  notifiedOther?: boolean;
  notifiedSelf?: boolean;
};

/** Match ids whose popup was already shown locally by the initiating user. */
const locallyHandledMatches = new Set<string>();

export function markMatchHandledLocally(matchId: string) {
  locallyHandledMatches.add(matchId);
}

/** True if this client already showed UI for the match (avoids duplicate popups). */
export function wasMatchHandledLocally(matchId: string) {
  return locallyHandledMatches.has(matchId);
}

/**
 * Likes back a user who already liked me: creates the match through the secure
 * RPC and pushes a match notification to BOTH sides of the match.
 */
export async function likeBackAndMatch(
  userId: string | null | undefined,
  target: { id: string; name?: string | null },
  myName: string | null | undefined,
  client: Client = supabase
): Promise<MatchFlowResult> {
  const res = await likeUser(userId, target?.id, client);
  if (!res.ok || !res.matchId) {
    return { ok: false, error: res.error || "Could not create match" };
  }

  let notifiedOther = false;
  let notifiedSelf = false;

  try {
    const { error } = await client.rpc("send_notification" as any, {
      _target_user_id: target.id,
      _type: "match",
      _title: "It's a match! 💖",
      _message: `You matched with ${myName || "someone"}`,
    } as any);
    notifiedOther = !error;
  } catch {
    notifiedOther = false;
  }

  try {
    const { error } = await client.from("notifications").insert({
      user_id: userId as string,
      type: "match",
      title: "It's a match! 💖",
      message: `You matched with ${target.name || "someone"}`,
    });
    notifiedSelf = !error;
  } catch {
    notifiedSelf = false;
  }

  return { ok: true, matchId: res.matchId, notifiedOther, notifiedSelf };
}

/** Removes every like entry from a matched user — matches never belong on Likes. */
export function removeMatchedFromLikes<T extends { liker_id: string }>(
  likes: T[],
  matchedUserId: string
): T[] {
  return likes.filter((l) => l.liker_id !== matchedUserId);
}

/** Matches visible to a user (same query the Matches page uses). */
export async function fetchMatchesFor(userId: string, client: Client = supabase) {
  const { data, error } = await client
    .from("matches")
    .select("*")
    .or(`user1_id.eq.${userId},user2_id.eq.${userId}`)
    .order("created_at", { ascending: false });
  return { matches: data || [], error: error?.message };
}
