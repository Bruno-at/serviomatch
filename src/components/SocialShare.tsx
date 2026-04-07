import { Share2, ExternalLink } from "lucide-react";
import { toast } from "sonner";

interface SocialShareProps {
  title?: string;
  text?: string;
  compact?: boolean;
}

const SocialShare = ({ title = "Check out Spark! 💕", text = "Join the best dating app!", compact = false }: SocialShareProps) => {
  const share = () => {
    const url = window.location.origin;
    if (navigator.share) {
      navigator.share({ title, text, url });
    } else {
      navigator.clipboard.writeText(`${text} ${url}`);
      toast.success("Link copied to clipboard!");
    }
  };

  if (compact) {
    return (
      <button onClick={share} className="rounded-full bg-muted p-2">
        <Share2 className="h-4 w-4 text-muted-foreground" />
      </button>
    );
  }

  return (
    <button
      onClick={share}
      className="flex items-center gap-2 rounded-xl bg-card px-4 py-2.5 text-sm font-medium text-foreground shadow-sm"
    >
      <Share2 className="h-4 w-4 text-primary" />
      Share App
      <ExternalLink className="h-3 w-3 text-muted-foreground" />
    </button>
  );
};

export default SocialShare;
