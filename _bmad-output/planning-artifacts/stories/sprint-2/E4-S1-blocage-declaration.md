# Story E4-S1: Blocage Declaration

Status: ready-for-dev

## Story
As a sprint core system
I want to implement BlockageService with SSE event streaming
so that blocages can be declared and consumed by listeners in real-time

## Acceptance Criteria
1. BlockageService manages blocage lifecycle and state
2. SSE (Server-Sent Events) stream pushes blocage events to clients
3. Blocages include type, severity, and context information
4. Event stream handles reconnection and message ordering

## Dev Notes
- Package: sprint-core
- Story Points: 3
