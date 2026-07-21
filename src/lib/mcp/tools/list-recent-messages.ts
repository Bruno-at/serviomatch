import { createClient } from "@supabase/supabase-js";
import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";

function supabaseForUser(ctx: ToolContext) {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export default defineTool({
  name: "list_recent_messages",
  title: "List recent messages",
  description: "Return the most recent chat messages for one of the signed-in user's Spark matches.",
  inputSchema: {
    match_id: z.string().uuid().describe("Match id from list_matches."),
    limit: z.number().int().min(1).max(100).describe("How many recent messages to return (max 100)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ match_id, limit }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("messages")
      .select("id, sender_id, content, created_at")
      .eq("match_id", match_id)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    const messages = (data ?? []).reverse();
    return {
      content: [{ type: "text", text: JSON.stringify(messages, null, 2) }],
      structuredContent: { messages },
    };
  },
});
