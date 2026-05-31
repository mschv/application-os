// LLM client — wrapper for Anthropic API calls used across pipeline steps

import Anthropic from "@anthropic-ai/sdk";
import { config } from "./config";
import {
  JobRequirements,
  RetrievedExperience,
  CritiqueResult,
  Result,
} from "./types";

const client = new Anthropic({ apiKey: config.anthropic.apiKey });
const MODEL = "claude-sonnet-4-5";

async function callClaude(prompt: string, maxTokens: number): Promise<string> {
  const message = await client.messages.create({
    model: MODEL,
    max_tokens: maxTokens,
    messages: [{ role: "user", content: prompt }],
  });
  const block = message.content[0];
  if (block.type !== "text") {
    throw new Error("Unexpected non-text response from Claude");
  }
  return block.text;
}

function extractJson<T>(text: string): T {
  const blockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (blockMatch) {
    return JSON.parse(blockMatch[1].trim()) as T;
  }
  const rawMatch = text.match(/\{[\s\S]*\}/);
  if (rawMatch) {
    return JSON.parse(rawMatch[0]) as T;
  }
  throw new Error("No JSON object found in Claude response");
}

export async function analyzeJob(
  jobDescription: string
): Promise<Result<JobRequirements>> {
  try {
    const prompt = `Analyze the following job description and extract structured requirements.

Job Description:
${jobDescription}

Return a JSON object with exactly this structure:
{
  "required_skills": ["skill1", "skill2"],
  "preferred_skills": ["skill1", "skill2"],
  "keywords": ["keyword1", "keyword2"],
  "seniority_level": "junior|mid|senior|staff|principal|executive",
  "role_themes": ["theme1", "theme2"]
}

required_skills: skills explicitly required or listed as must-have
preferred_skills: skills listed as nice-to-have or preferred
keywords: important domain terms, technologies, methodologies
seniority_level: inferred level from the description
role_themes: high-level themes (e.g. "backend engineering", "cross-functional collaboration")

Return only the JSON object, no other text.`;

    const text = await callClaude(prompt, 1024);
    const data = extractJson<JobRequirements>(text);
    return { success: true, data };
  } catch (error) {
    return {
      success: false,
      error: `analyzeJob failed: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

export async function generateStrategy(
  requirements: JobRequirements,
  selectedExperiences: RetrievedExperience[]
): Promise<Result<string>> {
  try {
    const experienceSummary = selectedExperiences
      .map(
        (re) =>
          `[${re.experience.experience_id}] ${re.experience.title} — ${re.experience.description.slice(0, 200)} (relevance: ${re.relevance_score}, matches: ${re.match_reasons.join("; ")})`
      )
      .join("\n");

    const prompt = `Create a job application strategy document.

Job Requirements:
- Required skills: ${requirements.required_skills.join(", ")}
- Preferred skills: ${requirements.preferred_skills.join(", ")}
- Seniority level: ${requirements.seniority_level}
- Role themes: ${requirements.role_themes.join(", ")}
- Keywords: ${requirements.keywords.join(", ")}

Selected Experiences:
${experienceSummary}

Produce a structured plain-text strategy document that:
1. Maps each experience ID to the specific requirements it satisfies
2. Determines the narrative arc and which story to tell
3. Specifies which experiences to lead with and why
4. Lists keywords to emphasize and where
5. Notes any requirement gaps and how to address them honestly

Reference experience IDs explicitly throughout.`;

    const data = await callClaude(prompt, 1024);
    return { success: true, data };
  } catch (error) {
    return {
      success: false,
      error: `generateStrategy failed: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

export async function generateResume(
  strategy: string,
  selectedExperiences: RetrievedExperience[],
  requirements: JobRequirements
): Promise<Result<string>> {
  try {
    const experienceDetails = selectedExperiences
      .map(
        (re) =>
          `Experience ID: ${re.experience.experience_id}
Title: ${re.experience.title}
Date Range: ${re.experience.date_range}
Description: ${re.experience.description}
Skills: ${re.experience.skills.join(", ")}
Metrics: ${re.experience.metrics.join(", ")}`
      )
      .join("\n\n---\n\n");

    const prompt = `Write an ATS-optimized resume.

Strategy:
${strategy}

Source Experiences (ground truth — use only these facts):
${experienceDetails}

Target Requirements:
- Required skills: ${requirements.required_skills.join(", ")}
- Keywords: ${requirements.keywords.join(", ")}
- Seniority: ${requirements.seniority_level}

RULES:
- Every bullet point MUST end with [exp:EXPERIENCE_ID] citing its source experience
- Use only facts present in the source experiences — no invented claims
- Incorporate required skills and keywords naturally
- Use strong action verbs; quantify impact using metrics from the experiences only
- ATS format: clean plain text, standard section headers, no tables or graphics

Return the complete resume as plain text.`;

    const data = await callClaude(prompt, 4096);
    return { success: true, data };
  } catch (error) {
    return {
      success: false,
      error: `generateResume failed: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

export async function generateCoverLetter(
  strategy: string,
  requirements: JobRequirements,
  jobDescription: string
): Promise<Result<string>> {
  try {
    const prompt = `Write a targeted cover letter.

Strategy:
${strategy}

Job Description:
${jobDescription}

Role Themes: ${requirements.role_themes.join(", ")}
Seniority Level: ${requirements.seniority_level}
Required Skills: ${requirements.required_skills.join(", ")}

Write a cover letter that:
- Opens with genuine motivation for this specific role
- Connects 2–3 key experiences directly to the role's core requirements
- Uses the role themes to frame the narrative
- Closes with a specific, confident call to action
- Is 3–4 paragraphs, professional but not generic
- Is fully consistent with the resume that would be generated from this strategy

Return only the cover letter body text, no subject line or metadata.`;

    const data = await callClaude(prompt, 2048);
    return { success: true, data };
  } catch (error) {
    return {
      success: false,
      error: `generateCoverLetter failed: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

export async function generateApplicationResponses(
  questions: string,
  selectedExperiences: RetrievedExperience[],
  requirements: JobRequirements
): Promise<Result<string>> {
  try {
    const experienceSummary = selectedExperiences
      .map(
        (re) =>
          `[${re.experience.experience_id}] ${re.experience.title}: ${re.experience.description} | metrics: ${re.experience.metrics.join(", ")}`
      )
      .join("\n\n");

    const prompt = `Answer job application questions using only the provided evidence.

Application Questions:
${questions}

Available Evidence:
${experienceSummary}

Role Context:
- Required skills: ${requirements.required_skills.join(", ")}
- Themes: ${requirements.role_themes.join(", ")}
- Seniority: ${requirements.seniority_level}

RULES:
- Answer each question using only the provided experiences — no fabricated details
- Cite every factual claim with [exp:EXPERIENCE_ID]
- Use concrete metrics and outcomes present in the experiences
- Keep answers consistent with what the resume from this evidence set would say
- Format: question number, then a clear response paragraph

Return all answers as plain text.`;

    const data = await callClaude(prompt, 2048);
    return { success: true, data };
  } catch (error) {
    return {
      success: false,
      error: `generateApplicationResponses failed: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

export async function critique(
  resume: string,
  requirements: JobRequirements,
  selectedExperiences: RetrievedExperience[]
): Promise<Result<CritiqueResult>> {
  try {
    const experienceFacts = selectedExperiences
      .map(
        (re) =>
          `[${re.experience.experience_id}] ${re.experience.title}: ${re.experience.description} | metrics: ${re.experience.metrics.join(", ")} | skills: ${re.experience.skills.join(", ")}`
      )
      .join("\n");

    const prompt = `You are a strict resume auditor. Audit this resume against its source evidence.

Resume:
${resume}

Source Experiences (the only valid facts):
${experienceFacts}

Required Skills (all must appear in the resume): ${requirements.required_skills.join(", ")}

Check for CRITICAL errors — any one causes failure:
- unsupported_claim: a bullet makes a claim not traceable to any source experience
- fabricated_metric: a number or metric not present in the source experiences
- missing_required_skill: a required skill is absent from the resume entirely

Check for NON-CRITICAL issues: style, weak phrasing, missing keywords, formatting.

Return a JSON object with exactly this structure:
{
  "critical_errors": [
    {
      "type": "unsupported_claim",
      "description": "specific description",
      "experience_id": "id if applicable"
    }
  ],
  "non_critical_issues": ["issue1", "issue2"],
  "passed": false
}

Set "passed" to true only if critical_errors is an empty array. Return only the JSON object.`;

    const text = await callClaude(prompt, 2048);
    const parsed = extractJson<CritiqueResult>(text);
    // Enforce the invariant: passed is true iff there are no critical errors
    const data: CritiqueResult = {
      ...parsed,
      passed: parsed.critical_errors.length === 0,
    };
    return { success: true, data };
  } catch (error) {
    return {
      success: false,
      error: `critique failed: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

export async function revise(
  resume: string,
  critiqueResult: CritiqueResult,
  selectedExperiences: RetrievedExperience[]
): Promise<Result<string>> {
  try {
    const criticalList = critiqueResult.critical_errors
      .map(
        (e) =>
          `- [${e.type}] ${e.description}${e.experience_id ? ` (experience: ${e.experience_id})` : ""}`
      )
      .join("\n");

    const nonCriticalList = critiqueResult.non_critical_issues
      .map((i) => `- ${i}`)
      .join("\n");

    const experienceFacts = selectedExperiences
      .map(
        (re) =>
          `[${re.experience.experience_id}] ${re.experience.title}: ${re.experience.description} | metrics: ${re.experience.metrics.join(", ")} | skills: ${re.experience.skills.join(", ")}`
      )
      .join("\n");

    const prompt = `Revise this resume based on audit feedback.

Original Resume:
${resume}

Critical Errors to Fix (required):
${criticalList || "None"}

Non-Critical Issues to Address (recommended):
${nonCriticalList || "None"}

Source Experiences (only use facts from here):
${experienceFacts}

RULES:
- Fix every critical error listed above
- Address non-critical issues where possible
- Every bullet MUST retain or add [exp:EXPERIENCE_ID] citation
- Do NOT introduce any claim not supported by a source experience
- Preserve the overall structure and length of the resume

Return the complete revised resume as plain text.`;

    const data = await callClaude(prompt, 4096);
    return { success: true, data };
  } catch (error) {
    return {
      success: false,
      error: `revise failed: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}
