# Story E6-S3: LLMProviderRegistry

Status: ready-for-dev

## Story
As an LLM system
I want LLMProviderRegistry to manage active providers
so that system can switch between LLM providers

## Acceptance Criteria
- LLMProviderRegistry.getActive() returns active provider
- LLMProviderRegistry.setActive() switches provider
- Tracks available providers and their capabilities
- Validates provider before activation
- Persists provider preference

## Dev Notes
- Package: llm-intelligence
- Story Points: 3
