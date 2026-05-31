// Profile setup page — collect user background and job search preferences

// AUTH NOTE: profile_id is currently generated with
// crypto.randomUUID() for V1 testing.
// Before production: replace with supabase.auth.getUser().id
// and ensure RLS policies match auth.uid()

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface ExperienceEntry {
  title: string;
  description: string;
  skills: string;
  metrics: string;
  date_range: string;
}

function blankEntry(): ExperienceEntry {
  return { title: "", description: "", skills: "", metrics: "", date_range: "" };
}

function splitCsv(s: string): string[] {
  return s.split(",").map((x) => x.trim()).filter(Boolean);
}

function EntryForm({
  entry,
  index,
  label,
  onChange,
  onRemove,
  showRemove,
}: {
  entry: ExperienceEntry;
  index: number;
  label: string;
  onChange: (field: keyof ExperienceEntry, value: string) => void;
  onRemove: () => void;
  showRemove: boolean;
}) {
  return (
    <div style={{ border: "1px solid #ccc", borderRadius: 6, padding: 16, marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
        <strong>
          {label} {index + 1}
        </strong>
        {showRemove && (
          <button type="button" onClick={onRemove}>
            Remove
          </button>
        )}
      </div>
      <label>
        Title *
        <input
          value={entry.title}
          onChange={(e) => onChange("title", e.target.value)}
          required
          style={{ display: "block", width: "100%", marginTop: 4, marginBottom: 10 }}
        />
      </label>
      <label>
        Description
        <textarea
          value={entry.description}
          onChange={(e) => onChange("description", e.target.value)}
          rows={3}
          style={{ display: "block", width: "100%", marginTop: 4, marginBottom: 10 }}
        />
      </label>
      <label>
        Skills (comma-separated)
        <input
          value={entry.skills}
          onChange={(e) => onChange("skills", e.target.value)}
          placeholder="e.g. React, TypeScript, Node.js"
          style={{ display: "block", width: "100%", marginTop: 4, marginBottom: 10 }}
        />
      </label>
      <label>
        Metrics (comma-separated)
        <input
          value={entry.metrics}
          onChange={(e) => onChange("metrics", e.target.value)}
          placeholder="e.g. Reduced latency by 40%, Grew team from 3 to 8"
          style={{ display: "block", width: "100%", marginTop: 4, marginBottom: 10 }}
        />
      </label>
      <label>
        Date Range
        <input
          value={entry.date_range}
          onChange={(e) => onChange("date_range", e.target.value)}
          placeholder="e.g. Jan 2022 – Present"
          style={{ display: "block", width: "100%", marginTop: 4 }}
        />
      </label>
    </div>
  );
}

export default function ProfileSetupPage() {
  const router = useRouter();

  const [experiences, setExperiences] = useState<ExperienceEntry[]>([blankEntry()]);
  const [projects, setProjects] = useState<ExperienceEntry[]>([blankEntry()]);
  const [skills, setSkills] = useState("");
  const [achievements, setAchievements] = useState("");
  const [writingPreferences, setWritingPreferences] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateEntry(
    setter: (fn: (prev: ExperienceEntry[]) => ExperienceEntry[]) => void,
    index: number,
    field: keyof ExperienceEntry,
    value: string
  ) {
    setter((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  }

  function removeEntry(
    setter: (fn: (prev: ExperienceEntry[]) => ExperienceEntry[]) => void,
    index: number
  ) {
    setter((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const profileId = crypto.randomUUID();

      // Save master_profile
      const { error: profileError } = await supabase.from("master_profile").insert({
        profile_id: profileId,
        writing_preferences: writingPreferences,
      });
      if (profileError) throw new Error(`Failed to save profile: ${profileError.message}`);

      // Build experience rows
      const rows = [
        ...experiences
          .filter((e) => e.title.trim())
          .map((e) => ({
            profile_id: profileId,
            title: e.title,
            description: e.description,
            skills: splitCsv(e.skills),
            tags: ["experience"],
            metrics: splitCsv(e.metrics),
            date_range: e.date_range,
          })),
        ...projects
          .filter((p) => p.title.trim())
          .map((p) => ({
            profile_id: profileId,
            title: p.title,
            description: p.description,
            skills: splitCsv(p.skills),
            tags: ["project"],
            metrics: splitCsv(p.metrics),
            date_range: p.date_range,
          })),
      ];

      // Store global skills as a special entry (tags: ["__global_skills"])
      const globalSkills = splitCsv(skills);
      if (globalSkills.length > 0) {
        rows.push({
          profile_id: profileId,
          title: "__global_skills",
          description: "Global skills profile",
          skills: globalSkills,
          tags: ["__global_skills"],
          metrics: [],
          date_range: "",
        });
      }

      // Store each achievement line as an entry (tags: ["achievement"])
      const achievementLines = achievements
        .split("\n")
        .map((a) => a.trim())
        .filter(Boolean);
      for (const achievement of achievementLines) {
        rows.push({
          profile_id: profileId,
          title: achievement.slice(0, 100),
          description: achievement,
          skills: [],
          tags: ["achievement"],
          metrics: [],
          date_range: "",
        });
      }

      if (rows.length > 0) {
        const { error: expError } = await supabase.from("experiences").insert(rows);
        if (expError) throw new Error(`Failed to save experiences: ${expError.message}`);
      }

      router.push(`/job-input?profile_id=${profileId}`);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to save profile. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ maxWidth: 800, margin: "0 auto", padding: 24 }}>
      <h1>Set Up Your Profile</h1>
      <p>This profile will be used to generate all of your application materials.</p>

      <form onSubmit={handleSubmit}>
        {/* Work Experiences */}
        <section style={{ marginBottom: 32 }}>
          <h2>Work Experiences</h2>
          {experiences.map((exp, i) => (
            <EntryForm
              key={i}
              entry={exp}
              index={i}
              label="Experience"
              onChange={(field, value) => updateEntry(setExperiences, i, field, value)}
              onRemove={() => removeEntry(setExperiences, i)}
              showRemove={experiences.length > 1}
            />
          ))}
          <button
            type="button"
            onClick={() => setExperiences((prev) => [...prev, blankEntry()])}
          >
            + Add Work Experience
          </button>
        </section>

        {/* Projects */}
        <section style={{ marginBottom: 32 }}>
          <h2>Projects</h2>
          {projects.map((proj, i) => (
            <EntryForm
              key={i}
              entry={proj}
              index={i}
              label="Project"
              onChange={(field, value) => updateEntry(setProjects, i, field, value)}
              onRemove={() => removeEntry(setProjects, i)}
              showRemove={projects.length > 1}
            />
          ))}
          <button
            type="button"
            onClick={() => setProjects((prev) => [...prev, blankEntry()])}
          >
            + Add Project
          </button>
        </section>

        {/* Global Skills */}
        <section style={{ marginBottom: 32 }}>
          <h2>Skills</h2>
          <label>
            List all your skills, comma-separated
            <input
              value={skills}
              onChange={(e) => setSkills(e.target.value)}
              placeholder="e.g. Python, SQL, Product Management, Figma"
              style={{ display: "block", width: "100%", marginTop: 4 }}
            />
          </label>
        </section>

        {/* Achievements */}
        <section style={{ marginBottom: 32 }}>
          <h2>Achievements</h2>
          <label>
            One achievement per line
            <textarea
              value={achievements}
              onChange={(e) => setAchievements(e.target.value)}
              rows={4}
              placeholder={"Won company hackathon 2023\nPromoted to senior engineer in 18 months"}
              style={{ display: "block", width: "100%", marginTop: 4 }}
            />
          </label>
        </section>

        {/* Writing Preferences */}
        <section style={{ marginBottom: 32 }}>
          <h2>Writing Preferences</h2>
          <label>
            Describe your preferred tone and style for application materials
            <textarea
              value={writingPreferences}
              onChange={(e) => setWritingPreferences(e.target.value)}
              rows={3}
              placeholder="e.g. Direct and concise, avoid buzzwords, emphasize technical depth"
              style={{ display: "block", width: "100%", marginTop: 4 }}
            />
          </label>
        </section>

        {error && (
          <div
            style={{
              color: "#b00",
              padding: 12,
              border: "1px solid #b00",
              borderRadius: 4,
              marginBottom: 16,
            }}
          >
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          style={{ padding: "12px 28px", fontSize: 16 }}
        >
          {loading ? "Saving…" : "Save Profile & Continue"}
        </button>
      </form>
    </main>
  );
}
