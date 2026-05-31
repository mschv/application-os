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

interface EditableEducation {
  education_id: string;
  degree: string;
  institution: string;
  graduation_date: string;
  gpa: string;
}

interface EditableLanguage {
  language_id: string;
  language: string;
  proficiency: string;
}

interface EditableCertification {
  certification_id: string;
  name: string;
  issuer: string;
  date: string;
}

interface EditablePublication {
  publication_id: string;
  title: string;
  description: string;
  date: string;
  url: string;
}

interface EditableContactInfo {
  full_name: string;
  email: string;
  phone: string;
  location: string;
  linkedin_url: string;
  portfolio_url: string;
}

interface EditableTargetPreferences {
  target_titles: string[];
  target_industries: string[];
  work_mode: string;
  target_locations: string[];
}

interface EditableProfile {
  contact_info: EditableContactInfo;
  experiences: EditableExperience[];
  projects: EditableExperience[];
  skills: string[];
  achievements: string[];
  writing_preferences: string;
  education: EditableEducation[];
  languages: EditableLanguage[];
  certifications: EditableCertification[];
  publications: EditablePublication[];
  target_preferences: EditableTargetPreferences;
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
    contact_info: p.contact_info
      ? {
          full_name: p.contact_info.full_name ?? "",
          email: p.contact_info.email ?? "",
          phone: p.contact_info.phone ?? "",
          location: p.contact_info.location ?? "",
          linkedin_url: p.contact_info.linkedin_url ?? "",
          portfolio_url: p.contact_info.portfolio_url ?? "",
        }
      : { full_name: "", email: "", phone: "", location: "", linkedin_url: "", portfolio_url: "" },
    experiences: p.experiences.map((e) => ({ ...e })),
    projects: p.projects.map((pr) => ({ ...pr })),
    skills: [...p.skills],
    achievements: [...p.achievements],
    writing_preferences: p.writing_preferences ?? "",
    education: (p.education ?? []).map((e) => ({
      education_id: e.education_id,
      degree: e.degree,
      institution: e.institution,
      graduation_date: e.graduation_date ?? "",
      gpa: e.gpa ?? "",
    })),
    languages: (p.languages ?? []).map((l) => ({
      language_id: l.language_id,
      language: l.language,
      proficiency: l.proficiency ?? "",
    })),
    certifications: (p.certifications ?? []).map((c) => ({
      certification_id: c.certification_id,
      name: c.name,
      issuer: c.issuer ?? "",
      date: c.date ?? "",
    })),
    publications: (p.publications ?? []).map((pub) => ({
      publication_id: pub.publication_id,
      title: pub.title,
      description: pub.description ?? "",
      date: pub.date ?? "",
      url: pub.url ?? "",
    })),
    target_preferences: {
      target_titles: [],
      target_industries: [],
      work_mode: "",
      target_locations: [],
    },
  };
}

// ── Sub-components ────────────────────────────────────────────────

function inputStyle(extra?: React.CSSProperties): React.CSSProperties {
  return { border: "1px solid #ddd", borderRadius: 4, padding: "5px 8px", fontSize: 13, width: "100%", ...extra };
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
        <input value={entry.title} onChange={(e) => onUpdate("title", e.target.value)} style={{ ...inputStyle(), fontWeight: "bold", flex: 1 }} />
        <button type="button" onClick={onRemove} style={{ color: "#b00", border: "none", background: "none", cursor: "pointer", fontSize: 13, flexShrink: 0 }}>Remove</button>
      </div>
      <textarea value={entry.description} onChange={(e) => onUpdate("description", e.target.value)} rows={2} style={{ ...inputStyle(), marginBottom: showDateRange ? 8 : 0 }} />
      {showDateRange && (
        <input value={entry.date_range} onChange={(e) => onUpdate("date_range", e.target.value)} placeholder="Date range (e.g. Jan 2022 – Present)" style={inputStyle({ width: 280 })} />
      )}
    </div>
  );
}

