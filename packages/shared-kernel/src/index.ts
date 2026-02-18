// @cop1/shared-kernel — Barrel public
// Types partagés, EventBus, ConfigPort, ResourceMonitorPort

export type { Cop1Config } from './features/config/domain/Cop1Config.js';
export type { ConfigPort } from './features/config/domain/ports/ConfigPort.js';

export { EventBus } from './features/events/domain/EventBus.js';
export { EventType } from './features/events/domain/EventType.js';
export type { EventTypeValue } from './features/events/domain/EventType.js';

export type { ResourceSnapshot } from './features/resources/domain/types/ResourceSnapshot.js';
export type { ResourceMonitorPort } from './features/resources/domain/ports/ResourceMonitorPort.js';

export { LLMCommandType } from './features/llm/domain/LLMCommandType.js';
export type { LLMCommandTypeValue } from './features/llm/domain/LLMCommandType.js';
