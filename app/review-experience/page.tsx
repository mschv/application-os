// Evidence review page — display and confirm retrieved resume evidence for the job
"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  createInitialState,
  transition,
  invalidateFromEvidence,
  AppState,
  WorkflowStep,
} from "@/lib/stateMachine";
import { RetrievedExperience } from "@/lib/types";

function ExperienceCard({
  re,
  onToggle,
}: {
  re: RetrievedExperience;
  onToggle: () => void;
}) {
  const [showReasons, setShowReasons] = useState(false);

  return (
    <div
      style={{
        border: `1px solid ${re.selected ? "#2d9" : "#ccc"}`,
        borderRadius: 6,
        padding: 14,
        marginBottom: 10,
        background: re.selected ? "#f4fff8" : "#fafafa",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <strong>{re.experience.title}</strong>
          {re.experience.date_range && (
            <span style={{ marginLeft: 8, color: "#666", fontSize: 13 }}>
              {re.experience.date_range}
            </span>
          )}
          <div style={{ fontSize: 13, color: "#555", marginTop: 4 }}>
            Relevance score: <strong>{re.relevance_score}</strong>
          </div>
        </div>
        <button type="button" onClick={onToggle}>
          {re.selected ? "Deselect" : "Select"}
        </button>
      </div>

      <button
        type="button"
        onClick={() => setShowReasons((v) => !v)}
        style={{
          marginTop: 8,
          background: "none",
          border: "none",
          padding: 0,
          color: "#0070f3",
          cursor: "pointer",
          fontSize: 13,
        }}
      >
        {showReasons
          ? "Hide reasons"
          : `Show match reasons (${re.match_reasons.length})`}
      </button>

      {showReasons && (
        <ul style={{ marginTop: 6, paddingLeft: 18, fontSize: 13, margin: "6px 0 0 18px" }}>
          {re.match_reasons.length > 0 ? (
            re.match_reasons.map((reason, i) => <li key={i}>{reason}</li>)
          ) : (
            <li style={{ color: "#888" }}>No match reasons — below relevance threshold.</li>
          )}
        </ul>
      )}
    </div>
  );
}

export default function ReviewExperiencePage() {
  const router = useRouter();

  const [appState, setAppState] = useState<AppState | null>(null);
  const [generateCoverLetter, setGenerateCoverLetter] = useState(true);
  const [experiences, setExperiences] = useState<RetrievedExperience[]>([]);

  const [pendingRerun, setPendingRerun] = useState(false);
  const [rerunLoading, setRerunLoading] = useState(false);
  const [generateLoading, setGenerateLoading] = useState(false);

  const [diffMessage, setDiffMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Load AppState from sessionStorage on mount
  useEffect(() => {
    const raw = sessionStorage.getItem("appState");
    const clFlag = sessionStorage.getItem("generateCoverLetter");
    if (!raw) {
      setError("No session found. Please start from job input.");
      return;
    }
    const state: AppState = JSON.parse(raw);
    setAppState(state);
    setExperiences(state.retrieved_experiences);
    if (clFlag) setGenerateCoverLetter(JSON.parse(clFlag));
  }, []);

  function toggleExperience(experienceId: string) {
    setExperiences((prev) =>
      prev.map((re) =>
        re.experience.experience_id === experienceId
          ? { ...re, selected: !re.selected }
          : re
      )
    );
    setPendingRerun(true);
    setDiffMessage(null);
  }

  const rerunAnalysis = useCallback(
    async (currentExperiences: RetrievedExperience[], currentState: AppState) => {
      if (!currentState.job_description || !currentState.profile_id) return;

      setRerunLoading(true);
      setError(null);

      try {
        // Reconstruct a JOB_INPUT state to satisfy the route's transition guard
        const freshState = createInitialState();
        const toJobInput = transition(freshState, {
          type: "START_JOB_INPUT",
          profile_id: currentState.profile_id,
        });
        if (!toJobInput.success) throw new Error(toJobInput.error);

        const rawExperiences = currentExperiences.map((re) => re.experience);

        const response = await fetch("/api/analyze-job", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            state: toJobInput.data,
            jobDescription: currentState.job_description,
            experiences: rawExperiences,
          }),
        });

        if (!response.ok) throw new Error(`Request failed: ${response.statusText}`);
        const result = await response.json();
        if (!result.success) throw new Error(result.error);

        const freshRetrieved: RetrievedExperience[] = result.data.retrieved_experiences;

        // Preserve user's manual selection; refresh scores and reasons from new analysis
        const userSelectionMap = new Map(
          currentExperiences.map((re) => [re.experience.experience_id, re.selected])
        );
        const merged = freshRetrieved.map((re) => ({
          ...re,
          selected: userSelectionMap.has(re.experience.experience_id)
            ? userSelectionMap.get(re.experience.experience_id)!
            : re.selected,
        }));

        // Diff: how many experiences the LLM would auto-select vs user's selection
        const llmCount = freshRetrieved.filter((re) => re.selected).length;
        const userCount = merged.filter((re) => re.selected).length;
        setDiffMessage(
          `Analysis refreshed. LLM suggests ${llmCount} experience${llmCount !== 1 ? "s" : ""}; ` +
            `you have ${userCount} selected.`
        );

        // Invalidate downstream state, then restore fresh requirements
        const invalidated = invalidateFromEvidence({
          ...currentState,
          retrieved_experiences: merged,
        });
        const updatedState: AppState = {
          ...invalidated,
          extracted_requirements: result.data.extracted_requirements,
          application_questions: currentState.application_questions,
        };

        setAppState(updatedState);
        setExperiences(merged);
        sessionStorage.setItem("appState", JSON.stringify(updatedState));
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Re-analysis failed. Please try again."
        );
      } finally {
        setRerunLoading(false);
      }
    },
    []
  );

  // Debounce: re-run analysis 1s after the last toggle
  useEffect(() => {
    if (!pendingRerun || !appState) return;
    const timer = setTimeout(() => {
      setPendingRerun(false);
      rerunAnalysis(experiences, appState);
    }, 1000);
    return () => clearTimeout(timer);
  }, [pendingRerun, experiences, appState, rerunAnalysis]);

  async function handleProceed() {
    if (!appState) return;
    setGenerateLoading(true);
    setError(null);

    try {
      const stateForGenerate: AppState = {
        ...appState,
        retrieved_experiences: experiences,
        current_step: WorkflowStep.EVIDENCE_REVIEW,
      };

      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          state: stateForGenerate,
          generateCoverLetter,
        }),
      });

      if (!response.ok) throw new Error(`Request failed: ${response.statusText}`);
      const result = await response.json();
      if (!result.success) throw new Error(result.error);

      sessionStorage.setItem("appState", JSON.stringify(result.data));
      router.push("/review-output");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Generation failed. Please try again."
      );
    } finally {
      setGenerateLoading(false);
    }
  }

  if (!appState) {
    return (
      <main style={{ maxWidth: 800, margin: "0 auto", padding: 24 }}>
        {error ?? "Loading…"}
      </main>
    );
  }

  const selected = experiences.filter((re) => re.selected);
  const rejected = experiences.filter((re) => !re.selected);
  const canProceed = selected.length > 0 && !rerunLoading && !generateLoading && !pendingRerun;

  return (
    <main style={{ maxWidth: 800, margin: "0 auto", padding: 24 }}>
      <h1>Review Evidence</h1>
      <p>
        These experiences were matched against the job requirements. Toggle any
        experience to include or exclude it from your application.
      </p>

      {(rerunLoading || pendingRerun) && (
        <div style={{ padding: 10, background: "#f5f5f5", borderRadius: 4, marginBottom: 16 }}>
          Re-analyzing with updated selection…
        </div>
      )}

      {diffMessage && !rerunLoading && !pendingRerun && (
        <div style={{ padding: 10, background: "#eef6ff", borderRadius: 4, marginBottom: 16 }}>
          {diffMessage}
        </div>
      )}

      {/* Selected */}
      <section style={{ marginBottom: 32 }}>
        <h2>Selected ({selected.length})</h2>
        {selected.length === 0 ? (
          <p style={{ color: "#888" }}>
            No experiences selected. Select at least one to proceed.
          </p>
        ) : (
          selected.map((re) => (
            <ExperienceCard
              key={re.experience.experience_id}
              re={re}
              onToggle={() => toggleExperience(re.experience.experience_id)}
            />
          ))
        )}
      </section>

      {/* Rejected */}
      {rejected.length > 0 && (
        <section style={{ marginBottom: 32 }}>
          <h2>Not Selected ({rejected.length})</h2>
          {rejected.map((re) => (
            <ExperienceCard
              key={re.experience.experience_id}
              re={re}
              onToggle={() => toggleExperience(re.experience.experience_id)}
            />
          ))}
        </section>
      )}

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
        onClick={handleProceed}
        disabled={!canProceed}
        style={{ padding: "12px 28px", fontSize: 16 }}
      >
        {generateLoading ? "Generating materials…" : "Generate Application Materials"}
      </button>
    </main>
  );
}
