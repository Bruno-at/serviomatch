import { useState, useEffect } from "react";
import { Timer } from "lucide-react";

interface MatchExpirationTimerProps {
  matchedAt: string;
  hasMessages: boolean;
  expiryHours?: number;
}

const MatchExpirationTimer = ({ matchedAt, hasMessages, expiryHours = 48 }: MatchExpirationTimerProps) => {
  const [remaining, setRemaining] = useState("");
  const [urgent, setUrgent] = useState(false);

  useEffect(() => {
    if (hasMessages) return;

    const update = () => {
      const expiry = new Date(matchedAt).getTime() + expiryHours * 60 * 60 * 1000;
      const diff = expiry - Date.now();

      if (diff <= 0) {
        setRemaining("Expired");
        setUrgent(true);
        return;
      }

      const hours = Math.floor(diff / 3600000);
      const mins = Math.floor((diff % 3600000) / 60000);

      setUrgent(hours < 6);

      if (hours > 0) {
        setRemaining(`${hours}h ${mins}m`);
      } else {
        setRemaining(`${mins}m`);
      }
    };

    update();
    const interval = setInterval(update, 60000);
    return () => clearInterval(interval);
  }, [matchedAt, hasMessages, expiryHours]);

  if (hasMessages) return null;

  return (
    <span className={`inline-flex items-center gap-0.5 text-[10px] font-medium ${
      urgent ? "text-destructive" : "text-muted-foreground"
    }`}>
      <Timer className="h-3 w-3" />
      {remaining}
    </span>
  );
};

export default MatchExpirationTimer;
