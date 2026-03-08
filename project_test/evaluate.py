import json
import statistics


def evaluate_schedule(result_file):

    with open(result_file) as f:
        data = json.load(f)

    understaffed = data["understaffed"]
    nurse_stats = data["nurse_stats"]

    explanations = []

    nurse_count = len(nurse_stats)

    total_score = 0


    # ------------------------------------------------
    # 1 Coverage (40)
    # ------------------------------------------------

    missing = sum(x["missing"] for x in understaffed)

    if missing == 0:
        coverage_score = 40
        explanations.append("Coverage: All shifts filled (optimal)")
    elif missing <= 3:
        coverage_score = 35
        explanations.append("Coverage: Minor understaffing")
    elif missing <= 10:
        coverage_score = 25
        explanations.append("Coverage: Moderate understaffing")
    else:
        coverage_score = 10
        explanations.append("Coverage: Severe understaffing")

    total_score += coverage_score


    # ------------------------------------------------
    # 2 Workload fairness (20)
    # ------------------------------------------------

    shifts = [n["assigned_shifts"] for n in nurse_stats]

    std = statistics.stdev(shifts) if len(shifts) > 1 else 0

    if std <= 1:
        fairness_score = 20
    elif std <= 2:
        fairness_score = 18
    elif std <= 3:
        fairness_score = 15
    elif std <= 4:
        fairness_score = 12
    else:
        fairness_score = 8

    explanations.append(f"Fairness: workload std deviation = {round(std,2)}")

    total_score += fairness_score


    # ------------------------------------------------
    # 3 Preference satisfaction (15)
    # ------------------------------------------------

    satisfaction = [n["satisfaction"] for n in nurse_stats]
    avg_sat = sum(satisfaction) / len(satisfaction)

    if avg_sat >= 90:
        preference_score = 15
    elif avg_sat >= 80:
        preference_score = 13
    elif avg_sat >= 70:
        preference_score = 10
    else:
        preference_score = 6

    explanations.append(f"Preference satisfaction: avg = {round(avg_sat,2)}%")

    total_score += preference_score


    # ------------------------------------------------
    # 4 Overtime (15)
    # ------------------------------------------------

    total_overtime = sum(n["overtime"] for n in nurse_stats)

    overtime_per_nurse = total_overtime / nurse_count

    if overtime_per_nurse <= 0.5:
        overtime_score = 15
    elif overtime_per_nurse <= 1:
        overtime_score = 13
    elif overtime_per_nurse <= 2:
        overtime_score = 10
    elif overtime_per_nurse <= 3:
        overtime_score = 7
    else:
        overtime_score = 4

    explanations.append(
        f"Overtime: total={total_overtime}, per nurse={round(overtime_per_nurse,2)}"
    )

    total_score += overtime_score


    # ------------------------------------------------
    # 5 Night fairness (10)
    # ------------------------------------------------

    nights = [n["nights"] for n in nurse_stats]

    night_std = statistics.stdev(nights) if len(nights) > 1 else 0

    if night_std <= 0.5:
        night_score = 10
    elif night_std <= 1:
        night_score = 9
    elif night_std <= 1.5:
        night_score = 8
    elif night_std <= 2:
        night_score = 6
    else:
        night_score = 4

    explanations.append(f"Night fairness std deviation = {round(night_std,2)}")

    total_score += night_score


    return {
        "coverage_score": coverage_score,
        "fairness_score": fairness_score,
        "preference_score": preference_score,
        "overtime_score": overtime_score,
        "night_score": night_score,
        "total_score": round(total_score,2),
        "explanations": explanations
    }