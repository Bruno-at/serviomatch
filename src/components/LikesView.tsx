import { motion } from "framer-motion";
import { Heart, Lock } from "lucide-react";
import profile1 from "@/assets/profile-1.jpg";
import profile3 from "@/assets/profile-3.jpg";

const likedBy = [
  { id: "1", image: profile1, blurred: false },
  { id: "2", image: profile3, blurred: true },
  { id: "3", image: profile1, blurred: true },
];

const LikesView = () => {
  return (
    <div className="flex h-full flex-col px-6 pt-4">
      <h1 className="text-2xl font-bold font-display text-foreground mb-1">
        Likes
      </h1>
      <p className="text-sm text-muted-foreground mb-6">
        People who liked your profile
      </p>

      <div className="grid grid-cols-2 gap-4">
        {likedBy.map((person, i) => (
          <motion.div
            key={person.id + i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="relative aspect-[3/4] overflow-hidden rounded-2xl shadow-card"
          >
            <img
              src={person.image}
              alt="Someone who liked you"
              className={`h-full w-full object-cover ${person.blurred ? "blur-lg scale-110" : ""}`}
            />
            {person.blurred && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-foreground/20 backdrop-blur-sm">
                <Lock className="h-6 w-6 text-primary-foreground mb-1" />
                <span className="text-xs font-semibold text-primary-foreground">Upgrade to see</span>
              </div>
            )}
            {!person.blurred && (
              <div className="absolute bottom-3 right-3 rounded-full gradient-love p-2 shadow-card">
                <Heart className="h-4 w-4 text-primary-foreground" />
              </div>
            )}
          </motion.div>
        ))}
      </div>

      <motion.button
        whileTap={{ scale: 0.97 }}
        className="mt-6 w-full rounded-2xl gradient-love py-3.5 text-sm font-semibold text-primary-foreground shadow-card"
      >
        Unlock all likes
      </motion.button>
    </div>
  );
};

export default LikesView;
