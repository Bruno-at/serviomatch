import { useEffect, useRef, useState } from "react";
import {
  Room,
  RoomEvent,
  Track,
  Participant,
  ConnectionQuality,
} from "livekit-client";
import { motion, AnimatePresence } from "framer-motion";
import { Video, VideoOff, Mic, MicOff, PhoneOff, ScreenShare, ScreenShareOff, Users } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface VideoGridProps {
  token: string;
  url: string;
  onDisconnect: () => void;
}

interface ParticipantTile {
  participant: Participant;
  isLocal: boolean;
}

interface ScreenShareInfo {
  participant: Participant;
  isLocal: boolean;
}

const qualityLabel = (quality: ConnectionQuality): string => {
  switch (quality) {
    case ConnectionQuality.Excellent: return "Excellent";
    case ConnectionQuality.Good: return "Good";
    case ConnectionQuality.Poor: return "Poor";
    default: return "Connecting…";
  }
};

const QualityBadge = ({ quality, compact = false }: { quality: ConnectionQuality; compact?: boolean }) => {
  const isUnknown = quality === ConnectionQuality.Unknown;
  const bars = [
    { filled: !isUnknown },
    { filled: quality === ConnectionQuality.Good || quality === ConnectionQuality.Excellent },
    { filled: quality === ConnectionQuality.Excellent },
  ];
  const color =
    quality === ConnectionQuality.Excellent
      ? "bg-green-400"
      : quality === ConnectionQuality.Good
        ? "bg-yellow-400"
        : quality === ConnectionQuality.Poor
          ? "bg-destructive"
          : isUnknown
            ? "bg-muted-foreground/60"
            : "bg-muted-foreground";

  const scale = compact ? 0.75 : 1;
  const baseH = [6, 9, 12];
  const label = qualityLabel(quality);

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={`rounded-full bg-foreground/60 backdrop-blur-sm ${compact ? "px-1.5 py-1" : "px-2 py-1"} flex items-center gap-1 cursor-default`}>
            <div className={`flex items-end gap-[2px] ${isUnknown ? "animate-pulse" : ""}`}>
              {bars.map((bar, i) => (
                <div
                  key={i}
                  style={{ height: `${Math.round(baseH[i] * scale)}px`, width: compact ? "2px" : "3px" }}
                  className={`rounded-sm transition-colors duration-500 ${bar.filled ? color : "bg-foreground/30"}`}
                />
              ))}
            </div>
            {!compact && (
              <span className={`text-[9px] font-semibold leading-none transition-colors duration-500 ${
                quality === ConnectionQuality.Excellent ? "text-green-400" :
                quality === ConnectionQuality.Good ? "text-yellow-400" :
                quality === ConnectionQuality.Poor ? "text-destructive" :
                "text-muted-foreground/80"
              }`}>
                {label}
              </span>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          Signal: <span className="font-semibold">{label}</span>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

const VideoTile = ({ participant, isLocal, compact }: ParticipantTile & { compact?: boolean }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [hasVideo, setHasVideo] = useState(false);
  const [micMuted, setMicMuted] = useState(true);
  const [quality, setQuality] = useState<ConnectionQuality>(participant.connectionQuality);

  useEffect(() => {
    const handleTrack = () => {
      const videoTrack = Array.from(participant.trackPublications.values()).find(
        (pub) => pub.track && pub.source === Track.Source.Camera
      );
      const audioTrack = Array.from(participant.trackPublications.values()).find(
        (pub) => pub.track && pub.source === Track.Source.Microphone
      );

      if (videoTrack?.track && videoRef.current) {
        videoTrack.track.attach(videoRef.current);
        setHasVideo(true);
      } else {
        setHasVideo(false);
      }

      if (audioTrack?.track && audioRef.current && !isLocal) {
        audioTrack.track.attach(audioRef.current);
      }

      // Update mic muted state
      setMicMuted(!audioTrack?.track || audioTrack.isMuted);
    };

    const handleQuality = () => setQuality(participant.connectionQuality);

    handleTrack();

    participant.on("trackSubscribed" as any, handleTrack);
    participant.on("trackUnsubscribed" as any, handleTrack);
    participant.on("trackMuted" as any, handleTrack);
    participant.on("trackUnmuted" as any, handleTrack);
    participant.on("connectionQualityChanged" as any, handleQuality);
    if (isLocal) {
      participant.on("localTrackPublished" as any, handleTrack);
      participant.on("localTrackUnpublished" as any, handleTrack);
    }

    return () => {
      participant.off("trackSubscribed" as any, handleTrack);
      participant.off("trackUnsubscribed" as any, handleTrack);
      participant.off("trackMuted" as any, handleTrack);
      participant.off("trackUnmuted" as any, handleTrack);
      participant.off("connectionQualityChanged" as any, handleQuality);
      if (isLocal) {
        participant.off("localTrackPublished" as any, handleTrack);
        participant.off("localTrackUnpublished" as any, handleTrack);
      }
    };
  }, [participant, isLocal]);

  const name = participant.name || participant.identity || "User";
  const size = compact ? "h-10 w-10 text-sm" : "h-14 w-14 text-xl";

  return (
    <div className={`relative rounded-2xl overflow-hidden bg-muted ${compact ? "aspect-square" : "aspect-[3/4]"}`}>
      {hasVideo ? (
        <video ref={videoRef} autoPlay playsInline muted={isLocal} className="h-full w-full object-cover" />
      ) : (
        <div className="h-full w-full flex items-center justify-center bg-muted">
          <div className={`flex ${size} items-center justify-center rounded-full bg-primary/20 font-bold text-primary font-display`}>
            {name.charAt(0).toUpperCase()}
          </div>
        </div>
      )}
      <audio ref={audioRef} autoPlay />
      {/* Mic muted indicator */}
      {micMuted && (
        <div className="absolute top-2 right-2 rounded-full bg-destructive/90 backdrop-blur-sm p-1.5">
          <MicOff className="h-3 w-3 text-primary-foreground" />
        </div>
      )}
      {/* Name + quality bar */}
      <div className="absolute bottom-1.5 left-1.5 right-1.5 flex items-center justify-between">
        {!compact && (
          <div className="rounded-full bg-foreground/60 backdrop-blur-sm px-2 py-0.5">
            <span className="text-[10px] font-semibold text-primary-foreground">
              {isLocal ? "You" : name}
            </span>
          </div>
        )}
        <div className={compact ? "ml-auto" : ""}>
          <QualityBadge quality={quality} compact={compact} />
        </div>
      </div>
    </div>
  );
};

const ScreenShareTile = ({ participant, isLocal }: ScreenShareInfo) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const attach = () => {
      const screenTrack = Array.from(participant.trackPublications.values()).find(
        (pub) => pub.track && pub.source === Track.Source.ScreenShare
      );
      if (screenTrack?.track && videoRef.current) {
        screenTrack.track.attach(videoRef.current);
      }
    };

    attach();
    participant.on("trackSubscribed" as any, attach);
    participant.on("trackUnsubscribed" as any, attach);
    if (isLocal) {
      participant.on("localTrackPublished" as any, attach);
      participant.on("localTrackUnpublished" as any, attach);
    }

    return () => {
      participant.off("trackSubscribed" as any, attach);
      participant.off("trackUnsubscribed" as any, attach);
      if (isLocal) {
        participant.off("localTrackPublished" as any, attach);
        participant.off("localTrackUnpublished" as any, attach);
      }
    };
  }, [participant, isLocal]);

  const name = participant.name || participant.identity || "User";

  return (
    <div className="relative rounded-2xl overflow-hidden bg-foreground/10 w-full h-full">
      <video ref={videoRef} autoPlay playsInline muted className="h-full w-full object-contain" />
      <div className="absolute top-2 left-2 rounded-full bg-foreground/60 backdrop-blur-sm px-2.5 py-0.5 flex items-center gap-1.5">
        <ScreenShare className="h-3 w-3 text-primary-foreground" />
        <span className="text-[10px] font-semibold text-primary-foreground">
          {isLocal ? "Your screen" : `${name}'s screen`}
        </span>
      </div>
    </div>
  );
};

