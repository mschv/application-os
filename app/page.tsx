"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { getProfileId } from "@/lib/profile";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    async function check() {
      const profileId = getProfileId();
      if (!profileId) {
        router.replace("/setup");
        return;
      }

      const { data } = await supabase
        .from("master_profile")
        .select("profile_id")
        .eq("profile_id", profileId)
        .single();

      if (data) {
        router.replace("/apply");
      } else {
        router.replace("/setup");
      }
    }
    check();
  }, [router]);

  return (
    <main
      style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        height: "100vh",
        gap: 16,
        color: "#555",
      }}
    >
      <div style={{ fontSize: 32 }}>⏳</div>
      <div style={{ fontSize: 16 }}>Loading Application OS...</div>
    </main>
  );
}
