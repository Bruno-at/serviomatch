import { motion } from "framer-motion";
import { HeartHandshake } from "lucide-react";

interface CompatibilityMeterProps {
  score: number;
  compact?: boolean;
}

const CompatibilityMeter = ({ score, compact = false }: CompatibilityMeterProps) => {
  const color = score >= 75 ? "text-green-500" : score >= 50 ? "text-yellow-500" : "text-muted-foreground";
  const bg = score >= 75 ? "bg-green-500" : score >= 50 ? "bg-yellow-500" : "bg-muted-foreground";

  if (compact) {
    return (
      <span className={`inline-flex items-center gap-0.5 text-[10px] font-bold ${color}`}>
        <HeartHandshake className="h-3 w-3" />
        {score}%
      </span>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <HeartHandshake className={`h-3.5 w-3.5 ${color}`} />
      <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${score}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className={`h-full rounded-full ${bg}`}
        />
      </div>
      <span className={`text-[10px] font-bold ${color}`}>{score}%</span>
    </div>
  );
};

export default CompatibilityMeter;
