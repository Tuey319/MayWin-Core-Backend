# src/aws/solver_lambda/app.py
import json
import os
import time
import subprocess
import hashlib
import boto3

s3 = boto3.client("s3")

ARTIFACTS_BUCKET = os.environ["MAYWIN_ARTIFACTS_BUCKET"]
ARTIFACTS_PREFIX = (os.environ.get("MAYWIN_ARTIFACTS_PREFIX") or "").strip("/")


def _key(*parts):
    base = f"{ARTIFACTS_PREFIX}/" if ARTIFACTS_PREFIX else ""
    clean = [str(p).strip("/") for p in parts]
    return base + "/".join(clean)


def _read_json_text(bucket, key) -> str:
    obj = s3.get_object(Bucket=bucket, Key=key)
    return obj["Body"].read().decode("utf-8")


def _write_json(bucket, key, text: str):
    data = text.encode("utf-8")
    s3.put_object(
        Bucket=bucket,
        Key=key,
        Body=data,
        ContentType="application/json",
    )
    return len(data), hashlib.sha256(data).hexdigest()


def _normalize_availability(src, nurse_codes, day_dates, shift_codes):
    """
    Convert availability into Dict[nurse][day][shift] = 0/1

    Acceptable inputs:
      1) dict already in correct shape
      2) list like:
         [
           {"nurseCode":"W001","windows":[{"date":"2026-01-01","shiftCode":"DAY","allowed":true}, ...]},
           ...
         ]
    """
    if src is None:
        # None means "all available" in solver_cli.py
        return None

    # Case 1: already a dict (assume correct shape)
    if isinstance(src, dict):
        # Ensure ints 0/1 (and ensure missing keys default to 1)
        out = {}
        for n in nurse_codes:
            out.setdefault(n, {})
            nd = src.get(n, {}) if isinstance(src.get(n, {}), dict) else {}
            for d in day_dates:
                out[n].setdefault(d, {})
                ds = nd.get(d, {}) if isinstance(nd.get(d, {}), dict) else {}
                for s in shift_codes:
                    val = ds.get(s, 1)
                    out[n][d][s] = 1 if int(val) != 0 else 0
        return out

    # Case 2: list — two sub-formats supported:
    #   (a) v1 flat rows: {"nurseCode":"...", "date":"...", "shiftCode":"...", "type":"UNAVAILABLE"/...}
    #   (b) grouped windows: {"nurseCode":"...", "windows":[{"date":"...", "shiftCode":"...", "allowed":bool}]}
    if isinstance(src, list):
        out = {n: {d: {s: 1 for s in shift_codes} for d in day_dates} for n in nurse_codes}
        day_date_set = set(day_dates)
        shift_code_set = set(shift_codes)

        for rule in src:
            if not isinstance(rule, dict):
                continue

            # Sub-format (a): v1 flat row — has "type" + "date" + "shiftCode" directly on row
            if "type" in rule and "date" in rule and "shiftCode" in rule:
                nurse = rule.get("nurseCode") or rule.get("nurse")
                date = rule.get("date")
                sc = rule.get("shiftCode")
                typ = rule.get("type", "")

                if not nurse or nurse not in out:
                    continue
                if date not in day_date_set:
                    continue

                val = 0 if typ in ("UNAVAILABLE", "BLOCKED", "DAY_OFF") else 1

                if str(sc).upper() == "ALL":
                    for shift in shift_codes:
                        out[nurse][date][shift] = val
                elif sc in shift_code_set:
                    out[nurse][date][sc] = val
                continue

            # Sub-format (b): grouped windows
            nurse = rule.get("nurseCode") or rule.get("nurse") or rule.get("code")
            windows = rule.get("windows") or rule.get("items") or []

            if not nurse or nurse not in out:
                continue
            if not isinstance(windows, list):
                continue

            for w in windows:
                if not isinstance(w, dict):
                    continue
                date = w.get("date")
                shift = w.get("shiftCode") or w.get("shift")
                allowed = w.get("allowed")

                if date in day_date_set and shift in shift_code_set and allowed is not None:
                    out[nurse][date][shift] = 1 if bool(allowed) else 0

        return out

    # Unknown format → safest: treat as None (all available)
    return None


