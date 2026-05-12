"""
convert_and_compare.py
----------------------
1. Reads "browser claude result.json" (extracted from Excel by Claude browser)
2. Converts each month → solver input JSON
3. Runs the solver (solver_cli.py)
4. Compares solver output vs human schedule

Run from this directory:
    python convert_and_compare.py

Requires solver_cli.py to be accessible via SOLVER_CLI_PATH env var
or relative path ../../src/core/solver/solver_cli.py
"""

import json
import subprocess
import sys
import os
from pathlib import Path
from collections import defaultdict

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
HERE = Path(__file__).parent
BROWSER_RESULT = HERE / "browser claude result.json"
SOLVER_CLI = HERE / "../../src/core/solver/solver_cli.py"

# Nurses who are restricted to morning only (morning-only role)
# Detected from human schedule: 18M / 0E / 0N
MORNING_ONLY_NURSES = {"นางสาวกรรณิการ์ เรือนงาม"}

SHIFTS = ["morning", "evening", "night"]


# ---------------------------------------------------------------------------
# Conversion
# ---------------------------------------------------------------------------
def build_solver_input(month_data: dict) -> dict:
    nurses = month_data["nurses"]
    all_days = month_data["days"]
    assignments = month_data["assignments"]
    demand_raw = month_data["demand"]
    preferences_list = month_data.get("preferences", [])

    # --- demand: use all days (0-demand days = no one assigned = natural day off) ---
    demand = {d: demand_raw.get(d, {"morning": 0, "evening": 0, "night": 0}) for d in all_days}

    # Active days = days where at least one shift has demand > 0
    active_days = [
        d for d in all_days
        if any(demand[d].get(s, 0) > 0 for s in SHIFTS)
    ]
    num_active = len(active_days)
    total_days = len(all_days)

    # --- availability ---
    # Build lookup: (nurse, date) -> shift
    assign_map = {}
    for a in assignments:
        assign_map[(a["nurse"], a["date"])] = a["shift"]

    availability = {}
    for nurse in nurses:
        availability[nurse] = {}
        for date in all_days:
            shift_assigned = assign_map.get((nurse, date))

            if date not in active_days:
                # Days 1-10 in Jan: 0-demand, everyone off — no availability entry needed
                continue

            availability[nurse][date] = {}

            if shift_assigned is None:
                # Explicit day off on active day → block all shifts
                for s in SHIFTS:
                    availability[nurse][date][s] = 0
            else:
                # Has a shift → mark all shifts available (solver decides)
                for s in SHIFTS:
                    availability[nurse][date][s] = 1

        # Morning-only nurses: block evening + night on all active days
        if nurse in MORNING_ONLY_NURSES:
            for date in active_days:
                availability[nurse].setdefault(date, {})
                availability[nurse][date]["evening"] = 0
                availability[nurse][date]["night"] = 0

    # --- preferences: requested=true → soft preference penalty ---
    # Format: { nurse: { date: { shift: penalty_weight } } }
    preferences = {}
    for p in preferences_list:
        nurse = p["nurse"]
        date = p["date"]
        shift = p["shift"]
        if date not in active_days:
            continue
        preferences.setdefault(nurse, {}).setdefault(date, {})[shift] = 10

    # --- min_total_days_off ---
    # 21 shifts per month target. Days off = total_days - 21.
    min_days_off = max(0, total_days - 21)

    solver_input = {
        "nurses": nurses,
        "days": all_days,
        "shifts": SHIFTS,
        "demand": demand,
        "availability": availability,
        "time_limit_sec": 60,
        "num_search_workers": 4,
        "random_seed": 42,
        "rules": {
            "guarantee_full_coverage": True,
            "allow_emergency_overrides": True,
            "max_shifts_per_day": 1,
            "min_days_off_per_week": 0,
            "max_nights_per_week": 3,
            "forbid_night_to_morning": True,
            "forbid_evening_to_night": False,
            "enable_min_total_days_off": min_days_off > 0,
            "min_total_days_off": min_days_off,
            "enable_shift_type_limit": False,
            "enable_consecutive_night_limit": True,
            "max_consecutive_night_shifts": 3,
            "allow_second_shift_same_day_in_emergency": True,
            "allow_night_cap_override_in_emergency": True,
            "allow_rest_rule_override_in_emergency": True,
            "goal_minimize_staff_cost": True,
            "goal_maximize_preference_satisfaction": bool(preferences),
            "goal_balance_workload": True,
            "goal_balance_night_workload": True,
            "goal_reduce_undesirable_shifts": False,
        },
        "weights": {
            "understaff_penalty": 10000,
            "overtime_penalty": 50,
            "preference_penalty_multiplier": 1,
            "workload_balance_weight": 100,
            "overtime_balance_penalty": 500,
        },
    }

    if preferences:
        solver_input["preferences"] = preferences

    return solver_input


