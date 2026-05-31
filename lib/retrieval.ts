// Evidence retrieval — score and rank user experiences against job requirements

import { Experience, JobRequirements, RetrievedExperience, Result } from "./types";

export function scoreExperience(
  experience: Experience,
  requirements: JobRequirements
): RetrievedExperience {
  const match_reasons: string[] = [];
  let score = 0;

  const skillSet = new Set(
    [...experience.skills, ...experience.tags].map((s) => s.toLowerCase())
  );
  const descriptionLower = experience.description.toLowerCase();

  for (const skill of requirements.required_skills) {
    if (skillSet.has(skill.toLowerCase())) {
      score += 3;
      match_reasons.push(`Required skill matched: "${skill}"`);
    }
  }

  for (const skill of requirements.preferred_skills) {
    if (skillSet.has(skill.toLowerCase())) {
      score += 1;
      match_reasons.push(`Preferred skill matched: "${skill}"`);
    }
  }

  for (const keyword of requirements.keywords) {
    if (descriptionLower.includes(keyword.toLowerCase())) {
      score += 2;
      match_reasons.push(`Keyword matched in description: "${keyword}"`);
    }
  }

  return {
    experience,
    relevance_score: score,
    match_reasons,
    selected: score >= 1,
  };
}

export function retrieveExperiences(
  requirements: JobRequirements,
  experiences: Experience[]
): Result<RetrievedExperience[]> {
  if (!requirements || !experiences) {
    return { success: false, error: "Missing required inputs" };
  }

  const scored = experiences
    .map((exp) => scoreExperience(exp, requirements))
    .sort((a, b) => b.relevance_score - a.relevance_score);

  return { success: true, data: scored };
}
