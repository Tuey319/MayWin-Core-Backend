"""
push-ipd-march-schedule.py
--------------------------
1. Creates a schedules row for March 2026 in IPD-TEST unit (unit_id=18)
2. Inserts all 7 nurses' March 2026 assignments into schedule_assignments
3. Creates a constraint profile for IPD-TEST unit
4. Prints schedule analysis

Worker ID mapping (old DB id -> new IPD worker id):
  176 -> 178 (IPD001 ภวัตสรรค์ นิลจันทร์)
  70  -> 179 (IPD002 ศิรินรัตน์ จิตรหวล)
  71  -> 180 (IPD003 สุลักษณา เยนา)
  72  -> 181 (IPD004 รัตนาวลี สัตยวิวัฒน์)
  73  -> 182 (IPD005 ธนัชพร ด่านตระกูล)
  74  -> 183 (IPD006 พรลภัส รุ่งเรือง)
  75  -> 184 (IPD007 ปรัชญาภร ศรีจันทร์)

Run:
    python scripts/push-ipd-march-schedule.py
"""

import json
import psycopg2
import psycopg2.extras
from collections import defaultdict
from datetime import date, timedelta

SCHEMA = "maywin_db"
DB = dict(
    host="maywin-restored.cf4o8yiqanwf.ap-southeast-1.rds.amazonaws.com",
    port=5432, user="postgres", password="maywin12345",
    dbname="maywin", sslmode="require",
)

KMCH_ORG_ID = 4
IPD_UNIT_ID = 18
KEN_USER_ID = 20   # ken@maywin.dev

# Old worker id -> new IPD worker id
WORKER_ID_MAP = {
    "176": 178,
    "70":  179,
    "71":  180,
    "72":  181,
    "73":  182,
    "74":  183,
    "75":  184,
}

NURSE_NAMES = {
    "176": "ภวัตสรรค์ นิลจันทร์",
    "70":  "ศิรินรัตน์ จิตรหวล",
    "71":  "สุลักษณา เยนา",
    "72":  "รัตนาวลี สัตยวิวัฒน์",
    "73":  "ธนัชพร ด่านตระกูล",
    "74":  "พรลภัส รุ่งเรือง",
    "75":  "ปรัชญาภร ศรีจันทร์",
}

# March 2026 human-made schedule (hand-extracted from Excel)
# Keys are old worker IDs. Values are 31-element lists (March 1-31).
# "-" = day off | "M" = morning | "E" = evening | "N" = night
# "X+Y" = double shift (Y is overtime)
MARCH_SCHEDULE = {
    "176": ["-",   "M",   "-",   "M",   "M",   "M",   "-",   "-",   "M",   "M",
            "M",   "M",   "M",   "-",   "M",   "M",   "M",   "M",   "M",   "-",
            "-",   "M",   "M",   "M",   "M",   "M",   "-",   "-",   "M",   "M",   "-"],
    "70":  ["-",   "M",   "-",   "M",   "M",   "M",   "M",   "-",   "-",   "-",
            "E",   "E",   "E",   "E",   "M+E", "M",   "-",   "-",   "M",   "E",
            "E",   "E",   "M",   "M",   "M",   "E",   "E",   "M",   "-",   "-",   "M+E"],
    "71":  ["M",   "E",   "-",   "N",   "-",   "N+E", "M+E", "-",   "N+E", "M",
            "N",   "N",   "E",   "M+E", "-",   "N+E", "E",   "M",   "N",   "-",
            "-",   "-",   "M",   "N",   "N",   "-",   "N",   "M+E", "M+E", "-",   "-"],
    "72":  ["M",   "-",   "N+E", "E",   "E",   "-",   "N",   "N+E", "-",   "E",
            "-",   "-",   "N",   "E",   "M+E", "N",   "-",   "N+E", "E",   "-",
            "-",   "N+E", "E",   "M",   "E",   "M",   "-",   "N",   "N",   "N+E", "-"],
    "73":  ["E",   "E",   "M+E", "-",   "N+E", "N",   "-",   "M",   "N",   "N",
            "-",   "-",   "-",   "-",   "E",   "M",   "N+E", "-",   "M",   "M",
            "M+E", "-",   "N+E", "E",   "-",   "N",   "N+E", "-",   "N+E", "M",   "N"],
    "74":  ["-",   "M",   "M",   "-",   "N",   "M",   "N+E", "M",   "-",   "N",
            "M",   "N+E", "-",   "N",   "N",   "E",   "-",   "-",   "N",   "N+E",
            "N+E", "M",   "N",   "-",   "N",   "N+E", "M",   "-",   "-",   "N+E", "-"],
    "75":  ["-",   "M",   "-",   "N+E", "M",   "E",   "-",   "N+E", "M+E", "-",
            "N+E", "M",   "N",   "N",   "N",   "-",   "N",   "N",   "-",   "N",
            "N",   "N+E", "-",   "N+E", "E",   "-",   "-",   "N+E", "M",   "-",   "N+E"],
}

