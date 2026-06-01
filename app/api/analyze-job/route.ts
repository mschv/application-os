// API route — parse job posting, fetch profile document, transition state to STRATEGY

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { transition, AppState } from "@/lib/stateMachine";
import { analyzeJob } from "@/lib/llm";
import { getConfig } from "@/lib/config";
import { Result } from "@/lib/types";

export async function POST(request: NextRequest): Promise<NextResponse<Result<AppState>>> {
  try {
    const body = (await request.json()) as {
      state: AppState;
      jobDescription: string;
      profileId: string;
    };
    const { state, jobDescription, profileId } = body;

    // 1. Fetch raw_document and writing_style from Supabase
    const config = getConfig();
    const supabase = createClient(
      config.NEXT_PUBLIC_SUPABASE_URL,
      config.SUPABASE_SERVICE_ROLE_KEY
    );

    const { data: profile, error: profileError } = await supabase
      .from("master_profile")
      .select("raw_document, writing_style")
      .eq("profile_id", profileId)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ success: false, error: "Profile not found" });
    }

    // 2. Transition to JOB_ANALYSIS
    const afterSubmit = transition(state, {
      type: "SUBMIT_JOB",
      job_description: jobDescription,
    });
    if (!afterSubmit.success) return NextResponse.json(afterSubmit);

    // 3. Analyze job with Haiku
    const analysisResult = await analyzeJob(jobDescription);
    if (!analysisResult.success) {
      return NextResponse.json({ success: false, error: analysisResult.error });
    }

    // 4. Transition JOB_ANALYSIS → STRATEGY, storing rawDocument and writingStyle in state
    const afterAnalysis = transition(afterSubmit.data, {
      type: "COMPLETE_ANALYSIS",
      extracted_requirements: analysisResult.data,
      raw_document: profile.raw_document,
      writing_style: profile.writing_style ?? null,
    });

    return NextResponse.json(afterAnalysis);
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: `analyze-job: ${error instanceof Error ? error.message : String(error)}`,
    });
  }
}
