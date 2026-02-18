# Story E9-S9: Application Audit Log

Status: ready-for-dev

## Story
As a compliance system
I want application audit log to track all rule applications
so that governance decisions are auditable

## Acceptance Criteria
- Audit log stored in iamthelaw/history.jsonl
- Logs every rule application with timestamp
- Includes proposal details and rule results
- Stores decision rationale and context
- Supports querying audit logs by various criteria
- Logs are immutable once written

## Dev Notes
- Package: app
- Story Points: 3