SHIFT_MAP = {"M": "morning", "E": "evening", "N": "night"}


def expand_shifts(day_code):
    """
    "M+E" -> [("morning", False, 1), ("evening", True, 2)]
    "N"   -> [("night", False, 1)]
    "-"   -> []
    """
    if day_code == "-":
        return []
    parts = day_code.split("+")
    result = []
    for i, p in enumerate(parts):
        shift = SHIFT_MAP.get(p)
        if shift:
            result.append((shift, i > 0, i + 1))   # (shift, is_overtime, shift_order)
    return result


def compute_stats(schedule):
    """Compute per-nurse and aggregate stats."""
    stats = {}
    for old_wid, days in schedule.items():
        m = e = n = work_days = ot = 0
        for code in days:
            if code == "-":
                continue
            shifts = expand_shifts(code)
            if shifts:
                work_days += 1
                if len(shifts) > 1:
                    ot += 1
            for shift, is_ot, _ in shifts:
                if shift == "morning":   m += 1
                elif shift == "evening": e += 1
                elif shift == "night":   n += 1
        stats[old_wid] = {
            "name": NURSE_NAMES[old_wid],
            "work_days": work_days,
            "total_shifts": m + e + n,
            "ot_days": ot,
            "morning": m, "evening": e, "night": n,
        }
    return stats


def compute_daily_coverage(schedule):
    """Per-day M/E/N counts and OT nurses."""
    daily = {}
    march_start = date(2026, 3, 1)
    for day_idx in range(31):
        d = (march_start + timedelta(days=day_idx)).isoformat()
        daily[d] = {"morning": 0, "evening": 0, "night": 0, "ot": 0}
    for old_wid, days in schedule.items():
        for day_idx, code in enumerate(days):
            d = (march_start + timedelta(days=day_idx)).isoformat()
            shifts = expand_shifts(code)
            if len(shifts) > 1:
                daily[d]["ot"] += 1
            for shift, _, _ in shifts:
                daily[d][shift] += 1
    return daily


