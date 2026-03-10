import { useState, useRef } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Camera, X, Plus, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";
import VoiceIntroRecorder from "./VoiceIntroRecorder";

const INTEREST_SUGGESTIONS = [
  "Travel", "Photography", "Yoga", "Coffee", "Hiking", "Cooking",
  "Reading", "Music", "Art", "Dancing", "Film", "Fitness",
  "Tech", "Dogs", "Cats", "Gaming", "Fashion", "Nature",
];

interface EditProfileViewProps {
  profile: Tables<"profiles">;
  onSave: (updated: Tables<"profiles">) => void;
  onCancel: () => void;
}

const EditProfileView = ({ profile, onSave, onCancel }: EditProfileViewProps) => {
  const { user } = useAuth();
  const [displayName, setDisplayName] = useState(profile.display_name);
  const [bio, setBio] = useState(profile.bio || "");
  const [age, setAge] = useState(profile.age?.toString() || "");
  const [location, setLocation] = useState(profile.location || "");
  const [interests, setInterests] = useState<string[]>(profile.interests || []);
  const [photos, setPhotos] = useState<(string | null)[]>(() => {
    const existing = (profile as any).photos || [];
    const padded = [...existing];
    while (padded.length < 4) padded.push(null);
    return padded.slice(0, 4);
  });
  const [uploading, setUploading] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [customInterest, setCustomInterest] = useState("");
  const photoInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const handlePhotoUpload = async (index: number, file: File) => {
    if (!user) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be under 5MB");
      return;
    }

    setUploading(index);
    const ext = file.name.split(".").pop();
    const path = `${user.id}/photo-${index}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(path, file, { upsert: true });

    if (uploadError) {
      toast.error("Upload failed");
      setUploading(null);
      return;
    }

    const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);
    const url = `${urlData.publicUrl}?t=${Date.now()}`;
    setPhotos((prev) => {
      const next = [...prev];
      next[index] = url;
      return next;
    });
    setUploading(null);
    toast.success("Photo uploaded!");
  };

  const handleRemovePhoto = (index: number) => {
    setPhotos((prev) => {
      const next = [...prev];
      next[index] = null;
      return next;
    });
  };

  const toggleInterest = (interest: string) => {
    setInterests((prev) =>
      prev.includes(interest) ? prev.filter((i) => i !== interest) : [...prev, interest]
    );
  };

  const addCustomInterest = () => {
    const trimmed = customInterest.trim();
    if (trimmed && !interests.includes(trimmed) && interests.length < 12) {
      setInterests((prev) => [...prev, trimmed]);
      setCustomInterest("");
    }
  };

  const handleSave = async () => {
    if (!user || !displayName.trim()) {
      toast.error("Display name is required");
      return;
    }

    setSaving(true);
    const ageNum = age ? parseInt(age, 10) : null;
    if (age && (isNaN(ageNum!) || ageNum! < 18 || ageNum! > 120)) {
      toast.error("Please enter a valid age (18-120)");
      setSaving(false);
      return;
    }

    const validPhotos = photos.filter(Boolean) as string[];

    const updates = {
      display_name: displayName.trim(),
      bio: bio.trim(),
      age: ageNum,
      location: location.trim(),
      interests,
      avatar_url: validPhotos[0] || null,
      photos: validPhotos,
    };

    const { data, error } = await supabase
      .from("profiles")
      .update(updates)
      .eq("user_id", user.id)
      .select()
      .single();

    if (error) {
      toast.error("Failed to save profile");
    } else {
      toast.success("Profile updated! ✨");
      onSave(data);
    }
    setSaving(false);
  };

  return (
    <div className="flex h-full flex-col px-6 pt-4 overflow-y-auto pb-24">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={onCancel} className="rounded-full p-1 hover:bg-muted">
          <ArrowLeft className="h-5 w-5 text-foreground" />
        </button>
        <h1 className="text-xl font-bold font-display text-foreground">Edit Profile</h1>
      </div>

      {/* Photo grid - 2x2 */}
      <div className="mb-6">
        <label className="text-sm font-medium text-foreground mb-2 block">Photos (up to 4)</label>
        <div className="grid grid-cols-4 gap-2">
          {photos.map((photo, index) => (
            <div
              key={index}
              className="relative aspect-[3/4] rounded-xl overflow-hidden border-2 border-dashed border-border bg-muted"
            >
              {photo ? (
                <>
                  <img src={photo} alt={`Photo ${index + 1}`} className="h-full w-full object-cover" />
                  <button
                    onClick={() => handleRemovePhoto(index)}
                    className="absolute top-1 right-1 rounded-full bg-foreground/60 p-1 backdrop-blur-sm"
                  >
                    <X className="h-2.5 w-2.5 text-primary-foreground" />
                  </button>
                  {index === 0 && (
                    <span className="absolute bottom-1 left-1 rounded-full gradient-love px-1.5 py-0.5 text-[8px] font-semibold text-primary-foreground">
                      Main
                    </span>
                  )}
                </>
              ) : (
                <button
                  onClick={() => photoInputRefs.current[index]?.click()}
                  disabled={uploading !== null}
                  className="flex h-full w-full flex-col items-center justify-center text-muted-foreground hover:text-primary transition-colors"
                >
                  {uploading === index ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="h-4 w-4" />
                  )}
                </button>
              )}
              <input
                ref={(el) => { photoInputRefs.current[index] = el; }}
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handlePhotoUpload(index, file);
                  e.target.value = "";
                }}
                className="hidden"
              />
            </div>
          ))}
        </div>
      </div>

      {/* Form */}
      <div className="space-y-4">
        <div>
          <label className="text-sm font-medium text-foreground mb-1 block">Display name</label>
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            maxLength={50}
            className="w-full rounded-xl bg-muted py-3 px-4 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>

        <div>
          <label className="text-sm font-medium text-foreground mb-1 block">Age</label>
          <input
            type="number"
            value={age}
            onChange={(e) => setAge(e.target.value)}
            placeholder="Your age"
            min={18}
            max={120}
            className="w-full rounded-xl bg-muted py-3 px-4 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>

        <div>
          <label className="text-sm font-medium text-foreground mb-1 block">Location</label>
          <input
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="e.g. New York City"
            maxLength={100}
            className="w-full rounded-xl bg-muted py-3 px-4 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>

        <div>
          <label className="text-sm font-medium text-foreground mb-1 block">Bio</label>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="Tell people about yourself..."
            rows={3}
            maxLength={300}
            className="w-full rounded-xl bg-muted py-3 px-4 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary/30 resize-none"
          />
          <p className="text-[10px] text-muted-foreground mt-1 text-right">{bio.length}/300</p>
        </div>

        {/* Interests */}
        <div>
          <label className="text-sm font-medium text-foreground mb-2 block">
            Interests ({interests.length}/12)
          </label>

          {interests.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {interests.map((interest) => (
                <button
                  key={interest}
                  onClick={() => toggleInterest(interest)}
                  className="flex items-center gap-1 rounded-full gradient-love px-3 py-1 text-xs font-medium text-primary-foreground"
                >
                  {interest}
                  <X className="h-3 w-3" />
                </button>
              ))}
            </div>
          )}

          <div className="flex flex-wrap gap-2 mb-3">
            {INTEREST_SUGGESTIONS.filter((s) => !interests.includes(s)).map((s) => (
              <button
                key={s}
                onClick={() => interests.length < 12 && toggleInterest(s)}
                disabled={interests.length >= 12}
                className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground hover:bg-primary/10 hover:text-primary disabled:opacity-40"
              >
                {s}
              </button>
            ))}
          </div>

          <div className="flex gap-2">
            <input
              value={customInterest}
              onChange={(e) => setCustomInterest(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addCustomInterest())}
              placeholder="Add custom interest..."
              maxLength={30}
              className="flex-1 rounded-xl bg-muted py-2 px-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary/30"
            />
            <button
              onClick={addCustomInterest}
              disabled={!customInterest.trim() || interests.length >= 12}
              className="rounded-xl bg-muted px-3 py-2 disabled:opacity-40"
            >
              <Plus className="h-4 w-4 text-primary" />
            </button>
          </div>
        </div>
      </div>

        {/* Voice Intro */}
        <VoiceIntroRecorder
          voiceUrl={(profile as any).voice_intro_url || null}
          onUpdate={(url) => {
            // Profile will be refreshed on save
          }}
        />
      </div>

      {/* Save button */}
      <motion.button
        whileTap={{ scale: 0.97 }}
        onClick={handleSave}
        disabled={saving || !displayName.trim()}
        className="mt-8 w-full rounded-2xl gradient-love py-3.5 text-sm font-semibold text-primary-foreground shadow-card disabled:opacity-50"
      >
        {saving ? "Saving..." : "Save Profile"}
      </motion.button>
    </div>
  );
};

export default EditProfileView;