const VideoGrid = ({ token, url, onDisconnect }: VideoGridProps) => {
  const roomRef = useRef<Room | null>(null);
  const [participants, setParticipants] = useState<ParticipantTile[]>([]);
  const [cameraOn, setCameraOn] = useState(true);
  const [micOn, setMicOn] = useState(true);
  const [screenSharing, setScreenSharing] = useState(false);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const room = new Room({
      adaptiveStream: true,
      dynacast: true,
    });
    roomRef.current = room;

    const updateParticipants = () => {
      const tiles: ParticipantTile[] = [];
      tiles.push({ participant: room.localParticipant, isLocal: true });
      room.remoteParticipants.forEach((p) => {
        tiles.push({ participant: p, isLocal: false });
      });
      setParticipants([...tiles]);
    };

    room.on(RoomEvent.Connected, () => {
      setConnected(true);
      updateParticipants();
    });
    room.on(RoomEvent.Disconnected, () => {
      setConnected(false);
      onDisconnect();
    });
    room.on(RoomEvent.ParticipantConnected, updateParticipants);
    room.on(RoomEvent.ParticipantDisconnected, updateParticipants);
    room.on(RoomEvent.TrackSubscribed, updateParticipants);
    room.on(RoomEvent.TrackUnsubscribed, updateParticipants);
    room.on(RoomEvent.TrackMuted, updateParticipants);
    room.on(RoomEvent.TrackUnmuted, updateParticipants);
    room.on(RoomEvent.LocalTrackPublished, updateParticipants);
    room.on(RoomEvent.LocalTrackUnpublished, updateParticipants);

    room
      .connect(url, token)
      .then(() => {
        room.localParticipant.enableCameraAndMicrophone();
      })
      .catch((err) => {
        console.error("LiveKit connect error:", err);
        onDisconnect();
      });

    return () => {
      room.disconnect();
    };
  }, [token, url]);

  const toggleCamera = async () => {
    const room = roomRef.current;
    if (!room) return;
    await room.localParticipant.setCameraEnabled(!cameraOn);
    setCameraOn(!cameraOn);
  };

  const toggleMic = async () => {
    const room = roomRef.current;
    if (!room) return;
    await room.localParticipant.setMicrophoneEnabled(!micOn);
    setMicOn(!micOn);
  };

  const toggleScreenShare = async () => {
    const room = roomRef.current;
    if (!room) return;
    try {
      await room.localParticipant.setScreenShareEnabled(!screenSharing);
      setScreenSharing(!screenSharing);
    } catch {
      // User cancelled the screen share picker
    }
  };

  const handleDisconnect = () => {
    roomRef.current?.disconnect();
    onDisconnect();
  };

  // Detect active screen shares
  const screenSharer = participants.find((tile) => {
    return Array.from(tile.participant.trackPublications.values()).some(
      (pub) => pub.track && pub.source === Track.Source.ScreenShare
    );
  });

  const isPiP = !!screenSharer;

  const gridCols =
    !isPiP
      ? participants.length <= 1
        ? "grid-cols-1"
        : participants.length <= 4
          ? "grid-cols-2"
          : "grid-cols-3"
      : "";

  return (
    <div className="flex flex-col h-full relative">
      {/* Participant count overlay */}
      <div className="absolute top-3 right-3 z-10 flex items-center gap-1.5 rounded-full bg-foreground/60 backdrop-blur-sm px-2.5 py-1">
        <Users className="h-3.5 w-3.5 text-primary-foreground" />
        <span className="text-xs font-semibold text-primary-foreground">{participants.length}</span>
      </div>

      {isPiP ? (
        /* PiP layout: screen share main + camera thumbnails */
        <div className="flex-1 flex flex-col overflow-hidden p-2 gap-2">
          {/* Main screen share */}
          <div className="flex-1 min-h-0">
            <ScreenShareTile participant={screenSharer.participant} isLocal={screenSharer.isLocal} />
          </div>
          {/* Camera thumbnails */}
          <div className="flex gap-2 overflow-x-auto pb-1">
            {participants.map((tile) => (
              <motion.div
                key={tile.participant.identity}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="w-20 shrink-0"
              >
                <VideoTile participant={tile.participant} isLocal={tile.isLocal} compact />
              </motion.div>
            ))}
          </div>
        </div>
      ) : (
        /* Standard grid layout */
        <div className={`flex-1 overflow-y-auto p-2 grid ${gridCols} gap-2 auto-rows-min`}>
          <AnimatePresence>
            {participants.map((tile) => (
              <motion.div
                key={tile.participant.identity}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
              >
                <VideoTile participant={tile.participant} isLocal={tile.isLocal} />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Controls */}
      <div className="flex items-center justify-center gap-4 py-3 px-4 border-t border-border bg-card">
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={toggleCamera}
          className={`flex h-11 w-11 items-center justify-center rounded-full ${cameraOn ? "bg-muted" : "bg-destructive"}`}
        >
          {cameraOn ? (
            <Video className="h-5 w-5 text-foreground" />
          ) : (
            <VideoOff className="h-5 w-5 text-primary-foreground" />
          )}
        </motion.button>
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={toggleMic}
          className={`flex h-11 w-11 items-center justify-center rounded-full ${micOn ? "bg-muted" : "bg-destructive"}`}
        >
          {micOn ? (
            <Mic className="h-5 w-5 text-foreground" />
          ) : (
            <MicOff className="h-5 w-5 text-primary-foreground" />
          )}
        </motion.button>
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={toggleScreenShare}
          className={`flex h-11 w-11 items-center justify-center rounded-full ${screenSharing ? "bg-primary" : "bg-muted"}`}
        >
          {screenSharing ? (
            <ScreenShareOff className="h-5 w-5 text-primary-foreground" />
          ) : (
            <ScreenShare className="h-5 w-5 text-foreground" />
          )}
        </motion.button>
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={handleDisconnect}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-destructive"
        >
          <PhoneOff className="h-5 w-5 text-primary-foreground" />
        </motion.button>
      </div>
    </div>
  );
};

export default VideoGrid;
