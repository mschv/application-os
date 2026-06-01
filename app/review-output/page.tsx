// Output review page — display generated application materials for user review and export
"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { invalidateFromEvidence, canRevise, AppState, WorkflowStep } from "@/lib/stateMachine";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type Tab = "resume" | "cover_letter" | "responses";

const TAB_LABELS: Record<Tab, string> = {
  resume: "Resume",
  cover_letter: "Cover Letter",
  responses: "Application Responses",
};

function tabContent(state: AppState, tab: Tab): string | null | undefined {
  if (tab === "resume") return state.generated_resume;
  if (tab === "cover_letter") return state.generated_cover_letter;
  return state.application_responses;
}

function AutoResizeTextarea({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (ref.current) {
      ref.current.style.height = "auto";
      ref.current.style.height = `${Math.max(400, ref.current.scrollHeight)}px`;
    }
  }, [value]);

  return (
    <textarea
      ref={ref}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{
        width: "100%",
        minHeight: 400,
        fontFamily: "monospace",
        fontSize: 13,
        lineHeight: 1.7,
        padding: 16,
        border: "1px solid #0070f3",
        borderRadius: 4,
        resize: "vertical",
        boxSizing: "border-box",
      }}
    />
  );
}

const DOWNLOAD_CONTACT = {
  candidateName: "Maria Susana Chang Vegas",
  email: "marisu.chang@gmail.com",
  phone: "+1 (607) 379-3864",
  location: "Ithaca, NY",
  linkedin: "linkedin.com/in/mariasusanachangv",
  portfolio: "mschv.github.io/portfolio",
};

