import { useState, useEffect, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import { MapPin, Wifi, WifiOff, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { toast } from "sonner";
import { reverseGeocode, openInGoogleMaps } from "@/lib/geo";

interface NearbyUser {
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  age: number | null;
  is_online: boolean;
  last_online: string | null;
  distance: number;
  latitude: number;
  longitude: number;
  place_name?: string;
}

const haversineDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

// reverseGeocode now imported from @/lib/geo

// "Online" if last_online within last 2 minutes
const ONLINE_THRESHOLD_MS = 2 * 60 * 1000;
const isUserOnline = (last_online: string | null, is_online: boolean): boolean => {
  if (!last_online) return false;
  const diff = Date.now() - new Date(last_online).getTime();
  return is_online && diff < ONLINE_THRESHOLD_MS;
};

const NearbyView = () => {
  const { user } = useAuth();
  const [nearbyUsers, setNearbyUsers] = useState<NearbyUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [myLocation, setMyLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [filterOnline, setFilterOnline] = useState<"online" | "offline">("online");
  const [locationError, setLocationError] = useState(false);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const updateMyLocation = useCallback(async (lat: number, lng: number) => {
    if (!user) return;
    await supabase
      .from("profiles")
      .update({ latitude: lat, longitude: lng, is_online: true, last_online: new Date().toISOString() })
      .eq("user_id", user.id);
  }, [user]);

  const fetchNearby = useCallback(async (lat: number, lng: number) => {
    if (!user) return;
    setLoading(true);

    const { data } = await supabase
      .from("profiles")
      .select("user_id, display_name, avatar_url, age, latitude, longitude, is_online, last_online")
      .neq("user_id", user.id)
      .not("latitude", "is", null)
      .not("longitude", "is", null);

    if (data) {
      const withDistance: NearbyUser[] = data
        .map((p) => ({
          user_id: p.user_id,
          display_name: p.display_name,
          avatar_url: p.avatar_url,
          age: p.age,
          latitude: p.latitude!,
          longitude: p.longitude!,
          is_online: p.is_online ?? false,
          last_online: p.last_online,
          distance: haversineDistance(lat, lng, p.latitude!, p.longitude!),
        }))
        .filter((p) => p.distance <= 50)
        .sort((a, b) => a.distance - b.distance);

      setNearbyUsers(withDistance);

      // Reverse-geocode in background and patch in
      withDistance.slice(0, 30).forEach(async (u) => {
        const name = await reverseGeocode(u.latitude, u.longitude);
        setNearbyUsers((prev) =>
          prev.map((p) => (p.user_id === u.user_id ? { ...p, place_name: name } : p))
        );
      });
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (!user) return;

    if (!navigator.geolocation) {
      setLocationError(true);
      setLoading(false);
      return;
    }

    let lastDbUpdate = 0;
    let lastLat = 0;
    let lastLng = 0;
    let firstFix = true;

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setMyLocation({ lat: latitude, lng: longitude });

        const now = Date.now();
        const movedKm = haversineDistance(lastLat, lastLng, latitude, longitude);
        const shouldPersist = firstFix || now - lastDbUpdate > 120000 || movedKm > 0.1;

        if (shouldPersist) {
          lastDbUpdate = now;
          lastLat = latitude;
          lastLng = longitude;
          updateMyLocation(latitude, longitude);
        }

        if (firstFix) {
          firstFix = false;
          fetchNearby(latitude, longitude);
        }
      },
      () => {
        setLocationError(true);
        setLoading(false);
        toast.error("Location access needed to find nearby people");
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 }
    );

    // Heartbeat: mark online every 60s
    heartbeatRef.current = setInterval(() => {
      supabase
        .from("profiles")
        .update({ is_online: true, last_online: new Date().toISOString() })
        .eq("user_id", user.id);
    }, 60000);

    return () => {
      navigator.geolocation.clearWatch(watchId);
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
    };
  }, [user, updateMyLocation, fetchNearby]);

  // Realtime: subscribe to profile online status changes
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("nearby-online-status")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "profiles" },
        (payload) => {
          const updated = payload.new as { user_id: string; is_online: boolean | null; last_online: string | null };
          setNearbyUsers((prev) =>
            prev.map((p) =>
              p.user_id === updated.user_id
                ? { ...p, is_online: updated.is_online ?? false, last_online: updated.last_online }
                : p
            )
          );
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const formatDistance = (km: number) => {
    if (km < 1) return "< 1 km";
    return `${Math.round(km)} km`;
  };

  const timeAgo = (date: string | null) => {
    if (!date) return "Unknown";
    const mins = Math.floor((Date.now() - new Date(date).getTime()) / 60000);
    if (mins < 1) return "Active now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  // Strict online/offline split — no overlap
  const filtered = nearbyUsers.filter((u) => {
    const online = isUserOnline(u.last_online, u.is_online);
    return filterOnline === "online" ? online : !online;
  });

  return (
    <div className="flex h-full flex-col px-6 pt-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="rounded-full gradient-love p-2">
            <MapPin className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-bold font-display text-foreground">Nearby</h1>
            <p className="text-sm text-muted-foreground">
              {filtered.length} {filtered.length === 1 ? "person" : "people"} {filterOnline === "online" ? "online" : "offline"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => setFilterOnline(filterOnline === "online" ? "offline" : "online")}
            className={`flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
              filterOnline === "online"
                ? "bg-green-500/15 text-green-600 border border-green-500/30"
                : "bg-muted text-muted-foreground border border-border"
            }`}
          >
            {filterOnline === "online" ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
            {filterOnline === "online" ? "Online" : "Offline"}
          </motion.button>
          {myLocation && (
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => fetchNearby(myLocation.lat, myLocation.lng)}
              className="rounded-full bg-muted p-2"
            >
              <RefreshCw className="h-4 w-4 text-muted-foreground" />
            </motion.button>
          )}
        </div>
      </div>

      {locationError ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-1 flex-col items-center justify-center text-center"
        >
          <div className="rounded-full bg-muted p-6 mb-4">
            <MapPin className="h-8 w-8 text-muted-foreground" />
          </div>
          <p className="text-foreground font-semibold">Location Required</p>
          <p className="text-sm text-muted-foreground mt-1 max-w-[240px]">
            Enable location access in your browser to discover people nearby
          </p>
        </motion.div>
      ) : loading ? (
        <div className="flex flex-1 items-center justify-center">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          >
            <RefreshCw className="h-6 w-6 text-primary" />
          </motion.div>
        </div>
      ) : filtered.length === 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-1 flex-col items-center justify-center text-center"
        >
          <div className="rounded-full bg-muted p-6 mb-4">
            <MapPin className="h-8 w-8 text-muted-foreground" />
          </div>
          <p className="text-foreground font-semibold">
            No one {filterOnline === "online" ? "online" : "offline"} nearby
          </p>
          <p className="text-sm text-muted-foreground mt-1">Try toggling the filter or check back later!</p>
        </motion.div>
      ) : (
        <div className="space-y-2 overflow-y-auto flex-1 pb-24 scrollbar-hide">
          {filtered.map((person, i) => {
            const online = isUserOnline(person.last_online, person.is_online);
            return (
              <motion.div
                key={person.user_id}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.04, 0.4) }}
                className="flex items-center gap-3 rounded-2xl bg-card border border-border p-3 shadow-sm"
              >
                <div className="relative">
                  <Avatar className="h-14 w-14">
                    <AvatarImage src={person.avatar_url || ""} />
                    <AvatarFallback className="bg-muted text-muted-foreground font-semibold text-lg">
                      {person.display_name[0]}
                    </AvatarFallback>
                  </Avatar>
                  {online && (
                    <span className="absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full bg-green-500 border-2 border-card" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">
                    {person.display_name}{person.age ? `, ${person.age}` : ""}
                  </p>
                  <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <MapPin className="h-3 w-3" />
                      {person.place_name || "Locating…"}
                    </span>
                    <span className="text-xs text-muted-foreground">·</span>
                    <span className="text-xs text-muted-foreground">{formatDistance(person.distance)}</span>
                    <span className="text-xs text-muted-foreground">·</span>
                    <span className={`text-xs ${online ? "text-green-500" : "text-muted-foreground"}`}>
                      {online ? "Online" : timeAgo(person.last_online)}
                    </span>
                  </div>
                </div>
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={() => openInGoogleMaps(person.latitude, person.longitude, person.display_name)}
                  className="rounded-full gradient-love p-2 shadow-sm"
                  aria-label="Open in Google Maps"
                >
                  <MapPin className="h-4 w-4 text-primary-foreground" />
                </motion.button>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default NearbyView;
