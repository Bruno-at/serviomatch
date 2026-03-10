import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, Square, Play, Pause, RotateCcw, Trash2, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface VoiceIntroRecorderProps {
  voiceUrl: string | null;
  onUpdate: (url: string | null) => void;
}

const MAX_DURATION = 20;
const MIN_DURATION = 10;

const VoiceIntroRecorder = ({ voiceUrl, onUpdate }: VoiceIntroRecorderProps) => {
  const { user } = useAuth();
  const [recording, setRecording] = useState(false);
  const [recorded, setRecorded] = useState<Blob | null>(null);
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [playProgress, setPlayProgress] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (audioRef.current) { audioRef.current.pause(); audioRef.current.src = ""; }
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
      if (recordedUrl) URL.revokeObjectURL(recordedUrl);
    };
  }, [recordedUrl]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];
      const mr = new MediaRecorder(stream, { mimeType: "audio/webm" });
      mediaRecorderRef.current = mr;

      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        setRecorded(blob);
        const url = URL.createObjectURL(blob);
        setRecordedUrl(url);
      };

      mr.start();
      setRecording(true);
      setElapsed(0);

      timerRef.current = window.setInterval(() => {
        setElapsed(prev => {
          if (prev >= MAX_DURATION - 1) {
            mr.stop();
            setRecording(false);
            if (timerRef.current) clearInterval(timerRef.current);
            return MAX_DURATION;
          }
          return prev + 1;
        });
      }, 1000);
    } catch {
      toast.error("Microphone access denied");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }
    setRecording(false);
    if (timerRef.current) clearInterval(timerRef.current);
  };

  const playAudio = (url: string) => {
    if (audioRef.current) { audioRef.current.pause(); audioRef.current.src = ""; }
    const audio = new Audio(url);
    audioRef.current = audio;
    audio.onended = () => { setPlaying(false); setPlayProgress(0); };
    audio.ontimeupdate = () => {
      if (audio.duration) setPlayProgress((audio.currentTime / audio.duration) * 100);
    };
    audio.play();
    setPlaying(true);
  };

  const pauseAudio = () => {
    audioRef.current?.pause();
    setPlaying(false);
  };

  const handlePlay = () => {
    const url = recordedUrl || voiceUrl;
    if (!url) return;
    playing ? pauseAudio() : playAudio(url);
  };

  const discardRecording = () => {
    setRecorded(null);
    if (recordedUrl) URL.revokeObjectURL(recordedUrl);
    setRecordedUrl(null);
    setElapsed(0);
    setPlayProgress(0);
    pauseAudio();
  };

  const uploadVoice = async () => {
    if (!user || !recorded) return;
    if (elapsed < MIN_DURATION) {
      toast.error(`Recording must be at least ${MIN_DURATION} seconds`);
      return;
    }

    setUploading(true);
    const path = `${user.id}/voice-intro.webm`;

    const { error: uploadErr } = await supabase.storage
      .from("voice-intros")
      .upload(path, recorded, { upsert: true, contentType: "audio/webm" });

    if (uploadErr) {
      toast.error("Upload failed");
      setUploading(false);
      return;
    }

    const { data: urlData } = supabase.storage.from("voice-intros").getPublicUrl(path);
    const finalUrl = `${urlData.publicUrl}?t=${Date.now()}`;

    const { error: dbErr } = await supabase
      .from("profiles")
      .update({ voice_intro_url: finalUrl } as any)
      .eq("user_id", user.id);

    if (dbErr) {
      toast.error("Failed to save");
    } else {
      toast.success("Voice intro saved! 🎙️");
      onUpdate(finalUrl);
      discardRecording();
    }
    setUploading(false);
  };

  const deleteVoice = async () => {
    if (!user) return;
    setUploading(true);
    const path = `${user.id}/voice-intro.webm`;

    await supabase.storage.from("voice-intros").remove([path]);
    await supabase
      .from("profiles")
      .update({ voice_intro_url: null } as any)
      .eq("user_id", user.id);

    onUpdate(null);
    toast.success("Voice intro removed");
    setUploading(false);
  };

  const hasAudio = !!recordedUrl || !!voiceUrl;
  const currentUrl = recordedUrl || voiceUrl;

  return (
    <div className="space-y-3">
      <label className="text-sm font-medium text-foreground block">
        Voice Introduction (10–20s)
      </label>

      {/* Waveform / Progress bar */}
      {hasAudio && (
        <div className="relative h-2 w-full rounded-full bg-muted overflow-hidden">
          <motion.div
            className="h-full gradient-love rounded-full"
            style={{ width: `${playing ? playProgress : 100}%` }}
            transition={{ duration: 0.1 }}
          />
        </div>
      )}

      {/* Recording timer */}
      {recording && (
        <div className="flex items-center gap-2">
          <motion.div
            className="h-3 w-3 rounded-full bg-destructive"
            animate={{ opacity: [1, 0.3, 1] }}
            transition={{ repeat: Infinity, duration: 1 }}
          />
          <span className="text-xs font-mono text-foreground">
            {elapsed}s / {MAX_DURATION}s
          </span>
          {elapsed < MIN_DURATION && (
            <span className="text-[10px] text-muted-foreground">
              (min {MIN_DURATION}s)
            </span>
          )}
        </div>
      )}

      {/* Controls */}
      <div className="flex items-center gap-2 flex-wrap">
        {!recording && !recordedUrl && (
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={startRecording}
            disabled={uploading}
            className="flex items-center gap-2 rounded-xl gradient-love px-4 py-2.5 text-xs font-semibold text-primary-foreground shadow-card disabled:opacity-50"
          >
            <Mic className="h-4 w-4" />
            {voiceUrl ? "Re-record" : "Record"}
          </motion.button>
        )}

        {recording && (
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={stopRecording}
            className="flex items-center gap-2 rounded-xl bg-destructive px-4 py-2.5 text-xs font-semibold text-destructive-foreground shadow-card"
          >
            <Square className="h-4 w-4" />
            Stop
          </motion.button>
        )}

        {hasAudio && !recording && (
          <>
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={handlePlay}
              className="flex items-center gap-2 rounded-xl bg-muted px-4 py-2.5 text-xs font-medium text-foreground"
            >
              {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              {playing ? "Pause" : "Play"}
            </motion.button>

            {recordedUrl && (
              <>
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={discardRecording}
                  className="flex items-center gap-1 rounded-xl bg-muted px-3 py-2.5 text-xs font-medium text-muted-foreground"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={uploadVoice}
                  disabled={uploading || elapsed < MIN_DURATION}
                  className="flex items-center gap-2 rounded-xl gradient-love px-4 py-2.5 text-xs font-semibold text-primary-foreground shadow-card disabled:opacity-50"
                >
                  {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
                </motion.button>
              </>
            )}

            {voiceUrl && !recordedUrl && (
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={deleteVoice}
                disabled={uploading}
                className="flex items-center gap-1 rounded-xl bg-destructive/10 px-3 py-2.5 text-xs font-medium text-destructive disabled:opacity-50"
              >
                {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
              </motion.button>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default VoiceIntroRecorder;
