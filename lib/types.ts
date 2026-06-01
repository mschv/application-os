// Shared TypeScript types for the entire application

export interface MasterProfile {
  profile_id: string;
  raw_document: string;
  writing_style: string | null;
  created_at: string;
  updated_at: string;
}

export interface JobRequirements {
  required_skills: string[];
  preferred_skills: string[];
  keywords: string[];
  seniority_level: string;
  role_themes: string[];
}

export interface CriticalError {
  type: "unsupported_claim" | "missing_required_skill" | "fabricated_metric";
  description: string;
  experience_id?: string;
}

export interface CritiqueResult {
  critical_errors: CriticalError[];
  non_critical_issues: string[];
  passed: boolean;
}

export interface ApplicationRecord {
  application_id: string;
  company: string;
  role: string;
  job_description: string;
  extracted_requirements: JobRequirements;
  generated_resume: string;
  generated_cover_letter?: string;
  critique_results: CritiqueResult[];
  final_resume: string;
  final_cover_letter?: string;
  status: "draft" | "applied" | "interview" | "rejected" | "offer";
  timestamp: string;
}

export type Result<T> =
  | { success: true; data: T }
  | { success: false; error: string };
