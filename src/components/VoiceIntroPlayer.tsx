import { useState, useRef } from "react";
import { motion } from "framer-motion";
import { Play, Pause, Mic } from "lucide-react";

interface VoiceIntroPlayerProps {
  voiceUrl: string;
  size?: "sm" | "md";
}

const VoiceIntroPlayer = ({ voiceUrl, size = "md" }: VoiceIntroPlayerProps) => {
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const toggle = () => {
    if (playing) {
      audioRef.current?.pause();
      setPlaying(false);
      return;
    }

    if (audioRef.current) { audioRef.current.pause(); audioRef.current.src = ""; }
    const audio = new Audio(voiceUrl);
    audioRef.current = audio;
    audio.onended = () => { setPlaying(false); setProgress(0); };
    audio.ontimeupdate = () => {
      if (audio.duration) setProgress((audio.currentTime / audio.duration) * 100);
    };
    audio.play().catch(() => setPlaying(false));
    setPlaying(true);
  };

  if (size === "sm") {
    return (
      <motion.button
        whileTap={{ scale: 0.85 }}
        onClick={(e) => { e.stopPropagation(); toggle(); }}
        className="relative flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-[10px] font-medium text-primary"
      >
        {playing ? <Pause className="h-3 w-3" /> : <Mic className="h-3 w-3" />}
        <span>{playing ? "Playing..." : "Voice intro"}</span>
        {playing && (
          <motion.div
            className="absolute bottom-0 left-0 h-0.5 gradient-love rounded-full"
            style={{ width: `${progress}%` }}
          />
        )}
      </motion.button>
    );
  }

  return (
    <motion.button
      whileTap={{ scale: 0.9 }}
      onClick={toggle}
      className="flex items-center gap-2 rounded-xl bg-primary/10 px-4 py-2.5 text-xs font-medium text-primary w-full"
    >
      <div className="relative flex items-center justify-center h-8 w-8 rounded-full gradient-love">
        {playing ? (
          <Pause className="h-4 w-4 text-primary-foreground" />
        ) : (
          <Play className="h-4 w-4 text-primary-foreground ml-0.5" />
        )}
      </div>
      <div className="flex-1 text-left">
        <p className="text-xs font-semibold text-foreground">Voice Introduction</p>
        <p className="text-[10px] text-muted-foreground">{playing ? "Playing..." : "Tap to listen"}</p>
      </div>
      {playing && (
        <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
          <motion.div className="h-full gradient-love rounded-full" style={{ width: `${progress}%` }} />
        </div>
      )}
    </motion.button>
  );
};

export default VoiceIntroPlayer;
