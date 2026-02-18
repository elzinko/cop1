export interface AlertPayload {
  type: 'blocage' | 'dod-failure' | 'ceremony';
  storyId: string;
  message: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  createdAt: string;
}