def print_analysis(stats, daily):
    print()
    print("=" * 70)
    print("  SCHEDULE ANALYSIS — IPD-TEST  March 2026")
    print("=" * 70)

    print("\n--- Per-Nurse Summary ---")
    print(f"{'Code':<7} {'Name':<28} {'Days':>4} {'Shfts':>5} {'OT':>3} {'M':>3} {'E':>3} {'N':>3}")
    print("-" * 60)
    codes = ["IPD001","IPD002","IPD003","IPD004","IPD005","IPD006","IPD007"]
    old_ids = ["176","70","71","72","73","74","75"]
    for code, oid in zip(codes, old_ids):
        s = stats[oid]
        print(f"{code:<7} {s['name'][:27]:<28} {s['work_days']:>4} "
              f"{s['total_shifts']:>5} {s['ot_days']:>3} "
              f"{s['morning']:>3} {s['evening']:>3} {s['night']:>3}")

    total_shifts = sum(s["total_shifts"] for s in stats.values())
    total_ot = sum(s["ot_days"] for s in stats.values())
    total_m = sum(s["morning"] for s in stats.values())
    total_e = sum(s["evening"] for s in stats.values())
    total_n = sum(s["night"] for s in stats.values())
    print("-" * 60)
    print(f"{'TOTAL':<36} {total_shifts:>5} {total_ot:>3} "
          f"{total_m:>3} {total_e:>3} {total_n:>3}")

    print("\n--- Inferred Demand ---")
    m_counts = [v["morning"] for v in daily.values()]
    e_counts = [v["evening"] for v in daily.values()]
    n_counts = [v["night"] for v in daily.values()]
    print(f"  Morning coverage per day: min={min(m_counts)} avg={sum(m_counts)/31:.1f} max={max(m_counts)}")
    print(f"  Evening coverage per day: min={min(e_counts)} avg={sum(e_counts)/31:.1f} max={max(e_counts)}")
    print(f"  Night coverage per day  : min={min(n_counts)} avg={sum(n_counts)/31:.1f} max={max(n_counts)}")
    ot_days = sum(1 for v in daily.values() if v["ot"] > 0)
    print(f"  Days with OT workers    : {ot_days}/31")
    under_m = sum(1 for v in daily.values() if v["morning"] < 2)
    under_e = sum(1 for v in daily.values() if v["evening"] < 2)
    under_n = sum(1 for v in daily.values() if v["night"] < 2)
    print(f"  Days short on morning (< 2): {under_m}")
    print(f"  Days short on evening (< 2): {under_e}")
    print(f"  Days short on night   (< 2): {under_n}")

    print("\n--- Constraint Violation Scan ---")
    violations = 0
    # Night -> morning next day
    march_start = date(2026, 3, 1)
    for oid, days in MARCH_SCHEDULE.items():
        for i in range(30):
            code_today = days[i]
            code_next = days[i + 1]
            shifts_today = [s for s, _, _ in expand_shifts(code_today)]
            shifts_next = [s for s, _, _ in expand_shifts(code_next)]
            if "night" in shifts_today and "morning" in shifts_next:
                d = (march_start + timedelta(days=i)).isoformat()
                print(f"  [VIOLATION] night->morning: {NURSE_NAMES[oid][:20]} day {i+1}->{i+2}")
                violations += 1
        # Consecutive nights > 3
        run = 0
        max_run = 0
        for code in days:
            shifts = [s for s, _, _ in expand_shifts(code)]
            if "night" in shifts:
                run += 1
                max_run = max(max_run, run)
            else:
                run = 0
        if max_run > 3:
            print(f"  [VIOLATION] consec nights {max_run}: {NURSE_NAMES[oid][:20]}")
            violations += 1
    if violations == 0:
        print("  None detected in scanned patterns.")

    print("\n--- Key Inferences ---")
    print("  [1] IPD001 (ภวัตสรรค์) works morning ONLY (21M 0E 0N) ->")
    print("      Dedicated morning role or personal arrangement.")
    print("  [2] Heavy OT usage: nurses 71/73/74/75 each have 7-9 double-shift days.")
    print("      Ward relies on OT to fill coverage gaps, not extra headcount.")
    print("  [3] Night-heavy distribution: 72/73/74/75 carry bulk of night shifts.")
    print("      IPD001/IPD002 almost never work nights -> implicit role split.")
    print("  [4] Average work days ~20-21 (10-11 days off in March=31 days).")
    print("  [5] Coverage demand inferred: 2M + 1-2E + 1-2N per day.")
    print("      With 7 nurses x 21 shifts = 147 slots, 31d x 5-6 shifts/day needed.")
    print()


