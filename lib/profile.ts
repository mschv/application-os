// Profile identity management — single source of truth for profile_id

export function getProfileId(): string | null {
  const fromEnv = process.env.NEXT_PUBLIC_PROFILE_ID;
  if (fromEnv) return fromEnv;
  if (typeof window === "undefined") return null;
  return localStorage.getItem("app_os_profile_id");
}

export function saveProfileIdLocally(profileId: string): void {
  localStorage.setItem("app_os_profile_id", profileId);
}

export function isProfileConfigured(): boolean {
  return getProfileId() !== null;
}
