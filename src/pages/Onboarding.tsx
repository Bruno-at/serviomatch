import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Mail, ArrowRight, ArrowLeft, Heart, Users, MessageCircle, Sparkles,
  Camera, MapPin, Crown, ShieldCheck, Check, X, Plus, Loader2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import type { TablesInsert } from "@/integrations/supabase/types";

const TOTAL_STEPS = 10;

const INTENTS = [
  { id: "date", icon: "💖", title: "Here to Date", desc: "Meet people and explore romantic connections." },
  { id: "relationship", icon: "❤️", title: "Ready for a Relationship", desc: "Looking for a serious and committed relationship." },
  { id: "friends", icon: "👫", title: "Here to Get Friends", desc: "Make new friends and expand your social circle." },
  { id: "chat", icon: "💬", title: "Open to Chat", desc: "Meet and chat with interesting people." },
];

const GENDERS = ["Male", "Female", "Non-Binary", "Prefer Not To Say"];
const LOOKING = [
  { id: "Men", icon: "👨" },
  { id: "Women", icon: "👩" },
  { id: "Everyone", icon: "🌈" },
];
const CITIES = ["Kampala", "Entebbe", "Nairobi", "Kigali", "Dar es Salaam", "Lagos", "Accra", "Cape Town"];
const WELCOME_MESSAGES = [
  '💖 Someone is waiting to meet you',
  '✨ Your next great conversation starts here',
  '❤️ Meaningful connections begin with a hello',
  '🌟 Find people who match your vibe',
];

function calcAge(dob: string) {
  if (!dob) return 0;
  const d = new Date(dob);
  const diff = Date.now() - d.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25));
}

function getFirstIncompleteStep(progress: OnboardingProgress) {
  if (!progress.firstName?.trim() || !progress.lastName?.trim()) return 3;
  if (!progress.intents?.length) return 4;

  const dob = `${progress.year || ""}-${progress.month || ""}-${progress.day || ""}`;
  const age = calcAge(dob);
  if (!progress.day || !progress.month || !progress.year || age < 18 || age > 100) return 5;

  if (!progress.gender) return 6;
  if (!progress.lookingFor) return 7;
  if (!progress.photos?.length || (!progress.location && !progress.coords)) return 8;

  return 9;
}

interface Props {
  onComplete: () => void;
}

type OnboardingProgress = Partial<{
  firstName: string;
  lastName: string;
  intents: string[];
  day: string;
  month: string;
  year: string;
  gender: string;
  lookingFor: string;
  photos: string[];
  location: string;
  coords: { lat: number; lng: number } | null;
}>;