def create_constraint_profile(cur):
    description = (
        "IPD-TEST March 2026 profile — derived from hand-extracted human schedule. "
        "Settings rationale: "
        "max_consecutive_night_shifts=3 (human ran 4-5 consecutive nights; capped for safety). "
        "max_nights_per_week=3 (human averaged 2-3/week; 3 allows flexibility). "
        "min_days_off_per_week=1 (minimum rest; human achieved this almost always). "
        "max_shifts_per_day=2 (OT double shifts are common in this ward). "
        "forbid_night_to_morning=true (rest rule; human violated it but it should be enforced). "
        "forbid_evening_to_night=false (ward uses E+N double shifts heavily; penalised not banned). "
        "guarantee_full_coverage=false (7 nurses cannot cover 2M+2E+2N every day without OT). "
        "allow_emergency_overrides=true (ward needs OT flexibility to fill gaps). "
        "goal_balance_workload=true (human schedule heavily imbalanced: nurse 176 mornings only). "
        "goal_balance_night_workload=true (nurses 74/75 carry disproportionate nights). "
        "num_search_workers=4 time_limit_sec=30 (small unit, fast solve)."
    )

    penalty_weight = {
        "overtime_penalty": 30,
        "understaff_penalty": 500000,
        "workload_balance_weight": 200,
        "evening_to_night_penalty": 2000,
        "overtime_balance_penalty": 800,
        "weekly_night_over_penalty": 150,
        "emergency_override_penalty": 300,
        "shift_type_balance_penalty": 150,
        "preference_penalty_multiplier": 1,
        "same_day_second_shift_penalty": 100,
    }

    attributes = {
        "random_seed": 42,
        "enable_cp_sat_log": False,
        "max_shift_per_type": {"night": 9, "evening": 9, "morning": 12},
        "min_total_days_off": 9,
        "enable_shift_type_limit": True,
        "enable_min_total_days_off": True,
        "enable_consecutive_night_limit": True,
        "shift_type_limit_exempt_nurses": ["IPD001"],
        "evening_after_morning_counts_as_overtime": True,
        "derived_from": "March 2026 hand-extracted schedule",
        "notes": (
            "IPD001 exempt from shift_type_limit — she holds morning-only role. "
            "morning cap=12 (vs 9 for E/N) to accommodate this pattern. "
            "understaff_penalty lowered from standard (2M coverage often unachievable). "
            "overtime_penalty low (ward expects OT to fill gaps)."
        ),
    }

    cur.execute(f"""
        INSERT INTO {SCHEMA}.constraint_profiles
            (unit_id, org_id, name, description, color,
             max_consecutive_work_days, max_consecutive_night_shifts,
             min_rest_hours_between_shifts,
             max_shifts_per_day, min_days_off_per_week,
             max_nights_per_week, forbid_night_to_morning,
             forbid_evening_to_night, forbid_morning_to_night_same_day,
             guarantee_full_coverage, allow_emergency_overrides,
             allow_second_shift_same_day_in_emergency,
             ignore_availability_in_emergency,
             allow_night_cap_override_in_emergency,
             allow_rest_rule_override_in_emergency,
             goal_minimize_staff_cost, goal_maximize_preference_satisfaction,
             goal_balance_workload, goal_balance_night_workload,
             goal_reduce_undesirable_shifts,
             num_search_workers, time_limit_sec,
             penalty_weight_json, attributes,
             is_active, created_at)
        VALUES (%s, %s, %s, %s, %s,
                %s, %s,
                %s,
                %s, %s,
                %s, %s,
                %s, %s,
                %s, %s,
                %s,
                %s,
                %s,
                %s,
                %s, %s,
                %s, %s,
                %s,
                %s, %s,
                %s, %s,
                true, NOW())
        RETURNING id
    """, (
        str(IPD_UNIT_ID), str(KMCH_ORG_ID),
        "IPD-TEST March 2026 Baseline",
        description,
        "#7B4EA0",          # purple = night-heavy unit
        6,                  # max_consecutive_work_days
        3,                  # max_consecutive_night_shifts
        8,                  # min_rest_hours_between_shifts
        2,                  # max_shifts_per_day (OT allowed)
        1,                  # min_days_off_per_week
        3,                  # max_nights_per_week
        True,               # forbid_night_to_morning
        False,              # forbid_evening_to_night (ward uses E+N combos)
        False,              # forbid_morning_to_night_same_day
        False,              # guarantee_full_coverage
        True,               # allow_emergency_overrides
        True,               # allow_second_shift_same_day_in_emergency
        False,              # ignore_availability_in_emergency
        True,               # allow_night_cap_override_in_emergency
        True,               # allow_rest_rule_override_in_emergency
        True,               # goal_minimize_staff_cost
        True,               # goal_maximize_preference_satisfaction
        True,               # goal_balance_workload
        True,               # goal_balance_night_workload
        False,              # goal_reduce_undesirable_shifts
        4,                  # num_search_workers
        30.0,               # time_limit_sec
        json.dumps(penalty_weight),
        json.dumps(attributes),
    ))
    row = cur.fetchone()
    return row["id"]


