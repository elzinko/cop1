export interface MergeProposal {
  storyId: string;
  branchName: string;
  worktreePath: string;
  createdAt: string;
  status: 'pending' | 'merged';
}
