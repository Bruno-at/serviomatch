import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Camera, Plus, X, Loader2, ArrowRight, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface PhotoUploadOnboardingProps {
  onComplete: () => void;
}

const PhotoUploadOnboarding = ({ onComplete }: PhotoUploadOnboardingProps) => {
  const { user } = useAuth();
  const [photos, setPhotos] = useState<(string | null)[]>([null, null, null, null]);
  const [uploading, setUploading] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const fileInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const handleUpload = async (index: number, file: File) => {
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
  };

  const handleRemove = (index: number) => {
    setPhotos((prev) => {
      const next = [...prev];
      next[index] = null;
      return next;
    });
  };

  const uploadedCount = photos.filter(Boolean).length;

  const handleContinue = async () => {
    if (!user || uploadedCount === 0) return;
    setSaving(true);

    const validPhotos = photos.filter(Boolean) as string[];
    const avatarUrl = validPhotos[0] || null;

    const { error } = await supabase
      .from("profiles")
      .update({
        photos: validPhotos,
        avatar_url: avatarUrl,
      })
      .eq("user_id", user.id);

    if (error) {
      toast.error("Failed to save photos");
      setSaving(false);
      return;
    }

    toast.success("Photos saved! Welcome to Spark 💕");
    setSaving(false);
    onComplete();
  };

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-background px-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm"
      >
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full gradient-love">
            <Camera className="h-8 w-8 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold font-display text-foreground">
            Add your photos
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Upload up to 4 photos to make your profile shine ✨
          </p>
        </div>

        {/* Photo grid - 2x2 */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          {photos.map((photo, index) => (
            <motion.div
              key={index}
              whileTap={{ scale: 0.97 }}
              className="relative aspect-[3/4] rounded-2xl overflow-hidden border-2 border-dashed border-border bg-muted"
            >
              {photo ? (
                <>
                  <img
                    src={photo}
                    alt={`Photo ${index + 1}`}
                    className="h-full w-full object-cover"
                  />
                  <button
                    onClick={() => handleRemove(index)}
                    className="absolute top-2 right-2 rounded-full bg-foreground/60 p-1.5 backdrop-blur-sm"
                  >
                    <X className="h-3 w-3 text-primary-foreground" />
                  </button>
                  {index === 0 && (
                    <span className="absolute bottom-2 left-2 rounded-full gradient-love px-2 py-0.5 text-[10px] font-semibold text-primary-foreground">
                      Main
                    </span>
                  )}
                </>
              ) : (
                <button
                  onClick={() => fileInputRefs.current[index]?.click()}
                  disabled={uploading !== null}
                  className="flex h-full w-full flex-col items-center justify-center gap-2 text-muted-foreground hover:text-primary transition-colors"
                >
                  {uploading === index ? (
                    <Loader2 className="h-6 w-6 animate-spin" />
                  ) : (
                    <>
                      <div className="rounded-full bg-card p-3 shadow-sm">
                        <Plus className="h-5 w-5" />
                      </div>
                      <span className="text-xs font-medium">
                        {index === 0 ? "Main photo" : `Photo ${index + 1}`}
                      </span>
                    </>
                  )}
                </button>
              )}
              <input
                ref={(el) => { fileInputRefs.current[index] = el; }}
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleUpload(index, file);
                  e.target.value = "";
                }}
                className="hidden"
              />
            </motion.div>
          ))}
        </div>

        {/* Progress */}
        <div className="flex items-center justify-center gap-2 mb-6">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className={`h-1.5 w-8 rounded-full transition-colors ${
                photos[i] ? "bg-primary" : "bg-muted"
              }`}
            />
          ))}
          <span className="text-xs text-muted-foreground ml-2">{uploadedCount}/4</span>
        </div>

        {/* Continue button */}
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={handleContinue}
          disabled={uploadedCount === 0 || saving}
          className="flex w-full items-center justify-center gap-2 rounded-xl gradient-love py-3 text-sm font-semibold text-primary-foreground shadow-card disabled:opacity-50"
        >
          {saving ? (
            "Saving..."
          ) : (
            <>
              Continue
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </motion.button>

        {/* Skip */}
        <button
          onClick={onComplete}
          className="mt-3 w-full text-center text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          Skip for now
        </button>
      </motion.div>
    </div>
  );
};

export default PhotoUploadOnboarding;
