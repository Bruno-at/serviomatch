interface Props {
  value: number; // 0–100
  size?: number;
  stroke?: number;
}

const ProfileCompletionRing = ({ value, size = 72, stroke = 6 }: Props) => {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(100, value));
  const dash = (clamped / 100) * c;

  const color =
    clamped >= 90 ? "hsl(142 76% 45%)" :
    clamped >= 60 ? "hsl(var(--primary))" :
    "hsl(38 92% 55%)";

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none" stroke="hsl(var(--muted))" strokeWidth={stroke}
        />
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={`${dash} ${c - dash}`}
          style={{ transition: "stroke-dasharray 0.6s ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-sm font-bold text-foreground leading-none">{clamped}%</span>
        <span className="text-[8px] text-muted-foreground uppercase tracking-wide mt-0.5">Profile</span>
      </div>
    </div>
  );
};

export default ProfileCompletionRing;
