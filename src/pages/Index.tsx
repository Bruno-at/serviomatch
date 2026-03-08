import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import BottomNav from "@/components/BottomNav";
import DiscoverView from "@/components/DiscoverView";
import LiveView from "@/components/LiveView";
import LikesView from "@/components/LikesView";
import MessagesView from "@/components/MessagesView";
import ProfileView from "@/components/ProfileView";
import Auth from "./Auth";

const Index = () => {
  const { user, loading } = useAuth();
  const [activeTab, setActiveTab] = useState("discover");

  if (loading) {
    return (
      <div className="flex h-dvh items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!user) return <Auth />;

  return (
    <div className="mx-auto flex h-dvh max-w-md flex-col bg-background overflow-y-auto pb-20">
      {activeTab === "discover" && <DiscoverView />}
      {activeTab === "likes" && <LikesView />}
      {activeTab === "messages" && <MessagesView />}
      {activeTab === "profile" && <ProfileView />}
      <BottomNav active={activeTab} onNavigate={setActiveTab} />
    </div>
  );
};

export default Index;
