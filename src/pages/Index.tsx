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
import Onboarding from "./Onboarding";
import ChatView from "@/components/ChatView";
import SpeedDating from "@/components/SpeedDating";
import ChallengesView from "@/components/ChallengesView";
import LiveView from "@/components/LiveView";
import SecretCrushView from "@/components/SecretCrushView";
import ReferralSystem from "@/components/ReferralSystem";
import DailyRewards from "@/components/DailyRewards";
import VIPSubscription from "@/components/VIPSubscription";
import NotificationsView from "@/components/NotificationsView";
import IncomingCallOverlay from "@/components/IncomingCallOverlay";
import Auth from "./Auth";
import type { Tables } from "@/integrations/supabase/types";

const SplashScreen = () => (
  <div className="flex h-dvh items-center justify-center bg-background">
    <div className="flex flex-col items-center gap-3">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary/20 border-t-primary" />
      <p className="text-sm text-muted-foreground">Loading Spark...</p>
    </div>
  </div>
);

const Index = () => {
  const { user, loading } = useAuth();
  const [activeTab, setActiveTab] = useState("discover");
  const [savedView, setSavedView] = useState<"favorites" | "bookmarks" | null>(null);
  const [showVisitors, setShowVisitors] = useState(false);
  const [showSpeedDating, setShowSpeedDating] = useState(false);
  const [showChallenges, setShowChallenges] = useState(false);
  const [showLive, setShowLive] = useState(false);
  const [showCrush, setShowCrush] = useState(false);
  const [showReferrals, setShowReferrals] = useState(false);
  const [showDailyRewards, setShowDailyRewards] = useState(false);
  const [showVIP, setShowVIP] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showLikes, setShowLikes] = useState(false);
  const [likesBadge, setLikesBadge] = useState(0);
  const [needsOnboarding, setNeedsOnboarding] = useState<boolean | null>(null);
  const [directChat, setDirectChat] = useState<{ matchId: string; profile: Tables<"profiles"> } | null>(null);

  // Track unseen likes count
  useEffect(() => {
    if (!user) return;
    const refreshCount = async () => {
      const { count } = await supabase
        .from("likes")
        .select("id", { count: "exact", head: true })
        .eq("liked_id", user.id);
      const seen = parseInt(localStorage.getItem(`likes_seen_${user.id}`) || "0", 10);
      setLikesBadge(Math.max(0, (count || 0) - seen));
    };
    refreshCount();
    const ch = supabase
      .channel("likes-badge")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "likes", filter: `liked_id=eq.${user.id}` }, refreshCount)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user]);

  // Auto-show daily rewards on first load
  useEffect(() => {
    if (!user) return;
    const lastShown = localStorage.getItem("daily_rewards_shown");
    const today = new Date().toISOString().split("T")[0];
    if (lastShown !== today) {
      setTimeout(() => setShowDailyRewards(true), 1500);
      localStorage.setItem("daily_rewards_shown", today);
    }
  }, [user]);

  useEffect(() => {
    if (!user) { setNeedsOnboarding(null); return; }
    let cancelled = false;
    setNeedsOnboarding(null);

    const checkOnboarding = async () => {
      const displayName =
        user.user_metadata?.display_name ||
        user.email?.split("@")[0] ||
        "";

      const { data, error } = await supabase
        .from("profiles")
        .select("onboarding_completed, profile_completed, email_verified")
        .eq("user_id", user.id)
        .maybeSingle();

      if (cancelled) return;

      if (error) {
        console.error("Failed to load onboarding state", error);
        setNeedsOnboarding(true);
        return;
      }

      const emailVerified = !!user.email_confirmed_at;

      if (!data) {
        const { error: createError } = await supabase.from("profiles").insert({
          user_id: user.id,
          display_name: displayName,
          email_verified: emailVerified,
          profile_completed: false,
          onboarding_completed: false,
        });

        if (createError) console.error("Failed to create profile", createError);
        if (!cancelled) setNeedsOnboarding(true);
        return;
      }

      const completed = Boolean(data.onboarding_completed && data.profile_completed);

      if (completed) {
        // Keep verification flags in sync, but never block completed users on email/profile setup again.
        if (!data.email_verified && emailVerified) {
          supabase
            .from("profiles")
            .update({ email_verified: true })
            .eq("user_id", user.id)
            .then(({ error: updateError }) => {
              if (updateError) console.error("Failed to sync email verification", updateError);
            });
        }
        setNeedsOnboarding(false);
        return;
      }

      setNeedsOnboarding(true);
    };

    checkOnboarding();

    return () => { cancelled = true; };
  }, [user]);

  if (loading) {
    return <SplashScreen />;
  }
  if (!user) return <Auth />;
  if (needsOnboarding === null) {
    return <SplashScreen />;
  }
  if (needsOnboarding) {
    return <Onboarding onComplete={() => setNeedsOnboarding(false)} />;
  }

  const handleNavigate = (tab: string) => {
    setSavedView(null);
    setDirectChat(null);
    setShowSpeedDating(false);
    setShowChallenges(false);
    setShowVisitors(false);
    setShowLive(false);
    setShowCrush(false);
    setShowReferrals(false);
    setShowVIP(false);
    setShowLikes(false);
    setActiveTab(tab);
  };

  const handleShowLikes = () => {
    setShowSpeedDating(false);
    setShowChallenges(false);
    setShowLive(false);
    setShowCrush(false);
    setShowLikes(true);
    if (user) {
      // mark current count as seen
      supabase
        .from("likes")
        .select("id", { count: "exact", head: true })
        .eq("liked_id", user.id)
        .then(({ count }) => {
          localStorage.setItem(`likes_seen_${user.id}`, String(count || 0));
          setLikesBadge(0);
        });
    }
  };

  const renderContent = () => {
    if (savedView) return <SavedProfilesView type={savedView} onBack={() => setSavedView(null)} />;
    if (directChat) return <ChatView matchId={directChat.matchId} otherUserProfile={directChat.profile} onBack={() => setDirectChat(null)} />;
    if (showSpeedDating) return <SpeedDating onBack={() => setShowSpeedDating(false)} />;
    if (showChallenges) return <ChallengesView onBack={() => setShowChallenges(false)} />;
    if (showVisitors) return <ProfileVisitorsView />;
    if (showLive) return <LiveView />;
    if (showCrush) return <SecretCrushView onBack={() => setShowCrush(false)} />;
    if (showReferrals) return <ReferralSystem onBack={() => setShowReferrals(false)} />;
    if (showVIP) return <VIPSubscription onBack={() => setShowVIP(false)} />;
    if (showLikes) return <LikesView onShowVisitors={() => { setShowLikes(false); setShowVisitors(true); }} onShowVIP={() => { setShowLikes(false); setShowVIP(true); }} />;

    return (
      <>
        {activeTab === "discover" && (
          <DiscoverView onShowFavorites={() => setSavedView("favorites")} onShowBookmarks={() => setSavedView("bookmarks")}
            onNavigateToChat={(matchId, profile) => setDirectChat({ matchId, profile })} />
        )}
        {activeTab === "nearby" && <NearbyView />}
        {activeTab === "matches" && <MatchesView />}
        {activeTab === "messages" && <MessagesView />}
        {activeTab === "profile" && (
          <ProfileView
            onShowReferrals={() => setShowReferrals(true)}
            onShowVIP={() => setShowVIP(true)}
            onShowDailyRewards={() => setShowDailyRewards(true)}
            onShowNotifications={() => setShowNotifications(true)}
          />
        )}
      </>
    );
  };

  return (
    <div className="mx-auto flex h-dvh max-w-md flex-col bg-background overflow-y-auto pb-20">
      {renderContent()}
      <DailyRewards open={showDailyRewards} onClose={() => setShowDailyRewards(false)} />
      <NotificationsView open={showNotifications} onClose={() => setShowNotifications(false)} />
      <IncomingCallOverlay />
      <BottomNav
        active={activeTab}
        onNavigate={handleNavigate}
        onSpeedDating={() => { setShowLive(false); setShowChallenges(false); setShowCrush(false); setShowSpeedDating(true); }}
        onChallenges={() => { setShowLive(false); setShowSpeedDating(false); setShowCrush(false); setShowChallenges(true); }}
        onLive={() => { setShowSpeedDating(false); setShowChallenges(false); setShowCrush(false); setShowLive(true); }}
        onCrush={() => { setShowSpeedDating(false); setShowChallenges(false); setShowLive(false); setShowCrush(true); }}
        onLikes={handleShowLikes}
        likesBadge={likesBadge}
      />
    </div>
  );
};

export default Index;
