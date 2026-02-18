# Story E9-S3: DoD Rejection Limiter

Status: ready-for-dev

## Story
As a quality gate
I want DoDLimiter to prevent excessive rejections
so that feedback loops don't become counterproductive

## Acceptance Criteria
- DoDLimiter.check() determines if rejections are excessive
- Tracks rejection count per story within sprint
- Allows configurable rejection threshold
- Provides escalation path for blocked stories
- Logs rejection decisions for analysis

## Dev Notes
- Package: sprint-core
- Story Points: 3
