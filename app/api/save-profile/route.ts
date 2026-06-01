// API route — save profile to master_profile using service role key

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getConfig } from "@/lib/config";
import { Result } from "@/lib/types";

export async function POST(
  request: NextRequest
): Promise<NextResponse<Result<{ profile_id: string }>>> {
  try {
    const body = (await request.json()) as {
      raw_document: string;
      writing_style: string | null;
    };

    const { raw_document, writing_style } = body;

    if (!raw_document) {
      return NextResponse.json({ success: false, error: "raw_document is required" });
    }

    const config = getConfig();
    const supabase = createClient(
      config.NEXT_PUBLIC_SUPABASE_URL,
      config.SUPABASE_SERVICE_ROLE_KEY
    );

    const profile_id = crypto.randomUUID();

    const { error } = await supabase.from("master_profile").insert({
      profile_id,
      raw_document,
      writing_style: writing_style ?? null,
    });

    if (error) {
      return NextResponse.json({ success: false, error: `Failed to save profile: ${error.message}` });
    }

    return NextResponse.json({ success: true, data: { profile_id } });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: `save-profile: ${error instanceof Error ? error.message : String(error)}`,
    });
  }
}
