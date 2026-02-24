# Story E3-S14: Backlog Edit Lock

Status: ready-for-dev

## Story
As an app user
I want to receive HTTP 409 Conflict when editing stories that are in progress
so that concurrent modifications to active stories are prevented

## Acceptance Criteria
1. HTTP 409 response is returned for in-progress stories
2. Edit requests to in-progress stories are blocked
3. Clear error message explains the conflict
4. Response includes information about the blocking process/user

## Dev Notes
- Package: app
- Story Points: 2
