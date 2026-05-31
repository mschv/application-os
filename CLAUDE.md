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
- No resume bullet may be generated without a referenced experience_id

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