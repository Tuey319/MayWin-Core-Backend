// src/database/entities/scheduling/constraint-profile.entity.ts
import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ schema: 'maywin_db', name: 'constraint_profiles' })
export class ConstraintProfile {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id: string;

  @Column({ type: 'bigint', nullable: true })
  unit_id: string | null;

  /** Set for org-level profiles created via /organizations/:orgId/constraint-profiles */
  @Column({ type: 'bigint', nullable: true })
  org_id: string | null;

  @Column({ type: 'text' })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  /** Display label for the department this profile is intended for */
  @Column({ type: 'text', nullable: true })
  assigned_to: string | null;

  /** UI accent colour: 'primary' | 'warning' | 'success' */
  @Column({ type: 'text', default: 'primary' })
  color: string;

  // ── Sequence / rest constraints ────────────────────────────────────────────

  @Column({ type: 'int', nullable: true })
  max_consecutive_work_days: number | null;

  @Column({ type: 'int', nullable: true })
  max_consecutive_night_shifts: number | null;

  @Column({ type: 'int', nullable: true })
  min_rest_hours_between_shifts: number | null;

  // ── Daily shift limits ─────────────────────────────────────────────────────

  /** Maps to Rules.max_shifts_per_day (default 1) */
  @Column({ type: 'int', default: 1 })
  max_shifts_per_day: number;

  // ── Weekly limits ──────────────────────────────────────────────────────────

  /** Minimum off-days per calendar week. Maps to Rules.min_days_off_per_week */
  @Column({ type: 'int', default: 2 })
  min_days_off_per_week: number;

  /** Max night shifts in a calendar week. Maps to Rules.max_nights_per_week */
  @Column({ type: 'int', default: 2 })
  max_nights_per_week: number;

  // ── Shift-sequence toggles ─────────────────────────────────────────────────

  /** Forbid night → morning back-to-back across day boundary */
  @Column({ type: 'boolean', default: true })
  forbid_night_to_morning: boolean;

  /** Forbid assigning morning and night on the same calendar day */
  @Column({ type: 'boolean', default: false })
  forbid_morning_to_night_same_day: boolean;

  // ── Global coverage / emergency toggles ───────────────────────────────────

  /** If true, solver will retry in emergency mode to achieve full coverage */
  @Column({ type: 'boolean', default: true })
  guarantee_full_coverage: boolean;

  /** Allow Phase-2 emergency overrides when strict solve can't cover demand */
  @Column({ type: 'boolean', default: true })
  allow_emergency_overrides: boolean;

  // ── Emergency relaxation options ───────────────────────────────────────────

  @Column({ type: 'boolean', default: true })
  allow_second_shift_same_day_in_emergency: boolean;

  @Column({ type: 'boolean', default: false })
  ignore_availability_in_emergency: boolean;

  @Column({ type: 'boolean', default: true })
  allow_night_cap_override_in_emergency: boolean;

  @Column({ type: 'boolean', default: true })
  allow_rest_rule_override_in_emergency: boolean;

  // ── Goal toggles ───────────────────────────────────────────────────────────

  @Column({ type: 'boolean', default: true })
  goal_minimize_staff_cost: boolean;

  @Column({ type: 'boolean', default: true })
  goal_maximize_preference_satisfaction: boolean;

  @Column({ type: 'boolean', default: false })
  goal_balance_workload: boolean;

  @Column({ type: 'boolean', default: false })
  goal_balance_night_workload: boolean;

  @Column({ type: 'boolean', default: true })
  goal_reduce_undesirable_shifts: boolean;

  // ── Objective weights ──────────────────────────────────────────────────────

  /**
   * Penalty weights sent to the Python solver.
   * Expected keys (matching app3.py Weights model):
   *   understaff_penalty, overtime_penalty, preference_penalty_multiplier,
   *   workload_balance_weight, emergency_override_penalty,
   *   same_day_second_shift_penalty, weekly_night_over_penalty
   */
  @Column({ type: 'jsonb', nullable: true })
  penalty_weight_json: Record<string, any> | null;

  /**
   * Fairness balance weights sent to the Python solver.
   * Expected keys (matching app3.py FairnessWeights model):
   *   workload_balance, night_balance, shift_type_balance
   */
  @Column({ type: 'jsonb', nullable: true })
  fairness_weight_json: Record<string, any> | null;

  /**
   * Goal priority ordering sent to the Python solver.
   * Expected keys (matching app3.py GoalPriority model):
   *   coverage, cost, preference, fairness   (values 1-4, lower = higher priority)
   */
  @Column({ type: 'jsonb', nullable: true })
  goal_priority_json: Record<string, any> | null;

  // ── Solver execution tuning ────────────────────────────────────────────────

  @Column({ type: 'int', default: 8 })
  num_search_workers: number;

  @Column({ type: 'real', default: 20 })
  time_limit_sec: number;

  // ── Meta ───────────────────────────────────────────────────────────────────

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  attributes: Record<string, any>;

  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;
}
