from __future__ import annotations

from typing import Dict, List, Optional, Any, Tuple
from datetime import datetime
from collections import Counter, defaultdict

from fastapi import FastAPI
from pydantic import BaseModel, Field, model_validator
from ortools.sat.python import cp_model


# ============================================================
# MODELS
# ============================================================

class Weights(BaseModel):
    understaff_penalty: int = Field(2000000, ge=0)
    overtime_penalty: int = Field(20, ge=0)
    preference_penalty_multiplier: int = Field(1, ge=0)
    workload_balance_weight: int = Field(0, ge=0)
    emergency_override_penalty: int = Field(500, ge=0)
    same_day_second_shift_penalty: int = Field(150, ge=0)
    weekly_night_over_penalty: int = Field(120, ge=0)
    evening_to_night_penalty: int = Field(10000, ge=0)
    shift_type_balance_penalty: int = Field(100, ge=0)
    overtime_balance_penalty: int = Field(1000, ge=0)

class GoalPriority(BaseModel):
    coverage: int = 1
    cost: int = 2
    preference: int = 3
    fairness: int = 4


class FairnessWeights(BaseModel):
    workload_balance: int = 1
    night_balance: int = 1
    shift_type_balance: int = 1


class Rules(BaseModel):
    # Global toggles
    guarantee_full_coverage: bool = True
    allow_emergency_overrides: bool = True

    # Requirement page
    max_shifts_per_day: int = Field(1, ge=1)
    max_consecutive_work_days: Optional[int] = Field(None, ge=1)
    max_consecutive_shifts: Optional[int] = Field(None, ge=1)
    min_days_off_per_week: int = Field(2, ge=0)
    max_nights_per_week: int = Field(2, ge=0)
    min_rest_hours_between_shifts: Optional[int] = Field(None, ge=0)

    # Rest / sequence toggles
    forbid_night_to_morning: bool = True
    forbid_morning_to_night_same_day: bool = False
    forbid_evening_to_night: bool = True

    # Relax / emergency behavior
    allow_second_shift_same_day_in_emergency: bool = True
    ignore_availability_in_emergency: bool = False
    allow_night_cap_override_in_emergency: bool = True
    allow_rest_rule_override_in_emergency: bool = True

    # Goal toggles page
    goal_minimize_staff_cost: bool = True
    goal_maximize_preference_satisfaction: bool = True
    goal_balance_workload: bool = False
    goal_balance_night_workload: bool = False
    goal_reduce_undesirable_shifts: bool = True

    # Shift type limit (NEW)
    enable_shift_type_limit: bool = True
    max_shift_per_type: Dict[str, int] = Field(default_factory=lambda: {
        "morning": 9,
        "evening": 9,
        "night": 9
    })
    shift_type_limit_exempt_nurses: List[str] = Field(default_factory=list)
    evening_after_morning_counts_as_overtime: bool = True
    enable_consecutive_night_limit: bool = True
    max_consecutive_night_shifts: int = Field(3, ge=1)
    enable_min_total_days_off: bool = True
    min_total_days_off: int = Field(11, ge=0)

class SolveRequest(BaseModel):
    nurses: List[str]
    days: List[str]
    shifts: List[str]
    demand: Dict[str, Dict[str, int]]

    max_overtime_per_nurse: Optional[Dict[str, int]] = None
    backup_nurses: Optional[List[str]] = None
    min_total_shifts_per_nurse: Optional[Dict[str, int]] = None
    regular_shifts_per_nurse: Optional[Dict[str, int]] = None
    max_shifts_per_nurse: Optional[Dict[str, int]] = None

    availability: Optional[Dict[str, Dict[str, Dict[str, int]]]] = None
    preferences: Optional[Dict[str, Dict[str, Dict[str, int]]]] = None
    nurse_skills: Optional[Dict[str, List[str]]] = None
    required_skills: Optional[Dict[str, Dict[str, Dict[str, int]]]] = None
    week_index_by_day: Optional[Dict[str, int]] = None

    weights: Optional[Weights] = None
    rules: Optional[Rules] = None

    goal_priority: Optional[GoalPriority] = None
    fairness_weights: Optional[FairnessWeights] = None
    time_limit_sec: float = Field(20.0, gt=0)
    num_search_workers: int = Field(8, ge=1)
    random_seed: Optional[int] = None
    enable_cp_sat_log: bool = False

    @model_validator(mode="after")
    def validate_shapes(self):
        if len(set(self.nurses)) != len(self.nurses):
            raise ValueError("Duplicate nurse IDs are not allowed.")
        if len(set(self.days)) != len(self.days):
            raise ValueError("Duplicate days are not allowed.")
        if len(set(self.shifts)) != len(self.shifts):
            raise ValueError("Duplicate shifts are not allowed.")

        for d in self.days:
            if d not in self.demand:
                raise ValueError(f"Demand missing for day '{d}'.")
            for s in self.shifts:
                if s not in self.demand[d]:
                    raise ValueError(f"Demand missing for day '{d}', shift '{s}'.")
                v = self.demand[d][s]
                if not isinstance(v, int) or v < 0:
                    raise ValueError(f"Demand must be nonnegative int at {d}/{s}.")
        return self


