import { useEffect, useRef, useState } from "react";
import {
  Room,
  RoomEvent,
  Track,
  RemoteTrackPublication,
  RemoteParticipant,
  LocalParticipant,
  Participant,
  ConnectionState,
} from "livekit-client";
import { motion, AnimatePresence } from "framer-motion";
import { Video, VideoOff, Mic, MicOff, PhoneOff, ScreenShare, ScreenShareOff } from "lucide-react";

interface VideoGridProps {
  token: string;
  url: string;
  onDisconnect: () => void;
}

interface ParticipantTile {
  participant: Participant;
  isLocal: boolean;
}

const VideoTile = ({ participant, isLocal }: ParticipantTile) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [hasVideo, setHasVideo] = useState(false);

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
    };

    handleTrack();

    participant.on("trackSubscribed" as any, handleTrack);
    participant.on("trackUnsubscribed" as any, handleTrack);
    participant.on("trackMuted" as any, handleTrack);
    participant.on("trackUnmuted" as any, handleTrack);
    if (isLocal) {
      participant.on("localTrackPublished" as any, handleTrack);
      participant.on("localTrackUnpublished" as any, handleTrack);
    }

    return () => {
      participant.off("trackSubscribed" as any, handleTrack);
      participant.off("trackUnsubscribed" as any, handleTrack);
      participant.off("trackMuted" as any, handleTrack);
      participant.off("trackUnmuted" as any, handleTrack);
      if (isLocal) {
        participant.off("localTrackPublished" as any, handleTrack);
        participant.off("localTrackUnpublished" as any, handleTrack);
      }
    };
  }, [participant, isLocal]);

  const name = participant.name || participant.identity || "User";

  return (
    <div className="relative rounded-2xl overflow-hidden bg-muted aspect-[3/4]">
      {hasVideo ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isLocal}
          className="h-full w-full object-cover"
        />
      ) : (
        <div className="h-full w-full flex items-center justify-center bg-muted">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/20 text-xl font-bold text-primary font-display">
            {name.charAt(0).toUpperCase()}
          </div>
        </div>
      )}
      <audio ref={audioRef} autoPlay />
      <div className="absolute bottom-2 left-2 rounded-full bg-foreground/60 backdrop-blur-sm px-2.5 py-0.5">
        <span className="text-[10px] font-semibold text-primary-foreground">
          {isLocal ? "You" : name}
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

  const handleDisconnect = () => {
    roomRef.current?.disconnect();
    onDisconnect();
  };

  const gridCols =
    participants.length <= 1
      ? "grid-cols-1"
      : participants.length <= 4
        ? "grid-cols-2"
        : "grid-cols-3";

  return (
    <div className="flex flex-col h-full">
      {/* Video grid */}
      <div className={`flex-1 overflow-y-auto p-2 grid ${gridCols} gap-2 auto-rows-min`}>
        <AnimatePresence>
          {participants.map((tile) => (
            <motion.div
              key={tile.participant.identity}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
            >
              <VideoTile
                participant={tile.participant}
                isLocal={tile.isLocal}
              />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

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
