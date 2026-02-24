# Story E9-S8: RuleApplicationService

Status: ready-for-dev

## Story
As a governance system
I want RuleApplicationService to route proposals to correct handlers
so that governance rules are applied consistently

## Acceptance Criteria
- RuleApplicationService routes proposals to applicable rule handlers
- Matches proposal type to applicable rules
- Executes rules in priority order
- Collects results from all applicable rules
- Returns aggregated rule application results

## Dev Notes
- Package: app
- Story Points: 8