def _normalize_preferences(src, nurse_codes, day_dates, shift_codes):
    """
    Convert preferences into Dict[nurse][day][shift] = penalty(int)

    Acceptable inputs:
      1) dict already in correct shape
      2) list like:
         [
           {"nurseCode":"W001","windows":[{"date":"2026-01-01","shiftCode":"DAY","penalty":5}, ...]},
           ...
         ]
    """
    if src is None:
        return None

    if isinstance(src, dict):
        out = {}
        for n in nurse_codes:
            out.setdefault(n, {})
            nd = src.get(n, {}) if isinstance(src.get(n, {}), dict) else {}
            for d in day_dates:
                out[n].setdefault(d, {})
                ds = nd.get(d, {}) if isinstance(nd.get(d, {}), dict) else {}
                for s in shift_codes:
                    val = ds.get(s, 0)
                    try:
                        out[n][d][s] = int(val)
                    except Exception:
                        out[n][d][s] = 0
        return out

    if isinstance(src, list):
        out = {n: {d: {s: 0 for s in shift_codes} for d in day_dates} for n in nurse_codes}

        for rule in src:
            if not isinstance(rule, dict):
                continue
            nurse = rule.get("nurseCode") or rule.get("nurse") or rule.get("code")
            windows = rule.get("windows") or rule.get("items") or []

            if not nurse or nurse not in out:
                continue
            if not isinstance(windows, list):
                continue

            for w in windows:
                if not isinstance(w, dict):
                    continue
                date = w.get("date")
                shift = w.get("shiftCode") or w.get("shift")
                penalty = w.get("penalty")

                if date in day_dates and shift in shift_codes and penalty is not None:
                    try:
                        out[nurse][date][shift] = int(penalty)
                    except Exception:
                        out[nurse][date][shift] = 0

        return out

    return None


