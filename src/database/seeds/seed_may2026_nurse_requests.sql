-- Seed: May 2026 nurse hardcoded shift assignments (source=NURSE)
-- Workers in unit 5: 69 (NURSE_001), 70 (NURSE_002), 71 (NURSE_003),
--                    72 (NURSE_004), 73 (NURSE_005), 74 (NURSE_006),
--                    75 (NURSE_007), 76 (NURSE_008)
-- Strategy (same as manager seed):
--   Leave         → UNAVAILABLE on ALL             (blocked entirely)
--   Night shift   → UNAVAILABLE on MORNING+EVENING  (only NIGHT remains)
--   Morning shift → UNAVAILABLE on EVENING+NIGHT    (only MORNING remains)
--   Evening shift → UNAVAILABLE on MORNING+NIGHT    (only EVENING remains)
--   OT [M+E]      → UNAVAILABLE on NIGHT            (MORNING+EVENING both allowed)
-- ON CONFLICT DO NOTHING: manager entries on same slot take precedence.

DELETE FROM maywin_db.worker_availability
WHERE unit_id = 5
  AND source = 'NURSE'
  AND date >= '2026-05-01'
  AND date <= '2026-05-31';

INSERT INTO maywin_db.worker_availability
  (worker_id, unit_id, date, shift_code, type, source, reason, attributes)
VALUES
-- ── 2026-05-01 ───────────────────────────────────────────────────────────────
-- w72 (NURSE_004) Night
(72, 5, '2026-05-01', 'MORNING', 'UNAVAILABLE', 'NURSE', 'Hard shift: Night', '{}'),
(72, 5, '2026-05-01', 'EVENING', 'UNAVAILABLE', 'NURSE', 'Hard shift: Night', '{}'),
-- w73 (NURSE_005) Night
(73, 5, '2026-05-01', 'MORNING', 'UNAVAILABLE', 'NURSE', 'Hard shift: Night', '{}'),
(73, 5, '2026-05-01', 'EVENING', 'UNAVAILABLE', 'NURSE', 'Hard shift: Night', '{}'),
-- w75 (NURSE_007) Night
(75, 5, '2026-05-01', 'MORNING', 'UNAVAILABLE', 'NURSE', 'Hard shift: Night', '{}'),
(75, 5, '2026-05-01', 'EVENING', 'UNAVAILABLE', 'NURSE', 'Hard shift: Night', '{}'),
-- w76 (NURSE_008) Leave
(76, 5, '2026-05-01', 'ALL',     'UNAVAILABLE', 'NURSE', 'Hard shift: Leave', '{}'),

-- ── 2026-05-02 ───────────────────────────────────────────────────────────────
-- w71 (NURSE_003) Leave
(71, 5, '2026-05-02', 'ALL',     'UNAVAILABLE', 'NURSE', 'Hard shift: Leave', '{}'),
-- w72 (NURSE_004) Morning
(72, 5, '2026-05-02', 'EVENING', 'UNAVAILABLE', 'NURSE', 'Hard shift: Morning', '{}'),
(72, 5, '2026-05-02', 'NIGHT',   'UNAVAILABLE', 'NURSE', 'Hard shift: Morning', '{}'),
-- w73 (NURSE_005) Leave
(73, 5, '2026-05-02', 'ALL',     'UNAVAILABLE', 'NURSE', 'Hard shift: Leave', '{}'),
-- w76 (NURSE_008) Leave
(76, 5, '2026-05-02', 'ALL',     'UNAVAILABLE', 'NURSE', 'Hard shift: Leave', '{}'),

