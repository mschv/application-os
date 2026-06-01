// API route — revise materials based on critique feedback

import { NextRequest, NextResponse } from "next/server";
import { transition, canRevise, AppState } from "@/lib/stateMachine";
import { revise, critique } from "@/lib/llm";
import { Result } from "@/lib/types";

export async function POST(request: NextRequest): Promise<NextResponse<Result<AppState>>> {
  try {
    const body = (await request.json()) as { state: AppState };
    const { state } = body;

    // 1. Validate canRevise
    if (!canRevise(state)) {
      return NextResponse.json({
        success: false,
        error: "Maximum revisions (2) reached",
      });
    }

    const rawDocument = state.raw_document!;
    const writingStyle = state.writing_style;

    // 2. Call llm.revise() — Sonnet with cached document
    const reviseResult = await revise(
      state.generated_resume!,
      state.critique_result!,
      rawDocument,
      writingStyle
    );
    if (!reviseResult.success) {
      return NextResponse.json({ success: false, error: reviseResult.error });
    }

    // 3. COMPLETE_REVISION: increments revision_count, transitions to CRITIQUE
    const afterRevision = transition(state, {
      type: "COMPLETE_REVISION",
      generated_resume: reviseResult.data,
      generated_cover_letter: state.generated_cover_letter ?? undefined,
      application_responses: state.application_responses ?? undefined,
    });
    if (!afterRevision.success) return NextResponse.json(afterRevision);

    // 4. Auto-critique the revised resume — Haiku
    const critiqueResult = await critique(
      reviseResult.data,
      afterRevision.data.extracted_requirements!
    );
    if (!critiqueResult.success) {
      return NextResponse.json({ success: false, error: critiqueResult.error });
    }

    // 5. Let state machine route based on critique result and canRevise
    const afterCritique = transition(afterRevision.data, {
      type: "COMPLETE_CRITIQUE",
      critique_result: critiqueResult.data,
    });

    return NextResponse.json(afterCritique);
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: `revise: ${error instanceof Error ? error.message : String(error)}`,
    });
  }
}
