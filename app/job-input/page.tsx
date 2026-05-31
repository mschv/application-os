// Job input page — accept job posting URL or pasted job description
"use client";

import { Suspense, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { createInitialState, transition, AppState } from "@/lib/stateMachine";
import { Experience } from "@/lib/types";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

function JobInputContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [profileId, setProfileId] = useState<string | null>(null);
  const [experiences, setExperiences] = useState<Experience[]>([]);
  const [profileLoading, setProfileLoading] = useState(true);

  const [jobDescription, setJobDescription] = useState("");
  const [applicationQuestions, setApplicationQuestions] = useState("");
  const [generateCoverLetter, setGenerateCoverLetter] = useState(true);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Read profile_id from Supabase on mount
  useEffect(() => {
    async function loadProfile() {
      const urlProfileId = searchParams.get("profile_id");
      if (!urlProfileId) {
        setError("No profile found. Please complete profile setup first.");
        setProfileLoading(false);
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("master_profile")
        .select("profile_id")
        .eq("profile_id", urlProfileId)
        .single();

      if (profileError || !profile) {
        setError("Profile not found. Please complete profile setup first.");
        setProfileLoading(false);
        return;
      }

      const { data: expRows, error: expError } = await supabase
        .from("experiences")
        .select("*")
        .eq("profile_id", urlProfileId);

      if (expError) {
        setError(`Failed to load profile experiences: ${expError.message}`);
        setProfileLoading(false);
        return;
      }

      setProfileId(profile.profile_id);
      setExperiences(
        (expRows ?? []).map((row) => ({
          experience_id: row.experience_id,
          title: row.title,
          description: row.description,
          skills: row.skills ?? [],
          tags: row.tags ?? [],
          metrics: row.metrics ?? [],
          date_range: row.date_range ?? "",
        }))
      );
      setProfileLoading(false);
    }

    loadProfile();
  }, [searchParams]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!profileId) {
      setError("Profile not loaded. Please refresh and try again.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Build state at JOB_INPUT via createInitialState + START_JOB_INPUT
      const initialState = createInitialState();
      const toJobInput = transition(initialState, {
        type: "START_JOB_INPUT",
        profile_id: profileId,
      });
      if (!toJobInput.success) {
        throw new Error(toJobInput.error);
      }

      // Call POST /api/analyze-job
      const response = await fetch("/api/analyze-job", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          state: toJobInput.data,
          jobDescription,
          experiences,
        }),
      });

      if (!response.ok) {
        throw new Error(`Request failed: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error);
      }

      // PATCH: analyze-job route doesn't forward application_questions
      // so we reattach it here before storing state.
      // Fix in V2: add application_questions to the route body.
      const updatedState: AppState = {
        ...result.data,
        application_questions: applicationQuestions.trim() || null,
      };

      // Store in sessionStorage and proceed
      sessionStorage.setItem("appState", JSON.stringify(updatedState));
      // V2: Add cover_letter_enabled field to AppState
      // to avoid split sessionStorage state.
      sessionStorage.setItem("generateCoverLetter", JSON.stringify(generateCoverLetter));

      router.push("/evidence-review");
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

export default function JobInputPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <JobInputContent />
    </Suspense>
  );
}
