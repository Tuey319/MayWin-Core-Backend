// src/core/solver/solver.types.ts
export type NormalizedInputV1 = Record<string, any>;

export type SolverPlan = 'A_STRICT' | 'A_RELAXED' | 'B_MILP';

export interface SolverAssignment {
  nurse: string;            // worker code, e.g. "N1"
  date: string;             // ISO "YYYY-MM-DD"
  shift: string;            // shift code, e.g. "Morning", "Night"
  emergency_override?: boolean;
}

/** Per-nurse statistics returned by app3.py */
export interface NurseStats {
  nurse: string;
  assigned_shifts: number;
  overtime: number;
  morning_shifts: number;
  evening_shifts: number;
  night_shifts: number;
  satisfaction: number;  // 1-100 score
}

/** Understaffed slot returned by app3.py */
export interface UnderstaffedItem {
  day: string;
  shift: string;
  missing: number;
}

export interface SolverResult {
  feasible: boolean;
  status?: string;
  objective?: number | null;
  assignments: SolverAssignment[];
  nurse_stats?: NurseStats[];
  understaffed?: UnderstaffedItem[];
  meta?: Record<string, any>;
}