# ---------------------------------------------------------------------------
# Constraint violation checker (mirrors solver rules)
# ---------------------------------------------------------------------------
def check_violations(assignments: list, nurses: list) -> list:
    violations = []

    # Build per-nurse sorted assignments
    by_nurse = defaultdict(list)
    for a in assignments:
        if a.get("shift"):
            by_nurse[a["nurse"]].append(a)
    for nurse in by_nurse:
        by_nurse[nurse].sort(key=lambda x: x["date"])

    for nurse, assigns in by_nurse.items():
        shifts_seq = [(a["date"], a["shift"]) for a in assigns]

        for i in range(len(shifts_seq) - 1):
            d1, s1 = shifts_seq[i]
            d2, s2 = shifts_seq[i + 1]
            # night → morning next day (consecutive dates only)
            from datetime import date as dt, timedelta
            date1 = dt.fromisoformat(d1)
            date2 = dt.fromisoformat(d2)
            if (date2 - date1).days == 1 and s1 == "night" and s2 == "morning":
                violations.append({
                    "type": "night_to_morning",
                    "nurse": nurse,
                    "dates": [d1, d2],
                })

        # Consecutive nights
        night_run = []
        for date, shift in shifts_seq:
            if shift == "night":
                night_run.append(date)
            else:
                if len(night_run) > 3:
                    violations.append({
                        "type": "consecutive_nights_exceeded",
                        "nurse": nurse,
                        "count": len(night_run),
                        "dates": [night_run[0], night_run[-1]],
                    })
                night_run = []
        if len(night_run) > 3:
            violations.append({
                "type": "consecutive_nights_exceeded",
                "nurse": nurse,
                "count": len(night_run),
                "dates": [night_run[0], night_run[-1]],
            })

        # 3 consecutive mornings then afternoon
        for i in range(len(shifts_seq) - 3):
            s = [shifts_seq[i + k][1] for k in range(4)]
            if s == ["morning", "morning", "morning", "evening"]:
                violations.append({
                    "type": "3morning_then_evening",
                    "nurse": nurse,
                    "dates": [shifts_seq[i + k][0] for k in range(4)],
                })

        # Shift count > 21
        total = len(assigns)
        if total > 21:
            violations.append({
                "type": "over_21_shifts",
                "nurse": nurse,
                "count": total,
            })

    return violations


# ---------------------------------------------------------------------------
# Run solver
# ---------------------------------------------------------------------------
def run_solver(solver_input: dict, out_path: Path) -> dict | None:
    import tempfile, os

    python_cmd = os.environ.get("SOLVER_PYTHON", "python")
    cli_path = os.environ.get("SOLVER_CLI_PATH", str(SOLVER_CLI.resolve()))

    with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False, encoding="utf-8") as f:
        json.dump(solver_input, f, ensure_ascii=False)
        in_tmp = f.name

    try:
        result = subprocess.run(
            [python_cmd, cli_path, "--cli", "--input", in_tmp, "--output", str(out_path)],
            capture_output=True,
            text=True,
            timeout=120,
        )
        if out_path.exists():
            with open(out_path, encoding="utf-8") as f:
                return json.load(f)
        else:
            print(f"  [ERROR] Solver produced no output. stderr:\n{result.stderr[:2000]}")
            return None
    except subprocess.TimeoutExpired:
        print("  [ERROR] Solver timed out")
        return None
    finally:
        Path(in_tmp).unlink(missing_ok=True)


