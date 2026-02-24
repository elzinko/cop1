# Story E7-S5: RAM Co-Presence Detection and Budget Switching

Status: ready-for-dev

## Story
As a resource manager
I want the system to detect when running in RAM-constrained environments
so that the agent team automatically switches to lighter budget profiles

## Acceptance Criteria
1. System detects available RAM at runtime
2. System monitors memory usage during execution
3. When RAM drops below threshold, budget profile switches to light mode
4. Light mode uses smaller models and fewer concurrent agents
5. Budget switching happens gracefully without interrupting ceremonies
6. System logs all budget switches for monitoring and debugging

## Dev Notes
- Package: app
- Story Points: 5
