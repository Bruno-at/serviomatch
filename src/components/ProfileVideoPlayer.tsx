import { useState, useRef } from "react";
import { Play, Pause, Volume2, VolumeX } from "lucide-react";
import { motion } from "framer-motion";

interface ProfileVideoPlayerProps {
  videoUrl: string;
  compact?: boolean;
}

const ProfileVideoPlayer = ({ videoUrl, compact = false }: ProfileVideoPlayerProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true);
  const [progress, setProgress] = useState(0);

  const togglePlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!videoRef.current) return;
    if (playing) {
      videoRef.current.pause();
    } else {
      videoRef.current.play();
    }
    setPlaying(!playing);
  };

  const toggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!videoRef.current) return;
    videoRef.current.muted = !muted;
    setMuted(!muted);
  };

  return (
    <div className={`relative rounded-xl overflow-hidden bg-foreground/10 ${compact ? "aspect-[9/16] max-h-48" : "aspect-[9/16] w-full"}`}>
      <video
        ref={videoRef}
        src={videoUrl}
        muted={muted}
        playsInline
        loop
        onTimeUpdate={() => {
          if (videoRef.current) {
            setProgress((videoRef.current.currentTime / videoRef.current.duration) * 100);
          }
        }}
        onEnded={() => setPlaying(false)}
        className="h-full w-full object-cover"
      />

      {/* Play/Pause overlay */}
      <motion.button
        whileTap={{ scale: 0.9 }}
        onClick={togglePlay}
        className="absolute inset-0 flex items-center justify-center"
      >
        {!playing && (
          <div className="rounded-full bg-foreground/40 backdrop-blur-sm p-3">
            <Play className="h-6 w-6 text-primary-foreground fill-primary-foreground" />
          </div>
        )}
      </motion.button>

      {/* Controls bar */}
      {playing && (
        <div className="absolute bottom-0 left-0 right-0 flex items-center gap-2 p-2 bg-gradient-to-t from-foreground/60 to-transparent">
          <button onClick={togglePlay} className="text-primary-foreground">
            <Pause className="h-4 w-4" />
          </button>
          <div className="flex-1 h-1 rounded-full bg-primary-foreground/30 overflow-hidden">
            <div
              className="h-full bg-primary-foreground rounded-full transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
          <button onClick={toggleMute} className="text-primary-foreground">
            {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </button>
        </div>
      )}
    </div>
  );
};

export default ProfileVideoPlayer;
