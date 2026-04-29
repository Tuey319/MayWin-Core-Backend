// ─────────────────────────────────────────────────────────────────────────────
// Postman Test Script – May 2026 Solver Output Verification
// Paste into the "Tests" tab of your solve/result request
// ─────────────────────────────────────────────────────────────────────────────

const body = pm.response.json();
const data = body.payload ?? body.data ?? body;
const assignments = data.assignments ?? [];

const MONTH_DATES = Array.from({ length: 31 }, (_, i) =>
    `2026-05-${String(i + 1).padStart(2, '0')}`
);
const SHIFTS = ["MORNING", "EVENING", "NIGHT"];

const NURSE1_ID   = "69";                               // morning-only, fixed off
const CORE_NURSES = ["70", "71", "72", "73", "74", "75", "76"];
const ALL_NURSES  = [NURSE1_ID, ...CORE_NURSES];

// Weekends + May 4 public holiday → NURSE_001 day-off dates
const NURSE1_OFF_DATES = new Set([
    "2026-05-02","2026-05-03","2026-05-04",
    "2026-05-09","2026-05-10",
    "2026-05-16","2026-05-17",
    "2026-05-23","2026-05-24",
    "2026-05-30","2026-05-31",
]);

// ── Helpers ───────────────────────────────────────────────────────────────────
const byWorker  = id   => assignments.filter(a => String(a.workerId) === String(id));
const onDate    = (id, d) => byWorker(id).filter(a => a.date === d);
const worked    = (id, d) => onDate(id, d).length > 0;
const shifts    = (id, d) => onDate(id, d).map(a => a.shiftCode);

function workedDays(id) {
    return new Set(byWorker(id).map(a => a.date)).size;
}
function countShift(id, code) {
    return byWorker(id).filter(a => a.shiftCode === code).length;
}
function maxConsecutiveWork(id) {
    let max = 0, run = 0;
    for (const d of MONTH_DATES) {
        run = worked(id, d) ? run + 1 : 0;
        max = Math.max(max, run);
    }
    return max;
}
function maxConsecutiveNights(id) {
    let max = 0, run = 0;
    for (const d of MONTH_DATES) {
        run = onDate(id, d).some(a => a.shiftCode === 'NIGHT') ? run + 1 : 0;
        max = Math.max(max, run);
    }
    return max;
}
function maxNightsAnyWeek(id) {
    // rolling 7-day window across the month
    let max = 0;
    for (let i = 0; i <= MONTH_DATES.length - 7; i++) {
        const week = MONTH_DATES.slice(i, i + 7);
        const n = week.filter(d => onDate(id, d).some(a => a.shiftCode === 'NIGHT')).length;
        max = Math.max(max, n);
    }
    return max;
}
function coverageOn(date, shift) {
    return assignments.filter(a => a.date === date && a.shiftCode === shift).length;
}

// ═════════════════════════════════════════════════════════════════════════════
// 1. Sanity
// ═════════════════════════════════════════════════════════════════════════════
pm.test("Response 200 OK", () => pm.response.to.have.status(200));
pm.test("assignments array present and non-empty", () =>
    pm.expect(assignments).to.be.an('array').with.length.above(0)
);
pm.test("Total assignments ≥ 186 (minimum coverage demand)", () =>
    pm.expect(assignments.length).to.be.at.least(186)
);

// ═════════════════════════════════════════════════════════════════════════════
// 2. NURSE_001 (worker 69) – morning-only hard constraints
// ═════════════════════════════════════════════════════════════════════════════
pm.test("NURSE_001: never assigned EVENING", () => {
    const v = byWorker(NURSE1_ID).filter(a => a.shiftCode === 'EVENING');
    pm.expect(v, JSON.stringify(v)).to.be.empty;
});
pm.test("NURSE_001: never assigned NIGHT", () => {
    const v = byWorker(NURSE1_ID).filter(a => a.shiftCode === 'NIGHT');
    pm.expect(v, JSON.stringify(v)).to.be.empty;
});
pm.test("NURSE_001: no work on fixed off-dates (weekends + May 4)", () => {
    const v = byWorker(NURSE1_ID).filter(a => NURSE1_OFF_DATES.has(a.date));
    pm.expect(v, JSON.stringify(v)).to.be.empty;
});
pm.test("NURSE_001: exactly 20 shifts worked (regular shifts per period)", () => {
    const n = byWorker(NURSE1_ID).length;
    pm.expect(n, `got ${n}`).to.equal(20);
});

// ═════════════════════════════════════════════════════════════════════════════
// 3. Coverage ≥ 2 nurses per shift per day (all 93 slots)
// ═════════════════════════════════════════════════════════════════════════════
const coverageViolations = [];
for (const d of MONTH_DATES)
    for (const s of SHIFTS) {
        const n = coverageOn(d, s);
        if (n < 2) coverageViolations.push(`${d} ${s}: ${n}/2`);
    }
pm.test(`Coverage ≥ 2 per shift per day (${MONTH_DATES.length * 3} slots)`, () =>
    pm.expect(coverageViolations, coverageViolations.join(' | ')).to.be.empty
);

// ═════════════════════════════════════════════════════════════════════════════
// 4. Max consecutive work days ≤ 6
// ═════════════════════════════════════════════════════════════════════════════
for (const id of ALL_NURSES) {
    const max = maxConsecutiveWork(id);
    pm.test(`Worker ${id}: max consecutive work days ≤ 6 (got ${max})`, () =>
        pm.expect(max).to.be.at.most(6)
    );
}

