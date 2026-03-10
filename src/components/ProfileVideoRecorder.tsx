import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { Video, Play, Pause, Trash2, Upload, Loader2, Square } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface ProfileVideoRecorderProps {
  videoUrl: string | null;
  onUpdate: (url: string | null) => void;
}

const MAX_DURATION = 10;
const MIN_DURATION = 5;
const MAX_SIZE_MB = 20;

const ProfileVideoRecorder = ({ videoUrl, onUpdate }: ProfileVideoRecorderProps) => {
  const { user } = useAuth();
  const [recording, setRecording] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(videoUrl);
  const [playing, setPlaying] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [timer, setTimer] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const liveVideoRef = useRef<HTMLVideoElement | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 720 }, height: { ideal: 1280 } },
        audio: true,
      });
      streamRef.current = stream;

      if (liveVideoRef.current) {
        liveVideoRef.current.srcObject = stream;
        liveVideoRef.current.play();
      }

      const recorder = new MediaRecorder(stream, { mimeType: "video/webm" });
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "video/webm" });
        setRecordedBlob(blob);
        const url = URL.createObjectURL(blob);
        setPreviewUrl(url);
        stream.getTracks().forEach((t) => t.stop());
      };

      recorder.start();
      setRecording(true);
      setTimer(0);

      timerRef.current = setInterval(() => {
        setTimer((prev) => {
          if (prev + 1 >= MAX_DURATION) {
            stopRecording();
            return MAX_DURATION;
          }
          return prev + 1;
        });
      }, 1000);
    } catch {
      toast.error("Camera access denied");
    }
  };

  const stopRecording = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }
    setRecording(false);
  };

  const handleFileUpload = (file: File) => {
    if (!file.type.startsWith("video/")) {
      toast.error("Please select a video file");
      return;
    }
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      toast.error(`Video must be under ${MAX_SIZE_MB}MB`);
      return;
    }

    const video = document.createElement("video");
    video.preload = "metadata";
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(video.src);
      if (video.duration > MAX_DURATION + 1) {
        toast.error(`Video must be ${MAX_DURATION} seconds or less`);
        return;
      }
      setRecordedBlob(file);
      setPreviewUrl(URL.createObjectURL(file));
    };
    video.src = URL.createObjectURL(file);
  };

  const uploadVideo = async () => {
    if (!user || !recordedBlob) return;
    if (timer < MIN_DURATION && !recordedBlob.type.includes("mp4") && !recordedBlob.type.includes("quicktime")) {
      // Only enforce min for recorded videos, not uploads
    }

    setUploading(true);
    const ext = recordedBlob.type.includes("mp4") ? "mp4" : "webm";
    const path = `${user.id}/profile-video.${ext}`;

    const { error } = await supabase.storage
      .from("profile-videos")
      .upload(path, recordedBlob, { upsert: true });

    if (error) {
      toast.error("Upload failed");
      setUploading(false);
      return;
    }

    const { data: urlData } = supabase.storage.from("profile-videos").getPublicUrl(path);
    const url = `${urlData.publicUrl}?t=${Date.now()}`;

    const { error: updateError } = await supabase
      .from("profiles")
      .update({ video_url: url } as any)
      .eq("user_id", user.id);

    if (updateError) {
      toast.error("Failed to save video");
    } else {
      toast.success("Profile video saved! 🎬");
      onUpdate(url);
      setPreviewUrl(url);
      setRecordedBlob(null);
    }
    setUploading(false);
  };

  const deleteVideo = async () => {
    if (!user) return;
    setUploading(true);

    await supabase.storage.from("profile-videos").remove([`${user.id}/profile-video.webm`, `${user.id}/profile-video.mp4`]);
    await supabase.from("profiles").update({ video_url: null } as any).eq("user_id", user.id);

    setPreviewUrl(null);
    setRecordedBlob(null);
    onUpdate(null);
    toast.success("Video removed");
    setUploading(false);
  };

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (playing) {
      videoRef.current.pause();
    } else {
      videoRef.current.play();
    }
    setPlaying(!playing);
  };

  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <div>
      <label className="text-sm font-medium text-foreground mb-2 block">
        Profile Video (5–10 sec)
      </label>

      {recording && (
        <div className="relative aspect-[9/16] max-h-48 rounded-xl overflow-hidden bg-foreground mb-2">
          <video ref={liveVideoRef} muted playsInline className="h-full w-full object-cover" />
          <div className="absolute top-2 left-2 flex items-center gap-1.5 rounded-full bg-destructive px-2 py-0.5">
            <div className="h-2 w-2 rounded-full bg-primary-foreground animate-pulse" />
            <span className="text-[10px] font-bold text-primary-foreground">{timer}s / {MAX_DURATION}s</span>
          </div>
          <button
            onClick={stopRecording}
            className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-destructive p-3"
          >
            <Square className="h-5 w-5 text-primary-foreground fill-primary-foreground" />
          </button>
        </div>
      )}

      {!recording && previewUrl && (
        <div className="relative aspect-[9/16] max-h-48 rounded-xl overflow-hidden bg-foreground mb-2">
          <video
            ref={videoRef}
            src={previewUrl}
            playsInline
            onEnded={() => setPlaying(false)}
            className="h-full w-full object-cover"
          />
          <button
            onClick={togglePlay}
            className="absolute inset-0 flex items-center justify-center bg-foreground/20"
          >
            {playing ? (
              <Pause className="h-8 w-8 text-primary-foreground drop-shadow-lg" />
            ) : (
              <Play className="h-8 w-8 text-primary-foreground drop-shadow-lg" />
            )}
          </button>
        </div>
      )}

      <div className="flex gap-2">
        {!recording && !recordedBlob && (
          <>
            <button
              onClick={startRecording}
              className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-muted py-2.5 text-xs font-medium text-foreground hover:bg-primary/10 transition-colors"
            >
              <Video className="h-3.5 w-3.5 text-primary" />
              Record
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-muted py-2.5 text-xs font-medium text-foreground hover:bg-primary/10 transition-colors"
            >
              <Upload className="h-3.5 w-3.5 text-primary" />
              Upload
            </button>
          </>
        )}

        {recordedBlob && !uploading && (
          <>
            <button
              onClick={uploadVideo}
              className="flex-1 flex items-center justify-center gap-1.5 rounded-xl gradient-love py-2.5 text-xs font-semibold text-primary-foreground"
            >
              <Upload className="h-3.5 w-3.5" />
              Save Video
            </button>
            <button
              onClick={() => { setRecordedBlob(null); setPreviewUrl(videoUrl); }}
              className="rounded-xl bg-muted px-3 py-2.5"
            >
              <Trash2 className="h-3.5 w-3.5 text-destructive" />
            </button>
          </>
        )}

        {previewUrl && !recordedBlob && !recording && (
          <button
            onClick={deleteVideo}
            disabled={uploading}
            className="flex items-center justify-center gap-1.5 rounded-xl bg-destructive/10 px-3 py-2.5 text-xs font-medium text-destructive hover:bg-destructive/20 transition-colors"
          >
            {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
            Remove
          </button>
        )}

        {uploading && (
          <div className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-muted py-2.5 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving...
          </div>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="video/*"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFileUpload(file);
          e.target.value = "";
        }}
        className="hidden"
      />
    </div>
  );
};

export default ProfileVideoRecorder;
