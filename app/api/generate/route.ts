// API route — generate initial application materials from job analysis and evidence

// V1: This route collapses STRATEGY + GENERATION + CRITIQUE
// into a single call for simplicity.
// V2: Split into /api/strategy and /api/generate separately
// to allow user review of strategy before generation.

import { NextRequest, NextResponse } from "next/server";
import { transition, canProceedToGeneration, AppState } from "@/lib/stateMachine";
import {
  generateStrategy,
  generateResume,
  generateCoverLetter as llmGenerateCoverLetter,
  generateApplicationResponses,
} from "@/lib/llm";
import { Result } from "@/lib/types";

export async function POST(request: NextRequest): Promise<NextResponse<Result<AppState>>> {
  try {
    const body = (await request.json()) as {
      state: AppState;
      generateCoverLetter?: boolean;
    };
    const { state, generateCoverLetter: wantsCoverLetter = true } = body;

    // 1. Validate canProceedToGeneration
    if (!canProceedToGeneration(state)) {
      return NextResponse.json({
        success: false,
        error: "Cannot proceed to generation: must be at EVIDENCE_REVIEW with at least one selected experience",
      });
    }

    const selectedExperiences = state.retrieved_experiences.filter((e) => e.selected);
    const requirements = state.extracted_requirements!;

    // 2. Generate strategy
    const strategyResult = await generateStrategy(requirements, selectedExperiences);
    if (!strategyResult.success) {
      return NextResponse.json({ success: false, error: strategyResult.error });
    }

    // 3. Generate resume
    const resumeResult = await generateResume(strategyResult.data, selectedExperiences, requirements);
    if (!resumeResult.success) {
      return NextResponse.json({ success: false, error: resumeResult.error });
    }

    // 4. Generate cover letter if enabled
    let coverLetterText: string | undefined;
    if (wantsCoverLetter) {
      const coverLetterResult = await llmGenerateCoverLetter(
        strategyResult.data,
        requirements,
        state.job_description!
      );
      if (!coverLetterResult.success) {
        return NextResponse.json({ success: false, error: coverLetterResult.error });
      }
      coverLetterText = coverLetterResult.data;
    }

    // 5. Generate application responses if questions exist
    let responsesText: string | undefined;
    if (state.application_questions) {
      const responsesResult = await generateApplicationResponses(
        state.application_questions,
        selectedExperiences,
        requirements
      );
      if (!responsesResult.success) {
        return NextResponse.json({ success: false, error: responsesResult.error });
      }
      responsesText = responsesResult.data;
    }

    // 6. Transition EVIDENCE_REVIEW → STRATEGY → GENERATION → CRITIQUE
    const afterConfirm = transition(state, { type: "CONFIRM_EVIDENCE" });
    if (!afterConfirm.success) return NextResponse.json(afterConfirm);

    const afterStrategy = transition(afterConfirm.data, {
      type: "SET_STRATEGY",
      strategy: strategyResult.data,
    });
    if (!afterStrategy.success) return NextResponse.json(afterStrategy);

    const afterGeneration = transition(afterStrategy.data, {
      type: "COMPLETE_GENERATION",
      generated_resume: resumeResult.data,
      generated_cover_letter: coverLetterText,
      application_responses: responsesText,
    });

    return NextResponse.json(afterGeneration);
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: `generate: ${error instanceof Error ? error.message : String(error)}`,
    });
  }
}
