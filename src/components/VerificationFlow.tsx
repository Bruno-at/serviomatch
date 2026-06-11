import { useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Camera, ShieldCheck, X, Loader2, CheckCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface VerificationFlowProps {
  isVerified: boolean;
  onVerified?: () => void;
}

const VerificationFlow = ({ isVerified, onVerified }: VerificationFlowProps) => {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"intro" | "camera" | "processing" | "done">("intro");
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setStep("camera");
    } catch {
      toast.error("Camera access is required for verification");
    }
  }, []);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const captureSelfie = useCallback(async () => {
    if (!videoRef.current || !user) return;
    setStep("processing");

    const canvas = document.createElement("canvas");
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    canvas.getContext("2d")?.drawImage(videoRef.current, 0, 0);

    stopCamera();

    canvas.toBlob(async (blob) => {
      if (!blob) return;
      const filePath = `${user.id}/verification-${Date.now()}.jpg`;
      const { error: uploadErr } = await supabase.storage
        .from("avatars")
        .upload(filePath, blob, { contentType: "image/jpeg", upsert: true });

      if (uploadErr) {
        toast.error("Upload failed");
        setStep("intro");
        return;
      }

      const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(filePath);

      const { error: rpcErr } = await supabase.rpc("submit_verification" as any, {
        _selfie_url: urlData.publicUrl,
      });
      if (rpcErr) {
        toast.error("Verification failed");
        setStep("intro");
        return;
      }

      setStep("done");
      toast.success("Profile verified! ✅");
      onVerified?.();

      setTimeout(() => setOpen(false), 2000);
    }, "image/jpeg", 0.85);
  }, [user, stopCamera, onVerified]);


  const handleClose = () => {
    stopCamera();
    setOpen(false);
    setStep("intro");
  };

  if (isVerified) {
    return (
      <div className="flex items-center gap-1.5 rounded-full bg-green-500/10 px-3 py-1.5 text-xs font-semibold text-green-600">
        <ShieldCheck className="h-3.5 w-3.5" />
        Verified
      </div>
    );
  }

  return (
    <>
      <motion.button
        whileTap={{ scale: 0.95 }}
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary"
      >
        <ShieldCheck className="h-3.5 w-3.5" />
        Get Verified
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 backdrop-blur-sm p-4"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="w-full max-w-sm rounded-3xl bg-card p-6 shadow-elevated"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold font-display text-foreground">Profile Verification</h3>
                <button onClick={handleClose} className="rounded-full bg-muted p-1.5">
                  <X className="h-4 w-4 text-muted-foreground" />
                </button>
              </div>

              {step === "intro" && (
                <div className="text-center">
                  <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
                    <ShieldCheck className="h-10 w-10 text-primary" />
                  </div>
                  <p className="text-sm text-muted-foreground mb-6">
                    Take a live selfie to verify your identity. This helps build trust and shows others you're real.
                  </p>
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    onClick={startCamera}
                    className="w-full rounded-2xl gradient-love py-3 text-sm font-semibold text-primary-foreground"
                  >
                    <Camera className="inline h-4 w-4 mr-1.5" />
                    Open Camera
                  </motion.button>
                </div>
              )}

              {step === "camera" && (
                <div className="text-center">
                  <div className="relative mx-auto mb-4 w-48 h-48 rounded-full overflow-hidden ring-4 ring-primary/30">
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className="h-full w-full object-cover scale-x-[-1]"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mb-4">
                    Center your face in the circle
                  </p>
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    onClick={captureSelfie}
                    className="w-full rounded-2xl gradient-love py-3 text-sm font-semibold text-primary-foreground"
                  >
                    📸 Take Selfie
                  </motion.button>
                </div>
              )}

              {step === "processing" && (
                <div className="text-center py-8">
                  <Loader2 className="h-12 w-12 text-primary mx-auto animate-spin mb-4" />
                  <p className="text-sm text-muted-foreground">Verifying your identity...</p>
                </div>
              )}

              {step === "done" && (
                <div className="text-center py-8">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring" }}
                  >
                    <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
                  </motion.div>
                  <h4 className="text-lg font-bold text-foreground font-display">You're Verified! ✅</h4>
                  <p className="text-sm text-muted-foreground mt-1">
                    Your profile now shows a verified badge
                  </p>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default VerificationFlow;