-- ── 2026-05-03 ───────────────────────────────────────────────────────────────
-- w71 (NURSE_003) Evening
(71, 5, '2026-05-03', 'MORNING', 'UNAVAILABLE', 'NURSE', 'Hard shift: Evening', '{}'),
(71, 5, '2026-05-03', 'NIGHT',   'UNAVAILABLE', 'NURSE', 'Hard shift: Evening', '{}'),
-- w72 (NURSE_004) Leave
(72, 5, '2026-05-03', 'ALL',     'UNAVAILABLE', 'NURSE', 'Hard shift: Leave', '{}'),
-- w73 (NURSE_005) Leave
(73, 5, '2026-05-03', 'ALL',     'UNAVAILABLE', 'NURSE', 'Hard shift: Leave', '{}'),
-- w75 (NURSE_007) Night
(75, 5, '2026-05-03', 'MORNING', 'UNAVAILABLE', 'NURSE', 'Hard shift: Night', '{}'),
(75, 5, '2026-05-03', 'EVENING', 'UNAVAILABLE', 'NURSE', 'Hard shift: Night', '{}'),
-- w76 (NURSE_008) Leave
(76, 5, '2026-05-03', 'ALL',     'UNAVAILABLE', 'NURSE', 'Hard shift: Leave', '{}'),

-- ── 2026-05-04 ───────────────────────────────────────────────────────────────
-- w72 (NURSE_004) Leave
(72, 5, '2026-05-04', 'ALL',     'UNAVAILABLE', 'NURSE', 'Hard shift: Leave', '{}'),
-- w73 (NURSE_005) Leave
(73, 5, '2026-05-04', 'ALL',     'UNAVAILABLE', 'NURSE', 'Hard shift: Leave', '{}'),
-- w75 (NURSE_007) Leave
(75, 5, '2026-05-04', 'ALL',     'UNAVAILABLE', 'NURSE', 'Hard shift: Leave', '{}'),
-- w76 (NURSE_008) Leave
(76, 5, '2026-05-04', 'ALL',     'UNAVAILABLE', 'NURSE', 'Hard shift: Leave', '{}'),

-- ── 2026-05-05 ───────────────────────────────────────────────────────────────
-- w72 (NURSE_004) Leave
(72, 5, '2026-05-05', 'ALL',     'UNAVAILABLE', 'NURSE', 'Hard shift: Leave', '{}'),
-- w73 (NURSE_005) Evening
(73, 5, '2026-05-05', 'MORNING', 'UNAVAILABLE', 'NURSE', 'Hard shift: Evening', '{}'),
(73, 5, '2026-05-05', 'NIGHT',   'UNAVAILABLE', 'NURSE', 'Hard shift: Evening', '{}'),
-- w75 (NURSE_007) Morning
(75, 5, '2026-05-05', 'EVENING', 'UNAVAILABLE', 'NURSE', 'Hard shift: Morning', '{}'),
(75, 5, '2026-05-05', 'NIGHT',   'UNAVAILABLE', 'NURSE', 'Hard shift: Morning', '{}'),

-- ── 2026-05-06 ───────────────────────────────────────────────────────────────
-- w72 (NURSE_004) Evening
(72, 5, '2026-05-06', 'MORNING', 'UNAVAILABLE', 'NURSE', 'Hard shift: Evening', '{}'),
(72, 5, '2026-05-06', 'NIGHT',   'UNAVAILABLE', 'NURSE', 'Hard shift: Evening', '{}'),
-- w75 (NURSE_007) Leave
(75, 5, '2026-05-06', 'ALL',     'UNAVAILABLE', 'NURSE', 'Hard shift: Leave', '{}'),

-- ── 2026-05-08 ───────────────────────────────────────────────────────────────
-- w70 (NURSE_002) Morning
(70, 5, '2026-05-08', 'EVENING', 'UNAVAILABLE', 'NURSE', 'Hard shift: Morning', '{}'),
(70, 5, '2026-05-08', 'NIGHT',   'UNAVAILABLE', 'NURSE', 'Hard shift: Morning', '{}'),
-- w73 (NURSE_005) Night
(73, 5, '2026-05-08', 'MORNING', 'UNAVAILABLE', 'NURSE', 'Hard shift: Night', '{}'),
(73, 5, '2026-05-08', 'EVENING', 'UNAVAILABLE', 'NURSE', 'Hard shift: Night', '{}'),
-- w75 (NURSE_007) Morning
(75, 5, '2026-05-08', 'EVENING', 'UNAVAILABLE', 'NURSE', 'Hard shift: Morning', '{}'),
(75, 5, '2026-05-08', 'NIGHT',   'UNAVAILABLE', 'NURSE', 'Hard shift: Morning', '{}'),