class Assignment(BaseModel):
    day: str
    shift: str
    nurse: str
    emergency_override: bool = False
    shift_order: int = 1
    is_overtime: bool = False


class UnderstaffItem(BaseModel):
    day: str
    shift: str
    missing: int


class NurseStats(BaseModel):
    nurse: str
    assigned_shifts: int
    overtime: int
    morning_shifts: int
    evening_shifts: int
    night_shifts: int
    satisfaction: int


class SolveResponse(BaseModel):
    status: str
    objective_value: Optional[int] = None
    assignments: List[Assignment] = Field(default_factory=list)
    understaffed: List[UnderstaffItem] = Field(default_factory=list)
    nurse_stats: List[NurseStats] = Field(default_factory=list)
    details: Optional[Dict[str, Any]] = None


# ============================================================
# APP
# ============================================================

app = FastAPI(
    title="Stable Nurse Scheduling API",
    description="Full-coverage nurse scheduler with adjustable rules and emergency fallback.",
    version="3.0.0",
)


# ============================================================
# HELPERS
# ============================================================

def is_iso_date(s: str) -> bool:
    try:
        datetime.fromisoformat(s)
        return True
    except Exception:
        return False


def get_week_index_map(days: List[str], explicit_map: Optional[Dict[str, int]]) -> Dict[str, int]:
    if explicit_map:
        return dict(explicit_map)
    if all(is_iso_date(d) for d in days):
        iso_weeks = [datetime.fromisoformat(d).isocalendar()[1] for d in days]
        uniq = {w: i for i, w in enumerate(dict.fromkeys(iso_weeks))}
        return {d: uniq[datetime.fromisoformat(d).isocalendar()[1]] for d in days}
    return {d: i // 7 for i, d in enumerate(days)}


def shift_eq(a: str, b: str) -> bool:
    return a.strip().lower() == b.strip().lower()


def find_shift_name(shifts: List[str], target: str) -> Optional[str]:
    for s in shifts:
        if shift_eq(s, target):
            return s
    return None


def get_pref_penalty(prefs, nurse, day, shift) -> int:
    if not prefs:
        return 0
    return int(prefs.get(nurse, {}).get(day, {}).get(shift, 0))


def is_available(avail, nurse, day, shift) -> bool:
    if not avail:
        return True
    return bool(avail.get(nurse, {}).get(day, {}).get(shift, 1))


def has_skill(nurse_skills: Dict[str, List[str]], nurse: str, skill: str) -> bool:
    return skill in (nurse_skills.get(nurse, []) or [])


def shift_hours_map(shifts: List[str]) -> Dict[str, Tuple[int, int]]:
    # Default ordering used when real hours are not supplied.
    out = {}
    for s in shifts:
        k = s.strip().lower()
        if k == "morning":
            out[s] = (6, 14)
        elif k == "evening":
            out[s] = (14, 22)
        elif k == "night":
            out[s] = (22, 30)  # overnight handled as next-day 06:00
        else:
            out[s] = (0, 8)
    return out


def violates_rest(prev_shift: str, next_shift: str, min_rest_hours: Optional[int], hours_map: Dict[str, Tuple[int, int]]) -> bool:
    if min_rest_hours is None:
        return False
    prev_end = hours_map[prev_shift][1]
    next_start = hours_map[next_shift][0]
    rest = next_start - prev_end
    if rest < 0:
        rest += 24
    return rest < min_rest_hours


def compute_satisfaction_for_nurse(
    nurse: str,
    days: List[str],
    shifts: List[str],
    assigned_map: Dict[Tuple[str, str, str], int],
    preferences: Dict[str, Dict[str, Dict[str, int]]],
    night_label: Optional[str],
    overtime_count: int,
    emergency_override_count: int,
) -> int:
    total = 0
    nights = 0
    disliked = 0
    for d in days:
        for s in shifts:
            if assigned_map.get((nurse, d, s), 0) == 1:
                total += 1
                if night_label and s == night_label:
                    nights += 1
                if int(preferences.get(nurse, {}).get(d, {}).get(s, 0)) > 0:
                    disliked += 1

    score = 100
    if total > 0:
        score -= int((disliked / total) * 40)
        score -= int((nights / total) * 20)
    score -= min(30, overtime_count * 5)
    score -= min(30, emergency_override_count * 10)
    return max(1, min(100, score))


# ============================================================
# MODEL BUILDERS
# ============================================================

def build_solver_model(req: SolveRequest, emergency_mode: bool = False):
    nurses, days, shifts = req.nurses, req.days, req.shifts
    backup_nurses = set(req.backup_nurses or [])
    demand = req.demand
    availability = req.availability or {}
    preferences = req.preferences or {}
    nurse_skills = req.nurse_skills or {}
    required_skills = req.required_skills or {}
    weights = req.weights or Weights()
    rules = req.rules or Rules()
    goal_priority = req.goal_priority or GoalPriority()
    fairness_weights = req.fairness_weights or FairnessWeights()

    priority_scale = {
        1: 10000000,
        2: 10000,
        3: 1000,
        4: 100
    }
    default_upper = len(days)
    per_nurse_min = {n: int((req.min_total_shifts_per_nurse or {}).get(n, 0)) for n in nurses}
    per_nurse_regular = {
        n: 0 if n in backup_nurses else int((req.regular_shifts_per_nurse or {}).get(n, default_upper))
        for n in nurses
    }

    week_idx = get_week_index_map(days, req.week_index_by_day)
    hours_map = shift_hours_map(shifts)
    night_label = find_shift_name(shifts, "night")
    morning_label = find_shift_name(shifts, "morning")
    evening_label = find_shift_name(shifts, "evening")

    weeks: Dict[int, List[str]] = {}
    for d in days:
        weeks.setdefault(week_idx[d], []).append(d)

    model = cp_model.CpModel()
    x = {(n, d, s): model.NewBoolVar(f"x_{n}_{d}_{s}") for n in nurses for d in days for s in shifts}
    terms: List[cp_model.LinearExpr] = []

    # Shift type limit — hard in Phase 1, soft penalty in Phase 2
    if rules.enable_shift_type_limit:
        exempt_nurses = set(rules.shift_type_limit_exempt_nurses or [])

        for n in nurses:
            if n in exempt_nurses:
                continue

            if morning_label and "morning" in rules.max_shift_per_type:
                max_m = rules.max_shift_per_type["morning"]
                total_m = sum(x[(n, d, morning_label)] for d in days)
                if emergency_mode:
                    excess_m = model.NewIntVar(0, len(days), f"excess_m_{n}")
                    model.Add(total_m - max_m <= excess_m)
                    terms.append(weights.emergency_override_penalty * excess_m)
                else:
                    model.Add(total_m <= max_m)

            if evening_label and "evening" in rules.max_shift_per_type:
                max_e = rules.max_shift_per_type["evening"]
                total_e = sum(x[(n, d, evening_label)] for d in days)
                if emergency_mode:
                    excess_e = model.NewIntVar(0, len(days), f"excess_e_{n}")
                    model.Add(total_e - max_e <= excess_e)
                    terms.append(weights.emergency_override_penalty * excess_e)
                else:
                    model.Add(total_e <= max_e)

            if night_label and "night" in rules.max_shift_per_type:
                max_n = rules.max_shift_per_type["night"]
                total_n = sum(x[(n, d, night_label)] for d in days)
                if emergency_mode:
                    excess_n = model.NewIntVar(0, len(days), f"excess_n_{n}")
                    model.Add(total_n - max_n <= excess_n)
                    terms.append(weights.emergency_override_penalty * excess_n)
                else:
                    model.Add(total_n <= max_n)


    # Emergency override variable: assignment allowed even if availability/rest/night-cap would normally block it.
    override = {(n, d, s): model.NewBoolVar(f"ovr_{n}_{d}_{s}") for n in nurses for d in days for s in shifts}

    total_assigned = {}
    over = {n: model.NewIntVar(0, len(days) * max(1, rules.max_shifts_per_day), f"over_{n}") for n in nurses}

    # Extra overtime: morning -> evening same day
    extra_ot = {}

    if rules.evening_after_morning_counts_as_overtime and morning_label and evening_label:
        for n in nurses:
            for d in days:
                extra_ot[(n, d)] = model.NewBoolVar(f"extra_ot_{n}_{d}")

                model.Add(
                    extra_ot[(n, d)] <= x[(n, d, morning_label)]
                )
                model.Add(
                    extra_ot[(n, d)] <= x[(n, d, evening_label)]
                )
                model.Add(
                    extra_ot[(n, d)] >= x[(n, d, morning_label)] + x[(n, d, evening_label)] - 1
                )

    # Coverage (soft constraint – never infeasible)
    under = {(d, s): model.NewIntVar(0, demand[d][s], f"under_{d}_{s}") for d in days for s in shifts}

    for d in days:
        for s in shifts:
            assigned = sum(x[(n, d, s)] for n in nurses)

            # normal coverage
            if not emergency_mode:
                model.Add(assigned == demand[d][s])
            else:
                model.Add(assigned + under[(d, s)] >= demand[d][s])

    # Daily shift count
    max_shifts_per_day = rules.max_shifts_per_day
    if emergency_mode and rules.allow_second_shift_same_day_in_emergency:
        max_shifts_per_day = max(max_shifts_per_day, 2)

    for n in nurses:
        for d in days:
            model.Add(sum(x[(n, d, s)] for s in shifts) <= max_shifts_per_day)

    # ============================================================
    # Availability (HARD — never overridden)
    # ============================================================

    for n in nurses:
        for d in days:
            for s in shifts:
                avail = is_available(availability, n, d, s)

                if not avail:
                    model.Add(x[(n, d, s)] == 0)
                    model.Add(override[(n, d, s)] == 0)
                else:
                    model.Add(override[(n, d, s)] == 0)

    # Monthly min/max totals with overtime slack
    for n in nurses:
        total = sum(x[(n, d, s)] for d in days for s in shifts)
        total_assigned[n] = total

        extra_ot_sum = 0
        if rules.evening_after_morning_counts_as_overtime and morning_label and evening_label:
            extra_ot_sum = sum(extra_ot[(n, d)] for d in days)

        # exact base overtime = max(0, total - regular)
        excess = model.NewIntVar(
            -len(days) * max_shifts_per_day,
            len(days) * max_shifts_per_day,
            f"excess_{n}"
        )
        model.Add(excess == total - per_nurse_regular[n])

        base_ot = model.NewIntVar(
            0,
            len(days) * max_shifts_per_day,
            f"base_ot_{n}"
        )
        model.AddMaxEquality(base_ot, [excess, 0])

        # final overtime = base overtime + extra overtime from morning+evening same day
        model.Add(over[n] == base_ot + extra_ot_sum)

        model.Add(total >= per_nurse_min[n])

        max_ot = (req.max_overtime_per_nurse or {}).get(n, 12)
        model.Add(over[n] <= max_ot)
        # Night -> Morning
        if night_label and morning_label and rules.forbid_night_to_morning:
            for n in nurses:
                for i in range(len(days) - 1):
                    model.Add(x[(n, days[i], night_label)] + x[(n, days[i + 1], morning_label)] <= 1)

    # Morning -> Night same day toggle
    if morning_label and night_label and rules.forbid_morning_to_night_same_day:
        for n in nurses:
            for d in days:
                model.Add(x[(n, d, morning_label)] + x[(n, d, night_label)] <= 1)

    # Evening -> Night cross-day (ALWAYS HARD — safety rule)
    # EVENING ends 24:00 on day D, NIGHT starts 00:00 on day D+1 = 0 h rest.
    # forbidEveningToNight being True means this is inviolable even in emergency.
    if evening_label and night_label and rules.forbid_evening_to_night:
        for n in nurses:
            for i in range(len(days) - 1):
                model.Add(x[(n, days[i], evening_label)] + x[(n, days[i + 1], night_label)] <= 1)

    # Weekly night cap
    if night_label:
        for n in nurses:
            for w, dlist in weeks.items():
                nights_this = sum(x[(n, d, night_label)] for d in dlist)
                if emergency_mode and rules.allow_emergency_overrides and rules.allow_night_cap_override_in_emergency:
                    extra_nights = model.NewIntVar(0, len(dlist), f"night_over_{n}_{w}")
                    model.Add(nights_this - rules.max_nights_per_week <= extra_nights)
                else:
                    extra_nights = model.NewIntVar(0, 0, f"night_over_{n}_{w}")
                    model.Add(nights_this <= rules.max_nights_per_week)
                setattr(extra_nights, "_meta", (n, w))

    # Weekly days off
    if rules.min_days_off_per_week > 0:
        for n in nurses:
            for w, dlist in weeks.items():
                cap = max(0, len(dlist) - rules.min_days_off_per_week)
                worked_days = [model.NewBoolVar(f"worked_{n}_{d}") for d in dlist]
                for wd, d in zip(worked_days, dlist):
                    model.Add(sum(x[(n, d, s)] for s in shifts) >= wd)
                    model.Add(sum(x[(n, d, s)] for s in shifts) <= max_shifts_per_day * wd)
                model.Add(sum(worked_days) <= cap)

    # ============================================================
    # NEW: Minimum Total Days Off (HARD)
    # ============================================================

    if rules.enable_min_total_days_off and rules.min_total_days_off <= len(days):
        for n in nurses:
            worked_days = []

            for d in days:
                wd = model.NewBoolVar(f"worked_total_{n}_{d}")

                # wd = 1 if nurse works any shift that day
                model.Add(sum(x[(n, d, s)] for s in shifts) >= wd)
                model.Add(sum(x[(n, d, s)] for s in shifts) <= max_shifts_per_day * wd)

                worked_days.append(wd)

            model.Add(sum(worked_days) <= len(days) - rules.min_total_days_off)
            # Also enforce minimum unique working days = regular shifts target
            # so nurses can't fall short by packing doubles on fewer days
            model.Add(sum(worked_days) >= per_nurse_regular[n])

    # Consecutive work days
    if rules.max_consecutive_work_days is not None:
        window = rules.max_consecutive_work_days + 1
        if window <= len(days):
            for n in nurses:
                worked = []
                for d in days:
                    wd = model.NewBoolVar(f"worked_day_{n}_{d}")
                    model.Add(sum(x[(n, d, s)] for s in shifts) >= wd)
                    model.Add(sum(x[(n, d, s)] for s in shifts) <= max_shifts_per_day * wd)
                    worked.append(wd)
                for i in range(len(days) - window + 1):
                    model.Add(sum(worked[i:i + window]) <= rules.max_consecutive_work_days)

    if night_label and rules.enable_consecutive_night_limit and rules.max_consecutive_night_shifts is not None:
        max_consec = rules.max_consecutive_night_shifts
        window = max_consec + 1

        if window <= len(days):
            for n in nurses:
                for i in range(len(days) - window + 1):
                    model.Add(
                        sum(x[(n, days[j], night_label)] for j in range(i, i + window))
                        <= max_consec
                    )

    # Consecutive shifts across day boundary using shift order list
    if rules.max_consecutive_shifts is not None and len(shifts) > 0:
        ordered_slots = []
        for d in days:
            for s in shifts:
                ordered_slots.append((d, s))
        win = rules.max_consecutive_shifts + 1
        if win <= len(ordered_slots):
            for n in nurses:
                for i in range(len(ordered_slots) - win + 1):
                    model.Add(sum(x[(n, dd, ss)] for dd, ss in ordered_slots[i:i + win]) <= rules.max_consecutive_shifts)

    # Minimum rest hours using default shift timetable
    if rules.min_rest_hours_between_shifts is not None:
        for n in nurses:
            for i in range(len(days) - 1):
                d1, d2 = days[i], days[i + 1]
                for s1 in shifts:
                    for s2 in shifts:
                        if violates_rest(s1, s2, rules.min_rest_hours_between_shifts, hours_map):
                            if emergency_mode and rules.allow_emergency_overrides and rules.allow_rest_rule_override_in_emergency:
                                v = model.NewBoolVar(f"rest_break_{n}_{d1}_{s1}_{d2}_{s2}")
                                model.Add(x[(n, d1, s1)] + x[(n, d2, s2)] <= 1 + v)
                            else:
                                model.Add(x[(n, d1, s1)] + x[(n, d2, s2)] <= 1)

    # Senior requirement
    for d in days:
        for s in shifts:
            need_senior = int((required_skills.get(d, {}).get(s, {}) or {}).get("Senior", 0))
            if need_senior > 0:
                eligible = [n for n in nurses if has_skill(nurse_skills, n, "Senior")]
                model.Add(sum(x[(n, d, s)] for n in eligible) >= need_senior)

    # Objective
    # ============================================================
    # BACKUP NURSE PENALTY
    # ============================================================
    for n in backup_nurses:
        for d in days:
            for s in shifts:
                terms.append(50000 * x[(n, d, s)])

    # ============================================================
    # EVENING → NIGHT SOFT CONSTRAINT (HIGH PRIORITY)
    # ============================================================

    if evening_label and night_label:
        for n in nurses:
            for d in days:

                ev_nt = model.NewBoolVar(f"ev_nt_{n}_{d}")

                # ev_nt = 1 if both evening and night assigned
                model.Add(ev_nt <= x[(n, d, evening_label)])
                model.Add(ev_nt <= x[(n, d, night_label)])
                model.Add(ev_nt >= x[(n, d, evening_label)] + x[(n, d, night_label)] - 1)

                # HIGH penalty (second priority after coverage)
                terms.append(weights.evening_to_night_penalty * ev_nt)

    # ============================================================
    # FAIRNESS IMPROVEMENTS (ADDED – does not change existing logic)
    # ============================================================

    # Total shifts per nurse
    total_shifts_var = {}
    for n in nurses:
        v = model.NewIntVar(0, len(days) * max_shifts_per_day, f"total_shifts_{n}")
        model.Add(v == total_assigned[n])
        total_shifts_var[n] = v

    # Night shifts per nurse
    night_shifts_var = {}
    if night_label:
        for n in nurses:
            v = model.NewIntVar(0, len(days), f"night_shifts_{n}")
            model.Add(v == sum(x[(n, d, night_label)] for d in days))
            night_shifts_var[n] = v

    # Workload balance variables
    max_total = model.NewIntVar(0, len(days) * max_shifts_per_day, "max_total")
    min_total = model.NewIntVar(0, len(days) * max_shifts_per_day, "min_total")

    model.AddMaxEquality(max_total, list(total_shifts_var.values()))
    model.AddMinEquality(min_total, list(total_shifts_var.values()))

    workload_balance = model.NewIntVar(0, len(days) * max_shifts_per_day, "workload_balance")
    model.Add(workload_balance == max_total - min_total)

    w = priority_scale[goal_priority.fairness] * fairness_weights.workload_balance
    terms.append(w * workload_balance)

    # Night balance variables
    if night_label:
        max_night = model.NewIntVar(0, len(days), "max_night")
        min_night = model.NewIntVar(0, len(days), "min_night")

        model.AddMaxEquality(max_night, list(night_shifts_var.values()))
        model.AddMinEquality(min_night, list(night_shifts_var.values()))

        night_balance = model.NewIntVar(0, len(days), "night_balance")
        model.Add(night_balance == max_night - min_night)

        w = priority_scale[goal_priority.fairness] * fairness_weights.night_balance
        terms.append(w * night_balance)
    
    # ============================================================
    # SHIFT TYPE BALANCE (soft)
    # ============================================================

    if morning_label and evening_label and night_label:

        for n in nurses:

            if n in backup_nurses:
                continue  # skip backup nurses

            morning_count = model.NewIntVar(0, len(days), f"morning_count_{n}")
            evening_count = model.NewIntVar(0, len(days), f"evening_count_{n}")
            night_count = model.NewIntVar(0, len(days), f"night_count_{n}")

            model.Add(morning_count == sum(x[(n,d,morning_label)] for d in days))
            model.Add(evening_count == sum(x[(n,d,evening_label)] for d in days))
            model.Add(night_count == sum(x[(n,d,night_label)] for d in days))

            max_shift_type = model.NewIntVar(0, len(days), f"max_shift_type_{n}")
            min_shift_type = model.NewIntVar(0, len(days), f"min_shift_type_{n}")

            model.AddMaxEquality(max_shift_type,
                [morning_count, evening_count, night_count])

            model.AddMinEquality(min_shift_type,
                [morning_count, evening_count, night_count])

            shift_balance = model.NewIntVar(0, len(days), f"shift_balance_{n}")

            model.Add(shift_balance == max_shift_type - min_shift_type)

            # small penalty so it's not too strict
            terms.append(
                weights.shift_type_balance_penalty *
                priority_scale[goal_priority.fairness] *
                fairness_weights.shift_type_balance *
                shift_balance
            )

    # ============================================================
    # OVERTIME BALANCE
    # ============================================================

    max_ot = model.NewIntVar(0, len(days) * max_shifts_per_day, "max_overtime")
    min_ot = model.NewIntVar(0, len(days) * max_shifts_per_day, "min_overtime")

    model.AddMaxEquality(max_ot, list(over.values()))
    model.AddMinEquality(min_ot, list(over.values()))

    overtime_balance = model.NewIntVar(
        0,
        len(days) * max_shifts_per_day,
        "overtime_balance"
    )

    model.Add(overtime_balance == max_ot - min_ot)

    # penalize difference so overtime is distributed fairly
    terms.append(
        weights.overtime_balance_penalty *
        priority_scale[goal_priority.fairness] *
        overtime_balance
    )

    for n in nurses:
        terms.append(weights.overtime_penalty * over[n])

    for d in days:
        for s in shifts:
            w = priority_scale[goal_priority.coverage]
            terms.append(w * weights.understaff_penalty * under[(d, s)])

    if rules.goal_maximize_preference_satisfaction or rules.goal_reduce_undesirable_shifts:
        for n in nurses:
            for d in days:
                for s in shifts:
                    p = get_pref_penalty(preferences, n, d, s)
                    if p:
                        w = priority_scale[goal_priority.preference]
                        terms.append(w * weights.preference_penalty_multiplier * p * x[(n, d, s)])

    if rules.goal_balance_workload and weights.workload_balance_weight > 0:
        total_demand = sum(demand[d][s] for d in days for s in shifts)
        target = total_demand // max(1, len(nurses))
        for n in nurses:
            dev = model.NewIntVar(0, len(days) * max_shifts_per_day, f"dev_{n}")
            model.AddAbsEquality(dev, total_assigned[n] - target)
            w = priority_scale[goal_priority.fairness] * fairness_weights.workload_balance
            terms.append(w * weights.workload_balance_weight * dev)

    # Penalize emergency overrides heavily so they are used only when needed.
    if emergency_mode:
        for n in nurses:
            for d in days:
                day_total = sum(x[(n, d, s)] for s in shifts)
                if max_shifts_per_day >= 2:
                    extra_same_day = model.NewIntVar(0, 1, f"same_day_extra_{n}_{d}")
                    model.Add(day_total - 1 <= extra_same_day)
                    terms.append(weights.same_day_second_shift_penalty * extra_same_day)
                for s in shifts:
                    terms.append(weights.emergency_override_penalty * override[(n, d, s)])

    if not terms:
        terms.append(0)
    model.Minimize(sum(terms))

    return {
        "model": model,
        "x": x,
        "override": override,
        "over": over,
        "week_idx": week_idx,
        "night_label": night_label,
        "morning_label": morning_label,
        "weights": weights,
        "rules": rules,
        "under": under,
        "total_assigned": total_assigned,
    }


# ============================================================
# PACK RESULTS
# ============================================================

def pack_solution(req: SolveRequest, artifacts: dict, solver: cp_model.CpSolver, status_label: str) -> SolveResponse:
    nurses, days, shifts = req.nurses, req.days, req.shifts
    preferences = req.preferences or {}
    x = artifacts["x"]
    override = artifacts["override"]
    over = artifacts["over"]
    night_label = artifacts["night_label"]
    under = artifacts["under"]

    assignments: List[Assignment] = []
    understaffed: List[UnderstaffItem] = []

    assigned_map: Dict[Tuple[str, str, str], int] = {}
    emergency_count: Counter = Counter()
    nurse_day_shift_count: Dict[Tuple[str, str], int] = {}

    for n in nurses:
        for d in days:
            for s in shifts:
                val = int(solver.Value(x[(n, d, s)]))
                assigned_map[(n, d, s)] = val
                if val == 1:
                    ev = int(solver.Value(override[(n, d, s)]))
                    if ev:
                        emergency_count[n] += 1
                    nurse_day_shift_count[(n, d)] = nurse_day_shift_count.get((n, d), 0) + 1
                    order = nurse_day_shift_count[(n, d)]
                    assignments.append(Assignment(
                        day=d, shift=s, nurse=n,
                        emergency_override=bool(ev),
                        shift_order=order,
                        is_overtime=(order > 1),
                    ))

    if under is not None:
        for d in days:
            for s in shifts:
                miss = int(solver.Value(under[(d, s)]))
                if miss > 0:
                    understaffed.append(UnderstaffItem(day=d, shift=s, missing=miss))

    stats: List[NurseStats] = []
    
    morning_label = find_shift_name(shifts, "morning")
    evening_label = find_shift_name(shifts, "evening")

    for n in nurses:
        total = sum(assigned_map[(n, d, s)] for d in days for s in shifts)

        morning_count = sum(assigned_map[(n, d, morning_label)] for d in days) if morning_label else 0
        evening_count = sum(assigned_map[(n, d, evening_label)] for d in days) if evening_label else 0
        night_count = sum(assigned_map[(n, d, night_label)] for d in days) if night_label else 0
        overtime = int(solver.Value(over[n]))
        satisfaction = compute_satisfaction_for_nurse(
            nurse=n,
            days=days,
            shifts=shifts,
            assigned_map=assigned_map,
            preferences=preferences,
            night_label=night_label,
            overtime_count=overtime,
            emergency_override_count=emergency_count[n],
        )
        stats.append(NurseStats(
            nurse=n,
            assigned_shifts=total,
            overtime=overtime,
            morning_shifts=morning_count,
            evening_shifts=evening_count,
            night_shifts=night_count,
            satisfaction=satisfaction,
        ))

    avg_satisfaction = round(sum(s.satisfaction for s in stats) / len(stats), 2) if stats else 0.0
    coverage_missing = sum(u.missing for u in understaffed)

    # Estimate additional nurses required
    import math

    extra_nurses_needed = 0
    if coverage_missing > 0:
        avg_shifts_per_nurse = max(1, len(days) * (req.rules.max_shifts_per_day if req.rules else 1))
        extra_nurses_needed = math.ceil(coverage_missing / avg_shifts_per_nurse)

    return SolveResponse(
        status=status_label,
        objective_value=int(solver.ObjectiveValue()) if status_label != "ERROR" else None,
        assignments=assignments,
        understaffed=understaffed,
        nurse_stats=stats,
        details={
            "average_satisfaction": avg_satisfaction,
            "coverage_missing": coverage_missing,
            "additional_nurses_required": extra_nurses_needed,
            "emergency_override_count": sum(emergency_count.values()),
            "best_bound": solver.BestObjectiveBound(),
            "wall_time_sec": solver.WallTime(),
            "conflicts": solver.NumConflicts(),
            "branches": solver.NumBranches(),
        },
    )


# ============================================================
# SOLVE
# ============================================================

@app.post("/solve", response_model=SolveResponse)
def solve(req: SolveRequest) -> SolveResponse:
    rules = req.rules or Rules()

    # Phase 1: normal model
    normal = build_solver_model(req, emergency_mode=False)
    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = req.time_limit_sec
    solver.parameters.num_search_workers = req.num_search_workers
    if req.random_seed is not None:
        solver.parameters.random_seed = req.random_seed
    solver.parameters.log_search_progress = req.enable_cp_sat_log

    result = solver.Solve(normal["model"])
    if result in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        res = pack_solution(req, normal, solver, "OPTIMAL" if result == cp_model.OPTIMAL else "FEASIBLE")
        if rules.guarantee_full_coverage and sum(u.missing for u in res.understaffed) == 0:
            return res
        if not rules.guarantee_full_coverage:
            return res

    # Phase 2: emergency model to force coverage with explicit penalties.
    if rules.allow_emergency_overrides:
        emergency = build_solver_model(req, emergency_mode=True)
        solver2 = cp_model.CpSolver()
        solver2.parameters.max_time_in_seconds = req.time_limit_sec
        solver2.parameters.num_search_workers = req.num_search_workers
        if req.random_seed is not None:
            solver2.parameters.random_seed = req.random_seed
        solver2.parameters.log_search_progress = req.enable_cp_sat_log

        result2 = solver2.Solve(emergency["model"])
        if result2 in (cp_model.OPTIMAL, cp_model.FEASIBLE):
            return pack_solution(req, emergency, solver2, "EMERGENCY_OPTIMAL" if result2 == cp_model.OPTIMAL else "EMERGENCY_FEASIBLE")

    return SolveResponse(
        status="INFEASIBLE",
        objective_value=None,
        assignments=[],
        understaffed=[],
        nurse_stats=[],
        details={
            "message": "No feasible schedule found. 100% coverage cannot be guaranteed unless emergency overrides are allowed and there is enough total nurse capacity to cover all demand slots.",
        },
    )


@app.get("/health")
def health() -> Dict[str, str]:
    return {"status": "ok", "version": "3.0.0"}


# ============================================================
# CLI ENTRYPOINT
# ============================================================

if __name__ == "__main__":
    import sys
    import json
    import argparse
    import traceback

    parser = argparse.ArgumentParser(description="Stable Nurse Scheduling Solver")
    parser.add_argument("--cli", action="store_true", help="Run in CLI mode")
    parser.add_argument("--input", type=str, default=None)
    parser.add_argument("--output", type=str, default=None)
    args = parser.parse_args()

    if not args.cli:
        print("Run as server with: uvicorn stable_nurse_solver:app --reload --port 8001", file=sys.stderr)
        sys.exit(0)

    try:
        if args.input:
            with open(args.input, "r", encoding="utf-8") as f:
                raw = f.read()
        else:
            raw = sys.stdin.read()

        payload = json.loads(raw) if raw.strip() else {}
        req = SolveRequest(**payload)
        res = solve(req)
        out = res.model_dump()
        out_json = json.dumps(out, ensure_ascii=False)

        if args.output:
            with open(args.output, "w", encoding="utf-8") as f:
                f.write(out_json)
        else:
            sys.stdout.write(out_json)
        sys.exit(0)

    except Exception as e:
        err = {
            "status": "ERROR",
            "objective_value": None,
            "assignments": [],
            "understaffed": [],
            "nurse_stats": [],
            "details": {
                "error": str(e),
                "trace": traceback.format_exc(),
            },
        }
        out_json = json.dumps(err, ensure_ascii=False)
        if args.output:
            with open(args.output, "w", encoding="utf-8") as f:
                f.write(out_json)
        else:
            sys.stdout.write(out_json)
        sys.exit(1)