# Story E4-S4: Blocage Config

Status: ready-for-dev

## Story
As a system administrator
I want to configure blocage rules in cop1.config.yaml
so that blocage handling behavior can be customized without code changes

## Acceptance Criteria
1. blocage_rules section is added to cop1.config.yaml schema
2. Rules include routing, timeout, and retry configurations
3. Configuration is validated on system startup
4. Changes to configuration are reflected in runtime behavior

## Dev Notes
- Package: app
- Story Points: 2
