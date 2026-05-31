// Application workflow state machine — manages transitions between pipeline steps

import {
  JobRequirements,
  RetrievedExperience,
  CritiqueResult,
  Result,
} from "./types";

export enum WorkflowStep {
  PROFILE_SETUP = "PROFILE_SETUP",
  JOB_INPUT = "JOB_INPUT",
  JOB_ANALYSIS = "JOB_ANALYSIS",
  RETRIEVAL = "RETRIEVAL",
  EVIDENCE_REVIEW = "EVIDENCE_REVIEW",
  STRATEGY = "STRATEGY",
  GENERATION = "GENERATION",
  CRITIQUE = "CRITIQUE",
  REVISION = "REVISION",
  FINAL_OUTPUT = "FINAL_OUTPUT",
  COMPLETE = "COMPLETE",
}

export interface AppState {
  current_step: WorkflowStep;
  profile_id: string | null;
  job_description: string | null;
  application_questions: string | null;
  extracted_requirements: JobRequirements | null;
  retrieved_experiences: RetrievedExperience[];
  user_modified_evidence: boolean;
  strategy: string | null;
  generated_resume: string | null;
  generated_cover_letter: string | null;
  application_responses: string | null;
  critique_result: CritiqueResult | null;
  revision_count: number;
  final_resume: string | null;
  final_cover_letter: string | null;
  error: string | null;
}

export type Action =
  | { type: "START_JOB_INPUT"; profile_id: string }
  | { type: "SUBMIT_JOB"; job_description: string; application_questions?: string }
  | { type: "COMPLETE_ANALYSIS"; extracted_requirements: JobRequirements }
  | { type: "COMPLETE_RETRIEVAL"; retrieved_experiences: RetrievedExperience[] }
  | { type: "CONFIRM_EVIDENCE" }
  | { type: "SET_STRATEGY"; strategy: string }
  | { type: "COMPLETE_GENERATION"; generated_resume: string; generated_cover_letter?: string; application_responses?: string }
  | { type: "COMPLETE_CRITIQUE"; critique_result: CritiqueResult }
  | { type: "COMPLETE_REVISION"; generated_resume: string; generated_cover_letter?: string; application_responses?: string }
  | { type: "ACCEPT_OUTPUT"; final_resume: string; final_cover_letter?: string }
  | { type: "SET_ERROR"; error: string };

// Maps each action type to the step it must be dispatched from.
// SET_ERROR is intentionally absent — it is valid from any step.
const REQUIRED_STEP: Partial<Record<Action["type"], WorkflowStep>> = {
  START_JOB_INPUT: WorkflowStep.PROFILE_SETUP,
  SUBMIT_JOB: WorkflowStep.JOB_INPUT,
  COMPLETE_ANALYSIS: WorkflowStep.JOB_ANALYSIS,
  COMPLETE_RETRIEVAL: WorkflowStep.RETRIEVAL,
  CONFIRM_EVIDENCE: WorkflowStep.EVIDENCE_REVIEW,
  SET_STRATEGY: WorkflowStep.STRATEGY,
  COMPLETE_GENERATION: WorkflowStep.GENERATION,
  COMPLETE_CRITIQUE: WorkflowStep.CRITIQUE,
  COMPLETE_REVISION: WorkflowStep.REVISION,
  ACCEPT_OUTPUT: WorkflowStep.FINAL_OUTPUT,
};

export function createInitialState(): AppState {
  return {
    current_step: WorkflowStep.PROFILE_SETUP,
    profile_id: null,
    job_description: null,
    application_questions: null,
    extracted_requirements: null,
    retrieved_experiences: [],
    user_modified_evidence: false,
    strategy: null,
    generated_resume: null,
    generated_cover_letter: null,
    application_responses: null,
    critique_result: null,
    revision_count: 0,
    final_resume: null,
    final_cover_letter: null,
    error: null,
  };
}

