import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Settings, Camera, BadgeCheck, MapPin, Edit3, LogOut, ChevronLeft, ChevronRight, ShieldCheck, Share2, Users, Gift, Crown, Bell } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { Tables } from "@/integrations/supabase/types";
import EditProfileView from "./EditProfileView";
import SettingsView from "./SettingsView";
import VoiceIntroPlayer from "./VoiceIntroPlayer";
import ProfileVideoPlayer from "./ProfileVideoPlayer";
import VerificationFlow from "./VerificationFlow";
import BoostSpotlight from "./BoostSpotlight";
import SocialShare from "./SocialShare";
import { PERSONALITY_QUESTIONS, type PersonalityAnswers } from "./PersonalityQuestions";

interface ProfileViewProps {
  onShowReferrals?: () => void;
  onShowVIP?: () => void;
  onShowDailyRewards?: () => void;
  onShowNotifications?: () => void;
}

const ProfileView = ({ onShowReferrals, onShowVIP, onShowDailyRewards, onShowNotifications }: ProfileViewProps) => {
  const { user, signOut } = useAuth();
  const [profile, setProfile] = useState<Tables<"profiles"> | null>(null);
  const [editing, setEditing] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [photoIndex, setPhotoIndex] = useState(0);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => setProfile(data));
  }, [user]);

  if (!profile) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading profile...</p>
      </div>
    );
  }

  if (showSettings) return <SettingsView onBack={() => setShowSettings(false)} />;

  if (editing) {
    return (
      <EditProfileView
        profile={profile}
        onSave={(updated) => { setProfile(updated); setEditing(false); }}
        onCancel={() => setEditing(false)}
      />
    );
  }

  const photos = ((profile as any).photos || []) as string[];
  const allImages = photos.length > 0 ? photos : profile.avatar_url ? [profile.avatar_url] : [];

  return (
    <div className="flex h-full flex-col items-center px-6 pt-4">
      <div className="flex w-full justify-between items-center mb-4">
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

      {/* Boost & Spotlight */}
      <div className="w-full mb-4">
        <BoostSpotlight compact />
      </div>

      {/* Quick Actions */}
      <div className="w-full grid grid-cols-4 gap-2 mb-4">
        <button onClick={onShowReferrals} className="flex flex-col items-center gap-1 rounded-xl bg-card p-3 shadow-sm">
          <Users className="h-5 w-5 text-primary" />
          <span className="text-[9px] font-medium text-muted-foreground">Invite</span>
        </button>
        <button onClick={onShowVIP} className="flex flex-col items-center gap-1 rounded-xl bg-card p-3 shadow-sm">
          <Crown className="h-5 w-5 text-yellow-500" />
          <span className="text-[9px] font-medium text-muted-foreground">VIP</span>
        </button>
        <button onClick={onShowDailyRewards} className="flex flex-col items-center gap-1 rounded-xl bg-card p-3 shadow-sm">
          <Gift className="h-5 w-5 text-accent" />
          <span className="text-[9px] font-medium text-muted-foreground">Rewards</span>
        </button>
        <button onClick={onShowNotifications} className="flex flex-col items-center gap-1 rounded-xl bg-card p-3 shadow-sm">
          <Bell className="h-5 w-5 text-orange-500" />
          <span className="text-[9px] font-medium text-muted-foreground">Alerts</span>
        </button>
      </div>

      {/* Photo carousel */}
      <div className="relative mb-4 w-full max-w-[200px]">
        {allImages.length > 0 ? (
          <div className="relative aspect-[3/4] rounded-2xl overflow-hidden ring-4 ring-primary/20">
            <img src={allImages[photoIndex] || allImages[0]} alt="Your profile" className="h-full w-full object-cover" />
            {allImages.length > 1 && (
              <>
                <button
                  onClick={() => setPhotoIndex((i) => (i - 1 + allImages.length) % allImages.length)}
                  className="absolute left-1 top-1/2 -translate-y-1/2 rounded-full bg-foreground/40 p-1 backdrop-blur-sm"
                >
                  <ChevronLeft className="h-4 w-4 text-primary-foreground" />
                </button>
                <button
                  onClick={() => setPhotoIndex((i) => (i + 1) % allImages.length)}
                  className="absolute right-1 top-1/2 -translate-y-1/2 rounded-full bg-foreground/40 p-1 backdrop-blur-sm"
                >
                  <ChevronRight className="h-4 w-4 text-primary-foreground" />
                </button>
                <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1">
                  {allImages.map((_, i) => (
                    <div
                      key={i}
                      className={`h-1.5 w-1.5 rounded-full transition-colors ${
                        i === photoIndex ? "bg-primary-foreground" : "bg-primary-foreground/40"
                      }`}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="flex aspect-[3/4] items-center justify-center rounded-2xl gradient-love ring-4 ring-primary/20 text-4xl font-bold text-primary-foreground">
            {profile.display_name.charAt(0).toUpperCase()}
          </div>
        )}
        <button onClick={() => setEditing(true)} className="absolute bottom-2 right-2 rounded-full gradient-love p-2 shadow-card">
          <Camera className="h-4 w-4 text-primary-foreground" />
        </button>
      </div>

      <h2 className="text-xl font-bold font-display text-foreground flex items-center gap-1">
        {profile.display_name}{profile.age ? `, ${profile.age}` : ""}
        {(profile as any).is_verified && <BadgeCheck className="h-5 w-5 text-primary" />}
      </h2>
      {profile.location && (
        <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
          <MapPin className="h-3 w-3" /> {profile.location}
        </p>
      )}

      {/* Verification */}
      <div className="mt-3">
        <VerificationFlow
          isVerified={!!(profile as any).is_verified}
          onVerified={() => setProfile((p) => p ? { ...p, is_verified: true } as any : p)}
        />
      </div>

      {(profile as any).voice_intro_url && (
        <div className="mt-4 w-full">
          <VoiceIntroPlayer voiceUrl={(profile as any).voice_intro_url} />
        </div>
      )}

      {(profile as any).video_url && (
        <div className="mt-4 w-full max-w-[200px]">
          <h3 className="text-sm font-semibold text-foreground mb-2">Profile Video</h3>
          <ProfileVideoPlayer videoUrl={(profile as any).video_url} compact />
        </div>
      )}

      {(() => {
        const pa = ((profile as any).personality_answers || {}) as PersonalityAnswers;
        const answered = PERSONALITY_QUESTIONS.filter((q) => pa[q.id]);
        if (answered.length === 0) return null;
        return (
          <div className="mt-4 w-full">
            <h3 className="text-sm font-semibold text-foreground mb-2">Personality</h3>
            <div className="flex flex-wrap gap-2">
              {answered.map((q) => (
                <span key={q.id} className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                  {pa[q.id]}
                </span>
              ))}
            </div>
          </div>
        );
      })()}

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
