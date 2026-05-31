function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`MissingEnvironmentVariable: ${name} is required but not set`);
  }
  return value;
}

export const config = {
  supabase: {
    url: requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    anonKey: requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    serviceRoleKey: requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
  },
  anthropic: {
    apiKey: requireEnv("ANTHROPIC_API_KEY"),
  },
} as const;

export type Config = typeof config;
