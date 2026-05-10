"""
solver_cli_v3.py — Fairness-First Nurse Scheduler

Priority hierarchy
──────────────────
P1 HARD   : equal work-days per nurse (→ equal leave days)
            no night-shift followed by morning-shift (next day)
            max 2 consecutive night shifts
P2 SOFT-5 : coverage — fill demand slots
P3 SOFT-4 : avoid evening+night combinations
              (same-day double AND next-day sequence)
P4 SOFT-3 : OT equalization with per-nurse preference delta
P5 SOFT-2 : rest patterns — consecutive blocks, post-night
              recovery, spread distribution
P6 SOFT-1 : shift-type fairness, backup avoidance
"""
from __future__ import annotations

import math
from typing import Any, Dict, List, Optional, Tuple
from datetime import datetime
from collections import Counter

from fastapi import FastAPI
from pydantic import BaseModel, Field, model_validator
from ortools.sat.python import cp_model


# ============================================================
# MODELS
# ============================================================

class Weights(BaseModel):
    # P2 — coverage
    understaff_penalty: int = Field(500_000, ge=0)
    # P3 — evening+night transitions
    evening_night_same_day_penalty: int = Field(200_000, ge=0)
    evening_night_next_day_penalty: int = Field(50_000, ge=0)
    # P4 — OT equalization
    ot_deviation_penalty: int = Field(20_000, ge=0)
    # P5 — rest patterns
    post_night_rest_penalty: int = Field(5_000, ge=0)
    rest_distribution_penalty: int = Field(2_000, ge=0)
    isolated_rest_penalty: int = Field(1_000, ge=0)
    short_rest_block_penalty: int = Field(800, ge=0)
    # P6 — misc
    shift_type_balance_penalty: int = Field(200, ge=0)
    backup_nurse_penalty: int = Field(50_000, ge=0)
    emergency_same_day_penalty: int = Field(150, ge=0)


class NurseConfig(BaseModel):
    """Per-nurse OT preference.

    ot_delta is added to the nurse's computed average-OT target.
    Negative = wants fewer overtime shifts (e.g. -2 → two fewer than avg).
    Positive = willing to take more overtime.
    """
    ot_delta: int = 0


class Rules(BaseModel):
    # ── Coverage ────────────────────────────────────────────
    guarantee_full_coverage: bool = True
    allow_emergency_overrides: bool = True

    # ── Base scheduling ─────────────────────────────────────
    max_shifts_per_day: int = Field(1, ge=1)
    min_total_days_off: int = Field(11, ge=0)
    max_consecutive_work_days: Optional[int] = Field(None, ge=1)

    # ── P1 HARD sequence rules ───────────────────────────────
    forbid_night_to_morning: bool = True
    max_consecutive_night_shifts: int = Field(2, ge=1)  # "no 3 in a row"

    # ── Weekly caps ──────────────────────────────────────────
    max_nights_per_week: int = Field(2, ge=0)
    min_days_off_per_week: int = Field(2, ge=0)

    # ── Emergency relaxations ────────────────────────────────
    allow_second_shift_same_day_in_emergency: bool = True
    allow_night_cap_override_in_emergency: bool = True
    allow_rest_rule_override_in_emergency: bool = True

    # ── OT ───────────────────────────────────────────────────
    max_ot_per_nurse: int = Field(8, ge=0)  # hard ceiling per nurse

    # ── Rest patterns (P5) ───────────────────────────────────
    enable_post_night_rest: bool = True
    post_night_rest_days: int = Field(2, ge=1)
    enable_isolated_rest_penalty: bool = True
    min_rest_block_size: int = Field(3, ge=1)
    max_consecutive_rest_days: Optional[int] = Field(5, ge=1)
    enable_rest_distribution: bool = True

    # ── Shift-type limit (optional) ──────────────────────────
    enable_shift_type_limit: bool = False
    max_shift_per_type: Dict[str, int] = Field(default_factory=dict)
    shift_type_limit_exempt_nurses: List[str] = Field(default_factory=list)


