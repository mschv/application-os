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

    const selectedExperiences = state.retrieved_experiences.filter((e) => e.selected);

    // 2. Call llm.revise()
    const reviseResult = await revise(
      state.generated_resume!,
      state.critique_result!,
      selectedExperiences
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

    // 4. Call llm.critique() on the revised resume
    const critiqueResult = await critique(
      reviseResult.data,
      afterRevision.data.extracted_requirements!,
      selectedExperiences
    );

    // 5. Let state machine route based on critique result and canRevise
    if (!critiqueResult.success) {
      return NextResponse.json({ success: false, error: critiqueResult.error });
    }

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
