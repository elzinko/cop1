export const EventType = {
  RESOURCE_SNAPSHOT: 'resource.snapshot',
  CONFIG_RELOADED: 'config.reloaded',
} as const;

export type EventTypeValue = (typeof EventType)[keyof typeof EventType];