class SolveRequest(BaseModel):
    nurses: List[str]
    days: List[str]
    shifts: List[str]
    demand: Dict[str, Dict[str, int]]

    # Per-nurse config (OT preferences)
    nurse_configs: Optional[Dict[str, NurseConfig]] = None

    backup_nurses: Optional[List[str]] = None
    availability: Optional[Dict[str, Dict[str, Dict[str, int]]]] = None
    preferences: Optional[Dict[str, Dict[str, Dict[str, int]]]] = None
    nurse_skills: Optional[Dict[str, List[str]]] = None
    required_skills: Optional[Dict[str, Dict[str, Dict[str, int]]]] = None
    week_index_by_day: Optional[Dict[str, int]] = None

    weights: Optional[Weights] = None
    rules: Optional[Rules] = None

    time_limit_sec: float = Field(30.0, gt=0)
    num_search_workers: int = Field(8, ge=1)
    random_seed: Optional[int] = None
    enable_cp_sat_log: bool = False

    @model_validator(mode="after")
    def validate_shapes(self):
        if len(set(self.nurses)) != len(self.nurses):
            raise ValueError("Duplicate nurse IDs.")
        if len(set(self.days)) != len(self.days):
            raise ValueError("Duplicate days.")
        if len(set(self.shifts)) != len(self.shifts):
            raise ValueError("Duplicate shifts.")
        for d in self.days:
            if d not in self.demand:
                raise ValueError(f"Demand missing for day '{d}'.")
            for s in self.shifts:
                if s not in self.demand[d]:
                    raise ValueError(f"Demand missing for day '{d}', shift '{s}'.")
                if not isinstance(self.demand[d][s], int) or self.demand[d][s] < 0:
                    raise ValueError(f"Demand must be non-negative int at {d}/{s}.")
        return self


class Assignment(BaseModel):
    day: str
    shift: str
    nurse: str
    emergency_override: bool = False


class UnderstaffItem(BaseModel):
    day: str
    shift: str
    missing: int


class NurseStats(BaseModel):
    nurse: str
    work_days: int
    total_shifts: int
    ot_shifts: int
    morning_shifts: int
    evening_shifts: int
    night_shifts: int
    target_total_shifts: int
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
    title="Nurse Scheduling API v3 — Fairness-First",
    description="Equal base shifts, equal leave days, flexible OT targets, rest-aware scheduling.",
    version="5.0.0",
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


def is_available(avail, nurse, day, shift) -> bool:
    if not avail:
        return True
    return bool(avail.get(nurse, {}).get(day, {}).get(shift, 1))


def has_skill(nurse_skills: Dict[str, List[str]], nurse: str, skill: str) -> bool:
    return skill in (nurse_skills.get(nurse, []) or [])


def compute_nurse_targets(
    nurses: List[str],
    total_demand: int,
    target_work_days: int,
    nurse_configs: Optional[Dict[str, NurseConfig]],
    max_ot: int,
) -> Dict[str, int]:
    """
    Computes per-nurse target total-shift count.

    Equal base = target_work_days shifts (1 per work day).
    OT pool = max(0, total_demand - target_work_days * num_nurses).
    OT is distributed proportionally to nurse ot_delta preferences.
    Negative delta = fewer OT than average; positive = more.
    """
    n = len(nurses)
    configs = nurse_configs or {}
    base_capacity = target_work_days * n
    ot_pool = max(0, total_demand - base_capacity)
    avg_ot = ot_pool / n if n else 0

    raw: Dict[str, float] = {
        nurse: avg_ot + configs.get(nurse, NurseConfig()).ot_delta
        for nurse in nurses
    }

    # Floor to non-negative integers, clamp to max_ot
    floored: Dict[str, int] = {
        nurse: max(0, min(int(raw[nurse]), max_ot))
        for nurse in nurses
    }
    allocated = sum(floored.values())
    remainder = max(0, ot_pool - allocated)

    # Distribute remainder to nurses with largest fractional parts, within max_ot
    order = sorted(
        nurses,
        key=lambda x: -(raw[x] - int(raw[x])) if raw[x] >= 0 else 0,
    )
    for nurse in order:
        if remainder <= 0:
            break
        if floored[nurse] < max_ot:
            floored[nurse] += 1
            remainder -= 1

    return {nurse: target_work_days + floored[nurse] for nurse in nurses}


