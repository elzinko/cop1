# Story E5-S7: Tokens/sec Monitor

Status: ready-for-dev

## Story
As an observability system
I want TokensPerSecMonitor to measure token throughput
so that LLM performance is monitored

## Acceptance Criteria
- TokensPerSecMonitor.measure() tracks tokens per second
- Measures input and output token rates separately
- Samples at configurable intervals
- Generates alerts on performance degradation
- Exports metrics for dashboarding

## Dev Notes
- Package: observability
- Story Points: 3
