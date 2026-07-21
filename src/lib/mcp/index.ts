import { auth, defineMcp } from "@lovable.dev/mcp-js";
import getMyProfile from "./tools/get-my-profile";
import updateMyBio from "./tools/update-my-bio";
import listMatches from "./tools/list-matches";
import listRecentMessages from "./tools/list-recent-messages";
import sendMessage from "./tools/send-message";

const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "spark-mcp",
  title: "Spark",
  version: "0.1.0",
  instructions:
    "Tools for the Spark dating app. Use get_my_profile and update_my_bio for the signed-in user's profile, list_matches to see matches, and list_recent_messages / send_message for chat.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [getMyProfile, updateMyBio, listMatches, listRecentMessages, sendMessage],
});