def compute_satisfaction(
    nurse: str,
    days: List[str],
    shifts: List[str],
    assigned_map: Dict[Tuple[str, str, str], int],
    preferences: Dict,
    night_label: Optional[str],
    ot_count: int,
) -> int:
    total = sum(assigned_map.get((nurse, d, s), 0) for d in days for s in shifts)
    nights = sum(assigned_map.get((nurse, d, night_label), 0) for d in days) if night_label else 0
    disliked = sum(
        1
        for d in days for s in shifts
        if assigned_map.get((nurse, d, s), 0) == 1
        and int(preferences.get(nurse, {}).get(d, {}).get(s, 0)) > 0
    )
    score = 100
    if total > 0:
        score -= int((disliked / total) * 40)
        score -= int((nights / total) * 20)
    score -= min(30, ot_count * 5)
    return max(1, min(100, score))


# ============================================================
# SOLVER MODEL
# ============================================================

def build_solver_model(req: SolveRequest, emergency_mode: bool = False):
    nurses = req.nurses
    days = req.days
    shifts = req.shifts
    demand = req.demand
    backup_nurses = set(req.backup_nurses or [])
    availability = req.availability or {}
    nurse_skills = req.nurse_skills or {}
    required_skills = req.required_skills or {}
    preferences = req.preferences or {}
    weights = req.weights or Weights()
    rules = req.rules or Rules()
    nurse_configs = req.nurse_configs or {}

    D = len(days)
    N = len(nurses)

    night_label = find_shift_name(shifts, "night")
    morning_label = find_shift_name(shifts, "morning")
    evening_label = find_shift_name(shifts, "evening")

    week_idx = get_week_index_map(days, req.week_index_by_day)
    weeks: Dict[int, List[str]] = {}
    for d in days:
        weeks.setdefault(week_idx[d], []).append(d)

    max_spd = rules.max_shifts_per_day
    if emergency_mode and rules.allow_second_shift_same_day_in_emergency:
        max_spd = max(max_spd, 2)

    # ── Target work-days (equal for all nurses, enforced HARD) ──
    target_work_days = max(0, D - rules.min_total_days_off)

    # ── Per-nurse OT targets ─────────────────────────────────────
    total_demand = sum(demand[d][s] for d in days for s in shifts)
    nurse_targets = compute_nurse_targets(
        nurses, total_demand, target_work_days, nurse_configs, rules.max_ot_per_nurse
    )

    # ── Decision variables ───────────────────────────────────────
    model = cp_model.CpModel()
    x = {
        (n, d, s): model.NewBoolVar(f"x_{n}_{d}_{s}")
        for n in nurses for d in days for s in shifts
    }
    terms: List = []

    # ── Canonical worked-day vars ────────────────────────────────
    wday: Dict[Tuple[str, int], Any] = {}
    for n in nurses:
        for i, d in enumerate(days):
            wd = model.NewBoolVar(f"wd_{n}_{i}")
            model.Add(sum(x[(n, d, s)] for s in shifts) >= wd)
            model.Add(sum(x[(n, d, s)] for s in shifts) <= max_spd * wd)
            wday[(n, i)] = wd

    # ============================================================
    # P1 HARD — Equal work-days per nurse
    # ============================================================
    for n in nurses:
        model.Add(sum(wday[(n, i)] for i in range(D)) == target_work_days)

    # ── Daily shift cap ──────────────────────────────────────────
    for n in nurses:
        for d in days:
            model.Add(sum(x[(n, d, s)] for s in shifts) <= max_spd)

    # ── Availability (HARD) ──────────────────────────────────────
    for n in nurses:
        for d in days:
            for s in shifts:
                if not is_available(availability, n, d, s):
                    model.Add(x[(n, d, s)] == 0)

    # ============================================================
    # P1 HARD — No night → morning (consecutive days)
    # ============================================================
    if night_label and morning_label and rules.forbid_night_to_morning:
        for n in nurses:
            for i in range(D - 1):
                model.Add(
                    x[(n, days[i], night_label)] + x[(n, days[i + 1], morning_label)] <= 1
                )

    # ============================================================
    # P1 HARD — Max consecutive night shifts (default 2 = no 3 in a row)
    # ============================================================
    if night_label:
        window = rules.max_consecutive_night_shifts + 1
        if window <= D:
            for n in nurses:
                for i in range(D - window + 1):
                    model.Add(
                        sum(x[(n, days[j], night_label)] for j in range(i, i + window))
                        <= rules.max_consecutive_night_shifts
                    )

    # ── Weekly night cap ─────────────────────────────────────────
    if night_label:
        for n in nurses:
            for w, dlist in weeks.items():
                nights_this = sum(x[(n, d, night_label)] for d in dlist)
                if emergency_mode and rules.allow_night_cap_override_in_emergency:
                    pass  # no hard cap in emergency
                else:
                    model.Add(nights_this <= rules.max_nights_per_week)

    # ── Weekly days-off minimum (uses canonical wday) ────────────
    if rules.min_days_off_per_week > 0:
        for n in nurses:
            for w, dlist in weeks.items():
                cap = max(0, len(dlist) - rules.min_days_off_per_week)
                idx = [i for i, d in enumerate(days) if d in set(dlist)]
                model.Add(sum(wday[(n, i)] for i in idx) <= cap)

    # ── OT hard ceiling per nurse ────────────────────────────────
    for n in nurses:
        total_shifts_n = sum(x[(n, d, s)] for d in days for s in shifts)
        model.Add(total_shifts_n <= target_work_days + rules.max_ot_per_nurse)

    # ── Max consecutive work days ────────────────────────────────
    if rules.max_consecutive_work_days is not None:
        cw = rules.max_consecutive_work_days
        cw_window = cw + 1
        if cw_window <= D:
            for n in nurses:
                for i in range(D - cw_window + 1):
                    model.Add(sum(wday[(n, i + j)] for j in range(cw_window)) <= cw)

    # ── Shift-type limit (optional hard/soft) ────────────────────
    if rules.enable_shift_type_limit:
        exempt = set(rules.shift_type_limit_exempt_nurses)
        for n in nurses:
            if n in exempt:
                continue
            for label, key in [(morning_label, "morning"), (evening_label, "evening"), (night_label, "night")]:
                if label and key in rules.max_shift_per_type:
                    cap = rules.max_shift_per_type[key]
                    model.Add(sum(x[(n, d, label)] for d in days) <= cap)

    # ── Skill requirements ───────────────────────────────────────
    for d in days:
        for s in shifts:
            need = int((required_skills.get(d, {}).get(s, {}) or {}).get("Senior", 0))
            if need > 0:
                eligible = [n for n in nurses if has_skill(nurse_skills, n, "Senior")]
                model.Add(sum(x[(n, d, s)] for n in eligible) >= need)

    # ============================================================
    # MAX CONSECUTIVE REST DAYS (hard cap against one-sided month)
    # ============================================================
    if rules.max_consecutive_rest_days is not None:
        max_cr = rules.max_consecutive_rest_days
        cr_window = max_cr + 1
        if cr_window <= D:
            for n in nurses:
                for i in range(D - cr_window + 1):
                    model.Add(sum(wday[(n, i + j)] for j in range(cr_window)) >= 1)

    # ============================================================
    # P2 SOFT — Coverage
    # ============================================================
    under = {(d, s): model.NewIntVar(0, demand[d][s], f"under_{d}_{s}") for d in days for s in shifts}
    for d in days:
        for s in shifts:
            assigned = sum(x[(n, d, s)] for n in nurses)
            if not emergency_mode:
                model.Add(assigned == demand[d][s])
            else:
                model.Add(assigned + under[(d, s)] >= demand[d][s])
                terms.append(weights.understaff_penalty * under[(d, s)])

    # ============================================================
    # P3 SOFT — Evening+Night penalties
    # Same-day (double shift): evening AND night on same day
    # Next-day sequence: evening on day i, night on day i+1
    # ============================================================
    if evening_label and night_label:
        for n in nurses:
            # Same-day double shift
            for d in days:
                ev_nt = model.NewBoolVar(f"ev_nt_sd_{n}_{d}")
                model.Add(ev_nt <= x[(n, d, evening_label)])
                model.Add(ev_nt <= x[(n, d, night_label)])
                model.Add(ev_nt >= x[(n, d, evening_label)] + x[(n, d, night_label)] - 1)
                terms.append(weights.evening_night_same_day_penalty * ev_nt)

            # Next-day sequence: works evening, then night next day
            for i in range(D - 1):
                ev_then_nt = model.NewBoolVar(f"ev_nt_nd_{n}_{i}")
                model.Add(ev_then_nt <= x[(n, days[i], evening_label)])
                model.Add(ev_then_nt <= x[(n, days[i + 1], night_label)])
                model.Add(
                    ev_then_nt >= x[(n, days[i], evening_label)]
                    + x[(n, days[i + 1], night_label)] - 1
                )
                terms.append(weights.evening_night_next_day_penalty * ev_then_nt)

    # ============================================================
    # P4 SOFT — OT equalization with per-nurse targets
    # Penalise |total_shifts[n] - target[n]|
    # ============================================================
    total_shifts_var: Dict[str, Any] = {}
    for n in nurses:
        total_n = sum(x[(n, d, s)] for d in days for s in shifts)
        v = model.NewIntVar(0, D * max_spd, f"ts_{n}")
        model.Add(v == total_n)
        total_shifts_var[n] = v

        tgt = nurse_targets[n]
        dev = model.NewIntVar(0, D * max_spd, f"ot_dev_{n}")
        model.AddAbsEquality(dev, v - tgt)
        terms.append(weights.ot_deviation_penalty * dev)

    # ============================================================
    # P5 SOFT — Rest patterns
    # ============================================================

    # Post-night rest: penalise working within post_night_rest_days after a night
    if night_label and rules.enable_post_night_rest:
        for n in nurses:
            for i in range(D):
                for k in range(1, rules.post_night_rest_days + 1):
                    if i + k < D:
                        viol = model.NewBoolVar(f"pnr_{n}_{i}_{k}")
                        model.Add(
                            viol >= x[(n, days[i], night_label)] + wday[(n, i + k)] - 1
                        )
                        terms.append(weights.post_night_rest_penalty * viol)

    # Isolated rest (1-day) penalty
    if rules.enable_isolated_rest_penalty:
        for n in nurses:
            for i in range(1, D - 1):
                iso = model.NewBoolVar(f"iso_{n}_{i}")
                model.Add(iso >= wday[(n, i - 1)] - wday[(n, i)] + wday[(n, i + 1)] - 1)
                terms.append(weights.isolated_rest_penalty * iso)

    # Short rest block (2-day) penalty — push toward ≥3-day blocks
    if rules.enable_isolated_rest_penalty and rules.min_rest_block_size >= 3:
        for n in nurses:
            for i in range(1, D - 2):
                short = model.NewBoolVar(f"short2_{n}_{i}")
                model.Add(
                    short >= wday[(n, i - 1)] - wday[(n, i)] - wday[(n, i + 1)] + wday[(n, i + 2)] - 1
                )
                terms.append(weights.short_rest_block_penalty * short)

    # Rest distribution across month segments
    if rules.enable_rest_distribution:
        T = rules.min_total_days_off
        mb = rules.min_rest_block_size
        max_possible_segs = max(1, T // mb)
        raw_segs = math.ceil(T / mb) if mb > 0 else 2
        num_segs = max(3, min(raw_segs, max_possible_segs, D // (mb + 1)))
        min_per_seg = max(1, T // num_segs)

        seg_bounds = [
            (round(seg * D / num_segs), round((seg + 1) * D / num_segs))
            for seg in range(num_segs)
        ]
        for n in nurses:
            for seg_idx, (s_start, s_end) in enumerate(seg_bounds):
                seg_len = s_end - s_start
                if seg_len == 0:
                    continue
                rest_in_seg = model.NewIntVar(0, seg_len, f"rseg_{n}_{seg_idx}")
                model.Add(
                    rest_in_seg == sum(1 - wday[(n, i)] for i in range(s_start, s_end))
                )
                shortfall = model.NewIntVar(0, min_per_seg, f"rsfall_{n}_{seg_idx}")
                model.Add(shortfall >= min_per_seg - rest_in_seg)
                terms.append(weights.rest_distribution_penalty * shortfall)

    # ============================================================
    # P6 SOFT — Misc / fairness
    # ============================================================

    # Backup nurse avoidance
    for n in backup_nurses:
        for d in days:
            for s in shifts:
                terms.append(weights.backup_nurse_penalty * x[(n, d, s)])

    # Shift-type balance per nurse (morning/evening/night roughly equal)
    if morning_label and evening_label and night_label:
        for n in nurses:
            if n in backup_nurses:
                continue
            mc = model.NewIntVar(0, D, f"mc_{n}")
            ec = model.NewIntVar(0, D, f"ec_{n}")
            nc = model.NewIntVar(0, D, f"nc_{n}")
            model.Add(mc == sum(x[(n, d, morning_label)] for d in days))
            model.Add(ec == sum(x[(n, d, evening_label)] for d in days))
            model.Add(nc == sum(x[(n, d, night_label)] for d in days))
            max_st = model.NewIntVar(0, D, f"max_st_{n}")
            min_st = model.NewIntVar(0, D, f"min_st_{n}")
            model.AddMaxEquality(max_st, [mc, ec, nc])
            model.AddMinEquality(min_st, [mc, ec, nc])
            sb = model.NewIntVar(0, D, f"sb_{n}")
            model.Add(sb == max_st - min_st)
            terms.append(weights.shift_type_balance_penalty * sb)

    # Emergency same-day double-shift penalty
    if emergency_mode:
        for n in nurses:
            for d in days:
                if max_spd >= 2:
                    extra = model.NewIntVar(0, 1, f"extra_sd_{n}_{d}")
                    model.Add(sum(x[(n, d, s)] for s in shifts) - 1 <= extra)
                    terms.append(weights.emergency_same_day_penalty * extra)

    if not terms:
        terms.append(0)
    model.Minimize(sum(terms))

    return {
        "model": model,
        "x": x,
        "wday": wday,
        "total_shifts_var": total_shifts_var,
        "under": under,
        "night_label": night_label,
        "morning_label": morning_label,
        "evening_label": evening_label,
        "nurse_targets": nurse_targets,
        "target_work_days": target_work_days,
    }


# ============================================================
# PACK RESULTS
# ============================================================

def pack_solution(
    req: SolveRequest,
    artifacts: dict,
    solver: cp_model.CpSolver,
    status_label: str,
) -> SolveResponse:
    nurses, days, shifts = req.nurses, req.days, req.shifts
    preferences = req.preferences or {}
    x = artifacts["x"]
    wday = artifacts["wday"]
    under = artifacts["under"]
    night_label = artifacts["night_label"]
    morning_label = artifacts["morning_label"]
    evening_label = artifacts["evening_label"]
    nurse_targets = artifacts["nurse_targets"]
    target_work_days = artifacts["target_work_days"]

    assigned_map: Dict[Tuple[str, str, str], int] = {
        (n, d, s): int(solver.Value(x[(n, d, s)]))
        for n in nurses for d in days for s in shifts
    }

    assignments = [
        Assignment(day=d, shift=s, nurse=n)
        for n in nurses for d in days for s in shifts
        if assigned_map[(n, d, s)] == 1
    ]

    understaffed = []
    if under:
        for d in days:
            for s in shifts:
                miss = int(solver.Value(under[(d, s)]))
                if miss > 0:
                    understaffed.append(UnderstaffItem(day=d, shift=s, missing=miss))

    stats: List[NurseStats] = []
    for n in nurses:
        work_days_count = sum(
            int(solver.Value(wday[(n, i)])) for i in range(len(days))
        )
        total_shifts_count = sum(assigned_map[(n, d, s)] for d in days for s in shifts)
        # OT = shifts beyond contract baseline (regular = target_work_days)
        ot_count = max(0, total_shifts_count - target_work_days)
        m_count = sum(assigned_map[(n, d, morning_label)] for d in days) if morning_label else 0
        e_count = sum(assigned_map[(n, d, evening_label)] for d in days) if evening_label else 0
        nt_count = sum(assigned_map[(n, d, night_label)] for d in days) if night_label else 0
        sat = compute_satisfaction(
            nurse=n, days=days, shifts=shifts, assigned_map=assigned_map,
            preferences=preferences, night_label=night_label, ot_count=ot_count,
        )
        stats.append(NurseStats(
            nurse=n,
            work_days=work_days_count,
            total_shifts=total_shifts_count,
            ot_shifts=ot_count,
            morning_shifts=m_count,
            evening_shifts=e_count,
            night_shifts=nt_count,
            target_total_shifts=nurse_targets[n],
            satisfaction=sat,
        ))

    coverage_missing = sum(u.missing for u in understaffed)
    avg_sat = round(sum(s.satisfaction for s in stats) / len(stats), 2) if stats else 0.0

    return SolveResponse(
        status=status_label,
        objective_value=int(solver.ObjectiveValue()) if status_label != "ERROR" else None,
        assignments=assignments,
        understaffed=understaffed,
        nurse_stats=stats,
        details={
            "target_work_days_per_nurse": target_work_days,
            "nurse_targets": nurse_targets,
            "average_satisfaction": avg_sat,
            "coverage_missing": coverage_missing,
            "best_bound": solver.BestObjectiveBound(),
            "wall_time_sec": solver.WallTime(),
            "conflicts": solver.NumConflicts(),
            "branches": solver.NumBranches(),
        },
    )


# ============================================================
# SOLVE
# ============================================================

def _make_solver(req: SolveRequest) -> cp_model.CpSolver:
    s = cp_model.CpSolver()
    s.parameters.max_time_in_seconds = req.time_limit_sec
    s.parameters.num_search_workers = req.num_search_workers
    if req.random_seed is not None:
        s.parameters.random_seed = req.random_seed
    s.parameters.log_search_progress = req.enable_cp_sat_log
    return s


@app.post("/solve", response_model=SolveResponse)
def solve(req: SolveRequest) -> SolveResponse:
    rules = req.rules or Rules()

    # Phase 1: coverage HARD
    art1 = build_solver_model(req, emergency_mode=False)
    sv1 = _make_solver(req)
    r1 = sv1.Solve(art1["model"])
    if r1 in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        res = pack_solution(req, art1, sv1, "OPTIMAL" if r1 == cp_model.OPTIMAL else "FEASIBLE")
        if not rules.guarantee_full_coverage or sum(u.missing for u in res.understaffed) == 0:
            return res

    # Phase 2: coverage SOFT (emergency)
    if rules.allow_emergency_overrides:
        art2 = build_solver_model(req, emergency_mode=True)
        sv2 = _make_solver(req)
        r2 = sv2.Solve(art2["model"])
        if r2 in (cp_model.OPTIMAL, cp_model.FEASIBLE):
            label = "EMERGENCY_OPTIMAL" if r2 == cp_model.OPTIMAL else "EMERGENCY_FEASIBLE"
            return pack_solution(req, art2, sv2, label)

    return SolveResponse(
        status="INFEASIBLE",
        details={
            "message": "No feasible schedule. Check min_total_days_off vs demand vs num_nurses.",
            "nurses": len(req.nurses),
            "days": len(req.days),
            "total_demand": sum(req.demand[d][s] for d in req.days for s in req.shifts),
        },
    )


@app.get("/health")
def health() -> Dict[str, str]:
    return {"status": "ok", "version": "5.0.0"}


# ============================================================
# CLI
# ============================================================

if __name__ == "__main__":
    import sys, json, argparse, traceback

    parser = argparse.ArgumentParser(description="Nurse Scheduler v3 — Fairness-First")
    parser.add_argument("--cli", action="store_true")
    parser.add_argument("--input", type=str, default=None)
    parser.add_argument("--output", type=str, default=None)
    args = parser.parse_args()

    if not args.cli:
        print("Run as server: uvicorn solver_cli_v3:app --reload --port 8001", file=sys.stderr)
        sys.exit(0)

    try:
        raw = open(args.input, encoding="utf-8").read() if args.input else sys.stdin.read()
        req = SolveRequest(**json.loads(raw))
        res = solve(req)
        out = json.dumps(res.model_dump(), ensure_ascii=False)
        if args.output:
            open(args.output, "w", encoding="utf-8").write(out)
        else:
            sys.stdout.write(out)
        sys.exit(0)
    except Exception as e:
        err = json.dumps({
            "status": "ERROR",
            "details": {"error": str(e), "trace": traceback.format_exc()},
        }, ensure_ascii=False)
        (open(args.output, "w", encoding="utf-8") if args.output else sys.stdout).write(err)
        sys.exit(1)
