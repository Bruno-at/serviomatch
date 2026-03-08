import { useState } from "react";
import BottomNav from "@/components/BottomNav";
import DiscoverView from "@/components/DiscoverView";
import LikesView from "@/components/LikesView";
import MessagesView from "@/components/MessagesView";
import ProfileView from "@/components/ProfileView";

const Index = () => {
  const [activeTab, setActiveTab] = useState("discover");

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
