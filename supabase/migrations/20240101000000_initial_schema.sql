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
  raw_document      TEXT NOT NULL,
  writing_style     TEXT,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now()
);

DROP TRIGGER IF EXISTS master_profile_updated_at ON master_profile;
CREATE TRIGGER master_profile_updated_at
  BEFORE UPDATE ON master_profile
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


CREATE TABLE IF NOT EXISTS job_applications (
  application_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID,
  company               TEXT NOT NULL,
  role                  TEXT NOT NULL,
  job_description       TEXT NOT NULL,
  extracted_requirements JSONB,
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


-- Row Level Security — disabled for all tables in V1

ALTER TABLE master_profile DISABLE ROW LEVEL SECURITY;
ALTER TABLE job_applications DISABLE ROW LEVEL SECURITY;
ALTER TABLE application_versions DISABLE ROW LEVEL SECURITY;
