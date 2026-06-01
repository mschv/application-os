// LLM client — wrapper for Anthropic API calls used across pipeline steps

import Anthropic from "@anthropic-ai/sdk";
import { getConfig } from "./config";
import {
  JobRequirements,
  CritiqueResult,
  Result,
} from "./types";

const SONNET = "claude-sonnet-4-5";
const HAIKU = "claude-haiku-4-5-20251001";

async function callClaude(prompt: string, model: string, maxTokens: number): Promise<string> {
  const { ANTHROPIC_API_KEY } = getConfig();
  const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
  const message = await client.messages.create({
    model,
    max_tokens: maxTokens,
    messages: [{ role: "user", content: prompt }],
  });
  const block = message.content[0];
  if (block.type !== "text") throw new Error("Unexpected non-text response from Claude");
  return block.text;
}

// cache_control is a prompt-caching beta feature not in stable SDK types — cast required.
async function callClaudeWithDocument(
  rawDocument: string,
  instruction: string,
  model: string,
  maxTokens: number
): Promise<string> {
  const { ANTHROPIC_API_KEY } = getConfig();
  const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const message = await (client.messages as any).create(
    {
      model,
      max_tokens: maxTokens,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: rawDocument, cache_control: { type: "ephemeral" } },
            { type: "text", text: instruction },
          ],
        },
      ],
    },
    { headers: { "anthropic-beta": "prompt-caching-2024-07-31" } }
  ) as Anthropic.Message;
  /* eslint-enable @typescript-eslint/no-explicit-any */
  const block = message.content[0];
  if (block.type !== "text") throw new Error("Unexpected non-text response from Claude");
  return block.text;
}

