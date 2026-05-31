// Profile setup — document upload flow: upload → parse → review → save

// AUTH NOTE: profile_id is currently generated with
// crypto.randomUUID() for V1 testing.
// Before production: replace with supabase.auth.getUser().id
// and ensure RLS policies match auth.uid()

"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { MasterProfile } from "@/lib/types";

// V1: anon key — Supabase writes will be blocked by RLS without auth.
// V2: route saves through an API route using the service role key.
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type Screen = "upload" | "parsing" | "review" | "saving" | "error";

interface EditableExperience {
  experience_id: string;
  title: string;
  description: string;
  date_range: string;
  skills: string[];
  tags: string[];
  metrics: string[];
}

interface EditableProfile {
  experiences: EditableExperience[];
  projects: EditableExperience[];
  skills: string[];
  achievements: string[];
  writing_preferences: string;
}

const MAX_FILE_SIZE = 5 * 1024 * 1024;

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getMimeType(file: File): string {
  if (file.type === "application/pdf") return "application/pdf";
  return "text/plain";
}

function toEditable(p: MasterProfile): EditableProfile {
  return {
    experiences: p.experiences.map((e) => ({ ...e })),
    projects: p.projects.map((p) => ({ ...p })),
    skills: [...p.skills],
    achievements: [...p.achievements],
    writing_preferences: p.writing_preferences,
  };
}

function ExperienceEditor({
  entry,
  onUpdate,
  onRemove,
  showDateRange,
}: {
  entry: EditableExperience;
  onUpdate: (field: "title" | "description" | "date_range", value: string) => void;
  onRemove: () => void;
  showDateRange: boolean;
}) {
  return (
    <div style={{ border: "1px solid #ddd", borderRadius: 6, padding: 14, marginBottom: 10 }}>
      <div style={{ display: "flex", gap: 8, alignItems: "flex-start", marginBottom: 8 }}>
        <input
          value={entry.title}
          onChange={(e) => onUpdate("title", e.target.value)}
          style={{
            flex: 1,
            fontWeight: "bold",
            fontSize: 14,
            border: "1px solid #ddd",
            borderRadius: 4,
            padding: "4px 8px",
          }}
        />
        <button
          type="button"
          onClick={onRemove}
          style={{ color: "#b00", border: "none", background: "none", cursor: "pointer", fontSize: 13, flexShrink: 0 }}
        >
          Remove
        </button>
      </div>
      <textarea
        value={entry.description}
        onChange={(e) => onUpdate("description", e.target.value)}
        rows={2}
        style={{
          width: "100%",
          border: "1px solid #ddd",
          borderRadius: 4,
          padding: "4px 8px",
          fontSize: 13,
          marginBottom: showDateRange ? 8 : 0,
        }}
      />
      {showDateRange && (
        <input
          value={entry.date_range}
          onChange={(e) => onUpdate("date_range", e.target.value)}
          placeholder="Date range (e.g. Jan 2022 – Present)"
          style={{ border: "1px solid #ddd", borderRadius: 4, padding: "4px 8px", fontSize: 13, width: 280 }}
        />
      )}
    </div>
  );
}

