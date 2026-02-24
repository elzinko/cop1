# Story E2-S8: WSJF Scoring

Status: ready-for-dev

## Story
As a sprint planning system
I want to calculate WSJF scores for stories
so that prioritization is data-driven using weighted shortest job first

## Acceptance Criteria
- WSJFService.score(story) calculates WSJF metric
- Considers business value, time criticality, risk reduction, and effort
- Returns normalized WSJF score for ranking
- Supports batch scoring of backlog

## Dev Notes
- Package: sprint-core
- Story Points: 5
