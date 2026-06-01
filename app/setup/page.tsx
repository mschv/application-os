// Profile setup — upload raw document, set writing style, save to Supabase
"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { saveProfileIdLocally } from "@/lib/profile";

type Screen = "upload" | "style" | "saving" | "saved" | "error";

const MAX_FILE_SIZE = 5 * 1024 * 1024;

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function SetupPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [screen, setScreen] = useState<Screen>("upload");
  const [errorMessage, setErrorMessage] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [fileName, setFileName] = useState("");
  const [fileSize, setFileSize] = useState(0);
  const [rawDocument, setRawDocument] = useState("");
  const [writingStyle, setWritingStyle] = useState("");
  const [savedProfileId, setSavedProfileId] = useState("");

  async function processFile(file: File) {
    if (file.size > MAX_FILE_SIZE) {
      setErrorMessage(`File too large (${formatBytes(file.size)}). Maximum is 5 MB.`);
      setScreen("error");
      return;
    }

    setFileName(file.name);
    setFileSize(file.size);

    try {
      const text = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error("Failed to read file"));
        reader.readAsText(file);
      });

      setRawDocument(text);
      setScreen("style");
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to read file.");
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

  async function handleSave() {
    setScreen("saving");

    try {
      const res = await fetch("/api/save-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          raw_document: rawDocument,
          writing_style: writingStyle.trim() || null,
        }),
      });

      const result = await res.json();
      if (!result.success) throw new Error(result.error);

      const profileId: string = result.data.profile_id;
      saveProfileIdLocally(profileId);

      if (process.env.NEXT_PUBLIC_PROFILE_ID) {
        router.push("/apply");
      } else {
        setSavedProfileId(profileId);
        setScreen("saved");
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to save profile.");
      setScreen("error");
    }
  }

  function resetToUpload() {
    setScreen("upload");
    setErrorMessage("");
    setFileName("");
    setFileSize(0);
    setRawDocument("");
    setWritingStyle("");
    setSavedProfileId("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  // ── Screens ──

  if (screen === "upload") {
    return (
      <main style={{ maxWidth: 640, margin: "0 auto", padding: 24 }}>
        <h1>Set Up Your Profile</h1>
        <p style={{ color: "#555", marginBottom: 24 }}>
          Upload your resume or CV as a text file. We&rsquo;ll use it to generate tailored
          applications.
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
          <div style={{ color: "#aaa", fontSize: 12 }}>TXT or MD recommended — PDF, max 5 MB</div>
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

  if (screen === "style") {
    return (
      <main style={{ maxWidth: 640, margin: "0 auto", padding: 24 }}>
        <h1>Set Up Your Profile</h1>
        <p style={{ color: "#555", marginBottom: 4 }}>
          Loaded: <strong>{fileName}</strong>{" "}
          <span style={{ color: "#aaa", fontSize: 13 }}>({formatBytes(fileSize)})</span>
        </p>
        <button
          type="button"
          onClick={resetToUpload}
          style={{
            background: "none",
            border: "none",
            padding: 0,
            color: "#0070f3",
            cursor: "pointer",
            fontSize: 13,
            marginBottom: 28,
          }}
        >
          ← Upload a different file
        </button>

        <section style={{ marginBottom: 32 }}>
          <label style={{ display: "block", fontWeight: "bold", marginBottom: 8 }}>
            How should your applications sound?{" "}
            <span style={{ fontWeight: "normal", color: "#888", fontSize: 13 }}>
              (optional)
            </span>
          </label>
          <textarea
            value={writingStyle}
            onChange={(e) => setWritingStyle(e.target.value)}
            rows={5}
            placeholder="e.g. Direct and concise. Lead with impact not action. Avoid buzzwords. First person. No more than 2 lines per bullet."
            style={{
              width: "100%",
              border: "1px solid #ddd",
              borderRadius: 4,
              padding: "8px 10px",
              fontSize: 14,
              lineHeight: 1.5,
              resize: "vertical",
            }}
          />
          <p style={{ color: "#888", fontSize: 12, marginTop: 6 }}>
            This guides how Claude writes your resume bullets and cover letter.
            Leave blank to use default professional tone.
          </p>
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
            Save and Continue
          </button>
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

  if (screen === "saved") {
    return (
      <main style={{ maxWidth: 640, margin: "0 auto", padding: 24 }}>
        <h1>Profile Saved</h1>
        <p style={{ marginBottom: 16 }}>
          Profile saved. To make this permanent across sessions, add this to your
          Vercel environment variables:
        </p>
        <div
          style={{
            background: "#f5f5f5",
            border: "1px solid #ddd",
            borderRadius: 6,
            padding: "12px 16px",
            fontFamily: "monospace",
            fontSize: 14,
            marginBottom: 12,
            wordBreak: "break-all",
          }}
        >
          NEXT_PUBLIC_PROFILE_ID = {savedProfileId}
        </div>
        <div style={{ marginBottom: 24 }}>
          <button
            onClick={() => navigator.clipboard.writeText(savedProfileId)}
            style={{ padding: "8px 16px", fontSize: 13 }}
          >
            Copy Profile ID
          </button>
        </div>
        <p style={{ color: "#555", fontSize: 14, marginBottom: 24 }}>
          Then redeploy. You only need to do this once.
        </p>
        <button
          onClick={() => router.push("/apply")}
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
          Continue to Apply
        </button>
      </main>
    );
  }

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
