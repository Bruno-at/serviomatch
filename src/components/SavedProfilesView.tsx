import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Star, Bookmark, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface SavedProfile {
  id: string;
  saved_id: string;
  display_name: string;
  avatar_url: string | null;
  bio: string | null;
  age: number | null;
}

interface SavedProfilesViewProps {
  type: "favorites" | "bookmarks";
  onBack: () => void;
}

const SavedProfilesView = ({ type, onBack }: SavedProfilesViewProps) => {
  const { user } = useAuth();
  const [profiles, setProfiles] = useState<SavedProfile[]>([]);
  const [loading, setLoading] = useState(true);

  const table = type === "favorites" ? "favorites" : "bookmarks";
  const idCol = type === "favorites" ? "favorited_id" : "bookmarked_id";
  const icon = type === "favorites" ? Star : Bookmark;
  const Icon = icon;
  const title = type === "favorites" ? "Favorites" : "Bookmarks";

  useEffect(() => {
    if (!user) return;
    const fetch = async () => {
      const { data } = await supabase
        .from(table)
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (!data || data.length === 0) {
        setProfiles([]);
        setLoading(false);
        return;
      }

      const ids = data.map((d: any) => d[idCol]);
      const { data: profileData } = await supabase
        .from("profiles")
        .select("user_id, display_name, avatar_url, bio, age")
        .in("user_id", ids);

      const merged = data.map((d: any) => {
        const p = profileData?.find((p) => p.user_id === d[idCol]);
        return {
          id: d.id,
          saved_id: d[idCol],
          display_name: p?.display_name || "Unknown",
          avatar_url: p?.avatar_url,
          bio: p?.bio,
          age: p?.age,
        };
      });

      setProfiles(merged);
      setLoading(false);
    };
    fetch();
  }, [user, table, idCol]);

  const handleRemove = async (id: string) => {
    await supabase.from(table).delete().eq("id", id);
    setProfiles((prev) => prev.filter((p) => p.id !== id));
    toast.success("Removed");
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 px-6 pt-4 pb-2">
        <button onClick={onBack} className="text-foreground">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-xl font-bold font-display text-foreground flex items-center gap-2">
          <Icon className="h-5 w-5 text-primary" />
          {title}
        </h1>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-2">
        {loading ? (
          <p className="text-center text-sm text-muted-foreground mt-10">Loading...</p>
        ) : profiles.length === 0 ? (
          <div className="flex flex-col items-center justify-center mt-20 text-center">
            <div className="rounded-full bg-muted p-4 mb-3">
              <Icon className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">
              No {type} yet. Start exploring!
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <AnimatePresence>
              {profiles.map((p) => (
                <motion.div
                  key={p.id}
                  layout
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="flex items-center gap-3 rounded-2xl bg-card p-3 border border-border"
                >
                  <div className="h-14 w-14 rounded-full overflow-hidden bg-muted flex-shrink-0">
                    {p.avatar_url ? (
                      <img src={p.avatar_url} alt={p.display_name} className="h-full w-full object-cover" />
                    ) : (
                      <div className="h-full w-full flex items-center justify-center text-muted-foreground text-lg font-bold">
                        {p.display_name[0]}
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-foreground text-sm truncate">
                      {p.display_name}{p.age ? `, ${p.age}` : ""}
                    </p>
                    {p.bio && (
                      <p className="text-xs text-muted-foreground truncate">{p.bio}</p>
                    )}
                  </div>
                  <motion.button
                    whileTap={{ scale: 0.85 }}
                    onClick={() => handleRemove(p.id)}
                    className="p-2 rounded-full hover:bg-destructive/10 transition-colors"
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </motion.button>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
};

export default SavedProfilesView;