function EducationEditor({
  entry,
  onUpdate,
  onRemove,
}: {
  entry: EditableEducation;
  onUpdate: (field: keyof EditableEducation, value: string) => void;
  onRemove: () => void;
}) {
  return (
    <div style={{ border: "1px solid #ddd", borderRadius: 6, padding: 14, marginBottom: 10 }}>
      <div style={{ display: "flex", gap: 8, alignItems: "flex-start", marginBottom: 8 }}>
        <input value={entry.degree} onChange={(e) => onUpdate("degree", e.target.value)} placeholder="Degree" style={{ ...inputStyle(), fontWeight: "bold", flex: 1 }} />
        <button type="button" onClick={onRemove} style={{ color: "#b00", border: "none", background: "none", cursor: "pointer", fontSize: 13, flexShrink: 0 }}>Remove</button>
      </div>
      <input value={entry.institution} onChange={(e) => onUpdate("institution", e.target.value)} placeholder="Institution" style={{ ...inputStyle(), marginBottom: 8 }} />
      <div style={{ display: "flex", gap: 8 }}>
        <input value={entry.graduation_date} onChange={(e) => onUpdate("graduation_date", e.target.value)} placeholder="Graduation date" style={inputStyle({ flex: 1 })} />
        <input value={entry.gpa} onChange={(e) => onUpdate("gpa", e.target.value)} placeholder="GPA (optional)" style={inputStyle({ width: 140 })} />
      </div>
    </div>
  );
}

function CertificationEditor({
  entry,
  onUpdate,
  onRemove,
}: {
  entry: EditableCertification;
  onUpdate: (field: keyof EditableCertification, value: string) => void;
  onRemove: () => void;
}) {
  return (
    <div style={{ border: "1px solid #ddd", borderRadius: 6, padding: 14, marginBottom: 10 }}>
      <div style={{ display: "flex", gap: 8, alignItems: "flex-start", marginBottom: 8 }}>
        <input value={entry.name} onChange={(e) => onUpdate("name", e.target.value)} placeholder="Certification name" style={{ ...inputStyle(), fontWeight: "bold", flex: 1 }} />
        <button type="button" onClick={onRemove} style={{ color: "#b00", border: "none", background: "none", cursor: "pointer", fontSize: 13, flexShrink: 0 }}>Remove</button>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <input value={entry.issuer} onChange={(e) => onUpdate("issuer", e.target.value)} placeholder="Issuing organization" style={inputStyle({ flex: 1 })} />
        <input value={entry.date} onChange={(e) => onUpdate("date", e.target.value)} placeholder="Date" style={inputStyle({ width: 120 })} />
      </div>
    </div>
  );
}

function PublicationEditor({
  entry,
  onUpdate,
  onRemove,
}: {
  entry: EditablePublication;
  onUpdate: (field: keyof EditablePublication, value: string) => void;
  onRemove: () => void;
}) {
  return (
    <div style={{ border: "1px solid #ddd", borderRadius: 6, padding: 14, marginBottom: 10 }}>
      <div style={{ display: "flex", gap: 8, alignItems: "flex-start", marginBottom: 8 }}>
        <input value={entry.title} onChange={(e) => onUpdate("title", e.target.value)} placeholder="Title" style={{ ...inputStyle(), fontWeight: "bold", flex: 1 }} />
        <button type="button" onClick={onRemove} style={{ color: "#b00", border: "none", background: "none", cursor: "pointer", fontSize: 13, flexShrink: 0 }}>Remove</button>
      </div>
      <textarea value={entry.description} onChange={(e) => onUpdate("description", e.target.value)} rows={2} placeholder="Short description" style={{ ...inputStyle(), marginBottom: 8 }} />
      <div style={{ display: "flex", gap: 8 }}>
        <input value={entry.date} onChange={(e) => onUpdate("date", e.target.value)} placeholder="Date" style={inputStyle({ width: 120 })} />
        <input value={entry.url} onChange={(e) => onUpdate("url", e.target.value)} placeholder="URL (optional)" style={inputStyle({ flex: 1 })} />
      </div>
    </div>
  );
}