# ---------------------------------------------------------------------------
# Comparison report
# ---------------------------------------------------------------------------
def compare(month_key: str, month_data: dict, solver_result: dict | None):
    human_assignments = [a for a in month_data["assignments"] if a.get("shift")]
    human_violations = check_violations(month_data["assignments"], month_data["nurses"])

    print(f"\n{'='*60}")
    print(f"  {month_key.upper()}  —  Ward: {month_data['ward']}")
    print(f"{'='*60}")

    # Human schedule stats
    human_shift_counts = defaultdict(int)
    human_nurse_shifts = defaultdict(int)
    for a in human_assignments:
        human_shift_counts[a["shift"]] += 1
        human_nurse_shifts[a["nurse"]] += 1

    print(f"\n[HUMAN SCHEDULE]")
    print(f"  Total shifts assigned : {len(human_assignments)}")
    print(f"  Morning / Evening / Night : "
          f"{human_shift_counts['morning']} / {human_shift_counts['evening']} / {human_shift_counts['night']}")
    print(f"  OT shifts             : {len(month_data.get('overtime_shifts', []))}")
    print(f"  Preferences honored   : {month_data['summary']['total_requested_honored']}")
    print(f"  Constraint violations : {len(human_violations)}")
    for v in human_violations:
        print(f"    - {v['type']} | {v['nurse'].split()[-1]} | {v.get('dates', v.get('count'))}")

    per_nurse = month_data["summary"]["per_nurse"]
    print(f"\n  Per-nurse shifts:")
    for nurse, stats in per_nurse.items():
        total = stats["morning"] + stats["evening"] + stats["night"]
        print(f"    {nurse.split()[-1]:20s}  M:{stats['morning']:2d} E:{stats['evening']:2d} N:{stats['night']:2d}  total:{total:2d}")

    if not solver_result:
        print(f"\n[SOLVER] — no result (solver failed or not run)")
        return

    solver_assignments = solver_result.get("assignments", [])
    solver_violations = check_violations(
        [{"nurse": a["nurse"], "date": a["day"], "shift": a["shift"]} for a in solver_assignments],
        month_data["nurses"],
    )

    solver_shift_counts = defaultdict(int)
    solver_nurse_shifts = defaultdict(int)
    solver_ot_count = 0
    for a in solver_assignments:
        solver_shift_counts[a["shift"]] += 1
        solver_nurse_shifts[a["nurse"]] += 1
        if a.get("emergency_override"):
            solver_ot_count += 1

    # Preference satisfaction
    preferences_list = month_data.get("preferences", [])
    pref_satisfied = 0
    for p in preferences_list:
        for a in solver_assignments:
            if a["nurse"] == p["nurse"] and a["day"] == p["date"] and a["shift"] == p["shift"]:
                pref_satisfied += 1
                break

    print(f"\n[SOLVER SCHEDULE]  status: {solver_result.get('status', '?')}")
    print(f"  Total shifts assigned : {len(solver_assignments)}")
    print(f"  Morning / Evening / Night : "
          f"{solver_shift_counts['morning']} / {solver_shift_counts['evening']} / {solver_shift_counts['night']}")
    print(f"  Emergency overrides   : {solver_ot_count}")
    print(f"  Preferences satisfied : {pref_satisfied} / {len(preferences_list)}")
    print(f"  Constraint violations : {len(solver_violations)}")
    for v in solver_violations:
        print(f"    - {v['type']} | {v['nurse'].split()[-1]} | {v.get('dates', v.get('count'))}")

    ns = solver_result.get("nurse_stats", [])
    if ns:
        print(f"\n  Per-nurse shifts (solver):")
        for stat in ns:
            print(f"    {stat['nurse'].split()[-1]:20s}  total:{stat['assigned_shifts']:2d}  OT:{stat['overtime']:2d}")

    # Delta
    print(f"\n[DELTA]  human vs solver")
    print(f"  Violations: {len(human_violations)} → {len(solver_violations)}  "
          f"({'better' if len(solver_violations) < len(human_violations) else 'worse' if len(solver_violations) > len(human_violations) else 'same'})")
    understaffed = solver_result.get("understaffed", [])
    print(f"  Understaffed slots (solver): {len(understaffed)}")
    for u in understaffed[:5]:
        print(f"    {u['day']} {u['shift']}: missing {u['missing']}")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main():
    if not BROWSER_RESULT.exists():
        print(f"ERROR: {BROWSER_RESULT} not found")
        sys.exit(1)

    with open(BROWSER_RESULT, encoding="utf-8") as f:
        data = json.load(f)

    for month_key in ["january", "february"]:
        if month_key not in data:
            print(f"Skipping {month_key} — not in JSON")
            continue

        month_data = data[month_key]
        print(f"\nConverting {month_key}...")

        solver_input = build_solver_input(month_data)

        # Save solver input
        input_path = HERE / f"solver_input_{month_key}.json"
        with open(input_path, "w", encoding="utf-8") as f:
            json.dump(solver_input, f, ensure_ascii=False, indent=2)
        print(f"  Solver input → {input_path.name}")
        print(f"  Nurses: {len(solver_input['nurses'])}  |  Days: {len(solver_input['days'])}  |  Active: {sum(1 for d in solver_input['days'] if any(solver_input['demand'][d].get(s,0)>0 for s in SHIFTS))}")

        # Run solver
        output_path = HERE / f"solver_output_{month_key}.json"
        print(f"  Running solver...")
        solver_result = run_solver(solver_input, output_path)

        if solver_result:
            with open(output_path, "w", encoding="utf-8") as f:
                json.dump(solver_result, f, ensure_ascii=False, indent=2)
            print(f"  Solver output → {output_path.name}  status: {solver_result.get('status')}")

        compare(month_key, month_data, solver_result)

    print("\nDone.")


if __name__ == "__main__":
    main()