const Onboarding = ({ onComplete }: Props) => {
  const { user } = useAuth();
  const [step, setStep] = useState(user ? 3 : 1); // skip email step if already signed in
  const [loading, setLoading] = useState(false);
  const progressKey = user ? `onboarding_progress_${user.id}` : null;
  const [progressRestored, setProgressRestored] = useState(!user);

  // Step 1-2 (auth)
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");

  // Names
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");

  // Intents
  const [intents, setIntents] = useState<string[]>([]);

  // DOB
  const [day, setDay] = useState("");
  const [month, setMonth] = useState("");
  const [year, setYear] = useState("");

  // Gender / Looking
  const [gender, setGender] = useState("");
  const [lookingFor, setLookingFor] = useState("");

  // Photos & location
  const [photos, setPhotos] = useState<string[]>([]);
  const [location, setLocation] = useState("");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);

  // Welcome rotating message
  const [msgIdx, setMsgIdx] = useState(0);

  useEffect(() => {
    if (!user) { setProgressRestored(true); return; }

    let cancelled = false;
    setProgressRestored(false);

    const restoreProgress = async () => {
      const saved = progressKey ? localStorage.getItem(progressKey) : null;
      if (saved) {
        try {
          const parsed = JSON.parse(saved) as OnboardingProgress;
          if (cancelled) return;
          setFirstName(parsed.firstName || "");
          setLastName(parsed.lastName || "");
          setIntents(parsed.intents || []);
          setDay(parsed.day || "");
          setMonth(parsed.month || "");
          setYear(parsed.year || "");
          setGender(parsed.gender || "");
          setLookingFor(parsed.lookingFor || "");
          setPhotos(parsed.photos || []);
          setLocation(parsed.location || "");
          setCoords(parsed.coords || null);
          setStep(getFirstIncompleteStep(parsed));
          setProgressRestored(true);
          return;
        } catch {
          localStorage.removeItem(progressKey);
        }
      }

      const { data } = await supabase
        .from("profiles")
        .select("first_name, last_name, date_of_birth, gender, looking_for, dating_intents, photos, avatar_url, location, latitude, longitude")
        .eq("user_id", user.id)
        .maybeSingle();

      if (cancelled || !data) return;

      const restored: OnboardingProgress = {
        firstName: data.first_name || "",
        lastName: data.last_name || "",
        intents: data.dating_intents || [],
        gender: data.gender || "",
        lookingFor: data.looking_for || "",
        photos: data.photos?.length ? data.photos : data.avatar_url ? [data.avatar_url] : [],
        location: data.location || "",
        coords: data.latitude != null && data.longitude != null ? { lat: data.latitude, lng: data.longitude } : null,
      };

      if (data.date_of_birth) {
        const [savedYear, savedMonth, savedDay] = data.date_of_birth.split("-");
        restored.year = savedYear || "";
        restored.month = savedMonth || "";
        restored.day = savedDay || "";
      }

      setFirstName(restored.firstName || "");
      setLastName(restored.lastName || "");
      setIntents(restored.intents || []);
      setGender(restored.gender || "");
      setLookingFor(restored.lookingFor || "");
      setPhotos(restored.photos || []);
      setLocation(restored.location || "");
      setCoords(restored.coords || null);
      if (data.latitude != null && data.longitude != null) {
        setCoords({ lat: data.latitude, lng: data.longitude });
      }
      setYear(restored.year || "");
      setMonth(restored.month || "");
      setDay(restored.day || "");
      setStep(getFirstIncompleteStep(restored));
      setProgressRestored(true);
    };

    restoreProgress().finally(() => {
      if (!cancelled) setProgressRestored(true);
    });

    return () => { cancelled = true; };
  }, [progressKey, user]);

  useEffect(() => {
    if (!progressKey || !progressRestored) return;

    const progress: OnboardingProgress = {
      firstName,
      lastName,
      intents,
      day,
      month,
      year,
      gender,
      lookingFor,
      photos,
      location,
      coords,
    };

    localStorage.setItem(progressKey, JSON.stringify(progress));
  }, [coords, day, firstName, gender, intents, lastName, location, lookingFor, month, photos, progressKey, progressRestored, year]);

  useEffect(() => {
    if (step !== 9) return;
    const t = setInterval(() => setMsgIdx((i) => (i + 1) % WELCOME_MESSAGES.length), 2500);
    return () => clearInterval(t);
  }, [step]);

  // Sample profile photos for welcome screen
  const [samplePhotos, setSamplePhotos] = useState<string[]>([]);
  useEffect(() => {
    if (step !== 9) return;
    supabase.from("profiles").select("avatar_url").not("avatar_url", "is", null).limit(20)
      .then(({ data }) => {
        const urls = (data || []).map((d) => d.avatar_url as string).filter(Boolean);
        const shuffled = urls.sort(() => Math.random() - 0.5).slice(0, 4);
        setSamplePhotos(shuffled.length ? shuffled : [
          "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400",
          "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400",
          "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400",
          "https://images.unsplash.com/photo-1502823403499-6ccfcf4fb453?w=400",
        ]);
      });
  }, [step]);

  // ---- Step 1: send code ----
  const sendCode = async () => {
    if (!email.includes("@")) { toast.error("Enter a valid email"); return; }
    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin, shouldCreateUser: true },
    });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Verification code sent to your email");
    setStep(2);
  };

  // ---- Step 2: verify code ----
  const verifyCode = async () => {
    if (code.length !== 6) { toast.error("Enter the 6-digit code"); return; }
    setLoading(true);
    const { error } = await supabase.auth.verifyOtp({ email, token: code, type: "email" });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Email verified! 🎉");
    setStep(3);
  };

  // ---- Photo upload ----
  const fileInput = useRef<HTMLInputElement>(null);
  const uploadPhoto = async (file: File) => {
    if (!user) return;
    setLoading(true);
    const ext = file.name.split(".").pop();
    const path = `${user.id}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
    if (error) { toast.error(error.message); setLoading(false); return; }
    const { data: { publicUrl } } = supabase.storage.from("avatars").getPublicUrl(path);
    setPhotos((p) => [...p, publicUrl]);
    setLoading(false);
  };

  const requestLocation = () => {
    if (!navigator.geolocation) { toast.error("Geolocation not supported"); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocation("Current location");
        toast.success("Location captured");
      },
      () => toast.error("Could not get location"),
    );
  };

  // ---- Step 10: persist profile ----
  const finishOnboarding = async () => {
    if (!user) { toast.error("Not signed in"); return; }
    setLoading(true);
    const dob = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const age = calcAge(dob);
    const { error } = await supabase.from("profiles").upsert({
      user_id: user.id,
      first_name: firstName,
      last_name: lastName,
      display_name: `${firstName} ${lastName}`.trim() || firstName,
      date_of_birth: dob,
      age,
      gender,
      looking_for: lookingFor,
      dating_intents: intents,
      photos,
      avatar_url: photos[0] || null,
      location,
      latitude: coords?.lat ?? null,
      longitude: coords?.lng ?? null,
      photo_verification_pending: photos.length > 0,
      onboarding_completed: true,
      email_verified: true,
      profile_completed: true,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    if (progressKey) localStorage.removeItem(progressKey);
    toast.success("Welcome to Spark! 🔥");
    onComplete();
  };

  // ---- validation per step ----
  const canContinue = () => {
    switch (step) {
      case 1: return email.includes("@");
      case 2: return code.length === 6;
      case 3: return firstName.trim().length >= 2 && lastName.trim().length >= 1;
      case 4: return intents.length > 0;
      case 5: {
        const age = calcAge(`${year}-${month}-${day}`);
        return day && month && year && age >= 18 && age <= 100;
      }
      case 6: return !!gender;
      case 7: return !!lookingFor;
      case 8: return photos.length >= 1 && (location || coords);
      default: return true;
    }
  };

  const saveStepProgress = async (currentStep: number) => {
    if (!user || currentStep < 3 || currentStep > 8) return true;

    const displayName =
      `${firstName} ${lastName}`.trim() ||
      user.user_metadata?.display_name ||
      user.email?.split("@")[0] ||
      "";

    const update: TablesInsert<"profiles"> = {
      user_id: user.id,
      display_name: displayName,
      email_verified: !!user.email_confirmed_at,
      profile_completed: false,
      onboarding_completed: false,
      updated_at: new Date().toISOString(),
    };

    if (currentStep >= 3) {
      update.first_name = firstName;
      update.last_name = lastName;
    }
    if (currentStep >= 4) update.dating_intents = intents;
    if (currentStep >= 5) {
      const dob = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      update.date_of_birth = dob;
      update.age = calcAge(dob);
    }
    if (currentStep >= 6) update.gender = gender;
    if (currentStep >= 7) update.looking_for = lookingFor;
    if (currentStep >= 8) {
      update.photos = photos;
      update.avatar_url = photos[0] || null;
      update.location = location;
      update.latitude = coords?.lat ?? null;
      update.longitude = coords?.lng ?? null;
      update.photo_verification_pending = photos.length > 0;
    }

    const { error } = await supabase
      .from("profiles")
      .upsert(update, { onConflict: "user_id" });

    if (error) {
      toast.error(error.message);
      return false;
    }

    return true;
  };

  const next = async () => {
    if (step === 1) return sendCode();
    if (step === 2) return verifyCode();
    if (step === 10) return finishOnboarding();

    setLoading(true);
    const saved = await saveStepProgress(step);
    setLoading(false);
    if (!saved) return;

    setStep((s) => Math.min(s + 1, TOTAL_STEPS));
  };
  const back = () => setStep((s) => Math.max(s - 1, user ? 3 : 1));

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      {/* Progress */}
      <div className="sticky top-0 z-10 bg-background/80 backdrop-blur px-6 pt-6 pb-3">
        <div className="flex items-center gap-3">
          {step > (user ? 3 : 1) && step !== 2 && (
            <button onClick={back} className="rounded-full p-2 hover:bg-muted">
              <ArrowLeft className="h-4 w-4" />
            </button>
          )}
          <div className="flex-1">
            <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
              <span>Step {step} of {TOTAL_STEPS}</span>
              <span>{Math.round((step / TOTAL_STEPS) * 100)}%</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <motion.div
                className="h-full gradient-love"
                animate={{ width: `${(step / TOTAL_STEPS) * 100}%` }}
                transition={{ duration: 0.4 }}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-1 flex-col px-6 py-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.25 }}
            className="flex flex-1 flex-col"
          >
            {/* STEP 1: Email */}
            {step === 1 && (
              <div className="flex flex-1 flex-col">
                <div className="mb-8 flex h-14 w-14 items-center justify-center rounded-2xl gradient-love">
                  <Sparkles className="h-7 w-7 text-primary-foreground" />
                </div>
                <h1 className="text-3xl font-bold font-display">What's your email?</h1>
                <p className="mt-2 text-sm text-muted-foreground">We'll send you a 6-digit code to verify.</p>
                <div className="mt-8 relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    type="email" autoFocus value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full rounded-2xl bg-muted py-4 pl-12 pr-4 text-base outline-none focus:ring-2 focus:ring-primary/40"
                  />
                </div>
              </div>
            )}

            {/* STEP 2: Code */}
            {step === 2 && (
              <div className="flex flex-1 flex-col">
                <h1 className="text-3xl font-bold font-display">Check your email</h1>
                <p className="mt-2 text-sm text-muted-foreground">We sent a 6-digit code to <b>{email}</b></p>
                <input
                  type="text" inputMode="numeric" maxLength={6} autoFocus
                  value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                  placeholder="000000"
                  className="mt-8 w-full rounded-2xl bg-muted py-5 text-center text-3xl font-mono tracking-[0.5em] outline-none focus:ring-2 focus:ring-primary/40"
                />
                <button onClick={sendCode} className="mt-4 text-sm text-primary hover:underline self-start">
                  Resend code
                </button>
              </div>
            )}

            {/* STEP 3: Name */}
            {step === 3 && (
              <div className="flex flex-1 flex-col">
                <h1 className="text-3xl font-bold font-display">What's your name?</h1>
                <p className="mt-2 text-sm text-muted-foreground">This is how you'll appear on Spark.</p>
                <input
                  autoFocus value={firstName} onChange={(e) => setFirstName(e.target.value)}
                  placeholder="First name"
                  className="mt-8 w-full rounded-2xl bg-muted py-4 px-4 text-base outline-none focus:ring-2 focus:ring-primary/40"
                />
                <input
                  value={lastName} onChange={(e) => setLastName(e.target.value)}
                  placeholder="Last name"
                  className="mt-3 w-full rounded-2xl bg-muted py-4 px-4 text-base outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>
            )}

            {/* STEP 4: Intents */}
            {step === 4 && (
              <div className="flex flex-1 flex-col">
                <h1 className="text-3xl font-bold font-display">Tell us why you're here</h1>
                <p className="mt-2 text-sm text-muted-foreground">Select all that apply.</p>
                <div className="mt-6 grid gap-3">
                  {INTENTS.map((it) => {
                    const active = intents.includes(it.id);
                    return (
                      <button
                        key={it.id}
                        onClick={() => setIntents((p) => p.includes(it.id) ? p.filter((x) => x !== it.id) : [...p, it.id])}
                        className={`flex items-start gap-4 rounded-2xl border-2 p-4 text-left transition ${
                          active ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"
                        }`}
                      >
                        <span className="text-2xl">{it.icon}</span>
                        <div className="flex-1">
                          <div className="font-semibold">{it.title}</div>
                          <div className="text-xs text-muted-foreground">{it.desc}</div>
                        </div>
                        {active && <Check className="h-5 w-5 text-primary" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* STEP 5: DOB */}
            {step === 5 && (
              <div className="flex flex-1 flex-col">
                <h1 className="text-3xl font-bold font-display">When were you born?</h1>
                <p className="mt-2 text-sm text-muted-foreground">You must be at least 18.</p>
                <div className="mt-8 grid grid-cols-3 gap-3">
                  <input type="number" placeholder="DD" value={day} onChange={(e) => setDay(e.target.value)}
                    className="rounded-2xl bg-muted py-4 text-center text-lg outline-none focus:ring-2 focus:ring-primary/40" />
                  <input type="number" placeholder="MM" value={month} onChange={(e) => setMonth(e.target.value)}
                    className="rounded-2xl bg-muted py-4 text-center text-lg outline-none focus:ring-2 focus:ring-primary/40" />
                  <input type="number" placeholder="YYYY" value={year} onChange={(e) => setYear(e.target.value)}
                    className="rounded-2xl bg-muted py-4 text-center text-lg outline-none focus:ring-2 focus:ring-primary/40" />
                </div>
                {day && month && year && (
                  <p className="mt-4 text-sm text-muted-foreground">
                    Age: <b className="text-foreground">{calcAge(`${year}-${month}-${day}`)}</b>
                  </p>
                )}
              </div>
            )}

            {/* STEP 6: Gender */}
            {step === 6 && (
              <div className="flex flex-1 flex-col">
                <h1 className="text-3xl font-bold font-display">Select your gender</h1>
                <div className="mt-6 grid gap-3">
                  {GENDERS.map((g) => (
                    <button key={g} onClick={() => setGender(g)}
                      className={`rounded-2xl border-2 p-4 text-left font-medium transition ${
                        gender === g ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"
                      }`}>
                      {g}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* STEP 7: Looking for */}
            {step === 7 && (
              <div className="flex flex-1 flex-col">
                <h1 className="text-3xl font-bold font-display">I'd like to see</h1>
                <div className="mt-6 grid gap-3">
                  {LOOKING.map((l) => (
                    <button key={l.id} onClick={() => setLookingFor(l.id)}
                      className={`flex items-center gap-4 rounded-2xl border-2 p-4 text-left font-medium transition ${
                        lookingFor === l.id ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"
                      }`}>
                      <span className="text-2xl">{l.icon}</span> {l.id}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* STEP 8: Photos + location */}
            {step === 8 && (
              <div className="flex flex-1 flex-col">
                <h1 className="text-3xl font-bold font-display">Add photos</h1>
                <p className="mt-2 text-sm text-muted-foreground">Your first photo will be your profile picture.</p>
                <div className="mt-6 grid grid-cols-3 gap-3">
                  {photos.map((url, i) => (
                    <div key={url} className="relative aspect-square overflow-hidden rounded-xl bg-muted">
                      <img src={url} alt="" className="h-full w-full object-cover" />
                      {i === 0 && <div className="absolute left-1 top-1 rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold text-primary-foreground">Main</div>}
                      <button onClick={() => setPhotos((p) => p.filter((u) => u !== url))}
                        className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white">
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                  {photos.length < 6 && (
                    <button onClick={() => fileInput.current?.click()}
                      className="flex aspect-square items-center justify-center rounded-xl border-2 border-dashed border-border hover:border-primary">
                      {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Plus className="h-5 w-5 text-muted-foreground" />}
                    </button>
                  )}
                </div>
                <input ref={fileInput} type="file" accept="image/*" hidden
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadPhoto(f); e.target.value = ""; }} />

                <h2 className="mt-8 text-xl font-bold font-display">Where are you?</h2>
                <button onClick={requestLocation}
                  className={`mt-3 flex items-center gap-3 rounded-2xl border-2 p-4 text-left ${
                    coords ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"
                  }`}>
                  <MapPin className="h-5 w-5 text-primary" />
                  <div className="flex-1">
                    <div className="font-semibold">Share current location</div>
                    <div className="text-xs text-muted-foreground">Use device GPS</div>
                  </div>
                  {coords && <Check className="h-5 w-5 text-primary" />}
                </button>
                <div className="mt-3">
                  <div className="text-xs text-muted-foreground mb-2">Or pick a city</div>
                  <div className="flex flex-wrap gap-2">
                    {CITIES.map((c) => (
                      <button key={c} onClick={() => { setLocation(c); setCoords(null); }}
                        className={`rounded-full px-3 py-1.5 text-sm border ${
                          location === c ? "border-primary bg-primary text-primary-foreground" : "border-border"
                        }`}>{c}</button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* STEP 9 (renumbered as 7 in spec but kept order): Welcome experience */}
            {/* We treat step 9 = Welcome, 10 = Verify+Premium combined for brevity */}
            {step === 9 && (
              <div className="flex flex-1 flex-col items-center text-center">
                <div className="grid grid-cols-2 gap-3">
                  {samplePhotos.map((p, i) => (
                    <motion.img key={p + i} src={p} alt=""
                      initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: i * 0.1 }}
                      className="h-32 w-32 rounded-2xl object-cover shadow-lg" />
                  ))}
                </div>
                <h1 className="mt-8 text-3xl font-bold font-display">Welcome, {firstName}!</h1>
                <AnimatePresence mode="wait">
                  <motion.p key={msgIdx}
                    initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                    className="mt-3 text-base text-muted-foreground">
                    {WELCOME_MESSAGES[msgIdx]}
                  </motion.p>
                </AnimatePresence>

                <div className="mt-10 w-full rounded-2xl border-2 border-border p-5">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                      <ShieldCheck className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 text-left">
                      <div className="font-semibold flex items-center gap-2">
                        Photo Verification
                        {photos.length > 0 && <Check className="h-4 w-4 text-green-500" />}
                      </div>
                      <div className="text-xs text-muted-foreground">Pending review · Builds trust, boosts visibility & matches</div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* STEP 10: Premium */}
            {step === 10 && (
              <div className="flex flex-1 flex-col">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full gradient-love">
                  <Crown className="h-8 w-8 text-primary-foreground" />
                </div>
                <h1 className="mt-6 text-center text-3xl font-bold font-display">Start strong with Premium</h1>
                <p className="mt-2 text-center text-sm text-muted-foreground">Unlock the full Spark experience</p>
                <div className="mt-6 space-y-3">
                  {[
                    "See who liked you",
                    "Unlimited likes",
                    "Boost profile visibility",
                    "Advanced filters",
                    "Priority matching",
                  ].map((b) => (
                    <div key={b} className="flex items-center gap-3 rounded-xl bg-muted/50 px-4 py-3">
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10">
                        <Check className="h-3.5 w-3.5 text-primary" />
                      </div>
                      <span className="text-sm font-medium">{b}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Footer CTA */}
      <div className="sticky bottom-0 bg-background/90 backdrop-blur px-6 py-4">
        {step === 10 ? (
          <div className="space-y-2">
            <motion.button whileTap={{ scale: 0.97 }} onClick={finishOnboarding} disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-2xl gradient-love py-4 font-semibold text-primary-foreground shadow-card disabled:opacity-50">
              <Crown className="h-4 w-4" /> Subscribe
            </motion.button>
            <button onClick={finishOnboarding} disabled={loading}
              className="w-full rounded-2xl py-3 text-sm font-medium text-muted-foreground hover:text-foreground">
              Maybe later
            </button>
          </div>
        ) : (
          <motion.button whileTap={{ scale: 0.97 }} onClick={next} disabled={!canContinue() || loading}
            className="flex w-full items-center justify-center gap-2 rounded-2xl gradient-love py-4 font-semibold text-primary-foreground shadow-card disabled:opacity-40">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : (
              <>Continue <ArrowRight className="h-4 w-4" /></>
            )}
          </motion.button>
        )}
      </div>
    </div>
  );
};

export default Onboarding;
