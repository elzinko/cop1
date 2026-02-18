import type { BlocageTypeValue } from '../domain/Blocage.js';

const DEFAULT_ROUTING: Record<string, string> = {
  ambiguity: 'architect',
  'missing-access': 'developer',
  'missing-dependency': 'developer',
  technical: 'scrum-master',
  timeout: 'pm',
};

export class EscaladeService {
  private routing: Record<string, string>;

  constructor(customRouting?: Record<string, string>) {
    this.routing = { ...DEFAULT_ROUTING, ...customRouting };
  }

  route(blocageType: BlocageTypeValue): string {
    return this.routing[blocageType] ?? 'developer';
  }

  updateRouting(newRouting: Record<string, string>): void {
    this.routing = { ...DEFAULT_ROUTING, ...newRouting };
  }
}