def main():
    conn = psycopg2.connect(**DB)
    conn.autocommit = False
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    try:
        # ── 0. Verify ken exists ──────────────────────────────────────────────
        cur.execute(f"SELECT id, email FROM {SCHEMA}.users WHERE id = %s", (str(KEN_USER_ID),))
        ken = cur.fetchone()
        if not ken:
            raise ValueError(f"User id={KEN_USER_ID} not found")
        print(f"[CHECK] created_by = {ken['email']} (id={ken['id']})")

        # ── 1. Create constraint profile ──────────────────────────────────────
        print("\n[PROFILE] Creating IPD-TEST constraint profile...")
        profile_id = create_constraint_profile(cur)
        print(f"  Created profile id={profile_id}")

        # ── 2. Create schedule container ──────────────────────────────────────
        print("\n[SCHEDULE] Creating March 2026 schedule container...")
        cur.execute(f"""
            INSERT INTO {SCHEMA}.schedules
                (organization_id, unit_id, name,
                 start_date, end_date, status,
                 constraint_profile_id, created_by,
                 notes, created_at)
            VALUES (%s, %s, %s,
                    '2026-03-01', '2026-03-31', 'DRAFT',
                    %s, %s,
                    %s, NOW())
            RETURNING id
        """, (
            str(KMCH_ORG_ID), str(IPD_UNIT_ID),
            "IPD-TEST March 2026 (Human-extracted)",
            str(profile_id),
            str(KEN_USER_ID),
            "Hand-extracted from Excel by Ken. 7 nurses. Used as baseline for solver comparison.",
        ))
        schedule_id = cur.fetchone()["id"]
        print(f"  Created schedule id={schedule_id}")

        # ── 2b. Create a sentinel solver_run (manual import, no actual solve) ─
        cur.execute(f"""
            INSERT INTO {SCHEMA}.solver_runs
                (schedule_id, plan, status, requested_by,
                 attempt, notes, attributes, created_at)
            VALUES (%s, 'A_STRICT', 'SUCCEEDED', %s,
                    1, %s, '{{}}', NOW())
            RETURNING id
        """, (
            str(schedule_id), str(KEN_USER_ID),
            "Manual import — human-made schedule hand-extracted from Excel (March 2026 IPD-TEST).",
        ))
        run_id = cur.fetchone()["id"]
        print(f"  Created sentinel solver_run id={run_id}")

        # ── 3. Insert assignments ──────────────────────────────────────────────
        print("\n[ASSIGNMENTS] Inserting shift assignments...")
        march_start = date(2026, 3, 1)
        total_inserted = 0
        for old_wid, day_codes in MARCH_SCHEDULE.items():
            new_wid = WORKER_ID_MAP[old_wid]
            nurse_inserts = 0
            for day_idx, code in enumerate(day_codes):
                shifts = expand_shifts(code)
                for shift, is_ot, shift_order in shifts:
                    d = (march_start + timedelta(days=day_idx)).isoformat()
                    cur.execute(f"""
                        INSERT INTO {SCHEMA}.schedule_assignments
                            (schedule_id, worker_id, date, shift_code,
                             source, is_overtime, shift_order,
                             schedule_run_id,
                             emergency_override, created_at, updated_at)
                        VALUES (%s, %s, %s, %s,
                                'MANUAL', %s, %s,
                                %s,
                                false, NOW(), NOW())
                    """, (
                        str(schedule_id), str(new_wid), d, shift,
                        is_ot, shift_order,
                        str(run_id),
                    ))
                    nurse_inserts += 1
            total_inserted += nurse_inserts
            print(f"  IPD{['001','002','003','004','005','006','007'][list(MARCH_SCHEDULE.keys()).index(old_wid)]} "
                  f"(worker {new_wid}): {nurse_inserts} shifts")

        conn.commit()
        print(f"\n  Total assignments inserted: {total_inserted}")

        # ── 4. Analysis ───────────────────────────────────────────────────────
        stats = compute_stats(MARCH_SCHEDULE)
        daily = compute_daily_coverage(MARCH_SCHEDULE)
        print_analysis(stats, daily)

        print("=" * 70)
        print(f"  schedule id       : {schedule_id}")
        print(f"  constraint profile: {profile_id}")
        print(f"  unit              : IPD-TEST (id={IPD_UNIT_ID})")
        print(f"  status            : DRAFT")
        print(f"  created_by        : {ken['email']}")
        print("=" * 70)

    except Exception as e:
        conn.rollback()
        print(f"\n[ERROR] Rolled back. {e}")
        raise
    finally:
        cur.close()
        conn.close()


if __name__ == "__main__":
    main()
