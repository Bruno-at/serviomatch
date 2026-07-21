import { createClient } from "@supabase/supabase-js";
import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";

function supabaseForUser(ctx: ToolContext) {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export default defineTool({
  name: "list_matches",
  title: "List matches",
  description: "List the signed-in user's Spark matches with the other user's display name and profile summary.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const uid = ctx.getUserId();
    const supabase = supabaseForUser(ctx);
    const { data: matches, error } = await supabase
      .from("matches")
      .select("id, user1_id, user2_id, created_at")
      .or(`user1_id.eq.${uid},user2_id.eq.${uid}`)
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    if (!matches?.length) {
      return { content: [{ type: "text", text: "No matches yet." }], structuredContent: { matches: [] } };
    }

    const otherIds = matches.map((m) => (m.user1_id === uid ? m.user2_id : m.user1_id));
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, display_name, age, city, is_online")
      .in("user_id", otherIds);

    const byId = new Map((profiles ?? []).map((p) => [p.user_id, p]));
    const result = matches.map((m) => {
      const otherId = m.user1_id === uid ? m.user2_id : m.user1_id;
      return {
        match_id: m.id,
        matched_at: m.created_at,
        other_user_id: otherId,
        profile: byId.get(otherId) ?? null,
      };
    });

    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      structuredContent: { matches: result },
    };
  },
});