function PillInput({
  items,
  onChange,
  placeholder,
}: {
  items: string[];
  onChange: (items: string[]) => void;
  placeholder: string;
}) {
  const [input, setInput] = useState("");

  function commit(raw: string) {
    const trimmed = raw.replace(/,+$/, "").trim();
    if (trimmed && !items.includes(trimmed)) onChange([...items, trimmed]);
    setInput("");
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") { e.preventDefault(); commit(input); }
    if (e.key === "Backspace" && input === "" && items.length > 0) onChange(items.slice(0, -1));
  }

  return (
    <div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: items.length ? 8 : 0 }}>
        {items.map((item, i) => (
          <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 10px", background: "#e0eeff", borderRadius: 20, fontSize: 13 }}>
            {item}
            <button type="button" onClick={() => onChange(items.filter((_, j) => j !== i))} style={{ background: "none", border: "none", cursor: "pointer", color: "#666", fontSize: 14, padding: 0, lineHeight: 1 }}>×</button>
          </span>
        ))}
      </div>
      <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={handleKeyDown} onBlur={() => { if (input.trim()) commit(input); }} placeholder={placeholder} style={inputStyle()} />
      <div style={{ fontSize: 11, color: "#aaa", marginTop: 3 }}>Press Enter or , to add</div>
    </div>
  );
}

// ── Page component ────────────────────────────────────────────────