-- ── 2026-05-09 ───────────────────────────────────────────────────────────────
(70, 5, '2026-05-09', 'ALL',     'UNAVAILABLE', 'NURSE', 'Hard shift: Leave', '{}'),
(73, 5, '2026-05-09', 'ALL',     'UNAVAILABLE', 'NURSE', 'Hard shift: Leave', '{}'),
(75, 5, '2026-05-09', 'ALL',     'UNAVAILABLE', 'NURSE', 'Hard shift: Leave', '{}'),
(76, 5, '2026-05-09', 'ALL',     'UNAVAILABLE', 'NURSE', 'Hard shift: Leave', '{}'),

-- ── 2026-05-10 ───────────────────────────────────────────────────────────────
(70, 5, '2026-05-10', 'ALL',     'UNAVAILABLE', 'NURSE', 'Hard shift: Leave', '{}'),
(73, 5, '2026-05-10', 'ALL',     'UNAVAILABLE', 'NURSE', 'Hard shift: Leave', '{}'),
(75, 5, '2026-05-10', 'ALL',     'UNAVAILABLE', 'NURSE', 'Hard shift: Leave', '{}'),
(76, 5, '2026-05-10', 'ALL',     'UNAVAILABLE', 'NURSE', 'Hard shift: Leave', '{}'),

-- ── 2026-05-11 ───────────────────────────────────────────────────────────────
-- w70 (NURSE_002) Leave
(70, 5, '2026-05-11', 'ALL',     'UNAVAILABLE', 'NURSE', 'Hard shift: Leave', '{}'),
-- w72 (NURSE_004) Morning
(72, 5, '2026-05-11', 'EVENING', 'UNAVAILABLE', 'NURSE', 'Hard shift: Morning', '{}'),
(72, 5, '2026-05-11', 'NIGHT',   'UNAVAILABLE', 'NURSE', 'Hard shift: Morning', '{}'),
-- w73 (NURSE_005) Evening
(73, 5, '2026-05-11', 'MORNING', 'UNAVAILABLE', 'NURSE', 'Hard shift: Evening', '{}'),
(73, 5, '2026-05-11', 'NIGHT',   'UNAVAILABLE', 'NURSE', 'Hard shift: Evening', '{}'),
-- w75 (NURSE_007) Evening
(75, 5, '2026-05-11', 'MORNING', 'UNAVAILABLE', 'NURSE', 'Hard shift: Evening', '{}'),
(75, 5, '2026-05-11', 'NIGHT',   'UNAVAILABLE', 'NURSE', 'Hard shift: Evening', '{}'),
-- w76 (NURSE_008) Leave
(76, 5, '2026-05-11', 'ALL',     'UNAVAILABLE', 'NURSE', 'Hard shift: Leave', '{}'),

-- ── 2026-05-12 ───────────────────────────────────────────────────────────────
-- w70 (NURSE_002) Morning
(70, 5, '2026-05-12', 'EVENING', 'UNAVAILABLE', 'NURSE', 'Hard shift: Morning', '{}'),
(70, 5, '2026-05-12', 'NIGHT',   'UNAVAILABLE', 'NURSE', 'Hard shift: Morning', '{}'),
-- w72 (NURSE_004) Leave
(72, 5, '2026-05-12', 'ALL',     'UNAVAILABLE', 'NURSE', 'Hard shift: Leave', '{}'),
-- w75 (NURSE_007) Night
(75, 5, '2026-05-12', 'MORNING', 'UNAVAILABLE', 'NURSE', 'Hard shift: Night', '{}'),
(75, 5, '2026-05-12', 'EVENING', 'UNAVAILABLE', 'NURSE', 'Hard shift: Night', '{}'),

