export interface ReviewAction {
  suggestionId: string;
  action: 'approved' | 'rejected' | 'debate-requested';
  reason?: string;
  timestamp: string;
}
