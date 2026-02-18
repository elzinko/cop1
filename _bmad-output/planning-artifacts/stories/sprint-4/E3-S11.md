# Story E3-S11: Conflict-Aware Sprint Planning

Status: ready-for-dev

## Story
As a sprint planning system
I want SprintPlannerService to support conflict-aware nocturnal planning
so that agent teams can work on multiple sprints responsibly

## Acceptance Criteria
- SprintPlannerService.planNocturnal() creates conflict-aware schedule
- Detects resource and dependency conflicts across sprints
- Allocates team capacity avoiding conflicts
- Prioritizes based on dependencies and deadlines
- Returns plan with conflict analysis

## Dev Notes
- Package: sprint-core
- Story Points: 5
