import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse, stringify } from 'yaml';

export interface WSJFInput {
  storyId: string;
  businessValue: number;
  timeCriticality: number;
  riskReduction: number;
  jobSize: number;
}

export interface WSJFScore {
  storyId: string;
  wsjf: number;
  components: WSJFInput;
}

export class WSJFService {
  private readonly overridesPath: string;

  constructor(projectPath: string) {
    this.overridesPath = join(projectPath, '.cop1/wsjf-overrides.yaml');
  }

  score(input: WSJFInput): WSJFScore {
    const override = this.getOverride(input.storyId);
    const effectiveInput = override ?? input;
    const jobSize = Math.max(1, effectiveInput.jobSize);
    const wsjf =
      (effectiveInput.businessValue +
        effectiveInput.timeCriticality +
        effectiveInput.riskReduction) /
      jobSize;

    return {
      storyId: effectiveInput.storyId,
      wsjf: Math.round(wsjf * 100) / 100,
      components: effectiveInput,
    };
  }

  setOverride(input: WSJFInput): void {
    const overrides = this.loadOverrides();
    overrides[input.storyId] = input;
    writeFileSync(this.overridesPath, stringify(overrides), 'utf-8');
  }

  private getOverride(storyId: string): WSJFInput | undefined {
    const overrides = this.loadOverrides();
    return overrides[storyId];
  }

  private loadOverrides(): Record<string, WSJFInput> {
    if (!existsSync(this.overridesPath)) return {};
    try {
      return (parse(readFileSync(this.overridesPath, 'utf-8')) as Record<string, WSJFInput>) ?? {};
    } catch {
      return {};
    }
  }
}
