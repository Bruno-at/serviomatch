import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import BottomNav from "@/components/BottomNav";
import DiscoverView from "@/components/DiscoverView";
import NearbyView from "@/components/NearbyView";
import MatchesView from "@/components/MatchesView";
import LikesView from "@/components/LikesView";
import MessagesView from "@/components/MessagesView";
import ProfileView from "@/components/ProfileView";
import ProfileVisitorsView from "@/components/ProfileVisitorsView";
import SavedProfilesView from "@/components/SavedProfilesView";
import PhotoUploadOnboarding from "@/components/PhotoUploadOnboarding";
import ChatView from "@/components/ChatView";
import SpeedDating from "@/components/SpeedDating";
import ChallengesView from "@/components/ChallengesView";
import Auth from "./Auth";
import type { Tables } from "@/integrations/supabase/types";

const Index = () => {
  const { user, loading } = useAuth();
  const [activeTab, setActiveTab] = useState("discover");
  const [savedView, setSavedView] = useState<"favorites" | "bookmarks" | null>(null);
  const [showVisitors, setShowVisitors] = useState(false);
  const [showSpeedDating, setShowSpeedDating] = useState(false);
  const [showChallenges, setShowChallenges] = useState(false);
  const [needsOnboarding, setNeedsOnboarding] = useState<boolean | null>(null);
  const [directChat, setDirectChat] = useState<{ matchId: string; profile: Tables<"profiles"> } | null>(null);

  useEffect(() => {
    if (!user) return;
    const checkOnboarding = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("photos, avatar_url")
        .eq("user_id", user.id)
        .single();

      const hasPhotos = data?.photos && (data.photos as string[]).length > 0;
      const hasAvatar = !!data?.avatar_url;
      setNeedsOnboarding(!hasPhotos && !hasAvatar);
    };
    checkOnboarding();
  }, [user]);

  if (loading) {
    return (
      <div className="flex h-dvh items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!user) return <Auth />;

  if (needsOnboarding === null) {
    return (
      <div className="flex h-dvh items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (needsOnboarding) {
    return <PhotoUploadOnboarding onComplete={() => setNeedsOnboarding(false)} />;
  }

  if (savedView) {
    return (
      <div className="mx-auto flex h-dvh max-w-md flex-col bg-background overflow-y-auto">
        <SavedProfilesView type={savedView} onBack={() => setSavedView(null)} />
      </div>
    );
  }

  if (directChat) {
    return (
      <div className="mx-auto flex h-dvh max-w-md flex-col bg-background overflow-y-auto">
        <ChatView
          matchId={directChat.matchId}
          otherUserProfile={directChat.profile}
          onBack={() => setDirectChat(null)}
        />
      </div>
    );
  }

  if (showSpeedDating) {
    return (
      <div className="mx-auto flex h-dvh max-w-md flex-col bg-background overflow-y-auto">
        <SpeedDating onBack={() => setShowSpeedDating(false)} />
      </div>
    );
  }

  if (showChallenges) {
    return (
      <div className="mx-auto flex h-dvh max-w-md flex-col bg-background overflow-y-auto">
        <ChallengesView onBack={() => setShowChallenges(false)} />
      </div>
    );
  }

  if (showVisitors) {
    return (
      <div className="mx-auto flex h-dvh max-w-md flex-col bg-background overflow-y-auto pb-20">
        <ProfileVisitorsView />
        <BottomNav active={activeTab} onNavigate={(tab) => { setShowVisitors(false); setActiveTab(tab); }} />
      </div>
    );
  }

  return (
    <div className="mx-auto flex h-dvh max-w-md flex-col bg-background overflow-y-auto pb-20">
      {activeTab === "discover" && (
        <DiscoverView
          onShowFavorites={() => setSavedView("favorites")}
          onShowBookmarks={() => setSavedView("bookmarks")}
          onNavigateToChat={(matchId, profile) => setDirectChat({ matchId, profile })}
        />
      )}
      {activeTab === "nearby" && <NearbyView />}
      {activeTab === "matches" && <MatchesView />}
      {activeTab === "messages" && <MessagesView />}
      {activeTab === "profile" && <ProfileView />}
      <BottomNav
        active={activeTab}
        onNavigate={setActiveTab}
        onSpeedDating={() => setShowSpeedDating(true)}
        onChallenges={() => setShowChallenges(true)}
      />
    </div>
  );
};

export default Index;
