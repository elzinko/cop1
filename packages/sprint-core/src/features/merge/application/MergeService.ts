import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse, stringify } from 'yaml';
import type { MergeProposal } from '../domain/MergeProposal.js';

const PROPOSALS_DIR = '.cop1/merge-proposals';

export class MergeService {
  private readonly proposalsDir: string;

  constructor(
    private readonly projectPath: string,
    private readonly autoMerge: boolean = false,
  ) {
    this.proposalsDir = join(projectPath, PROPOSALS_DIR);
  }

  proposeOrMerge(storyId: string, worktreePath: string, branchName: string): MergeProposal {
    const proposal: MergeProposal = {
      storyId,
      branchName,
      worktreePath,
      createdAt: new Date().toISOString(),
      status: 'pending',
    };

    if (this.autoMerge) {
      this.merge(proposal);
      proposal.status = 'merged';
    }

    this.saveProposal(proposal);
    return proposal;
  }

  getPending(): MergeProposal[] {
    return this.listAll().filter((p) => p.status === 'pending');
  }

  listAll(): MergeProposal[] {
    if (!existsSync(this.proposalsDir)) return [];

    return readdirSync(this.proposalsDir)
      .filter((f) => f.endsWith('.yaml'))
      .map((f) => parse(readFileSync(join(this.proposalsDir, f), 'utf-8')) as MergeProposal);
  }

  private merge(proposal: MergeProposal): void {
    execSync(`git merge --no-ff ${proposal.branchName} -m "merge: ${proposal.storyId}"`, {
      cwd: this.projectPath,
      stdio: 'pipe',
    });
  }

  private saveProposal(proposal: MergeProposal): void {
    if (!existsSync(this.proposalsDir)) {
      mkdirSync(this.proposalsDir, { recursive: true });
    }
    const filePath = join(this.proposalsDir, `${proposal.storyId}.yaml`);
    writeFileSync(filePath, stringify(proposal), 'utf-8');
  }
}
