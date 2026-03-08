import profile1 from "@/assets/profile-1.jpg";
import profile2 from "@/assets/profile-2.jpg";
import profile3 from "@/assets/profile-3.jpg";
import profile4 from "@/assets/profile-4.jpg";

export interface Profile {
  id: string;
  name: string;
  age: number;
  distance: string;
  bio: string;
  image: string;
  interests: string[];
  prompts: { question: string; answer: string }[];
  verified: boolean;
}

export const profiles: Profile[] = [
  {
    id: "1",
    name: "Sofia",
    age: 26,
    distance: "3 km away",
    bio: "Coffee lover. Sunset chaser. Dog mom.",
    image: profile1,
    interests: ["Travel", "Photography", "Yoga", "Coffee"],
    prompts: [
      { question: "A perfect first date", answer: "A cozy coffee shop, good conversation, and a walk through the city at golden hour." },
    ],
    verified: true,
  },
  {
    id: "2",
    name: "Lucas",
    age: 28,
    distance: "5 km away",
    bio: "Weekend hiker. Aspiring chef. Book nerd.",
    image: profile2,
    interests: ["Hiking", "Cooking", "Reading", "Music"],
    prompts: [
      { question: "I'm looking for", answer: "Someone who laughs at my terrible jokes and doesn't mind burnt pancakes." },
    ],
    verified: true,
  },
  {
    id: "3",
    name: "Amara",
    age: 24,
    distance: "1 km away",
    bio: "Art student. Vinyl collector. Night owl.",
    image: profile3,
    interests: ["Art", "Music", "Dancing", "Film"],
    prompts: [
      { question: "My simple pleasures", answer: "Rainy afternoons with a sketchbook and lo-fi beats." },
    ],
    verified: false,
  },
  {
    id: "4",
    name: "Ethan",
    age: 27,
    distance: "8 km away",
    bio: "Fitness enthusiast. Startup founder. Dog dad.",
    image: profile4,
    interests: ["Fitness", "Tech", "Travel", "Dogs"],
    prompts: [
      { question: "Best travel story", answer: "Got lost in Tokyo at 2am and found the best ramen shop of my life." },
    ],
    verified: true,
  },
];
