import { motion } from "framer-motion";
import { Search } from "lucide-react";
import profile2 from "@/assets/profile-2.jpg";
import profile4 from "@/assets/profile-4.jpg";

const conversations = [
  { id: "1", name: "Lucas", image: profile2, lastMessage: "Hey! How's your day going? 😊", time: "2m", unread: true },
  { id: "2", name: "Ethan", image: profile4, lastMessage: "That hiking trail was amazing!", time: "1h", unread: false },
];

const MessagesView = () => {
  return (
    <div className="flex h-full flex-col px-6 pt-4">
      <h1 className="text-2xl font-bold font-display text-foreground mb-4">
        Messages
      </h1>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          placeholder="Search conversations..."
          className="w-full rounded-xl bg-muted py-2.5 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary/30"
        />
      </div>

      {/* Conversations */}
      <div className="flex flex-col gap-2">
        {conversations.map((convo, i) => (
          <motion.button
            key={convo.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.1 }}
            className="flex items-center gap-3 rounded-2xl bg-card p-3 text-left transition-colors hover:bg-muted shadow-card"
          >
            <div className="relative">
              <img src={convo.image} alt={convo.name} className="h-12 w-12 rounded-full object-cover" />
              {convo.unread && (
                <div className="absolute -top-0.5 -right-0.5 h-3.5 w-3.5 rounded-full gradient-love border-2 border-card" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex justify-between items-center">
                <span className="font-semibold text-sm text-foreground">{convo.name}</span>
                <span className="text-[10px] text-muted-foreground">{convo.time}</span>
              </div>
              <p className="text-xs text-muted-foreground truncate">{convo.lastMessage}</p>
            </div>
          </motion.button>
        ))}
      </div>
    </div>
  );
};

export default MessagesView;