function extractJson<T>(text: string): T {
  const blockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (blockMatch) return JSON.parse(blockMatch[1].trim()) as T;
  const rawMatch = text.match(/\{[\s\S]*\}/);
  if (rawMatch) return JSON.parse(rawMatch[0]) as T;
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

    const text = await callClaude(prompt, HAIKU, 1024);
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
  rawDocument: string,
  writingStyle: string | null
): Promise<Result<string>> {
  try {
    const instruction = `Based on the candidate's background document above, create a targeted application strategy for the following job.

Job Requirements:
- Required skills: ${requirements.required_skills.join(", ")}
- Preferred skills: ${requirements.preferred_skills.join(", ")}
- Keywords: ${requirements.keywords.join(", ")}
- Seniority: ${requirements.seniority_level}
- Role themes: ${requirements.role_themes.join(", ")}
${writingStyle ? `\nWriting style guide: ${writingStyle}` : ""}

Identify the most relevant experiences from the document for this specific role.
Produce a structured plain-text strategy document that:
1. Lists the specific experiences and projects to highlight and why
2. Maps each to the job requirements they satisfy
3. Determines the narrative arc — what story to tell
4. Specifies which experiences to lead with
5. Lists keywords to emphasize and where
6. Notes any requirement gaps and how to address them honestly

Be specific and reference the candidate's actual experiences.`;

    const data = await callClaudeWithDocument(rawDocument, instruction, SONNET, 1024);
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
  rawDocument: string,
  requirements: JobRequirements,
  writingStyle: string | null
): Promise<Result<string>> {
  try {
    const instruction = `Write an ATS-optimized resume for the candidate described in the document above.

Strategy:
${strategy}

Target Requirements:
- Required skills: ${requirements.required_skills.join(", ")}
- Keywords: ${requirements.keywords.join(", ")}
- Seniority: ${requirements.seniority_level}
${writingStyle ? `\nWriting style guide: ${writingStyle}` : ""}

RULES:
- Select the most relevant experiences for this specific role from the document
- Use only facts present in the document — no invented claims or metrics
- Incorporate required skills and keywords naturally
- Use strong action verbs; quantify impact using only metrics from the document
- ATS format: clean plain text, standard section headers, no tables or graphics
- Apply the writing style guide if provided

Return the complete resume as plain text.`;

    const data = await callClaudeWithDocument(rawDocument, instruction, SONNET, 4096);
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
  rawDocument: string,
  requirements: JobRequirements,
  writingStyle: string | null
): Promise<Result<string>> {
  try {
    const instruction = `Write a targeted cover letter for the candidate described in the document above.

Strategy:
${strategy}

Role Themes: ${requirements.role_themes.join(", ")}
Seniority Level: ${requirements.seniority_level}
Required Skills: ${requirements.required_skills.join(", ")}
${writingStyle ? `\nWriting style guide: ${writingStyle}` : ""}

Write a cover letter that:
- Opens with genuine motivation for this specific role
- Connects 2–3 key experiences directly to the role's core requirements
- Uses only facts from the document — no invented claims
- Uses the role themes to frame the narrative
- Closes with a specific, confident call to action
- Is 3–4 paragraphs, professional but not generic
- Apply the writing style guide if provided

Return only the cover letter body text, no subject line or metadata.`;

    const data = await callClaudeWithDocument(rawDocument, instruction, SONNET, 2048);
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
  rawDocument: string,
  requirements: JobRequirements,
  writingStyle: string | null
): Promise<Result<string>> {
  try {
    const instruction = `Answer the following job application questions for the candidate described in the document above.

Application Questions:
${questions}

Role Context:
- Required skills: ${requirements.required_skills.join(", ")}
- Themes: ${requirements.role_themes.join(", ")}
- Seniority: ${requirements.seniority_level}
${writingStyle ? `\nWriting style guide: ${writingStyle}` : ""}

RULES:
- Answer each question using only the candidate's experiences from the document — no fabricated details
- Use concrete metrics and outcomes present in the document
- Keep answers consistent with what the resume would say
- Apply the writing style guide if provided
- Format: question number, then a clear response paragraph

Return all answers as plain text.`;

    const data = await callClaudeWithDocument(rawDocument, instruction, SONNET, 2048);
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
  requirements: JobRequirements
): Promise<Result<CritiqueResult>> {
  try {
    const prompt = `You are a strict resume auditor. Audit this resume against the job requirements.

Resume:
${resume}

Required Skills (all must appear in the resume): ${requirements.required_skills.join(", ")}
Keywords to verify: ${requirements.keywords.join(", ")}

Check for CRITICAL errors — any one causes failure:
- missing_required_skill: a required skill is absent from the resume entirely
- unsupported_claim: a bullet makes an extraordinary claim without any supporting context
- fabricated_metric: a number or percentage that appears invented (e.g. suspiciously round or uncontextualized)

Check for NON-CRITICAL issues: style, weak phrasing, missing keywords, formatting problems.

Return a JSON object with exactly this structure:
{
  "critical_errors": [
    {
      "type": "missing_required_skill",
      "description": "specific description"
    }
  ],
  "non_critical_issues": ["issue1", "issue2"],
  "passed": false
}

Set "passed" to true only if critical_errors is an empty array. Return only the JSON object.`;

    const text = await callClaude(prompt, HAIKU, 1024);
    const parsed = extractJson<CritiqueResult>(text);
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
  rawDocument: string,
  writingStyle: string | null
): Promise<Result<string>> {
  try {
    const criticalList = critiqueResult.critical_errors
      .map((e) => `- [${e.type}] ${e.description}`)
      .join("\n");

    const nonCriticalList = critiqueResult.non_critical_issues
      .map((i) => `- ${i}`)
      .join("\n");

    const instruction = `Revise this resume based on audit feedback. Use the candidate's background document above as the source of truth.

Resume to revise:
${resume}

Critical Errors to Fix (required):
${criticalList || "None"}

Non-Critical Issues to Address (recommended):
${nonCriticalList || "None"}
${writingStyle ? `\nWriting style guide: ${writingStyle}` : ""}

RULES:
- Fix every critical error listed above
- Address non-critical issues where possible
- Use only facts from the document — do not introduce any invented claims
- Preserve the overall structure and length of the resume
- Apply the writing style guide if provided

Return the complete revised resume as plain text.`;

    const data = await callClaudeWithDocument(rawDocument, instruction, SONNET, 4096);
    return { success: true, data };
  } catch (error) {
    return {
      success: false,
      error: `revise failed: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}
