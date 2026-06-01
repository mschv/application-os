// API route — critique generated materials and produce structured feedback

import { NextRequest, NextResponse } from "next/server";
import { transition, AppState, WorkflowStep } from "@/lib/stateMachine";
import { critique } from "@/lib/llm";
import { Result } from "@/lib/types";

export async function POST(request: NextRequest): Promise<NextResponse<Result<AppState>>> {
  try {
    const body = (await request.json()) as { state: AppState };
    const { state } = body;

    // 1. Validate transition to CRITIQUE (must already be at CRITIQUE step)
    if (state.current_step !== WorkflowStep.CRITIQUE) {
      return NextResponse.json({
        success: false,
        error: `Invalid state: expected CRITIQUE, got ${state.current_step}`,
      });
    }

    // 2. Call llm.critique() — Haiku, no document needed
    const critiqueResult = await critique(
      state.generated_resume!,
      state.extracted_requirements!
    );
    if (!critiqueResult.success) {
      return NextResponse.json({ success: false, error: critiqueResult.error });
    }

    // 3. Transition — COMPLETE_CRITIQUE routes to FINAL_OUTPUT or REVISION
    const afterCritique = transition(state, {
      type: "COMPLETE_CRITIQUE",
      critique_result: critiqueResult.data,
    });

    return NextResponse.json(afterCritique);
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: `critique: ${error instanceof Error ? error.message : String(error)}`,
    });
  }
}