// ═════════════════════════════════════════════════════════════════════════════
// 5. Max consecutive night shifts ≤ 3
// ═════════════════════════════════════════════════════════════════════════════
for (const id of CORE_NURSES) {
    const max = maxConsecutiveNights(id);
    pm.test(`Worker ${id}: max consecutive nights ≤ 3 (got ${max})`, () =>
        pm.expect(max).to.be.at.most(3)
    );
}

// ═════════════════════════════════════════════════════════════════════════════
// 6. Forbid NIGHT → MORNING next day
// ═════════════════════════════════════════════════════════════════════════════
const nightToMorning = [];
for (const id of ALL_NURSES)
    for (let i = 0; i < MONTH_DATES.length - 1; i++) {
        const [today, tmrw] = [MONTH_DATES[i], MONTH_DATES[i + 1]];
        if (shifts(id, today).includes('NIGHT') && shifts(id, tmrw).includes('MORNING'))
            nightToMorning.push(`Worker ${id}: NIGHT ${today} → MORNING ${tmrw}`);
    }
pm.test("Forbid NIGHT → MORNING next day", () =>
    pm.expect(nightToMorning, nightToMorning.join(' | ')).to.be.empty
);

// ═════════════════════════════════════════════════════════════════════════════
// 7. Forbid EVENING → NIGHT next day
// ═════════════════════════════════════════════════════════════════════════════
const eveningToNight = [];
for (const id of ALL_NURSES)
    for (let i = 0; i < MONTH_DATES.length - 1; i++) {
        const [today, tmrw] = [MONTH_DATES[i], MONTH_DATES[i + 1]];
        if (shifts(id, today).includes('EVENING') && shifts(id, tmrw).includes('NIGHT'))
            eveningToNight.push(`Worker ${id}: EVENING ${today} → NIGHT ${tmrw}`);
    }
pm.test("Forbid EVENING → NIGHT next day", () =>
    pm.expect(eveningToNight, eveningToNight.join(' | ')).to.be.empty
);

// ═════════════════════════════════════════════════════════════════════════════
// 8. Forbid MORNING + NIGHT same day
// ═════════════════════════════════════════════════════════════════════════════
const morningNightSameDay = [];
for (const id of ALL_NURSES)
    for (const d of MONTH_DATES) {
        const s = shifts(id, d);
        if (s.includes('MORNING') && s.includes('NIGHT'))
            morningNightSameDay.push(`Worker ${id} on ${d}`);
    }
pm.test("Forbid MORNING + NIGHT same day", () =>
    pm.expect(morningNightSameDay, morningNightSameDay.join(' | ')).to.be.empty
);

// ═════════════════════════════════════════════════════════════════════════════
// 9. Min 11 days off per nurse
// ═════════════════════════════════════════════════════════════════════════════
for (const id of ALL_NURSES) {
    const off = 31 - workedDays(id);
    pm.test(`Worker ${id}: days off ≥ 11 (got ${off})`, () =>
        pm.expect(off).to.be.at.least(11)
    );
}

// ═════════════════════════════════════════════════════════════════════════════
// 10. Max shift type ≤ 9 per nurse (core nurses only; NURSE_001 is exempt)
// ═════════════════════════════════════════════════════════════════════════════
for (const id of CORE_NURSES)
    for (const s of SHIFTS) {
        const n = countShift(id, s);
        pm.test(`Worker ${id}: ${s} ≤ 9 (got ${n})`, () =>
            pm.expect(n).to.be.at.most(9)
        );
    }

// ═════════════════════════════════════════════════════════════════════════════
// 11. Max nights per week ≤ 3 (rolling 7-day window)
// ═════════════════════════════════════════════════════════════════════════════
for (const id of CORE_NURSES) {
    const max = maxNightsAnyWeek(id);
    pm.test(`Worker ${id}: max nights in any 7-day window ≤ 3 (got ${max})`, () =>
        pm.expect(max).to.be.at.most(3)
    );
}

// ═════════════════════════════════════════════════════════════════════════════
// 12. Max 2 shifts per nurse per day
// ═════════════════════════════════════════════════════════════════════════════
const doubleShiftOver = [];
for (const id of ALL_NURSES)
    for (const d of MONTH_DATES) {
        const n = onDate(id, d).length;
        if (n > 2) doubleShiftOver.push(`Worker ${id} on ${d}: ${n} shifts`);
    }
pm.test("Max 2 shifts per nurse per day", () =>
    pm.expect(doubleShiftOver, doubleShiftOver.join(' | ')).to.be.empty
);

// ═════════════════════════════════════════════════════════════════════════════
// Console summary (visible in Postman console)
// ═════════════════════════════════════════════════════════════════════════════
console.log(`\n=== May 2026 Schedule Summary ===`);
console.log(`Total assignments: ${assignments.length} (min demand: 186)`);
console.log(`Coverage failures: ${coverageViolations.length}`);
console.log(`\nPer-nurse breakdown:`);
for (const id of ALL_NURSES) {
    const off = 31 - workedDays(id);
    console.log(
        `  Worker ${id}: worked=${workedDays(id)} off=${off}` +
        `  M=${countShift(id,'MORNING')} E=${countShift(id,'EVENING')} N=${countShift(id,'NIGHT')}` +
        `  maxConsecWork=${maxConsecutiveWork(id)} maxConsecNight=${maxConsecutiveNights(id)}`
    );
}
