import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import BottomNav from "@/components/BottomNav";
import DiscoverView from "@/components/DiscoverView";
import NearbyView from "@/components/NearbyView";
import LikesView from "@/components/LikesView";
import MessagesView from "@/components/MessagesView";
import ProfileView from "@/components/ProfileView";
import ProfileVisitorsView from "@/components/ProfileVisitorsView";
import SavedProfilesView from "@/components/SavedProfilesView";
import PhotoUploadOnboarding from "@/components/PhotoUploadOnboarding";
import Auth from "./Auth";

const Index = () => {
  const { user, loading } = useAuth();
  const [activeTab, setActiveTab] = useState("discover");
  const [savedView, setSavedView] = useState<"favorites" | "bookmarks" | null>(null);
  const [showVisitors, setShowVisitors] = useState(false);
  const [needsOnboarding, setNeedsOnboarding] = useState<boolean | null>(null);

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
        />
      )}
      {activeTab === "nearby" && <NearbyView />}
      {activeTab === "likes" && <LikesView onShowVisitors={() => setShowVisitors(true)} />}
      {activeTab === "messages" && <MessagesView />}
      {activeTab === "profile" && <ProfileView />}
      <BottomNav active={activeTab} onNavigate={setActiveTab} />
    </div>
  );
};

export default Index;
