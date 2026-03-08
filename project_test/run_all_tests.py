import os
import subprocess
from evaluate import evaluate_schedule

TEST_FOLDER = "test_cases"
RESULT_FOLDER = "results"

os.makedirs(RESULT_FOLDER, exist_ok=True)

results = []

for file in os.listdir(TEST_FOLDER):

    if not file.endswith(".json"):
        continue

    input_file = os.path.join(TEST_FOLDER, file)
    output_file = os.path.join(RESULT_FOLDER, "result_" + file)

    print("\nRunning solver on:", file)

    subprocess.run([
        "python",
        "solver_cli.py",
        "--cli",
        "--input",
        input_file,
        "--output",
        output_file
    ])

    evaluation = evaluate_schedule(output_file)

    results.append((file, evaluation))

    # ----------------------------------------
    # Pretty output
    # ----------------------------------------

    print("\n================================================")
    print(f"Scenario: {file}")
    print("------------------------------------------------")

    print(f"Coverage Score:      {evaluation['coverage_score']}/40")
    print(f"Fairness Score:      {evaluation['fairness_score']:.2f}/20")
    print(f"Preference Score:    {evaluation['preference_score']:.2f}/15")
    print(f"Overtime Score:      {evaluation['overtime_score']}/15")
    print(f"Night Balance Score: {evaluation['night_score']:.2f}/10")

    print("\nTotal Score:", evaluation["total_score"], "/100")

    print("\nReasons:")
    for r in evaluation["explanations"]:
        print(" -", r)

    print("================================================")


# ----------------------------------------
# Final summary
# ----------------------------------------

print("\n\n==============================")
print("FINAL SUMMARY")
print("==============================")

print(f"{'Scenario':50} Score")

for file, evaluation in results:
    print(f"{file:50} {evaluation['total_score']}/100")