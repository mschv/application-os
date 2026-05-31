-- Database schema for Application OS

-- updated_at trigger function
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- Tables

CREATE TABLE IF NOT EXISTS master_profile (
  profile_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  writing_preferences TEXT,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now()
);

DROP TRIGGER IF EXISTS master_profile_updated_at ON master_profile;
CREATE TRIGGER master_profile_updated_at
  BEFORE UPDATE ON master_profile
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


CREATE TABLE IF NOT EXISTS experiences (
  experience_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id        UUID NOT NULL REFERENCES master_profile(profile_id) ON DELETE CASCADE,
  title             TEXT NOT NULL,
  description       TEXT NOT NULL,
  skills            TEXT[],
  tags              TEXT[],
  metrics           TEXT[],
  date_range        TEXT,
  created_at        TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_experiences_profile_id ON experiences(profile_id);


CREATE TABLE IF NOT EXISTS job_applications (
  application_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  company               TEXT NOT NULL,
  role                  TEXT NOT NULL,
  job_description       TEXT NOT NULL,
  extracted_requirements JSONB,
  retrieved_experiences  JSONB,
  status                TEXT DEFAULT 'draft',
  timestamp             TIMESTAMPTZ DEFAULT now()
);


CREATE TABLE IF NOT EXISTS application_versions (
  version_id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id        UUID NOT NULL REFERENCES job_applications(application_id) ON DELETE CASCADE,
  revision_count        INTEGER DEFAULT 0,
  generated_resume      TEXT,
  generated_cover_letter TEXT,
  critique_results      JSONB,
  final_resume          TEXT,
  final_cover_letter    TEXT,
  created_at            TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_application_versions_application_id ON application_versions(application_id);


-- Row Level Security

ALTER TABLE master_profile ENABLE ROW LEVEL SECURITY;
ALTER TABLE experiences ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE application_versions ENABLE ROW LEVEL SECURITY;

-- master_profile: each user owns exactly one profile matched by auth.uid()
DROP POLICY IF EXISTS "Users can manage their own profile" ON master_profile;
CREATE POLICY "Users can manage their own profile"
  ON master_profile
  FOR ALL
  USING (profile_id = auth.uid())
  WITH CHECK (profile_id = auth.uid());

-- experiences: accessible when the parent profile belongs to the current user
DROP POLICY IF EXISTS "Users can manage their own experiences" ON experiences;
CREATE POLICY "Users can manage their own experiences"
  ON experiences
  FOR ALL
  USING (
    profile_id IN (
      SELECT profile_id FROM master_profile WHERE profile_id = auth.uid()
    )
  )
  WITH CHECK (
    profile_id IN (
      SELECT profile_id FROM master_profile WHERE profile_id = auth.uid()
    )
  );

-- job_applications: scoped to the authenticated user via user_id
DROP POLICY IF EXISTS "Users can manage their own applications" ON job_applications;
CREATE POLICY "Users can manage their own applications"
  ON job_applications
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- application_versions: accessible when the parent application belongs to the current user
DROP POLICY IF EXISTS "Users can manage their own application versions" ON application_versions;
CREATE POLICY "Users can manage their own application versions"
  ON application_versions
  FOR ALL
  USING (
    application_id IN (
      SELECT application_id FROM job_applications WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    application_id IN (
      SELECT application_id FROM job_applications WHERE user_id = auth.uid()
    )
  );
