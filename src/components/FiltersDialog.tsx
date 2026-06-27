import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, X, RotateCcw, Sparkles } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DEFAULT_FILTERS, type DiscoverFilters, type GenderPref,
  CONTINENTS, SEXUALITIES, GOALS, STAR_SIGNS, LANGUAGES,
  CHILDREN_OPTIONS, PETS_OPTIONS, SMOKING, DRINKING, EDUCATION,
  RELATIONSHIP_STATUS, RELIGION, OCCUPATION, FITNESS, DIET,
  INTERESTS, SLEEP_SCHEDULE, ETHNICITY, PERSONALITY, countActiveFilters,
} from "@/lib/filterOptions";

interface FiltersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial: DiscoverFilters;
  onApply: (next: DiscoverFilters) => void;
  matchCount?: number | null;
}

function Section({
  title, icon, defaultOpen = false, children,
}: { title: string; icon: string; defaultOpen?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-4 py-3"
      >
        <span className="flex items-center gap-2 text-sm font-semibold">
          <span className="text-lg leading-none">{icon}</span> {title}
        </span>
        <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden"
          >
            <div className="space-y-4 px-4 pb-4">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Chips<T extends string>({
  label, options, value, onChange,
}: { label: string; options: readonly T[]; value: T[]; onChange: (v: T[]) => void }) {
  const toggle = (opt: T) => {
    onChange(value.includes(opt) ? value.filter((v) => v !== opt) : [...value, opt]);
  };
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{label}</label>
        {value.length > 0 && (
          <button onClick={() => onChange([])} className="text-[10px] text-muted-foreground hover:text-foreground">
            Clear
          </button>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {options.map((opt) => {
          const active = value.includes(opt);
          return (
            <button
              key={opt}
              type="button"
              onClick={() => toggle(opt)}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-all ${
                active
                  ? "bg-foreground text-background border-foreground"
                  : "bg-transparent text-muted-foreground border-border hover:text-foreground"
              }`}
            >
              {opt}
            </button>
          );
        })}
      </div>
    </div>
  );
}

const FiltersDialog = ({ open, onOpenChange, initial, onApply, matchCount }: FiltersDialogProps) => {
  const [draft, setDraft] = useState<DiscoverFilters>(initial);
  useEffect(() => { if (open) setDraft(initial); }, [open, initial]);

  const update = <K extends keyof DiscoverFilters>(key: K, val: DiscoverFilters[K]) =>
    setDraft((d) => ({ ...d, [key]: val }));

  const active = countActiveFilters(draft);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-0 gap-0 max-h-[90vh] flex flex-col">
        <DialogHeader className="px-5 pt-5 pb-3 border-b border-border">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-xl font-bold font-display">Filters</DialogTitle>
            <button onClick={() => onOpenChange(false)} className="rounded-full p-1 hover:bg-muted">
              <X className="h-4 w-4" />
            </button>
          </div>
          <DialogDescription className="text-xs">
            {active > 0 ? `${active} active filter${active === 1 ? "" : "s"}` : "Refine your discovery feed"}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto scrollbar-hide px-4 py-4 space-y-3">
          {/* Quick Basics */}
          <Section title="Basics" icon="✨" defaultOpen>
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Distance</label>
                <span className="text-xs text-muted-foreground">{draft.maxDistance} km</span>
              </div>
              <Slider value={[draft.maxDistance]} min={1} max={500} step={1}
                onValueChange={(v) => update("maxDistance", v[0])} />
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Age</label>
                <span className="text-xs text-muted-foreground">{draft.ageRange[0]} – {draft.ageRange[1]}</span>
              </div>
              <Slider value={draft.ageRange} min={18} max={70} step={1} minStepsBetweenThumbs={1}
                onValueChange={(v) => update("ageRange", [v[0], v[1]] as [number, number])} />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">Show me</label>
              <div className="grid grid-cols-4 gap-2">
                {(["all", "female", "male", "other"] as GenderPref[]).map((g) => (
                  <button key={g} onClick={() => update("gender", g)}
                    className={`rounded-full py-1.5 text-xs font-semibold border capitalize transition-all ${
                      draft.gender === g
                        ? "bg-foreground text-background border-foreground"
                        : "bg-transparent text-muted-foreground border-border hover:text-foreground"
                    }`}>
                    {g}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold">Online only</p>
                <p className="text-xs text-muted-foreground">Active in the last 2 minutes</p>
              </div>
              <Switch checked={draft.onlineOnly} onCheckedChange={(c) => update("onlineOnly", c)} />
            </div>
          </Section>

          <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground pt-2 px-1">Popular Filters</h3>

          <Section title="Country & Region" icon="📍" defaultOpen>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">Country</label>
              <Input
                placeholder="e.g. Nigeria, Kenya, Ghana"
                value={draft.country ?? ""}
                onChange={(e) => update("country", e.target.value || null)}
              />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">Continent</label>
              <div className="flex flex-wrap gap-1.5">
                {CONTINENTS.map((c) => {
                  const active = draft.continent === c;
                  return (
                    <button key={c} onClick={() => update("continent", active ? null : c)}
                      className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-all ${
                        active ? "bg-foreground text-background border-foreground"
                          : "bg-transparent text-muted-foreground border-border hover:text-foreground"
                      }`}>
                      {c}
                    </button>
                  );
                })}
              </div>
            </div>
          </Section>

          <Section title="Height" icon="📏">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Range</label>
              <span className="text-xs text-muted-foreground">{draft.heightRange[0]} – {draft.heightRange[1]} cm</span>
            </div>
            <Slider value={draft.heightRange} min={140} max={220} step={1} minStepsBetweenThumbs={1}
              onValueChange={(v) => update("heightRange", [v[0], v[1]] as [number, number])} />
          </Section>

          <Section title="Sexuality" icon="🌈">
            <Chips label="Select all that apply" options={SEXUALITIES} value={draft.sexuality} onChange={(v) => update("sexuality", v)} />
          </Section>

          <Section title="Goals / Here For" icon="💖">
            <Chips label="Looking for" options={GOALS} value={draft.goals} onChange={(v) => update("goals", v)} />
          </Section>

          <Section title="Star Sign" icon="♈">
            <Chips label="Zodiac" options={STAR_SIGNS} value={draft.starSigns} onChange={(v) => update("starSigns", v)} />
          </Section>

          <Section title="Languages" icon="🌍">
            <Chips label="Spoken languages" options={LANGUAGES} value={draft.languages} onChange={(v) => update("languages", v)} />
          </Section>

          <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground pt-2 px-1">Lifestyle</h3>

          <Section title="Children" icon="👶">
            <Chips label="Family plans" options={CHILDREN_OPTIONS} value={draft.children} onChange={(v) => update("children", v)} />
          </Section>
          <Section title="Pets" icon="🐶">
            <Chips label="Pet preferences" options={PETS_OPTIONS} value={draft.pets} onChange={(v) => update("pets", v)} />
          </Section>
          <Section title="Smoking" icon="🚭">
            <Chips label="Smoking habits" options={SMOKING} value={draft.smoking} onChange={(v) => update("smoking", v)} />
          </Section>
          <Section title="Drinking" icon="🍷">
            <Chips label="Drinking habits" options={DRINKING} value={draft.drinking} onChange={(v) => update("drinking", v)} />
          </Section>
          <Section title="Education" icon="🎓">
            <Chips label="Highest level" options={EDUCATION} value={draft.education} onChange={(v) => update("education", v)} />
          </Section>
          <Section title="Relationship Status" icon="💍">
            <Chips label="Current status" options={RELATIONSHIP_STATUS} value={draft.relationshipStatus} onChange={(v) => update("relationshipStatus", v)} />
          </Section>
          <Section title="Religion" icon="🙏">
            <Chips label="Beliefs" options={RELIGION} value={draft.religion} onChange={(v) => update("religion", v)} />
          </Section>
          <Section title="Occupation" icon="💼">
            <Chips label="Work" options={OCCUPATION} value={draft.occupation} onChange={(v) => update("occupation", v)} />
          </Section>
          <Section title="Fitness & Exercise" icon="🏃">
            <Chips label="Activity level" options={FITNESS} value={draft.fitness} onChange={(v) => update("fitness", v)} />
          </Section>
          <Section title="Diet" icon="🥗">
            <Chips label="Diet" options={DIET} value={draft.diet} onChange={(v) => update("diet", v)} />
          </Section>
          <Section title="Interests & Hobbies" icon="🎨">
            <Chips label="Pick what you love" options={INTERESTS} value={draft.interests} onChange={(v) => update("interests", v)} />
          </Section>
          <Section title="Sleep Schedule" icon="🌙">
            <Chips label="When are you up?" options={SLEEP_SCHEDULE} value={draft.sleepSchedule} onChange={(v) => update("sleepSchedule", v)} />
          </Section>
          <Section title="Ethnicity (optional)" icon="🌍">
            <Chips label="Background" options={ETHNICITY} value={draft.ethnicity} onChange={(v) => update("ethnicity", v)} />
          </Section>

          <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground pt-2 px-1">Personality</h3>
          <Section title="Personality Traits" icon="🧠" defaultOpen>
            <Chips label="Who they are" options={PERSONALITY} value={draft.personality} onChange={(v) => update("personality", v)} />
          </Section>
        </div>

        <DialogFooter className="border-t border-border px-4 py-3 flex-row gap-2 sm:gap-2 sm:justify-stretch">
          <Button variant="ghost" size="sm" onClick={() => setDraft(DEFAULT_FILTERS)} className="gap-1">
            <RotateCcw className="h-3.5 w-3.5" /> Reset
          </Button>
          <Button variant="outline" size="sm" className="flex-1" onClick={() => onApply(DEFAULT_FILTERS)}>
            Clear All
          </Button>
          <Button size="sm" className="flex-1 gap-1" onClick={() => onApply(draft)}>
            <Sparkles className="h-3.5 w-3.5" />
            Apply{typeof matchCount === "number" ? ` (${matchCount})` : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default FiltersDialog;