-- ── 2026-05-13 ───────────────────────────────────────────────────────────────
-- w70 (NURSE_002) OT: Morning+Evening → block only Night
(70, 5, '2026-05-13', 'NIGHT',   'UNAVAILABLE', 'NURSE', 'Hard shift: Morning+Evening OT', '{}'),
-- w72 (NURSE_004) Morning
(72, 5, '2026-05-13', 'EVENING', 'UNAVAILABLE', 'NURSE', 'Hard shift: Morning', '{}'),
(72, 5, '2026-05-13', 'NIGHT',   'UNAVAILABLE', 'NURSE', 'Hard shift: Morning', '{}'),
-- w75 (NURSE_007) Night
(75, 5, '2026-05-13', 'MORNING', 'UNAVAILABLE', 'NURSE', 'Hard shift: Night', '{}'),
(75, 5, '2026-05-13', 'EVENING', 'UNAVAILABLE', 'NURSE', 'Hard shift: Night', '{}'),

-- ── 2026-05-15 ───────────────────────────────────────────────────────────────
-- w73 (NURSE_005) Night
(73, 5, '2026-05-15', 'MORNING', 'UNAVAILABLE', 'NURSE', 'Hard shift: Night', '{}'),
(73, 5, '2026-05-15', 'EVENING', 'UNAVAILABLE', 'NURSE', 'Hard shift: Night', '{}'),
-- w75 (NURSE_007) Morning
(75, 5, '2026-05-15', 'EVENING', 'UNAVAILABLE', 'NURSE', 'Hard shift: Morning', '{}'),
(75, 5, '2026-05-15', 'NIGHT',   'UNAVAILABLE', 'NURSE', 'Hard shift: Morning', '{}'),

-- ── 2026-05-16 ───────────────────────────────────────────────────────────────
(71, 5, '2026-05-16', 'ALL',     'UNAVAILABLE', 'NURSE', 'Hard shift: Leave', '{}'),
(73, 5, '2026-05-16', 'ALL',     'UNAVAILABLE', 'NURSE', 'Hard shift: Leave', '{}'),
(75, 5, '2026-05-16', 'ALL',     'UNAVAILABLE', 'NURSE', 'Hard shift: Leave', '{}'),
(76, 5, '2026-05-16', 'ALL',     'UNAVAILABLE', 'NURSE', 'Hard shift: Leave', '{}'),

-- ── 2026-05-17 ───────────────────────────────────────────────────────────────
(71, 5, '2026-05-17', 'ALL',     'UNAVAILABLE', 'NURSE', 'Hard shift: Leave', '{}'),
(73, 5, '2026-05-17', 'ALL',     'UNAVAILABLE', 'NURSE', 'Hard shift: Leave', '{}'),
(75, 5, '2026-05-17', 'ALL',     'UNAVAILABLE', 'NURSE', 'Hard shift: Leave', '{}'),
(76, 5, '2026-05-17', 'ALL',     'UNAVAILABLE', 'NURSE', 'Hard shift: Leave', '{}'),

-- ── 2026-05-18 ───────────────────────────────────────────────────────────────
-- w71 (NURSE_003) Morning
(71, 5, '2026-05-18', 'EVENING', 'UNAVAILABLE', 'NURSE', 'Hard shift: Morning', '{}'),
(71, 5, '2026-05-18', 'NIGHT',   'UNAVAILABLE', 'NURSE', 'Hard shift: Morning', '{}'),
-- w73 (NURSE_005) Evening
(73, 5, '2026-05-18', 'MORNING', 'UNAVAILABLE', 'NURSE', 'Hard shift: Evening', '{}'),
(73, 5, '2026-05-18', 'NIGHT',   'UNAVAILABLE', 'NURSE', 'Hard shift: Evening', '{}'),
-- w75 (NURSE_007) Evening
(75, 5, '2026-05-18', 'MORNING', 'UNAVAILABLE', 'NURSE', 'Hard shift: Evening', '{}'),
(75, 5, '2026-05-18', 'NIGHT',   'UNAVAILABLE', 'NURSE', 'Hard shift: Evening', '{}'),

