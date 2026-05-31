# Application OS

A deterministic job application workflow system that generates tailored resumes, cover letters, and application responses using Claude AI and your personal experience profile.

Built with Next.js, TypeScript, Supabase, and the Anthropic Claude API.

## Environment Variables

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL (found in Project Settings → API) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous/public key (safe for client-side use) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server-side only — never expose publicly) |
| `ANTHROPIC_API_KEY` | Anthropic API key for Claude (from console.anthropic.com) |

## Setup

1. **Clone the repo**
   ```bash
   git clone <repo-url>
   cd application-os
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up Supabase**
   - Create a new project at [supabase.com](https://supabase.com)
   - In the SQL editor, run the contents of `/db/schema.sql` to create all tables and RLS policies

4. **Add environment variables**
   - Copy `.env.example` to `.env.local`
   - Fill in all four values from your Supabase project and Anthropic account

   ```bash
   cp .env.example .env.local
   ```

5. **Run locally**
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000)

6. **Deploy to Vercel**
   - Connect the repo in the [Vercel dashboard](https://vercel.com)
   - Add all four environment variables under Project → Settings → Environment Variables
   - Vercel will detect the Next.js framework automatically

## Running Your First Application

1. Go to `/profile-setup` and enter your work experiences, projects, skills, and writing preferences. This creates your master profile in Supabase.
2. You'll be redirected to `/job-input`. Paste a job description and optionally add application questions and enable cover letter generation.
3. Review the matched experiences at `/evidence-review`. Toggle any experience on or off, then click **Generate Application Materials**.
4. At `/output-review`, review the generated resume and cover letter. The quality check runs automatically. Use **Revise** (up to 2 times) or **Approve & Save** to finalize.
