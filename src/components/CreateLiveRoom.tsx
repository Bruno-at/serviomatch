import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Radio, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface CreateLiveRoomProps {
  onCreate: (title: string, description: string) => void;
  onCancel: () => void;
}

const CreateLiveRoom = ({ onCreate, onCancel }: CreateLiveRoomProps) => {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [starting, setStarting] = useState(false);

  // CRITICAL: request mic/camera *synchronously* inside the click gesture so
  // the browser actually shows the permission prompt (otherwise the live
  // screen ends up blank/white because getUserMedia silently fails after
  // multiple awaits).
  const handleStart = async () => {
    if (!title.trim() || starting) return;
    setStarting(true);

    try {
      // Pre-flight permission check
      if (!navigator.mediaDevices?.getUserMedia) {
        toast.error("Your browser does not support live video");
        setStarting(false);
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      // Immediately release; LiveKit will reacquire inside the live room.
      stream.getTracks().forEach((t) => t.stop());
    } catch (err: any) {
      console.error("Live permission error:", err);
      if (err?.name === "NotAllowedError" || err?.name === "SecurityError") {
        toast.error("Camera & microphone access required to go live");
      } else if (err?.name === "NotFoundError") {
        toast.error("No camera or microphone found on this device");
      } else if (err?.name === "NotReadableError") {
        toast.error("Camera is already in use by another app");
      } else {
        toast.error("Could not access camera. Please try again.");
      }
      setStarting(false);
      return;
    }

    onCreate(title.trim(), description.trim());
  };

  return (
    <div className="flex h-full flex-col px-6 pt-4">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={onCancel} className="rounded-full p-1 hover:bg-muted">
          <ArrowLeft className="h-5 w-5 text-foreground" />
        </button>
        <h1 className="text-xl font-bold font-display text-foreground">Go Live</h1>
      </div>

      <div className="flex flex-col items-center mb-8">
        <div className="rounded-full gradient-love p-5 mb-3">
          <Radio className="h-10 w-10 text-primary-foreground" />
        </div>
        <p className="text-sm text-muted-foreground text-center max-w-[240px]">
          Start a live room and chat with people in real time
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="text-sm font-medium text-foreground mb-1 block">Room title</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="What's your live about?"
            maxLength={80}
            className="w-full rounded-xl bg-muted py-3 px-4 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
        <div>
          <label className="text-sm font-medium text-foreground mb-1 block">Description (optional)</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Tell people what to expect..."
            rows={3}
            maxLength={200}
            className="w-full rounded-xl bg-muted py-3 px-4 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary/30 resize-none"
          />
        </div>
      </div>

      <motion.button
        whileTap={{ scale: 0.97 }}
        onClick={handleStart}
        disabled={!title.trim() || starting}
        className="mt-8 w-full rounded-2xl gradient-love py-3.5 text-sm font-semibold text-primary-foreground shadow-card disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {starting ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Requesting camera…
          </>
        ) : (
          <>🔴 Start Live</>
        )}
      </motion.button>
    </div>
  );
};

export default CreateLiveRoom;
