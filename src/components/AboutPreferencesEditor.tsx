import { useState } from "react";
import { Check, Edit3, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";
import {
  GOALS, SEXUALITIES, STAR_SIGNS, LANGUAGES, CHILDREN_OPTIONS,
  PETS_OPTIONS, SMOKING, DRINKING, EDUCATION, RELATIONSHIP_STATUS,
  RELIGION, OCCUPATION, FITNESS, DIET, INTERESTS, SLEEP_SCHEDULE,
  ETHNICITY, PERSONALITY,
} from "@/lib/filterOptions";

type Profile = Tables<"profiles">;

interface Props {
  profile: Profile;
  onUpdate: (p: Profile) => void;
}

const GENDERS = ["Male", "Female", "Non-binary", "Other"] as const;
const LOOKING_FOR = ["Men", "Women", "Everyone"] as const;

type FieldType = "text" | "number" | "select" | "multiselect";

interface FieldDef {
  key: keyof Profile | string;
  label: string;
  icon: string;
  type: FieldType;
  options?: readonly string[];
  placeholder?: string;
  suffix?: string;
}

interface SectionDef {
  title: string;
  icon: string;
  fields: FieldDef[];
}

const SECTIONS: SectionDef[] = [
  {
    title: "Basic Information",
    icon: "📋",
    fields: [
      { key: "height_cm", label: "Height", icon: "📏", type: "number", placeholder: "e.g. 175", suffix: "cm" },
      { key: "country", label: "Country", icon: "🌍", type: "text", placeholder: "e.g. Uganda" },
      { key: "city", label: "City", icon: "🏙️", type: "text", placeholder: "e.g. Kampala" },
      { key: "languages", label: "Languages Spoken", icon: "🗣️", type: "multiselect", options: LANGUAGES },
      { key: "occupation", label: "Occupation", icon: "💼", type: "select", options: OCCUPATION },
      { key: "education", label: "Education", icon: "🎓", type: "select", options: EDUCATION },
      { key: "looking_for", label: "Who I'd Like to See", icon: "👀", type: "select", options: LOOKING_FOR },
      { key: "dating_intents", label: "Goals / Here For", icon: "🎯", type: "multiselect", options: GOALS },
      { key: "sexuality", label: "Sexuality", icon: "🌈", type: "select", options: SEXUALITIES },
      { key: "gender", label: "Gender", icon: "⚧️", type: "select", options: GENDERS },
    ],
  },
  {
    title: "Lifestyle",
    icon: "🌿",
    fields: [
      { key: "religion", label: "Religion", icon: "🙏", type: "select", options: RELIGION },
      { key: "relationship_status", label: "Relationship Status", icon: "💍", type: "select", options: RELATIONSHIP_STATUS },
      { key: "children", label: "Children", icon: "👶", type: "select", options: CHILDREN_OPTIONS },
      { key: "pets", label: "Pets", icon: "🐾", type: "multiselect", options: PETS_OPTIONS },
      { key: "smoking", label: "Smoking", icon: "🚬", type: "select", options: SMOKING },
      { key: "drinking", label: "Drinking", icon: "🍷", type: "select", options: DRINKING },
      { key: "fitness", label: "Exercise", icon: "💪", type: "select", options: FITNESS },
      { key: "diet", label: "Diet", icon: "🥗", type: "select", options: DIET },
      { key: "sleep_schedule", label: "Sleeping Schedule", icon: "🌙", type: "select", options: SLEEP_SCHEDULE },
    ],
  },
  {
    title: "Personality",
    icon: "✨",
    fields: [
      { key: "personality_traits", label: "Personality Type", icon: "🧠", type: "multiselect", options: PERSONALITY },
      { key: "interests", label: "Interests & Hobbies", icon: "🎨", type: "multiselect", options: INTERESTS },
      { key: "star_sign", label: "Star Sign", icon: "⭐", type: "select", options: STAR_SIGNS },
      { key: "ethnicity", label: "Ethnicity (Optional)", icon: "🌐", type: "select", options: ETHNICITY },
    ],
  },
];

const formatValue = (field: FieldDef, value: unknown): string => {
  if (value === null || value === undefined || value === "") return "Not set";
  if (Array.isArray(value)) return value.length === 0 ? "Not set" : value.join(", ");
  if (field.suffix) return `${value} ${field.suffix}`;
  return String(value);
};

const FieldEditor = ({
  field, value, onSave, onCancel,
}: {
  field: FieldDef;
  value: unknown;
  onSave: (next: unknown) => Promise<void>;
  onCancel: () => void;
}) => {
  const [draft, setDraft] = useState<unknown>(value ?? (field.type === "multiselect" ? [] : ""));
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    let next: unknown = draft;
    if (field.type === "number") {
      const n = draft === "" || draft === null ? null : Number(draft);
      next = n !== null && !Number.isNaN(n) ? n : null;
    }
    if (field.type === "text" && typeof draft === "string") {
      next = draft.trim() || null;
    }
    await onSave(next);
    setSaving(false);
  };

  if (field.type === "multiselect") {
    const selected = (draft as string[]) || [];
    return (
      <div className="space-y-3">
        <div className="flex flex-wrap gap-1.5">
          {field.options!.map((opt) => {
            const active = selected.includes(opt);
            return (
              <button
                key={opt}
                onClick={() =>
                  setDraft(active ? selected.filter((s) => s !== opt) : [...selected, opt])
                }
                className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                  active
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-primary/10"
                }`}
              >
                {opt}
              </button>
            );
          })}
        </div>
        <Actions saving={saving} onSave={handleSave} onCancel={onCancel} />
      </div>
    );
  }

  if (field.type === "select") {
    return (
      <div className="space-y-3">
        <div className="flex flex-wrap gap-1.5">
          {field.options!.map((opt) => (
            <button
              key={opt}
              onClick={() => setDraft(opt)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                draft === opt
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-primary/10"
              }`}
            >
              {opt}
            </button>
          ))}
        </div>
        <Actions saving={saving} onSave={handleSave} onCancel={onCancel} />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <input
        type={field.type === "number" ? "number" : "text"}
        value={(draft as string | number) ?? ""}
        onChange={(e) => setDraft(e.target.value)}
        placeholder={field.placeholder}
        className="w-full rounded-xl bg-muted py-2.5 px-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary/30"
      />
      <Actions saving={saving} onSave={handleSave} onCancel={onCancel} />
    </div>
  );
};

