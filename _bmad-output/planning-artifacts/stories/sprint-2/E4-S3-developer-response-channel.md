# Story E4-S3: Developer Response

Status: ready-for-dev

## Story
As a developer
I want to submit resolutions to blocages through POST /api/blocages/{id}/resolve
so that I can provide feedback and resolution information to the system

## Acceptance Criteria
1. POST endpoint /api/blocages/{id}/resolve is implemented
2. Resolution payload includes status, notes, and optional metadata
3. Blocage state is updated upon resolution submission
4. Confirmation response includes updated blocage state

## Dev Notes
- Package: app, sprint-core
- Story Points: 3
