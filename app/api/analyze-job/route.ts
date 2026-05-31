// API route — parse job posting and extract structured requirements

import { NextRequest, NextResponse } from "next/server";
import { transition, AppState } from "@/lib/stateMachine";
import { retrieveExperiences } from "@/lib/retrieval";
import { analyzeJob } from "@/lib/llm";
import { Result, Experience } from "@/lib/types";

export async function POST(request: NextRequest): Promise<NextResponse<Result<AppState>>> {
  try {
    const body = (await request.json()) as {
      state: AppState;
      jobDescription: string;
      experiences: Experience[];
    };
    const { state, jobDescription, experiences } = body;

    // 1. Validate transition to JOB_ANALYSIS
    const afterSubmit = transition(state, {
      type: "SUBMIT_JOB",
      job_description: jobDescription,
    });
    if (!afterSubmit.success) return NextResponse.json(afterSubmit);

    // 2. Call llm.analyzeJob()
    const analysisResult = await analyzeJob(jobDescription);
    if (!analysisResult.success) {
      return NextResponse.json({ success: false, error: analysisResult.error });
    }

    // 3. Call retrieval.retrieveExperiences()
    const retrievalResult = retrieveExperiences(analysisResult.data, experiences);
    if (!retrievalResult.success) {
      return NextResponse.json({ success: false, error: retrievalResult.error });
    }

    // 4. Transition to RETRIEVAL (sets extracted_requirements)
    const afterAnalysis = transition(afterSubmit.data, {
      type: "COMPLETE_ANALYSIS",
      extracted_requirements: analysisResult.data,
    });
    if (!afterAnalysis.success) return NextResponse.json(afterAnalysis);

    // Transition to EVIDENCE_REVIEW (sets retrieved_experiences)
    const afterRetrieval = transition(afterAnalysis.data, {
      type: "COMPLETE_RETRIEVAL",
      retrieved_experiences: retrievalResult.data,
    });

    return NextResponse.json(afterRetrieval);
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: `analyze-job: ${error instanceof Error ? error.message : String(error)}`,
    });
  }
}
