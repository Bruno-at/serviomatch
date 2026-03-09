import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Settings, Camera, BadgeCheck, MapPin, Edit3, LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { Tables } from "@/integrations/supabase/types";
import EditProfileView from "./EditProfileView";
import SettingsView from "./SettingsView";

const ProfileView = () => {
  const { user, signOut } = useAuth();
  const [profile, setProfile] = useState<Tables<"profiles"> | null>(null);
  const [editing, setEditing] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("*")
      .eq("user_id", user.id)
      .single()
      .then(({ data }) => setProfile(data));
  }, [user]);

  if (!profile) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading profile...</p>
      </div>
    );
  }

  if (showSettings) {
    return <SettingsView onBack={() => setShowSettings(false)} />;
  }

  if (editing) {
    return (
      <EditProfileView
        profile={profile}
        onSave={(updated) => { setProfile(updated); setEditing(false); }}
        onCancel={() => setEditing(false)}
      />
    );
  }

  return (
    <div className="flex h-full flex-col items-center px-6 pt-4">
      <div className="flex w-full justify-between items-center mb-6">
        <h1 className="text-2xl font-bold font-display text-foreground">Profile</h1>
        <div className="flex gap-2">
          <button onClick={signOut} className="rounded-full bg-muted p-2">
            <LogOut className="h-5 w-5 text-muted-foreground" />
          </button>
          <button onClick={() => setShowSettings(true)} className="rounded-full bg-muted p-2">
            <Settings className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>
      </div>

      <div className="relative mb-4">
        {profile.avatar_url ? (
          <img src={profile.avatar_url} alt="Your profile" className="h-28 w-28 rounded-full object-cover ring-4 ring-primary/20" />
        ) : (
          <div className="flex h-28 w-28 items-center justify-center rounded-full gradient-love ring-4 ring-primary/20 text-3xl font-bold text-primary-foreground">
            {profile.display_name.charAt(0).toUpperCase()}
          </div>
        )}
        <button onClick={() => setEditing(true)} className="absolute bottom-0 right-0 rounded-full gradient-love p-2 shadow-card">
          <Camera className="h-4 w-4 text-primary-foreground" />
        </button>
      </div>

      <h2 className="text-xl font-bold font-display text-foreground flex items-center gap-1">
        {profile.display_name}{profile.age ? `, ${profile.age}` : ""}
        <BadgeCheck className="h-5 w-5 text-primary" />
      </h2>
      {profile.location && (
        <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
          <MapPin className="h-3 w-3" /> {profile.location}
        </p>
      )}

      <div className="mt-6 w-full rounded-2xl bg-card p-4 shadow-card">
        <div className="flex justify-between items-center mb-2">
          <h3 className="text-sm font-semibold text-foreground">About me</h3>
          <button onClick={() => setEditing(true)}>
            <Edit3 className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>
        <p className="text-sm text-muted-foreground">
          {profile.bio || "No bio yet. Tell people about yourself!"}
        </p>
      </div>

      {(profile.interests?.length ?? 0) > 0 && (
        <div className="mt-4 w-full">
          <h3 className="text-sm font-semibold text-foreground mb-2">Interests</h3>
          <div className="flex flex-wrap gap-2">
            {profile.interests!.map((interest) => (
              <span key={interest} className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                {interest}
              </span>
            ))}
          </div>
        </div>
      )}

      <motion.button
        whileTap={{ scale: 0.97 }}
        onClick={() => setEditing(true)}
        className="mt-6 w-full rounded-2xl gradient-love py-3.5 text-sm font-semibold text-primary-foreground shadow-card mb-24"
      >
        Edit Profile
      </motion.button>
    </div>
  );
};

export default ProfileView;
