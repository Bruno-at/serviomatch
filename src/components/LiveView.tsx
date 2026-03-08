import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Radio, Plus, Users, Eye } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { Tables } from "@/integrations/supabase/types";
import LiveRoom from "./LiveRoom";
import CreateLiveRoom from "./CreateLiveRoom";
import { toast } from "sonner";

interface RoomWithHost {
  room: Tables<"live_rooms">;
  hostName: string;
  hostAvatar: string | null;
}

const LiveView = () => {
  const { user } = useAuth();
  const [rooms, setRooms] = useState<RoomWithHost[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRoom, setSelectedRoom] = useState<RoomWithHost | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const fetchRooms = async () => {
    const { data: roomData } = await supabase
      .from("live_rooms")
      .select("*")
      .eq("is_active", true)
      .order("created_at", { ascending: false });

    if (!roomData || roomData.length === 0) {
      setRooms([]);
      setLoading(false);
      return;
    }

    const hostIds = [...new Set(roomData.map((r) => r.host_id))];
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, display_name, avatar_url")
      .in("user_id", hostIds);

    const result: RoomWithHost[] = roomData.map((room) => {
      const host = profiles?.find((p) => p.user_id === room.host_id);
      return {
        room,
        hostName: host?.display_name || "Unknown",
        hostAvatar: host?.avatar_url || null,
      };
    });

    setRooms(result);
    setLoading(false);
  };

  useEffect(() => {
    fetchRooms();

    // Subscribe to room changes
    const channel = supabase
      .channel("live_rooms_changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "live_rooms" },
        () => fetchRooms()
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const handleGoLive = async (title: string, description: string) => {
    if (!user) return;
    const { data, error } = await supabase
      .from("live_rooms")
      .insert({ host_id: user.id, title, description })
      .select()
      .single();

    if (error) {
      toast.error("Failed to create room");
      return;
    }

    setShowCreate(false);
    // Join own room
    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name, avatar_url")
      .eq("user_id", user.id)
      .single();

    setSelectedRoom({
      room: data,
      hostName: profile?.display_name || "You",
      hostAvatar: profile?.avatar_url || null,
    });
  };

  if (selectedRoom) {
    return (
      <LiveRoom
        room={selectedRoom.room}
        hostName={selectedRoom.hostName}
        hostAvatar={selectedRoom.hostAvatar}
        onLeave={() => { setSelectedRoom(null); fetchRooms(); }}
      />
    );
  }

  if (showCreate) {
    return <CreateLiveRoom onCreate={handleGoLive} onCancel={() => setShowCreate(false)} />;
  }

  return (
    <div className="flex h-full flex-col px-6 pt-4">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold font-display text-foreground flex items-center gap-2">
          <Radio className="h-6 w-6 text-primary" />
          Live
        </h1>
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1 rounded-full gradient-love px-4 py-1.5 text-xs font-semibold text-primary-foreground shadow-card"
        >
          <Plus className="h-3.5 w-3.5" />
          Go Live
        </motion.button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground text-center mt-16">Loading live rooms...</p>
      ) : rooms.length === 0 ? (
        <div className="flex flex-col items-center justify-center mt-16 text-center">
          <div className="rounded-full bg-muted p-5 mb-4">
            <Radio className="h-10 w-10 text-muted-foreground" />
          </div>
          <h2 className="text-lg font-bold font-display text-foreground">No one is live</h2>
          <p className="mt-2 text-sm text-muted-foreground max-w-[220px]">
            Be the first to go live and connect with people! 🎙️
          </p>
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => setShowCreate(true)}
            className="mt-6 rounded-2xl gradient-love px-8 py-3 text-sm font-semibold text-primary-foreground shadow-card"
          >
            Start a Live
          </motion.button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {rooms.map((item, i) => (
            <motion.button
              key={item.room.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
              onClick={() => setSelectedRoom(item)}
              className="relative overflow-hidden rounded-2xl bg-card shadow-card text-left"
            >
              {/* Gradient background with host initial */}
              <div className="relative h-32 gradient-love flex items-center justify-center">
                {item.hostAvatar ? (
                  <img src={item.hostAvatar} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="text-4xl font-bold text-primary-foreground/60 font-display">
                    {item.hostName.charAt(0).toUpperCase()}
                  </span>
                )}
                {/* Live badge */}
                <div className="absolute top-2 left-2 flex items-center gap-1 rounded-full bg-destructive px-2 py-0.5">
                  <div className="h-1.5 w-1.5 rounded-full bg-primary-foreground animate-pulse" />
                  <span className="text-[10px] font-bold text-primary-foreground">LIVE</span>
                </div>
                {/* Viewer count */}
                <div className="absolute bottom-2 right-2 flex items-center gap-1 rounded-full bg-foreground/50 backdrop-blur-sm px-2 py-0.5">
                  <Eye className="h-3 w-3 text-primary-foreground" />
                  <span className="text-[10px] font-semibold text-primary-foreground">
                    {item.room.viewer_count}
                  </span>
                </div>
              </div>
              <div className="p-3">
                <p className="text-sm font-semibold text-foreground truncate">{item.room.title}</p>
                <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                  <Users className="h-3 w-3" />
                  {item.hostName}
                </p>
              </div>
            </motion.button>
          ))}
        </div>
      )}
    </div>
  );
};

export default LiveView;