export default function SetupPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [screen, setScreen] = useState<Screen>("upload");
  const [errorMessage, setErrorMessage] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [fileName, setFileName] = useState("");
  const [fileSize, setFileSize] = useState(0);
  const [profile, setProfile] = useState<EditableProfile | null>(null);
  const [targetError, setTargetError] = useState("");

  async function processFile(file: File) {
    if (file.size > MAX_FILE_SIZE) {
      setErrorMessage(`File too large (${formatBytes(file.size)}). Maximum is 5 MB.`);
      setScreen("error");
      return;
    }

    setFileName(file.name);
    setFileSize(file.size);
    setScreen("parsing");

    try {
      const fileContent = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => { resolve((reader.result as string).split(",")[1]); };
        reader.onerror = () => reject(new Error("Failed to read file"));
        reader.readAsDataURL(file);
      });

      const res = await fetch("/api/parse-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileContent, mimeType: getMimeType(file) }),
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
    setTargetError("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  // ── Profile editing helpers ──

  function updateExperience(type: "experiences" | "projects", index: number, field: "title" | "description" | "date_range", value: string) {
    setProfile((prev) => {
      if (!prev) return prev;
      return { ...prev, [type]: prev[type].map((e, i) => (i === index ? { ...e, [field]: value } : e)) };
    });
  }

  function removeExperience(type: "experiences" | "projects", index: number) {
    setProfile((prev) => prev ? { ...prev, [type]: prev[type].filter((_, i) => i !== index) } : prev);
  }

  function updateEducation(index: number, field: keyof EditableEducation, value: string) {
    setProfile((prev) => {
      if (!prev) return prev;
      return { ...prev, education: prev.education.map((e, i) => (i === index ? { ...e, [field]: value } : e)) };
    });
  }

  function removeEducation(index: number) {
    setProfile((prev) => prev ? { ...prev, education: prev.education.filter((_, i) => i !== index) } : prev);
  }

  function removeLanguage(index: number) {
    setProfile((prev) => prev ? { ...prev, languages: prev.languages.filter((_, i) => i !== index) } : prev);
  }

  function updateCertification(index: number, field: keyof EditableCertification, value: string) {
    setProfile((prev) => {
      if (!prev) return prev;
      return { ...prev, certifications: prev.certifications.map((c, i) => (i === index ? { ...c, [field]: value } : c)) };
    });
  }

  function removeCertification(index: number) {
    setProfile((prev) => prev ? { ...prev, certifications: prev.certifications.filter((_, i) => i !== index) } : prev);
  }

  function updatePublication(index: number, field: keyof EditablePublication, value: string) {
    setProfile((prev) => {
      if (!prev) return prev;
      return { ...prev, publications: prev.publications.map((p, i) => (i === index ? { ...p, [field]: value } : p)) };
    });
  }

  function removePublication(index: number) {
    setProfile((prev) => prev ? { ...prev, publications: prev.publications.filter((_, i) => i !== index) } : prev);
  }

  function removeSkill(index: number) {
    setProfile((prev) => prev ? { ...prev, skills: prev.skills.filter((_, i) => i !== index) } : prev);
  }

  function updateAchievement(index: number, value: string) {
    setProfile((prev) => prev ? { ...prev, achievements: prev.achievements.map((a, i) => (i === index ? value : a)) } : prev);
  }

  function removeAchievement(index: number) {
    setProfile((prev) => prev ? { ...prev, achievements: prev.achievements.filter((_, i) => i !== index) } : prev);
  }

  function updateContactInfo(field: keyof EditableContactInfo, value: string) {
    setProfile((prev) => prev ? { ...prev, contact_info: { ...prev.contact_info, [field]: value } } : prev);
  }

  function updateTargetPreferences(field: keyof EditableTargetPreferences, value: string | string[]) {
    setProfile((prev) => prev ? { ...prev, target_preferences: { ...prev.target_preferences, [field]: value } } : prev);
    setTargetError("");
  }

  async function handleSave() {
    if (!profile) return;

    const tp = profile.target_preferences;
    if (tp.target_titles.length === 0 && tp.target_industries.length === 0 && !tp.work_mode && tp.target_locations.length === 0) {
      setTargetError("Target Preferences is required. Fill in at least one field before saving.");
      return;
    }

    setScreen("saving");

    try {
      const profileId = crypto.randomUUID();

      const { error: profileError } = await supabase.from("master_profile").insert({
        profile_id: profileId,
        writing_preferences: profile.writing_preferences,
      });
      if (profileError) throw new Error(`Failed to save profile: ${profileError.message}`);

      // Experiences + projects
      const expRows = [
        ...profile.experiences.filter((e) => e.title.trim()).map((e) => ({
          profile_id: profileId,
          experience_id: crypto.randomUUID(),
          title: e.title,
          description: e.description,
          skills: e.skills,
          tags: e.tags,
          metrics: e.metrics,
          date_range: e.date_range,
        })),
        ...profile.projects.filter((p) => p.title.trim()).map((p) => ({
          profile_id: profileId,
          experience_id: crypto.randomUUID(),
          title: p.title,
          description: p.description,
          skills: p.skills,
          tags: p.tags,
          metrics: p.metrics,
          date_range: p.date_range,
        })),
      ];

      if (profile.skills.length > 0) {
        expRows.push({
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
        expRows.push({
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

      if (expRows.length > 0) {
        const { error: expError } = await supabase.from("experiences").insert(expRows);
        if (expError) throw new Error(`Failed to save experiences: ${expError.message}`);
      }

      // Contact info
      if (profile.contact_info.full_name.trim()) {
        const { error: ciError } = await supabase.from("contact_info").insert({
          profile_id: profileId,
          full_name: profile.contact_info.full_name,
          email: profile.contact_info.email || null,
          phone: profile.contact_info.phone || null,
          location: profile.contact_info.location || null,
          linkedin_url: profile.contact_info.linkedin_url || null,
          portfolio_url: profile.contact_info.portfolio_url || null,
        });
        if (ciError) throw new Error(`Failed to save contact info: ${ciError.message}`);
      }

      // Education
      const eduRows = profile.education.filter((e) => e.degree.trim() && e.institution.trim()).map((e) => ({
        profile_id: profileId,
        degree: e.degree,
        institution: e.institution,
        graduation_date: e.graduation_date || null,
        gpa: e.gpa || null,
      }));
      if (eduRows.length > 0) {
        const { error: eduError } = await supabase.from("education").insert(eduRows);
        if (eduError) throw new Error(`Failed to save education: ${eduError.message}`);
      }

      // Languages
      const langRows = profile.languages.filter((l) => l.language.trim()).map((l) => ({
        profile_id: profileId,
        language: l.language,
        proficiency: l.proficiency || null,
      }));
      if (langRows.length > 0) {
        const { error: langError } = await supabase.from("languages").insert(langRows);
        if (langError) throw new Error(`Failed to save languages: ${langError.message}`);
      }

      // Certifications
      const certRows = profile.certifications.filter((c) => c.name.trim()).map((c) => ({
        profile_id: profileId,
        name: c.name,
        issuer: c.issuer || null,
        date: c.date || null,
      }));
      if (certRows.length > 0) {
        const { error: certError } = await supabase.from("certifications").insert(certRows);
        if (certError) throw new Error(`Failed to save certifications: ${certError.message}`);
      }

      // Publications
      const pubRows = profile.publications.filter((p) => p.title.trim()).map((p) => ({
        profile_id: profileId,
        title: p.title,
        description: p.description || null,
        date: p.date || null,
        url: p.url || null,
      }));
      if (pubRows.length > 0) {
        const { error: pubError } = await supabase.from("publications").insert(pubRows);
        if (pubError) throw new Error(`Failed to save publications: ${pubError.message}`);
      }

      // Target preferences
      const { error: tpError } = await supabase.from("target_preferences").insert({
        profile_id: profileId,
        target_titles: tp.target_titles,
        target_industries: tp.target_industries,
        work_mode: tp.work_mode || null,
        target_locations: tp.target_locations,
      });
      if (tpError) throw new Error(`Failed to save target preferences: ${tpError.message}`);

      router.push(`/apply?profile_id=${profileId}`);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to save profile.");
      setScreen("error");
    }
  }

  // ── Screens ──

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
          <div style={{ fontWeight: "bold", fontSize: 16, marginBottom: 6 }}>Drag and drop your document here</div>
          <div style={{ color: "#888", fontSize: 14, marginBottom: 16 }}>or click to browse</div>
          <div style={{ color: "#aaa", fontSize: 12 }}>PDF, TXT, or MD &mdash; max 5 MB</div>
          <input ref={fileInputRef} type="file" accept=".pdf,.txt,.md" onChange={handleFileInput} style={{ display: "none" }} />
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
          <div style={{ fontWeight: "bold", fontSize: 18, marginBottom: 8 }}>Reading your document&hellip;</div>
          {fileName && <div style={{ color: "#888", fontSize: 14 }}>{fileName} &mdash; {formatBytes(fileSize)}</div>}
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
        <div style={{ padding: 16, background: "#fff4f4", border: "1px solid #c44", borderRadius: 6, marginBottom: 24, color: "#b00" }}>
          {errorMessage}
        </div>
        <button onClick={resetToUpload} style={{ padding: "12px 28px", fontSize: 15 }}>Try Again</button>
      </main>
    );
  }

  // ── Review screen ──

  if (!profile) return null;

  const tp = profile.target_preferences;

  return (
    <main style={{ maxWidth: 800, margin: "0 auto", padding: 24 }}>
      <h1>Review Extracted Profile</h1>
      <p style={{ color: "#555", marginBottom: 28 }}>
        Extracted from <strong>{fileName}</strong>. Edit or remove anything before saving.
        You cannot add new items in this view.
      </p>

      {/* Contact Info */}
      <section style={{ marginBottom: 32 }}>
        <h2>Contact Info</h2>
        <div style={{ border: "1px solid #ddd", borderRadius: 6, padding: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
            <label style={{ fontSize: 13 }}>
              Full name
              <input value={profile.contact_info.full_name} onChange={(e) => updateContactInfo("full_name", e.target.value)} style={{ ...inputStyle(), marginTop: 4 }} />
            </label>
            <label style={{ fontSize: 13 }}>
              Email
              <input value={profile.contact_info.email} onChange={(e) => updateContactInfo("email", e.target.value)} style={{ ...inputStyle(), marginTop: 4 }} />
            </label>
            <label style={{ fontSize: 13 }}>
              Phone
              <input value={profile.contact_info.phone} onChange={(e) => updateContactInfo("phone", e.target.value)} style={{ ...inputStyle(), marginTop: 4 }} />
            </label>
            <label style={{ fontSize: 13 }}>
              Location
              <input value={profile.contact_info.location} onChange={(e) => updateContactInfo("location", e.target.value)} style={{ ...inputStyle(), marginTop: 4 }} />
            </label>
            <label style={{ fontSize: 13 }}>
              LinkedIn URL
              <input value={profile.contact_info.linkedin_url} onChange={(e) => updateContactInfo("linkedin_url", e.target.value)} style={{ ...inputStyle(), marginTop: 4 }} />
            </label>
            <label style={{ fontSize: 13 }}>
              Portfolio / Website
              <input value={profile.contact_info.portfolio_url} onChange={(e) => updateContactInfo("portfolio_url", e.target.value)} style={{ ...inputStyle(), marginTop: 4 }} />
            </label>
          </div>
        </div>
      </section>

      {/* Work Experiences */}
      <section style={{ marginBottom: 32 }}>
        <h2>Work Experiences ({profile.experiences.length})</h2>
        {profile.experiences.length === 0
          ? <p style={{ color: "#888", fontSize: 14 }}>No work experiences extracted.</p>
          : profile.experiences.map((e, i) => (
              <ExperienceEditor key={e.experience_id} entry={e} onUpdate={(f, v) => updateExperience("experiences", i, f, v)} onRemove={() => removeExperience("experiences", i)} showDateRange />
            ))}
      </section>

      {/* Education */}
      <section style={{ marginBottom: 32 }}>
        <h2>Education ({profile.education.length})</h2>
        {profile.education.length === 0
          ? <p style={{ color: "#888", fontSize: 14 }}>No education extracted.</p>
          : profile.education.map((e, i) => (
              <EducationEditor key={e.education_id} entry={e} onUpdate={(f, v) => updateEducation(i, f, v)} onRemove={() => removeEducation(i)} />
            ))}
      </section>

      {/* Projects */}
      <section style={{ marginBottom: 32 }}>
        <h2>Projects ({profile.projects.length})</h2>
        {profile.projects.length === 0
          ? <p style={{ color: "#888", fontSize: 14 }}>No projects extracted.</p>
          : profile.projects.map((p, i) => (
              <ExperienceEditor key={p.experience_id} entry={p} onUpdate={(f, v) => updateExperience("projects", i, f, v)} onRemove={() => removeExperience("projects", i)} showDateRange={false} />
            ))}
      </section>

      {/* Skills */}
      <section style={{ marginBottom: 32 }}>
        <h2>Skills ({profile.skills.length})</h2>
        {profile.skills.length === 0
          ? <p style={{ color: "#888", fontSize: 14 }}>No skills extracted.</p>
          : (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {profile.skills.map((skill, i) => (
                <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "4px 10px", background: "#eef", borderRadius: 20, fontSize: 13 }}>
                  {skill}
                  <button type="button" onClick={() => removeSkill(i)} style={{ background: "none", border: "none", cursor: "pointer", color: "#888", fontSize: 14, padding: 0, lineHeight: 1 }}>×</button>
                </span>
              ))}
            </div>
          )}
      </section>

      {/* Languages */}
      {profile.languages.length > 0 && (
        <section style={{ marginBottom: 32 }}>
          <h2>Languages ({profile.languages.length})</h2>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {profile.languages.map((l, i) => (
              <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "4px 10px", background: "#f0fff4", border: "1px solid #2d9", borderRadius: 20, fontSize: 13 }}>
                {l.language}{l.proficiency ? ` (${l.proficiency})` : ""}
                <button type="button" onClick={() => removeLanguage(i)} style={{ background: "none", border: "none", cursor: "pointer", color: "#888", fontSize: 14, padding: 0, lineHeight: 1 }}>×</button>
              </span>
            ))}
          </div>
        </section>
      )}

      {/* Certifications */}
      {profile.certifications.length > 0 && (
        <section style={{ marginBottom: 32 }}>
          <h2>Certifications ({profile.certifications.length})</h2>
          {profile.certifications.map((c, i) => (
            <CertificationEditor key={c.certification_id} entry={c} onUpdate={(f, v) => updateCertification(i, f, v)} onRemove={() => removeCertification(i)} />
          ))}
        </section>
      )}

      {/* Publications */}
      {profile.publications.length > 0 && (
        <section style={{ marginBottom: 32 }}>
          <h2>Publications ({profile.publications.length})</h2>
          {profile.publications.map((p, i) => (
            <PublicationEditor key={p.publication_id} entry={p} onUpdate={(f, v) => updatePublication(i, f, v)} onRemove={() => removePublication(i)} />
          ))}
        </section>
      )}

      {/* Achievements */}
      {profile.achievements.length > 0 && (
        <section style={{ marginBottom: 32 }}>
          <h2>Achievements ({profile.achievements.length})</h2>
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {profile.achievements.map((a, i) => (
              <li key={i} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
                <input value={a} onChange={(e) => updateAchievement(i, e.target.value)} style={inputStyle({ flex: 1 })} />
                <button type="button" onClick={() => removeAchievement(i)} style={{ color: "#b00", border: "none", background: "none", cursor: "pointer", fontSize: 13, flexShrink: 0 }}>Remove</button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Writing Preferences */}
      <section style={{ marginBottom: 32 }}>
        <h2>Writing Preferences</h2>
        <textarea
          value={profile.writing_preferences}
          onChange={(e) => setProfile((prev) => prev ? { ...prev, writing_preferences: e.target.value } : prev)}
          rows={3}
          placeholder="e.g. Direct and concise, avoid buzzwords, emphasize technical depth"
          style={{ ...inputStyle(), display: "block" }}
        />
      </section>

      {/* Target Preferences — required, always last */}
      <section style={{ marginBottom: 32, padding: 20, border: "1px solid #ddd", borderRadius: 8, background: "#fafafa" }}>
        <h2 style={{ marginTop: 0 }}>Target Preferences <span style={{ color: "#b00", fontSize: 14, fontWeight: "normal" }}>*required</span></h2>
        <p style={{ color: "#666", fontSize: 13, marginBottom: 20 }}>
          These are not extracted from your document — fill them in manually.
        </p>

        <div style={{ marginBottom: 18 }}>
          <label style={{ fontSize: 13, fontWeight: "bold", display: "block", marginBottom: 6 }}>Target Job Titles</label>
          <PillInput items={tp.target_titles} onChange={(v) => updateTargetPreferences("target_titles", v)} placeholder="e.g. Software Engineer, Product Manager" />
        </div>

        <div style={{ marginBottom: 18 }}>
          <label style={{ fontSize: 13, fontWeight: "bold", display: "block", marginBottom: 6 }}>Target Industries</label>
          <PillInput items={tp.target_industries} onChange={(v) => updateTargetPreferences("target_industries", v)} placeholder="e.g. FinTech, Healthcare, SaaS" />
        </div>

        <div style={{ marginBottom: 18 }}>
          <label style={{ fontSize: 13, fontWeight: "bold", display: "block", marginBottom: 6 }}>Work Mode</label>
          <select
            value={tp.work_mode}
            onChange={(e) => updateTargetPreferences("work_mode", e.target.value)}
            style={{ border: "1px solid #ddd", borderRadius: 4, padding: "6px 10px", fontSize: 13 }}
          >
            <option value="">Select work mode</option>
            <option value="Remote">Remote</option>
            <option value="Hybrid">Hybrid</option>
            <option value="On-site">On-site</option>
            <option value="Flexible">Flexible</option>
          </select>
        </div>

        <div style={{ marginBottom: 8 }}>
          <label style={{ fontSize: 13, fontWeight: "bold", display: "block", marginBottom: 6 }}>Target Locations</label>
          <PillInput items={tp.target_locations} onChange={(v) => updateTargetPreferences("target_locations", v)} placeholder="e.g. New York, San Francisco, Remote" />
        </div>

        {targetError && (
          <div style={{ marginTop: 12, color: "#b00", fontSize: 13 }}>{targetError}</div>
        )}
      </section>

      <div style={{ display: "flex", gap: 12 }}>
        <button
          onClick={handleSave}
          style={{ padding: "12px 28px", fontSize: 15, background: "#0070f3", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer" }}
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
