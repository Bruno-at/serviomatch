import { motion } from "framer-motion";
import { Settings, Camera, BadgeCheck, MapPin, Edit3 } from "lucide-react";
import profile1 from "@/assets/profile-1.jpg";

const ProfileView = () => {
  return (
    <div className="flex h-full flex-col items-center px-6 pt-4">
      <div className="flex w-full justify-between items-center mb-6">
        <h1 className="text-2xl font-bold font-display text-foreground">Profile</h1>
        <button className="rounded-full bg-muted p-2">
          <Settings className="h-5 w-5 text-muted-foreground" />
        </button>
      </div>

      {/* Avatar */}
      <div className="relative mb-4">
        <img
          src={profile1}
          alt="Your profile"
          className="h-28 w-28 rounded-full object-cover ring-4 ring-primary/20"
        />
        <button className="absolute bottom-0 right-0 rounded-full gradient-love p-2 shadow-card">
          <Camera className="h-4 w-4 text-primary-foreground" />
        </button>
      </div>

      <h2 className="text-xl font-bold font-display text-foreground flex items-center gap-1">
        Sofia, 26
        <BadgeCheck className="h-5 w-5 text-primary" />
      </h2>
      <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
        <MapPin className="h-3 w-3" /> New York City
      </p>

      {/* Stats */}
      <div className="mt-6 grid w-full grid-cols-3 gap-3">
        {[
          { label: "Likes", value: "124" },
          { label: "Matches", value: "38" },
          { label: "Views", value: "562" },
        ].map((stat) => (
          <div key={stat.label} className="rounded-2xl bg-muted p-3 text-center">
            <p className="text-lg font-bold font-display text-foreground">{stat.value}</p>
            <p className="text-[10px] text-muted-foreground font-medium">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Bio section */}
      <div className="mt-6 w-full rounded-2xl bg-card p-4 shadow-card">
        <div className="flex justify-between items-center mb-2">
          <h3 className="text-sm font-semibold text-foreground">About me</h3>
          <Edit3 className="h-4 w-4 text-muted-foreground" />
        </div>
        <p className="text-sm text-muted-foreground">
          Coffee lover. Sunset chaser. Dog mom. Always looking for the next adventure and a good conversation.
        </p>
      </div>

      {/* Interests */}
      <div className="mt-4 w-full">
        <h3 className="text-sm font-semibold text-foreground mb-2">Interests</h3>
        <div className="flex flex-wrap gap-2">
          {["Travel", "Photography", "Yoga", "Coffee", "Dogs", "Art"].map((i) => (
            <span key={i} className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
              {i}
            </span>
          ))}
        </div>
      </div>

      <motion.button
        whileTap={{ scale: 0.97 }}
        className="mt-6 w-full rounded-2xl gradient-love py-3.5 text-sm font-semibold text-primary-foreground shadow-card mb-24"
      >
        Edit Profile
      </motion.button>
    </div>
  );
};

export default ProfileView;
