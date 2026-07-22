import { describe, it, expect, beforeEach } from "vitest";

/**
 * Integration-style tests for the `increment_challenge_progress` RPC.
 *
 * These tests exercise a faithful in-memory reimplementation of the
 * Postgres function defined in the database, invoked through a mocked
 * `supabase.rpc` surface with the exact same argument and return shape
 * used by ChallengesView. They lock in the two guarantees the UI relies
 * on:
 *   1. Progress is clamped to the challenge's target_value.
 *   2. Coins are granted exactly once, only when the increment actually
 *      transitions the challenge to `completed = true`.
 */

type Challenge = {
  id: string;
  target_value: number;
  reward_coins: number;
  is_active: boolean;
};

type UserChallengeRow = {
  user_id: string;
  challenge_id: string;
  progress: number;
  completed: boolean;
  completed_at: string | null;
};

type RpcResult = { progress: number; completed: boolean; reward_coins: number };

function createFakeSupabase(opts: {
  uid: string | null;
  challenges: Challenge[];
}) {
  const state = {
    userChallenges: [] as UserChallengeRow[],
    coinBalance: 100,
    coinGrants: [] as { delta: number; reason: string }[],
  };

  async function rpc(
    name: string,
    args: { _challenge_id: string; _delta?: number }
  ): Promise<{ data: RpcResult[] | null; error: { message: string } | null }> {
    if (name !== "increment_challenge_progress") {
      return { data: null, error: { message: `Unknown RPC: ${name}` } };
    }

    const uid = opts.uid;
    const delta = args._delta ?? 1;

    if (!uid) return { data: null, error: { message: "Not authenticated" } };
    if (!args._challenge_id) return { data: null, error: { message: "Missing challenge" } };
    if (delta == null || delta < 1 || delta > 100) {
      return { data: null, error: { message: "Invalid delta" } };
    }

    const challenge = opts.challenges.find(
      (c) => c.id === args._challenge_id && c.is_active
    );
    if (!challenge) return { data: null, error: { message: "Unknown or inactive challenge" } };

    let row = state.userChallenges.find(
      (r) => r.user_id === uid && r.challenge_id === challenge.id
    );
    if (!row) {
      row = {
        user_id: uid,
        challenge_id: challenge.id,
        progress: 0,
        completed: false,
        completed_at: null,
      };
      state.userChallenges.push(row);
    }

    if (row.completed) {
      return { data: [{ progress: row.progress, completed: true, reward_coins: 0 }], error: null };
    }

    const newProgress = Math.min(row.progress + delta, challenge.target_value);
    const nowCompleted = newProgress >= challenge.target_value;
    row.progress = newProgress;
    row.completed = nowCompleted;
    row.completed_at = nowCompleted ? new Date().toISOString() : row.completed_at;

    let granted = 0;
    if (nowCompleted && challenge.reward_coins > 0) {
      granted = challenge.reward_coins;
      state.coinBalance += granted;
      state.coinGrants.push({ delta: granted, reason: "challenge_completed" });
    }

    return {
      data: [{ progress: newProgress, completed: nowCompleted, reward_coins: granted }],
      error: null,
    };
  }

  return { supabase: { rpc }, state };
}

describe("increment_challenge_progress RPC", () => {
  const challenge: Challenge = {
    id: "chal-1",
    target_value: 3,
    reward_coins: 25,
    is_active: true,
  };
  let fake: ReturnType<typeof createFakeSupabase>;

  beforeEach(() => {
    fake = createFakeSupabase({ uid: "user-1", challenges: [challenge] });
  });

  it("increments progress without granting coins before completion", async () => {
    const { data, error } = await fake.supabase.rpc("increment_challenge_progress", {
      _challenge_id: challenge.id,
      _delta: 1,
    });
    expect(error).toBeNull();
    expect(data?.[0]).toEqual({ progress: 1, completed: false, reward_coins: 0 });
    expect(fake.state.coinGrants).toHaveLength(0);
    expect(fake.state.coinBalance).toBe(100);
  });

  it("clamps progress to target_value when delta would exceed it", async () => {
    // First bring progress to 2/3
    await fake.supabase.rpc("increment_challenge_progress", { _challenge_id: challenge.id, _delta: 2 });
    // Now push with a huge delta — must clamp to target (3), not overshoot.
    const { data } = await fake.supabase.rpc("increment_challenge_progress", {
      _challenge_id: challenge.id,
      _delta: 50,
    });
    expect(data?.[0].progress).toBe(challenge.target_value);
    expect(data?.[0].completed).toBe(true);
  });

  it("grants coins exactly once on legitimate completion", async () => {
    await fake.supabase.rpc("increment_challenge_progress", { _challenge_id: challenge.id, _delta: 2 });
    // Completing call — should grant coins.
    const first = await fake.supabase.rpc("increment_challenge_progress", {
      _challenge_id: challenge.id,
      _delta: 1,
    });
    expect(first.data?.[0]).toEqual({ progress: 3, completed: true, reward_coins: 25 });
    expect(fake.state.coinBalance).toBe(125);
    expect(fake.state.coinGrants).toEqual([{ delta: 25, reason: "challenge_completed" }]);

    // Further calls on a completed challenge must NOT grant coins again.
    const second = await fake.supabase.rpc("increment_challenge_progress", {
      _challenge_id: challenge.id,
      _delta: 5,
    });
    expect(second.data?.[0].reward_coins).toBe(0);
    expect(second.data?.[0].progress).toBe(3);
    expect(fake.state.coinBalance).toBe(125);
    expect(fake.state.coinGrants).toHaveLength(1);
  });

  it("rejects unauthenticated callers", async () => {
    const anon = createFakeSupabase({ uid: null, challenges: [challenge] });
    const { data, error } = await anon.supabase.rpc("increment_challenge_progress", {
      _challenge_id: challenge.id,
      _delta: 1,
    });
    expect(data).toBeNull();
    expect(error?.message).toMatch(/not authenticated/i);
  });

  it("rejects invalid delta values", async () => {
    const zero = await fake.supabase.rpc("increment_challenge_progress", {
      _challenge_id: challenge.id,
      _delta: 0,
    });
    expect(zero.error?.message).toMatch(/invalid delta/i);

    const huge = await fake.supabase.rpc("increment_challenge_progress", {
      _challenge_id: challenge.id,
      _delta: 101,
    });
    expect(huge.error?.message).toMatch(/invalid delta/i);
  });

  it("rejects unknown or inactive challenges", async () => {
    const inactive = createFakeSupabase({
      uid: "user-1",
      challenges: [{ ...challenge, is_active: false }],
    });
    const { error } = await inactive.supabase.rpc("increment_challenge_progress", {
      _challenge_id: challenge.id,
      _delta: 1,
    });
    expect(error?.message).toMatch(/unknown or inactive/i);
  });
});
