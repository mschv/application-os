// Job input page — accept job description and application questions
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createInitialState, transition, AppState } from "@/lib/stateMachine";
import { getProfileId } from "@/lib/profile";

export default function ApplyPage() {
  const router = useRouter();

  const [profileId, setProfileId] = useState<string | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);

  const [jobDescription, setJobDescription] = useState("");
  const [applicationQuestions, setApplicationQuestions] = useState("");
  const [generateCoverLetter, setGenerateCoverLetter] = useState(true);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const id = getProfileId();
    if (!id) {
      router.replace("/setup");
      return;
    }
    setProfileId(id);
    setProfileLoading(false);
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!profileId) {
      setError("Profile not loaded. Please refresh and try again.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const initialState = createInitialState();
      const toJobInput = transition(initialState, {
        type: "START_JOB_INPUT",
        profile_id: profileId,
      });
      if (!toJobInput.success) throw new Error(toJobInput.error);

      const response = await fetch("/api/analyze-job", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          state: toJobInput.data,
          jobDescription,
          profileId,
        }),
      });

      if (!response.ok) {
        throw new Error(`Request failed: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      if (!result.success) throw new Error(result.error);

      const updatedState: AppState = {
        ...result.data,
        application_questions: applicationQuestions.trim() || null,
      };

      sessionStorage.setItem("appState", JSON.stringify(updatedState));
      sessionStorage.setItem("generateCoverLetter", JSON.stringify(generateCoverLetter));

      router.push("/review-output");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Analysis failed. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  if (profileLoading) {
    return (
      <main style={{ maxWidth: 800, margin: "0 auto", padding: 24 }}>
        Loading profile…
      </main>
    );
  }

  return (
    <main style={{ maxWidth: 800, margin: "0 auto", padding: 24 }}>
      <h1>Add a Job</h1>

      <form onSubmit={handleSubmit}>
        <section style={{ marginBottom: 24 }}>
          <label>
            <strong>Job Description *</strong>
            <textarea
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
              required
              rows={12}
              placeholder="Paste the full job description here…"
              style={{ display: "block", width: "100%", marginTop: 6 }}
            />
          </label>
        </section>

        <section style={{ marginBottom: 24 }}>
          <label>
            <strong>Application Questions</strong>{" "}
            <span style={{ fontWeight: "normal", color: "#666" }}>(optional)</span>
            <textarea
              value={applicationQuestions}
              onChange={(e) => setApplicationQuestions(e.target.value)}
              rows={5}
              placeholder="Paste any supplemental application questions here…"
              style={{ display: "block", width: "100%", marginTop: 6 }}
            />
          </label>
        </section>

        <section style={{ marginBottom: 32 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={generateCoverLetter}
              onChange={(e) => setGenerateCoverLetter(e.target.checked)}
            />
            <strong>Generate cover letter</strong>
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
          disabled={loading || !profileId}
          style={{ padding: "12px 28px", fontSize: 16 }}
        >
          {loading ? "Analyzing job…" : "Analyze & Continue"}
        </button>
      </form>
    </main>
  );
}
