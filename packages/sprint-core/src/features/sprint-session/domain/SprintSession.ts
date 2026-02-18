export interface SprintSessionData {
  startedAt: string;
  durationMinutes: number;
  deadline: string;
  status: 'active' | 'completed' | 'expired';
}

export function isExpired(session: SprintSessionData): boolean {
  return new Date() >= new Date(session.deadline);
}

export function parseDuration(input: string): number {
  const match = input.match(/^(\d+)(h|m)$/);
  if (!match) {
    throw new Error(`Invalid duration format: "${input}". Use e.g. "1h", "2h", "30m".`);
  }
  const value = Number.parseInt(match[1] ?? '0', 10);
  const unit = match[2] ?? 'm';
  return unit === 'h' ? value * 60 : value;
}
