import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Moon, Heart, MessageCircle, Coffee, MapPin, Wifi } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";

interface NearbyTonightProps {
  onNavigateToChat?: (matchId: string, profile: Tables<"profiles">) => void;
}

interface TonightUser {
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  age: number | null;
  is_online: boolean;
  distance: number;
}

const haversineDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const NearbyTonight = ({ onNavigateToChat }: NearbyTonightProps) => {
  const { user } = useAuth();
  const [available, setAvailable] = useState(false);
  const [tonightUsers, setTonightUsers] = useState<TonightUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [maxDistance, setMaxDistance] = useState(10);
  const [myLocation, setMyLocation] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("available_tonight, latitude, longitude")
      .eq("user_id", user.id)
      .single()
      .then(({ data }) => {
        if (data) {
          setAvailable(!!(data as any).available_tonight);
          if (data.latitude && data.longitude) setMyLocation({ lat: data.latitude, lng: data.longitude });
        }
      });
  }, [user]);

  const toggleAvailable = async (checked: boolean) => {
    if (!user) return;
    setAvailable(checked);
    await supabase.from("profiles").update({ available_tonight: checked } as any).eq("user_id", user.id);
    if (checked) {
      toast.success("🌙 You're available tonight!");
      fetchTonightUsers();
    } else {
      toast("You're no longer available tonight");
    }
  };

  const fetchTonightUsers = useCallback(async () => {
    if (!user || !myLocation) return;
    setLoading(true);

    const { data } = await supabase
      .from("profiles")
      .select("user_id, display_name, avatar_url, age, latitude, longitude, is_online, available_tonight")
      .eq("available_tonight", true)
      .neq("user_id", user.id)
      .not("latitude", "is", null)
      .not("longitude", "is", null);

    if (data) {
      const withDist = data
        .map((p) => ({
          user_id: p.user_id,
          display_name: p.display_name,
          avatar_url: p.avatar_url,
          age: p.age,
          is_online: p.is_online ?? false,
          distance: haversineDistance(myLocation.lat, myLocation.lng, p.latitude!, p.longitude!),
        }))
        .filter((p) => p.distance <= maxDistance)
        .sort((a, b) => a.distance - b.distance);
      setTonightUsers(withDist);
    }
    setLoading(false);
  }, [user, myLocation, maxDistance]);

  useEffect(() => {
    if (available && myLocation) fetchTonightUsers();
  }, [available, myLocation, fetchTonightUsers]);

  const handleLike = async (targetId: string) => {
    if (!user) return;
    await supabase.from("likes").insert({ liker_id: user.id, liked_id: targetId });
    toast.success("❤️ Liked!");
  };

  const handleInviteCoffee = async (targetId: string, name: string) => {
    if (!user) return;
    await supabase.from("waves").insert({ sender_id: user.id, receiver_id: targetId });
    toast.success(`☕ Coffee invite sent to ${name}!`);
  };

  const formatDist = (km: number) => (km < 1 ? "< 1 km" : `${Math.round(km)} km`);

  return (
    <div className="mb-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="rounded-full bg-accent/15 p-1.5">
            <Moon className="h-4 w-4 text-accent" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">Nearby Tonight</h3>
            <p className="text-[10px] text-muted-foreground">Find people available now</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground">Available</span>
          <Switch checked={available} onCheckedChange={toggleAvailable} />
        </div>
      </div>

      {/* Distance selector */}
      {available && (
        <div className="flex items-center gap-2 mb-3">
          {[1, 5, 10].map((d) => (
            <button
              key={d}
              onClick={() => setMaxDistance(d)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                maxDistance === d
                  ? "bg-accent/15 text-accent border border-accent/30"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {d} km
            </button>
          ))}
        </div>
      )}

      {/* Users */}
      <AnimatePresence>
        {available && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            {loading ? (
              <p className="text-xs text-muted-foreground text-center py-4">Finding people nearby...</p>
            ) : tonightUsers.length === 0 ? (
              <div className="rounded-2xl bg-muted/50 p-4 text-center">
                <Moon className="h-6 w-6 text-muted-foreground mx-auto mb-1" />
                <p className="text-xs text-muted-foreground">No one available nearby yet. Check back later!</p>
              </div>
            ) : (
              <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
                {tonightUsers.map((person, i) => (
                  <motion.div
                    key={person.user_id}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: i * 0.05 }}
                    className="flex flex-col items-center shrink-0 w-[100px]"
                  >
                    <div className="relative mb-1">
                      <div className="rounded-full p-0.5 bg-gradient-to-br from-accent to-primary">
                        <Avatar className="h-16 w-16 border-2 border-card">
                          <AvatarImage src={person.avatar_url || ""} />
                          <AvatarFallback className="bg-muted text-muted-foreground font-bold">
                            {person.display_name[0]}
                          </AvatarFallback>
                        </Avatar>
                      </div>
                      {person.is_online && (
                        <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-green-500 border-2 border-card" />
                      )}
                    </div>
                    <p className="text-[11px] font-semibold text-foreground truncate w-full text-center">
                      {person.display_name.split(" ")[0]}{person.age ? `, ${person.age}` : ""}
                    </p>
                    <p className="text-[9px] text-muted-foreground flex items-center gap-0.5">
                      <MapPin className="h-2.5 w-2.5" /> {formatDist(person.distance)}
                    </p>
                    <div className="flex gap-1 mt-1.5">
                      <button onClick={() => handleLike(person.user_id)} className="rounded-full bg-primary/15 p-1.5">
                        <Heart className="h-3 w-3 text-primary" />
                      </button>
                      <button onClick={() => handleInviteCoffee(person.user_id, person.display_name)} className="rounded-full bg-accent/15 p-1.5">
                        <Coffee className="h-3 w-3 text-accent" />
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default NearbyTonight;