export function transition(state: AppState, action: Action): Result<AppState> {
  const required = REQUIRED_STEP[action.type];
  if (required !== undefined && state.current_step !== required) {
    return {
      success: false,
      error: `Invalid transition: action ${action.type} requires step ${required}, but current step is ${state.current_step}`,
    };
  }

  switch (action.type) {
    case "START_JOB_INPUT":
      return {
        success: true,
        data: {
          ...state,
          current_step: WorkflowStep.JOB_INPUT,
          profile_id: action.profile_id,
          error: null,
        },
      };

    case "SUBMIT_JOB":
      return {
        success: true,
        data: {
          ...state,
          current_step: WorkflowStep.JOB_ANALYSIS,
          job_description: action.job_description,
          application_questions: action.application_questions ?? null,
          error: null,
        },
      };

    case "COMPLETE_ANALYSIS":
      return {
        success: true,
        data: {
          ...state,
          current_step: WorkflowStep.RETRIEVAL,
          extracted_requirements: action.extracted_requirements,
          error: null,
        },
      };

    case "COMPLETE_RETRIEVAL":
      return {
        success: true,
        data: {
          ...state,
          current_step: WorkflowStep.EVIDENCE_REVIEW,
          retrieved_experiences: action.retrieved_experiences,
          error: null,
        },
      };

    case "CONFIRM_EVIDENCE":
      return {
        success: true,
        data: { ...state, current_step: WorkflowStep.STRATEGY, error: null },
      };

    case "SET_STRATEGY":
      return {
        success: true,
        data: {
          ...state,
          current_step: WorkflowStep.GENERATION,
          strategy: action.strategy,
          error: null,
        },
      };

    case "COMPLETE_GENERATION":
      return {
        success: true,
        data: {
          ...state,
          current_step: WorkflowStep.CRITIQUE,
          generated_resume: action.generated_resume,
          generated_cover_letter: action.generated_cover_letter ?? null,
          application_responses: action.application_responses ?? null,
          error: null,
        },
      };

    case "COMPLETE_CRITIQUE": {
      // If critique passed, or no revisions remain, proceed to final output.
      const nextStep =
        action.critique_result.passed || !canRevise(state)
          ? WorkflowStep.FINAL_OUTPUT
          : WorkflowStep.REVISION;
      return {
        success: true,
        data: {
          ...state,
          current_step: nextStep,
          critique_result: action.critique_result,
          error: null,
        },
      };
    }

    case "COMPLETE_REVISION":
      return {
        success: true,
        data: {
          ...state,
          current_step: WorkflowStep.CRITIQUE,
          generated_resume: action.generated_resume,
          generated_cover_letter: action.generated_cover_letter ?? null,
          application_responses: action.application_responses ?? null,
          revision_count: state.revision_count + 1,
          critique_result: null,
          error: null,
        },
      };

    case "ACCEPT_OUTPUT":
      return {
        success: true,
        data: {
          ...state,
          current_step: WorkflowStep.COMPLETE,
          final_resume: action.final_resume,
          final_cover_letter: action.final_cover_letter ?? null,
          error: null,
        },
      };

    case "SET_ERROR":
      return {
        success: true,
        data: { ...state, error: action.error },
      };
  }
}

// Resets all state from STRATEGY onward when the user modifies retrieved evidence.
export function invalidateFromEvidence(state: AppState): AppState {
  return {
    ...state,
    current_step: WorkflowStep.EVIDENCE_REVIEW,
    user_modified_evidence: true,
    strategy: null,
    generated_resume: null,
    generated_cover_letter: null,
    application_responses: null,
    critique_result: null,
    revision_count: 0,
    final_resume: null,
    final_cover_letter: null,
    error: null,
  };
}

export function canRevise(state: AppState): boolean {
  return state.revision_count < 2;
}

export function canProceedToGeneration(state: AppState): boolean {
  if (state.current_step !== WorkflowStep.EVIDENCE_REVIEW) return false;
  if (state.retrieved_experiences.length === 0) return false;
  return true;
}
