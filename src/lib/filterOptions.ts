// Catalogues for the Discover filter system.

export const CONTINENTS = [
  "Africa",
  "Europe",
  "Asia",
  "North America",
  "South America",
  "Australia/Oceania",
  "Antarctica",
] as const;

export const SEXUALITIES = [
  "Straight",
  "Gay",
  "Lesbian",
  "Bisexual",
  "Pansexual",
  "Asexual",
  "Prefer not to say",
] as const;

export const GOALS = [
  "Here to Date",
  "Ready for a Relationship",
  "Here to Make Friends",
  "Open to Chat",
  "Casual Dating",
  "Marriage",
  "Networking",
] as const;

export const STAR_SIGNS = [
  "Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo",
  "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces",
] as const;

export const LANGUAGES = [
  "English", "French", "Spanish", "Portuguese", "Arabic", "Swahili",
  "Yoruba", "Hausa", "Igbo", "Zulu", "Amharic", "Hindi", "Mandarin",
  "German", "Italian", "Russian", "Japanese", "Korean", "Turkish",
] as const;

export const CHILDREN_OPTIONS = [
  "Would like children someday",
  "Already has children",
  "Doesn't want children",
  "Open to either",
  "Prefer not to say",
] as const;

export const PETS_OPTIONS = [
  "Dog lover", "Cat lover", "Has pets", "Wants pets", "Doesn't like pets", "No pets",
] as const;

export const SMOKING = ["Never", "Occasionally", "Social smoker", "Regular smoker"] as const;
export const DRINKING = ["Never", "Occasionally", "Socially", "Frequently"] as const;

export const EDUCATION = [
  "High School", "Certificate", "Diploma", "Bachelor's Degree",
  "Master's Degree", "Doctorate", "Other",
] as const;

export const RELATIONSHIP_STATUS = [
  "Single", "Divorced", "Widowed", "Separated", "Prefer not to say",
] as const;

export const RELIGION = [
  "Christian", "Catholic", "Protestant", "Anglican", "Pentecostal",
  "Muslim", "Hindu", "Buddhist", "Jewish", "Traditional Religion",
  "Spiritual but not Religious", "Atheist", "Agnostic", "Other", "Prefer not to say",
] as const;

export const OCCUPATION = [
  "Student", "Teacher", "Engineer", "Doctor", "Nurse", "Lawyer",
  "Business Owner", "Entrepreneur", "Software Developer", "Accountant",
  "Farmer", "Government Employee", "Self-employed", "Other",
] as const;

export const FITNESS = [
  "Every day", "Several times a week", "Occasionally", "Rarely", "Never",
] as const;

export const DIET = [
  "No Preference", "Vegetarian", "Vegan", "Halal", "Kosher",
  "Pescatarian", "Gluten-Free", "Other",
] as const;

export const INTERESTS = [
  "Traveling", "Music", "Movies", "Reading", "Football", "Basketball",
  "Gym", "Swimming", "Hiking", "Photography", "Cooking", "Dancing",
  "Gaming", "Technology", "Fashion", "Art", "Business", "Volunteering",
  "Nature", "Pets",
] as const;

export const SLEEP_SCHEDULE = ["Early Bird", "Night Owl", "Flexible"] as const;

export const ETHNICITY = [
  "African", "Asian", "European", "Middle Eastern",
  "Hispanic / Latino", "Mixed", "Other", "Prefer not to say",
] as const;

export const PERSONALITY = [
  "Introvert", "Extrovert", "Ambivert", "Adventurous", "Romantic",
  "Funny", "Calm", "Creative", "Confident", "Family Oriented",
  "Spiritual", "Hardworking", "Athletic", "Traveler", "Music Lover", "Food Lover",
] as const;

export type GenderPref = "all" | "male" | "female" | "other";

export interface DiscoverFilters {
  maxDistance: number;
  ageRange: [number, number];
  gender: GenderPref;
  onlineOnly: boolean;

  // Popular
  country: string | null;
  continent: string | null;
  heightRange: [number, number];
  sexuality: string[];
  goals: string[];
  starSigns: string[];
  languages: string[];

  // Lifestyle
  children: string[];
  pets: string[];
  smoking: string[];
  drinking: string[];
  education: string[];
  relationshipStatus: string[];
  religion: string[];
  occupation: string[];
  fitness: string[];
  diet: string[];
  interests: string[];
  sleepSchedule: string[];
  ethnicity: string[];

  // Personality
  personality: string[];
}

export const DEFAULT_FILTERS: DiscoverFilters = {
  maxDistance: 50,
  ageRange: [18, 45],
  gender: "all",
  onlineOnly: false,
  country: null,
  continent: null,
  heightRange: [150, 210],
  sexuality: [],
  goals: [],
  starSigns: [],
  languages: [],
  children: [],
  pets: [],
  smoking: [],
  drinking: [],
  education: [],
  relationshipStatus: [],
  religion: [],
  occupation: [],
  fitness: [],
  diet: [],
  interests: [],
  sleepSchedule: [],
  ethnicity: [],
  personality: [],
};

export function countActiveFilters(f: DiscoverFilters): number {
  let n = 0;
  if (f.maxDistance !== DEFAULT_FILTERS.maxDistance) n++;
  if (f.ageRange[0] !== DEFAULT_FILTERS.ageRange[0] || f.ageRange[1] !== DEFAULT_FILTERS.ageRange[1]) n++;
  if (f.gender !== "all") n++;
  if (f.onlineOnly) n++;
  if (f.country) n++;
  if (f.continent) n++;
  if (f.heightRange[0] !== DEFAULT_FILTERS.heightRange[0] || f.heightRange[1] !== DEFAULT_FILTERS.heightRange[1]) n++;
  const arrs: (keyof DiscoverFilters)[] = [
    "sexuality","goals","starSigns","languages","children","pets","smoking","drinking",
    "education","relationshipStatus","religion","occupation","fitness","diet","interests",
    "sleepSchedule","ethnicity","personality",
  ];
  for (const k of arrs) {
    const v = f[k] as string[];
    if (Array.isArray(v) && v.length > 0) n++;
  }
  return n;
}