export default function ReviewOutputPage() {
  const router = useRouter();

  const [appState, setAppState] = useState<AppState | null>(null);
  const [generateCoverLetter, setGenerateCoverLetter] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("resume");

  // Edited content per tab — null means unedited (use appState value)
  const [editedResume, setEditedResume] = useState<string | null>(null);
  const [editedCoverLetter, setEditedCoverLetter] = useState<string | null>(null);
  const [editedResponses, setEditedResponses] = useState<string | null>(null);

  // Draft state while editing (before Save Edits is clicked)
  const [draftContent, setDraftContent] = useState<string>("");
  const [editingTab, setEditingTab] = useState<Tab | null>(null);

  const [critiqueLoading, setCritiqueLoading] = useState(false);
  const [reviseLoading, setReviseLoading] = useState(false);
  const [regenerateLoading, setRegenerateLoading] = useState(false);
  const [approveLoading, setApproveLoading] = useState(false);
  const [downloadLoading, setDownloadLoading] = useState(false);
  const [clDownloadLoading, setClDownloadLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [clDownloadError, setClDownloadError] = useState<string | null>(null);

  // Load AppState from sessionStorage; auto-run critique if arriving at CRITIQUE step
  useEffect(() => {
    async function load() {
      const raw = sessionStorage.getItem("appState");
      const clFlag = sessionStorage.getItem("generateCoverLetter");
      if (!raw) {
        setError("No session found. Please start from job input.");
        return;
      }
      const state: AppState = JSON.parse(raw);
      setAppState(state);
      if (clFlag) setGenerateCoverLetter(JSON.parse(clFlag));

      if (state.current_step !== WorkflowStep.CRITIQUE) return;

      setCritiqueLoading(true);
      try {
        const res = await fetch("/api/critique", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ state }),
        });
        if (!res.ok) throw new Error(`Critique request failed: ${res.statusText}`);
        const result = await res.json();
        if (!result.success) throw new Error(result.error);
        setAppState(result.data);
        sessionStorage.setItem("appState", JSON.stringify(result.data));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Quality check failed.");
      } finally {
        setCritiqueLoading(false);
      }
    }
    load();
  }, []);

  function getDisplayContent(tab: Tab): string {
    if (tab === "resume") return editedResume ?? tabContent(appState!, tab) ?? "";
    if (tab === "cover_letter") return editedCoverLetter ?? tabContent(appState!, tab) ?? "";
    return editedResponses ?? tabContent(appState!, tab) ?? "";
  }

  function isEdited(tab: Tab): boolean {
    if (tab === "resume") return editedResume !== null;
    if (tab === "cover_letter") return editedCoverLetter !== null;
    return editedResponses !== null;
  }

  function handleEditClick(tab: Tab) {
    setDraftContent(getDisplayContent(tab));
    setEditingTab(tab);
  }

  function handleSaveEdits(tab: Tab) {
    if (tab === "resume") setEditedResume(draftContent);
    else if (tab === "cover_letter") setEditedCoverLetter(draftContent);
    else setEditedResponses(draftContent);
    setEditingTab(null);
  }

  function handleCancelEdit() {
    setEditingTab(null);
  }

  async function handleDownload() {
    if (!appState) return;
    setDownloadLoading(true);
    setDownloadError(null);
    try {
      const resumeText =
        editedResume ?? appState.final_resume ?? appState.generated_resume ?? "";
      const res = await fetch("/api/download-resume", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resumeText, ...DOWNLOAD_CONTACT }),
      });
      if (!res.ok) throw new Error(`Download failed: ${res.statusText}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "resume.docx";
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setDownloadError(err instanceof Error ? err.message : "Download failed.");
    } finally {
      setDownloadLoading(false);
    }
  }

  async function handleDownloadCoverLetter() {
    if (!appState) return;
    setClDownloadLoading(true);
    setClDownloadError(null);
    try {
      const coverLetterText =
        editedCoverLetter ??
        appState.final_cover_letter ??
        appState.generated_cover_letter ??
        "";
      const roleThemes = appState.extracted_requirements?.role_themes ?? [];
      const res = await fetch("/api/download-cover-letter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          coverLetterText,
          company: "",
          role: roleThemes[0] ?? "",
        }),
      });
      if (!res.ok) throw new Error(`Download failed: ${res.statusText}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "cover-letter.docx";
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setClDownloadError(err instanceof Error ? err.message : "Download failed.");
    } finally {
      setClDownloadLoading(false);
    }
  }

  async function handleRevise() {
    if (!appState) return;
    setReviseLoading(true);
    setError(null);
    const resumeToRevise = editedResume ?? appState.generated_resume;
    const stateForRevise: AppState = resumeToRevise
      ? { ...appState, generated_resume: resumeToRevise }
      : appState;
    try {
      const res = await fetch("/api/revise", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ state: stateForRevise }),
      });
      if (!res.ok) throw new Error(`Request failed: ${res.statusText}`);
      const result = await res.json();
      if (!result.success) throw new Error(result.error);
      setAppState(result.data);
      setEditedResume(null);
      setEditedCoverLetter(null);
      setEditedResponses(null);
      setEditingTab(null);
      sessionStorage.setItem("appState", JSON.stringify(result.data));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Revision failed. Please try again.");
    } finally {
      setReviseLoading(false);
    }
  }

  async function handleRegenerate() {
    if (!appState) return;
    setRegenerateLoading(true);
    setError(null);
    try {
      // Reset to STRATEGY via invalidateFromEvidence, then re-generate
      const resetState = invalidateFromEvidence(appState);

      const genRes = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ state: resetState, generateCoverLetter }),
      });
      if (!genRes.ok) throw new Error(`Generate failed: ${genRes.statusText}`);
      const genResult = await genRes.json();
      if (!genResult.success) throw new Error(genResult.error);

      // Auto-run critique on fresh content
      const critRes = await fetch("/api/critique", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ state: genResult.data }),
      });
      const critResult = critRes.ok ? await critRes.json() : null;
      const finalState = critResult?.success ? critResult.data : genResult.data;

      setAppState(finalState);
      setEditedResume(null);
      setEditedCoverLetter(null);
      setEditedResponses(null);
      setEditingTab(null);
      sessionStorage.setItem("appState", JSON.stringify(finalState));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Regeneration failed. Please try again.");
    } finally {
      setRegenerateLoading(false);
    }
  }

  async function handleApprove() {
    if (!appState) return;
    setApproveLoading(true);
    setError(null);
    try {
      const applicationId = crypto.randomUUID();
      const finalResume =
        editedResume ?? appState.final_resume ?? appState.generated_resume ?? "";
      const finalCoverLetter =
        editedCoverLetter ??
        appState.final_cover_letter ??
        appState.generated_cover_letter ??
        null;
      const roleThemes = appState.extracted_requirements?.role_themes ?? [];

      // Insert into job_applications
      const { error: appError } = await supabase.from("job_applications").insert({
        application_id: applicationId,
        user_id: appState.profile_id, // V1: profile_id as user_id until auth is wired
        company: "Unknown",           // V1: company not captured in current flow
        role: roleThemes[0] ?? "Unknown",
        job_description: appState.job_description ?? "",
        extracted_requirements: appState.extracted_requirements,
        status: "applied",
      });
      if (appError) throw new Error(`Failed to save application: ${appError.message}`);

      // Insert into application_versions
      const { error: versionError } = await supabase.from("application_versions").insert({
        application_id: applicationId,
        revision_count: appState.revision_count,
        generated_resume: appState.generated_resume,
        generated_cover_letter: appState.generated_cover_letter ?? null,
        critique_results: appState.critique_result,
        final_resume: finalResume,
        final_cover_letter: finalCoverLetter,
      });
      if (versionError) throw new Error(`Failed to save version: ${versionError.message}`);

      sessionStorage.removeItem("appState");
      sessionStorage.removeItem("generateCoverLetter");
      router.push(`/apply?profile_id=${appState.profile_id}&approved=1`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed. Please try again.");
    } finally {
      setApproveLoading(false);
    }
  }

  if (!appState) {
    return (
      <main style={{ maxWidth: 800, margin: "0 auto", padding: 24 }}>
        {error ?? "Loading…"}
      </main>
    );
  }

  const isLoading = critiqueLoading || reviseLoading || regenerateLoading || approveLoading;
  const editDisabled = isLoading;
  const reviseEnabled =
    canRevise(appState) &&
    appState.current_step === WorkflowStep.REVISION &&
    !isLoading;

  const { critique_result, revision_count } = appState;
  const availableTabs = (["resume", "cover_letter", "responses"] as Tab[]).filter(
    (tab) => !!tabContent(appState, tab)
  );
  const displayTab = availableTabs.includes(activeTab) ? activeTab : availableTabs[0] ?? "resume";

  return (
    <main style={{ maxWidth: 800, margin: "0 auto", padding: 24 }}>
      <h1>Review Your Application</h1>

      {/* Revision indicator */}
      {revision_count > 0 && (
        <p style={{ marginTop: 0, color: "#555", fontSize: 14 }}>
          Revision {revision_count} of 2
        </p>
      )}

      {/* Critique: loading */}
      {critiqueLoading && (
        <div style={{ padding: 10, background: "#f5f5f5", borderRadius: 4, marginBottom: 16 }}>
          Running quality check…
        </div>
      )}

      {/* Critique: results */}
      {critique_result && !critiqueLoading && (
        <section style={{ marginBottom: 24 }}>
          {critique_result.passed ? (
            <div
              style={{
                padding: 12,
                background: "#f4fff8",
                border: "1px solid #2d9",
                borderRadius: 4,
              }}
            >
              Quality check passed — no critical errors found.
            </div>
          ) : (
            <div
              style={{
                padding: 12,
                background: "#fff4f4",
                border: "1px solid #c44",
                borderRadius: 4,
              }}
            >
              <strong style={{ color: "#c00" }}>Critical Errors</strong>
              <ul style={{ margin: "8px 0 0 18px", padding: 0 }}>
                {critique_result.critical_errors.map((e, i) => (
                  <li key={i} style={{ color: "#b00", marginBottom: 6 }}>
                    <strong>[{e.type}]</strong> {e.description}
                    {e.experience_id && (
                      <span style={{ color: "#888", fontSize: 12 }}>
                        {" "}(exp: {e.experience_id})
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {critique_result.non_critical_issues.length > 0 && (
            <div
              style={{
                marginTop: 10,
                padding: 12,
                background: "#fffbea",
                border: "1px solid #e6a817",
                borderRadius: 4,
              }}
            >
              <strong style={{ color: "#8a5c00" }}>Suggestions</strong>
              <ul style={{ margin: "8px 0 0 18px", padding: 0 }}>
                {critique_result.non_critical_issues.map((issue, i) => (
                  <li key={i} style={{ color: "#7a4f00", fontSize: 14, marginBottom: 2 }}>
                    {issue}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      {/* Tabs */}
      {availableTabs.length > 0 && (
        <>
          <div
            style={{
              display: "flex",
              alignItems: "flex-end",
              borderBottom: "2px solid #ddd",
              marginBottom: 16,
            }}
          >
            {availableTabs.map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => { setActiveTab(tab); setEditingTab(null); }}
                style={{
                  padding: "8px 16px",
                  border: "none",
                  borderBottom:
                    displayTab === tab ? "2px solid #0070f3" : "2px solid transparent",
                  background: "none",
                  cursor: "pointer",
                  fontWeight: displayTab === tab ? "bold" : "normal",
                  color: displayTab === tab ? "#0070f3" : "#333",
                  marginBottom: -2,
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                {TAB_LABELS[tab]}
                {isEdited(tab) && editingTab !== tab && (
                  <span
                    style={{
                      fontSize: 10,
                      background: "#e8f0fe",
                      color: "#1a56db",
                      borderRadius: 3,
                      padding: "1px 5px",
                      fontWeight: "normal",
                      lineHeight: 1.6,
                    }}
                  >
                    Edited
                  </span>
                )}
              </button>
            ))}

            {/* Edit / Save Edits toggle — right side of tab bar */}
            <div style={{ marginLeft: "auto", marginBottom: 2 }}>
              {editingTab === displayTab ? (
                <span style={{ display: "flex", gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => handleSaveEdits(displayTab)}
                    style={{
                      fontSize: 13,
                      padding: "4px 12px",
                      background: "#0070f3",
                      color: "#fff",
                      border: "none",
                      borderRadius: 4,
                      cursor: "pointer",
                    }}
                  >
                    Save Edits
                  </button>
                  <button
                    type="button"
                    onClick={handleCancelEdit}
                    style={{
                      fontSize: 13,
                      padding: "4px 10px",
                      background: "none",
                      border: "1px solid #ccc",
                      borderRadius: 4,
                      cursor: "pointer",
                      color: "#555",
                    }}
                  >
                    Cancel
                  </button>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => !editDisabled && handleEditClick(displayTab)}
                  disabled={editDisabled}
                  style={{
                    fontSize: 13,
                    padding: "4px 12px",
                    background: "none",
                    border: "1px solid #ccc",
                    borderRadius: 4,
                    cursor: editDisabled ? "not-allowed" : "pointer",
                    color: editDisabled ? "#aaa" : "#333",
                  }}
                >
                  Edit
                </button>
              )}
            </div>
          </div>

          <section style={{ marginBottom: 16 }}>
            {editingTab === displayTab ? (
              <AutoResizeTextarea value={draftContent} onChange={setDraftContent} />
            ) : (
              <pre
                style={{
                  whiteSpace: "pre-wrap",
                  fontFamily: "monospace",
                  fontSize: 13,
                  lineHeight: 1.7,
                  background: "#fafafa",
                  padding: 16,
                  borderRadius: 4,
                  border: "1px solid #eee",
                  maxHeight: 500,
                  overflowY: "auto",
                  margin: 0,
                }}
              >
                {getDisplayContent(displayTab)}
              </pre>
            )}
          </section>

          {/* Download button — Cover Letter tab only */}
          {displayTab === "cover_letter" && editingTab !== "cover_letter" && (
            <div style={{ marginBottom: 28 }}>
              <button
                type="button"
                onClick={handleDownloadCoverLetter}
                disabled={clDownloadLoading || isLoading}
                style={{
                  fontSize: 13,
                  padding: "6px 14px",
                  background: "none",
                  border: "1px solid #ccc",
                  borderRadius: 4,
                  cursor: clDownloadLoading || isLoading ? "not-allowed" : "pointer",
                  color: clDownloadLoading || isLoading ? "#aaa" : "#333",
                }}
              >
                {clDownloadLoading ? "Generating…" : "Download Cover Letter (.docx)"}
              </button>
              {clDownloadError && (
                <div style={{ color: "#b00", fontSize: 13, marginTop: 6 }}>
                  {clDownloadError}
                </div>
              )}
            </div>
          )}

          {/* Download button — Resume tab only */}
          {displayTab === "resume" && editingTab !== "resume" && (
            <div style={{ marginBottom: 28 }}>
              <button
                type="button"
                onClick={handleDownload}
                disabled={downloadLoading || isLoading}
                style={{
                  fontSize: 13,
                  padding: "6px 14px",
                  background: "none",
                  border: "1px solid #ccc",
                  borderRadius: 4,
                  cursor: downloadLoading || isLoading ? "not-allowed" : "pointer",
                  color: downloadLoading || isLoading ? "#aaa" : "#333",
                }}
              >
                {downloadLoading ? "Generating…" : "Download Resume (.docx)"}
              </button>
              {downloadError && (
                <div style={{ color: "#b00", fontSize: 13, marginTop: 6 }}>
                  {downloadError}
                </div>
              )}
            </div>
          )}
        </>
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

      {/* Action buttons */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
        <button
          onClick={handleApprove}
          disabled={isLoading}
          style={{
            padding: "12px 24px",
            fontSize: 15,
            background: isLoading ? "#ccc" : "#2a9d8f",
            color: "#fff",
            border: "none",
            borderRadius: 4,
            cursor: isLoading ? "not-allowed" : "pointer",
          }}
        >
          {approveLoading ? "Saving…" : "Approve & Save"}
        </button>

        <button
          onClick={handleRevise}
          disabled={!reviseEnabled}
          title={
            !canRevise(appState)
              ? "Maximum revisions (2) reached"
              : appState.current_step !== WorkflowStep.REVISION
              ? "No revision needed — critique passed"
              : undefined
          }
          style={{ padding: "12px 24px", fontSize: 15 }}
        >
          {reviseLoading
            ? "Revising…"
            : revision_count > 0
            ? `Revise (${revision_count}/2)`
            : "Revise"}
        </button>

        <button
          onClick={handleRegenerate}
          disabled={isLoading}
          style={{ padding: "12px 24px", fontSize: 15 }}
        >
          {regenerateLoading ? "Regenerating…" : "Regenerate"}
        </button>
      </div>
    </main>
  );
}
