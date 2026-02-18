import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export interface SprintReportData {
  sprintId: string;
  deliveredStories: Array<{ id: string; title: string; points: number }>;
  velocity: number;
  blocagesCount: number;
  qualityGatePassed: boolean;
}

export class SprintEndReportService {
  private readonly reportsDir: string;

  constructor(projectPath: string) {
    this.reportsDir = join(projectPath, '.cop1/sprint-reports');
  }

  generate(data: SprintReportData): { markdown: string; json: object } {
    const markdown = this.buildMarkdown(data);
    const json = this.buildJson(data);

    if (!existsSync(this.reportsDir)) {
      mkdirSync(this.reportsDir, { recursive: true });
    }

    writeFileSync(join(this.reportsDir, `${data.sprintId}.md`), markdown, 'utf-8');

    return { markdown, json };
  }

  private buildMarkdown(data: SprintReportData): string {
    const lines = [
      `# Sprint Report: ${data.sprintId}`,
      '',
      `## Delivered Stories (${data.deliveredStories.length})`,
    ];

    for (const story of data.deliveredStories) {
      lines.push(`- ${story.id}: ${story.title} (${story.points} pts)`);
    }

    const totalPoints = data.deliveredStories.reduce((sum, s) => sum + s.points, 0);
    lines.push(
      '',
      '## Metrics',
      `- Velocity: ${data.velocity} pts/sprint`,
      `- Total points delivered: ${totalPoints}`,
      `- Blocages encountered: ${data.blocagesCount}`,
      `- Quality Gate: ${data.qualityGatePassed ? 'PASSED' : 'FAILED'}`,
    );

    return lines.join('\n');
  }

  private buildJson(data: SprintReportData): object {
    return {
      sprintId: data.sprintId,
      stories: data.deliveredStories,
      totalPoints: data.deliveredStories.reduce((sum, s) => sum + s.points, 0),
      velocity: data.velocity,
      blocagesCount: data.blocagesCount,
      qualityGatePassed: data.qualityGatePassed,
      generatedAt: new Date().toISOString(),
    };
  }
}
