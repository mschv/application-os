# Application OS — Agent Instructions

You are building Application OS, a deterministic job application
workflow system.

## Core Principles
- This system is a deterministic state machine, not a prompt pipeline
- Do not collapse steps or merge modules
- One file = one responsibility
- Every step has explicit state transitions and invalidation rules

## Architecture Rules
- ONLY llm.ts may call the Claude API
- retrieval.ts must be deterministic — no LLM calls
- stateMachine.ts must be pure logic — no API calls, no UI
- API routes are thin orchestration only — no business logic

## State Machine Rules
- AppState is the single source of truth — imported everywhere
- revision_count must be tracked and capped at 2
- Any evidence modification invalidates all downstream state
- No resume bullet may be generated without grounding in 
  the master document

## Error Handling Contract
- All async functions return a Result type
- { success: true, data: T } | { success: false, error: string }
- Never throw raw errors across module boundaries

## Build Rules
- Do NOT build future steps
- Do NOT optimize beyond current step requirements
- Do NOT reimplement logic that exists in another module
- API routes MAY call: stateMachine, retrieval, llm
- API routes MAY NOT reimplement retrieval or generation logic

## Content Rules — Apply to Every Agent

### Factual grounding
- Every resume bullet must trace back to something explicitly 
  stated in the master document
- Never invent, estimate, or assume metrics not present in 
  the master document
- Never fabricate or round up years of experience
- If no metric exists for a bullet, use scope, speed, or 
  outcome language instead

### Language and style
- Write in plain direct English any reader can understand 
  regardless of technical background
- Use technical terms only when the job posting itself uses them
- No passive voice
- No em dashes
- No semicolons
- No adjectives or adverbs unless they carry measurable meaning
- Never use: responsible for, helped, worked on, assisted, 
  supported, leveraged, utilized, passionate about, 
  results-driven, excited to, would be honored
- Concise and direct always wins over elaborate and impressive

### Resume bullets
- Use XYZ formula: accomplished X by doing Y resulting in Z
- Start every bullet with a strong past-tense action verb
- Keep every bullet to one or two lines maximum

### Cover letter
- Three paragraphs, under 250 words total
- No paragraph longer than four sentences
- Never open with "I am writing to apply" or any variation
- Sound like a confident person talking, not a corporate template

## Experience Gap Handling

When a job posting states a years-of-experience requirement 
that the candidate does not fully meet:

1. Flag the gap explicitly in the analyst output so the 
   user sees it before generation proceeds
2. Never inflate, misrepresent, or round up years of experience
3. Frame the resume to lead with depth of impact and scope 
   of responsibility rather than tenure
4. In the cover letter, address the experience gap indirectly 
   by making the quality and scale of work speak louder 
   than the timeline
5. Lean into the candidate's unusual combination of MBA, 
   engineering background, PM experience, AI product work, 
   HCI research, and independently shipped civic tech projects 
   as differentiation that most candidates with more years 
   do not have

## Coursework Rules

Include relevant coursework from the education section only when:
- The role is entry-level or junior
- The role is academic or research-oriented
- The candidate needs to demonstrate domain exposure not 
  covered by work experience
- The job posting explicitly values educational background

Omit coursework entirely for senior, industry, or leadership 
roles where listing courses would read as junior.

## What This System Never Does
- Invents facts not present in the master document
- Fabricates metrics or outcomes
- Inflates years of experience
- Generates content that cannot be traced to the master document
- Skips the human review checkpoint before logging an application