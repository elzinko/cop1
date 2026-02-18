import { execSync } from 'node:child_process';

export interface SonarConfig {
  projectKey: string;
  serverUrl: string;
  token?: string;
  consent: boolean;
}

export interface SonarResult {
  passed: boolean;
  error?: string;
}

export class SonarQubeAdapter {
  constructor(private readonly timeoutMs: number = 60_000) {}

  async scan(worktreePath: string, config: SonarConfig): Promise<SonarResult> {
    if (!config.consent) {
      return { passed: false, error: 'sonar_consent_required' };
    }

    try {
      execSync(
        `npx sonar-scanner -Dsonar.projectKey=${config.projectKey} -Dsonar.host.url=${config.serverUrl}`,
        {
          cwd: worktreePath,
          encoding: 'utf-8',
          stdio: 'pipe',
          timeout: this.timeoutMs,
        },
      );

      return await this.checkQualityGate(config);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes('ETIMEDOUT') || message.includes('timeout')) {
        return { passed: false, error: 'sonar_unavailable' };
      }
      return { passed: false, error: message };
    }
  }

  private async checkQualityGate(config: SonarConfig): Promise<SonarResult> {
    try {
      const url = `${config.serverUrl}/api/qualitygates/project_status?projectKey=${config.projectKey}`;
      const headers: Record<string, string> = {};
      if (config.token) {
        headers.Authorization = `Bearer ${config.token}`;
      }

      const response = await fetch(url, { headers });
      if (!response.ok) {
        return { passed: false, error: `sonar_api_error_${response.status}` };
      }

      const data = (await response.json()) as {
        projectStatus?: { status: string };
      };

      return { passed: data.projectStatus?.status === 'OK' };
    } catch {
      return { passed: false, error: 'sonar_unavailable' };
    }
  }
}