const Actions = ({ saving, onSave, onCancel }: { saving: boolean; onSave: () => void; onCancel: () => void }) => (
  <div className="flex gap-2">
    <button
      onClick={onSave}
      disabled={saving}
      className="flex-1 rounded-xl gradient-love py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50"
    >
      {saving ? "Saving..." : "Save"}
    </button>
    <button
      onClick={onCancel}
      disabled={saving}
      className="rounded-xl bg-muted px-4 py-2 text-xs font-semibold text-muted-foreground"
    >
      Cancel
    </button>
  </div>
);

const AboutPreferencesEditor = ({ profile, onUpdate }: Props) => {
  const { user } = useAuth();
  const [editingKey, setEditingKey] = useState<string | null>(null);

  const saveField = async (field: FieldDef, value: unknown) => {
    if (!user) return;
    const { data, error } = await supabase
      .from("profiles")
      .update({ [field.key as string]: value as never })
      .eq("user_id", user.id)
      .select()
      .single();
    if (error) {
      toast.error(`Failed to update ${field.label}`);
      return;
    }
    toast.success(`${field.label} updated`);
    onUpdate(data);
    setEditingKey(null);
  };

  return (
    <div className="w-full space-y-5">
      <div>
        <h2 className="text-base font-bold font-display text-foreground">About Me & Preferences</h2>
        <p className="text-xs text-muted-foreground">Edit anything — changes save instantly and update your Discover results.</p>
      </div>

      {SECTIONS.map((section) => (
        <div key={section.title} className="rounded-2xl bg-card shadow-card overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-border/50">
            <span className="text-base">{section.icon}</span>
            <h3 className="text-sm font-semibold text-foreground">{section.title}</h3>
          </div>
          <div className="divide-y divide-border/40">
            {section.fields.map((field) => {
              const key = field.key as string;
              const value = (profile as Record<string, unknown>)[key];
              const isEditing = editingKey === key;
              const isEmpty = value === null || value === undefined || value === "" ||
                (Array.isArray(value) && value.length === 0);
              return (
                <div key={key} className="px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className="text-xs">{field.icon}</span>
                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                          {field.label}
                        </span>
                      </div>
                      {!isEditing && (
                        <p className={`text-sm ${isEmpty ? "text-muted-foreground italic" : "text-foreground font-medium"} break-words`}>
                          {formatValue(field, value)}
                        </p>
                      )}
                    </div>
                    {!isEditing && (
                      <button
                        onClick={() => setEditingKey(key)}
                        className="flex items-center gap-1 rounded-full bg-muted hover:bg-primary/10 px-2.5 py-1 text-[10px] font-semibold text-muted-foreground hover:text-primary transition"
                      >
                        <Edit3 className="h-3 w-3" /> Edit
                      </button>
                    )}
                  </div>
                  {isEditing && (
                    <div className="mt-3">
                      <FieldEditor
                        field={field}
                        value={value}
                        onSave={(v) => saveField(field, v)}
                        onCancel={() => setEditingKey(null)}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
};

/** Compute % of editable About fields filled in (used for the completion ring). */
export function computeAboutCompleteness(profile: Profile): number {
  let total = 0;
  let filled = 0;
  for (const section of SECTIONS) {
    for (const field of section.fields) {
      total += 1;
      const v = (profile as Record<string, unknown>)[field.key as string];
      const empty = v === null || v === undefined || v === "" ||
        (Array.isArray(v) && v.length === 0);
      if (!empty) filled += 1;
    }
  }
  // Include core basics too: photos, bio, display_name
  const coreFields: Array<keyof Profile> = ["display_name", "bio", "age"];
  for (const k of coreFields) {
    total += 1;
    const v = profile[k];
    if (v !== null && v !== undefined && v !== "") filled += 1;
  }
  total += 1;
  const photos = (profile as unknown as { photos?: string[] }).photos;
  if ((photos && photos.length > 0) || profile.avatar_url) filled += 1;

  return Math.round((filled / total) * 100);
}

export default AboutPreferencesEditor;