export default function ProfileSetupPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [screen, setScreen] = useState<Screen>("upload");
  const [errorMessage, setErrorMessage] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [fileName, setFileName] = useState("");
  const [fileSize, setFileSize] = useState(0);
  const [profile, setProfile] = useState<EditableProfile | null>(null);

  async function processFile(file: File) {
    if (file.size > MAX_FILE_SIZE) {
      setErrorMessage(`File too large (${formatBytes(file.size)}). Maximum is 5 MB.`);
      setScreen("error");
      return;
    }

    const mimeType = getMimeType(file);
    setFileName(file.name);
    setFileSize(file.size);
    setScreen("parsing");

    try {
      const fileContent = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const dataUrl = reader.result as string;
          resolve(dataUrl.split(",")[1]); // strip "data:...;base64," prefix
        };
        reader.onerror = () => reject(new Error("Failed to read file"));
        reader.readAsDataURL(file);
      });

      const res = await fetch("/api/parse-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileContent, mimeType }),
      });

      if (!res.ok) throw new Error(`Parse request failed: ${res.statusText}`);
      const result = await res.json();
      if (!result.success) throw new Error(result.error);

      setProfile(toEditable(result.data));
      setScreen("review");
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to read document.");
      setScreen("error");
    }
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }

  function resetToUpload() {
    setScreen("upload");
    setErrorMessage("");
    setFileName("");
    setFileSize(0);
    setProfile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function updateExperience(
    type: "experiences" | "projects",
    index: number,
    field: "title" | "description" | "date_range",
    value: string
  ) {
    setProfile((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        [type]: prev[type].map((e, i) => (i === index ? { ...e, [field]: value } : e)),
      };
    });
  }

  function removeExperience(type: "experiences" | "projects", index: number) {
    setProfile((prev) => {
      if (!prev) return prev;
      return { ...prev, [type]: prev[type].filter((_, i) => i !== index) };
    });
  }

  function removeSkill(index: number) {
    setProfile((prev) => {
      if (!prev) return prev;
      return { ...prev, skills: prev.skills.filter((_, i) => i !== index) };
    });
  }

  function updateAchievement(index: number, value: string) {
    setProfile((prev) => {
      if (!prev) return prev;
      return { ...prev, achievements: prev.achievements.map((a, i) => (i === index ? value : a)) };
    });
  }

  function removeAchievement(index: number) {
    setProfile((prev) => {
      if (!prev) return prev;
      return { ...prev, achievements: prev.achievements.filter((_, i) => i !== index) };
    });
  }

  async function handleSave() {
    if (!profile) return;
    setScreen("saving");

    try {
      const profileId = crypto.randomUUID();

      const { error: profileError } = await supabase.from("master_profile").insert({
        profile_id: profileId,
        writing_preferences: profile.writing_preferences,
      });
      if (profileError) throw new Error(`Failed to save profile: ${profileError.message}`);

      const rows: object[] = [
        ...profile.experiences
          .filter((e) => e.title.trim())
          .map((e) => ({
            profile_id: profileId,
            experience_id: e.experience_id,
            title: e.title,
            description: e.description,
            skills: e.skills,
            tags: e.tags,
            metrics: e.metrics,
            date_range: e.date_range,
          })),
        ...profile.projects
          .filter((p) => p.title.trim())
          .map((p) => ({
            profile_id: profileId,
            experience_id: p.experience_id,
            title: p.title,
            description: p.description,
            skills: p.skills,
            tags: p.tags,
            metrics: p.metrics,
            date_range: p.date_range,
          })),
      ];

      if (profile.skills.length > 0) {
        rows.push({
          profile_id: profileId,
          experience_id: crypto.randomUUID(),
          title: "__global_skills",
          description: "Global skills profile",
          skills: profile.skills,
          tags: ["__global_skills"],
          metrics: [],
          date_range: "",
        });
      }

      for (const achievement of profile.achievements.filter(Boolean)) {
        rows.push({
          profile_id: profileId,
          experience_id: crypto.randomUUID(),
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
      setErrorMessage(err instanceof Error ? err.message : "Failed to save profile.");
      setScreen("error");
    }
  }

  if (screen === "upload") {
    return (
      <main style={{ maxWidth: 640, margin: "0 auto", padding: 24 }}>
        <h1>Set Up Your Profile</h1>
        <p style={{ color: "#555", marginBottom: 24 }}>
          Upload your resume or CV. We&rsquo;ll extract your experience automatically.
        </p>

        <div
          onDrop={handleDrop}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onClick={() => fileInputRef.current?.click()}
          style={{
            border: `2px dashed ${isDragging ? "#0070f3" : "#ccc"}`,
            borderRadius: 8,
            padding: "56px 32px",
            textAlign: "center",
            cursor: "pointer",
            background: isDragging ? "#f0f7ff" : "#fafafa",
            transition: "border-color 0.15s, background 0.15s",
            userSelect: "none",
          }}
        >
          <div style={{ fontSize: 40, marginBottom: 12 }}>📄</div>
          <div style={{ fontWeight: "bold", fontSize: 16, marginBottom: 6 }}>
            Drag and drop your document here
          </div>
          <div style={{ color: "#888", fontSize: 14, marginBottom: 16 }}>or click to browse</div>
          <div style={{ color: "#aaa", fontSize: 12 }}>PDF, TXT, or MD &mdash; max 5 MB</div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.txt,.md"
            onChange={handleFileInput}
            style={{ display: "none" }}
          />
        </div>
      </main>
    );
  }

  if (screen === "parsing") {
    return (
      <main style={{ maxWidth: 640, margin: "0 auto", padding: 24 }}>
        <h1>Set Up Your Profile</h1>
        <div style={{ textAlign: "center", padding: "64px 0" }}>
          <div style={{ fontSize: 36, marginBottom: 16 }}>⏳</div>
          <div style={{ fontWeight: "bold", fontSize: 18, marginBottom: 8 }}>
            Reading your document&hellip;
          </div>
          {fileName && (
            <div style={{ color: "#888", fontSize: 14 }}>
              {fileName} &mdash; {formatBytes(fileSize)}
            </div>
          )}
        </div>
      </main>
    );
  }

  if (screen === "saving") {
    return (
      <main style={{ maxWidth: 640, margin: "0 auto", padding: 24 }}>
        <h1>Set Up Your Profile</h1>
        <div style={{ textAlign: "center", padding: "64px 0" }}>
          <div style={{ fontSize: 36, marginBottom: 16 }}>💾</div>
          <div style={{ fontWeight: "bold", fontSize: 18 }}>Saving your profile&hellip;</div>
        </div>
      </main>
    );
  }

  if (screen === "error") {
    return (
      <main style={{ maxWidth: 640, margin: "0 auto", padding: 24 }}>
        <h1>Set Up Your Profile</h1>
        <div
          style={{
            padding: 16,
            background: "#fff4f4",
            border: "1px solid #c44",
            borderRadius: 6,
            marginBottom: 24,
            color: "#b00",
          }}
        >
          {errorMessage}
        </div>
        <button onClick={resetToUpload} style={{ padding: "12px 28px", fontSize: 15 }}>
          Try Again
        </button>
      </main>
    );
  }

  // Review screen
  if (!profile) return null;

  return (
    <main style={{ maxWidth: 800, margin: "0 auto", padding: 24 }}>
      <h1>Review Extracted Profile</h1>
      <p style={{ color: "#555", marginBottom: 28 }}>
        Extracted from <strong>{fileName}</strong>. Edit or remove anything before saving.
        You cannot add new items in this view.
      </p>

      {/* Work Experiences */}
      <section style={{ marginBottom: 32 }}>
        <h2>Work Experiences ({profile.experiences.length})</h2>
        {profile.experiences.length === 0 ? (
          <p style={{ color: "#888", fontSize: 14 }}>No work experiences extracted.</p>
        ) : (
          profile.experiences.map((e, i) => (
            <ExperienceEditor
              key={e.experience_id}
              entry={e}
              onUpdate={(field, value) => updateExperience("experiences", i, field, value)}
              onRemove={() => removeExperience("experiences", i)}
              showDateRange
            />
          ))
        )}
      </section>

      {/* Projects */}
      <section style={{ marginBottom: 32 }}>
        <h2>Projects ({profile.projects.length})</h2>
        {profile.projects.length === 0 ? (
          <p style={{ color: "#888", fontSize: 14 }}>No projects extracted.</p>
        ) : (
          profile.projects.map((p, i) => (
            <ExperienceEditor
              key={p.experience_id}
              entry={p}
              onUpdate={(field, value) => updateExperience("projects", i, field, value)}
              onRemove={() => removeExperience("projects", i)}
              showDateRange={false}
            />
          ))
        )}
      </section>

      {/* Skills */}
      <section style={{ marginBottom: 32 }}>
        <h2>Skills ({profile.skills.length})</h2>
        {profile.skills.length === 0 ? (
          <p style={{ color: "#888", fontSize: 14 }}>No skills extracted.</p>
        ) : (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {profile.skills.map((skill, i) => (
              <span
                key={i}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  padding: "4px 10px",
                  background: "#eef",
                  borderRadius: 20,
                  fontSize: 13,
                }}
              >
                {skill}
                <button
                  type="button"
                  onClick={() => removeSkill(i)}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "#888", fontSize: 14, padding: 0, lineHeight: 1 }}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
      </section>

      {/* Achievements */}
      <section style={{ marginBottom: 32 }}>
        <h2>Achievements ({profile.achievements.length})</h2>
        {profile.achievements.length === 0 ? (
          <p style={{ color: "#888", fontSize: 14 }}>No achievements extracted.</p>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {profile.achievements.map((a, i) => (
              <li key={i} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
                <input
                  value={a}
                  onChange={(e) => updateAchievement(i, e.target.value)}
                  style={{ flex: 1, border: "1px solid #ddd", borderRadius: 4, padding: "4px 8px", fontSize: 13 }}
                />
                <button
                  type="button"
                  onClick={() => removeAchievement(i)}
                  style={{ color: "#b00", border: "none", background: "none", cursor: "pointer", fontSize: 13, flexShrink: 0 }}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Writing Preferences */}
      <section style={{ marginBottom: 32 }}>
        <h2>Writing Preferences</h2>
        <textarea
          value={profile.writing_preferences}
          onChange={(e) =>
            setProfile((prev) => (prev ? { ...prev, writing_preferences: e.target.value } : prev))
          }
          rows={3}
          placeholder="e.g. Direct and concise, avoid buzzwords, emphasize technical depth"
          style={{ display: "block", width: "100%", border: "1px solid #ddd", borderRadius: 4, padding: 8, fontSize: 13 }}
        />
      </section>

      <div style={{ display: "flex", gap: 12 }}>
        <button
          onClick={handleSave}
          style={{
            padding: "12px 28px",
            fontSize: 15,
            background: "#0070f3",
            color: "#fff",
            border: "none",
            borderRadius: 4,
            cursor: "pointer",
          }}
        >
          Looks good, save profile
        </button>
        <button onClick={resetToUpload} style={{ padding: "12px 28px", fontSize: 15 }}>
          Upload different document
        </button>
      </div>
    </main>
  );
}
