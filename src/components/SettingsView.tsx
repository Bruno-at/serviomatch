import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Bell, Shield, Eye, MapPin, LogOut, Trash2, ChevronRight } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";

interface SettingsViewProps {
  onBack: () => void;
}

const SettingsView = ({ onBack }: SettingsViewProps) => {
  const { user, signOut } = useAuth();

  // Local settings state (persisted to localStorage)
  const storageKey = `settings_${user?.id}`;
  const saved = JSON.parse(localStorage.getItem(storageKey) || "{}");

  const [pushNotifications, setPushNotifications] = useState(saved.pushNotifications ?? true);
  const [messageNotifications, setMessageNotifications] = useState(saved.messageNotifications ?? true);
  const [matchNotifications, setMatchNotifications] = useState(saved.matchNotifications ?? true);
  const [showOnlineStatus, setShowOnlineStatus] = useState(saved.showOnlineStatus ?? true);
  const [showDistance, setShowDistance] = useState(saved.showDistance ?? true);
  const [maxDistance, setMaxDistance] = useState<number[]>(saved.maxDistance ?? [50]);
  const [ageRange, setAgeRange] = useState<number[]>(saved.ageRange ?? [18, 45]);

  const persist = (key: string, value: unknown) => {
    const current = JSON.parse(localStorage.getItem(storageKey) || "{}");
    current[key] = value;
    localStorage.setItem(storageKey, JSON.stringify(current));
  };

  const toggle = (key: string, value: boolean, setter: (v: boolean) => void) => {
    setter(value);
    persist(key, value);
  };

  const handleDeleteAccount = async () => {
    toast.error("Account deletion requested. Please contact support.");
  };

  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div className="mb-6">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 px-1">{title}</h3>
      <div className="rounded-2xl bg-card shadow-card divide-y divide-border overflow-hidden">
        {children}
      </div>
    </div>
  );

  const Row = ({ icon: Icon, label, children }: { icon: typeof Bell; label: string; children: React.ReactNode }) => (
    <div className="flex items-center justify-between px-4 py-3.5">
      <div className="flex items-center gap-3">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium text-foreground">{label}</span>
      </div>
      {children}
    </div>
  );

  return (
    <div className="flex h-full flex-col px-6 pt-4 overflow-y-auto pb-24">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={onBack} className="rounded-full p-1 hover:bg-muted">
          <ArrowLeft className="h-5 w-5 text-foreground" />
        </button>
        <h1 className="text-xl font-bold font-display text-foreground">Settings</h1>
      </div>

      {/* Notifications */}
      <Section title="Notifications">
        <Row icon={Bell} label="Push notifications">
          <Switch checked={pushNotifications} onCheckedChange={(v) => toggle("pushNotifications", v, setPushNotifications)} />
        </Row>
        <Row icon={Bell} label="New messages">
          <Switch checked={messageNotifications} onCheckedChange={(v) => toggle("messageNotifications", v, setMessageNotifications)} />
        </Row>
        <Row icon={Bell} label="New matches">
          <Switch checked={matchNotifications} onCheckedChange={(v) => toggle("matchNotifications", v, setMatchNotifications)} />
        </Row>
      </Section>

      {/* Discovery */}
      <Section title="Discovery">
        <div className="px-4 py-3.5">
          <div className="flex items-center gap-3 mb-3">
            <MapPin className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium text-foreground">Max distance</span>
            <span className="ml-auto text-sm font-semibold text-primary">{maxDistance[0]} km</span>
          </div>
          <Slider
            value={maxDistance}
            onValueChange={(v) => { setMaxDistance(v); persist("maxDistance", v); }}
            min={5}
            max={200}
            step={5}
            className="w-full"
          />
        </div>
        <div className="px-4 py-3.5">
          <div className="flex items-center gap-3 mb-3">
            <Eye className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium text-foreground">Age range</span>
            <span className="ml-auto text-sm font-semibold text-primary">{ageRange[0]} – {ageRange[1]}</span>
          </div>
          <Slider
            value={ageRange}
            onValueChange={(v) => { setAgeRange(v); persist("ageRange", v); }}
            min={18}
            max={80}
            step={1}
            className="w-full"
          />
        </div>
      </Section>

      {/* Privacy */}
      <Section title="Privacy">
        <Row icon={Eye} label="Show online status">
          <Switch checked={showOnlineStatus} onCheckedChange={(v) => toggle("showOnlineStatus", v, setShowOnlineStatus)} />
        </Row>
        <Row icon={MapPin} label="Show distance">
          <Switch checked={showDistance} onCheckedChange={(v) => toggle("showDistance", v, setShowDistance)} />
        </Row>
      </Section>

      {/* Account */}
      <Section title="Account">
        <button onClick={signOut} className="flex w-full items-center justify-between px-4 py-3.5">
          <div className="flex items-center gap-3">
            <LogOut className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium text-foreground">Sign out</span>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </button>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <button className="flex w-full items-center justify-between px-4 py-3.5">
              <div className="flex items-center gap-3">
                <Trash2 className="h-4 w-4 text-destructive" />
                <span className="text-sm font-medium text-destructive">Delete account</span>
              </div>
              <ChevronRight className="h-4 w-4 text-destructive" />
            </button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete your account?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. All your data, matches, and messages will be permanently deleted.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteAccount} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </Section>

      <p className="text-center text-[10px] text-muted-foreground mt-2">Version 1.0.0</p>
    </div>
  );
};

export default SettingsView;
