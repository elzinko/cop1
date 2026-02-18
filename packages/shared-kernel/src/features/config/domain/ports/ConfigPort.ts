import type { Cop1Config } from '../Cop1Config.js';

export interface ConfigPort {
  get(): Cop1Config;
}
