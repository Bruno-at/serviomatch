import { Share2, ExternalLink } from "lucide-react";
import { toast } from "sonner";

interface SocialShareProps {
  title?: string;
  text?: string;
  compact?: boolean;
}

const SocialShare = ({ title = "Check out Spark! 💕", text = "Join the best dating app!", compact = false }: SocialShareProps) => {
  const share = async () => {
    const url = window.location.origin;
    const data = { title, text, url };
    try {
      if (navigator.share && navigator.canShare?.(data) !== false) {
        await navigator.share(data);
        return;
      }
      throw new Error("unsupported");
    } catch (err: any) {
      if (err?.name === "AbortError") return;
      try {
        await navigator.clipboard.writeText(`${text} ${url}`);
        toast.success("Link copied to clipboard!");
      } catch {
        window.open(url, "_blank");
      }
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