def _to_solve_request(normalized_obj: dict, time_limit_seconds: int | None) -> dict:
    """
    Convert NormalizedInput.v1 (your normalizer output) into SolveRequest
    that solver_cli.py expects:
      - nurses: List[str]
      - days: List[str]
      - shifts: List[str]
      - demand: Dict[day][shift] = int

    Plus optional:
      - availability: Dict[nurse][day][shift] = 0/1
      - preferences: Dict[nurse][day][shift] = penalty
      - time_limit_sec
    """
    payload = normalized_obj.get("payload") or normalized_obj

    horizon = payload.get("horizon") or {}
    days = horizon.get("days") or []

    nurses = payload.get("nurses") or []
    shifts = payload.get("shifts") or []
    coverage_rules = payload.get("coverageRules") or []

    # days: list[str]
    day_dates = []
    day_types_by_date = {}
    for d in days:
        date = d.get("date") if isinstance(d, dict) else str(d)
        day_dates.append(date)
        if isinstance(d, dict):
            day_types_by_date[date] = d.get("dayType")

    # nurses: list[str]
    nurse_codes = []
    for n in nurses:
        if isinstance(n, dict) and n.get("code"):
            nurse_codes.append(n["code"])
        else:
            nurse_codes.append(str(n))

    # shifts: list[str]
    shift_codes = []
    for s in shifts:
        if isinstance(s, dict) and s.get("code"):
            shift_codes.append(s["code"])
        else:
            shift_codes.append(str(s))

    # demand: Dict[date][shift] = minWorkers
    demand = {}
    for date in day_dates:
        demand[date] = {}
        dt = day_types_by_date.get(date)

        for r in coverage_rules:
            if not isinstance(r, dict):
                continue
            if dt is not None and r.get("dayType") != dt:
                continue

            sc = r.get("shiftCode")
            mw = r.get("minWorkers")
            if sc is None or mw is None:
                continue

            try:
                mw_int = int(mw)
            except Exception:
                continue

            demand[date][sc] = mw_int

        # default missing shifts to 0
        for sc in shift_codes:
            if sc not in demand[date]:
                demand[date][sc] = 0

    solve_req = {
        "nurses": nurse_codes,
        "days": day_dates,
        "shifts": shift_codes,
        "demand": demand,
    }

    # Optional: availability + preferences (convert list→dict if needed)
    solve_req["availability"] = _normalize_availability(
        payload.get("availability"),
        nurse_codes=nurse_codes,
        day_dates=day_dates,
        shift_codes=shift_codes,
    )
    solve_req["preferences"] = _normalize_preferences(
        payload.get("preferences"),
        nurse_codes=nurse_codes,
        day_dates=day_dates,
        shift_codes=shift_codes,
    )

    # Time limit mapping for solver_cli SolveRequest: time_limit_sec
    if time_limit_seconds is not None:
        try:
            solve_req["time_limit_sec"] = float(time_limit_seconds)
        except Exception:
            pass

    # Pass-through if your normalizer already computed these in correct shapes
    if isinstance(payload.get("nurse_skills"), dict):
        solve_req["nurse_skills"] = payload["nurse_skills"]
    if isinstance(payload.get("required_skills"), dict):
        solve_req["required_skills"] = payload["required_skills"]
    if isinstance(payload.get("week_index_by_day"), dict):
        solve_req["week_index_by_day"] = payload["week_index_by_day"]
    if isinstance(payload.get("min_total_shifts_per_nurse"), dict):
        solve_req["min_total_shifts_per_nurse"] = payload["min_total_shifts_per_nurse"]
    if isinstance(payload.get("max_total_shifts_per_nurse"), dict):
        solve_req["max_total_shifts_per_nurse"] = payload["max_total_shifts_per_nurse"]
    if isinstance(payload.get("regular_shifts_per_nurse"), dict):
        solve_req["regular_shifts_per_nurse"] = payload["regular_shifts_per_nurse"]
    if isinstance(payload.get("max_overtime_per_nurse"), dict):
        solve_req["max_overtime_per_nurse"] = payload["max_overtime_per_nurse"]

    # Derive per-nurse regular/overtime maps from nurses[] if missing.
    if "regular_shifts_per_nurse" not in solve_req or "max_overtime_per_nurse" not in solve_req:
        nurse_list = payload.get("nurses") or []
        derived_regular = {}
        derived_max_ot = {}
        for n in nurse_list:
            if not isinstance(n, dict):
                continue
            code = n.get("code")
            if not code:
                continue
            reg = n.get("regularShiftsPerPeriod")
            ot = n.get("maxOvertimeShifts")

            if reg is not None:
                try:
                    derived_regular[str(code)] = int(reg)
                except Exception:
                    pass
            if ot is not None:
                try:
                    derived_max_ot[str(code)] = int(ot)
                except Exception:
                    pass

        if "regular_shifts_per_nurse" not in solve_req and derived_regular:
            solve_req["regular_shifts_per_nurse"] = derived_regular
        if "max_overtime_per_nurse" not in solve_req and derived_max_ot:
            solve_req["max_overtime_per_nurse"] = derived_max_ot

    # Derive max_total_shifts_per_nurse.
    # Use reg + ot + 2 as the cap to ensure full 180-slot coverage is always feasible
    # (reg=18, ot=5 → max=23 is exactly 1 short of 180 with 8 nurses, so we add headroom).
    if "max_total_shifts_per_nurse" not in solve_req:
        nurse_list = payload.get("nurses") or []
        max_total = {}

        regular_map = solve_req.get("regular_shifts_per_nurse") or {}
        max_ot_map = solve_req.get("max_overtime_per_nurse") or {}

        for code in nurse_codes:
            reg = regular_map.get(code)
            ot = max_ot_map.get(code)
            if reg is None or ot is None:
                continue
            try:
                max_total[str(code)] = int(reg) + int(ot) + 2
            except Exception:
                pass

        # Fallback to direct nurse field derivation if maps were incomplete
        for n in nurse_list:
            if not isinstance(n, dict):
                continue
            code = n.get("code")
            if not code:
                continue
            reg = n.get("regularShiftsPerPeriod")
            ot = n.get("maxOvertimeShifts")
            if reg is not None and ot is not None and str(code) not in max_total:
                try:
                    max_total[str(code)] = int(reg) + int(ot) + 2
                except Exception:
                    pass
        if max_total:
            solve_req["max_total_shifts_per_nurse"] = max_total

    # Derive min_total_shifts_per_nurse from minShiftsPerPeriod or regularShiftsPerPeriod
    if "min_total_shifts_per_nurse" not in solve_req:
        nurse_list = payload.get("nurses") or []
        min_total = {}
        for n in nurse_list:
            if not isinstance(n, dict):
                continue
            code = n.get("code")
            if not code:
                continue
            min_sp = n.get("minShiftsPerPeriod") or n.get("regularShiftsPerPeriod")
            if min_sp is not None:
                try:
                    min_total[str(code)] = int(min_sp)
                except Exception:
                    pass
        if min_total:
            solve_req["min_total_shifts_per_nurse"] = min_total

    # Pass constraint profile fields to solver
    constraints = payload.get("constraints") or {}
    ignore_avail_emergency = constraints.get("ignoreAvailabilityInEmergency", False)
    solve_req["ignore_availability_in_emergency"] = bool(ignore_avail_emergency)

    # max_shifts_per_day: 1 = no doubles, 2 = allow doubles (default 1)
    max_spd = constraints.get("maxShiftsPerDay")
    if max_spd is not None:
        try:
            solve_req["max_shifts_per_day"] = int(max_spd)
        except Exception:
            pass

    # Shift-sequence toggles
    for src_key, dst_key, default in [
        ("forbidEveningToNight",      "forbid_evening_to_night",          True),
        ("forbidNightToMorning",       "forbid_night_to_morning",           True),
        ("forbidMorningToNightSameDay","forbid_morning_to_night_same_day",  False),
    ]:
        val = constraints.get(src_key)
        if val is not None:
            solve_req[dst_key] = bool(val)

    # Weekly limits
    min_days_off = constraints.get("minDaysOffPerWeek")
    if min_days_off is not None:
        try:
            solve_req["min_days_off_per_week"] = int(min_days_off)
        except Exception:
            pass

    max_nights = constraints.get("maxNightsPerWeek")
    if max_nights is not None:
        try:
            solve_req["max_nights_per_week"] = int(max_nights)
        except Exception:
            pass

    # Force full 2-nurse coverage per shift — understaff must outweigh any OT cost
    solve_req["weights"] = {"understaff_penalty": 50000, "overtime_penalty": 0}

    # If availability/preferences became None (unknown format), remove key entirely
    # (None is allowed by SolveRequest, but removing keeps payload smaller)
    if solve_req.get("availability") is None:
        solve_req.pop("availability", None)
    if solve_req.get("preferences") is None:
        solve_req.pop("preferences", None)

    return solve_req