-- ── 2026-05-23 ───────────────────────────────────────────────────────────────
-- w71 (NURSE_003) Leave
(71, 5, '2026-05-23', 'ALL',     'UNAVAILABLE', 'NURSE', 'Hard shift: Leave', '{}'),
-- w72 (NURSE_004) Morning
(72, 5, '2026-05-23', 'EVENING', 'UNAVAILABLE', 'NURSE', 'Hard shift: Morning', '{}'),
(72, 5, '2026-05-23', 'NIGHT',   'UNAVAILABLE', 'NURSE', 'Hard shift: Morning', '{}'),
-- w76 (NURSE_008) Leave
(76, 5, '2026-05-23', 'ALL',     'UNAVAILABLE', 'NURSE', 'Hard shift: Leave', '{}'),

-- ── 2026-05-24 ───────────────────────────────────────────────────────────────
-- w71 (NURSE_003) Morning
(71, 5, '2026-05-24', 'EVENING', 'UNAVAILABLE', 'NURSE', 'Hard shift: Morning', '{}'),
(71, 5, '2026-05-24', 'NIGHT',   'UNAVAILABLE', 'NURSE', 'Hard shift: Morning', '{}'),
-- w72 (NURSE_004) Leave
(72, 5, '2026-05-24', 'ALL',     'UNAVAILABLE', 'NURSE', 'Hard shift: Leave', '{}'),
-- w74 (NURSE_006) Night
(74, 5, '2026-05-24', 'MORNING', 'UNAVAILABLE', 'NURSE', 'Hard shift: Night', '{}'),
(74, 5, '2026-05-24', 'EVENING', 'UNAVAILABLE', 'NURSE', 'Hard shift: Night', '{}'),
-- w76 (NURSE_008) Leave
(76, 5, '2026-05-24', 'ALL',     'UNAVAILABLE', 'NURSE', 'Hard shift: Leave', '{}'),

-- ── 2026-05-25 ───────────────────────────────────────────────────────────────
-- w74 (NURSE_006) Leave
(74, 5, '2026-05-25', 'ALL',     'UNAVAILABLE', 'NURSE', 'Hard shift: Leave', '{}'),
-- w75 (NURSE_007) Morning
(75, 5, '2026-05-25', 'EVENING', 'UNAVAILABLE', 'NURSE', 'Hard shift: Morning', '{}'),
(75, 5, '2026-05-25', 'NIGHT',   'UNAVAILABLE', 'NURSE', 'Hard shift: Morning', '{}'),

-- ── 2026-05-26 ───────────────────────────────────────────────────────────────
-- w71 (NURSE_003) Morning
(71, 5, '2026-05-26', 'EVENING', 'UNAVAILABLE', 'NURSE', 'Hard shift: Morning', '{}'),
(71, 5, '2026-05-26', 'NIGHT',   'UNAVAILABLE', 'NURSE', 'Hard shift: Morning', '{}'),
-- w74 (NURSE_006) Leave
(74, 5, '2026-05-26', 'ALL',     'UNAVAILABLE', 'NURSE', 'Hard shift: Leave', '{}'),
-- w75 (NURSE_007) Evening
(75, 5, '2026-05-26', 'MORNING', 'UNAVAILABLE', 'NURSE', 'Hard shift: Evening', '{}'),
(75, 5, '2026-05-26', 'NIGHT',   'UNAVAILABLE', 'NURSE', 'Hard shift: Evening', '{}'),

-- ── 2026-05-27 ───────────────────────────────────────────────────────────────
(71, 5, '2026-05-27', 'ALL',     'UNAVAILABLE', 'NURSE', 'Hard shift: Leave', '{}'),
(72, 5, '2026-05-27', 'ALL',     'UNAVAILABLE', 'NURSE', 'Hard shift: Leave', '{}'),
-- w74 (NURSE_006) Evening
(74, 5, '2026-05-27', 'MORNING', 'UNAVAILABLE', 'NURSE', 'Hard shift: Evening', '{}'),
(74, 5, '2026-05-27', 'NIGHT',   'UNAVAILABLE', 'NURSE', 'Hard shift: Evening', '{}'),
-- w75 (NURSE_007) Morning
(75, 5, '2026-05-27', 'EVENING', 'UNAVAILABLE', 'NURSE', 'Hard shift: Morning', '{}'),
(75, 5, '2026-05-27', 'NIGHT',   'UNAVAILABLE', 'NURSE', 'Hard shift: Morning', '{}'),

