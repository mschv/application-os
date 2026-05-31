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


CREATE TABLE IF NOT EXISTS contact_info (
  contact_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id        UUID REFERENCES master_profile(profile_id) ON DELETE CASCADE,
  full_name         TEXT NOT NULL,
  email             TEXT,
  phone             TEXT,
  location          TEXT,
  linkedin_url      TEXT,
  portfolio_url     TEXT,
  created_at        TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contact_info_profile_id ON contact_info(profile_id);


CREATE TABLE IF NOT EXISTS education (
  education_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id        UUID REFERENCES master_profile(profile_id) ON DELETE CASCADE,
  degree            TEXT NOT NULL,
  institution       TEXT NOT NULL,
  graduation_date   TEXT,
  gpa               TEXT,
  created_at        TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_education_profile_id ON education(profile_id);


CREATE TABLE IF NOT EXISTS languages (
  language_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id        UUID REFERENCES master_profile(profile_id) ON DELETE CASCADE,
  language          TEXT NOT NULL,
  proficiency       TEXT,
  created_at        TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_languages_profile_id ON languages(profile_id);


CREATE TABLE IF NOT EXISTS certifications (
  certification_id  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id        UUID REFERENCES master_profile(profile_id) ON DELETE CASCADE,
  name              TEXT NOT NULL,
  issuer            TEXT,
  date              TEXT,
  created_at        TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_certifications_profile_id ON certifications(profile_id);


CREATE TABLE IF NOT EXISTS publications (
  publication_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id        UUID REFERENCES master_profile(profile_id) ON DELETE CASCADE,
  title             TEXT NOT NULL,
  description       TEXT,
  date              TEXT,
  url               TEXT,
  created_at        TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_publications_profile_id ON publications(profile_id);


CREATE TABLE IF NOT EXISTS target_preferences (
  preference_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id        UUID REFERENCES master_profile(profile_id) ON DELETE CASCADE,
  target_titles     TEXT[],
  target_industries TEXT[],
  work_mode         TEXT,
  target_locations  TEXT[],
  created_at        TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_target_preferences_profile_id ON target_preferences(profile_id);


-- Row Level Security

ALTER TABLE master_profile ENABLE ROW LEVEL SECURITY;
ALTER TABLE experiences ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE application_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_info DISABLE ROW LEVEL SECURITY;
ALTER TABLE education DISABLE ROW LEVEL SECURITY;
ALTER TABLE languages DISABLE ROW LEVEL SECURITY;
ALTER TABLE certifications DISABLE ROW LEVEL SECURITY;
ALTER TABLE publications DISABLE ROW LEVEL SECURITY;
ALTER TABLE target_preferences DISABLE ROW LEVEL SECURITY;

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

-- contact_info: scoped to the owning profile
DROP POLICY IF EXISTS "Users can manage their own contact info" ON contact_info;
CREATE POLICY "Users can manage their own contact info"
  ON contact_info
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

-- education
DROP POLICY IF EXISTS "Users can manage their own education" ON education;
CREATE POLICY "Users can manage their own education"
  ON education
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

-- languages
DROP POLICY IF EXISTS "Users can manage their own languages" ON languages;
CREATE POLICY "Users can manage their own languages"
  ON languages
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

-- certifications
DROP POLICY IF EXISTS "Users can manage their own certifications" ON certifications;
CREATE POLICY "Users can manage their own certifications"
  ON certifications
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

-- publications
DROP POLICY IF EXISTS "Users can manage their own publications" ON publications;
CREATE POLICY "Users can manage their own publications"
  ON publications
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

-- target_preferences
DROP POLICY IF EXISTS "Users can manage their own target preferences" ON target_preferences;
CREATE POLICY "Users can manage their own target preferences"
  ON target_preferences
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
