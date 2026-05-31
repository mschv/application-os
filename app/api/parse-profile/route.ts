// API route — parse an uploaded document into a structured MasterProfile via Claude

import { NextRequest, NextResponse } from "next/server";
import { parseProfile } from "@/lib/llm";
import { MasterProfile, Result } from "@/lib/types";

export async function POST(
  request: NextRequest
): Promise<NextResponse<Result<MasterProfile>>> {
  try {
    const body = (await request.json()) as { fileContent: string; mimeType: string };
    const { fileContent, mimeType } = body;

    if (!fileContent || !mimeType) {
      return NextResponse.json({ success: false, error: "fileContent and mimeType are required" });
    }

    const result = await parseProfile(fileContent, mimeType);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: `parse-profile: ${error instanceof Error ? error.message : String(error)}`,
    });
  }
}
