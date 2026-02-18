# Story E2-S5: DoR Validator

Status: ready-for-dev

## Story
As a sprint planning system
I want to validate Definition of Readiness across 3 dimensions
so that only properly prepared stories enter the sprint

## Acceptance Criteria
- DORValidator.validate(snapshot) checks all 3 dimensions
- Checks story completeness (title, description, acceptance criteria)
- Checks priority and relative sizing definition
- Checks dependencies and blockers identification
- Returns validation results with dimension-level detail

## Dev Notes
- Package: sprint-core
- Story Points: 5
