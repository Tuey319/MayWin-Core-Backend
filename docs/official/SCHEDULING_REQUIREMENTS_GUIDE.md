# Scheduling Requirements Guide: How to Define Your Unit Rules

This guide is designed for Head Nurses, Department Heads, and Hospital Administrators to help you translate your operational needs into clear, systematic rules for the MayWin AI scheduling engine.

The goal is to move away from "scheduling by vibe" and towards a "rule-based" system. This ensures fairness, safety, and efficiency while making it easier to scale the system to new departments.

---

## 1. The Two Types of Rules

In our system, every rule falls into one of two categories. When you think of a new requirement, ask yourself: **"Is this a Law or a Preference?"**

### A. Hard Constraints (The Law)
These are **non-negotiable**. If the solver cannot follow even one of these, it will consider the schedule "Infeasible" (impossible) or enter "Emergency Mode."
*   **Examples:** "A nurse cannot work if they are on holiday," "A nurse cannot work a morning shift immediately after a night shift (0 hours rest)."
*   **Use these for:** Legal compliance, critical safety, and absolute unavailability.

### B. Soft Constraints (The Priorities)
These are **goals**. The solver will try its absolute best to follow them, but it can "break" them if necessary to ensure the shift is covered. Every violation of a soft constraint carries a **Penalty Score**.
*   **Examples:** "Try to give everyone an equal number of weekends off," "Nurse A prefers morning shifts," "Avoid giving a nurse an evening shift followed by a night shift on the same day."
*   **Use these for:** Fairness, staff satisfaction, and "nice-to-have" patterns.

---

## 2. Our Current Rules Catalog

Before proposing a new rule, check if we already have it. You can toggle these on or off and adjust their numbers for your specific unit.

### Staffing & Coverage
*   **Minimum Coverage:** Exactly how many nurses are needed for Morning, Evening, and Night shifts each day (weekdays vs. weekends).
*   **Skill Requirements:** "At least 1 Senior nurse must be present on every shift."

### Rest & Safety
*   **Rest Hours:** Minimum gap (e.g., 11 hours) between the end of one shift and the start of the next.
*   **Night → Morning Forbid:** Automatically forbids working a Morning shift (07:00) after finishing a Night shift (07:00) the same day.
*   **Consecutive Nights:** Max 3 night shifts in a row.
*   **Consecutive Work Days:** Max 5 or 6 days of work in a row before a mandatory day off.

### Workload & Fairness
*   **Monthly Shift Cap:** Max 19 working days per month (ensuring at least 11 days off).
*   **Shift-Type Cap:** Max 9 Morning, 9 Evening, or 9 Night shifts per nurse per month.
*   **Overtime Limit:** Max 12 overtime shifts per nurse per month.
*   **Workload Balancing:** Automatically tries to ensure the difference between the most-worked nurse and the least-worked nurse is as small as possible.

---

## 3. How to Describe a New Requirement

If you have a requirement that isn't listed above, please describe it using this **systematic template**. This makes it much easier for the technical team to implement.

### The Template:
1.  **Requirement Name:** (e.g., "The Friday-Saturday Rule")
2.  **Condition (Who/When):** Who does this apply to? When does it happen?
    *   *Bad:* "Nurses don't like working both days."
    *   *Good:* "Any nurse assigned to a Night shift on Friday."
3.  **The Rule (What):** What is restricted?
    *   *Example:* "...should not be assigned to a Morning shift on Sunday."
4.  **Priority (Hard or Soft):**
    *   If **Soft**, how "painful" is it to break? (Low, Medium, High penalty).
5.  **The Rationale:** Why is this rule needed? (Safety? Fairness? Specific union rule?)

---

## 4. Examples: Turning "Vibes" into "Systems"

| The "Vibe" (Unclear) | The "Systematic Rule" (Clear) |
|---|---|
| "We need enough experienced people." | "Every 'Morning' shift must have at least 1 nurse with the 'Senior' skill tag." |
| "Nurses hate the 'Quick Turnaround'." | "Soft Constraint (High Penalty): Forbid Morning shift if the nurse worked Evening the day before (Rest < 12h)." |
| "Fairness is important for weekends." | "Goal: Minimize the difference in 'Total Weekend Shifts' between all full-time nurses." |
| "I don't want to work with Nurse X." | "Soft Constraint (Low Penalty): Avoid assigning Nurse A and Nurse B to the same shift slot." |
| "Don't burn out the juniors." | "Hard Constraint: For nurses with < 1 year experience, max 2 night shifts per week." |

---

## 5. Thinking About Priorities

When you have 50 rules, the solver needs to know which ones to sacrifice first if a conflict occurs. We rank them in 4 Tiers:

1.  **Tier 1: Coverage & Safety.** (e.g., "A nurse must be there," "No 0-hour rest").
2.  **Tier 2: Legal & Contractual.** (e.g., "Max overtime," "Mandatory days off").
3.  **Tier 3: Fairness.** (e.g., "Equal distribution of nights").
4.  **Tier 4: Personal Preferences.** (e.g., "Nurse A wants Friday off for a wedding").

**Task for you:** If you are requesting 5 new rules, please tell us which Tiers they belong to.

---

## 6. Feedback Loop

As we expand to more units, we want to know:
1.  **What is missing?** (Rules we don't have yet).
2.  **What is too strict?** (Rules that make your schedule impossible to fill).
3.  **What is "unfair"?** (Patterns the AI produces that humans wouldn't).

Please use the template in Section 3 to submit any new requirements.
