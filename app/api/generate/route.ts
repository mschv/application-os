// API route — generate initial application materials from strategy and raw profile document

import { NextRequest, NextResponse } from "next/server";
import { transition, AppState, WorkflowStep } from "@/lib/stateMachine";
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

    // 1. Validate that state is at STRATEGY
    if (state.current_step !== WorkflowStep.STRATEGY) {
      return NextResponse.json({
        success: false,
        error: `Cannot generate: expected STRATEGY step, got ${state.current_step}`,
      });
    }

    const rawDocument = state.raw_document!;
    const writingStyle = state.writing_style;
    const requirements = state.extracted_requirements!;

    // 2. Generate strategy (Sonnet, cached document)
    const strategyResult = await generateStrategy(requirements, rawDocument, writingStyle);
    if (!strategyResult.success) {
      return NextResponse.json({ success: false, error: strategyResult.error });
    }

    // 3. Generate resume (Sonnet, cached document)
    const resumeResult = await generateResume(
      strategyResult.data,
      rawDocument,
      requirements,
      writingStyle
    );
    if (!resumeResult.success) {
      return NextResponse.json({ success: false, error: resumeResult.error });
    }

    // 4. Optional cover letter (Sonnet, cached document)
    let coverLetterText: string | undefined;
    if (wantsCoverLetter) {
      const clResult = await llmGenerateCoverLetter(
        strategyResult.data,
        rawDocument,
        requirements,
        writingStyle
      );
      if (!clResult.success) {
        return NextResponse.json({ success: false, error: clResult.error });
      }
      coverLetterText = clResult.data;
    }

    // 5. Optional application responses (Sonnet, cached document)
    let responsesText: string | undefined;
    if (state.application_questions) {
      const respResult = await generateApplicationResponses(
        state.application_questions,
        rawDocument,
        requirements,
        writingStyle
      );
      if (!respResult.success) {
        return NextResponse.json({ success: false, error: respResult.error });
      }
      responsesText = respResult.data;
    }

    // 6. Transition STRATEGY → GENERATION → CRITIQUE
    const afterStrategy = transition(state, {
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
