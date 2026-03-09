import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

const REPORT_REASONS = [
  "Inappropriate photos",
  "Fake profile",
  "Harassment",
  "Spam",
  "Underage user",
  "Other",
];

interface ReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetUserId: string;
  targetName: string;
}

const ReportDialog = ({ open, onOpenChange, targetUserId, targetName }: ReportDialogProps) => {
  const { user } = useAuth();
  const [reason, setReason] = useState("");
  const [blocking, setBlocking] = useState(false);

  const handleReport = async () => {
    if (!user || !reason) return;
    await supabase.from("reports").insert({
      reporter_id: user.id,
      reported_id: targetUserId,
      reason,
    });
    toast.success("Report submitted. Thank you for keeping the community safe.");
    onOpenChange(false);
    setReason("");
  };

  const handleBlock = async () => {
    if (!user) return;
    setBlocking(true);
    await supabase.from("blocks").insert({
      blocker_id: user.id,
      blocked_id: targetUserId,
    });
    toast.success(`${targetName} has been blocked`);
    setBlocking(false);
    onOpenChange(false);
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-sm rounded-2xl">
        <AlertDialogHeader>
          <AlertDialogTitle className="font-display">Report or Block</AlertDialogTitle>
          <AlertDialogDescription>
            Choose an action for {targetName}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="flex flex-col gap-2 my-2">
          {REPORT_REASONS.map((r) => (
            <button
              key={r}
              onClick={() => setReason(r)}
              className={`text-left text-sm px-3 py-2 rounded-xl transition-colors ${
                reason === r
                  ? "bg-primary/10 text-primary border border-primary/30"
                  : "bg-muted text-foreground hover:bg-muted/80"
              }`}
            >
              {r}
            </button>
          ))}
        </div>

        <AlertDialogFooter className="flex-col gap-2 sm:flex-col">
          <AlertDialogAction
            onClick={handleReport}
            disabled={!reason}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-xl"
          >
            Report
          </AlertDialogAction>
          <button
            onClick={handleBlock}
            disabled={blocking}
            className="w-full rounded-xl border border-border py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors"
          >
            Block User
          </button>
          <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default ReportDialog;
