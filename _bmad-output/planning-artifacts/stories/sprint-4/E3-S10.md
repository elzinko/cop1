# Story E3-S10: Iteration Limiter

Status: ready-for-dev

## Story
As a system safety mechanism
I want IterationLimiter to prevent runaway agent loops
so that agent execution is controlled and bounded

## Acceptance Criteria
- IterationLimiter.check() determines if iteration limit reached
- Supports configurable iteration thresholds per task type
- Tracks iteration count across task execution
- Triggers alerts when approaching limits
- Supports graceful termination with partial results

## Dev Notes
- Package: sprint-core
- Story Points: 2
