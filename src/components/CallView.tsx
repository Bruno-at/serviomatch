import { useState, useEffect, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Phone, PhoneOff, Mic, MicOff, Video, VideoOff,
  SwitchCamera, ArrowLeft
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";

interface CallViewProps {
  matchId: string;
  otherUserProfile: Tables<"profiles">;
  mode: "audio" | "video";
  onEnd: () => void;
}

type CallState = "connecting" | "ringing" | "active" | "ended";

const CallView = ({ matchId, otherUserProfile, mode, onEnd }: CallViewProps) => {
  const { user, session } = useAuth();
  const [callState, setCallState] = useState<CallState>("connecting");
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(mode === "audio");
  const [isFrontCamera, setIsFrontCamera] = useState(true);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Get media stream
  const startMedia = useCallback(async () => {
    try {
      const constraints: MediaStreamConstraints = {
        audio: true,
        video: mode === "video" ? { facingMode: isFrontCamera ? "user" : "environment" } : false,
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      localStreamRef.current = stream;

      if (localVideoRef.current && mode === "video") {
        localVideoRef.current.srcObject = stream;
      }

      // Simulate connection (in production, this would use LiveKit/WebRTC)
      setCallState("ringing");
      setTimeout(() => {
        setCallState("active");
        toast.success(`${mode === "video" ? "Video" : "Voice"} call connected`);
      }, 2000);
    } catch (err) {
      console.error("Media access error:", err);
      toast.error("Could not access camera/microphone. Please check permissions.");
      onEnd();
    }
  }, [mode, isFrontCamera, onEnd]);

  useEffect(() => {
    startMedia();
    return () => {
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // Call duration timer
  useEffect(() => {
    if (callState === "active") {
      timerRef.current = setInterval(() => setDuration((d) => d + 1), 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [callState]);

  const formatDuration = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, "0");
    const s = (secs % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  const handleEndCall = () => {
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    if (timerRef.current) clearInterval(timerRef.current);
    setCallState("ended");
    toast("Call ended");
    onEnd();
  };

  const toggleMute = () => {
    const audioTrack = localStreamRef.current?.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      setIsMuted(!audioTrack.enabled);
    }
  };

  const toggleVideo = () => {
    const videoTrack = localStreamRef.current?.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      setIsVideoOff(!videoTrack.enabled);
    }
  };

  const switchCamera = async () => {
    if (!localStreamRef.current) return;
    localStreamRef.current.getVideoTracks().forEach((t) => t.stop());
    setIsFrontCamera((prev) => !prev);
    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: !isFrontCamera ? "user" : "environment" },
        audio: true,
      });
      localStreamRef.current = newStream;
      if (localVideoRef.current) localVideoRef.current.srcObject = newStream;
    } catch {
      toast.error("Could not switch camera");
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      {/* Video background */}
      {mode === "video" && !isVideoOff ? (
        <>
          {/* Remote video (full screen placeholder) */}
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-b from-black/60 to-black/90">
            <div className="text-center">
              <Avatar className="h-28 w-28 mx-auto mb-4 border-4 border-white/20">
                <AvatarImage src={otherUserProfile.avatar_url || ""} />
                <AvatarFallback className="bg-muted text-4xl font-bold">
                  {otherUserProfile.display_name[0]}
                </AvatarFallback>
              </Avatar>
              {callState !== "active" && (
                <p className="text-white/70 text-sm animate-pulse">
                  {callState === "connecting" ? "Connecting..." : "Ringing..."}
                </p>
              )}
            </div>
          </div>

          {/* Local video (small overlay) */}
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="absolute top-16 right-4 w-28 h-40 rounded-2xl overflow-hidden border-2 border-white/30 shadow-xl z-10"
          >
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className="h-full w-full object-cover mirror"
              style={{ transform: "scaleX(-1)" }}
            />
          </motion.div>
        </>
      ) : (
        /* Audio-only or video-off UI */
        <div className="flex-1 flex flex-col items-center justify-center bg-gradient-to-b from-gray-900 to-black">
          <motion.div
            animate={callState === "ringing" ? { scale: [1, 1.1, 1] } : {}}
            transition={{ repeat: Infinity, duration: 1.5 }}
          >
            <Avatar className="h-32 w-32 border-4 border-white/20 shadow-2xl">
              <AvatarImage src={otherUserProfile.avatar_url || ""} />
              <AvatarFallback className="bg-muted text-5xl font-bold">
                {otherUserProfile.display_name[0]}
              </AvatarFallback>
            </Avatar>
          </motion.div>
          <h2 className="text-white text-xl font-bold mt-5">{otherUserProfile.display_name}</h2>
          <p className="text-white/60 text-sm mt-1">
            {callState === "connecting" && "Connecting..."}
            {callState === "ringing" && "Ringing..."}
            {callState === "active" && formatDuration(duration)}
            {callState === "ended" && "Call ended"}
          </p>

          {/* Ripple effect while ringing */}
          {callState === "ringing" && (
            <div className="absolute">
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  className="absolute rounded-full border border-white/10"
                  style={{
                    width: 160 + i * 60,
                    height: 160 + i * 60,
                    top: -(80 + i * 30),
                    left: -(80 + i * 30),
                  }}
                  animate={{ scale: [1, 1.3], opacity: [0.3, 0] }}
                  transition={{ repeat: Infinity, duration: 2, delay: i * 0.5 }}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-4 py-3 z-20">
        <button onClick={handleEndCall} className="p-2 rounded-full bg-white/10 backdrop-blur-sm">
          <ArrowLeft className="h-5 w-5 text-white" />
        </button>
        {callState === "active" && (
          <div className="bg-white/10 backdrop-blur-sm rounded-full px-3 py-1">
            <span className="text-white text-sm font-medium">{formatDuration(duration)}</span>
          </div>
        )}
        <div className="w-9" />
      </div>

      {/* Bottom controls */}
      <div className="absolute bottom-0 left-0 right-0 pb-12 pt-6 px-6 z-20">
        <div className="flex items-center justify-center gap-5">
          {/* Mute */}
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={toggleMute}
            className={`flex h-14 w-14 items-center justify-center rounded-full ${
              isMuted ? "bg-white text-black" : "bg-white/15 backdrop-blur-sm text-white"
            }`}
          >
            {isMuted ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
          </motion.button>

          {/* Video toggle (only in video mode) */}
          {mode === "video" && (
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={toggleVideo}
              className={`flex h-14 w-14 items-center justify-center rounded-full ${
                isVideoOff ? "bg-white text-black" : "bg-white/15 backdrop-blur-sm text-white"
              }`}
            >
              {isVideoOff ? <VideoOff className="h-6 w-6" /> : <Video className="h-6 w-6" />}
            </motion.button>
          )}

          {/* End call */}
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={handleEndCall}
            className="flex h-16 w-16 items-center justify-center rounded-full bg-red-500 shadow-lg shadow-red-500/30"
          >
            <PhoneOff className="h-7 w-7 text-white" />
          </motion.button>

          {/* Switch camera (video mode only) */}
          {mode === "video" && !isVideoOff && (
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={switchCamera}
              className="flex h-14 w-14 items-center justify-center rounded-full bg-white/15 backdrop-blur-sm text-white"
            >
              <SwitchCamera className="h-6 w-6" />
            </motion.button>
          )}

          {/* Speaker placeholder for audio mode */}
          {mode === "audio" && (
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => toast("Speaker toggled")}
              className="flex h-14 w-14 items-center justify-center rounded-full bg-white/15 backdrop-blur-sm text-white"
            >
              <Phone className="h-6 w-6" />
            </motion.button>
          )}
        </div>
      </div>
    </div>
  );
};

export default CallView;
