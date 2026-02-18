export interface BurndownDataPoint {
  day: number;
  date: string;
  idealRemaining: number;
  actualRemaining: number;
}

export interface BurnupDataPoint {
  day: number;
  date: string;
  scope: number;
  completed: number;
}

export interface ChartData {
  burndown: BurndownDataPoint[];
  burnup: BurnupDataPoint[];
  projectedCompletionDay: number | null;
}
