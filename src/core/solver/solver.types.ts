// src/core/solver/solver.types.ts
export type NormalizedInputV1 = Record<string, any>;

export type SolverPlan = 'A_STRICT' | 'A_RELAXED' | 'B_MILP';

export interface SolverAssignment {
  nurse: string;   // e.g. "N1" or worker code
  date: string;    // ISO "YYYY-MM-DD" (MUST match ScheduleAssignment.date)
  shift: string;   // must match ShiftTemplate.code (e.g. "DAY", "NIGHT")
}

export interface SolverResult {
  feasible: boolean;
  objective?: number | null;
  assignments: SolverAssignment[];
  meta?: Record<string, any>;
}
