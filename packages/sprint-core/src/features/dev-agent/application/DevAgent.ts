import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { StepResult } from '../../workflow/domain/StepResult.js';
import type { WorkflowContext } from '../../workflow/domain/WorkflowContext.js';
import type { WorkflowStep } from '../../workflow/domain/WorkflowStep.js';
import { buildDevPrompt, parseLLMResponse } from '../domain/DevPromptTemplate.js';
import type { CodeGeneratorPort } from '../domain/ports/CodeGeneratorPort.js';
import { WorktreeManager } from '../infrastructure/WorktreeManager.js';

export class DevAgent implements WorkflowStep {
  name = 'dev';

  private readonly worktreeManager: WorktreeManager;

  constructor(
    private readonly codeGenerator: CodeGeneratorPort,
    worktreeManager?: WorktreeManager,
  ) {
    this.worktreeManager = worktreeManager ?? new WorktreeManager();
  }

  async run(context: WorkflowContext): Promise<StepResult> {
    let worktreePath: string | null = null;

    try {
      worktreePath = this.worktreeManager.create(context.projectPath, context.storyId);

      const snapshotContent = context.storyContent ?? `Story: ${context.storyId}`;
      const prompt = buildDevPrompt(context.storyId, snapshotContent);
      const response = await this.codeGenerator.generate(prompt);
      const { files, commitMessage } = parseLLMResponse(response);

      for (const file of files) {
        const fullPath = join(worktreePath, file.path);
        const dir = dirname(fullPath);
        if (!existsSync(dir)) {
          mkdirSync(dir, { recursive: true });
        }
        writeFileSync(fullPath, file.content, 'utf-8');
      }

      if (files.length > 0) {
        execSync('git add -A', { cwd: worktreePath, stdio: 'pipe' });
        execSync(`git commit -m "${commitMessage.replace(/"/g, '\\"')}"`, {
          cwd: worktreePath,
          stdio: 'pipe',
        });
      }

      return { status: 'ok', worktreePath };
    } catch (error) {
      return {
        status: 'failed',
        error: error instanceof Error ? error : new Error(String(error)),
      };
    } finally {
      if (worktreePath && !context.preserveWorktree) {
        try {
          this.worktreeManager.cleanup(context.projectPath, worktreePath);
        } catch {
          // Best-effort cleanup
        }
      }
    }
  }
}