-- ── 2026-05-28 ───────────────────────────────────────────────────────────────
(71, 5, '2026-05-28', 'ALL',     'UNAVAILABLE', 'NURSE', 'Hard shift: Leave', '{}'),
(72, 5, '2026-05-28', 'ALL',     'UNAVAILABLE', 'NURSE', 'Hard shift: Leave', '{}'),
-- w74 (NURSE_006) Night
(74, 5, '2026-05-28', 'MORNING', 'UNAVAILABLE', 'NURSE', 'Hard shift: Night', '{}'),
(74, 5, '2026-05-28', 'EVENING', 'UNAVAILABLE', 'NURSE', 'Hard shift: Night', '{}'),

-- ── 2026-05-29 ───────────────────────────────────────────────────────────────
(71, 5, '2026-05-29', 'ALL',     'UNAVAILABLE', 'NURSE', 'Hard shift: Leave', '{}'),
(72, 5, '2026-05-29', 'ALL',     'UNAVAILABLE', 'NURSE', 'Hard shift: Leave', '{}'),
-- w73 (NURSE_005) Night
(73, 5, '2026-05-29', 'MORNING', 'UNAVAILABLE', 'NURSE', 'Hard shift: Night', '{}'),
(73, 5, '2026-05-29', 'EVENING', 'UNAVAILABLE', 'NURSE', 'Hard shift: Night', '{}'),
(74, 5, '2026-05-29', 'ALL',     'UNAVAILABLE', 'NURSE', 'Hard shift: Leave', '{}'),

-- ── 2026-05-30 ───────────────────────────────────────────────────────────────
(71, 5, '2026-05-30', 'ALL',     'UNAVAILABLE', 'NURSE', 'Hard shift: Leave', '{}'),
-- w72 (NURSE_004) Morning
(72, 5, '2026-05-30', 'EVENING', 'UNAVAILABLE', 'NURSE', 'Hard shift: Morning', '{}'),
(72, 5, '2026-05-30', 'NIGHT',   'UNAVAILABLE', 'NURSE', 'Hard shift: Morning', '{}'),
(73, 5, '2026-05-30', 'ALL',     'UNAVAILABLE', 'NURSE', 'Hard shift: Leave', '{}'),
(74, 5, '2026-05-30', 'ALL',     'UNAVAILABLE', 'NURSE', 'Hard shift: Leave', '{}'),
(76, 5, '2026-05-30', 'ALL',     'UNAVAILABLE', 'NURSE', 'Hard shift: Leave', '{}'),

-- ── 2026-05-31 ───────────────────────────────────────────────────────────────
(71, 5, '2026-05-31', 'ALL',     'UNAVAILABLE', 'NURSE', 'Hard shift: Leave', '{}'),
(73, 5, '2026-05-31', 'ALL',     'UNAVAILABLE', 'NURSE', 'Hard shift: Leave', '{}'),
-- w74 (NURSE_006) Night
(74, 5, '2026-05-31', 'MORNING', 'UNAVAILABLE', 'NURSE', 'Hard shift: Night', '{}'),
(74, 5, '2026-05-31', 'EVENING', 'UNAVAILABLE', 'NURSE', 'Hard shift: Night', '{}'),
(76, 5, '2026-05-31', 'ALL',     'UNAVAILABLE', 'NURSE', 'Hard shift: Leave', '{}')

ON CONFLICT (worker_id, unit_id, date, shift_code)
DO UPDATE SET
  type   = EXCLUDED.type,
  source = EXCLUDED.source,
  reason = EXCLUDED.reason;
