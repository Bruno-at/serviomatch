import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Radio } from "lucide-react";

interface CreateLiveRoomProps {
  onCreate: (title: string, description: string) => void;
  onCancel: () => void;
}

const CreateLiveRoom = ({ onCreate, onCancel }: CreateLiveRoomProps) => {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

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
        onClick={() => title.trim() && onCreate(title.trim(), description.trim())}
        disabled={!title.trim()}
        className="mt-8 w-full rounded-2xl gradient-love py-3.5 text-sm font-semibold text-primary-foreground shadow-card disabled:opacity-50"
      >
        🔴 Start Live
      </motion.button>
    </div>
  );
};

export default CreateLiveRoom;