def handler(event, context):
    """
    Expected input from Step Functions:
    {
      "jobId": "...",
      "scheduleId": "1",
      "normalizedArtifact": {"bucket":"...","key":"..."},
      "timeLimitSeconds": 60
    }
    """
    job_id = event.get("jobId")
    if not job_id:
        return {"status": "FAILED", "message": "Missing jobId"}

    norm = event.get("normalizedArtifact") or {}
    bucket = norm.get("bucket")
    key = norm.get("key")

    if not bucket or not key:
        return {"status": "FAILED", "message": "Missing normalizedArtifact.bucket/key"}

    t0 = time.time()

    try:
        normalized_text = _read_json_text(bucket, key)
        normalized_obj = json.loads(normalized_text)

        solve_req = _to_solve_request(normalized_obj, event.get("timeLimitSeconds"))
        solve_req_text = json.dumps(solve_req, ensure_ascii=False)

        proc = subprocess.run(
            ["python", "solver_cli.py", "--cli"],
            input=solve_req_text,
            text=True,
            capture_output=True,
            check=False,
        )

        stdout = (proc.stdout or "").strip()
        stderr = (proc.stderr or "").strip()

        if proc.returncode != 0:
            raise RuntimeError(f"solver_cli failed: {stderr or stdout}")

        solver_result = json.loads(stdout)

        feasible = (
            bool(solver_result.get("status") in ("OPTIMAL", "FEASIBLE", "RELAXED_OPTIMAL", "RELAXED_FEASIBLE", "HEURISTIC"))
            if "status" in solver_result
            else bool(solver_result.get("assignments"))
        )
        objective = solver_result.get("objective_value", None)

    except Exception as e:
        solver_result = {
            "status": "ERROR",
            "objective_value": None,
            "assignments": [],
            "understaffed": [],
            "nurse_stats": [],
            "details": {"error": str(e)},
        }
        feasible = False
        objective = None

    elapsed_ms = int((time.time() - t0) * 1000)

    out_obj = {
        "schema": "SolverResult.v1",
        "jobId": job_id,
        "plan": "A_STRICT",
        "createdAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "elapsedMs": elapsed_ms,
        "result": solver_result,
    }

    out_key = _key("jobs", job_id, "solve-plan-a-strict.result.json")
    out_text = json.dumps(out_obj, ensure_ascii=False)
    out_bytes, out_sha = _write_json(ARTIFACTS_BUCKET, out_key, out_text)

    return {
        "status": "COMPLETED",
        "op_done": "SOLVE_PLAN_A_STRICT",
        "jobId": job_id,
        "scheduleId": event.get("scheduleId"),
        "solverArtifact": {
            "type": "SOLVER_OUTPUT",
            "bucket": ARTIFACTS_BUCKET,
            "key": out_key,
            "sha256": out_sha,
            "bytes": out_bytes,
            "elapsedMs": elapsed_ms,
        },
        "solver": {
            "feasible": feasible,
            "objective": objective,
        },
    }
