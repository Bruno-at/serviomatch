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
import LiveView from "@/components/LiveView";
import SecretCrushView from "@/components/SecretCrushView";
import Auth from "./Auth";
import type { Tables } from "@/integrations/supabase/types";

const Index = () => {
  const { user, loading } = useAuth();
  const [activeTab, setActiveTab] = useState("discover");
  const [savedView, setSavedView] = useState<"favorites" | "bookmarks" | null>(null);
  const [showVisitors, setShowVisitors] = useState(false);
  const [showSpeedDating, setShowSpeedDating] = useState(false);
  const [showChallenges, setShowChallenges] = useState(false);
  const [showLive, setShowLive] = useState(false);
  const [showCrush, setShowCrush] = useState(false);
  const [needsOnboarding, setNeedsOnboarding] = useState<boolean | null>(null);
  const [directChat, setDirectChat] = useState<{ matchId: string; profile: Tables<"profiles"> } | null>(null);

  useEffect(() => {
    if (!user) return;
    const checkOnboarding = async () => {
      const { data } = await supabase.from("profiles").select("photos, avatar_url").eq("user_id", user.id).maybeSingle();
      const hasPhotos = data?.photos && (data.photos as string[]).length > 0;
      const hasAvatar = !!data?.avatar_url;
      setNeedsOnboarding(!hasPhotos && !hasAvatar);
    };
    checkOnboarding();
  }, [user]);

  if (loading) {
    return <div className="flex h-dvh items-center justify-center bg-background"><p className="text-sm text-muted-foreground">Loading...</p></div>;
  }
  if (!user) return <Auth />;
  if (needsOnboarding === null) {
    return <div className="flex h-dvh items-center justify-center bg-background"><p className="text-sm text-muted-foreground">Loading...</p></div>;
  }
  if (needsOnboarding) {
    return <PhotoUploadOnboarding onComplete={() => setNeedsOnboarding(false)} />;
  }

  const handleNavigate = (tab: string) => {
    setSavedView(null);
    setDirectChat(null);
    setShowSpeedDating(false);
    setShowChallenges(false);
    setShowVisitors(false);
    setShowLive(false);
    setShowCrush(false);
    setActiveTab(tab);
  };

  const renderContent = () => {
    if (savedView) return <SavedProfilesView type={savedView} onBack={() => setSavedView(null)} />;
    if (directChat) return <ChatView matchId={directChat.matchId} otherUserProfile={directChat.profile} onBack={() => setDirectChat(null)} />;
    if (showSpeedDating) return <SpeedDating onBack={() => setShowSpeedDating(false)} />;
    if (showChallenges) return <ChallengesView onBack={() => setShowChallenges(false)} />;
    if (showVisitors) return <ProfileVisitorsView />;
    if (showLive) return <LiveView />;
    if (showCrush) return <SecretCrushView onBack={() => setShowCrush(false)} />;

    return (
      <>
        {activeTab === "discover" && (
          <DiscoverView onShowFavorites={() => setSavedView("favorites")} onShowBookmarks={() => setSavedView("bookmarks")}
            onNavigateToChat={(matchId, profile) => setDirectChat({ matchId, profile })} />
        )}
        {activeTab === "nearby" && <NearbyView />}
        {activeTab === "matches" && <MatchesView />}
        {activeTab === "messages" && <MessagesView />}
        {activeTab === "profile" && <ProfileView />}
      </>
    );
  };

  return (
    <div className="mx-auto flex h-dvh max-w-md flex-col bg-background overflow-y-auto pb-20">
      {renderContent()}
      <BottomNav
        active={activeTab}
        onNavigate={handleNavigate}
        onSpeedDating={() => { setShowLive(false); setShowChallenges(false); setShowCrush(false); setShowSpeedDating(true); }}
        onChallenges={() => { setShowLive(false); setShowSpeedDating(false); setShowCrush(false); setShowChallenges(true); }}
        onLive={() => { setShowSpeedDating(false); setShowChallenges(false); setShowCrush(false); setShowLive(true); }}
        onCrush={() => { setShowSpeedDating(false); setShowChallenges(false); setShowLive(false); setShowCrush(true); }}
      />
    </div>
  );
};

export default Index;
